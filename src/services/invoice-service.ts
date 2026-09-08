import { Decimal } from "decimal.js";
import { calculationEngine } from "../domain/calculation.js";
import type { InvoiceCalculationInput, CalculationResult } from "../domain/calculation.js";
import { invoiceStateMachine } from "../services/state-machine/invoice-state-machine.js";
import { invoiceNumberService } from "../services/numbering/service.js";
import { snapshotService } from "../services/snapshot/snapshot-service.js";
import { templateRenderer, buildTemplateData, type InvoiceTemplateData, type TemplateLineItem, type TemplateFee, type TemplateTotals } from "../services/templates/template-renderer.js";
import { pdfService } from "../services/pdf/pdf-service.js";
import { emailService, type InvoiceEmailData } from "../services/email/email-service.js";
import { invoiceRepository } from "../repositories/invoice.repo.js";
import { customerRepository } from "../repositories/customer.repo.js";
import { businessRepository } from "../repositories/business.repo.js";
import { productRepository } from "../repositories/product.repo.js";
import { generatePublicInvoiceToken } from "../utils/crypto.js";
import { BusinessLogicError } from "../domain/errors.js";
import { logger } from "../utils/logger.js";
import { getClient } from "../db/pool.js";
import { env } from "../config/index.js";

export type RepoInvoice = Awaited<ReturnType<typeof invoiceRepository.findById>>;

export interface CreateInvoiceDraftInput {
  customerId?: string | null;
  currency?: string;
  issueDate?: Date | null;
  dueDate?: Date | null;
  notes?: string | null;
  terms?: string | null;
  templateId?: string | null;
  paymentInstructions?: string | null;
  items?: DraftLineItem[];
  fees?: DraftFee[];
}

export interface DraftLineItem {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: string | number;
  unit?: string;
  unitPrice: string | number;
  discount?: string | number;
  discountType?: "fixed" | "percentage";
  taxRate?: string | number;
  isTaxInclusive?: boolean;
  sortOrder?: number;
}

export interface DraftFee {
  description: string;
  amount: string | number;
  taxRate?: string | number;
  sortOrder?: number;
}

export interface InvoiceSummary {
  invoiceId: string;
  invoice: RepoInvoice;
  items: RepoInvoice["items"];
  fees: RepoInvoice["fees"];
  totals: {
    subtotal: string;
    discountTotal: string;
    taxTotal: string;
    feeTotal: string;
    total: string;
    amountPaid: string;
    amountDue: string;
  };
}

export class InvoiceService {
  private async buildCalculationInput(invoice: RepoInvoice): Promise<InvoiceCalculationInput> {
    const lineItems = await Promise.all(
      invoice.items.map(async (it) => {
        let unitPrice = it.unitPrice;
        let taxRate = it.taxRate;
        let unit = it.unit;
        if (it.productId) {
          try {
            const product = await productRepository.findById(invoice.businessId, it.productId);
            unitPrice = product.defaultUnitPrice;
            taxRate = product.defaultTaxRate;
            unit = product.unit;
          } catch {
            /* product may have been deleted; use stored snapshot values */
          }
        }
        const discount =
          it.discount && !new Decimal(it.discount).isZero()
            ? { type: it.discountType as "fixed" | "percentage", value: it.discount }
            : undefined;
        return {
          description: it.description,
          quantity: it.quantity,
          unit,
          unitPrice,
          discount,
          taxRate,
          isTaxInclusive: it.isTaxInclusive,
        };
      })
    );
    return {
      currency: invoice.currency,
      lineItems,
      fees: invoice.fees.map((f) => ({ description: f.description, amount: f.amount, taxRate: f.taxRate })),
      amountPaid: invoice.amountPaid,
    };
  }

  private async persistCalculationResults(invoiceId: string, invoice: RepoInvoice, res: CalculationResult): Promise<void> {
    for (let i = 0; i < res.lineItems.length; i++) {
      const calc = res.lineItems[i];
      const stored = invoice.items[i];
      if (!stored) continue;
      await invoiceRepository.updateLineItemComputed(invoiceId, stored.id, {
        taxAmount: calc.taxAmount,
        lineSubtotal: calc.lineSubtotal,
        lineTotal: calc.lineTotal,
      });
    }
    await invoiceRepository.updateTotals(invoiceId, {
      subtotal: res.subtotal.toString(),
      discountTotal: res.discountTotal.toString(),
      taxTotal: res.taxTotal.toString(),
      feeTotal: res.feeTotal.toString(),
      total: res.total.toString(),
      amountPaid: res.amountPaid.toString(),
      amountDue: res.amountDue.toString(),
    });
  }

  private summarize(invoice: RepoInvoice, calc: CalculationResult): InvoiceSummary {
    const fmt = (v: Decimal.Value) => new Decimal(v).toFixed(2);
    return {
      invoiceId: invoice.id,
      invoice,
      items: invoice.items,
      fees: invoice.fees,
      totals: {
        subtotal: fmt(calc.subtotal),
        discountTotal: fmt(calc.discountTotal),
        taxTotal: fmt(calc.taxTotal),
        feeTotal: fmt(calc.feeTotal),
        total: fmt(calc.total),
        amountPaid: fmt(calc.amountPaid),
        amountDue: fmt(calc.amountDue),
      },
    };
  }

  async createDraft(input: CreateInvoiceDraftInput, businessId: string, userId?: string): Promise<string> {
    if (input.customerId) {
      await customerRepository.findById(businessId, input.customerId);
    }
    if (input.items?.some((it) => it.productId)) {
      for (const it of input.items.filter((it) => it.productId)) {
        await productRepository.findById(businessId, it.productId!);
      }
    }
    if (input.issueDate && input.dueDate && input.dueDate < input.issueDate) {
      throw new BusinessLogicError("due_date must be on or after issue_date");
    }

    const invoiceId = await invoiceRepository.createDraft(businessId, {
      ...input,
      currency: input.currency ?? "USD",
      createdBy: userId,
    });
    await invoiceRepository.recordEvent(invoiceId, {
      eventType: "created", actorId: userId, actorType: userId ? "user" : "system",
    });
    return invoiceId;
  }

  async getInvoice(businessId: string, id: string): Promise<InvoiceSummary> {
    const invoice = await invoiceRepository.findById(businessId, id);
    const calc = await this.recalculate(invoice);
    return this.summarize(invoice, calc);
  }

  async recalculate(invoice: RepoInvoice): Promise<CalculationResult> {
    const calcInput = await this.buildCalculationInput(invoice);
    return calculationEngine.calculate(calcInput);
  }

  async updateDraft(businessId: string, id: string, input: Partial<CreateInvoiceDraftInput>, userId?: string): Promise<string> {
    const invoice = await invoiceRepository.findById(businessId, id);
    if (invoice.isFinalized) throw new BusinessLogicError("Cannot modify a finalized invoice");
    await invoiceRepository.update(businessId, id, {
      customer_id: input.customerId,
      currency: input.currency,
      issue_date: input.issueDate?.toISOString(),
      due_date: input.dueDate?.toISOString(),
      notes: input.notes,
      terms: input.terms,
      payment_instructions: input.paymentInstructions,
      template_id: input.templateId,
    });
    await invoiceRepository.recordEvent(id, {
      eventType: "updated", actorId: userId, actorType: userId ? "user" : "system",
      metadata: { fields: Object.keys(input) },
    });
    return id;
  }

  async setItems(businessId: string, id: string, items: DraftLineItem[], userId?: string): Promise<void> {
    const invoice = await invoiceRepository.findById(businessId, id);
    if (invoice.isFinalized) throw new BusinessLogicError("Cannot modify a finalized invoice");
    if (items.some((it) => it.productId)) {
      for (const it of items.filter((it) => it.productId)) {
        await productRepository.findById(businessId, it.productId!);
      }
    }
    await invoiceRepository.setItems(businessId, id, items as any);
    await invoiceRepository.recordEvent(id, { eventType: "line_item_updated", actorId: userId });
  }

  async setFees(businessId: string, id: string, fees: DraftFee[], userId?: string): Promise<void> {
    const invoice = await invoiceRepository.findById(businessId, id);
    if (invoice.isFinalized) throw new BusinessLogicError("Cannot modify a finalized invoice");
    await invoiceRepository.setFees(businessId, id, fees as any);
    await invoiceRepository.recordEvent(id, { eventType: "fee_added", actorId: userId });
  }

  async finalize(businessId: string, id: string, userId?: string): Promise<{ invoiceNumber: string }> {
    const invoice = await invoiceRepository.findById(businessId, id);
    if (invoice.isFinalized) {
      return { invoiceNumber: invoice.invoiceNumber ?? "" };
    }
    if (!invoice.customerId) throw new BusinessLogicError("Cannot finalize an invoice without a customer");

    const res = await this.recalculate(invoice);
    if (res.total.isNegative()) throw new BusinessLogicError("Invoice total cannot be negative");

    const { number: generatedNumber } = await invoiceNumberService.generate(businessId);
    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query("SAVEPOINT sp1");
      await invoiceRepository.assignNumber(businessId, id, generatedNumber);
      await this.persistCalculationResults(id, invoice, res);
      const { snapshot, hash } = await snapshotService.build(invoice, businessId);
      await invoiceRepository.createSnapshot(id, snapshot, hash);
      await invoiceRepository.finalize(businessId, id, { finalizedAt: new Date() });
      await client.query("RELEASE SAVEPOINT sp1");
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    await invoiceRepository.recordEvent(id, {
      eventType: "finalized", actorId: userId, actorType: userId ? "user" : "system",
      metadata: { invoiceNumber: invoice.invoiceNumber ?? generatedNumber },
    });
    logger.info(`Invoice ${id} finalized as ${invoice.invoiceNumber ?? generatedNumber}`);
    return { invoiceNumber: invoice.invoiceNumber ?? generatedNumber };
  }

  private toTemplateItems(items: RepoInvoice["items"]): TemplateLineItem[] {
    return items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      discount: it.discount,
      taxRate: it.taxRate,
      taxAmount: it.taxAmount,
      lineSubtotal: it.lineSubtotal,
      lineTotal: it.lineTotal,
      isTaxInclusive: it.isTaxInclusive,
    }));
  }

  private toTemplateFees(fees: RepoInvoice["fees"]): TemplateFee[] {
    return fees.map((f) => ({
      description: f.description,
      amount: f.amount,
      taxRate: f.taxRate,
      taxAmount: f.taxAmount,
    }));
  }

  private toTemplateTotals(invoice: RepoInvoice): TemplateTotals {
    return {
      subtotal: invoice.subtotal,
      discountTotal: invoice.discountTotal,
      taxTotal: invoice.taxTotal,
      feeTotal: invoice.feeTotal,
      total: invoice.total,
      amountPaid: invoice.amountPaid,
      amountDue: invoice.amountDue,
    };
  }

  private buildSnapshotTemplateData(invoice: RepoInvoice, snapshot: Record<string, unknown> | null): InvoiceTemplateData {
    const snap = snapshot ?? {};
    const business = (snap as any).business ?? {};
    const customer = (snap as any).customer ?? null;
    const snapItems: TemplateLineItem[] = (snap as any).items ?? this.toTemplateItems(invoice.items);
    const snapFees: TemplateFee[] = (snap as any).fees ?? this.toTemplateFees(invoice.fees);
    return buildTemplateData(
      {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber ?? null,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        currency: invoice.currency,
        notes: invoice.notes,
        terms: invoice.terms,
        paymentInstructions: invoice.paymentInstructions,
      },
      business,
      customer,
      snapItems,
      snapFees,
      this.toTemplateTotals(invoice),
      { htmlTemplate: (snap as any).htmlTemplate }
    );
  }

  async send(businessId: string, id: string, userId?: string): Promise<void> {
    const invoice = await invoiceRepository.findById(businessId, id);
    if (!invoice.isFinalized) throw new BusinessLogicError("Cannot send an invoice that is not finalized");

    const business = await businessRepository.findById(businessId);
    const customer = invoice.customerId ? await customerRepository.findById(businessId, invoice.customerId) : null;
    const customerEmail = customer?.email ?? null;
    if (!customerEmail) throw new BusinessLogicError("Customer has no email address");

    const token = invoice.publicToken ?? generatePublicInvoiceToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await invoiceRepository.setPublicToken(id, token, expiresAt);

    const snapshot = await invoiceRepository.getSnapshot(id);
    const templateData = this.buildSnapshotTemplateData(invoice, snapshot);
    const html = templateRenderer.render(templateData);
    const pdf = await pdfService.generatePdfFromHtml(html, templateData);

    const idempotencyKey = `send:${id}:${token}`;
    const emailData: InvoiceEmailData = {
      invoiceId: id,
      businessId,
      recipient: { email: customerEmail, name: customer?.name },
      subject: `Invoice ${invoice.invoiceNumber ?? ""} from ${business.name}`,
      htmlBody: html,
      attachments: [{ filename: `Invoice-${invoice.invoiceNumber ?? id}.pdf`, content: pdf }],
      idempotencyKey,
    };

    invoiceStateMachine.transition(invoice.status, "sent");
    await invoiceRepository.setStatus(id, "sent", { sentAt: new Date() });
    await emailService.sendInvoiceEmail(emailData);
    await invoiceRepository.recordEvent(id, { eventType: "sent", actorId: userId });
  }

  async recordView(token: string): Promise<string> {
    const invoice = await invoiceRepository.findByPublicToken(token);
    if (invoice.status === "sent" || invoice.status === "overdue") {
      const target = invoice.status === "sent" ? "viewed" : "overdue";
      if (target !== invoice.status) {
        invoiceStateMachine.transition(invoice.status, target);
        await invoiceRepository.setStatus(invoice.id, target, { viewedAt: target === "viewed" ? new Date() : undefined });
      }
    }
    await invoiceRepository.recordEvent(invoice.id, { eventType: "viewed", actorType: "customer" });
    return invoice.id;
  }

  async recordPayment(
    businessId: string,
    id: string,
    amount: string | number,
    provider = "stub",
    providerPaymentId?: string,
    idempotencyKey?: string
  ): Promise<void> {
    if (new Decimal(amount).isNegative()) throw new BusinessLogicError("Payment amount must be >= 0");
    const invoice = await invoiceRepository.findById(businessId, id);
    const client = await getClient();
    try {
      await client.query("BEGIN");
      if (idempotencyKey) {
        const existing = await client.query(`SELECT id FROM payments WHERE idempotency_key = $1`, [idempotencyKey]);
        if (existing.rows.length) {
          await client.query("ROLLBACK");
          logger.info(`Payment already recorded (idempotent) for invoice ${id}`);
          return;
        }
      }
      await client.query(
        `INSERT INTO payments (id, invoice_id, business_id, provider, provider_payment_id, amount, currency, status, paid_at, idempotency_key, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'succeeded',$8,$9,NOW(),NOW())`,
        [crypto.randomUUID(), id, businessId, provider, providerPaymentId, amount, invoice.currency, new Date().toISOString(), idempotencyKey ?? null]
      );
      await client.query(
        `UPDATE invoices SET amount_paid = amount_paid + $1, amount_due = GREATEST(amount_due - $1, 0), updated_at = NOW() WHERE id = $2`,
        [amount, id]
      );
      const updated = await invoiceRepository.findById(businessId, id);
      const newStatus = invoiceStateMachine.statusAfterPayment(invoice.status, new Decimal(updated.amountDue).toNumber(), new Decimal(updated.amountPaid).toNumber());
      if (newStatus !== invoice.status) invoiceStateMachine.transition(invoice.status, newStatus);
      await invoiceRepository.setStatus(id, newStatus, { paidAt: newStatus === "paid" ? new Date() : undefined });
      await invoiceRepository.recordEvent(id, {
        eventType: newStatus === "paid" ? "paid" : "partially_paid",
        actorType: "payment",
        metadata: { amount, provider, newStatus },
      });
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async cancel(businessId: string, id: string, userId?: string, reason?: string): Promise<void> {
    const invoice = await invoiceRepository.findById(businessId, id);
    if (!invoiceStateMachine.isCancellable(invoice.status)) {
      throw new BusinessLogicError(`Invoice cannot be cancelled from status ${invoice.status}`);
    }
    invoiceStateMachine.transition(invoice.status, "cancelled");
    await invoiceRepository.setStatus(id, "cancelled", { cancelledAt: new Date() });
    await invoiceRepository.update(businessId, id, { cancelled_reason: reason });
    await invoiceRepository.recordEvent(id, { eventType: "cancelled", actorId: userId, metadata: { reason } });
  }

  async void(businessId: string, id: string, userId?: string, reason?: string): Promise<void> {
    const invoice = await invoiceRepository.findById(businessId, id);
    if (!invoiceStateMachine.isVoidable(invoice.status)) {
      throw new BusinessLogicError(`Invoice cannot be voided from status ${invoice.status}`);
    }
    invoiceStateMachine.transition(invoice.status, "void");
    await invoiceRepository.setStatus(id, "void", { cancelledAt: new Date() });
    await invoiceRepository.update(businessId, id, { cancelled_reason: reason });
    await invoiceRepository.recordEvent(id, { eventType: "voided", actorId: userId, metadata: { reason } });
  }

  async getPublicInvoice(token: string): Promise<{ invoice: RepoInvoice; html: string; pdfUrl: string }> {
    const invoice = await invoiceRepository.findByPublicToken(token);
    const snapshot = await invoiceRepository.getSnapshot(invoice.id);
    const templateData = this.buildSnapshotTemplateData(invoice, snapshot);
    const html = templateRenderer.render(templateData);
    return {
      invoice,
      html,
      pdfUrl: `${env.APP_PUBLIC_BASE_URL}/api/public/invoices/${token}/pdf`,
    };
  }

  async generatePdf(businessId: string, id: string): Promise<Buffer> {
    const invoice = await invoiceRepository.findById(businessId, id);
    const snapshot = await invoiceRepository.getSnapshot(invoice.id);
    const templateData = this.buildSnapshotTemplateData(invoice, snapshot);
    const html = templateRenderer.render(templateData);
    return pdfService.generatePdfFromHtml(html, templateData);
  }
}

export const invoiceService = new InvoiceService();

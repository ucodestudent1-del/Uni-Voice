import { Decimal } from "decimal.js";
import { calculationEngine } from "../domain/calculation.js";
import type { InvoiceCalculationInput, CalculationResult } from "../domain/calculation.js";
import { invoiceStateMachine } from "../services/state-machine/invoice-state-machine.js";
import { invoiceNumberService } from "../services/numbering/service.js";
import { snapshotService } from "../services/snapshot/snapshot-service.js";
import { templateRenderer, buildTemplateData, type InvoiceTemplateData, type TemplateLineItem, type TemplateFee, type TemplateTotals } from "../services/templates/template-renderer.js";
import { renderDefaultTerms } from "../services/terms.js";
import { pdfService } from "../services/pdf/pdf-service.js";
import { emailService, type InvoiceEmailData } from "../services/email/email-service.js";
import { invoiceRepository } from "../repositories/invoice.repo.js";
import { customerRepository } from "../repositories/customer.repo.js";
import { businessRepository } from "../repositories/business.repo.js";
import { productServiceRepository } from "../repositories/product-service.repo.js";
import { projectRepository } from "../repositories/project.repo.js";
import { generatePublicInvoiceToken } from "../utils/crypto.js";
import { BusinessLogicError, NotFoundError } from "../domain/errors.js";
import { invoiceValidationService } from "../services/validation/invoice-validation.js";
import { logger } from "../utils/logger.js";
import { getClient, query } from "../db/pool.js";
import { env } from "../config/index.js";
import { invalidateReportsCache } from "./reports-cache.js";

export type RepoInvoice = Awaited<ReturnType<typeof invoiceRepository.findById>>;

export interface CreateInvoiceDraftInput {
  customerId?: string | null;
  projectId?: string | null;
  currency?: string;
  issueDate?: Date | null;
  dueDate?: Date | null;
  notes?: string | null;
  terms?: string | null;
  templateId?: string | null;
  paymentInstructions?: string | null;
  depositAmount?: string | number;
  depositType?: "none" | "fixed" | "percentage";
  depositDueDate?: Date | string | null;
  depositPaymentPurpose?: string | null;
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
  catalogName?: string | null;
  catalogSku?: string | null;
  catalogTaxCategory?: string | null;
  catalogUnitPrice?: string | null;
  catalogTaxRate?: string | null;
}

export interface DraftFee {
  description: string;
  amount: string | number;
  taxRate?: string | number;
  sortOrder?: number;
}

export interface ReminderSendOptions {
  idempotencyKey?: string;
  ruleId?: string | null;
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
  private buildCalculationInput(invoice: RepoInvoice): InvoiceCalculationInput {
    const lineItems = invoice.items.map((it) => {
      const discount =
        it.discount && !new Decimal(it.discount).isZero()
          ? { type: it.discountType as "fixed" | "percentage", value: it.discount }
          : undefined;
      return {
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unitPrice: it.unitPrice,
        discount,
        taxRate: it.taxRate,
        isTaxInclusive: it.isTaxInclusive,
      };
    });
    return {
      currency: invoice.currency,
      lineItems,
      fees: invoice.fees.map((f) => ({ description: f.description, amount: f.amount, taxRate: f.taxRate })),
      amountPaid: invoice.amountPaid,
    };
  }

  private async persistCalculationResults(invoiceId: string, invoice: RepoInvoice, res: CalculationResult, client?: any): Promise<void> {
    for (let i = 0; i < res.lineItems.length; i++) {
      const calc = res.lineItems[i];
      const stored = invoice.items[i];
      if (!stored) continue;
      await invoiceRepository.updateLineItemComputed(invoiceId, stored.id, {
        taxAmount: calc.taxAmount.toString(),
        lineSubtotal: calc.lineSubtotal.toString(),
        lineTotal: calc.lineTotal.toString(),
      }, client);
    }
    await invoiceRepository.updateTotals(invoiceId, {
      subtotal: res.subtotal.toString(),
      discountTotal: res.discountTotal.toString(),
      taxTotal: res.taxTotal.toString(),
      feeTotal: res.feeTotal.toString(),
      total: res.total.toString(),
      amountPaid: res.amountPaid.toString(),
      amountDue: res.amountDue.toString(),
    }, client);
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
    const items = input.items ?? undefined;
    const itemsWithSnapshot = await this.applyProductSnapshots(businessId, items);
    if (input.issueDate && input.dueDate && input.dueDate < input.issueDate) {
      throw new BusinessLogicError("due_date must be on or after issue_date");
    }

    const defaults = await this.resolveDefaultTerms(businessId);
    const resolvedTerms = input.terms ?? defaults.terms;
    const resolvedNotes = input.notes ?? defaults.notes;

    const invoiceId = await invoiceRepository.createDraft(businessId, {
      ...input,
      terms: resolvedTerms,
      notes: resolvedNotes,
      items: itemsWithSnapshot,
      currency: input.currency ?? "USD",
      createdBy: userId,
    });
    await invoiceRepository.recordEvent(invoiceId, {
      eventType: "created", actorId: userId, actorType: userId ? "user" : "system",
    });
    return invoiceId;
  }

  private async resolveDefaultTerms(businessId: string): Promise<{ terms: string; notes: string | null }> {
    const bizSettings = await businessRepository.getDefaultTerms(businessId);
    const defaultTerms = renderDefaultTerms().plainText;
    return {
      terms: bizSettings.defaultTerms && bizSettings.defaultTerms.trim() ? bizSettings.defaultTerms : defaultTerms,
      notes: bizSettings.defaultNotes ?? null,
    };
  }

  private async applyProductSnapshots(businessId: string, items: DraftLineItem[] | undefined): Promise<DraftLineItem[] | undefined> {
    if (!items) return undefined;
    return Promise.all(
      items.map(async (it) => {
        if (!it.productId) return it;
        const snapshot = await this.snapshotProduct(businessId, it.productId);
        return { ...it, ...snapshot };
      })
    );
  }

  private async snapshotProduct(businessId: string, productId: string): Promise<Partial<DraftLineItem>> {
    const product = await productServiceRepository.findById(businessId, productId);
    return {
      catalogName: product.name,
      catalogSku: product.sku,
      catalogTaxCategory: product.taxCategory,
      catalogUnitPrice: product.unitPrice,
      catalogTaxRate: product.defaultTaxRate,
    };
  }

  async getInvoice(businessId: string, id: string): Promise<InvoiceSummary> {
    const invoice = await invoiceRepository.findById(businessId, id);
    if (invoice.isFinalized) {
      return {
        invoiceId: invoice.id,
        invoice,
        items: invoice.items,
        fees: invoice.fees,
        totals: {
          subtotal: String(invoice.subtotal ?? 0),
          discountTotal: String(invoice.discountTotal ?? 0),
          taxTotal: String(invoice.taxTotal ?? 0),
          feeTotal: String(invoice.feeTotal ?? 0),
          total: String(invoice.total ?? 0),
          amountPaid: String(invoice.amountPaid ?? 0),
          amountDue: String(invoice.amountDue ?? 0),
        },
      };
    }
    const calc = await this.recalculate(invoice);
    return this.summarize(invoice, calc);
  }

  async recalculate(invoice: RepoInvoice): Promise<CalculationResult> {
    const calcInput = this.buildCalculationInput(invoice);
    return calculationEngine.calculate(calcInput);
  }

  async updateDraft(businessId: string, id: string, input: Partial<CreateInvoiceDraftInput>, userId?: string): Promise<string> {
    const invoice = await invoiceRepository.findById(businessId, id);
    if (invoice.isFinalized) throw new BusinessLogicError("Cannot modify a finalized invoice");
    await invoiceRepository.update(businessId, id, {
      customer_id: input.customerId,
      currency: input.currency,
      issue_date:
        input.issueDate instanceof Date
          ? input.issueDate.toISOString()
          : input.issueDate ?? null,
      due_date:
        input.dueDate instanceof Date
          ? input.dueDate.toISOString()
          : input.dueDate ?? null,
      notes: input.notes,
      terms: input.terms,
      payment_instructions: input.paymentInstructions,
      template_id: input.templateId,
      deposit_amount: input.depositAmount,
      deposit_type: input.depositType,
      deposit_due_date: input.depositDueDate instanceof Date ? input.depositDueDate.toISOString() : input.depositDueDate,
      deposit_payment_purpose: input.depositPaymentPurpose,
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
    const itemsWithSnapshot = await this.applyProductSnapshots(businessId, items);
    await invoiceRepository.setItems(businessId, id, itemsWithSnapshot as any);
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

    const validationResult = invoiceValidationService.validate(invoice);
    if (!validationResult.valid) {
      throw new BusinessLogicError(
        "Invoice failed validation and cannot be finalized",
        "VALIDATION_FAILED",
        { issues: validationResult.issues }
      );
    }

    const { number: generatedNumber } = await invoiceNumberService.generate(businessId);
    const client = await getClient();
    try {
      await client.query("BEGIN");
      await client.query("SAVEPOINT sp1");
      await invoiceRepository.assignNumber(businessId, id, generatedNumber, client);
      await this.persistCalculationResults(id, invoice, res, client);
      const { snapshot, hash } = await snapshotService.build(invoice, businessId);
      await invoiceRepository.createSnapshot(id, snapshot, hash, { client });
      await invoiceRepository.finalize(businessId, id, { finalizedAt: new Date() }, client);
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
    if (invoice.projectId) {
      await projectRepository.recordInvoiceCreated(invoice.projectId, invoice.total);
    }
    logger.info(`Invoice ${id} finalized as ${invoice.invoiceNumber ?? generatedNumber}`);
    invalidateReportsCache(businessId);
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
      catalogName: it.catalogName,
      catalogSku: it.catalogSku,
      catalogTaxCategory: it.catalogTaxCategory,
      catalogUnitPrice: it.catalogUnitPrice,
      catalogTaxRate: it.catalogTaxRate,
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
    const invoice = await invoiceRepository.findByPublicToken(undefined, token);
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
      const updateRes = await client.query(
        `UPDATE invoices SET amount_paid = amount_paid + $1, amount_due = GREATEST(amount_due - $1, 0), updated_at = NOW()
         WHERE id = $2 AND business_id = $3 RETURNING amount_due, amount_paid`,
        [amount, id, businessId]
      );
      if (!updateRes.rows.length) throw new NotFoundError(`Invoice ${id} not found`);
      const updatedRow = updateRes.rows[0];
      const newStatus = invoiceStateMachine.statusAfterPayment(invoice.status, updatedRow.amount_due, updatedRow.amount_paid);
      if (newStatus !== invoice.status) invoiceStateMachine.transition(invoice.status, newStatus);
      await invoiceRepository.setStatus(id, newStatus, { paidAt: newStatus === "paid" ? new Date() : undefined }, client);
      await invoiceRepository.recordEvent(id, {
        eventType: newStatus === "paid" ? "paid" : "partially_paid",
        actorType: "payment",
        metadata: { amount, provider, newStatus },
      }, client);
      if (invoice.projectId) {
        await projectRepository.recordPayment(invoice.projectId, new Decimal(amount));
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    invalidateReportsCache(businessId);
  }

  async recordProviderPayment(
    businessId: string,
    invoiceId: string,
    amount: string | number,
    currency: string,
    provider = "stripe",
    providerPaymentId?: string,
    idempotencyKey?: string
  ): Promise<{ paymentId: string; status: string }> {
    if (new Decimal(amount).isNegative()) throw new BusinessLogicError("Payment amount must be >= 0");
    const invoice = await invoiceRepository.findById(businessId, invoiceId);
    const client = await getClient();
    try {
      await client.query("BEGIN");
      if (idempotencyKey) {
        const existing = await client.query(`SELECT id, status FROM payments WHERE idempotency_key = $1`, [idempotencyKey]);
        if (existing.rows.length) {
          await client.query("ROLLBACK");
          logger.info(`Provider payment already recorded (idempotent) for invoice ${invoiceId}, payment ${existing.rows[0].id}`);
          return { paymentId: existing.rows[0].id, status: existing.rows[0].status };
        }
      }
      const paymentId = crypto.randomUUID();
      await client.query(
        `INSERT INTO payments (id, invoice_id, business_id, provider, provider_payment_id, amount, currency, status, paid_at, idempotency_key, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'succeeded',NOW(),$8,NOW(),NOW())`,
        [paymentId, invoiceId, businessId, provider, providerPaymentId, amount, currency, idempotencyKey ?? null]
      );
      const updateRes = await client.query(
        `UPDATE invoices SET amount_paid = amount_paid + $1, amount_due = GREATEST(amount_due - $1, 0), updated_at = NOW()
         WHERE id = $2 AND business_id = $3 RETURNING amount_due, amount_paid`,
        [amount, invoiceId, businessId]
      );
      if (!updateRes.rows.length) throw new NotFoundError(`Invoice ${invoiceId} not found`);
      const updatedRow = updateRes.rows[0];
      const newStatus = invoiceStateMachine.statusAfterPayment(invoice.status, updatedRow.amount_due, updatedRow.amount_paid);
      if (newStatus !== invoice.status) invoiceStateMachine.transition(invoice.status, newStatus);
      await invoiceRepository.setStatus(invoiceId, newStatus, { paidAt: newStatus === "paid" ? new Date() : undefined }, client);
      await invoiceRepository.recordEvent(invoiceId, {
        eventType: newStatus === "paid" ? "paid" : "partially_paid",
        actorType: "payment",
        metadata: { amount, provider, providerPaymentId, newStatus },
      }, client);
      if (invoice.projectId) {
        await projectRepository.recordPayment(invoice.projectId, new Decimal(amount));
      }
      await client.query("COMMIT");
      invalidateReportsCache(businessId);
      logger.info(`Provider payment recorded: invoice ${invoiceId} payment ${paymentId} amount ${amount} ${currency}`);
      return { paymentId, status: "succeeded" };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async refundPayment(
    businessId: string,
    invoiceId: string,
    paymentId: string,
    amount: string | number,
    currency: string,
    provider = "stripe",
    providerRefundId?: string,
    idempotencyKey?: string
  ): Promise<{ status: string }> {
    const invoice = await invoiceRepository.findById(businessId, invoiceId);
    const client = await getClient();
    try {
      await client.query("BEGIN");
      if (idempotencyKey) {
        const existingRefund = await client.query(
          `SELECT id FROM payment_events WHERE idempotency_key = $1`,
          [idempotencyKey]
        );
        if (existingRefund.rows.length) {
          await client.query("ROLLBACK");
          logger.info(`Refund already processed (idempotent) for payment ${paymentId}`);
          return { status: "already_processed" };
        }
      }

      const payRes = await client.query(
        `SELECT id, amount, status, idempotency_key FROM payments WHERE id = $1 AND invoice_id = $2 AND business_id = $3`,
        [paymentId, invoiceId, businessId]
      );
      if (!payRes.rows.length) throw new NotFoundError(`Payment ${paymentId} not found`);
      const payment = payRes.rows[0];
      const paymentAmount = new Decimal(payment.amount);
      const refundAmount = new Decimal(amount);

      if (refundAmount.gt(paymentAmount)) {
        throw new BusinessLogicError("Refund amount cannot exceed payment amount");
      }

      const newPaymentStatus = refundAmount.eq(paymentAmount) ? "refunded" : "partially_refunded";
      await client.query(
        `UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2`,
        [newPaymentStatus, paymentId]
      );

      await client.query(
        `INSERT INTO payment_events (payment_id, event_type, status, amount, metadata, created_at)
         VALUES ($1, 'payment_refunded', $2, $3, $4, NOW())`,
        [paymentId, newPaymentStatus, amount, JSON.stringify({ provider, providerRefundId, idempotencyKey })]
      );

      const newAmountDue = new Decimal(invoice.amountDue).plus(refundAmount);
      await client.query(
        `UPDATE invoices SET amount_due = amount_due + $1, updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [amount, invoiceId, businessId]
      );

      const newInvoiceStatus = invoiceStateMachine.statusAfterPayment(
        invoice.status,
        newAmountDue.toFixed(6),
        String(invoice.amountPaid)
      );
      if (newInvoiceStatus !== invoice.status) {
        invoiceStateMachine.transition(invoice.status, newInvoiceStatus);
      }
      await invoiceRepository.setStatus(invoiceId, newInvoiceStatus, {}, client);
      await invoiceRepository.recordEvent(invoiceId, {
        eventType: "payment_refunded",
        actorType: "payment",
        metadata: { amount: refundAmount.toString(), provider, providerRefundId, newPaymentStatus },
      }, client);

      await client.query("COMMIT");
      invalidateReportsCache(businessId);
      logger.info(`Refund processed: payment ${paymentId} invoice ${invoiceId} amount ${amount} ${currency}`);
      return { status: newPaymentStatus };
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
    invalidateReportsCache(businessId);
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
    invalidateReportsCache(businessId);
  }

  async sendReminder(businessId: string, id: string, userId?: string): Promise<{ sent: boolean }> {
    const invoice = await invoiceRepository.findById(businessId, id);
    if (!invoice.isFinalized) throw new BusinessLogicError("Cannot send a reminder for a draft invoice");
    if (invoice.status === "paid" || invoice.status === "cancelled" || invoice.status === "void") {
      throw new BusinessLogicError(`Cannot send a reminder for an invoice in status ${invoice.status}`);
    }

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

    const reminderCount = await invoiceRepository.getReminderCount(id);
    const idempotencyKey = `reminder:${id}:${reminderCount + 1}`;

    const subject = `Reminder: Invoice ${invoice.invoiceNumber ?? ""} — ${business.name}`;
    const emailData: InvoiceEmailData = {
      invoiceId: id,
      businessId,
      recipient: { email: customerEmail, name: customer?.name },
      subject,
      htmlBody: html,
      attachments: [{ filename: `Invoice-${invoice.invoiceNumber ?? id}.pdf`, content: pdf }],
      idempotencyKey,
    };

    await emailService.sendInvoiceEmail(emailData);
    await invoiceRepository.recordReminder(id, businessId, null, null, customerEmail, subject, reminderCount + 1);
    await invoiceRepository.recordEvent(id, { eventType: "reminder_sent", actorId: userId, metadata: { reminderCount: reminderCount + 1 } });

    return { sent: true };
  }

  async recordPublicPayment(token: string, amount: string | number, provider = "stub", idempotencyKey?: string): Promise<void> {
    const invoice = await invoiceRepository.findByPublicToken(undefined, token);
    const safeAmount = new Decimal(amount);
    if (safeAmount.isNegative()) throw new BusinessLogicError("Payment amount must be >= 0");
    if (safeAmount.isZero()) throw new BusinessLogicError("Payment amount must be greater than 0");

    const remainingDue = new Decimal(invoice.amountDue ?? invoice.total ?? 0);
    if (safeAmount.gt(remainingDue)) throw new BusinessLogicError("Payment amount exceeds outstanding balance");

    await this.recordPayment(invoice.businessId, invoice.id, amount, provider, undefined, idempotencyKey);
  }

  async processOverdueInvoices(now: Date = new Date()): Promise<number> {
    const candidates = await invoiceRepository.findOverdueCandidates(now);
    let count = 0;
    for (const row of candidates) {
      await invoiceRepository.markOverdue(row.id, now);
      count++;
    }
    if (count > 0) {
      logger.info(`Marked ${count} invoices as overdue`);
    }
    return count;
  }

  async processAutomatedReminders(now: Date = new Date()): Promise<number> {
    const businessIds = await businessRepository.listReminderEnabledBusinesses();
    let totalSent = 0;

    for (const businessId of businessIds) {
      try {
        const sent = await this.processRemindersForBusiness(businessId, now);
        totalSent += sent;
      } catch (err) {
        logger.error({ err, businessId }, "Failed to process reminders for business");
      }
    }

    if (totalSent > 0) {
      logger.info(`Sent ${totalSent} automated reminders across ${businessIds.length} businesses`);
    }
    return totalSent;
  }

  private async processRemindersForBusiness(businessId: string, now: Date): Promise<number> {
    const rules = await invoiceRepository.getReminderRules(businessId);
    if (rules.length === 0) return 0;

    const invoices = await invoiceRepository.findInvoicesNeedingReminders(businessId, now);
    if (invoices.length === 0) return 0;

    const business = await businessRepository.findById(businessId);
    let sentCount = 0;

    for (const invoice of invoices) {
      if (!invoice.customerEmail) continue;

      for (const rule of rules) {
        const shouldSend = this.evaluateReminderRule(invoice, rule, now);
        if (!shouldSend) continue;

        const existingCount = await invoiceRepository.getReminderSendCount(invoice.id, rule.id);
        if (existingCount >= rule.maxSendCount) continue;

        try {
          await this.sendAutomatedReminder(businessId, business, invoice, rule, existingCount + 1);
          sentCount++;
        } catch (err) {
          logger.error({ err, invoiceId: invoice.id, ruleId: rule.id }, "Failed to send automated reminder");
        }
      }
    }

    return sentCount;
  }

  private evaluateReminderRule(invoice: {
    dueDate: Date | null;
    issueDate: Date | null;
    status: string;
    customerId: string | null;
  }, rule: {
    triggerType: 'before_due' | 'after_due' | 'manual';
    offsetDays: number;
    minStatus: string;
  }, now: Date): boolean {
    if (rule.triggerType === 'manual') return false;

    const invoiceStatusIndex = STATUS_ORDER.indexOf(invoice.status);
    const minStatusIndex = STATUS_ORDER.indexOf(rule.minStatus);
    if (invoiceStatusIndex === -1 || minStatusIndex === -1 || invoiceStatusIndex < minStatusIndex) {
      return false;
    }

    if (!invoice.dueDate) return false;

    const dueDate = new Date(invoice.dueDate);
    const targetDate = new Date(dueDate);
    if (rule.triggerType === 'before_due') {
      targetDate.setDate(dueDate.getDate() - rule.offsetDays);
    } else if (rule.triggerType === 'after_due') {
      targetDate.setDate(dueDate.getDate() + rule.offsetDays);
    }

    const startOfTargetDay = new Date(targetDate);
    startOfTargetDay.setHours(0, 0, 0, 0);
    const endOfTargetDay = new Date(targetDate);
    endOfTargetDay.setHours(23, 59, 59, 999);
    const startOfNow = new Date(now);
    startOfNow.setHours(0, 0, 0, 0);

    return startOfNow >= startOfTargetDay && startOfNow <= endOfTargetDay;
  }

private async sendAutomatedReminder(
    businessId: string,
    business: { name: string; email?: string | null },
    invoice: {
      id: string;
      invoiceNumber: string | null;
      amountDue: string;
      dueDate: Date | null;
      customerEmail: string | null;
      customerName: string | null;
      customerId: string | null;
    },
    rule: {
      id: string;
      subjectTemplate: string;
      messageTemplate: string;
    },
    sendCount: number
  ): Promise<void> {
    const customer = await customerRepository.findById(businessId, invoice.customerId!);
    const customerEmail = customer?.email ?? invoice.customerEmail;
    if (!customerEmail) return;

    const token = await this.ensurePublicToken(businessId, invoice.id);
    const snapshot = await invoiceRepository.getSnapshot(invoice.id);
    const invoiceData = await invoiceRepository.findById(businessId, invoice.id);
    const templateData = this.buildSnapshotTemplateData(invoiceData, snapshot);
    const html = templateRenderer.render(templateData);
    const pdf = await pdfService.generatePdfFromHtml(html, templateData);

    const subject = rule.subjectTemplate
      .replace('{{invoice_number}}', invoice.invoiceNumber ?? '')
      .replace('{{amount_due}}', invoice.amountDue)
      .replace('{{due_date}}', invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : '')
      .replace('{{business_name}}', business.name);

    const messageBody = rule.messageTemplate
      .replace('{{invoice_number}}', invoice.invoiceNumber ?? '')
      .replace('{{amount_due}}', invoice.amountDue)
      .replace('{{due_date}}', invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : '')
      .replace('{{business_name}}', business.name);

    const fullHtml = `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
        <div style="background: #f8fafc; padding: 24px; border-radius: 8px; margin-bottom: 16px;">
          <h2 style="margin: 0 0 16px; color: #1e293b;">${subject}</h2>
          <div style="white-space: pre-wrap; color: #334155;">${messageBody}</div>
        </div>
        <div style="text-align: center;">
          <a href="${env.APP_PUBLIC_BASE_URL}/invoice/${token}"
             style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            View Invoice
          </a>
        </div>
        <p style="margin-top: 24px; font-size: 12px; color: #94a3b8; text-align: center;">
          This is an automated reminder. If you have already paid, please disregard.
        </p>
      </div>
    `;

    const idempotencyKey = `auto-reminder:${invoice.id}:${rule.id}:${sendCount}`;
    const emailData: InvoiceEmailData = {
      invoiceId: invoice.id,
      businessId,
      recipient: { email: customerEmail, name: customer?.name ?? invoice.customerName ?? undefined },
      subject,
      htmlBody: fullHtml,
      attachments: [{ filename: `Invoice-${invoice.invoiceNumber ?? invoice.id}.pdf`, content: pdf }],
      idempotencyKey,
    };

    await emailService.sendInvoiceEmail(emailData);
    await invoiceRepository.recordReminder(invoice.id, businessId, rule.id, null, customerEmail, subject, sendCount, idempotencyKey);
    await invoiceRepository.recordEvent(invoice.id, {
      eventType: "reminder_sent", actorType: "system", metadata: { ruleId: rule.id, sendCount, automated: true },
    });
  }

private async ensurePublicToken(businessId: string, invoiceId: string): Promise<string> {
    const invoice = await invoiceRepository.findById(businessId, invoiceId);
    if (invoice.publicToken && invoice.publicTokenExpiresAt && invoice.publicTokenExpiresAt > new Date()) {
      return invoice.publicToken;
    }
    const { generatePublicInvoiceToken } = await import("../utils/crypto.js");
    const token = generatePublicInvoiceToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await invoiceRepository.setPublicToken(invoiceId, token, expiresAt);
    return token;
  }

  async createPaymentIntent(businessId: string, id: string): Promise<{ clientSecret: string | null; provider: string }> {
    const invoice = await invoiceRepository.findById(businessId, id);
    if (!invoice.isFinalized) throw new BusinessLogicError("Cannot create payment intent for a draft invoice");

    const amountDue = new Decimal(invoice.amountDue);
    if (amountDue.lte(0)) throw new BusinessLogicError("Invoice is already fully paid");

    const settings = await businessRepository.getSettings(businessId);
    const provider = settings.paymentProvider ?? env.PAYMENT_PROVIDER;

    if (provider === "stripe" && env.STRIPE_SECRET_KEY) {
      const stripe = await this.getStripe();
      const intent = await stripe.paymentIntents.create({
        amount: Number(amountDue.mul(100).toFixed(0)),
        currency: invoice.currency.toLowerCase(),
        metadata: { invoiceId: id, businessId },
      });
      await query(
        `INSERT INTO payment_intents (invoice_id, business_id, provider, provider_intent_id, amount, currency, status, client_secret)
         VALUES ($1,$2,'stripe',$3,$4,$5,'pending',$6)`,
        [id, businessId, intent.id, Number(amountDue), invoice.currency, intent.client_secret]
      );
      return { clientSecret: intent.client_secret, provider: "stripe" };
    }

    await query(
      `INSERT INTO payment_intents (invoice_id, business_id, provider, provider_intent_id, amount, currency, status)
       VALUES ($1,$2,'stub',null,$3,$4,'pending')`,
      [id, businessId, Number(amountDue), invoice.currency]
    );
    return { clientSecret: null, provider };
  }

  private stripeClient: any = null;

  private async getStripe(): Promise<any> {
    if (!this.stripeClient) {
      const { default: Stripe } = await import("stripe");
      this.stripeClient = new Stripe(env.STRIPE_SECRET_KEY!);
    }
    return this.stripeClient;
  }

  async getDashboardData(businessId: string): Promise<{
    summary: { totalOutstanding: string; totalOverdue: string; totalPaidThisMonth: string; totalRevenue: string; draftCount: number; overdueCount: number; sentCount: number; paidCount: number; totalInvoices: number };
    recentlyPaid: any[];
    requiringAttention: any[];
    upcoming: any[];
    moneyIn: { total: string; count: number; currency: string };
  }> {
    const [summary, recentlyPaidRows, requiringAttentionRows] = await Promise.all([
      invoiceRepository.getDashboardSummary(businessId),
      invoiceRepository.findRecentlyPaid(businessId, 10),
      invoiceRepository.findRequiringAttention(businessId, new Date(), 10),
    ]);

    const now = new Date();

    const recentlyPaid = recentlyPaidRows.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoice_number,
      customerName: i.customer_name,
      total: i.total,
      amountPaid: i.amount_paid,
      currency: i.currency,
      paidAt: i.paid_at,
      status: i.status,
    }));

    const requiringAttention = requiringAttentionRows.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoice_number,
      customerName: i.customer_name,
      total: i.total,
      amountDue: i.amount_due,
      dueDate: i.due_date,
      currency: i.currency,
      status: i.status,
    }));

    // Cash-flow: invoices due within the next 7 days (open + outstanding).
    const upcoming = (await invoiceRepository.findUpcomingInvoices(businessId, 7)).map((i) => ({
      id: i.id,
      invoiceNumber: i.invoice_number,
      customerName: i.customer_name,
      amountDue: i.amount_due,
      total: i.total,
      dueDate: i.due_date,
      currency: i.currency,
      status: i.status,
    }));

    // Cash-flow: money collected in the last 7 days.
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const moneyInTotal = await invoiceRepository.sumPaidSince(businessId, weekAgo);
    const paidInLastWeek = recentlyPaid.filter((i) => {
      const paidAt = i.paidAt ? new Date(i.paidAt) : new Date(0);
      return paidAt >= weekAgo && new Decimal(i.amountPaid || 0).gt(0);
    });

    // Get business default currency
    const business = await businessRepository.findById(businessId);
    const businessCurrency = business.defaultCurrency || "USD";

    return {
      summary: {
        totalOutstanding: new Decimal(summary.totalOutstanding).toFixed(2),
        totalOverdue: new Decimal(summary.totalOverdue).toFixed(2),
        totalPaidThisMonth: new Decimal(summary.totalPaidThisMonth).toFixed(2),
        totalRevenue: new Decimal(summary.totalRevenue).toFixed(2),
        draftCount: summary.draftCount,
        overdueCount: summary.overdueCount,
        sentCount: summary.sentCount,
        paidCount: summary.paidCount,
        totalInvoices: summary.totalInvoices,
      },
      recentlyPaid: recentlyPaid,
      requiringAttention,
      upcoming,
      moneyIn: {
        total: moneyInTotal,
        count: paidInLastWeek.length,
        currency: businessCurrency,
      },
    };
  }

  async getPublicInvoice(token: string): Promise<{ invoice: RepoInvoice; html: string; pdfUrl: string }> {
    const invoice = await invoiceRepository.findByPublicToken(undefined, token);
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

const STATUS_ORDER: readonly string[] = ['draft', 'sent', 'viewed', 'partially_paid', 'overdue', 'paid', 'cancelled', 'void'];

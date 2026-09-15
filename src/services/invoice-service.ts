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
import { productServiceRepository } from "../repositories/product-service.repo.js";
import { generatePublicInvoiceToken } from "../utils/crypto.js";
import { BusinessLogicError } from "../domain/errors.js";
import { invoiceValidationService } from "../services/validation/invoice-validation.js";
import { logger } from "../utils/logger.js";
import { getClient, query } from "../db/pool.js";
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
    const items = input.items ?? undefined;
    const itemsWithSnapshot = await this.applyProductSnapshots(businessId, items);
    if (input.issueDate && input.dueDate && input.dueDate < input.issueDate) {
      throw new BusinessLogicError("due_date must be on or after issue_date");
    }

    const invoiceId = await invoiceRepository.createDraft(businessId, {
      ...input,
      items: itemsWithSnapshot,
      currency: input.currency ?? "USD",
      createdBy: userId,
    });
    await invoiceRepository.recordEvent(invoiceId, {
      eventType: "created", actorId: userId, actorType: userId ? "user" : "system",
    });
    return invoiceId;
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
  }> {
    const invoices = await invoiceRepository.findForDashboard(businessId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const summary = invoices.reduce(
      (acc, inv) => {
        const amountDue = new Decimal(inv.amount_due || 0);
        const amountPaid = new Decimal(inv.amount_paid || 0);
        const total = new Decimal(inv.total || 0);
        acc.totalRevenue = acc.totalRevenue.plus(total);
        acc.totalInvoices += 1;

        if (amountDue.gt(0) && !["draft", "cancelled", "void"].includes(inv.status)) {
          acc.totalOutstanding = acc.totalOutstanding.plus(amountDue);
          if (inv.status === "overdue" || (inv.due_date && new Date(inv.due_date) < now && amountDue.gt(0))) {
            acc.totalOverdue = acc.totalOverdue.plus(amountDue);
            acc.overdueCount += 1;
          }
        }
        if (amountPaid.gt(0) && (inv.paid_at ? new Date(inv.paid_at) >= monthStart : false)) {
          acc.totalPaidThisMonth = acc.totalPaidThisMonth.plus(amountPaid);
        }
        if (inv.status === "draft") acc.draftCount += 1;
        if (inv.status === "sent") acc.sentCount += 1;
        if (inv.status === "paid") {
          acc.paidCount += 1;
        }
        return acc;
      },
      {
        totalOutstanding: new Decimal(0),
        totalOverdue: new Decimal(0),
        totalPaidThisMonth: new Decimal(0),
        totalRevenue: new Decimal(0),
        draftCount: 0,
        overdueCount: 0,
        sentCount: 0,
        paidCount: 0,
        totalInvoices: 0,
      }
    );

    const recentlyPaid = invoices
      .filter((i) => i.status === "paid" || i.status === "partially_paid")
      .sort((a, b) => (new Date(b.paid_at || b.updated_at).getTime() - new Date(a.paid_at || a.updated_at).getTime()))
      .slice(0, 10)
      .map((i) => ({
        id: i.id,
        invoiceNumber: i.invoice_number,
        customerName: i.customer_name,
        total: i.total,
        amountPaid: i.amount_paid,
        currency: i.currency,
        paidAt: i.paid_at,
        status: i.status,
      }));

    const requiringAttention = invoices
      .filter((i) => {
        if (i.amount_due && new Decimal(i.amount_due).gt(0)) {
          if (i.due_date && new Date(i.due_date) < now && !["draft", "cancelled", "void", "paid"].includes(i.status)) return true;
        }
        if (i.status === "draft") return true;
        if (i.status === "sent" || i.status === "viewed") return true;
        return false;
      })
      .sort((a, b) => (new Date(a.due_date || a.created_at).getTime() - new Date(b.due_date || b.created_at).getTime()))
      .slice(0, 10)
      .map((i) => ({
        id: i.id,
        invoiceNumber: i.invoice_number,
        customerName: i.customer_name,
        total: i.total,
        amountDue: i.amount_due,
        dueDate: i.due_date,
        currency: i.currency,
        status: i.status,
      }));

    return {
      summary: {
        totalOutstanding: summary.totalOutstanding.toFixed(2),
        totalOverdue: summary.totalOverdue.toFixed(2),
        totalPaidThisMonth: summary.totalPaidThisMonth.toFixed(2),
        totalRevenue: summary.totalRevenue.toFixed(2),
        draftCount: summary.draftCount,
        overdueCount: summary.overdueCount,
        sentCount: summary.sentCount,
        paidCount: summary.paidCount,
        totalInvoices: summary.totalInvoices,
      },
      recentlyPaid,
      requiringAttention,
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

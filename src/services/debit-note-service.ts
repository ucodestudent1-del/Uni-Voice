import { Decimal } from "decimal.js";
import { query, getClient } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { NotFoundError, BusinessLogicError, ConflictError } from "../domain/errors.js";
import { debitNoteNumberService } from "../services/invoice-number-service.js";
import { pdfService } from "../services/pdf/pdf-service.js";
import { getCurrencyMetadata, type CurrencyCode } from "../domain/value-objects/currency.js";
import Handlebars from "handlebars";
import {
  fetchCustomerSnapshot,
  fetchBusinessSnapshot,
  type TemplateCustomer,
  type TemplateBusiness,
  type TemplateLineItem,
  type TemplateFee,
  type TemplateTotals,
  type DebitNoteTemplateData,
} from "./templates/template-renderer.js";

export interface DebitNoteItemInput {
  description: string;
  quantity: string | number;
  unit: string;
  unitPrice: string | number;
  taxRate?: string | number;
  taxName?: string | null;
}

export interface CreateDebitNoteInput {
  customerId?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  currency?: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddressLine1?: string | null;
  customerAddressLine2?: string | null;
  customerCity?: string | null;
  customerStateOrRegion?: string | null;
  customerPostalCode?: string | null;
  customerCountryCode?: string | null;
  customerTaxId?: string | null;
  referenceInvoiceId?: string | null;
  referenceInvoiceNumber?: string | null;
  reason?: string | null;
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  items: DebitNoteItemInput[];
}

export interface UpdateDebitNoteInput extends Partial<CreateDebitNoteInput> {
  version?: number;
}

export interface DebitNoteResult {
  debitNote: Record<string, unknown>;
  debitNoteNumber: string;
}

const DEBIT_NOTE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Debit Note {{debitNote.debitNoteNumber}}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 32px; color: #222; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .logo { max-height: 60px; }
    .muted { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e0e0e0; font-size: 13px; }
    th { color: #666; font-weight: 600; }
    .totals { margin-top: 16px; }
    .totals td { font-weight: 600; }
    .big-total { font-size: 20px; }
    .badge { display:inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; background: #dcfce7; color: #15803d; }
    .footer { margin-top: 32px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 style="margin:0 0 4px;">Debit Note</h1>
       <h2 style="margin:0; font-size: 22px;">{{debitNote.debitNoteNumber}}</h2>
    </div>
    <div style="text-align:right">
      <h2 style="margin:0">{{business.name}}</h2>
      <p class="muted">{{business.email}}</p>
      <p class="muted">{{business.phone}}</p>
    </div>
  </div>

  <table>
    <tr><td><span class="muted">Issue Date</span></td><td>{{debitNote.issueDate}}</td></tr>
    <tr><td><span class="muted">Due Date</span></td><td>{{debitNote.dueDate}}</td></tr>
    {{#if customer}}
    <tr><td><span class="muted">Customer</span></td><td>{{customer.name}}</td></tr>
    {{#if customer.email}}
    <tr><td><span class="muted">Customer Email</span></td><td>{{customer.email}}</td></tr>
    {{/if}}
    {{/if}}
    {{#if debitNote.referenceInvoiceNumber}}
    <tr><td><span class="muted">Reference Invoice</span></td><td>{{debitNote.referenceInvoiceNumber}}</td></tr>
    {{/if}}
    <tr><td><span class="muted">Reason</span></td><td>{{debitNote.reason}}</td></tr>
    <tr><td><span class="muted">Currency</span></td><td>{{debitNote.currency}}</td></tr>
    <tr><td><span class="muted">Status</span></td><td><span class="badge">{{debitNote.status}}</span></td></tr>
  </table>

  <table style="margin-top: 24px;">
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: right; width: 80px;">Qty</th>
        <th style="text-align: right; width: 100px;">Unit</th>
        <th style="text-align: right; width: 120px;">Unit Price</th>
        <th style="text-align: right; width: 100px;">Tax Rate</th>
        <th style="text-align: right; width: 120px;">Tax Amount</th>
        <th style="text-align: right; width: 120px;">Line Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td>{{description}}</td>
        <td style="text-align: right;">{{quantity}}</td>
        <td style="text-align: right;">{{unit}}</td>
        <td style="text-align: right;">{{formatMoney unitPrice}}</td>
        <td style="text-align: right;">{{taxRate}}%</td>
        <td style="text-align: right;">{{formatMoney taxAmount}}</td>
        <td style="text-align: right;">{{formatMoney lineTotal}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals">
    <table style="max-width:320px; margin-left:auto">
      <tr><td>Subtotal</td><td style="text-align:right">{{formatMoney totals.subtotal}}</td></tr>
      <tr><td>Tax Total</td><td style="text-align:right">{{formatMoney totals.taxTotal}}</td></tr>
      <tr class="big-total"><td>Total</td><td style="text-align:right">{{formatMoney totals.total}}</td></tr>
      <tr><td style="color:#666;">Amount Due</td><td style="text-align:right; color:#222;">{{formatMoney totals.amountDue}}</td></tr>
    </table>
  </div>

  {{#if debitNote.notes}}
  <div style="margin-top: 24px;">
    <h3 style="margin:0 0 8px; font-size:13px; color:#666;">Notes</h3>
    <p style="font-size:13px; white-space:pre-wrap;">{{debitNote.notes}}</p>
  </div>
  {{/if}}

  {{#if debitNote.terms}}
  <div style="margin-top: 16px;">
    <h3 style="margin:0 0 8px; font-size:13px; color:#666;">Terms</h3>
    <p style="font-size:13px; white-space:pre-wrap;">{{debitNote.terms}}</p>
  </div>
  {{/if}}

  <div class="footer">
    <p>This debit note was generated by InvoiceFlow.</p>
  </div>
</body>
</html>`;

const compiledDebitNoteTemplate = Handlebars.compile(DEBIT_NOTE_TEMPLATE, { noEscape: false });

Handlebars.registerHelper("formatMoney", (v: Decimal.Value, currency = "USD") => {
  try {
    const d = new Decimal(v);
    const meta = getCurrencyMetadata(currency as CurrencyCode);
    const rounded = d.toDecimalPlaces(meta.decimalPlaces, Decimal.ROUND_HALF_UP);
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: meta.decimalPlaces,
      maximumFractionDigits: meta.decimalPlaces,
    });
    return formatter.format(Number(rounded.toNumber()));
  } catch {
    return new Decimal(v).toFixed(2);
  }
});

const ALLOWED_DN_TRANSITIONS: Record<string, string[]> = {
  draft: ["finalized", "cancelled", "void"],
  finalized: ["sent", "cancelled", "void"],
  sent: ["cancelled", "void"],
  cancelled: [],
  void: [],
};

const DN_TERMINAL_STATUSES = new Set<string>(["cancelled", "void"]);

export class DebitNoteService {
  async create(businessId: string, input: CreateDebitNoteInput, userId?: string): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const total = this.computeTotals(input);

      if (input.customerId) {
        const customerRes = await client.query(
          `SELECT name, email, phone, address_line_1, address_line_2, city,
                  state_or_region, postal_code, country_code FROM customers
           WHERE id = $1 AND business_id = $2`,
          [input.customerId, businessId]
        );
        if (customerRes.rows.length) {
          const c = customerRes.rows[0];
          input.customerName = input.customerName ?? c.name;
          input.customerEmail = input.customerEmail ?? c.email;
          input.customerPhone = input.customerPhone ?? c.phone;
          input.customerAddressLine1 = input.customerAddressLine1 ?? c.address_line_1;
          input.customerAddressLine2 = input.customerAddressLine2 ?? c.address_line_2;
          input.customerCity = input.customerCity ?? c.city;
          input.customerStateOrRegion = input.customerStateOrRegion ?? c.state_or_region;
          input.customerPostalCode = input.customerPostalCode ?? c.postal_code;
          input.customerCountryCode = input.customerCountryCode ?? c.country_code;
        }
      }

      const res = await client.query(
        `INSERT INTO debit_notes (
          business_id, customer_id, debit_note_number, status, issue_date, due_date, currency,
          customer_name, customer_email, customer_phone,
          customer_address_line_1, customer_address_line_2, customer_city,
          customer_state_or_region, customer_postal_code, customer_country_code, customer_tax_id,
          reference_invoice_id, reference_invoice_number, reason, notes, terms, payment_instructions,
          subtotal, tax_total, total, amount_due,
          created_by, updated_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
        RETURNING *`,
        [
          businessId,
          input.customerId ?? null,
          null,
          "draft",
          input.issueDate ?? null,
          input.dueDate ?? null,
          input.currency ?? "USD",
          input.customerName ?? null,
          input.customerEmail ?? null,
          input.customerPhone ?? null,
          input.customerAddressLine1 ?? null,
          input.customerAddressLine2 ?? null,
          input.customerCity ?? null,
          input.customerStateOrRegion ?? null,
          input.customerPostalCode ?? null,
          input.customerCountryCode ?? null,
          input.customerTaxId ?? null,
          input.referenceInvoiceId ?? null,
          input.referenceInvoiceNumber ?? null,
          input.reason ?? null,
          input.notes ?? null,
          input.terms ?? null,
          input.paymentInstructions ?? null,
          total.subtotal.toFixed(),
          total.taxTotal.toFixed(),
          total.total.toFixed(),
          total.total.toFixed(),
          userId ?? null,
          userId ?? null,
        ]
      );

      const noteId = res.rows[0].id;

      for (let idx = 0; idx < input.items.length; idx++) {
        const item = input.items[idx];
        const itemTotal = this.computeItemTotals(item);
        await client.query(
          `INSERT INTO debit_note_items (
            debit_note_id, description, quantity, unit, unit_price,
            tax_rate, tax_name, tax_amount, line_subtotal, line_total, sort_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            noteId,
            item.description,
            item.quantity ?? 1,
            item.unit ?? "each",
            item.unitPrice ?? 0,
            item.taxRate ?? 0,
            item.taxName ?? null,
            itemTotal.taxAmount.toFixed(),
            itemTotal.lineSubtotal.toFixed(),
            itemTotal.lineTotal.toFixed(),
            idx,
          ]
        );
      }

      await client.query(
        `INSERT INTO debit_note_events (debit_note_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'created', $3, 'user', $4::jsonb)`,
        [noteId, businessId, userId ?? null, JSON.stringify({ source: "api" })]
      );

      await client.query("COMMIT");
      const note = await this.findById(businessId, noteId);
      logger.info(`Created debit note ${noteId} for business ${businessId}`);
      return note!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to create debit note for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  private computeItemTotals(item: DebitNoteItemInput) {
    const quantity = new Decimal(item.quantity ?? 1);
    const unitPrice = new Decimal(item.unitPrice ?? 0);
    const taxRate = new Decimal(item.taxRate ?? 0);
    const lineSubtotal = quantity.times(unitPrice);
    const taxAmount = lineSubtotal.times(taxRate).div(100);
    const lineTotal = lineSubtotal.plus(taxAmount);
    return { lineSubtotal, taxAmount, lineTotal };
  }

  private computeTotals(input: CreateDebitNoteInput) {
    let subtotal = new Decimal(0);
    let taxTotal = new Decimal(0);
    for (const item of input.items) {
      const { lineSubtotal, taxAmount } = this.computeItemTotals(item);
      subtotal = subtotal.plus(lineSubtotal);
      taxTotal = taxTotal.plus(taxAmount);
    }
    const total = subtotal.plus(taxTotal);
    return { subtotal, taxTotal, total };
  }

   async findById(businessId: string, noteId: string): Promise<Record<string, unknown> | null> {
    const result = await query(
      `SELECT dn.*, b.name as business_name, b.email as business_email, b.phone as business_phone
       FROM debit_notes dn
       JOIN businesses b ON b.id = dn.business_id
       WHERE dn.id = $1 AND dn.business_id = $2`,
      [noteId, businessId]
    );

    if (!result.rows.length) return null;

    const note = result.rows[0];
    const itemsRes = await query(
      `SELECT * FROM debit_note_items
       WHERE debit_note_id = $1
       ORDER BY sort_order, created_at`,
      [noteId]
    );
    const eventsRes = await query(
      `SELECT id, event_type, actor_id, actor_type, metadata, created_at
       FROM debit_note_events WHERE debit_note_id = $1
       ORDER BY created_at ASC`,
      [noteId]
    );

    return {
      ...note,
      items: itemsRes.rows,
      events: eventsRes.rows,
    };
  }

  async findMany(businessId: string, filters: Record<string, unknown>): Promise<{
    debitNotes: Record<string, unknown>[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(Math.max(Number(filters.limit ?? 50), 1), 200);
    const offset = Math.max(Number(filters.offset ?? 0), 0);

    const where: string[] = ["business_id = $1"];
    const values: unknown[] = [businessId];
    let i = 2;

    if (filters.status) {
      where.push(`status = $${i++}`);
      values.push(filters.status);
    }
    if (filters.search) {
      const search = `%${filters.search}%`;
      where.push(`(debit_note_number ILIKE $${i} OR customer_name ILIKE $${i})`);
      values.push(search, search);
      i++;
    }
    if (filters.customerId) {
      where.push(`customer_id = $${i++}`);
      values.push(filters.customerId);
    }

    const sortCol = filters.sortBy ?? "created_at";
    const sortDir = (filters.sortOrder ?? "desc") === "asc" ? "ASC" : "DESC";

    const listRes = await query(
      `SELECT dn.id, dn.debit_note_number, dn.status, dn.issue_date, dn.due_date, dn.currency,
              dn.customer_name, dn.customer_email, dn.total, dn.amount_due, dn.is_finalized,
              dn.finalized_at, dn.sent_at, dn.created_at, dn.updated_at, dn.version
       FROM debit_notes dn
       WHERE ${where.join(" AND ")}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT $${i++} OFFSET $${i++}`,
      [...values, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*)::int AS total
       FROM debit_notes WHERE ${where.join(" AND ")}`,
      values
    );

    return {
      debitNotes: listRes.rows,
      total: countRes.rows[0]?.total ?? 0,
      limit,
      offset,
    };
  }

  async update(businessId: string, noteId: string, input: UpdateDebitNoteInput, userId?: string): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM debit_notes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [noteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Debit note ${noteId} not found`);
      }

      const note = existing.rows[0];
      if (note.is_finalized) {
        throw new BusinessLogicError("Finalized debit notes cannot be edited", "NOTE_FINALIZED");
      }

      if (input.version !== undefined && Number(note.version) !== Number(input.version)) {
        throw new ConflictError("Debit note was modified by another user. Please refresh and try again.", {
          currentVersion: note.version,
        });
      }

      if (input.customerId) {
        const customerRes = await client.query(
          `SELECT name, email, phone FROM customers WHERE id = $1 AND business_id = $2`,
          [input.customerId, businessId]
        );
        if (customerRes.rows.length) {
          const c = customerRes.rows[0];
          input.customerName = input.customerName ?? c.name;
          input.customerEmail = input.customerEmail ?? c.email;
          input.customerPhone = input.customerPhone ?? c.phone;
        }
      }

      const updates: string[] = [];
      const values: unknown[] = [businessId, noteId];
      let i = 3;

      const fieldMap: Record<string, string> = {
        customerId: "customer_id",
        issueDate: "issue_date",
        dueDate: "due_date",
        currency: "currency",
        customerName: "customer_name",
        customerEmail: "customer_email",
        customerPhone: "customer_phone",
        customerAddressLine1: "customer_address_line_1",
        customerAddressLine2: "customer_address_line_2",
        customerCity: "customer_city",
        customerStateOrRegion: "customer_state_or_region",
        customerPostalCode: "customer_postal_code",
        customerCountryCode: "customer_country_code",
        customerTaxId: "customer_tax_id",
        referenceInvoiceId: "reference_invoice_id",
        referenceInvoiceNumber: "reference_invoice_number",
        reason: "reason",
        notes: "notes",
        terms: "terms",
        paymentInstructions: "payment_instructions",
      };

      for (const [key, val] of Object.entries(input)) {
        if (key === "version" || key === "items") continue;
        const col = fieldMap[key] ?? key;
        updates.push(`${col} = $${i++}`);
        values.push(val);
      }

      if (input.items !== undefined) {
        await client.query(`DELETE FROM debit_note_items WHERE debit_note_id = $1`, [noteId]);

        const total = this.computeTotals({ ...input, items: input.items } as CreateDebitNoteInput);
        updates.push(`subtotal = $${i++}`);
        values.push(total.subtotal.toFixed());
        updates.push(`tax_total = $${i++}`);
        values.push(total.taxTotal.toFixed());
        updates.push(`total = $${i++}`);
        values.push(total.total.toFixed());
        updates.push(`amount_due = $${i++}`);
        values.push(total.total.toFixed());

        for (let idx = 0; idx < input.items.length; idx++) {
          const item = input.items[idx];
          const itemTotal = this.computeItemTotals(item);
          await client.query(
            `INSERT INTO debit_note_items (
              debit_note_id, description, quantity, unit, unit_price,
              tax_rate, tax_name, tax_amount, line_subtotal, line_total, sort_order
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              noteId,
              item.description,
              item.quantity ?? 1,
              item.unit ?? "each",
              item.unitPrice ?? 0,
              item.taxRate ?? 0,
              item.taxName ?? null,
              itemTotal.taxAmount.toFixed(),
              itemTotal.lineSubtotal.toFixed(),
              itemTotal.lineTotal.toFixed(),
              idx,
            ]
          );
        }
      }

      if (updates.length > 0) {
        updates.push(`version = version + 1`, `updated_at = NOW()`);
        await client.query(
          `UPDATE debit_notes SET ${updates.join(", ")} WHERE id = $2 AND business_id = $1`,
          values
        );
      }

      await client.query(
        `INSERT INTO debit_note_events (debit_note_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'updated', $3, 'user', $4::jsonb)`,
        [noteId, businessId, userId ?? null, JSON.stringify({ source: "api" })]
      );

      await client.query("COMMIT");
      const updatedNote = await this.findById(businessId, noteId);
      logger.info(`Updated debit note ${noteId} for business ${businessId}`);
      return updatedNote!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to update debit note ${noteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  canTransition(currentStatus: string, nextStatus: string): boolean {
    const allowed = ALLOWED_DN_TRANSITIONS[currentStatus] ?? [];
    return allowed.includes(nextStatus);
  }

  async finalize(businessId: string, noteId: string, userId?: string): Promise<DebitNoteResult> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM debit_notes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [noteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Debit note ${noteId} not found`);
      }

      const note = existing.rows[0];
      if (note.is_finalized) {
        throw new BusinessLogicError("Debit note is already finalized", "ALREADY_FINALIZED");
      }

      const debitNoteNumber = await debitNoteNumberService.generate(businessId);

      await client.query(
        `UPDATE debit_notes SET
          debit_note_number = $1,
          is_finalized = TRUE,
          finalized_at = NOW(),
          status = 'finalized',
          version = version + 1,
          updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [debitNoteNumber, noteId, businessId]
      );

      await client.query(
        `INSERT INTO debit_note_events (debit_note_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'finalized', $3, 'user', $4::jsonb)`,
        [noteId, businessId, userId ?? null, JSON.stringify({ debit_note_number: debitNoteNumber })]
      );

      await client.query("COMMIT");

      const finalizedNote = await this.findById(businessId, noteId);
      logger.info(`Finalized debit note ${noteId} with number ${debitNoteNumber}`);
      return { debitNote: finalizedNote!, debitNoteNumber };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to finalize debit note ${noteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async send(businessId: string, noteId: string, data: {
    to?: string;
    cc?: string[];
    bcc?: string[];
    subject?: string;
    message?: string;
  }, userId?: string): Promise<{ ok: boolean; messageId: string; status: string }> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM debit_notes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [noteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Debit note ${noteId} not found`);
      }

      const note = existing.rows[0];
      if (!note.is_finalized) {
        throw new BusinessLogicError("Debit note must be finalized before sending", "NOT_FINALIZED");
      }

      await client.query(
        `UPDATE debit_notes SET status = 'sent', sent_at = NOW(), version = version + 1, updated_at = NOW()
         WHERE id = $1 AND business_id = $2`,
        [noteId, businessId]
      );

      await client.query(
        `INSERT INTO debit_note_events (debit_note_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'sent', $3, 'user', $4::jsonb)`,
        [noteId, businessId, userId ?? null, JSON.stringify({ email: data.to })]
      );

      await client.query("COMMIT");
      logger.info(`Sent debit note ${noteId} to ${data.to}`);
      return { ok: true, messageId: crypto.randomUUID(), status: "sent" };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to send debit note ${noteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async cancel(businessId: string, noteId: string, reason: string, userId?: string): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM debit_notes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [noteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Debit note ${noteId} not found`);
      }

      const note = existing.rows[0];
      if (DN_TERMINAL_STATUSES.has(note.status)) {
        throw new BusinessLogicError(
          `Cannot cancel a debit note in ${note.status} status`,
          "INVALID_TRANSITION"
        );
      }

      await client.query(
        `UPDATE debit_notes SET
          status = 'cancelled',
          cancelled_at = NOW(),
          cancelled_reason = $1,
          version = version + 1,
          updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [reason, noteId, businessId]
      );

      await client.query(
        `INSERT INTO debit_note_events (debit_note_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'cancelled', $3, 'user', $4::jsonb)`,
        [noteId, businessId, userId ?? null, JSON.stringify({ reason })]
      );

      await client.query("COMMIT");
      const cancelledNote = await this.findById(businessId, noteId);
      logger.info(`Cancelled debit note ${noteId}`);
      return cancelledNote!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to cancel debit note ${noteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async void(businessId: string, noteId: string, reason: string, userId?: string): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM debit_notes WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [noteId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Debit note ${noteId} not found`);
      }

      const note = existing.rows[0];
      if (DN_TERMINAL_STATUSES.has(note.status)) {
        throw new BusinessLogicError(
          `Cannot void a debit note in ${note.status} status`,
          "INVALID_TRANSITION"
        );
      }

      await client.query(
        `UPDATE debit_notes SET
          status = 'void',
          voided_at = NOW(),
          void_reason = $1,
          version = version + 1,
          updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [reason, noteId, businessId]
      );

      await client.query(
        `INSERT INTO debit_note_events (debit_note_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'voided', $3, 'user', $4::jsonb)`,
        [noteId, businessId, userId ?? null, JSON.stringify({ reason })]
      );

      await client.query("COMMIT");
      const voidedNote = await this.findById(businessId, noteId);
      logger.info(`Voided debit note ${noteId}`);
      return voidedNote!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to void debit note ${noteId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async getEvents(businessId: string, noteId: string, limit = 50, offset = 0): Promise<Record<string, unknown>[]> {
    await this.findById(businessId, noteId);
    const result = await query(
      `SELECT id, event_type, actor_id, actor_type, metadata, created_at
       FROM debit_note_events WHERE debit_note_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [noteId, limit, offset]
    );
    return result.rows;
  }

  async generatePdf(businessId: string, noteId: string, note: Record<string, unknown>): Promise<Buffer> {
    const business = await fetchBusinessSnapshot(businessId);

    const currency = (note.currency as string) ?? "USD";

    const customer = await fetchCustomerSnapshot(businessId, note.customer_id as string);

    const items = (note.items as Record<string, unknown>[]).map((item) => ({
      description: item.description as string,
      quantity: new Decimal(item.quantity as string),
      unit: item.unit as string,
      unitPrice: new Decimal(item.unit_price as string),
      taxRate: new Decimal(item.tax_rate as string),
      taxName: item.tax_name as string | null | undefined,
      taxAmount: new Decimal(item.tax_amount as string),
      lineSubtotal: new Decimal(item.line_subtotal as string),
      lineTotal: new Decimal(item.line_total as string),
      isTaxInclusive: false,
    }));

    const totals = {
      subtotal: new Decimal(note.subtotal as string),
      discountTotal: new Decimal(0),
      taxTotal: new Decimal(note.tax_total as string),
      feeTotal: new Decimal(0),
      total: new Decimal(note.total as string),
      amountPaid: new Decimal(0),
      amountDue: new Decimal(note.amount_due as string) as Decimal.Value,
    };

    const templateData: DebitNoteTemplateData = {
      business: business as TemplateBusiness,
      customer,
      debitNote: {
        id: note.id as string,
        debitNoteNumber: note.debit_note_number as string | null,
        status: note.status as string,
        issueDate: note.issue_date ? new Date(note.issue_date as string).toISOString().slice(0, 10) : null,
        dueDate: note.due_date ? new Date(note.due_date as string).toISOString().slice(0, 10) : null,
        currency: currency as CurrencyCode,
        referenceInvoiceNumber: note.reference_invoice_number as string | null,
        referenceInvoiceId: note.reference_invoice_id as string | null,
        reason: note.reason as string | null | undefined,
        notes: note.notes as string | null | undefined,
        terms: note.terms as string | null | undefined,
      },
      lineItems: items as TemplateLineItem[],
      fees: [] as TemplateFee[],
      totals: totals as unknown as TemplateTotals,
      config: { currency } as Record<string, unknown>,
    };

    const html = this.renderDebitNote(templateData);
    const pdf = await pdfService.generatePdfFromHtml(html, templateData as unknown as Parameters<typeof pdfService.generatePdfFromHtml>[1]);
    return pdf;
  }

  private renderDebitNote(data: DebitNoteTemplateData): string {
    const decimal = (v: Decimal.Value) => new Decimal(v);
    return compiledDebitNoteTemplate({
      ...data,
      formatMoney: (v: Decimal.Value) => {
        const d = decimal(v);
        try {
          const meta = getCurrencyMetadata(data.debitNote.currency as CurrencyCode);
          const rounded = d.toDecimalPlaces(meta.decimalPlaces, Decimal.ROUND_HALF_UP);
          const formatter = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: data.debitNote.currency,
            minimumFractionDigits: meta.decimalPlaces,
            maximumFractionDigits: meta.decimalPlaces,
          });
          return formatter.format(Number(rounded.toNumber()));
        } catch {
          return `$${d.toFixed(2)}`;
        }
      },
    });
  }

  private async fetchBusiness(businessId: string): Promise<TemplateBusiness> {
    return fetchBusinessSnapshot(businessId);
  }
}

// Re-export shared types for backward compatibility
export type {
  TemplateCustomer as DebitNoteCustomer,
  TemplateBusiness as DebitNoteBusiness,
  TemplateLineItem as DebitNoteTemplateItem,
  TemplateFee as DebitNoteTemplateFee,
  TemplateTotals as DebitNoteTemplateTotals,
};

export const debitNoteService = new DebitNoteService();

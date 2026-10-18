import { Decimal } from "decimal.js";
import { query, getClient } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { NotFoundError, BusinessLogicError, ConflictError } from "../domain/errors.js";
import { paymentVoucherNumberService } from "../services/invoice-number-service.js";
import { pdfService } from "../services/pdf/pdf-service.js";
import { getCurrencyMetadata, type CurrencyCode } from "../domain/value-objects/currency.js";
import Handlebars from "handlebars";
import {
  fetchBusinessSnapshot,
  type TemplateBusiness,
  type TemplateCustomer,
  type TemplateLineItem,
  type TemplateFee,
  type TemplateTotals,
  type PaymentVoucherTemplateData,
  templateRenderer,
} from "./templates/template-renderer.js";

export interface PaymentVoucherItemInput {
  description: string;
  quantity: string | number;
  unit: string;
  unitPrice: string | number;
  taxRate?: string | number;
  taxName?: string | null;
}

export interface CreatePaymentVoucherInput {
  voucherDate?: string | null;
  currency?: string;
  payeeName?: string | null;
  payeeEmail?: string | null;
  payeePhone?: string | null;
  payeeAddressLine1?: string | null;
  payeeAddressLine2?: string | null;
  payeeCity?: string | null;
  payeeStateOrRegion?: string | null;
  payeePostalCode?: string | null;
  payeeCountryCode?: string | null;
  payeeTaxId?: string | null;
  referenceNumber?: string | null;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
  notes?: string | null;
  terms?: string | null;
  items: PaymentVoucherItemInput[];
}

export interface UpdatePaymentVoucherInput extends Partial<CreatePaymentVoucherInput> {
  version?: number;
}

export interface PaymentVoucherResult {
  voucher: Record<string, unknown>;
  voucherNumber: string;
}

const PAYMENT_VOUCHER_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Payment Voucher {{voucher.paymentVoucherNumber}}</title>
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
      <h1 style="margin:0 0 4px;">Payment Voucher</h1>
       <h2 style="margin:0; font-size: 22px;">{{voucher.paymentVoucherNumber}}</h2>
    </div>
    <div style="text-align:right">
      <h2 style="margin:0">{{business.name}}</h2>
      <p class="muted">{{business.email}}</p>
      <p class="muted">{{business.phone}}</p>
    </div>
  </div>

  <table>
    <tr><td><span class="muted">Date</span></td><td>{{voucher.voucherDate}}</td></tr>
    <tr><td><span class="muted">Payee</span></td><td>{{voucher.payeeName}}</td></tr>
    {{#if voucher.payeeEmail}}
    <tr><td><span class="muted">Payee Email</span></td><td>{{voucher.payeeEmail}}</td></tr>
    {{/if}}
    {{#if voucher.referenceNumber}}
    <tr><td><span class="muted">Reference</span></td><td>{{voucher.referenceNumber}}</td></tr>
    {{/if}}
    <tr><td><span class="muted">Payment Method</span></td><td>{{voucher.paymentMethod}}</td></tr>
    <tr><td><span class="muted">Currency</span></td><td>{{voucher.currency}}</td></tr>
    <tr><td><span class="muted">Status</span></td><td><span class="badge">{{voucher.status}}</span></td></tr>
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
    </table>
  </div>

  {{#if voucher.notes}}
  <div style="margin-top: 24px;">
    <h3 style="margin:0 0 8px; font-size:13px; color:#666;">Notes</h3>
    <p style="font-size:13px; white-space:pre-wrap;">{{voucher.notes}}</p>
  </div>
  {{/if}}

  {{#if voucher.terms}}
  <div style="margin-top: 16px;">
    <h3 style="margin:0 0 8px; font-size:13px; color:#666;">Terms</h3>
    <p style="font-size:13px; white-space:pre-wrap;">{{voucher.terms}}</p>
  </div>
  {{/if}}

  <div class="footer">
    <p>This payment voucher was generated by DocForge.</p>
  </div>
</body>
</html>`;

const compiledPaymentVoucherTemplate = Handlebars.compile(PAYMENT_VOUCHER_TEMPLATE, { noEscape: false });

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

const PV_TERMINAL_STATUSES = new Set<string>(["cancelled", "void"]);

export class PaymentVoucherService {
  async create(businessId: string, input: CreatePaymentVoucherInput, userId?: string): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const total = this.computeTotals(input);

      const res = await client.query(
        `INSERT INTO payment_vouchers (
          business_id, voucher_date, currency,
          payee_name, payee_email, payee_phone,
          payee_address_line_1, payee_address_line_2, payee_city,
          payee_state_or_region, payee_postal_code, payee_country_code, payee_tax_id,
          reference_number, payment_method, payment_provider,
          notes, terms,
          subtotal, tax_total, total,
          created_by, updated_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
        RETURNING *`,
        [
          businessId,
          input.voucherDate ?? null,
          input.currency ?? "USD",
          input.payeeName ?? null,
          input.payeeEmail ?? null,
          input.payeePhone ?? null,
          input.payeeAddressLine1 ?? null,
          input.payeeAddressLine2 ?? null,
          input.payeeCity ?? null,
          input.payeeStateOrRegion ?? null,
          input.payeePostalCode ?? null,
          input.payeeCountryCode ?? null,
          input.payeeTaxId ?? null,
          input.referenceNumber ?? null,
          input.paymentMethod ?? null,
          input.paymentProvider ?? null,
          input.notes ?? null,
          input.terms ?? null,
          total.subtotal.toFixed(),
          total.taxTotal.toFixed(),
          total.total.toFixed(),
          userId ?? null,
          userId ?? null,
        ]
      );

      const voucherId = res.rows[0].id;

      for (let idx = 0; idx < input.items.length; idx++) {
        const item = input.items[idx];
        const itemTotal = this.computeItemTotals(item);
        await client.query(
          `INSERT INTO payment_voucher_items (
            payment_voucher_id, description, quantity, unit, unit_price,
            tax_rate, tax_name, tax_amount, line_subtotal, line_total, sort_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            voucherId,
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
        `INSERT INTO payment_voucher_events (payment_voucher_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'created', $3, 'user', $4::jsonb)`,
        [voucherId, businessId, userId ?? null, JSON.stringify({ source: "api" })]
      );

      await client.query("COMMIT");
      const voucher = await this.findById(businessId, voucherId);
      logger.info(`Created payment voucher ${voucherId} for business ${businessId}`);
      return voucher!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to create payment voucher for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  private computeItemTotals(item: PaymentVoucherItemInput) {
    const quantity = new Decimal(item.quantity ?? 1);
    const unitPrice = new Decimal(item.unitPrice ?? 0);
    const taxRate = new Decimal(item.taxRate ?? 0);
    const lineSubtotal = quantity.times(unitPrice);
    const taxAmount = lineSubtotal.times(taxRate).div(100);
    const lineTotal = lineSubtotal.plus(taxAmount);
    return { lineSubtotal, taxAmount, lineTotal };
  }

  private computeTotals(input: CreatePaymentVoucherInput) {
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

   async findById(businessId: string, voucherId: string): Promise<Record<string, unknown> | null> {
    const result = await query(
      `SELECT pv.*, b.name as business_name, b.email as business_email, b.phone as business_phone
       FROM payment_vouchers pv
       JOIN businesses b ON b.id = pv.business_id
       WHERE pv.id = $1 AND pv.business_id = $2`,
      [voucherId, businessId]
    );

    if (!result.rows.length) return null;

    const voucher = result.rows[0];
    const itemsRes = await query(
      `SELECT * FROM payment_voucher_items
       WHERE payment_voucher_id = $1
       ORDER BY sort_order, created_at`,
      [voucherId]
    );
    const eventsRes = await query(
      `SELECT id, event_type, actor_id, actor_type, metadata, created_at
       FROM payment_voucher_events WHERE payment_voucher_id = $1 ORDER BY created_at ASC`,
      [voucherId]
    );

    return {
      ...voucher,
      items: itemsRes.rows,
      events: eventsRes.rows,
    };
  }

  async findMany(businessId: string, filters: Record<string, unknown>): Promise<{
    vouchers: Record<string, unknown>[];
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
      where.push(`(payment_voucher_number ILIKE $${i} OR payee_name ILIKE $${i})`);
      values.push(search, search);
      i++;
    }

    const listRes = await query(
      `SELECT pv.id, pv.payment_voucher_number, pv.status, pv.voucher_date, pv.currency,
              pv.payee_name, pv.payee_email, pv.total, pv.is_finalized, pv.finalized_at,
              pv.created_at, pv.updated_at, pv.version,
              b.name as business_name
       FROM payment_vouchers pv
       JOIN businesses b ON b.id = pv.business_id
       WHERE ${where.join(" AND ")}
        ORDER BY ${filters.sortBy ?? "created_at"} ${filters.sortOrder === "asc" ? "ASC" : "DESC"}
       LIMIT $${i++} OFFSET $${i++}`,
      [...values, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*)::int AS total
       FROM payment_vouchers WHERE ${where.join(" AND ")}`,
      values
    );

    return {
      vouchers: listRes.rows,
      total: countRes.rows[0]?.total ?? 0,
      limit,
      offset,
    };
  }

  async update(businessId: string, voucherId: string, input: UpdatePaymentVoucherInput, userId?: string): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM payment_vouchers WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [voucherId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Payment voucher ${voucherId} not found`);
      }

      const voucher = existing.rows[0];
      if (voucher.is_finalized) {
        throw new BusinessLogicError("Finalized payment vouchers cannot be edited", "VOUCHER_FINALIZED");
      }

      if (input.version !== undefined && Number(voucher.version) !== Number(input.version)) {
        throw new ConflictError("Payment voucher was modified by another user. Please refresh and try again.", {
          currentVersion: voucher.version,
        });
      }

      const updates: string[] = [];
      const values: unknown[] = [businessId, voucherId];
      let i = 3;

      const fieldMap: Record<string, string> = {
        voucherDate: "voucher_date",
        currency: "currency",
        payeeName: "payee_name",
        payeeEmail: "payee_email",
        payeePhone: "payee_phone",
        payeeAddressLine1: "payee_address_line_1",
        payeeAddressLine2: "payee_address_line_2",
        payeeCity: "payee_city",
        payeeStateOrRegion: "payee_state_or_region",
        payeePostalCode: "payee_postal_code",
        payeeCountryCode: "payee_country_code",
        payeeTaxId: "payee_tax_id",
        referenceNumber: "reference_number",
        paymentMethod: "payment_method",
        paymentProvider: "payment_provider",
        notes: "notes",
        terms: "terms",
      };

      for (const [key, val] of Object.entries(input)) {
        if (key === "version" || key === "items") continue;
        const col = fieldMap[key] ?? key;
        updates.push(`${col} = $${i++}`);
        values.push(val);
      }

      if (input.items !== undefined) {
        await client.query(`DELETE FROM payment_voucher_items WHERE payment_voucher_id = $1`, [voucherId]);

        const total = this.computeTotals({ ...input, items: input.items } as CreatePaymentVoucherInput);
        updates.push(`subtotal = $${i++}`);
        values.push(total.subtotal.toFixed());
        updates.push(`tax_total = $${i++}`);
        values.push(total.taxTotal.toFixed());
        updates.push(`total = $${i++}`);
        values.push(total.total.toFixed());

        for (let idx = 0; idx < input.items.length; idx++) {
          const item = input.items[idx];
          const itemTotal = this.computeItemTotals(item);
          await client.query(
            `INSERT INTO payment_voucher_items (
              payment_voucher_id, description, quantity, unit, unit_price,
              tax_rate, tax_name, tax_amount, line_subtotal, line_total, sort_order
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              voucherId,
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
          `UPDATE payment_vouchers SET ${updates.join(", ")} WHERE id = $2 AND business_id = $1`,
          values
        );
      }

      await client.query(
        `INSERT INTO payment_voucher_events (payment_voucher_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'updated', $3, 'user', $4::jsonb)`,
        [voucherId, businessId, userId ?? null, JSON.stringify({ source: "api" })]
      );

      await client.query("COMMIT");
      const updatedVoucher = await this.findById(businessId, voucherId);
      logger.info(`Updated payment voucher ${voucherId} for business ${businessId}`);
      return updatedVoucher!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to update payment voucher ${voucherId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async finalize(businessId: string, voucherId: string, userId?: string): Promise<PaymentVoucherResult> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM payment_vouchers WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [voucherId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Payment voucher ${voucherId} not found`);
      }

      const voucher = existing.rows[0];
      if (voucher.is_finalized) {
        throw new BusinessLogicError("Payment voucher is already finalized", "ALREADY_FINALIZED");
      }

      const voucherNumber = await paymentVoucherNumberService.generate(businessId);

      await client.query(
        `UPDATE payment_vouchers SET
          payment_voucher_number = $1,
          is_finalized = TRUE,
          finalized_at = NOW(),
          status = 'issued',
          version = version + 1,
          updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [voucherNumber, voucherId, businessId]
      );

      await client.query(
        `INSERT INTO payment_voucher_events (payment_voucher_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'finalized', $3, 'user', $4::jsonb)`,
        [voucherId, businessId, userId ?? null, JSON.stringify({ voucher_number: voucherNumber })]
      );

      await client.query("COMMIT");

      const finalizedVoucher = await this.findById(businessId, voucherId);
      logger.info(`Finalized payment voucher ${voucherId} with number ${voucherNumber}`);
      return { voucher: finalizedVoucher!, voucherNumber };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to finalize payment voucher ${voucherId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async cancel(businessId: string, voucherId: string, reason: string, userId?: string): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM payment_vouchers WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [voucherId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Payment voucher ${voucherId} not found`);
      }

      const voucher = existing.rows[0];
      if (PV_TERMINAL_STATUSES.has(voucher.status)) {
        throw new BusinessLogicError(
          `Cannot cancel a payment voucher in ${voucher.status} status`,
          "INVALID_TRANSITION"
        );
      }

      await client.query(
        `UPDATE payment_vouchers SET
          status = 'cancelled',
          cancelled_at = NOW(),
          cancelled_reason = $1,
          version = version + 1,
          updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [reason, voucherId, businessId]
      );

      await client.query(
        `INSERT INTO payment_voucher_events (payment_voucher_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'cancelled', $3, 'user', $4::jsonb)`,
        [voucherId, businessId, userId ?? null, JSON.stringify({ reason })]
      );

      await client.query("COMMIT");
      const cancelledVoucher = await this.findById(businessId, voucherId);
      logger.info(`Cancelled payment voucher ${voucherId}`);
      return cancelledVoucher!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to cancel payment voucher ${voucherId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async void(businessId: string, voucherId: string, reason: string, userId?: string): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM payment_vouchers WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [voucherId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Payment voucher ${voucherId} not found`);
      }

      const voucher = existing.rows[0];
      if (PV_TERMINAL_STATUSES.has(voucher.status)) {
        throw new BusinessLogicError(
          `Cannot void a payment voucher in ${voucher.status} status`,
          "INVALID_TRANSITION"
        );
      }

      await client.query(
        `UPDATE payment_vouchers SET
          status = 'void',
          voided_at = NOW(),
          void_reason = $1,
          version = version + 1,
          updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [reason, voucherId, businessId]
      );

      await client.query(
        `INSERT INTO payment_voucher_events (payment_voucher_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'voided', $3, 'user', $4::jsonb)`,
        [voucherId, businessId, userId ?? null, JSON.stringify({ reason })]
      );

      await client.query("COMMIT");
      const voidedVoucher = await this.findById(businessId, voucherId);
      logger.info(`Voided payment voucher ${voucherId}`);
      return voidedVoucher!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to void payment voucher ${voucherId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async getEvents(businessId: string, voucherId: string, limit = 50, offset = 0): Promise<Record<string, unknown>[]> {
    await this.findById(businessId, voucherId);
    const result = await query(
      `SELECT id, event_type, actor_id, actor_type, metadata, created_at
       FROM payment_voucher_events WHERE payment_voucher_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [voucherId, limit, offset]
    );
    return result.rows;
  }

  async buildTemplateDataForPaymentVoucher(
    businessId: string,
    voucherId: string,
    voucher: Record<string, unknown>,
  ): Promise<PaymentVoucherTemplateData> {
    const business = await fetchBusinessSnapshot(businessId);

    const currency = (voucher.currency as string) ?? "USD";

    const items = (voucher.items as Record<string, unknown>[]).map((item) => ({
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
      subtotal: new Decimal(voucher.subtotal as string),
      discountTotal: new Decimal(0),
      taxTotal: new Decimal(voucher.tax_total as string),
      feeTotal: new Decimal(0),
      total: new Decimal(voucher.total as string),
      amountPaid: new Decimal(0),
      amountDue: new Decimal(voucher.total as string),
    };

    // Build payee as TemplateCustomer from flat stored fields
    const payee: TemplateCustomer | null = voucher.payee_name ? {
      id: voucher.payee_name as string,
      name: voucher.payee_name as string,
      companyName: null,
      email: voucher.payee_email as string | null | undefined,
      phone: voucher.payee_phone as string | null | undefined,
      taxId: voucher.payee_tax_id as string | null | undefined,
      address: {
        addressLine1: voucher.payee_address_line_1 as string || "",
        addressLine2: voucher.payee_address_line_2 as string | null | undefined,
        city: voucher.payee_city as string || "",
        stateOrRegion: voucher.payee_state_or_region as string || "",
        postalCode: voucher.payee_postal_code as string || "",
        countryCode: voucher.payee_country_code as string || "",
      },
      countryCode: voucher.payee_country_code as string || null,
      notes: null,
      paymentTerms: null,
    } : null;

    const templateData: PaymentVoucherTemplateData = {
      business: business as TemplateBusiness,
      payee,
      voucher: {
        id: voucher.id as string,
        paymentVoucherNumber: voucher.payment_voucher_number as string | null,
        status: voucher.status as string,
        voucherDate: voucher.voucher_date ? new Date(voucher.voucher_date as string).toISOString().slice(0, 10) : null,
        currency: currency as CurrencyCode,
        payeeName: voucher.payee_name as string | null,
        payeeEmail: voucher.payee_email as string | null,
        payeePhone: voucher.payee_phone as string | null,
        referenceNumber: voucher.reference_number as string | null,
        paymentMethod: voucher.payment_method as string | null,
        paymentProvider: voucher.payment_provider as string | null,
        notes: voucher.notes as string | null | undefined,
        terms: voucher.terms as string | null | undefined,
      },
      lineItems: items as TemplateLineItem[],
      fees: [] as TemplateFee[],
      totals: totals as unknown as TemplateTotals,
      config: { currency } as Record<string, unknown>,
    };

    return templateData;
  }

  async generatePdf(businessId: string, voucherId: string, voucher: Record<string, unknown>): Promise<Buffer> {
    const templateData = await this.buildTemplateDataForPaymentVoucher(businessId, voucherId, voucher);

    const html = await templateRenderer.renderPaymentVoucher(templateData);
    const pdf = await pdfService.generatePdfFromHtml(html, templateData as any);
    return pdf;
  }

  private renderVoucher(data: PaymentVoucherTemplateData): string {
    const decimal = (v: Decimal.Value) => new Decimal(v);
    return compiledPaymentVoucherTemplate({
      ...data,
      formatMoney: (v: Decimal.Value) => {
        const d = decimal(v);
        try {
          return getCurrencyMetadata(data.voucher.currency as CurrencyCode)
            ? new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: data.voucher.currency,
                minimumFractionDigits: getCurrencyMetadata(data.voucher.currency as CurrencyCode).decimalPlaces,
                maximumFractionDigits: getCurrencyMetadata(data.voucher.currency as CurrencyCode).decimalPlaces,
              }).format(Number(d.toNumber()))
            : `$${d.toFixed(2)}`;
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
  TemplateBusiness as PaymentVoucherBusiness,
  TemplateCustomer as PaymentVoucherPayee,
  TemplateLineItem as PaymentVoucherTemplateItem,
  TemplateFee as PaymentVoucherTemplateFee,
  TemplateTotals as PaymentVoucherTemplateTotals,
};

export const paymentVoucherService = new PaymentVoucherService();

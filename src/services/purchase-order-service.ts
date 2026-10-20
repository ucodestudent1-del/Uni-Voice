import { Decimal } from "decimal.js";
import { query, getClient } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { NotFoundError, BusinessLogicError, ConflictError } from "../domain/errors.js";
import { purchaseOrderNumberService } from "../services/invoice-number-service.js";
import { pdfService } from "../services/pdf/pdf-service.js";
import { emailService } from "./email/email-service.js";
import type { CurrencyCode } from "../domain/value-objects/currency.js";
import {
  fetchBusinessSnapshot,
  fetchCustomerSnapshot,
  type TemplateBusiness,
  type TemplateCustomer,
  type TemplateLineItem,
  type TemplateFee,
  type TemplateTotals,
  type PurchaseOrderTemplateData,
  templateRenderer,
} from "./templates/template-renderer.js";

export interface PurchaseOrderItemInput {
  description: string;
  quantity: string | number;
  unit: string;
  unitPrice: string | number;
  taxRate?: string | number;
  taxName?: string | null;
}

export interface CreatePurchaseOrderInput {
  issueDate?: string | null;
  dueDate?: string | null;
  deliveryDate?: string | null;
  currency?: string;
  supplierId?: string | null;
  supplierName?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  supplierAddressLine1?: string | null;
  supplierAddressLine2?: string | null;
  supplierCity?: string | null;
  supplierStateOrRegion?: string | null;
  supplierPostalCode?: string | null;
  supplierCountryCode?: string | null;
  supplierTaxId?: string | null;
  referenceNumber?: string | null;
  notes?: string | null;
  terms?: string | null;
  paymentInstructions?: string | null;
  items: PurchaseOrderItemInput[];
  fees?: PurchaseOrderItemInput[];
}

export interface UpdatePurchaseOrderInput extends Partial<CreatePurchaseOrderInput> {
  version?: number;
}

export interface PurchaseOrderResult {
  purchaseOrder: Record<string, unknown>;
  purchaseOrderNumber: string;
}

const PO_TERMINAL_STATUSES = new Set<string>(["cancelled", "void"]);

export class PurchaseOrderService {
  async create(businessId: string, input: CreatePurchaseOrderInput, userId?: string): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const total = this.computeTotals(input);

      const res = await client.query(
        `INSERT INTO purchase_orders (
          business_id, supplier_id, issue_date, due_date, delivery_date, currency,
          supplier_name, supplier_email, supplier_phone,
          supplier_address_line_1, supplier_address_line_2, supplier_city,
          supplier_state_or_region, supplier_postal_code, supplier_country_code, supplier_tax_id,
          reference_number, notes, terms, payment_instructions,
          subtotal, tax_total, total,
          created_by, updated_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
        RETURNING *`,
        [
          businessId,
          input.supplierId ?? null,
          input.issueDate ?? null,
          input.dueDate ?? null,
          input.deliveryDate ?? null,
          input.currency ?? "USD",
          input.supplierName ?? null,
          input.supplierEmail ?? null,
          input.supplierPhone ?? null,
          input.supplierAddressLine1 ?? null,
          input.supplierAddressLine2 ?? null,
          input.supplierCity ?? null,
          input.supplierStateOrRegion ?? null,
          input.supplierPostalCode ?? null,
          input.supplierCountryCode ?? null,
          input.supplierTaxId ?? null,
          input.referenceNumber ?? null,
          input.notes ?? null,
          input.terms ?? null,
          input.paymentInstructions ?? null,
          total.subtotal.toFixed(),
          total.taxTotal.toFixed(),
          total.total.toFixed(),
          userId ?? null,
          userId ?? null,
        ]
      );

      const poId = res.rows[0].id;

      for (let idx = 0; idx < input.items.length; idx++) {
        const item = input.items[idx];
        const itemTotal = this.computeItemTotals(item);
        await client.query(
          `INSERT INTO purchase_order_items (
            purchase_order_id, description, quantity, unit, unit_price,
            tax_rate, tax_name, tax_amount, line_subtotal, line_total, sort_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            poId,
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
        `INSERT INTO purchase_order_events (purchase_order_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'created', $3, 'user', $4::jsonb)`,
        [poId, businessId, userId ?? null, JSON.stringify({ source: "api" })]
      );

      await client.query("COMMIT");
      const purchaseOrder = await this.findById(businessId, poId);
      logger.info(`Created purchase order ${poId} for business ${businessId}`);
      return purchaseOrder!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to create purchase order for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  private computeItemTotals(item: PurchaseOrderItemInput) {
    const quantity = new Decimal(item.quantity ?? 1);
    const unitPrice = new Decimal(item.unitPrice ?? 0);
    const taxRate = new Decimal(item.taxRate ?? 0);
    const lineSubtotal = quantity.times(unitPrice);
    const taxAmount = lineSubtotal.times(taxRate).div(100);
    const lineTotal = lineSubtotal.plus(taxAmount);
    return { lineSubtotal, taxAmount, lineTotal };
  }

  private computeTotals(input: CreatePurchaseOrderInput) {
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

  async findById(businessId: string, poId: string): Promise<Record<string, unknown> | null> {
    const result = await query(
      `SELECT po.*, b.name as business_name, b.email as business_email, b.phone as business_phone
       FROM purchase_orders po
       JOIN businesses b ON b.id = po.business_id
       WHERE po.id = $1 AND po.business_id = $2`,
      [poId, businessId]
    );

    if (!result.rows.length) return null;

    const po = result.rows[0];
    const itemsRes = await query(
      `SELECT * FROM purchase_order_items
       WHERE purchase_order_id = $1
       ORDER BY sort_order, created_at`,
      [poId]
    );
    const eventsRes = await query(
      `SELECT id, event_type, actor_id, actor_type, metadata, created_at
       FROM purchase_order_events WHERE purchase_order_id = $1 ORDER BY created_at ASC`,
      [poId]
    );

    return {
      ...po,
      items: itemsRes.rows,
      events: eventsRes.rows,
    };
  }

  async findMany(businessId: string, filters: Record<string, unknown>): Promise<{
    purchaseOrders: Record<string, unknown>[];
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
      where.push(`(purchase_order_number ILIKE $${i} OR supplier_name ILIKE $${i})`);
      values.push(search, search);
      i++;
    }

    const listRes = await query(
      `SELECT po.id, po.purchase_order_number, po.status, po.issue_date, po.due_date, po.currency,
              po.supplier_name, po.supplier_email, po.total, po.amount_due, po.is_finalized,
              po.finalized_at, po.sent_at, po.created_at, po.updated_at, po.version,
              b.name as business_name
       FROM purchase_orders po
       JOIN businesses b ON b.id = po.business_id
       WHERE ${where.join(" AND ")}
        ORDER BY ${filters.sortBy ?? "created_at"} ${filters.sortOrder === "asc" ? "ASC" : "DESC"}
       LIMIT $${i++} OFFSET $${i++}`,
      [...values, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*)::int AS total
       FROM purchase_orders WHERE ${where.join(" AND ")}`,
      values
    );

    return {
      purchaseOrders: listRes.rows,
      total: countRes.rows[0]?.total ?? 0,
      limit,
      offset,
    };
  }

  async update(businessId: string, poId: string, input: UpdatePurchaseOrderInput, userId?: string): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM purchase_orders WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [poId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Purchase order ${poId} not found`);
      }

      const po = existing.rows[0];
      if (po.is_finalized) {
        throw new BusinessLogicError("Finalized purchase orders cannot be edited", "PO_FINALIZED");
      }

      if (input.version !== undefined && Number(po.version) !== Number(input.version)) {
        throw new ConflictError("Purchase order was modified by another user. Please refresh and try again.", {
          currentVersion: po.version,
        });
      }

      const updates: string[] = [];
      const values: unknown[] = [businessId, poId];
      let i = 3;

      const fieldMap: Record<string, string> = {
        issueDate: "issue_date",
        dueDate: "due_date",
        deliveryDate: "delivery_date",
        currency: "currency",
        supplierId: "supplier_id",
        supplierName: "supplier_name",
        supplierEmail: "supplier_email",
        supplierPhone: "supplier_phone",
        supplierAddressLine1: "supplier_address_line_1",
        supplierAddressLine2: "supplier_address_line_2",
        supplierCity: "supplier_city",
        supplierStateOrRegion: "supplier_state_or_region",
        supplierPostalCode: "supplier_postal_code",
        supplierCountryCode: "supplier_country_code",
        supplierTaxId: "supplier_tax_id",
        referenceNumber: "reference_number",
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
        await client.query(`DELETE FROM purchase_order_items WHERE purchase_order_id = $1`, [poId]);

        const total = this.computeTotals({ ...input, items: input.items } as CreatePurchaseOrderInput);
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
            `INSERT INTO purchase_order_items (
              purchase_order_id, description, quantity, unit, unit_price,
              tax_rate, tax_name, tax_amount, line_subtotal, line_total, sort_order
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              poId,
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
          `UPDATE purchase_orders SET ${updates.join(", ")} WHERE id = $2 AND business_id = $1`,
          values
        );
      }

      await client.query(
        `INSERT INTO purchase_order_events (purchase_order_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'updated', $3, 'user', $4::jsonb)`,
        [poId, businessId, userId ?? null, JSON.stringify({ source: "api" })]
      );

      await client.query("COMMIT");
      const updatedPO = await this.findById(businessId, poId);
      logger.info(`Updated purchase order ${poId} for business ${businessId}`);
      return updatedPO!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to update purchase order ${poId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async finalize(businessId: string, poId: string, userId?: string): Promise<PurchaseOrderResult> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM purchase_orders WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [poId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Purchase order ${poId} not found`);
      }

      const po = existing.rows[0];
      if (po.is_finalized) {
        throw new BusinessLogicError("Purchase order is already finalized", "ALREADY_FINALIZED");
      }

      const poNumber = await purchaseOrderNumberService.generate(businessId);

      await client.query(
        `UPDATE purchase_orders SET
          purchase_order_number = $1,
          is_finalized = TRUE,
          finalized_at = NOW(),
          status = 'finalized',
          version = version + 1,
          updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [poNumber, poId, businessId]
      );

      await client.query(
        `INSERT INTO purchase_order_events (purchase_order_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'finalized', $3, 'user', $4::jsonb)`,
        [poId, businessId, userId ?? null, JSON.stringify({ po_number: poNumber })]
      );

      await client.query("COMMIT");

      const finalizedPO = await this.findById(businessId, poId);
      logger.info(`Finalized purchase order ${poId} with number ${poNumber}`);
      return { purchaseOrder: finalizedPO!, purchaseOrderNumber: poNumber };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to finalize purchase order ${poId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async send(businessId: string, poId: string, data: { to?: string | null; cc?: string[] | null; bcc?: string[] | null; subject?: string | null; message?: string | null }, userId?: string): Promise<{ ok: boolean; success: boolean; messageId: string; status: string; purchaseOrder: Record<string, unknown> | null }> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM purchase_orders WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [poId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Purchase order ${poId} not found`);
      }

      const po = existing.rows[0];
      if (!po.is_finalized) {
        throw new BusinessLogicError("Purchase order must be finalized before sending", "NOT_FINALIZED");
      }

      if (PO_TERMINAL_STATUSES.has(po.status)) {
        throw new BusinessLogicError(`Cannot send a purchase order in ${po.status} status`, "INVALID_TRANSITION");
      }

      if (!po.public_token) {
        await client.query(
          `UPDATE purchase_orders SET public_token = $1, public_token_expires_at = NOW() + INTERVAL '2 years' WHERE id = $2`,
          [crypto.randomUUID().replace(/-/g, "").slice(0, 32), poId]
        );
      }

      const updated = await client.query(
        `SELECT * FROM purchase_orders WHERE id = $1`,
        [poId]
      );

      let publicToken: string | null = null;
      if (updated.rows[0].public_token) {
        publicToken = updated.rows[0].public_token;
      }

      const supplierEmail = data?.to ?? po.supplier_email;
      if (!supplierEmail) {
        throw new BusinessLogicError("No supplier email provided and no supplier email on record", "MISSING_EMAIL");
      }

      const html = await this.renderPurchaseOrderForEmail(businessId, poId, updated.rows[0]);

      const idempotencyKey = `purchase-order-send:${poId}:${crypto.randomUUID()}`;
      const result = await emailService.sendPurchaseOrderEmail({
        purchaseOrderId: poId,
        businessId,
        recipient: { email: supplierEmail, name: po.supplier_name ?? undefined },
        subject: data?.subject ?? `Purchase Order #${po.purchase_order_number ?? poId}`,
        htmlBody: html,
        idempotencyKey,
      });

      await client.query(
        `UPDATE purchase_orders SET status = 'sent', sent_at = NOW() WHERE id = $1 AND business_id = $2`,
        [poId, businessId]
      );

      await client.query(
        `UPDATE purchase_orders SET status = 'sent', sent_at = NOW() WHERE id = $1 AND business_id = $2`,
        [poId, businessId]
      );

      await client.query(
        `INSERT INTO purchase_order_events (purchase_order_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'sent', $3, 'user', $4::jsonb)`,
        [poId, businessId, userId ?? null, JSON.stringify({ email_result: result })]
      );

      await client.query("COMMIT");

      const sentPO = await this.findById(businessId, poId);
      logger.info(`Sent purchase order ${poId} to ${supplierEmail}`);
      return {
        ok: result.status === "delivered" || result.status === "sent",
        success: result.status === "delivered" || result.status === "sent",
        messageId: result.messageId,
        status: "sent",
        purchaseOrder: sentPO,
      };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to send purchase order ${poId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async cancel(businessId: string, poId: string, reason: string, userId?: string): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM purchase_orders WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [poId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Purchase order ${poId} not found`);
      }

      const po = existing.rows[0];
      if (PO_TERMINAL_STATUSES.has(po.status)) {
        throw new BusinessLogicError(`Cannot cancel a purchase order in ${po.status} status`, "INVALID_TRANSITION");
      }

      await client.query(
        `UPDATE purchase_orders SET
          status = 'cancelled',
          cancelled_at = NOW(),
          cancelled_reason = $1,
          version = version + 1,
          updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [reason, poId, businessId]
      );

      await client.query(
        `INSERT INTO purchase_order_events (purchase_order_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'cancelled', $3, 'user', $4::jsonb)`,
        [poId, businessId, userId ?? null, JSON.stringify({ reason })]
      );

      await client.query("COMMIT");
      const cancelledPO = await this.findById(businessId, poId);
      logger.info(`Cancelled purchase order ${poId}`);
      return cancelledPO!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to cancel purchase order ${poId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async void(businessId: string, poId: string, reason: string, userId?: string): Promise<Record<string, unknown>> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `SELECT * FROM purchase_orders WHERE id = $1 AND business_id = $2 FOR UPDATE`,
        [poId, businessId]
      );

      if (!existing.rows.length) {
        throw new NotFoundError(`Purchase order ${poId} not found`);
      }

      const po = existing.rows[0];
      if (PO_TERMINAL_STATUSES.has(po.status)) {
        throw new BusinessLogicError(`Cannot void a purchase order in ${po.status} status`, "INVALID_TRANSITION");
      }

      await client.query(
        `UPDATE purchase_orders SET
          status = 'void',
          voided_at = NOW(),
          void_reason = $1,
          version = version + 1,
          updated_at = NOW()
         WHERE id = $2 AND business_id = $3`,
        [reason, poId, businessId]
      );

      await client.query(
        `INSERT INTO purchase_order_events (purchase_order_id, business_id, event_type, actor_id, actor_type, metadata)
         VALUES ($1, $2, 'voided', $3, 'user', $4::jsonb)`,
        [poId, businessId, userId ?? null, JSON.stringify({ reason })]
      );

      await client.query("COMMIT");
      const voidedPO = await this.findById(businessId, poId);
      logger.info(`Voided purchase order ${poId}`);
      return voidedPO!;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Failed to void purchase order ${poId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  async getEvents(businessId: string, poId: string, limit = 50, offset = 0): Promise<Record<string, unknown>[]> {
    await this.findById(businessId, poId);
    const result = await query(
      `SELECT id, event_type, actor_id, actor_type, metadata, created_at
       FROM purchase_order_events WHERE purchase_order_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [poId, limit, offset]
    );
    return result.rows;
  }

  async buildTemplateDataForPurchaseOrder(
    businessId: string,
    poId: string,
    po: Record<string, unknown>,
  ): Promise<PurchaseOrderTemplateData> {
    const business = await fetchBusinessSnapshot(businessId);

    const currency = (po.currency as string) ?? "USD";

    const items = (po.items as Record<string, unknown>[]).map((item) => ({
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
      subtotal: new Decimal(po.subtotal as string),
      discountTotal: new Decimal(0),
      taxTotal: new Decimal(po.tax_total as string),
      feeTotal: new Decimal(0),
      total: new Decimal(po.total as string),
      amountPaid: new Decimal(0),
      amountDue: new Decimal(po.amount_due as string),
    };

    let supplier: TemplateCustomer | null = null;
    if (po.supplier_id) {
      supplier = await fetchCustomerSnapshot(businessId, po.supplier_id as string);
    }

    if (!supplier && po.supplier_name) {
      supplier = {
        id: po.supplier_name as string,
        name: po.supplier_name as string,
        companyName: null,
        email: po.supplier_email as string | null | undefined,
        phone: po.supplier_phone as string | null | undefined,
        taxId: po.supplier_tax_id as string | null | undefined,
        address: {
          addressLine1: (po.supplier_address_line_1 as string) || "",
          addressLine2: po.supplier_address_line_2 as string | null | undefined,
          city: (po.supplier_city as string) || "",
          stateOrRegion: (po.supplier_state_or_region as string) || "",
          postalCode: (po.supplier_postal_code as string) || "",
          countryCode: (po.supplier_country_code as string) || "",
        },
        countryCode: (po.supplier_country_code as string) || null,
        notes: null,
        paymentTerms: null,
      };
    }

    const templateData: PurchaseOrderTemplateData = {
      business: business as TemplateBusiness,
      supplier: supplier,
      purchaseOrder: {
        id: po.id as string,
        purchaseOrderNumber: po.purchase_order_number as string | null,
        status: po.status as string,
        issueDate: po.issue_date ? new Date(po.issue_date as string).toISOString().slice(0, 10) : null,
        dueDate: po.due_date ? new Date(po.due_date as string).toISOString().slice(0, 10) : null,
        currency: currency as CurrencyCode,
        supplierName: po.supplier_name as string | null,
        supplierEmail: po.supplier_email as string | null,
        supplierPhone: po.supplier_phone as string | null,
        referenceNumber: po.reference_number as string | null,
        notes: po.notes as string | null | undefined,
        terms: po.terms as string | null | undefined,
        language: (po.language as string | undefined) ?? undefined,
        isFinalized: (po.is_finalized as boolean | undefined) ?? false,
      },
      lineItems: items as TemplateLineItem[],
      fees: [] as TemplateFee[],
      totals: totals as unknown as TemplateTotals,
      config: { currency } as Record<string, unknown>,
    };

    return templateData;
  }

  async generatePdf(businessId: string, poId: string, po: Record<string, unknown>): Promise<Buffer> {
    const templateData = await this.buildTemplateDataForPurchaseOrder(businessId, poId, po);
    const html = await templateRenderer.renderPurchaseOrder(templateData);
    const pdf = await pdfService.generatePdfFromHtml(html, templateData as any);
    return pdf;
  }

  private async renderPurchaseOrderForEmail(businessId: string, poId: string, po: Record<string, unknown>): Promise<string> {
    const templateData = await this.buildTemplateDataForPurchaseOrder(businessId, poId, po);
    const html = await templateRenderer.renderPurchaseOrder(templateData);
    return html;
  }
}

export const purchaseOrderService = new PurchaseOrderService();

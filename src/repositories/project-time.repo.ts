import { Decimal } from "decimal.js";
import { query, getClient } from "../db/pool.js";
import type { ProjectTimeEntry, ProjectTimeEntrySummary, ProjectNote } from "../domain/models/project-time.js";
import type { ProjectNoteCreateInput } from "../domain/schemas/project-time-entry.js";
import { NotFoundError, BusinessLogicError } from "../domain/errors.js";
import { rowToDate } from "./helpers.js";
import type { PagedResult } from "../repositories/helpers.js";
import type { DraftLineItem } from "../services/invoice-service.js";

export interface TimeEntrySearchOpts {
  billable?: boolean;
  isInvoiced?: boolean;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface TimeEntryInput {
  catalogServiceId?: string | null;
  description: string;
  billable?: boolean;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  durationMinutes?: number | null;
  billableRate?: Decimal.Value;
}

export interface TimeEntryUpdateInput {
  catalogServiceId?: string | null;
  description?: string;
  billable?: boolean;
  startTime?: string | Date | null;
  endTime?: string | Date | null;
  durationMinutes?: number | null;
  billableRate?: Decimal.Value;
}

const SORTABLE_COLUMNS: Record<string, string> = {
  created_at: "created_at",
  duration_minutes: "duration_minutes",
  billable_amount: "billable_amount",
  start_time: "start_time",
};

export class ProjectTimeEntryRepository {
  async create(
    businessId: string,
    projectId: string,
    input: TimeEntryInput,
    userId?: string | null
  ): Promise<ProjectTimeEntry> {
    const durationMinutes = input.durationMinutes ?? this.computeDurationMinutes(input.startTime, input.endTime);
    if (durationMinutes !== null && durationMinutes <= 0) {
      throw new BusinessLogicError("Duration must be greater than 0");
    }

    const rate = new Decimal(input.billableRate ?? 0);
    let billableAmount = new Decimal(0);
    if (durationMinutes !== null && input.billable !== false) {
      billableAmount = new Decimal(durationMinutes).div(60).mul(rate);
    }

    const client = await getClient();
    try {
      await client.query("BEGIN");
      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      const res = await client.query(
        `INSERT INTO project_time_entries (
          id, business_id, project_id, user_id, catalog_service_id,
          description, billable, start_time, end_time, duration_minutes,
          billable_rate, billable_amount, is_invoiced, invoice_id,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $15
        ) RETURNING *`,
        [
          id,
          businessId,
          projectId,
          userId ?? null,
          input.catalogServiceId ?? null,
          input.description,
          input.billable ?? true,
          input.startTime ?? null,
          input.endTime ?? null,
          durationMinutes,
          rate.toFixed(6),
          billableAmount.toFixed(6),
          false,
          null,
          now,
        ]
      );

      await client.query("COMMIT");
      return this.rowToModel(res.rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async findById(businessId: string, id: string): Promise<ProjectTimeEntry> {
    const res = await query(
      `SELECT * FROM project_time_entries WHERE id = $1 AND business_id = $2`,
      [id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Time entry ${id} not found`);
    return this.rowToModel(res.rows[0]);
  }

  async findMany(
    businessId: string,
    projectId: string,
    opts: TimeEntrySearchOpts = {}
  ): Promise<PagedResult<ProjectTimeEntry>> {
    const limit = Math.min(opts.limit ?? 50, 500);
    const offset = opts.offset ?? 0;
    const sortBy = opts.sortBy ?? "created_at";
    const sortOrder = opts.sortOrder ?? "desc";

    const conditions: string[] = ["business_id = $1", "project_id = $2"];
    const vals: unknown[] = [businessId, projectId];
    let i = 3;

    if (opts.billable !== undefined) {
      conditions.push(`billable = $${i++}`);
      vals.push(opts.billable);
    }

    if (opts.isInvoiced !== undefined) {
      conditions.push(`is_invoiced = $${i++}`);
      vals.push(opts.isInvoiced);
    }

    if (opts.userId) {
      conditions.push(`user_id = $${i++}`);
      vals.push(opts.userId);
    }

    if (opts.dateFrom) {
      conditions.push(`created_at >= $${i++}::timestamptz`);
      vals.push(opts.dateFrom.toISOString());
    }

    if (opts.dateTo) {
      conditions.push(`created_at <= $${i++}::timestamptz`);
      vals.push(opts.dateTo.toISOString());
    }

    const sortCol = SORTABLE_COLUMNS[sortBy] || "created_at";
    const sortDir = sortOrder === "desc" ? "DESC" : "ASC";

    const dataRes = await query(
      `SELECT * FROM project_time_entries
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${sortCol} ${sortDir}, created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      [...vals, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*) as total FROM project_time_entries
       WHERE ${conditions.join(" AND ")}`,
      vals
    );

    const data = dataRes.rows.map((r) => this.rowToModel(r));
    const total = Number(countRes.rows[0]?.total ?? 0);
    return { data, total, limit, offset };
  }

  async update(
    businessId: string,
    id: string,
    input: TimeEntryUpdateInput
  ): Promise<ProjectTimeEntry> {
    const entry = await this.findById(businessId, id);
    if (entry.isInvoiced) {
      throw new BusinessLogicError("Cannot modify a time entry that has already been invoiced");
    }

    const durationMinutes = input.durationMinutes ?? this.computeDurationMinutes(input.startTime ?? entry.startTime, input.endTime ?? entry.endTime);

    const rate = new Decimal(input.billableRate ?? entry.billableRate);
    let billableAmount = new Decimal(0);
    const isBillable = input.billable !== undefined ? input.billable : entry.billable;
    if (durationMinutes !== null && isBillable) {
      billableAmount = new Decimal(durationMinutes).div(60).mul(rate);
    }

    const res = await query(
      `UPDATE project_time_entries SET
        catalog_service_id = $3,
        description = $4,
        billable = $5,
        start_time = $6,
        end_time = $7,
        duration_minutes = $8,
        billable_rate = $9,
        billable_amount = $10,
        updated_at = NOW()
       WHERE id = $1 AND business_id = $2 RETURNING *`,
      [
        id,
        businessId,
        input.catalogServiceId ?? entry.catalogServiceId,
        input.description ?? entry.description,
        input.billable ?? entry.billable,
        input.startTime ?? entry.startTime,
        input.endTime ?? entry.endTime,
        durationMinutes,
        rate.toFixed(6),
        billableAmount.toFixed(6),
      ]
    );

    return this.rowToModel(res.rows[0]);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const entry = await this.findById(businessId, id);
    if (entry.isInvoiced) {
      throw new BusinessLogicError("Cannot delete a time entry that has been invoiced");
    }
    await query(`DELETE FROM project_time_entries WHERE id = $1 AND business_id = $2`, [id, businessId]);
  }

  async markInvoiced(
    businessId: string,
    projectId: string,
    invoiceId: string,
    client?: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }
  ): Promise<void> {
    const sql = `
      UPDATE project_time_entries
      SET is_invoiced = true, invoice_id = $1, updated_at = NOW()
      WHERE project_id = $2 AND business_id = $3
        AND is_invoiced = false AND billable = true
        AND (invoice_id IS NULL OR invoice_id != $1)
    `;
    const runner = client ? client.query.bind(client) : query;
    await runner(sql, [invoiceId, projectId, businessId]);
  }

  async getUnbilledBillableEntries(businessId: string, projectId: string): Promise<ProjectTimeEntry[]> {
    const res = await query(
      `SELECT * FROM project_time_entries
       WHERE business_id = $1 AND project_id = $2
         AND is_invoiced = false AND billable = true
       ORDER BY created_at DESC`,
      [businessId, projectId]
    );
    return res.rows.map((r) => this.rowToModel(r));
  }

  async getSummary(businessId: string, projectId: string, currency = "USD"): Promise<ProjectTimeEntrySummary> {
    const res = await query(
      `SELECT
         COALESCE(SUM(duration_minutes), 0) as total_minutes,
         COALESCE(SUM(CASE WHEN billable THEN duration_minutes ELSE 0 END), 0) as billable_minutes,
         COALESCE(SUM(CASE WHEN billable = false THEN duration_minutes ELSE 0 END), 0) as non_billable_minutes,
         COALESCE(SUM(CASE WHEN is_invoiced = false AND billable THEN duration_minutes ELSE 0 END), 0) as unbilled_billable_minutes,
         COALESCE(SUM(CASE WHEN is_invoiced = true AND billable THEN duration_minutes ELSE 0 END), 0) as invoiced_billable_minutes,
         COALESCE(SUM(CASE WHEN billable THEN billable_amount ELSE 0 END), 0) as total_billable_amount,
         COALESCE(SUM(CASE WHEN is_invoiced = false AND billable THEN billable_amount ELSE 0 END), 0) as unbilled_billable_amount
       FROM project_time_entries
       WHERE business_id = $1 AND project_id = $2`,
      [businessId, projectId]
    );

    const r = res.rows[0];
    return {
      totalMinutes: Number(r.total_minutes ?? 0),
      billableMinutes: Number(r.billable_minutes ?? 0),
      nonBillableMinutes: Number(r.non_billable_minutes ?? 0),
      unbilledBillableMinutes: Number(r.unbilled_billable_minutes ?? 0),
      invoicedBillableMinutes: Number(r.invoiced_billable_minutes ?? 0),
      totalBillableAmount: (new Decimal(r.total_billable_amount ?? 0)).toFixed(2),
      unbilledBillableAmount: (new Decimal(r.unbilled_billable_amount ?? 0)).toFixed(2),
      currency,
    };
  }

  async convertToLineItems(
    businessId: string,
    projectId: string,
    _invoiceId?: string
  ): Promise<DraftLineItem[]> {
    const entries = await this.getUnbilledBillableEntries(businessId, projectId);
    if (entries.length === 0) return [];

    const lineItems: DraftLineItem[] = [];

    for (const entry of entries) {
      const hours = new Decimal(entry.durationMinutes ?? 0).div(60);
      const rate = new Decimal(entry.billableRate);

      let catalogInfo: Partial<Pick<DraftLineItem, "productId" | "catalogName" | "catalogSku" | "catalogTaxCategory" | "catalogUnitPrice" | "catalogTaxRate">> = {};

      if (entry.catalogServiceId) {
        const product = await this.fetchCatalogService(businessId, entry.catalogServiceId);
        if (product) {
          catalogInfo = {
            productId: product.id,
            catalogName: product.name,
            catalogSku: product.sku,
            catalogTaxCategory: product.taxCategory,
            catalogUnitPrice: product.unitPrice,
            catalogTaxRate: product.defaultTaxRate,
          };
        }
      }

      lineItems.push({
        id: crypto.randomUUID(),
        productId: entry.catalogServiceId ?? catalogInfo.productId ?? null,
        description: entry.description,
        quantity: hours.toFixed(4),
        unit: "hour",
        unitPrice: rate.toFixed(6),
        discount: "0",
        discountType: "percentage",
        taxRate: catalogInfo.catalogTaxRate ?? "0",
        isTaxInclusive: false,
        sortOrder: lineItems.length,
        catalogName: catalogInfo.catalogName ?? null,
        catalogSku: catalogInfo.catalogSku ?? null,
        catalogTaxCategory: catalogInfo.catalogTaxCategory ?? null,
        catalogUnitPrice: catalogInfo.catalogUnitPrice ?? null,
        catalogTaxRate: catalogInfo.catalogTaxRate ?? null,
      });
    }

    return lineItems;
  }

  async addNote(
    businessId: string,
    projectId: string,
    input: ProjectNoteCreateInput,
    userId?: string | null
  ): Promise<ProjectNote> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const res = await query(
      `INSERT INTO project_notes (id, business_id, project_id, user_id, title, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING *`,
      [id, businessId, projectId, userId ?? null, input.title ?? null, input.content, now]
    );
    return this.noteRowToModel(res.rows[0]);
  }

  async getNotes(businessId: string, projectId: string, limit = 50, offset = 0): Promise<PagedResult<ProjectNote>> {
    const res = await query(
      `SELECT * FROM project_notes
       WHERE business_id = $1 AND project_id = $2
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [businessId, projectId, limit, offset]
    );
    const countRes = await query(
      `SELECT COUNT(*) as total FROM project_notes WHERE business_id = $1 AND project_id = $2`,
      [businessId, projectId]
    );
    const total = Number(countRes.rows[0]?.total ?? 0);
    return { data: res.rows.map((r) => this.noteRowToModel(r)), total, limit, offset };
  }

  async deleteNote(businessId: string, projectId: string, noteId: string): Promise<void> {
    const res = await query(
      `DELETE FROM project_notes WHERE id = $1 AND project_id = $2 AND business_id = $3 RETURNING id`,
      [noteId, projectId, businessId]
    );
    if (res.rows.length === 0) throw new NotFoundError(`Note ${noteId} not found`);
  }

  private computeDurationMinutes(
    startTime: string | Date | null | undefined,
    endTime: string | Date | null | undefined
  ): number | null {
    if (!startTime || !endTime) return null;
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (end < start) return null;
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }

  private async fetchCatalogService(businessId: string, catalogServiceId: string): Promise<{
    id: string;
    name: string;
    sku: string | null;
    taxCategory: string | null;
    unitPrice: string;
    defaultTaxRate: string;
  } | null> {
    const res = await query(
      `SELECT id, name, sku, tax_category as "taxCategory", default_unit_price as "unitPrice", default_tax_rate as "defaultTaxRate"
       FROM products WHERE id = $1 AND business_id = $2`,
      [catalogServiceId, businessId]
    );
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return {
      id: r.id as string,
      name: r.name as string,
      sku: r.sku as string | null,
      taxCategory: r.taxCategory as string | null,
      unitPrice: r.unitPrice as string,
      defaultTaxRate: r.defaultTaxRate as string,
    };
  }

  private rowToModel(r: Record<string, unknown>): ProjectTimeEntry {
    return {
      id: r.id as string,
      projectId: r.project_id as string,
      businessId: r.business_id as string,
      userId: r.user_id as string | null,
      catalogServiceId: r.catalog_service_id as string | null,
      description: r.description as string,
      billable: r.billable as boolean,
      startTime: rowToDate(r.start_time),
      endTime: rowToDate(r.end_time),
      durationMinutes: r.duration_minutes ? Number(r.duration_minutes) : null,
      billableRate: r.billable_rate as string,
      billableAmount: r.billable_amount as string,
      isInvoiced: r.is_invoiced as boolean,
      invoiceId: r.invoice_id as string | null,
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }

  private noteRowToModel(r: Record<string, unknown>): ProjectNote {
    return {
      id: r.id as string,
      projectId: r.project_id as string,
      businessId: r.business_id as string,
      userId: r.user_id as string | null,
      title: r.title as string | null,
      content: r.content as string,
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }
}

export const projectTimeEntryRepository = new ProjectTimeEntryRepository();

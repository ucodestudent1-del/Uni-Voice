import { query, getClient } from "../db/pool.js";
import type { Customer, CustomerAddress, TaxIdentifier, CustomerStatus } from "../domain/models/index.js";
import type { Address } from "../domain/value-objects/address.js";
import { NotFoundError } from "../domain/errors.js";
import { rowToDate } from "./helpers.js";
import type { PagedResult } from "./helpers.js";

export interface CustomerInput {
  name: string;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateOrRegion?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  defaultCurrency?: string | null;
  notes?: string | null;
  status?: CustomerStatus;
  paymentTerms?: number | null;
}

export type CustomerUpdateInput = CustomerInput;

export interface CustomerSearchOptions {
  search?: string;
  status?: CustomerStatus;
  email?: string;
  companyName?: string;
  countryCode?: string;
  defaultCurrency?: string;
  includeArchived?: boolean;
  enrich?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface EnrichedCustomer extends Customer {
  invoiceCount: number;
  totalOutstanding: string;
  mostRecentInvoiceDate: Date | null;
}

export interface CustomerInvoiceSummary {
  id: string;
  invoiceNumber: string | null;
  status: string;
  currency: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  issueDate: Date | null;
  dueDate: Date | null;
  finalizedAt: Date | null;
  createdAt: Date;
}

const SORTABLE_COLUMNS: Record<string, string> = {
  name: "c.name",
  company_name: "c.company_name",
  email: "c.email",
  created_at: "c.created_at",
  updated_at: "c.updated_at",
  status: "c.status",
};

export class CustomerRepository {
  async create(businessId: string, input: CustomerInput, createdBy?: string): Promise<Customer> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const status = input.status ?? "active";
    const searchName = input.name ? input.name.toLowerCase() : null;
    const searchEmail = input.email ? input.email.toLowerCase() : null;
    const searchCompany = input.companyName ? input.companyName.toLowerCase() : null;

    const res = await query(
      `INSERT INTO customers (
        id, business_id, name, company_name, email, phone, tax_id,
        address_line_1, address_line_2, city, state_or_region, postal_code,
        country_code, default_currency, notes, status, payment_terms,
        search_name, search_email, search_company, version, created_at, updated_at, updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 1, $21, $21, $22
      ) RETURNING *`,
      [
        id, businessId, input.name, input.companyName, input.email, input.phone, input.taxId,
        input.addressLine1, input.addressLine2, input.city, input.stateOrRegion, input.postalCode,
        input.countryCode, input.defaultCurrency, input.notes, status, input.paymentTerms,
        searchName, searchEmail, searchCompany, now, createdBy,
      ]
    );

    const customer = this.rowToModel(res.rows[0]);

    if (input.taxId) {
      await this.addTaxIdentifier(businessId, id, {
        type: "tax_id",
        value: input.taxId,
        isDefault: true,
      });
      customer.taxIdentifiers = await this.findTaxIdentifiers(id);
    } else {
      customer.taxIdentifiers = [];
    }

    await this.recordEvent(id, businessId, "created", createdBy, { source: "repository" });

    return customer;
  }

  async findMany(businessId: string, opts: CustomerSearchOptions = {}): Promise<Customer[]> {
    const { data } = await this.findManyWithCount(businessId, opts);
    return data;
  }

  async findManyWithCount(businessId: string, opts: CustomerSearchOptions = {}): Promise<PagedResult<Customer>> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    const sortBy = opts.sortBy ?? "name";
    const sortOrder = opts.sortOrder ?? "asc";
    const includeArchived = opts.includeArchived ?? false;
    const enrich = opts.enrich ?? false;

    const conditions: string[] = ["business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;

    if (!includeArchived) {
      conditions.push(`status != 'archived'`);
    }

    if (opts.search) {
      const pattern = `%${opts.search.toLowerCase()}%`;
      conditions.push(`(search_name ILIKE $${i} OR search_email ILIKE $${i} OR search_company ILIKE $${i} OR name ILIKE $${i})`);
      vals.push(pattern);
      i++;
    }

    if (opts.status) {
      conditions.push(`status = $${i}`);
      vals.push(opts.status);
      i++;
    }

    if (opts.email) {
      conditions.push(`email ILIKE $${i}`);
      vals.push(`%${opts.email.toLowerCase()}%`);
      i++;
    }

    if (opts.companyName) {
      conditions.push(`company_name ILIKE $${i}`);
      vals.push(`%${opts.companyName.toLowerCase()}%`);
      i++;
    }

    if (opts.countryCode) {
      conditions.push(`country_code = $${i}`);
      vals.push(opts.countryCode);
      i++;
    }

    if (opts.defaultCurrency) {
      conditions.push(`default_currency = $${i}`);
      vals.push(opts.defaultCurrency);
      i++;
    }

    const sortCol = SORTABLE_COLUMNS[sortBy] || SORTABLE_COLUMNS[sortBy.replace(/([A-Z])/g, "_$1").toLowerCase()] || "c.name";
    const sortDirection = sortOrder === "desc" ? "DESC" : "ASC";

    const selectCols = enrich
      ? `c.*, COALESCE(stats.invoice_count, 0) AS invoice_count, COALESCE(stats.total_outstanding, 0) AS total_outstanding, stats.most_recent_invoice_date`
      : "c.*";

    const joinClause = enrich
      ? `LEFT JOIN (
           SELECT customer_id,
                  COUNT(*) AS invoice_count,
                  COALESCE(SUM(COALESCE(amount_due, 0)), 0) AS total_outstanding,
                  MAX(created_at) AS most_recent_invoice_date
           FROM invoices
           WHERE business_id = $1
           GROUP BY customer_id
         ) stats ON stats.customer_id = c.id`
      : "";

    const dataRes = await query(
      `SELECT ${selectCols} FROM customers c ${joinClause}
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${sortCol} ${sortDirection}, c.created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      [...vals, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*) as total FROM customers c
       WHERE ${conditions.join(" AND ")}`,
      vals
    );

    const data = dataRes.rows.map((r) => {
      const customer = this.rowToModel(r);
      if (enrich) {
        (customer as EnrichedCustomer).invoiceCount = Number(r.invoice_count ?? 0);
        (customer as EnrichedCustomer).totalOutstanding = r.total_outstanding?.toString() ?? "0";
        (customer as EnrichedCustomer).mostRecentInvoiceDate = rowToDate(r.most_recent_invoice_date);
      }
      return customer;
    });

    const total = Number(countRes.rows[0]?.total ?? 0);

    return { data, total, limit, offset };
  }

  async findById(businessId: string, id: string): Promise<Customer> {
    const res = await query(
      `SELECT * FROM customers WHERE id = $1 AND business_id = $2`,
      [id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Customer ${id} not found`);
    const customer = this.rowToModel(res.rows[0]);
    customer.taxIdentifiers = await this.findTaxIdentifiers(id);
    return customer;
  }

  async findByEmail(businessId: string, email: string): Promise<Customer | null> {
    const res = await query(
      `SELECT * FROM customers WHERE business_id = $1 AND email ILIKE $2 AND status != 'archived'`,
      [businessId, email]
    );
    if (!res.rows.length) return null;
    const customer = this.rowToModel(res.rows[0]);
    customer.taxIdentifiers = await this.findTaxIdentifiers(res.rows[0].id);
    return customer;
  }

  async findByNameAndCompany(businessId: string, name: string, companyName: string): Promise<Customer | null> {
    const res = await query(
      `SELECT * FROM customers WHERE business_id = $1 AND name ILIKE $2 AND company_name ILIKE $3 AND status != 'archived'`,
      [businessId, name, companyName]
    );
    if (!res.rows.length) return null;
    const customer = this.rowToModel(res.rows[0]);
    customer.taxIdentifiers = await this.findTaxIdentifiers(res.rows[0].id);
    return customer;
  }

  async findByEmail(businessId: string, email: string): Promise<Customer | null> {
    const res = await query(
      `SELECT * FROM customers WHERE business_id = $1 AND email ILIKE $2`,
      [businessId, email]
    );
    if (!res.rows.length) return null;
    return this.rowToModel(res.rows[0]);
  }

  async findByNameAndCompany(businessId: string, name: string, companyName: string): Promise<Customer | null> {
    const res = await query(
      `SELECT * FROM customers WHERE business_id = $1 AND search_name = $2 AND search_company = $3`,
      [businessId, name.toLowerCase(), companyName.toLowerCase()]
    );
    if (!res.rows.length) return null;
    return this.rowToModel(res.rows[0]);
  }

  async findByPublicId(publicId: string): Promise<Customer | null> {
    const res = await query(`SELECT * FROM customers WHERE id = $1`, [publicId]);
    if (!res.rows.length) return null;
    return this.rowToModel(res.rows[0]);
  }

  async update(businessId: string, id: string, input: CustomerUpdateInput, updatedBy?: string): Promise<Customer> {
    const ALLOWED_COLUMNS = [
      "name", "company_name", "email", "phone", "tax_id",
      "address_line_1", "address_line_2", "city", "state_or_region", "postal_code",
      "country_code", "default_currency", "notes", "status", "payment_terms",
    ];

    const set: string[] = [];
    const vals: unknown[] = [businessId, id];
    let i = 3;

    const hasName = "name" in input && input.name !== undefined;
    const hasEmail = "email" in input && input.email !== undefined;
    const hasCompanyName = "companyName" in input && input.companyName !== undefined;

    for (const [key, val] of Object.entries(input)) {
      if (!ALLOWED_COLUMNS.includes(key)) continue;
      if (val === undefined) continue;
      set.push(`${key} = $${i++}`);
      vals.push(val ?? null);
    }

    if (hasName) {
      set.push(`search_name = $${i++}`);
      vals.push(input.name!.toLowerCase());
    }
    if (hasEmail) {
      set.push(`search_email = $${i++}`);
      vals.push(input.email!.toLowerCase());
    }
    if (hasCompanyName) {
      set.push(`search_company = $${i++}`);
      vals.push(input.companyName!.toLowerCase());
    }

    set.push(`version = version + 1`);
    set.push(`updated_at = NOW()`);
    if (updatedBy) {
      set.push(`updated_by = $${i++}`);
      vals.push(updatedBy);
    }

    if (set.length === 0) {
      const current = await this.findById(businessId, id);
      return current;
    }

    const res = await query(
      `UPDATE customers SET ${set.join(", ")}
       WHERE id = $2 AND business_id = $1 RETURNING *`,
      vals
    );
    if (!res.rows.length) throw new NotFoundError(`Customer ${id} not found`);

    await this.recordEvent(id, businessId, "updated", updatedBy, {
      fields: Object.keys(input).filter((k) => ALLOWED_COLUMNS.includes(k) && input[k as keyof CustomerUpdateInput] !== undefined),
    });

    const customer = this.rowToModel(res.rows[0]);
    customer.taxIdentifiers = await this.findTaxIdentifiers(id);
    return customer;
  }

  async archive(businessId: string, id: string, archivedBy?: string): Promise<Customer> {
    const now = new Date().toISOString();
    const res = await query(
      `UPDATE customers
       SET status = 'archived', archived_at = $3, archived_by = $4,
           version = version + 1, updated_at = NOW(), updated_by = $4
       WHERE id = $2 AND business_id = $1 AND status != 'archived'
       RETURNING *`,
      [businessId, id, now, archivedBy ?? null]
    );
    if (!res.rows.length) throw new NotFoundError(`Customer ${id} not found or already archived`);
    const customer = this.rowToModel(res.rows[0]);
    customer.taxIdentifiers = await this.findTaxIdentifiers(id);
    await this.recordEvent(id, businessId, "archived", archivedBy, { archivedAt: now });
    return customer;
  }

  async restore(businessId: string, id: string, restoredBy?: string): Promise<Customer> {
    const res = await query(
      `UPDATE customers
       SET status = 'active', archived_at = NULL, archived_by = NULL,
           version = version + 1, updated_at = NOW(), updated_by = $3
       WHERE id = $2 AND business_id = $1 AND status = 'archived'
       RETURNING *`,
      [businessId, id, restoredBy]
    );
    if (!res.rows.length) throw new NotFoundError(`Customer ${id} not found or not archived`);
    const customer = this.rowToModel(res.rows[0]);
    customer.taxIdentifiers = await this.findTaxIdentifiers(id);
    await this.recordEvent(id, businessId, "restored", restoredBy, {});
    return customer;
  }

  async delete(businessId: string, id: string): Promise<void> {
    const res = await query(
      `DELETE FROM customers WHERE id = $1 AND business_id = $2 RETURNING id`,
      [id, businessId]
    );
    if (res.rowCount === 0) throw new NotFoundError(`Customer ${id} not found`);
  }

  async countFinalizedInvoices(businessId: string, customerId: string): Promise<number> {
    const res = await query(
      `SELECT COUNT(*) as count FROM invoices
       WHERE customer_id = $1 AND business_id = $2 AND is_finalized = TRUE`,
      [customerId, businessId]
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  async findInvoicesByCustomer(
    businessId: string,
    customerId: string,
    opts: { limit?: number; offset?: number; status?: string } = {}
  ): Promise<PagedResult<CustomerInvoiceSummary>> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    const vals: unknown[] = [businessId, customerId];
    const conditions: string[] = ["business_id = $1", "customer_id = $2"];
    let i = 3;

    if (opts.status) {
      conditions.push(`status = $${i++}`);
      vals.push(opts.status);
    }

    const queryVals = [...vals];
    queryVals.push(limit, offset);

    const res = await query(
      `SELECT id, invoice_number, status, currency, total, amount_paid, amount_due,
              issue_date, due_date, finalized_at, created_at
       FROM invoices
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      queryVals
    );

    const countVals = [...vals];
    const countRes = await query(
      `SELECT COUNT(*) as total FROM invoices WHERE ${conditions.join(" AND ")}`,
      countVals
    );

    const data: CustomerInvoiceSummary[] = res.rows.map((r) => ({
      id: r.id as string,
      invoiceNumber: r.invoice_number as string | null,
      status: r.status as string,
      currency: r.currency as string,
      total: r.total as string,
      amountPaid: r.amount_paid as string,
      amountDue: r.amount_due as string,
      issueDate: rowToDate(r.issue_date),
      dueDate: rowToDate(r.due_date),
      finalizedAt: rowToDate(r.finalized_at),
      createdAt: rowToDate(r.created_at)!,
    }));

    const total = Number(countRes.rows[0]?.total ?? 0);
    return { data, total, limit, offset };
  }

  async addTaxIdentifier(
    businessId: string,
    customerId: string,
    input: { type: string; value: string; isDefault?: boolean }
  ): Promise<TaxIdentifier> {
    const res = await query(
      `INSERT INTO customer_tax_identifiers
       (customer_id, type, value, is_default, verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, FALSE, NOW(), NOW())
       RETURNING *`,
      [customerId, input.type, input.value, input.isDefault ?? false]
    );
    await this.recordEvent(customerId, businessId, "tax_id_added", undefined, {
      type: input.type,
      value: input.value,
    });
    return this.taxIdRowToModel(res.rows[0]);
  }

  async removeTaxIdentifier(customerId: string, taxIdId: string): Promise<void> {
    await query(`DELETE FROM customer_tax_identifiers WHERE id = $1 AND customer_id = $2`, [taxIdId, customerId]);
  }

  async findTaxIdentifiers(customerId: string): Promise<TaxIdentifier[]> {
    const res = await query(
      `SELECT * FROM customer_tax_identifiers WHERE customer_id = $1 ORDER BY is_default DESC, created_at ASC`,
      [customerId]
    );
    return res.rows.map((r) => this.taxIdRowToModel(r));
  }

  async findAddresses(customerId: string): Promise<CustomerAddress[]> {
    const res = await query(
      `SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at ASC`,
      [customerId]
    );
    return res.rows.map((r) => this.addressRowToModel(r));
  }

  async setBillingAddress(businessId: string, customerId: string, addressId: string): Promise<void> {
    await query(
      `UPDATE customers SET billing_address_id = $1 WHERE id = $2 AND business_id = $3`,
      [addressId, customerId, businessId]
    );
  }

  async setShippingAddress(businessId: string, customerId: string, addressId: string): Promise<void> {
    await query(
      `UPDATE customers SET shipping_address_id = $1 WHERE id = $2 AND business_id = $3`,
      [addressId, customerId, businessId]
    );
  }

  async recordEvent(
    customerId: string,
    businessId: string,
    eventType: string,
    actorId?: string | null,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await query(
      `INSERT INTO customer_events (customer_id, business_id, event_type, actor_id, actor_type, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [customerId, businessId, eventType, actorId, actorId ? "user" : "system", metadata ?? {}]
    );
  }

  async getEvents(businessId: string, customerId: string, limit = 100): Promise<unknown[]> {
    const res = await query(
      `SELECT e.* FROM customer_events e
       JOIN customers c ON c.id = e.customer_id
       WHERE e.customer_id = $1 AND e.business_id = $2
       ORDER BY e.created_at DESC LIMIT $3`,
      [customerId, businessId, limit]
    );
    return res.rows;
  }

  private rowToModel(r: Record<string, unknown>): Customer {
    const address: Address = {
      addressLine1: (r.address_line_1 as string | null) ?? "",
      addressLine2: r.address_line_2 as string | null,
      city: (r.city as string | null) ?? "",
      stateOrRegion: (r.state_or_region as string | null) ?? "",
      postalCode: (r.postal_code as string | null) ?? "",
      countryCode: (r.country_code as string | null) ?? "US",
      taxId: r.tax_id as string | null,
    };

    return {
      id: r.id as string,
      businessId: r.business_id as string,
      name: r.name as string,
      companyName: r.company_name as string | null,
      email: r.email as string | null,
      phone: r.phone as string | null,
      taxId: r.tax_id as string | null,
      address,
      countryCode: r.country_code as string | null,
      defaultCurrency: (r.default_currency as string | null) as Customer["defaultCurrency"],
      notes: r.notes as string | null,
      status: (r.status as CustomerStatus) ?? "active",
      paymentTerms: r.payment_terms ? Number(r.payment_terms) : null,
      taxIdentifiers: [],
      billingAddressId: r.billing_address_id as string | null,
      shippingAddressId: r.shipping_address_id as string | null,
      archivedAt: rowToDate(r.archived_at),
      archivedBy: r.archived_by as string | null,
      updatedBy: r.updated_by as string | null,
      version: Number(r.version ?? 1),
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }

  private addressRowToModel(r: Record<string, unknown>): CustomerAddress {
    return {
      id: r.id as string,
      customerId: r.customer_id as string,
      label: r.label as string | null,
      type: (r.type as "billing" | "shipping") ?? "billing",
      isDefault: Boolean(r.is_default),
      addressLine1: r.address_line_1 as string,
      addressLine2: r.address_line_2 as string | null,
      city: r.city as string,
      stateOrRegion: r.state_or_region as string | null,
      postalCode: r.postal_code as string | null,
      countryCode: r.country_code as string,
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }

  private taxIdRowToModel(r: Record<string, unknown>): TaxIdentifier {
    return {
      id: r.id as string,
      customerId: r.customer_id as string,
      type: r.type as string,
      value: r.value as string,
      isDefault: Boolean(r.is_default),
      verified: Boolean(r.verified),
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }
}

export const customerRepository = new CustomerRepository();

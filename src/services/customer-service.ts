import type { Customer, CustomerStatus, TaxIdentifier } from "../domain/models/index.js";
import type { CustomerInvoiceSummary, EnrichedCustomer } from "../repositories/customer.repo.js";
import type { Address } from "../domain/value-objects/address.js";
import { CustomerRepository } from "../repositories/customer.repo.js";
import { NotFoundError, ConflictError, BusinessLogicError, ValidationError } from "../domain/errors.js";
import type { CustomerCreateInput, CustomerUpdateInput, CustomerSearchQuery } from "../domain/schemas/customer.js";
import type { PagedResult } from "../repositories/helpers.js";
import { TERMINAL_STATUSES } from "../services/state-machine/invoice-state-machine.js";

export interface CustomerSummary {
  customer: Customer;
  invoices: CustomerInvoiceSummary[];
  totalInvoiceCount: number;
  finalizedInvoiceCount: number;
  totalBilled: string;
  totalPaid: string;
  totalOutstanding: string;
  totalOverdue: string;
}

export interface CustomerSearchInput {
  search?: string;
  status?: "active" | "inactive" | "archived";
  email?: string;
  companyName?: string;
  countryCode?: string;
  currency?: string;
  includeArchived?: boolean;
  enrich?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CustomerSearchResponse {
  data: Customer[];
  total: number;
  limit: number;
  offset: number;
}

export class CustomerService {
  constructor(private readonly repo: CustomerRepository) {}

  async create(input: CustomerCreateInput, businessId: string, userId?: string): Promise<Customer> {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError("Customer name is required");
    }

    const customer = await this.repo.create(businessId, {
      name: input.name.trim(),
      companyName: input.companyName?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      taxId: input.taxId?.trim() || null,
      addressLine1: input.addressLine1 || null,
      addressLine2: input.addressLine2 || null,
      city: input.city || null,
      stateOrRegion: input.stateOrRegion || null,
      postalCode: input.postalCode || null,
      countryCode: input.countryCode || null,
      defaultCurrency: input.defaultCurrency || null,
      notes: input.notes?.trim() || null,
      status: input.status ?? "active",
      paymentTerms: input.paymentTerms ?? null,
    }, userId);

    if (input.taxIdentifiers && input.taxIdentifiers.length > 0) {
      for (const ti of input.taxIdentifiers) {
        await this.repo.addTaxIdentifier(businessId, customer.id, {
          type: ti.type,
          value: ti.value,
          isDefault: ti.isDefault ?? false,
        });
      }
      customer.taxIdentifiers = await this.repo.findTaxIdentifiers(customer.id);
    }

    return customer;
  }

  async getById(businessId: string, id: string): Promise<Customer> {
    return this.repo.findById(businessId, id);
  }

  async update(
    businessId: string,
    id: string,
    input: CustomerUpdateInput,
    userId?: string
  ): Promise<Customer> {
    const existing = await this.repo.findById(businessId, id);

    if (existing.status === "archived") {
      throw new BusinessLogicError("Cannot update an archived customer; restore first");
    }

    const update: any = {};

    if (input.name !== undefined) {
      if (input.name.trim().length === 0) {
        throw new ValidationError("Customer name cannot be empty");
      }
      update.name = input.name.trim();
    }
    if (input.companyName !== undefined) update.companyName = input.companyName?.trim() ?? null;
    if (input.email !== undefined) update.email = input.email?.trim() ?? null;
    if (input.phone !== undefined) update.phone = input.phone?.trim() ?? null;
    if (input.taxId !== undefined) update.taxId = input.taxId?.trim() ?? null;
    if (input.status !== undefined) update.status = input.status;
    if (input.paymentTerms !== undefined) update.paymentTerms = input.paymentTerms;
    if (input.notes !== undefined) update.notes = input.notes?.trim() ?? null;
    if (input.addressLine1 !== undefined) update.addressLine1 = input.addressLine1 ?? null;
    if (input.addressLine2 !== undefined) update.addressLine2 = input.addressLine2 ?? null;
    if (input.city !== undefined) update.city = input.city ?? null;
    if (input.stateOrRegion !== undefined) update.stateOrRegion = input.stateOrRegion ?? null;
    if (input.postalCode !== undefined) update.postalCode = input.postalCode ?? null;
    if (input.countryCode !== undefined) update.countryCode = input.countryCode ?? null;
    if (input.defaultCurrency !== undefined) update.defaultCurrency = input.defaultCurrency ?? null;

    if (!input.taxId) {
      const hasExistingTaxId = existing.taxId || (existing.taxIdentifiers?.some((t) => t.type === "tax_id"));
      if (hasExistingTaxId && "taxId" in input && input.taxId === null) {
        const existingIds = existing.taxIdentifiers ?? [];
        for (const ti of existingIds.filter((t) => t.type === "tax_id")) {
          await this.repo.removeTaxIdentifier(existing.id, ti.id);
        }
      }
    }

    return this.repo.update(businessId, id, update, userId);
  }

  async archive(businessId: string, id: string, userId?: string): Promise<Customer> {
    const customer = await this.repo.findById(businessId, id);

    if (customer.status === "archived") {
      throw new ConflictError(`Customer ${id} is already archived`);
    }

    const finalizedCount = await this.repo.countFinalizedInvoices(businessId, id);
    if (finalizedCount > 0) {
      await this.repo.archive(businessId, id, userId);
      const updated = await this.repo.findById(businessId, id);
      return updated;
    }

    return this.repo.archive(businessId, id, userId);
  }

  async restore(businessId: string, id: string, userId?: string): Promise<Customer> {
    const customer = await this.repo.findById(businessId, id);

    if (customer.status !== "archived") {
      throw new ConflictError(`Customer ${id} is not archived`);
    }

    return this.repo.restore(businessId, id, userId);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const customer = await this.repo.findById(businessId, id);

    if (customer.status === "archived") {
      throw new ConflictError("Archived customers cannot be hard-deleted; restore first if needed");
    }

    const finalizedCount = await this.repo.countFinalizedInvoices(businessId, id);
    if (finalizedCount > 0) {
      throw new BusinessLogicError(
        "Cannot delete a customer with finalized invoices; archive instead"
      );
    }

    await this.repo.delete(businessId, id);
  }

  async search(businessId: string, opts: CustomerSearchInput): Promise<CustomerSearchResponse> {
    const result = await this.repo.findManyWithCount(businessId, {
      search: opts.search,
      status: opts.status,
      email: opts.email,
      companyName: opts.companyName,
      countryCode: opts.countryCode,
      defaultCurrency: opts.currency,
      includeArchived: opts.includeArchived,
      enrich: opts.enrich,
      limit: opts.limit,
      offset: opts.offset,
      sortBy: opts.sortBy ?? "name",
      sortOrder: opts.sortOrder ?? "asc",
    });

    return {
      data: result.data,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    };
  }

  async searchEnriched(businessId: string, opts: CustomerSearchInput): Promise<PagedResult<EnrichedCustomer>> {
    return this.repo.findManyWithCount(businessId, {
      ...opts,
      enrich: true,
    }) as Promise<PagedResult<EnrichedCustomer>>;
  }

  async getInvoiceHistory(
    businessId: string,
    customerId: string,
    opts: { limit?: number; offset?: number; status?: string } = {}
  ): Promise<PagedResult<CustomerInvoiceSummary>> {
    const exists = await this.repo.findById(businessId, customerId);
    return this.repo.findInvoicesByCustomer(businessId, exists.id, opts);
  }

  async getSummary(businessId: string, id: string): Promise<CustomerSummary> {
    const customer = await this.repo.findById(businessId, id);
    const { data: invoices, total } = await this.repo.findInvoicesByCustomer(businessId, id, { limit: 1000 });

    let totalBilled = 0;
    let totalPaid = 0;
    let totalOverdue = 0;

    const now = new Date();

    for (const inv of invoices) {
      totalBilled += parseFloat(inv.total);
      totalPaid += parseFloat(inv.amountPaid);

      // Overdue = open invoices (not paid, not void/cancelled) past due with balance outstanding
      if (!TERMINAL_STATUSES.includes(inv.status as any) && inv.status !== "overdue") {
        const amountDue = parseFloat(inv.amountDue);
        const isPastDue = inv.dueDate && now >= new Date(inv.dueDate);
        if (amountDue > 0 && isPastDue) {
          totalOverdue += amountDue;
        }
      }
      if (inv.status === "overdue") {
        const amountDue = parseFloat(inv.amountDue);
        if (amountDue > 0) {
          totalOverdue += amountDue;
        }
      }
    }

    const finalizedCount = invoices.filter((i) => i.finalizedAt !== null).length;

    return {
      customer,
      invoices,
      totalInvoiceCount: total,
      finalizedInvoiceCount: finalizedCount,
      totalBilled: totalBilled.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalOutstanding: (totalBilled - totalPaid).toFixed(2),
      totalOverdue: totalOverdue.toFixed(2),
    };
  }

  async addTaxIdentifier(
    businessId: string,
    customerId: string,
    input: { type: string; value: string; isDefault?: boolean }
  ): Promise<TaxIdentifier> {
    await this.repo.findById(businessId, customerId);
    return this.repo.addTaxIdentifier(businessId, customerId, input);
  }

  async removeTaxIdentifier(businessId: string, customerId: string, taxIdId: string): Promise<void> {
    await this.repo.findById(businessId, customerId);
    await this.repo.removeTaxIdentifier(customerId, taxIdId);
  }

  async getTaxIdentifiers(businessId: string, customerId: string): Promise<TaxIdentifier[]> {
    await this.repo.findById(businessId, customerId);
    return this.repo.findTaxIdentifiers(customerId);
  }

  async getAddresses(businessId: string, customerId: string) {
    await this.repo.findById(businessId, customerId);
    return this.repo.findAddresses(customerId);
  }

  async getEvents(businessId: string, customerId: string, limit = 100): Promise<unknown[]> {
    await this.repo.findById(businessId, customerId);
    return this.repo.getEvents(businessId, customerId, limit);
  }

  async validateCustomerExists(businessId: string, customerId: string): Promise<Customer> {
    return this.repo.findById(businessId, customerId);
  }

  async importFromCsv(
    businessId: string,
    csv: string,
    userId?: string
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      return { imported: 0, skipped: 0, errors: [] };
    }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());

    const colIdx = (name: string) => header.indexOf(name);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
      const rowNum = rowIdx + 1;
      const cols = lines[rowIdx].split(",").map((c) => c.trim());

      const getValue = (name: string) => {
        const idx = colIdx(name);
        return idx >= 0 ? cols[idx] : "";
      };

      const name = getValue("name");
      if (!name) {
        errors.push(`Row ${rowNum}: missing name`);
        skipped++;
        continue;
      }

      try {
        const email = getValue("email") || undefined;
        await this.create(
          {
            name,
            email: email ? email : undefined,
            companyName: getValue("company") || undefined,
            phone: getValue("phone") || undefined,
            taxId: getValue("tax_id") || undefined,
            addressLine1: getValue("address_line_1") || undefined,
            addressLine2: getValue("address_line_2") || undefined,
            city: getValue("city") || undefined,
            stateOrRegion: getValue("state_or_region") || undefined,
            postalCode: getValue("postal_code") || undefined,
            countryCode: getValue("country_code") || "US",
          },
          businessId,
          userId
        );
        imported++;
      } catch (err: any) {
        errors.push(`Row ${rowNum}: ${err.message || "import failed"}`);
        skipped++;
      }
    }

    return { imported, skipped, errors };
  }
}

export const customerService = new CustomerService(new CustomerRepository());

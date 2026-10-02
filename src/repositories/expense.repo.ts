import { Decimal } from "decimal.js";
import { query } from "../db/pool.js";
import type { Expense, ExpenseSummary, ExpenseCategory } from "../domain/models/expense.js";
import type { ExpenseCategory as ExpenseCategoryType } from "../domain/models/expense.js";
import type { PagedResult } from "./helpers.js";
import { rowToDate } from "./helpers.js";
import { NotFoundError, BusinessLogicError } from "../domain/errors.js";

export interface ExpenseSearchOpts {
  customerId?: string;
  projectId?: string;
  userId?: string;
  category?: ExpenseCategoryType;
  isBillable?: boolean;
  isReimbursable?: boolean;
  isReimbursed?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  vendor?: string;
  customerName?: string;
  projectName?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ExpenseInput {
  customerId?: string | null;
  projectId?: string | null;
  description: string;
  amount: Decimal.Value;
  taxAmount?: Decimal.Value;
  currency?: string;
  category?: ExpenseCategoryType;
  expenseDate?: string | Date;
  paymentMethod?: string;
  vendor?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
  isBillable?: boolean;
  isReimbursable?: boolean;
}

export interface ExpenseUpdateInput {
  customerId?: string | null;
  projectId?: string | null;
  invoiceId?: string | null;
  description?: string;
  amount?: Decimal.Value;
  taxAmount?: Decimal.Value;
  currency?: string;
  category?: ExpenseCategoryType;
  expenseDate?: string | Date;
  paymentMethod?: string;
  vendor?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
  isBillable?: boolean;
  isReimbursable?: boolean;
  isReimbursed?: boolean;
}

const SORTABLE_COLUMNS: Record<string, string> = {
  expense_date: "expense_date",
  amount: "amount",
  created_at: "created_at",
  category: "category",
};

export class ExpenseRepository {
  async create(businessId: string, input: ExpenseInput, userId?: string | null): Promise<Expense> {
    const amount = new Decimal(input.amount);
    if (amount.isNegative()) {
      throw new BusinessLogicError("Expense amount must be >= 0");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const expenseDate = input.expenseDate
      ? input.expenseDate instanceof Date
        ? input.expenseDate.toISOString().split("T")[0]
        : input.expenseDate
      : new Date().toISOString().split("T")[0];

     const res = await query(
        `INSERT INTO expenses (
          id, business_id, user_id, customer_id, project_id, invoice_id,
          description, amount, tax_amount, currency, category, expense_date,
          payment_method, vendor, receipt_url, notes, is_billable, is_reimbursable, is_reimbursed,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, NULL,
          $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17, false,
          $18, $18
        ) RETURNING *`,
        [
          id,
          businessId,
          userId ?? null,
          input.customerId ?? null,
          input.projectId ?? null,
          input.description,
          amount.toFixed(2),
          input.taxAmount !== undefined ? new Decimal(input.taxAmount).toFixed(2) : "0.00",
          input.currency ?? "USD",
          input.category ?? "other",
          expenseDate,
          input.paymentMethod ?? "cash",
          input.vendor ?? null,
          input.receiptUrl ?? null,
          input.notes ?? null,
          input.isBillable ?? false,
          input.isReimbursable ?? false,
          now,
        ]
     );

    return this.rowToModel(res.rows[0]);
  }

  async findById(businessId: string, id: string): Promise<Expense> {
    const res = await query(
      `SELECT e.*, 
          c.name as customer_name, 
          p.name as project_name,
          i.invoice_number,
          i.status as invoice_status
       FROM expenses e
       LEFT JOIN customers c ON c.id = e.customer_id AND c.business_id = e.business_id
       LEFT JOIN projects p ON p.id = e.project_id AND p.business_id = e.business_id
       LEFT JOIN invoices i ON i.id = e.invoice_id AND i.business_id = e.business_id
       WHERE e.id = $1 AND e.business_id = $2`,
      [id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Expense ${id} not found`);
    return this.rowToModel(res.rows[0]);
  }

  async findMany(businessId: string, opts: ExpenseSearchOpts = {}): Promise<PagedResult<Expense>> {
    const limit = Math.min(opts.limit ?? 50, 500);
    const offset = opts.offset ?? 0;
    const sortBy = opts.sortBy ?? "expense_date";
    const sortOrder = opts.sortOrder ?? "desc";

    const conditions: string[] = ["e.business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;

    if (opts.customerId) {
      conditions.push(`customer_id = $${i++}`);
      vals.push(opts.customerId);
    }
    if (opts.projectId) {
      conditions.push(`project_id = $${i++}`);
      vals.push(opts.projectId);
    }
    if (opts.userId) {
      conditions.push(`user_id = $${i++}`);
      vals.push(opts.userId);
    }
    if (opts.category) {
      conditions.push(`category = $${i++}`);
      vals.push(opts.category);
    }
     if (opts.isBillable !== undefined) {
      conditions.push(`is_billable = $${i++}`);
      vals.push(opts.isBillable);
    }
    if (opts.isReimbursable !== undefined) {
      conditions.push(`is_reimbursable = $${i++}`);
      vals.push(opts.isReimbursable);
    }
    if (opts.isReimbursed !== undefined) {
      conditions.push(`is_reimbursed = $${i++}`);
      vals.push(opts.isReimbursed);
    }
    if (opts.dateFrom) {
      conditions.push(`expense_date >= $${i++}::date`);
      vals.push(opts.dateFrom.toISOString().split("T")[0]);
    }
    if (opts.dateTo) {
      conditions.push(`expense_date <= $${i++}::date`);
      vals.push(opts.dateTo.toISOString().split("T")[0]);
    }
    if (opts.minAmount !== undefined) {
      conditions.push(`amount >= $${i++}::numeric`);
      vals.push(opts.minAmount);
    }
    if (opts.maxAmount !== undefined) {
      conditions.push(`amount <= $${i++}::numeric`);
      vals.push(opts.maxAmount);
    }
     if (opts.search) {
       conditions.push(`(e.description ILIKE $${i} OR c.name ILIKE $${i} OR p.name ILIKE $${i})`);
       vals.push(`%${opts.search}%`);
       i++;
     }
     if (opts.vendor) {
       conditions.push(`vendor ILIKE $${i++}`);
       vals.push(`%${opts.vendor}%`);
     }
     if (opts.customerName) {
       conditions.push(`c.name ILIKE $${i++}`);
       vals.push(`%${opts.customerName}%`);
     }
     if (opts.projectName) {
       conditions.push(`p.name ILIKE $${i++}`);
       vals.push(`%${opts.projectName}%`);
     }

    const sortCol = SORTABLE_COLUMNS[sortBy] || "expense_date";
    const sortDir = sortOrder === "desc" ? "DESC" : "ASC";

    const dataRes = await query(
      `SELECT e.*, 
          c.name as customer_name, 
          p.name as project_name,
          i.invoice_number,
          COUNT(*) OVER() AS total_count
       FROM expenses e
       LEFT JOIN customers c ON c.id = e.customer_id AND c.business_id = e.business_id
       LEFT JOIN projects p ON p.id = e.project_id AND p.business_id = e.business_id
       LEFT JOIN invoices i ON i.id = e.invoice_id AND i.business_id = e.business_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY ${sortCol} ${sortDir}, created_at DESC
        LIMIT $${i++} OFFSET $${i}`,
      [...vals, limit, offset]
    );

    const total = dataRes.rows.length ? Number(dataRes.rows[0]?.total_count ?? 0) : 0;
    const data = dataRes.rows.map((r) => this.rowToModel(r));
    return { data, total, limit, offset };
  }

  async update(businessId: string, id: string, input: ExpenseUpdateInput): Promise<Expense> {
    const existing = await this.findById(businessId, id);

    const updates: string[] = [];
    const vals: unknown[] = [businessId, id];
    let i = 3;

    const setField = (col: string, value: unknown) => {
      updates.push(`${col} = $${i++}`);
      vals.push(value);
    };

     if (input.customerId !== undefined) setField("customer_id", input.customerId);
     if (input.projectId !== undefined) setField("project_id", input.projectId);
     if (input.invoiceId !== undefined) setField("invoice_id", input.invoiceId);
     if (input.description !== undefined) setField("description", input.description);
     if (input.amount !== undefined) {
      const amount = new Decimal(input.amount);
      if (amount.isNegative()) {
        throw new BusinessLogicError("Expense amount must be >= 0");
      }
      setField("amount", amount.toFixed(2));
    }
    if (input.taxAmount !== undefined) {
      const tax = new Decimal(input.taxAmount);
      if (tax.isNegative()) {
        throw new BusinessLogicError("Expense tax amount must be >= 0");
      }
      setField("tax_amount", tax.toFixed(2));
    }
    if (input.currency !== undefined) setField("currency", input.currency);
    if (input.category !== undefined) setField("category", input.category);
    if (input.expenseDate !== undefined) {
      const d = input.expenseDate instanceof Date
        ? input.expenseDate.toISOString().split("T")[0]
        : input.expenseDate;
      setField("expense_date", d);
    }
     if (input.paymentMethod !== undefined) setField("payment_method", input.paymentMethod);
     if (input.vendor !== undefined) setField("vendor", input.vendor);
     if (input.receiptUrl !== undefined) setField("receipt_url", input.receiptUrl);
    if (input.notes !== undefined) setField("notes", input.notes);
    if (input.isBillable !== undefined) setField("is_billable", input.isBillable);
    if (input.isReimbursable !== undefined) setField("is_reimbursable", input.isReimbursable);
    if (input.isReimbursed !== undefined) setField("is_reimbursed", input.isReimbursed);

    if (updates.length === 0) return existing;

    updates.push(`updated_at = NOW()`);

    const res = await query(
      `UPDATE expenses SET ${updates.join(", ")} WHERE business_id = $1 AND id = $2 RETURNING *`,
      vals
    );

    return this.rowToModel(res.rows[0]);
  }

  async delete(businessId: string, id: string): Promise<void> {
    await this.findById(businessId, id);
    await query(`DELETE FROM expenses WHERE id = $1 AND business_id = $2`, [id, businessId]);
  }

  async getSummary(businessId: string, opts: ExpenseSearchOpts = {}): Promise<ExpenseSummary> {
    const conditions: string[] = ["e.business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;

    if (opts.customerId) {
      conditions.push(`e.customer_id = $${i++}`);
      vals.push(opts.customerId);
    }
    if (opts.projectId) {
      conditions.push(`e.project_id = $${i++}`);
      vals.push(opts.projectId);
    }
    if (opts.category) {
      conditions.push(`e.category = $${i++}`);
      vals.push(opts.category);
    }
    if (opts.dateFrom) {
      conditions.push(`e.expense_date >= $${i++}::date`);
      vals.push(opts.dateFrom.toISOString().split("T")[0]);
    }
     if (opts.dateTo) {
       conditions.push(`e.expense_date <= $${i++}::date`);
       vals.push(opts.dateTo.toISOString().split("T")[0]);
     }
     if (opts.vendor) {
       conditions.push(`e.vendor ILIKE $${i++}`);
       vals.push(`%${opts.vendor}%`);
     }
     if (opts.customerName) {
       conditions.push(`c.name ILIKE $${i++}`);
       vals.push(`%${opts.customerName}%`);
     }
     if (opts.projectName) {
       conditions.push(`p.name ILIKE $${i++}`);
       vals.push(`%${opts.projectName}%`);
     }

      const res = await query(
       `SELECT
            COALESCE(SUM(e.amount), 0) as total_amount,
           COALESCE(SUM(CASE WHEN e.is_billable THEN e.amount ELSE 0 END), 0) as billable_amount,
           COALESCE(SUM(CASE WHEN e.is_reimbursable THEN e.amount ELSE 0 END), 0) as reimbursable_amount,
           COALESCE(SUM(CASE WHEN e.is_reimbursed THEN e.amount ELSE 0 END), 0) as reimbursed_amount,
           COALESCE(SUM(CASE WHEN e.is_billable AND NOT e.is_reimbursed THEN e.amount ELSE 0 END), 0) as non_reimbursed_billable,
           COUNT(*) as count,
            MAX(e.currency) as currency
         FROM expenses e
         LEFT JOIN customers c ON c.id = e.customer_id AND c.business_id = e.business_id
         LEFT JOIN projects p ON p.id = e.project_id AND p.business_id = e.business_id
         WHERE ${conditions.join(" AND ")}`,
        vals
      );

    const r = res.rows[0];
    return {
      totalAmount: new Decimal(r.total_amount ?? 0).toFixed(2),
      billableAmount: new Decimal(r.billable_amount ?? 0).toFixed(2),
      reimbursableAmount: new Decimal(r.reimbursable_amount ?? 0).toFixed(2),
      reimbursedAmount: new Decimal(r.reimbursed_amount ?? 0).toFixed(2),
      nonReimbursedBillable: new Decimal(r.non_reimbursed_billable ?? 0).toFixed(2),
      count: Number(r.count ?? 0),
      currency: (r.currency as Expense["currency"]) ?? "USD",
      periodStart: opts.dateFrom ? new Date(opts.dateFrom) : null,
      periodEnd: opts.dateTo ? new Date(opts.dateTo) : null,
    };
  }

  async getCategoryBreakdown(
    businessId: string,
    opts: ExpenseSearchOpts = {}
  ): Promise<Array<{ category: ExpenseCategory; total: string; count: number; percentage: number }>> {
    const conditions: string[] = ["business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;

    if (opts.dateFrom) {
      conditions.push(`expense_date >= $${i++}::date`);
      vals.push(opts.dateFrom.toISOString().split("T")[0]);
    }
    if (opts.dateTo) {
      conditions.push(`expense_date <= $${i++}::date`);
      vals.push(opts.dateTo.toISOString().split("T")[0]);
    }

    const res = await query(
      `SELECT
         category,
         COALESCE(SUM(amount), 0) as total,
         COUNT(*) as count
       FROM expenses
       WHERE ${conditions.join(" AND ")}
       GROUP BY category
       ORDER BY total DESC`,
      vals
    );

    const grandTotal = res.rows.reduce(
      (sum, r) => sum + Number(r.total ?? 0),
      0
    );

    return res.rows.map((r) => ({
      category: r.category as ExpenseCategory,
      total: new Decimal(r.total ?? 0).toFixed(2),
      count: Number(r.count ?? 0),
      percentage: grandTotal > 0 ? Number(((Number(r.total ?? 0) / grandTotal) * 100).toFixed(1)) : 0,
    }));
  }

  async getMonthlyTrend(
    businessId: string,
    months: number = 12,
    opts: ExpenseSearchOpts = {}
  ): Promise<Array<{ period: string; amount: string; count: number }>> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const conditions: string[] = ["business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;

    const dateFrom = opts.dateFrom ?? startDate;
    const dateTo = opts.dateTo ?? now;

    conditions.push(`expense_date >= $${i++}::date`);
    vals.push(dateFrom.toISOString().split("T")[0]);
    conditions.push(`expense_date <= $${i++}::date`);
    vals.push(dateTo.toISOString().split("T")[0]);

    const res = await query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', expense_date), 'YYYY-MM') as period,
         COALESCE(SUM(amount), 0) as total,
         COUNT(*) as count
       FROM expenses
       WHERE ${conditions.join(" AND ")}
       GROUP BY DATE_TRUNC('month', expense_date)
       ORDER BY period ASC`,
      vals
    );

    return res.rows.map((r) => ({
      period: r.period as string,
      amount: new Decimal(r.total ?? 0).toFixed(2),
      count: Number(r.count ?? 0),
    }));
  }

  private rowToModel(r: Record<string, unknown>): Expense {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      userId: r.user_id as string | null,
      customerId: r.customer_id as string | null,
      projectId: r.project_id as string | null,
      invoiceId: r.invoice_id as string | null,
      description: r.description as string,
      amount: r.amount as string,
      taxAmount: r.tax_amount ? new Decimal(r.tax_amount as string | number).toFixed(2) : "0.00",
      currency: (r.currency as string) as Expense["currency"],
      category: (r.category as ExpenseCategory) || "other",
      expenseDate: rowToDate(r.expense_date) ?? new Date(),
      paymentMethod: (r.payment_method as string) || "cash",
      vendor: r.vendor as string | null,
      receiptUrl: r.receipt_url as string | null,
      notes: r.notes as string | null,
      isBillable: Boolean(r.is_billable),
      isReimbursable: Boolean(r.is_reimbursable),
      isReimbursed: Boolean(r.is_reimbursed),
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
      customerName: r.customer_name as string | null,
      projectName: r.project_name as string | null,
      invoiceNumber: r.invoice_number as string | null,
      invoiceStatus: r.invoice_status as string | null,
    };
  }

  async getCategories(businessId: string): Promise<string[]> {
    const res = await query(
      `SELECT DISTINCT category FROM expenses WHERE business_id = $1 AND category IS NOT NULL`,
      [businessId]
    );
    return res.rows.map((r: { category: string }) => r.category);
  }

  async getCustomCategories(businessId: string) {
    const res = await query(
      `SELECT id, business_id, name, icon, color, sort_order, is_active, created_at, updated_at
       FROM expense_custom_categories
       WHERE business_id = $1 AND is_active = true
       ORDER BY sort_order ASC, name ASC`,
      [businessId]
    );
    return res.rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      businessId: r.business_id as string,
      name: r.name as string,
      icon: r.icon as string | null,
      color: r.color as string | null,
      sortOrder: Number(r.sort_order ?? 0),
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async createCustomCategory(
    businessId: string,
    input: { name: string; icon?: string | null; color?: string | null; sortOrder?: number }
  ) {
    const res = await query(
      `INSERT INTO expense_custom_categories (business_id, name, icon, color, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, business_id, name, icon, color, sort_order, is_active, created_at, updated_at`,
      [businessId, input.name, input.icon ?? null, input.color ?? null, input.sortOrder ?? 0]
    );
    const r = res.rows[0];
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      name: r.name as string,
      icon: r.icon as string | null,
      color: r.color as string | null,
      sortOrder: Number(r.sort_order ?? 0),
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async updateCustomCategory(
    businessId: string,
    categoryId: string,
    input: { name?: string; icon?: string | null; color?: string | null; sortOrder?: number; isActive?: boolean }
  ) {
    const setClauses: string[] = [];
    const vals: unknown[] = [businessId, categoryId];
    let i = 3;
    if (input.name !== undefined) {
      setClauses.push(`name = $${i++}`);
      vals.push(input.name);
    }
    if (input.icon !== undefined) {
      setClauses.push(`icon = $${i++}`);
      vals.push(input.icon);
    }
    if (input.color !== undefined) {
      setClauses.push(`color = $${i++}`);
      vals.push(input.color);
    }
    if (input.sortOrder !== undefined) {
      setClauses.push(`sort_order = $${i++}`);
      vals.push(input.sortOrder);
    }
    if (input.isActive !== undefined) {
      setClauses.push(`is_active = $${i++}`);
      vals.push(input.isActive);
    }
    vals.push(businessId, categoryId);
    const res = await query(
      `UPDATE expense_custom_categories
       SET ${setClauses.join(", ")}
       WHERE business_id = $1 AND id = $2
       RETURNING id, business_id, name, icon, color, sort_order, is_active, created_at, updated_at`,
      vals
    );
    if (res.rows.length === 0) throw new NotFoundError("Custom category not found");
    const r = res.rows[0];
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      name: r.name as string,
      icon: r.icon as string | null,
      color: r.color as string | null,
      sortOrder: Number(r.sort_order ?? 0),
      isActive: Boolean(r.is_active),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async deleteCustomCategory(businessId: string, categoryId: string): Promise<void> {
    const res = await query(
      `DELETE FROM expense_custom_categories WHERE business_id = $1 AND id = $2 RETURNING id`,
      [businessId, categoryId]
    );
    if (res.rows.length === 0) throw new NotFoundError("Custom category not found");
  }
}

export const expenseRepository = new ExpenseRepository();

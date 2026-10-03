import { Decimal } from "decimal.js";
import { query } from "../db/pool.js";
import { reportsCache, invalidateReportsCache } from "./reports-cache.js";
import { rowToDate, toDecimal, type PagedResult } from "../repositories/helpers.js";

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  projectId?: string;
  status?: string | string[];
  category?: string;
  vendor?: string;
  search?: string;
  provider?: string;
  paymentStatus?: string | string[];
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface DashboardSummary {
  totalRevenue: string;
  totalOutstanding: string;
  paymentsReceived: string;
  netIncome: string;
  totalOverdue: string;
  draftCount: number;
  overdueCount: number;
  sentCount: number;
  paidCount: number;
  totalInvoices: number;
  currency: string;
}

export interface RevenueByPeriod {
  period: string;
  invoiced: string;
  paid: string;
  count: number;
  currency: string;
}

export interface RevenueByStatus {
  status: string;
  count: number;
  total_amount: string;
  paid_amount: string;
  outstanding_amount: string;
  currency: string;
}

export interface RevenueByCustomer {
  customerId: string;
  customerName: string | null;
  invoiceCount: number;
  invoiced: string;
  paid: string;
  outstanding: string;
  currency: string;
}

export interface InvoiceReportItem {
  id: string;
  invoice_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  status: string;
  currency: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  issue_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  days_overdue: number;
  created_at: string;
}

export interface InvoiceReportSummary {
  totalInvoices: number;
  totalInvoiced: string;
  totalPaid: string;
  totalOutstanding: string;
  totalOverdue: string;
  currency: string;
  statusBreakdown: Array<{ status: string; count: number; amount: string }>;
  byPeriod: RevenueByPeriod[];
}

export interface PaymentReportItem {
  id: string;
  invoice_id: string;
  invoice_number: string | null;
  customer_name: string | null;
  amount: string;
  currency: string;
  status: string;
  method: string | null;
  provider: string;
  paid_at: string | null;
  created_at: string;
}

export interface PaymentReportSummary {
  totalPayments: number;
  totalAmount: string;
  totalPaid: string;
  totalPending: string;
  totalFailed: string;
  totalRefunded: string;
  paymentsThisMonth: string;
  currency: string;
  providerBreakdown: Array<{ provider: string; count: number; amount: string }>;
  methodBreakdown: Array<{ method: string; count: number; amount: string }>;
  dailyTrend: Array<{ date: string; amount: string; count: number }>;
}

export interface ClientReportItem {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  country_code: string | null;
  invoice_count: number;
  total_invoiced: string;
  total_paid: string;
  total_outstanding: string;
  last_invoice_date: string | null;
  currency: string;
}

export interface ClientReportSummary {
  totalClients: number;
  totalInvoiced: string;
  totalPaid: string;
  totalOutstanding: string;
  averageInvoiceValue: string;
  currency: string;
}

export interface TaxSummaryItem {
  period: string;
  tax_collected: string;
  taxable_amount: string;
  invoice_count: number;
  currency: string;
}

export interface TaxSummaryBreakdown {
  rate: string;
  name: string;
  taxable_basis: string;
  tax_collected: string;
  invoice_count: number;
  currency: string;
}

export interface TaxSummaryReport {
  summary: {
    totalTaxCollected: string;
    totalTaxableAmount: string;
    periodStart: string | null;
    periodEnd: string | null;
    currency: string;
  };
  byPeriod: TaxSummaryItem[];
  byRate: TaxSummaryBreakdown[];
}

export interface ProfitLossReport {
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  revenue: {
    total: string;
    count: number;
    byMonth: Array<{ period: string; amount: string; count: number }>;
  };
  netIncome: string;
  grossMargin: number;
}

export interface ReportData<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export class ReportsService {
  private buildDateCondition(
    paramPrefix: string,
    conditions: string[],
    vals: unknown[],
    startIdx: number
  ): number {
    let i = startIdx;
    return i;
  }

  private addDateFilters(conditions: string[], vals: unknown[], idx: number, filters: ReportFilters, tableAlias: string): number {
    let i = idx;
    const dateCol = filters.dateFrom || filters.dateTo ? "issue_date" : null;
    if (filters.dateFrom && dateCol) {
      conditions.push(`${tableAlias}.${dateCol} >= $${i}`);
      vals.push(filters.dateFrom);
      i++;
    }
    if (filters.dateTo && dateCol) {
      conditions.push(`${tableAlias}.${dateCol} <= $${i}`);
      vals.push(filters.dateTo);
      i++;
    }
    return i;
  }

  async getDashboardSummary(businessId: string): Promise<DashboardSummary> {
    const cacheKey = `dashboard-summary:${businessId}`;
    const cached = reportsCache.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [summary, currencyRow] = await Promise.all([
      query(
        `SELECT
           COUNT(*) AS total_invoices,
           COALESCE(SUM(total), 0) AS total_revenue,
           SUM(CASE WHEN amount_due > 0 AND status NOT IN ('draft','cancelled','void') THEN amount_due ELSE 0 END) AS total_outstanding,
           SUM(CASE WHEN (status = 'overdue' OR (due_date < NOW() AND amount_due > 0)) AND amount_due > 0 AND status NOT IN ('draft','cancelled','void','paid') THEN amount_due ELSE 0 END) AS total_overdue,
           SUM(CASE WHEN amount_paid > 0 AND paid_at >= $2 THEN amount_paid ELSE 0 END) AS payments_received,
           COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draft_count,
           COUNT(CASE WHEN status = 'sent' THEN 1 END) AS sent_count,
           COUNT(CASE WHEN status = 'paid' THEN 1 END) AS paid_count,
           COUNT(CASE WHEN (status = 'overdue' OR (due_date < NOW() AND amount_due > 0)) AND amount_due > 0 AND status NOT IN ('draft','cancelled','void','paid') THEN 1 END) AS overdue_count
         FROM invoices WHERE business_id = $1`,
        [businessId, monthStart.toISOString()]
      ),
      query(
        `SELECT COALESCE(MAX(currency), 'USD') AS currency FROM invoices WHERE business_id = $1`,
        [businessId]
      ),
    ]);

    const row = summary.rows[0];
    const totalRevenue = String(row.total_revenue ?? "0");
    const paymentsReceived = String(row.payments_received ?? "0");

    const result: DashboardSummary = {
      totalRevenue,
      totalOutstanding: String(row.total_outstanding ?? "0"),
      paymentsReceived,
      netIncome: new Decimal(totalRevenue).toFixed(2),
      totalOverdue: String(row.total_overdue ?? "0"),
      draftCount: Number(row.draft_count ?? 0),
      overdueCount: Number(row.overdue_count ?? 0),
      sentCount: Number(row.sent_count ?? 0),
      paidCount: Number(row.paid_count ?? 0),
      totalInvoices: Number(row.total_invoices ?? 0),
      currency: (row.currency ?? currencyRow.rows[0]?.currency ?? "USD"),
    };

    reportsCache.set(cacheKey, result);
    return result;
  }

  async getRevenueReport(
    businessId: string,
    filters: ReportFilters = {}
  ): Promise<{
    summary: DashboardSummary;
    byStatus: RevenueByStatus[];
    byPeriod: RevenueByPeriod[];
    byCustomer: RevenueByCustomer[];
  }> {
    const cacheKey = `revenue-report:${businessId}:${JSON.stringify(filters)}`;
    const cached = reportsCache.get(cacheKey);
    if (cached) return cached;

    const summary = await this.getDashboardSummary(businessId);

    const [byStatus, byPeriod, byCustomer] = await Promise.all([
      query(
        `SELECT status, COUNT(*) as count,
                COALESCE(SUM(total), 0) as total_amount,
                COALESCE(SUM(amount_paid), 0) as paid_amount,
                COALESCE(SUM(amount_due), 0) as outstanding_amount
         FROM invoices WHERE business_id = $1
         ${filters.status ? `AND status IN (${Array.isArray(filters.status) ? filters.status.map((_, i) => `$${2 + i}`).join(",") : `$2`})` : ""}
         GROUP BY status ORDER BY status`,
        filters.status
          ? Array.isArray(filters.status)
            ? [businessId, ...filters.status]
            : [businessId, filters.status]
          : [businessId]
      ),
      query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', COALESCE(issue_date, created_at)), 'YYYY-MM') AS period,
           COUNT(*)::int AS count,
           COALESCE(SUM(total), 0) AS invoiced,
           COALESCE(SUM(amount_paid), 0) AS paid
         FROM invoices
         WHERE business_id = $1
         ${filters.dateFrom ? "AND issue_date >= $2" : ""}
         ${filters.dateTo ? `AND issue_date <= $${filters.dateFrom ? 3 : 2}` : ""}
         GROUP BY DATE_TRUNC('month', COALESCE(issue_date, created_at))
         ORDER BY period ASC`,
        (() => {
          const vals: unknown[] = [businessId];
          if (filters.dateFrom) vals.push(filters.dateFrom);
          if (filters.dateTo) vals.push(filters.dateTo);
          return vals;
        })()
      ),
      query(
        `SELECT c.id as customer_id, c.name as customer_name,
                COUNT(*) as invoice_count,
                COALESCE(SUM(i.total), 0) as total_invoiced,
                COALESCE(SUM(i.amount_paid), 0) as total_paid,
                COALESCE(SUM(i.amount_due), 0) as total_outstanding,
                MAX(i.created_at) as last_invoice_date
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
         WHERE i.business_id = $1 AND i.customer_id IS NOT NULL
         ${filters.customerId ? "AND i.customer_id = $2" : ""}
         GROUP BY c.id, c.name
         ORDER BY total_invoiced DESC
         LIMIT 20`,
        filters.customerId ? [businessId, filters.customerId] : [businessId]
      ),
    ]);

    const result = {
      summary,
      byStatus: byStatus.rows.map((r) => ({
        status: r.status,
        count: Number(r.count ?? 0),
        total_amount: String(r.total_amount ?? "0"),
        paid_amount: String(r.paid_amount ?? "0"),
        outstanding_amount: String(r.outstanding_amount ?? "0"),
        currency: r.currency ?? summary.currency,
      })) as RevenueByStatus[],
      byPeriod: byPeriod.rows.map((r) => ({
        period: r.period,
        invoiced: String(r.invoiced ?? "0"),
        paid: String(r.paid ?? "0"),
        count: Number(r.count ?? 0),
        currency: summary.currency,
      })) as RevenueByPeriod[],
      byCustomer: byCustomer.rows.map((r) => ({
        customerId: r.customer_id,
        customerName: r.customer_name,
        invoiceCount: Number(r.invoice_count ?? 0),
        invoiced: String(r.total_invoiced ?? "0"),
        paid: String(r.total_paid ?? "0"),
        outstanding: String(r.total_outstanding ?? "0"),
        currency: r.currency ?? summary.currency,
      })) as RevenueByCustomer[],
    };

    reportsCache.set(cacheKey, result);
    return result;
  }

  async getInvoicesReport(
    businessId: string,
    filters: ReportFilters = {}
  ): Promise<{
    summary: InvoiceReportSummary;
    invoices: InvoiceReportItem[];
  }> {
    const cacheKey = `invoices-report:${businessId}:${JSON.stringify(filters)}`;
    const cached = reportsCache.get(cacheKey);
    if (cached) return cached;

    const limit = Math.min(filters.limit ?? 50, 500);
    const offset = filters.offset ?? 0;
    const sortBy = filters.sortBy ?? "created_at";
    const sortOrder = filters.sortOrder ?? "desc";

    const conditions: string[] = ["i.business_id = $1"];
    const vals: unknown[] = [businessId];
    let paramIdx = 2;

    const statusMap: Record<string, string> = {
      draft: "draft",
      sent: "sent",
      viewed: "viewed",
      partially_paid: "partially_paid",
      paid: "paid",
      overdue: "overdue",
      cancelled: "cancelled",
      void: "void",
    };

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      const statusValues = statuses.map((s) => statusMap[s.toLowerCase()] ?? s);
      conditions.push(`i.status IN (${statusValues.map((_, i) => `$${paramIdx + i}`).join(",")})`);
      statusValues.forEach((s) => vals.push(s));
      paramIdx += statusValues.length;
    }

    if (filters.customerId) {
      conditions.push(`i.customer_id = $${paramIdx}`);
      vals.push(filters.customerId);
      paramIdx++;
    }

    if (filters.dateFrom) {
      conditions.push(`i.issue_date >= $${paramIdx}`);
      vals.push(filters.dateFrom);
      paramIdx++;
    }
    if (filters.dateTo) {
      conditions.push(`i.issue_date <= $${paramIdx}`);
      vals.push(filters.dateTo);
      paramIdx++;
    }

    if (filters.search) {
      conditions.push(`(i.invoice_number ILIKE $${paramIdx} OR c.name ILIKE $${paramIdx})`);
      vals.push(`%${filters.search}%`);
      paramIdx++;
    }

    const sortColMap: Record<string, string> = {
      invoice_number: "i.invoice_number",
      customer_name: "c.name",
      status: "i.status",
      total: "i.total",
      amount_due: "i.amount_due",
      amount_paid: "i.amount_paid",
      issue_date: "i.issue_date",
      due_date: "i.due_date",
      created_at: "i.created_at",
    };
    const sortCol = sortColMap[sortBy] ?? "i.created_at";
    const sortDir = sortOrder === "desc" ? "DESC" : "ASC";

    const dataRes = await query(
      `SELECT i.id, i.invoice_number, i.status, i.currency, i.total, i.amount_paid, i.amount_due,
              i.issue_date, i.due_date, i.paid_at, i.created_at,
              c.name as customer_name, c.email as customer_email
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${sortCol} ${sortDir}, i.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...vals, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
       WHERE ${conditions.join(" AND ")}`,
      vals
    );

    const summaryRes = await query(
      `SELECT
         COUNT(*)::int AS total_invoices,
         COALESCE(SUM(i.total), 0) AS total_invoiced,
         COALESCE(SUM(i.amount_paid), 0) AS total_paid,
         SUM(CASE WHEN i.amount_due > 0 AND i.status NOT IN ('draft','cancelled','void') THEN i.amount_due ELSE 0 END) AS total_outstanding,
         SUM(CASE WHEN (i.status = 'overdue' OR (i.due_date < NOW() AND i.amount_due > 0)) AND i.amount_due > 0 AND i.status NOT IN ('draft','cancelled','void','paid') THEN i.amount_due ELSE 0 END) AS total_overdue,
         COALESCE(MAX(i.currency), 'USD') AS currency
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE ${conditions.join(" AND ")}`,
      vals
    );

    const summaryRow = summaryRes.rows[0];

    const now = new Date();

    const invoices: InvoiceReportItem[] = dataRes.rows.map((r) => {
      const dueDate = r.due_date ? new Date(r.due_date) : null;
      let daysOverdue = 0;
      if (dueDate && r.status !== "paid" && r.status !== "cancelled" && r.status !== "void") {
        const diff = now.getTime() - dueDate.getTime();
        daysOverdue = Math.floor(diff / (1000 * 60 * 60 * 24));
      }

      return {
        id: r.id,
        invoice_number: r.invoice_number,
        customer_name: r.customer_name,
        customer_email: r.customer_email,
        status: r.status,
        currency: r.currency,
        total: String(r.total ?? "0"),
        amount_paid: String(r.amount_paid ?? "0"),
        amount_due: String(r.amount_due ?? "0"),
        issue_date: r.issue_date ? new Date(r.issue_date).toISOString().split("T")[0] : null,
        due_date: r.due_date ? new Date(r.due_date).toISOString().split("T")[0] : null,
        paid_at: r.paid_at ? new Date(r.paid_at).toISOString() : null,
        days_overdue: daysOverdue,
        created_at: r.created_at,
      };
    });

    const statusBreakdown = invoices.reduce<Record<string, { count: number; amount: string }>>(
      (acc, inv) => {
        if (!acc[inv.status]) acc[inv.status] = { count: 0, amount: "0" };
        acc[inv.status].count += 1;
        acc[inv.status].amount = new Decimal(acc[inv.status].amount)
          .plus(new Decimal(inv.total))
          .toFixed(2);
        return acc;
      },
      {}
    );

    const byPeriod: RevenueByPeriod[] = [];
    const periodMap = new Map<string, { invoiced: string; count: number }>();
    invoices.forEach((inv) => {
      const period = inv.issue_date
        ? new Date(inv.issue_date).toISOString().slice(0, 7)
        : "unknown";
      const existing = periodMap.get(period);
      if (existing) {
        existing.invoiced = new Decimal(existing.invoiced)
          .plus(new Decimal(inv.total))
          .toFixed(2);
        existing.count += 1;
      } else {
        periodMap.set(period, { invoiced: inv.total, count: 1 });
      }
    });
    periodMap.forEach((v, k) => byPeriod.push({
      period: k,
      invoiced: v.invoiced,
      paid: invoices
        .filter((i) => (i.issue_date ? new Date(i.issue_date).toISOString().slice(0, 7) : "unknown") === k)
        .reduce((sum, i) => sum.plus(new Decimal(i.amount_paid)), new Decimal(0))
        .toFixed(2),
      count: v.count,
      currency: summaryRow.currency ?? "USD",
    }));
    byPeriod.sort((a, b) => a.period.localeCompare(b.period));

    const result = {
      summary: {
        totalInvoices: Number(summaryRow.total_invoices ?? 0),
        totalInvoiced: String(summaryRow.total_invoiced ?? "0"),
        totalPaid: String(summaryRow.total_paid ?? "0"),
        totalOutstanding: String(summaryRow.total_outstanding ?? "0"),
        totalOverdue: String(summaryRow.total_overdue ?? "0"),
        currency: summaryRow.currency ?? "USD",
        statusBreakdown: Object.entries(statusBreakdown).map(([status, data]) => ({
          status,
          count: data.count,
          amount: data.amount,
        })),
        byPeriod,
      } as InvoiceReportSummary,
      invoices,
    };

    reportsCache.set(cacheKey, result);
    return result;
  }

  async getPaymentsReport(
    businessId: string,
    filters: ReportFilters = {}
  ): Promise<{
    summary: PaymentReportSummary;
    payments: PaymentReportItem[];
  }> {
    const cacheKey = `payments-report:${businessId}:${JSON.stringify(filters)}`;
    const cached = reportsCache.get(cacheKey);
    if (cached) return cached;

    const limit = Math.min(filters.limit ?? 50, 500);
    const offset = filters.offset ?? 0;
    const sortBy = filters.sortBy ?? "created_at";
    const sortOrder = filters.sortOrder ?? "desc";

    const conditions: string[] = ["p.business_id = $1"];
    const vals: unknown[] = [businessId];
    let paramIdx = 2;

    if (filters.paymentStatus || filters.status) {
      const statuses = Array.isArray(filters.paymentStatus ?? filters.status ?? [])
        ? (filters.paymentStatus ?? filters.status) as string[]
        : [filters.paymentStatus ?? filters.status as string];
      conditions.push(`p.status IN (${statuses.map((_, i) => `$${paramIdx + i}`).join(",")})`);
      statuses.forEach((s) => vals.push(s));
      paramIdx += statuses.length;
    }

    if (filters.search) {
      conditions.push(`(i.invoice_number ILIKE $${paramIdx} OR p.provider_payment_id ILIKE $${paramIdx})`);
      vals.push(`%${filters.search}%`);
      paramIdx++;
    }

    if (filters.dateFrom) {
      conditions.push(`p.created_at >= $${paramIdx}`);
      vals.push(filters.dateFrom);
      paramIdx++;
    }
    if (filters.dateTo) {
      conditions.push(`p.created_at <= $${paramIdx}`);
      vals.push(filters.dateTo);
      paramIdx++;
    }

    if (filters.provider) {
      conditions.push(`p.provider = $${paramIdx}`);
      vals.push(filters.provider);
      paramIdx++;
    }

    const sortColMap: Record<string, string> = {
      amount: "p.amount",
      created_at: "p.created_at",
      paid_at: "p.paid_at",
      provider: "p.provider",
      status: "p.status",
    };
    const sortCol = sortColMap[sortBy] ?? "p.created_at";
    const sortDir = sortOrder === "desc" ? "DESC" : "ASC";

    const dataRes = await query(
      `SELECT p.id, p.invoice_id, p.amount, p.currency, p.status, p.method, p.provider,
              p.provider_payment_id, p.paid_at, p.created_at,
              i.invoice_number, c.name as customer_name
       FROM payments p
       LEFT JOIN invoices i ON i.id = p.invoice_id
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${sortCol} ${sortDir}, p.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...vals, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*)::int AS total
       FROM payments p
       LEFT JOIN invoices i ON i.id = p.invoice_id
       WHERE ${conditions.join(" AND ")}`,
      vals
    );

    const summaryRes = await query(
      `SELECT
         COUNT(*)::int AS total_payments,
         COALESCE(SUM(p.amount), 0) AS total_amount,
         COALESCE(SUM(CASE WHEN p.status = 'succeeded' THEN p.amount ELSE 0 END), 0) AS total_paid,
         COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END), 0) AS total_pending,
         COALESCE(SUM(CASE WHEN p.status = 'failed' THEN p.amount ELSE 0 END), 0) AS total_failed,
         COALESCE(SUM(CASE WHEN p.status IN ('refunded', 'partially_refunded') THEN p.amount ELSE 0 END), 0) AS total_refunded,
         COALESCE(SUM(CASE WHEN p.status = 'succeeded' AND p.paid_at >= $2 THEN p.amount ELSE 0 END), 0) AS payments_this_month,
         COALESCE(MAX(p.currency), 'USD') AS currency
       FROM payments p
       LEFT JOIN invoices i ON i.id = p.invoice_id
       WHERE ${conditions.slice(0, 1).join(" AND ")}`,
      [businessId, new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()]
    );

    const providerBreakdownRes = await query(
      `SELECT p.provider, COUNT(*)::int AS count, COALESCE(SUM(p.amount), 0) AS amount
       FROM payments p
       WHERE ${conditions.join(" AND ")}
       GROUP BY p.provider
       ORDER BY amount DESC`,
      vals
    );

    const methodBreakdownRes = await query(
      `SELECT p.method, COUNT(*)::int AS count, COALESCE(SUM(p.amount), 0) AS amount
       FROM payments p
       WHERE ${conditions.join(" AND ")} AND p.method IS NOT NULL
       GROUP BY p.method
       ORDER BY amount DESC`,
      vals
    );

    const dailyTrendRes = await query(
      `SELECT DATE(p.created_at) AS date,
              COUNT(*)::int AS count,
              COALESCE(SUM(p.amount), 0) AS amount
       FROM payments p
       WHERE ${conditions.join(" AND ")}
       GROUP BY DATE(p.created_at)
       ORDER BY date DESC
       LIMIT 30`,
      vals
    );

    const summaryRow = summaryRes.rows[0];

    const payments: PaymentReportItem[] = dataRes.rows.map((r) => ({
      id: r.id,
      invoice_id: r.invoice_id,
      invoice_number: r.invoice_number,
      customer_name: r.customer_name,
      amount: String(r.amount ?? "0"),
      currency: r.currency,
      status: r.status,
      method: r.method,
      provider: r.provider,
      paid_at: r.paid_at ? new Date(r.paid_at).toISOString() : null,
      created_at: r.created_at,
    }));

    const result = {
      summary: {
        totalPayments: Number(countRes.rows[0]?.total ?? 0),
        totalAmount: String(summaryRow.total_amount ?? "0"),
        totalPaid: String(summaryRow.total_paid ?? "0"),
        totalPending: String(summaryRow.total_pending ?? "0"),
        totalFailed: String(summaryRow.total_failed ?? "0"),
        totalRefunded: String(summaryRow.total_refunded ?? "0"),
        paymentsThisMonth: String(summaryRow.payments_this_month ?? "0"),
        currency: summaryRow.currency ?? "USD",
        providerBreakdown: providerBreakdownRes.rows.map((r) => ({
          provider: r.provider,
          count: Number(r.count ?? 0),
          amount: String(r.amount ?? "0"),
        })),
        methodBreakdown: methodBreakdownRes.rows.map((r) => ({
          method: r.method,
          count: Number(r.count ?? 0),
          amount: String(r.amount ?? "0"),
        })),
        dailyTrend: dailyTrendRes.rows.map((r) => ({
          date: r.date,
          amount: String(r.amount ?? "0"),
          count: Number(r.count ?? 0),
        })),
      } as PaymentReportSummary,
      payments,
    };

    reportsCache.set(cacheKey, result);
    return result;
  }

  async getClientsReport(
    businessId: string,
    filters: ReportFilters = {}
  ): Promise<{
    summary: ClientReportSummary;
    clients: ClientReportItem[];
  }> {
    const cacheKey = `clients-report:${businessId}:${JSON.stringify(filters)}`;
    const cached = reportsCache.get(cacheKey);
    if (cached) return cached;

    const limit = Math.min(filters.limit ?? 50, 500);
    const offset = filters.offset ?? 0;

    const conditions: string[] = ["c.business_id = $1"];
    const vals: unknown[] = [businessId];
    let paramIdx = 2;

    if (filters.search) {
      conditions.push(`(c.search_name ILIKE $${paramIdx} OR c.name ILIKE $${paramIdx})`);
      vals.push(`%${filters.search}%`);
      paramIdx++;
    }

    if (filters.dateFrom) {
      conditions.push(`EXISTS (SELECT 1 FROM invoices i WHERE i.customer_id = c.id AND i.business_id = $${paramIdx})`);
      vals.push(filters.dateFrom);
      paramIdx++;
    }

    const dataRes = await query(
      `SELECT c.id, c.name, c.company_name, c.email, c.phone, c.country_code,
              COALESCE(inv_stats.invoice_count, 0) AS invoice_count,
              COALESCE(inv_stats.total_invoiced, 0) AS total_invoiced,
              COALESCE(inv_stats.total_paid, 0) AS total_paid,
              COALESCE(inv_stats.total_outstanding, 0) AS total_outstanding,
              inv_stats.last_invoice_date
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS invoice_count,
           COALESCE(SUM(i.total), 0) AS total_invoiced,
           COALESCE(SUM(i.amount_paid), 0) AS total_paid,
           COALESCE(SUM(i.amount_due), 0) AS total_outstanding,
           MAX(i.created_at) AS last_invoice_date
         FROM invoices i
         WHERE i.business_id = c.business_id AND i.customer_id = c.id
       ) inv_stats ON TRUE
       WHERE ${conditions.join(" AND ")}
       ORDER BY total_invoiced DESC, c.name ASC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...vals, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*)::int AS total FROM customers c WHERE ${conditions.join(" AND ")}`,
      vals
    );

    const summaryRes = await query(
      `SELECT
         COUNT(c.id)::int AS total_clients,
         COALESCE(SUM(inv_stats.total_invoiced), 0) AS total_invoiced,
         COALESCE(SUM(inv_stats.total_paid), 0) AS total_paid,
         COALESCE(SUM(inv_stats.total_outstanding), 0) AS total_outstanding,
         COALESCE(MAX(c.default_currency), 'USD') AS currency
       FROM customers c
       LEFT JOIN LATERAL (
         SELECT
           COALESCE(SUM(i.total), 0) AS total_invoiced,
           COALESCE(SUM(i.amount_paid), 0) AS total_paid,
           COALESCE(SUM(i.amount_due), 0) AS total_outstanding
         FROM invoices i
         WHERE i.business_id = c.business_id AND i.customer_id = c.id
       ) inv_stats ON TRUE
       WHERE c.business_id = $1`,
      [businessId]
    );

    const summaryRow = summaryRes.rows[0];
    const totalClients = Number(countRes.rows[0]?.total ?? 0);

    const clients: ClientReportItem[] = dataRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      company_name: r.company_name,
      email: r.email,
      phone: r.phone,
      country_code: r.country_code,
      invoice_count: Number(r.invoice_count ?? 0),
      total_invoiced: String(r.total_invoiced ?? "0"),
      total_paid: String(r.total_paid ?? "0"),
      total_outstanding: String(r.total_outstanding ?? "0"),
      last_invoice_date: r.last_invoice_date ? new Date(r.last_invoice_date).toISOString() : null,
      currency: r.currency ?? summaryRow?.currency ?? "USD",
    }));

    const totalInvoiced = new Decimal(summaryRow?.total_invoiced ?? "0");
    const avgInvoice = totalClients > 0
      ? totalInvoiced.div(totalClients).toFixed(2)
      : "0";

    const result = {
      summary: {
        totalClients,
        totalInvoiced: String(summaryRow?.total_invoiced ?? "0"),
        totalPaid: String(summaryRow?.total_paid ?? "0"),
        totalOutstanding: String(summaryRow?.total_outstanding ?? "0"),
        averageInvoiceValue: avgInvoice,
        currency: summaryRow?.currency ?? "USD",
      } as ClientReportSummary,
      clients,
    };

    reportsCache.set(cacheKey, result);
    return result;
  }

  async getTaxSummaryReport(
    businessId: string,
    filters: ReportFilters = {}
  ): Promise<TaxSummaryReport> {
    const cacheKey = `tax-summary-report:${businessId}:${JSON.stringify(filters)}`;
    const cached = reportsCache.get(cacheKey);
    if (cached) return cached;

    const dateFrom = filters.dateFrom ?? new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1).toISOString();
    const dateTo = filters.dateTo ?? new Date().toISOString();

    const [byPeriod, byRate, totals] = await Promise.all([
      query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', i.created_at), 'YYYY-MM') AS period,
           COUNT(*)::int AS invoice_count,
           COALESCE(SUM(i.tax_total), 0) AS tax_collected,
           COALESCE(SUM(i.subtotal + i.discount_total), 0) AS taxable_amount,
           COALESCE(MAX(i.currency), 'USD') AS currency
         FROM invoices i
         WHERE i.business_id = $1 AND i.is_finalized = TRUE
           AND i.created_at >= $2 AND i.created_at <= $3
         GROUP BY DATE_TRUNC('month', i.created_at)
         ORDER BY period ASC`,
        [businessId, dateFrom, dateTo]
      ),
       query(
         `SELECT
            COALESCE(ti.tax_rate, 0) AS rate,
            COUNT(DISTINCT i.id) AS invoice_count,
            COALESCE(SUM(ti.tax_amount), 0) AS tax_collected,
            COALESCE(SUM(ti.line_subtotal + ti.discount), 0) AS taxable_basis,
            COALESCE(MAX(i.currency), 'USD') AS currency
          FROM invoices i
          JOIN invoice_items ti ON ti.invoice_id = i.id
          WHERE i.business_id = $1 AND i.is_finalized = TRUE
            AND i.created_at >= $2 AND i.created_at <= $3
            AND ti.tax_amount > 0
          GROUP BY ti.tax_rate
          ORDER BY tax_collected DESC`,
         [businessId, dateFrom, dateTo]
       ),
      query(
        `SELECT
           COALESCE(SUM(i.tax_total), 0) AS total_tax_collected,
           COALESCE(SUM(i.subtotal + i.discount_total), 0) AS total_taxable_amount,
           COUNT(DISTINCT i.id) AS invoice_count,
           COALESCE(MAX(i.currency), 'USD') AS currency
         FROM invoices i
         WHERE i.business_id = $1 AND i.is_finalized = TRUE
           AND i.created_at >= $2 AND i.created_at <= $3`,
        [businessId, dateFrom, dateTo]
      ),
    ]);

    const totalByMonth = byPeriod.rows.reduce((sum: number, r: any) => sum + Number(r.tax_collected ?? 0), 0);

    const result: TaxSummaryReport = {
      summary: {
        totalTaxCollected: String(totals.rows[0]?.total_tax_collected ?? "0"),
        totalTaxableAmount: String(totals.rows[0]?.total_taxable_amount ?? "0"),
        periodStart: dateFrom,
        periodEnd: dateTo,
        currency: totals.rows[0]?.currency ?? "USD",
      },
      byPeriod: byPeriod.rows.map((r) => ({
        period: r.period,
        tax_collected: String(r.tax_collected ?? "0"),
        taxable_amount: String(r.taxable_amount ?? "0"),
        invoice_count: Number(r.invoice_count ?? 0),
        currency: r.currency ?? "USD",
      })),
       byRate: byRate.rows.map((r) => ({
         rate: String(r.rate ?? "0"),
        name: "Tax",
        taxable_basis: String(r.taxable_basis ?? "0"),
        tax_collected: String(r.tax_collected ?? "0"),
        invoice_count: Number(r.invoice_count ?? 0),
        currency: r.currency ?? "USD",
      })),
    };

    reportsCache.set(cacheKey, result);
    return result;
  }

  async getProfitLossReport(
    businessId: string,
    filters: ReportFilters = {}
  ): Promise<ProfitLossReport> {
    const cacheKey = `profit-loss:${businessId}:${JSON.stringify(filters)}`;
    const cached = reportsCache.get(cacheKey);
    if (cached) return cached;

    const dateFrom = filters.dateFrom ?? new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1).toISOString();
    const dateTo = filters.dateTo ?? new Date().toISOString();

    const [revenue, currencyRow] = await Promise.all([
      query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', i.created_at), 'YYYY-MM') AS period,
           COUNT(*)::int AS count,
           COALESCE(SUM(i.total), 0) AS amount
         FROM invoices i
         WHERE i.business_id = $1 AND i.created_at >= $2 AND i.created_at <= $3
         GROUP BY DATE_TRUNC('month', i.created_at)
         ORDER BY period ASC`,
        [businessId, dateFrom, dateTo]
      ),
      query(
        `SELECT COALESCE(MAX(currency), 'USD') AS currency
         FROM (
           (SELECT currency FROM invoices WHERE business_id = $1 LIMIT 1)
         ) c`,
        [businessId]
      ),
    ]);

    const currency = currencyRow.rows[0]?.currency ?? "USD";

    const revenueTotal = revenue.rows.reduce((sum: number, r: any) => sum + Number(r.amount ?? 0), 0);

    const result: ProfitLossReport = {
      periodStart: dateFrom,
      periodEnd: dateTo,
      currency,
      revenue: {
        total: new Decimal(revenueTotal).toFixed(2),
        count: revenue.rows.reduce((sum: number, r: any) => sum + Number(r.count ?? 0), 0),
        byMonth: revenue.rows.map((r: any) => ({
          period: r.period,
          amount: String(r.amount ?? "0"),
          count: Number(r.count ?? 0),
        })),
      },
      netIncome: new Decimal(revenueTotal).toFixed(2),
      grossMargin: revenueTotal > 0 ? 100 : 0,
    };

    reportsCache.set(cacheKey, result);
    return result;
  }

  async getAgingReport(businessId: string): Promise<{
    buckets: Array<{ bucket: string; count: number; amount: string }>;
    summary: { totalOutstanding: string; totalOverdue: string; currency: string };
  }> {
    const cacheKey = `aging:${businessId}`;
    const cached = reportsCache.get(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const [buckets, summary] = await Promise.all([
      query(
        `SELECT bucket, COUNT(*)::int AS count, COALESCE(SUM(amount_due), 0) AS amount
          FROM (
           SELECT i.amount_due,
                 CASE
                   WHEN i.due_date IS NULL THEN 'current'
                   WHEN EXTRACT(EPOCH FROM ($1::timestamptz - i.due_date)) / 86400 <= 0 THEN 'current'
                   WHEN EXTRACT(EPOCH FROM ($1::timestamptz - i.due_date)) / 86400 <= 30 THEN '1-30'
                   WHEN EXTRACT(EPOCH FROM ($1::timestamptz - i.due_date)) / 86400 <= 60 THEN '31-60'
                   WHEN EXTRACT(EPOCH FROM ($1::timestamptz - i.due_date)) / 86400 <= 90 THEN '61-90'
                   ELSE '90+'
                 END AS bucket
           FROM invoices i
           WHERE i.business_id = $2
             AND i.amount_due > 0
             AND i.status NOT IN ('draft', 'cancelled', 'void')
         ) sub
         GROUP BY bucket
         ORDER BY CASE bucket
           WHEN 'current' THEN 0
           WHEN '1-30' THEN 1
           WHEN '31-60' THEN 2
           WHEN '61-90' THEN 3
           WHEN '90+' THEN 4
         END`,
        [now.toISOString(), businessId]
      ),
      query(
        `SELECT
           COALESCE(SUM(amount_due), 0) AS total_outstanding,
           SUM(CASE WHEN (status = 'overdue' OR (due_date < NOW() AND amount_due > 0)) AND amount_due > 0 AND status NOT IN ('draft','cancelled','void','paid') THEN amount_due ELSE 0 END) AS total_overdue,
           COALESCE(MAX(currency), 'USD') AS currency
         FROM invoices
         WHERE business_id = $1`,
        [businessId]
      ),
    ]);

    const bucketDefaults: Array<{ bucket: string; count: number; amount: string }> = [
      { bucket: "current", count: 0, amount: "0" },
      { bucket: "1-30", count: 0, amount: "0" },
      { bucket: "31-60", count: 0, amount: "0" },
      { bucket: "61-90", count: 0, amount: "0" },
      { bucket: "90+", count: 0, amount: "0" },
    ];
    for (const row of buckets.rows) {
      const idx = bucketDefaults.findIndex((b) => b.bucket === row.bucket);
      if (idx >= 0) {
        bucketDefaults[idx].count = Number(row.count ?? 0);
        bucketDefaults[idx].amount = String(row.amount ?? "0");
      }
    }

    const result = {
      buckets: bucketDefaults,
      summary: {
        totalOutstanding: String(summary.rows[0]?.total_outstanding ?? "0"),
        totalOverdue: String(summary.rows[0]?.total_overdue ?? "0"),
        currency: summary.rows[0]?.currency ?? "USD",
      },
    };

    reportsCache.set(cacheKey, result);
    return result;
  }
}

export const reportsService = new ReportsService();

export function invalidateDashboardCache(businessId: string): void {
  reportsCache.delete(`dashboard-summary:${businessId}`);
  invalidateReportsCache(businessId);
}

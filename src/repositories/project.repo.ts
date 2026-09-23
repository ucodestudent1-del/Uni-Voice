import { Decimal } from "decimal.js";
import { query } from "../db/pool.js";
import type { Project, ProjectTag, ProjectTeamMember, ProjectEvent, ProjectStatus, Customer, CustomerStatus } from "../domain/models/index.js";
import { NotFoundError, ConflictError, BusinessLogicError } from "../domain/errors.js";
import { rowToDate } from "./helpers.js";
import type { PagedResult } from "./helpers.js";

export interface ProjectInput {
  customerId?: string | null;
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  startDate?: string | null;
  dueDate?: string | null;
  budget?: string | number;
  currency?: string;
}

export interface ProjectUpdateInput {
  customerId?: string | null;
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  startDate?: string | null;
  dueDate?: string | null;
  budget?: string | number;
  currency?: string;
}

export interface ProjectSearchOptions {
  search?: string;
  status?: ProjectStatus;
  customerId?: string;
  tagId?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ProjectFinancialSummary {
  budget: string;
  amountInvoiced: string;
  amountPaid: string;
  remainingBillable: string;
  outstanding: string;
  budgetUtilization: string;
}

export interface ProjectListItem extends Project {
  customerName: string | null;
  customerEmail: string | null;
  tagCount: number;
  teamMemberCount: number;
}

const SORTABLE_COLUMNS: Record<string, string> = {
  name: "p.name",
  created_at: "p.created_at",
  updated_at: "p.updated_at",
  due_date: "p.due_date",
  start_date: "p.start_date",
  budget: "p.budget",
  amount_invoiced: "p.amount_invoiced",
};

export class ProjectRepository {
  async create(businessId: string, input: ProjectInput, userId?: string): Promise<Project> {
    if (!input.name || input.name.trim().length === 0) {
      throw new BusinessLogicError("Project name is required");
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const budget = new Decimal(input.budget ?? 0);
    const currency = input.currency ?? "USD";

    const res = await query(
      `INSERT INTO projects (
        id, business_id, customer_id, name, description, status, start_date, due_date,
        budget, currency, amount_invoiced, amount_paid, remaining_billable,
        search_name, search_desc, version, created_by, updated_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 0, 0, $11, $12, 1, $13, $13, $14, $14
      ) RETURNING *`,
      [
        id, businessId, input.customerId ?? null, input.name.trim(), input.description ?? null,
        input.status ?? "planning", input.startDate ?? null, input.dueDate ?? null,
        budget.toFixed(2), currency, budget.toString(), null, userId, now,
      ]
    );

    const project = this.rowToModel(res.rows[0]);
    await this.recordEvent(id, businessId, "created", userId, { source: "repository" });
    return project;
  }

  async findById(businessId: string, id: string): Promise<Project> {
    const res = await query(
      `SELECT * FROM projects WHERE id = $1 AND business_id = $2`,
      [id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Project ${id} not found`);
    return this.rowToModel(res.rows[0]);
  }

  async findSummary(businessId: string, id: string): Promise<{
    project: Project;
    customer: Customer | null;
    tags: ProjectTag[];
    teamMembers: ProjectTeamMember[];
    financialSummary: ProjectFinancialSummary;
  }> {
    const res = await query(
      `SELECT
         p.*,
         c.id AS cust_id, c.business_id AS cust_business_id, c.name AS cust_name,
         c.company_name AS cust_company_name, c.email AS cust_email, c.phone AS cust_phone,
         c.tax_id AS cust_tax_id, c.address_line_1 AS cust_address_line_1,
         c.address_line_2 AS cust_address_line_2, c.city AS cust_city,
         c.state_or_region AS cust_state_or_region, c.postal_code AS cust_postal_code,
         c.country_code AS cust_country_code, c.default_currency AS cust_default_currency,
         c.notes AS cust_notes, c.status AS cust_status, c.payment_terms AS cust_payment_terms,
         c.tax_identifiers AS cust_tax_identifiers, c.billing_address_id AS cust_billing_address_id,
         c.shipping_address_id AS cust_shipping_address_id, c.archived_at AS cust_archived_at,
         c.archived_by AS cust_archived_by, c.updated_by AS cust_updated_by,
         c.version AS cust_version, c.created_at AS cust_created_at, c.updated_at AS cust_updated_at,
         (SELECT COALESCE(json_agg(row_to_json(t)) FILTER (WHERE t.id IS NOT NULL), '[]'::json)
          FROM project_tags t
          JOIN project_taggings pt ON pt.tag_id = t.id
          WHERE pt.project_id = p.id AND t.business_id = p.business_id) AS tags_json,
         (SELECT COALESCE(json_agg(row_to_json(ptm)) FILTER (WHERE ptm.id IS NOT NULL), '[]'::json)
          FROM project_team_members ptm
          WHERE ptm.project_id = p.id AND ptm.business_id = p.business_id) AS team_members_json
       FROM projects p
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE p.id = $1 AND p.business_id = $2`,
      [id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Project ${id} not found`);

    const r = res.rows[0];
    const project = this.rowToModel(r);

    let customer: Customer | null = null;
    if (r.cust_id) {
      customer = {
        id: r.cust_id as string,
        businessId: r.cust_business_id as string,
        name: r.cust_name as string,
        companyName: r.cust_company_name as string | null,
        email: r.cust_email as string | null,
        phone: r.cust_phone as string | null,
        taxId: r.cust_tax_id as string | null,
        address: {
          addressLine1: (r.cust_address_line_1 as string | null) ?? "",
          addressLine2: r.cust_address_line_2 as string | null,
          city: (r.cust_city as string | null) ?? "",
          stateOrRegion: (r.cust_state_or_region as string | null) ?? "",
          postalCode: (r.cust_postal_code as string | null) ?? "",
          countryCode: (r.cust_country_code as string | null) ?? "US",
          taxId: r.cust_tax_id as string | null,
        },
        countryCode: r.cust_country_code as string | null,
        defaultCurrency: (r.cust_default_currency as string | null) as Customer["defaultCurrency"],
        notes: r.cust_notes as string | null,
        status: (r.cust_status as CustomerStatus) ?? "active",
        paymentTerms: r.cust_payment_terms ? Number(r.cust_payment_terms) : null,
        taxIdentifiers: [],
        billingAddressId: r.cust_billing_address_id as string | null,
        shippingAddressId: r.cust_shipping_address_id as string | null,
        archivedAt: rowToDate(r.cust_archived_at),
        archivedBy: r.cust_archived_by as string | null,
        updatedBy: r.cust_updated_by as string | null,
        version: Number(r.cust_version ?? 1),
        createdAt: rowToDate(r.cust_created_at)!,
        updatedAt: rowToDate(r.cust_updated_at)!,
      };
    }

    const tags: ProjectTag[] = (r.tags_json as string | null) ? ((r.tags_json as string).length ? JSON.parse(r.tags_json as string).map((t: Record<string, unknown>) => this.tagRowToModel(t)) : []) : [];
    const teamMembers: ProjectTeamMember[] = (r.team_members_json as string | null) ? ((r.team_members_json as string).length ? JSON.parse(r.team_members_json as string).map((t: Record<string, unknown>) => this.teamMemberRowToModel(t)) : []) : [];

    const budget = new Decimal(project.budget);
    const amountInvoiced = new Decimal(project.amountInvoiced);
    const amountPaid = new Decimal(project.amountPaid);
    const remainingBillable = new Decimal(project.remainingBillable);
    const outstanding = amountInvoiced.minus(amountPaid);
    const budgetUtilization = budget.isZero() ? new Decimal(0) : amountInvoiced.dividedBy(budget).times(100);

    const financialSummary: ProjectFinancialSummary = {
      budget: budget.toFixed(2),
      amountInvoiced: amountInvoiced.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      remainingBillable: remainingBillable.toFixed(2),
      outstanding: outstanding.toFixed(2),
      budgetUtilization: budgetUtilization.toFixed(2),
    };

    return { project, customer, tags, teamMembers, financialSummary };
  }

  async findWithDetails(businessId: string, id: string): Promise<Project & { tags: ProjectTag[]; teamMembers: ProjectTeamMember[] }> {
    const project = await this.findById(businessId, id);
    const tags = await this.findTags(project.id, businessId);
    const teamMembers = await this.findTeamMembers(project.id, businessId);
    return { ...project, tags, teamMembers };
  }

  async findMany(businessId: string, opts: ProjectSearchOptions = {}): Promise<PagedResult<ProjectListItem>> {
    const limit = Math.min(opts.limit ?? 50, 200);
    const offset = opts.offset ?? 0;
    const sortBy = opts.sortBy ?? "created_at";
    const sortOrder = opts.sortOrder ?? "desc";
    const includeArchived = opts.includeArchived ?? false;

    const conditions: string[] = ["business_id = $1"];
    const vals: unknown[] = [businessId];
    let i = 2;

    if (!includeArchived) {
      conditions.push(`status != 'archived'`);
    }

    if (opts.search) {
      const pattern = `%${opts.search.toLowerCase()}%`;
      conditions.push(`(search_name ILIKE $${i} OR search_desc ILIKE $${i})`);
      vals.push(pattern);
      i++;
    }

    if (opts.status) {
      conditions.push(`status = $${i}`);
      vals.push(opts.status);
      i++;
    }

    if (opts.customerId) {
      conditions.push(`customer_id = $${i}`);
      vals.push(opts.customerId);
      i++;
    }

    if (opts.tagId) {
      conditions.push(`p.id IN (SELECT project_id FROM project_taggings WHERE tag_id = $${i})`);
      vals.push(opts.tagId);
      i++;
    }

    const sortCol = SORTABLE_COLUMNS[sortBy] || SORTABLE_COLUMNS[sortBy.replace(/([A-Z])/g, "_$1").toLowerCase()] || "p.created_at";
    const sortDirection = sortOrder === "desc" ? "DESC" : "ASC";

    const dataRes = await query(
      `SELECT p.*, c.name as customer_name, c.email as customer_email,
              (SELECT COUNT(*) FROM project_taggings pt WHERE pt.project_id = p.id) AS tag_count,
              (SELECT COUNT(*) FROM project_team_members ptm WHERE ptm.project_id = p.id) AS team_member_count
       FROM projects p
       LEFT JOIN customers c ON c.id = p.customer_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ${sortCol} ${sortDirection}, p.created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      [...vals, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*) as total FROM projects p WHERE ${conditions.join(" AND ")}`,
      vals
    );

    const data = dataRes.rows.map((r) => this.listRowToModel(r));
    const total = Number(countRes.rows[0]?.total ?? 0);
    return { data, total, limit, offset };
  }

  async searchForSelection(businessId: string, search?: string, limit = 20): Promise<Project[]> {
    const conditions: string[] = ["business_id = $1", "status != 'archived'"];
    const vals: unknown[] = [businessId];
    let i = 2;

    if (search) {
      const pattern = `%${search.toLowerCase()}%`;
      conditions.push(`(search_name ILIKE $${i} OR search_desc ILIKE $${i})`);
      vals.push(pattern);
      i++;
    }

    const res = await query(
      `SELECT * FROM projects WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT $${i}`,
      [...vals, limit]
    );
    return res.rows.map((r) => this.rowToModel(r));
  }

  async update(businessId: string, id: string, input: ProjectUpdateInput, userId?: string): Promise<Project> {
    const ALLOWED_COLUMNS = [
      "customer_id", "name", "description", "status", "start_date", "due_date",
      "budget", "currency",
    ];

    const set: string[] = [];
    const vals: unknown[] = [businessId, id];
    let i = 3;

    for (const [key, val] of Object.entries(input)) {
      if (!ALLOWED_COLUMNS.includes(key) || val === undefined) continue;
      const col = key;
      set.push(`${col} = $${i++}`);
      vals.push(val ?? null);
    }

    if (input.name && input.name.trim().length > 0) {
      const nameExists = set.some((s) => s.startsWith("name ="));
      if (!nameExists) {
        set.push(`name = $${i++}`);
        vals.push(input.name.trim());
      }
      set.push(`search_name = $${i++}`);
      vals.push(input.name.trim().toLowerCase());
    }
    if (input.description !== undefined) {
      set.push(`search_desc = $${i++}`);
      vals.push(input.description ? input.description.toLowerCase() : null);
    }

    set.push(`version = version + 1`);
    set.push(`updated_at = NOW()`);
    if (userId) {
      set.push(`updated_by = $${i++}`);
      vals.push(userId);
    }

    if (set.length <= 2) {
      const current = await this.findById(businessId, id);
      return current;
    }

    const res = await query(
      `UPDATE projects SET ${set.join(", ")} WHERE id = $2 AND business_id = $1 RETURNING *`,
      vals
    );
    if (!res.rows.length) throw new NotFoundError(`Project ${id} not found`);

    const project = this.rowToModel(res.rows[0]);
    await this.recordEvent(id, businessId, "updated", userId, { fields: Object.keys(input) });
    return project;
  }

  async updateStatus(businessId: string, id: string, status: ProjectStatus, userId?: string): Promise<Project> {
    const project = await this.findById(businessId, id);
    if (project.status === status) return project;

    const res = await query(
      `UPDATE projects SET status = $1, version = version + 1, updated_at = NOW(), updated_by = $2
       WHERE id = $3 AND business_id = $4 RETURNING *`,
      [status, userId ?? null, id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Project ${id} not found`);

    await this.recordEvent(id, businessId, "status_changed", userId, { from: project.status, to: status });
    return this.rowToModel(res.rows[0]);
  }

  async archive(businessId: string, id: string, userId?: string): Promise<Project> {
    const project = await this.findById(businessId, id);
    if (project.status === "archived") {
      throw new ConflictError(`Project ${id} is already archived`);
    }

    const res = await query(
      `UPDATE projects SET status = 'archived', version = version + 1, updated_at = NOW(), updated_by = $1
       WHERE id = $2 AND business_id = $3 RETURNING *`,
      [userId ?? null, id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Project ${id} not found`);

    await this.recordEvent(id, businessId, "archived", userId, {});
    return this.rowToModel(res.rows[0]);
  }

  async restore(businessId: string, id: string, userId?: string): Promise<Project> {
    const project = await this.findById(businessId, id);
    if (project.status !== "archived") {
      throw new ConflictError(`Project ${id} is not archived`);
    }

    const res = await query(
      `UPDATE projects SET status = 'planning', version = version + 1, updated_at = NOW(), updated_by = $1
       WHERE id = $2 AND business_id = $3 RETURNING *`,
      [userId ?? null, id, businessId]
    );
    if (!res.rows.length) throw new NotFoundError(`Project ${id} not found`);

    await this.recordEvent(id, businessId, "restored", userId, {});
    return this.rowToModel(res.rows[0]);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const res = await query(
      `DELETE FROM projects WHERE id = $1 AND business_id = $2 RETURNING id`,
      [id, businessId]
    );
    if (res.rowCount === 0) throw new NotFoundError(`Project ${id} not found`);
  }

  // Financial sync helpers — called by invoice service on finalize / payment
  async recordInvoiceCreated(projectId: string, amount: Decimal.Value): Promise<void> {
    const amt = new Decimal(amount);
    await query(
      `UPDATE projects
       SET amount_invoiced = amount_invoiced + $1,
           remaining_billable = GREATEST(budget - (amount_invoiced + $1), 0),
           updated_at = NOW()
       WHERE id = $2`,
      [amt.toFixed(2), projectId]
    );
  }

  async recordPayment(projectId: string, amount: Decimal.Value): Promise<void> {
    const amt = new Decimal(amount);
    await query(
      `UPDATE projects
       SET amount_paid = amount_paid + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [amt.toFixed(2), projectId]
    );
  }

  // Tags
  async findTags(projectId: string, businessId: string): Promise<ProjectTag[]> {
    const res = await query(
      `SELECT t.* FROM project_tags t
       JOIN project_taggings pt ON pt.tag_id = t.id
       JOIN projects p ON pt.project_id = p.id
       WHERE pt.project_id = $1 AND p.business_id = $2`,
      [projectId, businessId]
    );
    return res.rows.map((r) => this.tagRowToModel(r));
  }

  async addTag(businessId: string, projectId: string, name: string, color = "#6b7280"): Promise<ProjectTag> {
    await this.findById(businessId, projectId);

    const existing = await query(
      `SELECT id FROM project_tags WHERE business_id = $1 AND name = $2`,
      [businessId, name]
    );

    let tagId: string;
    if (existing.rows.length) {
      tagId = existing.rows[0].id;
    } else {
      tagId = crypto.randomUUID();
      await query(
        `INSERT INTO project_tags (id, business_id, name, color, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [tagId, businessId, name, color]
      );
    }

    await query(
      `INSERT INTO project_taggings (project_id, tag_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (project_id, tag_id) DO NOTHING`,
      [projectId, tagId]
    );

    await this.recordEvent(projectId, businessId, "tag_added", undefined, { tagId, name });
    const tagRes = await query(`SELECT * FROM project_tags WHERE id = $1`, [tagId]);
    return this.tagRowToModel(tagRes.rows[0]);
  }

  async removeTag(businessId: string, projectId: string, tagId: string): Promise<void> {
    await this.findById(businessId, projectId);

    const res = await query(
      `DELETE FROM project_taggings WHERE project_id = $1 AND tag_id = $2 AND
       EXISTS (SELECT 1 FROM project_tags WHERE id = $2 AND business_id = $3)
       RETURNING tag_id`,
      [projectId, tagId, businessId]
    );
    if (res.rows.length) {
      await this.recordEvent(projectId, businessId, "tag_removed", undefined, { tagId });
    }
  }

  async findTagsByBusiness(businessId: string): Promise<ProjectTag[]> {
    const res = await query(
      `SELECT * FROM project_tags WHERE business_id = $1 ORDER BY name`,
      [businessId]
    );
    return res.rows.map((r) => this.tagRowToModel(r));
  }

  // Team members
  async findTeamMembers(projectId: string, businessId: string): Promise<ProjectTeamMember[]> {
    const res = await query(
      `SELECT ptm.* FROM project_team_members ptm
       JOIN projects p ON ptm.project_id = p.id
       WHERE ptm.project_id = $1 AND p.business_id = $2`,
      [projectId, businessId]
    );
    return res.rows.map((r) => this.teamMemberRowToModel(r));
  }

  async addTeamMember(businessId: string, projectId: string, userId: string, role = "member", assignedBy?: string): Promise<ProjectTeamMember> {
    await this.findById(businessId, projectId);

    const res = await query(
      `INSERT INTO project_team_members (project_id, business_id, user_id, role, assigned_at, assigned_by)
       VALUES ($1, $2, $3, $4, NOW(), $5)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [projectId, businessId, userId, role, assignedBy ?? null]
    );

    await this.recordEvent(projectId, businessId, "team_member_added", assignedBy, { userId, role });
    return this.teamMemberRowToModel(res.rows[0]);
  }

  async removeTeamMember(businessId: string, projectId: string, userId: string): Promise<void> {
    await this.findById(businessId, projectId);

    const res = await query(
      `DELETE FROM project_team_members
       WHERE project_id = $1 AND user_id = $2 AND business_id = $3
       RETURNING user_id`,
      [projectId, userId, businessId]
    );
    if (res.rows.length) {
      await this.recordEvent(projectId, businessId, "team_member_removed", undefined, { userId });
    }
  }

  // Events
  async getEvents(businessId: string, projectId: string, limit = 100): Promise<ProjectEvent[]> {
    const res = await query(
      `SELECT e.* FROM project_events e
       JOIN projects p ON e.project_id = p.id
       WHERE e.project_id = $1 AND p.business_id = $2
       ORDER BY e.created_at DESC LIMIT $3`,
      [projectId, businessId, limit]
    );
    return res.rows.map((r) => this.eventRowToModel(r));
  }

  async recordEvent(
    projectId: string,
    businessId: string,
    eventType: string,
    actorId?: string | null,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    await query(
      `INSERT INTO project_events (project_id, business_id, event_type, actor_id, actor_type, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [projectId, businessId, eventType, actorId, actorId ? "user" : "system", metadata ?? {}]
    );
  }

  // Financial summary
  async getFinancialSummary(businessId: string, projectId: string): Promise<ProjectFinancialSummary> {
    const project = await this.findById(businessId, projectId);
    const budget = new Decimal(project.budget);
    const amountInvoiced = new Decimal(project.amountInvoiced);
    const amountPaid = new Decimal(project.amountPaid);
    const remainingBillable = new Decimal(project.remainingBillable);
    const outstanding = amountInvoiced.minus(amountPaid);
    const budgetUtilization = budget.isZero() ? new Decimal(0) : amountInvoiced.dividedBy(budget).times(100);

    return {
      budget: budget.toFixed(2),
      amountInvoiced: amountInvoiced.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      remainingBillable: remainingBillable.toFixed(2),
      outstanding: outstanding.toFixed(2),
      budgetUtilization: budgetUtilization.toFixed(2),
    };
  }

  private rowToModel(r: Record<string, unknown>): Project {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      customerId: r.customer_id as string | null,
      name: r.name as string,
      description: r.description as string | null,
      status: r.status as Project["status"],
      startDate: rowToDate(r.start_date),
      dueDate: rowToDate(r.due_date),
      budget: r.budget as string,
      currency: r.currency as string,
      amountInvoiced: r.amount_invoiced as string,
      amountPaid: r.amount_paid as string,
      remainingBillable: r.remaining_billable as string,
      version: Number(r.version ?? 1),
      createdBy: r.created_by as string | null,
      updatedBy: r.updated_by as string | null,
      createdAt: rowToDate(r.created_at)!,
      updatedAt: rowToDate(r.updated_at)!,
    };
  }

  private listRowToModel(r: Record<string, unknown>): ProjectListItem {
    return {
      ...this.rowToModel(r),
      customerName: r.customer_name as string | null,
      customerEmail: r.customer_email as string | null,
      tagCount: Number(r.tag_count ?? 0),
      teamMemberCount: Number(r.team_member_count ?? 0),
    };
  }

  private tagRowToModel(r: Record<string, unknown>): ProjectTag {
    return {
      id: r.id as string,
      businessId: r.business_id as string,
      name: r.name as string,
      color: r.color as string,
      createdAt: rowToDate(r.created_at)!,
    };
  }

  private teamMemberRowToModel(r: Record<string, unknown>): ProjectTeamMember {
    return {
      id: r.id as string,
      projectId: r.project_id as string,
      businessId: r.business_id as string,
      userId: r.user_id as string,
      role: r.role as string,
      assignedAt: rowToDate(r.assigned_at)!,
      assignedBy: r.assigned_by as string | null,
    };
  }

  private eventRowToModel(r: Record<string, unknown>): ProjectEvent {
    return {
      id: r.id as string,
      projectId: r.project_id as string,
      businessId: r.business_id as string,
      eventType: r.event_type as string,
      actorId: r.actor_id as string | null,
      actorType: r.actor_type as string | null,
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: rowToDate(r.created_at)!,
    };
  }
}

export const projectRepository = new ProjectRepository();
import { Decimal } from "decimal.js";
import type { Project, ProjectStatus, ProjectTag, ProjectTeamMember, ProjectEvent, Customer } from "../domain/models/index.js";
import type {
  ProjectUpdateInput,
  ProjectFinancialSummary,
  ProjectListItem,
} from "../repositories/project.repo.js";
import type { PagedResult } from "../repositories/helpers.js";
import { ProjectRepository } from "../repositories/project.repo.js";
import { CustomerRepository } from "../repositories/customer.repo.js";
import { ConflictError, BusinessLogicError, ValidationError } from "../domain/errors.js";
import type { ProjectCreateInput, ProjectUpdateInput as SchemaProjectUpdateInput } from "../domain/schemas/project.js";
import { invoiceService } from "./invoice-service.js";
import type { DraftLineItem, DraftFee } from "./invoice-service.js";
import { projectTimeEntryRepository } from "../repositories/project-time.repo.js";

export interface ProjectSummary {
  project: Project;
  customer: Customer | null;
  tags: ProjectTag[];
  teamMembers: ProjectTeamMember[];
  financialSummary: ProjectFinancialSummary;
}

export interface ProjectSearchInput {
  search?: string;
  status?: "planning" | "active" | "on_hold" | "completed" | "archived";
  customerId?: string;
  tagId?: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ProjectSearchResponse {
  data: ProjectListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateInvoiceFromProjectInput {
  currency?: string;
  issueDate?: Date | null;
  dueDate?: Date | null;
  notes?: string | null;
  terms?: string | null;
  items?: DraftLineItem[];
  fees?: DraftFee[];
  includeUnbilledTime?: boolean;
}

export class ProjectService {
  constructor(private readonly repo: ProjectRepository, private readonly customerRepo: CustomerRepository) {}

  async create(input: ProjectCreateInput, businessId: string, userId?: string): Promise<Project> {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError("Project name is required");
    }
    if (input.dueDate && input.startDate && new Date(input.dueDate) < new Date(input.startDate)) {
      throw new BusinessLogicError("Due date must be on or after start date");
    }
    if (input.customerId) {
      await this.customerRepo.findById(businessId, input.customerId);
    }

    const project = await this.repo.create(businessId, {
      customerId: input.customerId ?? null,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? "planning",
      startDate: input.startDate ? new Date(input.startDate).toISOString() : null,
      dueDate: input.dueDate ? new Date(input.dueDate).toISOString() : null,
      budget: input.budget,
      currency: input.currency ?? "USD",
    }, userId);

    if (input.tags && input.tags.length > 0) {
      for (const tag of input.tags) {
        await this.repo.addTag(businessId, project.id, tag.name, tag.color);
      }
    }

    if (input.teamMemberIds && input.teamMemberIds.length > 0) {
      for (const userId of input.teamMemberIds) {
        try {
          await this.repo.addTeamMember(businessId, project.id, userId, "member", userId);
        } catch {
          // Skip team members that can't be added (e.g., user doesn't exist)
        }
      }
    }

    return project;
  }

  async getById(businessId: string, id: string): Promise<Project> {
    return this.repo.findById(businessId, id);
  }

  async getSummary(businessId: string, id: string): Promise<ProjectSummary> {
    const project = await this.repo.findById(businessId, id);
    let customer: Customer | null = null;
    if (project.customerId) {
      try {
        customer = await this.customerRepo.findById(businessId, project.customerId);
      } catch {
        customer = null;
      }
    }
    const tags = await this.repo.findTags(project.id, businessId);
    const teamMembers = await this.repo.findTeamMembers(project.id, businessId);
    const financialSummary = await this.repo.getFinancialSummary(businessId, id);

    return { project, customer, tags, teamMembers, financialSummary };
  }

  async update(
    businessId: string,
    id: string,
    input: SchemaProjectUpdateInput,
    userId?: string
  ): Promise<Project> {
    const existing = await this.repo.findById(businessId, id);

    if (input.dueDate && input.startDate && new Date(input.dueDate) < new Date(input.startDate)) {
      throw new BusinessLogicError("Due date must be on or after start date");
    }

    const update: ProjectUpdateInput = {};
    if (input.customerId !== undefined) {
      if (input.customerId) {
        await this.customerRepo.findById(businessId, input.customerId);
      }
      update.customerId = input.customerId ?? null;
    }
    if (input.name !== undefined) {
      if (!input.name || input.name.trim().length === 0) {
        throw new ValidationError("Project name cannot be empty");
      }
      update.name = input.name.trim();
    }
    if (input.description !== undefined) update.description = input.description ?? null;
    if (input.status !== undefined) update.status = input.status;
    if (input.startDate !== undefined) update.startDate = input.startDate ? new Date(input.startDate).toISOString() : null;
    if (input.dueDate !== undefined) update.dueDate = input.dueDate ? new Date(input.dueDate).toISOString() : null;
    if (input.budget !== undefined) {
      if (new Decimal(input.budget).isNegative()) {
        throw new ValidationError("Budget cannot be negative");
      }
      update.budget = input.budget;
      await this.repo.recordEvent(id, businessId, "budget_updated", userId, { budget: input.budget });
    }
    if (input.currency !== undefined) update.currency = input.currency;

    if (existing.status === "archived" && update.status !== "archived") {
      update.status = "planning" as ProjectStatus;
    }

    return this.repo.update(businessId, id, update, userId);
  }

  async updateStatus(businessId: string, id: string, status: ProjectStatus, userId?: string): Promise<Project> {
    const project = await this.repo.findById(businessId, id);
    if (project.status === "archived") {
      throw new BusinessLogicError("Cannot change status of an archived project");
    }
    return this.repo.updateStatus(businessId, id, status, userId);
  }

  async archive(businessId: string, id: string, userId?: string): Promise<Project> {
    const project = await this.repo.findById(businessId, id);
    if (project.status === "archived") {
      throw new ConflictError(`Project ${id} is already archived`);
    }
    return this.repo.archive(businessId, id, userId);
  }

  async restore(businessId: string, id: string, userId?: string): Promise<Project> {
    const project = await this.repo.findById(businessId, id);
    if (project.status !== "archived") {
      throw new ConflictError(`Project ${id} is not archived`);
    }
    return this.repo.restore(businessId, id, userId);
  }

  async delete(businessId: string, id: string): Promise<void> {
    const project = await this.repo.findById(businessId, id);
    if (project.status === "archived") {
      await this.repo.delete(businessId, id);
    } else {
      throw new BusinessLogicError("Archive the project first before deleting");
    }
  }

  async search(businessId: string, opts: ProjectSearchInput): Promise<ProjectSearchResponse> {
    const result = await this.repo.findMany(businessId, {
      search: opts.search,
      status: opts.status,
      customerId: opts.customerId,
      tagId: opts.tagId,
      includeArchived: opts.includeArchived,
      limit: opts.limit,
      offset: opts.offset,
      sortBy: opts.sortBy ?? "created_at",
      sortOrder: opts.sortOrder ?? "desc",
    });
    return { data: result.data, total: result.total, limit: result.limit, offset: result.offset };
  }

  async searchForSelection(businessId: string, search?: string): Promise<Project[]> {
    return this.repo.searchForSelection(businessId, search, 20);
  }

  // Tags
  async addTag(businessId: string, projectId: string, name: string, color?: string): Promise<ProjectTag> {
    const project = await this.repo.findById(businessId, projectId);
    return this.repo.addTag(businessId, project.id, name, color ?? "#6b7280");
  }

  async removeTag(businessId: string, projectId: string, tagId: string): Promise<void> {
    await this.repo.removeTag(businessId, projectId, tagId);
  }

  async getTags(businessId: string, projectId: string): Promise<ProjectTag[]> {
    await this.repo.findById(businessId, projectId);
    return this.repo.findTags(projectId, businessId);
  }

  async getTagsByBusiness(businessId: string): Promise<ProjectTag[]> {
    return this.repo.findTagsByBusiness(businessId);
  }

  // Team members
  async addTeamMember(businessId: string, projectId: string, userId: string, role?: string, assignedBy?: string): Promise<ProjectTeamMember> {
    await this.repo.findById(businessId, projectId);
    return this.repo.addTeamMember(businessId, projectId, userId, role ?? "member", assignedBy);
  }

  async removeTeamMember(businessId: string, projectId: string, userId: string): Promise<void> {
    await this.repo.removeTeamMember(businessId, projectId, userId);
  }

  async getTeamMembers(businessId: string, projectId: string): Promise<ProjectTeamMember[]> {
    await this.repo.findById(businessId, projectId);
    return this.repo.findTeamMembers(projectId, businessId);
  }

  // Events / activity
  async getEvents(businessId: string, projectId: string, limit = 100): Promise<ProjectEvent[]> {
    await this.repo.findById(businessId, projectId);
    return this.repo.getEvents(businessId, projectId, limit);
  }

  // Financial summary
  async getFinancialSummary(businessId: string, projectId: string): Promise<ProjectFinancialSummary> {
    await this.repo.findById(businessId, projectId);
    return this.repo.getFinancialSummary(businessId, projectId);
  }

  // Invoices for project
  async getInvoices(businessId: string, projectId: string, opts: { limit?: number; offset?: number; status?: string } = {}): Promise<PagedResult<any>> {
    const { invoiceRepository } = await import("../repositories/invoice.repo.js");
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;
    const data = await invoiceRepository.findMany(businessId, {
      projectId,
      status: opts.status,
      limit,
      offset,
    });
    return { data, total: data.length, limit, offset };
  }

  // Create invoice directly from a project
  async createInvoiceFromProject(
    businessId: string,
    projectId: string,
    input: CreateInvoiceFromProjectInput,
    userId?: string
  ): Promise<{ invoiceId: string }> {
    const project = await this.repo.findById(businessId, projectId);
    if (!project.customerId) {
      throw new BusinessLogicError("Project must have a customer to create an invoice");
    }

    let items = input.items ?? [];

    if (input.includeUnbilledTime !== false) {
      const timeLineItems = await projectTimeEntryRepository.convertToLineItems(
        businessId,
        projectId,
        ""
      );
      if (timeLineItems.length > 0) {
        items = [...items, ...timeLineItems];
      }
    }

    const invoiceId = await invoiceService.createDraft({
      customerId: project.customerId,
      projectId: project.id,
      currency: input.currency ?? project.currency,
      issueDate: input.issueDate ?? null,
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? project.description ?? null,
      terms: input.terms ?? null,
      items: items.length > 0 ? items : undefined,
      fees: input.fees,
    }, businessId, userId);

    if (input.includeUnbilledTime !== false && items.length > 0) {
      await projectTimeEntryRepository.markInvoiced(businessId, projectId, invoiceId);
    }

    await this.repo.recordEvent(projectId, businessId, "invoice_created", userId, {
      invoiceId,
      currency: input.currency ?? project.currency,
      includedTimeEntries: input.includeUnbilledTime !== false,
      lineItemCount: items.length,
    });

    return { invoiceId };
  }
}

export const projectService = new ProjectService(new ProjectRepository(), new CustomerRepository());

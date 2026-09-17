import { Decimal } from "decimal.js";
import { projectTimeEntryRepository, type ProjectTimeEntryRepository } from "../repositories/project-time.repo.js";
import type { TimeEntrySearchOpts } from "../repositories/project-time.repo.js";
import { ProjectRepository } from "../repositories/project.repo.js";
import type { ProjectTimeEntry, ProjectTimeEntrySummary, ProjectNote } from "../domain/models/project-time.js";
import type { ProjectTimeEntryCreateInput, ProjectTimeEntryUpdateInput, ProjectNoteCreateInput } from "../domain/schemas/project-time-entry.js";
import { BusinessLogicError } from "../domain/errors.js";
import type { PagedResult } from "../repositories/helpers.js";
import type { DraftLineItem } from "./invoice-service.js";

export class ProjectTimeEntryService {
  constructor(
    private readonly timeRepo: ProjectTimeEntryRepository = projectTimeEntryRepository,
    private readonly projectRepo: ProjectRepository = new ProjectRepository()
  ) {}

  async create(
    businessId: string,
    projectId: string,
    input: ProjectTimeEntryCreateInput,
    userId?: string | null
  ): Promise<ProjectTimeEntry> {
    const project = await this.projectRepo.findById(businessId, projectId);

    if (project.status === "archived") {
      throw new BusinessLogicError("Cannot add time entries to an archived project");
    }

    const entry = await this.timeRepo.create(businessId, projectId, input, userId ?? null);

    await this.projectRepo.recordEvent(projectId, businessId, "time_entry_logged", userId ?? null, {
      entryId: entry.id,
      durationMinutes: entry.durationMinutes,
      billable: entry.billable,
      billableAmount: entry.billableAmount,
    });

    return entry;
  }

  async getById(businessId: string, id: string): Promise<ProjectTimeEntry> {
    return this.timeRepo.findById(businessId, id);
  }

  async getProjectEntries(
    businessId: string,
    projectId: string,
    opts: TimeEntrySearchOpts = {}
  ): Promise<PagedResult<ProjectTimeEntry>> {
    await this.projectRepo.findById(businessId, projectId);
    return this.timeRepo.findMany(businessId, projectId, opts);
  }

  async update(
    businessId: string,
    entryId: string,
    input: ProjectTimeEntryUpdateInput
  ): Promise<ProjectTimeEntry> {
    const entry = await this.timeRepo.findById(businessId, entryId);

    const updated = await this.timeRepo.update(businessId, entryId, input);

    await this.projectRepo.recordEvent(entry.projectId, businessId, "time_entry_updated", undefined, {
      entryId: entry.id,
      fields: Object.keys(input),
    });

    return updated;
  }

  async delete(businessId: string, entryId: string): Promise<void> {
    const entry = await this.timeRepo.findById(businessId, entryId);
    if (entry.isInvoiced) {
      throw new BusinessLogicError("Cannot delete a time entry that has been invoiced");
    }

    await this.timeRepo.delete(businessId, entryId);

    await this.projectRepo.recordEvent(entry.projectId, businessId, "time_entry_deleted", undefined, {
      entryId: entry.id,
    });
  }

  /**
   * Start a timer for a new time entry on a project
   */
  async startTimer(
    businessId: string,
    projectId: string,
    input: {
      description?: string;
      billable?: boolean;
      billableRate?: string | number;
      catalogServiceId?: string | null;
    },
    userId?: string | null
  ): Promise<ProjectTimeEntry> {
    const project = await this.projectRepo.findById(businessId, projectId);

    if (project.status === "archived") {
      throw new BusinessLogicError("Cannot start a timer on an archived project");
    }

    const now = new Date().toISOString();
    return this.timeRepo.create(businessId, projectId, {
      catalogServiceId: input.catalogServiceId ?? null,
      description: input.description ?? "Running timer",
      billable: input.billable ?? true,
      startTime: now,
      endTime: null,
      durationMinutes: null,
      billableRate: input.billableRate ?? "0",
    }, userId ?? null);
  }

  async stopTimer(
    businessId: string,
    entryId: string,
    userId?: string | null
  ): Promise<ProjectTimeEntry> {
    const entry = await this.timeRepo.findById(businessId, entryId);

    if (entry.endTime !== null || entry.isInvoiced) {
      throw new BusinessLogicError("Cannot stop a timer that is already stopped or invoiced");
    }

    const now = new Date().toISOString();
    const updated = await this.timeRepo.update(businessId, entryId, {
      endTime: now,
      durationMinutes: this.computeDurationMinutes(entry.startTime, now),
    });

    const duration = updated.durationMinutes ?? 0;
    const rate = new Decimal(updated.billableRate);
    const amount = new Decimal(duration).div(60).mul(rate);

    await this.projectRepo.recordEvent(entry.projectId, businessId, "timer_stopped", userId ?? null, {
      entryId: entry.id,
      durationMinutes: duration,
      billableAmount: amount.toFixed(6),
    });

    return updated;
  }

  async getSummary(businessId: string, projectId: string, currency = "USD"): Promise<ProjectTimeEntrySummary> {
    await this.projectRepo.findById(businessId, projectId);
    return this.timeRepo.getSummary(businessId, projectId, currency);
  }

  async convertToLineItems(
    businessId: string,
    projectId: string,
    invoiceId: string
  ): Promise<DraftLineItem[]> {
    await this.projectRepo.findById(businessId, projectId);
    return this.timeRepo.convertToLineItems(businessId, projectId, invoiceId);
  }

  async markEntriesInvoiced(
    businessId: string,
    projectId: string,
    invoiceId: string
  ): Promise<void> {
    await this.timeRepo.markInvoiced(businessId, projectId, invoiceId);

    await this.projectRepo.recordEvent(projectId, businessId, "invoice_generated_from_time", undefined, {
      invoiceId,
    });
  }

  async addNote(
    businessId: string,
    projectId: string,
    input: ProjectNoteCreateInput,
    userId?: string | null
  ): Promise<ProjectNote> {
    await this.projectRepo.findById(businessId, projectId);
    return this.timeRepo.addNote(businessId, projectId, input, userId ?? null);
  }

  async getNotes(
    businessId: string,
    projectId: string,
    limit?: number,
    offset?: number
  ): Promise<PagedResult<ProjectNote>> {
    await this.projectRepo.findById(businessId, projectId);
    return this.timeRepo.getNotes(businessId, projectId, limit, offset);
  }

  async deleteNote(businessId: string, projectId: string, noteId: string): Promise<void> {
    await this.timeRepo.deleteNote(businessId, projectId, noteId);
  }

  private computeDurationMinutes(startTime: string | Date | null, endTime: string | Date): number | null {
    if (!startTime || !endTime) return null;
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (end < start) return null;
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }
}

export const projectTimeEntryService = new ProjectTimeEntryService();

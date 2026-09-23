import type { PagedResult } from "../repositories/helpers.js";

export interface Repository<T, ID extends string = string> {
  findById(id: ID): Promise<T | null>;
  findMany(filters?: Record<string, unknown>): Promise<T[]>;
  findOne(filters?: Record<string, unknown>): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T | null>;
  delete(id: ID): Promise<boolean>;
}

export interface PagedQuery {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedRepository<T> {
  findPaged(filters?: Record<string, unknown>, query?: PagedQuery): Promise<PagedResult<T>>;
}

export interface VersionedRepository<T> {
  updateOptimistic(id: string, data: Partial<T>, expectedVersion: number): Promise<T | null>;
}

export interface InvoiceRepository {
  findById(businessId: string, id: string): Promise<unknown>;
  findMany(businessId: string, filters?: Record<string, unknown>): Promise<unknown[]>;
  findPaged(businessId: string, opts?: Record<string, unknown>): Promise<PagedResult<unknown>>;
  createDraft(businessId: string, input: Record<string, unknown>): Promise<string>;
  update(businessId: string, id: string, input: Partial<Record<string, unknown>>): Promise<unknown>;
  updateOptimistic(businessId: string, id: string, input: Partial<Record<string, unknown>>, expectedVersion: number): Promise<unknown>;
  finalize(businessId: string, invoiceId: string, opts: { finalizedAt: Date }): Promise<void>;
  setStatus(invoiceId: string, status: string, fields?: Record<string, unknown>): Promise<void>;
}

export interface CustomerRepository {
  findById(businessId: string, id: string): Promise<unknown>;
  findMany(businessId: string, opts?: Record<string, unknown>): Promise<unknown[]>;
  findPaged(businessId: string, opts?: Record<string, unknown>): Promise<PagedResult<unknown>>;
  create(businessId: string, input: Record<string, unknown>): Promise<unknown>;
  update(businessId: string, id: string, input: Record<string, unknown>): Promise<unknown>;
  archive(businessId: string, id: string): Promise<unknown>;
}

export interface TemplateRepository {
  findById(businessId: string, id: string): Promise<unknown>;
  findMany(businessId: string): Promise<unknown[]>;
  create(businessId: string, input: Record<string, unknown>): Promise<unknown>;
  update(businessId: string, id: string, input: Record<string, unknown>): Promise<unknown>;
  delete(businessId: string, id: string): Promise<boolean>;
}

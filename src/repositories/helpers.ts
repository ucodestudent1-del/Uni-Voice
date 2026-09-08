import { Decimal } from "decimal.js";

export function toDecimal(v: unknown): Decimal {
  if (v === null || v === undefined) return new Decimal(0);
  if (v instanceof Decimal) return v;
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") {
    return new Decimal(v);
  }
  return new Decimal(0);
}

export function rowToDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  const d = new Date(v as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface Paging {
  limit: number;
  offset: number;
}

export interface PagedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

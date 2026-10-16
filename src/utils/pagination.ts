import type { Query } from "express-serve-static-core";

const MAX_LIMIT = 200;
const MIN_LIMIT = 1;
const DEFAULT_LIMIT = 25;
const DEFAULT_OFFSET = 0;

export interface PaginationParams {
  limit: number;
  offset: number;
}

export function parsePagination(
  query: Query,
  maxLimit = MAX_LIMIT,
  defaults: Partial<PaginationParams> = {},
): PaginationParams {
  const limit = Math.min(
    Math.max(Number(query.limit ?? defaults.limit ?? DEFAULT_LIMIT), MIN_LIMIT),
    maxLimit,
  );
  const offset = Math.max(Number(query.offset ?? defaults.offset ?? DEFAULT_OFFSET), 0);

  const result: PaginationParams = { limit, offset };
  if (Number.isNaN(result.limit)) result.limit = defaults.limit ?? DEFAULT_LIMIT;
  if (Number.isNaN(result.offset)) result.offset = defaults.offset ?? DEFAULT_OFFSET;
  return result;
}

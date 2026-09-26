export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

export function camelToSnake<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(camelToSnake) as unknown as T;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[toSnakeCase(key)] = camelToSnake((obj as Record<string, unknown>)[key]);
  }
  return result as T;
}

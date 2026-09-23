import { Decimal } from "decimal.js";

export type DecimalValue = Decimal.Value;

export { Decimal };

export function toDecimal(value: unknown): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  if (value instanceof Decimal) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    return new Decimal(value);
  }
  return new Decimal(0);
}

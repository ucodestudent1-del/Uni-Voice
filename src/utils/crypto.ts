import { randomBytes } from "node:crypto";

export function generateSecureToken(length = 32): string {
  return randomBytes(length).toString("hex");
}

export function generatePublicInvoiceToken(): string {
  return generateSecureToken(24);
}

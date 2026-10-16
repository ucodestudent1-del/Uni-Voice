import { z } from "zod";

export const DocumentTextInputSchema = z.object({
  notes: z.string().max(10000, "Notes must be 10,000 characters or fewer").nullish(),
  terms: z.string().max(10000, "Terms must be 10,000 characters or fewer").nullish(),
  paymentInstructions: z
    .string()
    .max(5000, "Payment instructions must be 5,000 characters or fewer")
    .nullish(),
  scopeOfWork: z
    .string()
    .max(10000, "Scope of work must be 10,000 characters or fewer")
    .nullish(),
  internalNotes: z
    .string()
    .max(5000, "Internal notes must be 5,000 characters or fewer")
    .nullish(),
  poNumber: z
    .string()
    .max(100, "PO number must be 100 characters or fewer")
    .nullish(),
  projectReference: z
    .string()
    .max(200, "Project reference must be 200 characters or fewer")
    .nullish(),
  description: z
    .string()
    .max(2000, "Description must be 2,000 characters or fewer")
    .nullish(),
});

export type DocumentTextInput = z.infer<typeof DocumentTextInputSchema>;

export function validateDocumentTextInput(
  input: Record<string, unknown>,
): DocumentTextInput {
  return DocumentTextInputSchema.parse(input);
}

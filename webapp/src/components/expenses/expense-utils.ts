import type { ExpenseCategoryColor } from "@/types/expenses";

export const colorOptions: { value: ExpenseCategoryColor; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "primary", label: "Primary" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "tertiary", label: "Tertiary" },
  { value: "secondary", label: "Secondary" },
];

import { ExpensesCategory, ExpenseCategoryColor } from "@/types/expenses";

export const EXPENSE_CATEGORY_CONFIG: Record<ExpensesCategory, { label: string; color: ExpenseCategoryColor; icon: string }> = {
  supplies: { label: "Supplies", color: "info", icon: "🖇" },
  software: { label: "Software", color: "primary", icon: "💻" },
  meals: { label: "Meals", color: "warning", icon: "🍽" },
  travel: { label: "Travel", color: "info", icon: "✈" },
  office: { label: "Office", color: "tertiary", icon: "🏢" },
  marketing: { label: "Marketing", color: "success", icon: "📈" },
  utilities: { label: "Utilities", color: "warning", icon: "💡" },
  professional_fees: { label: "Professional Fees", color: "error", icon: "🏛" },
  taxes: { label: "Taxes", color: "error", icon: "📊" },
  insurance: { label: "Insurance", color: "info", icon: "🛡" },
  equipment: { label: "Equipment", color: "success", icon: "⚙" },
  other: { label: "Other", color: "tertiary", icon: "📁" },
};

export const EXPENSE_CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_CONFIG).map(
  ([value, config]) => ({ value, label: config.label, icon: config.icon })
);

const CATEGORY_BG: Record<ExpenseCategoryColor, string> = {
  primary: "bg-primary-bg text-on-primary",
  secondary: "status-info-bg status-info-text",
  success: "status-success-bg status-success-text",
  warning: "status-warning-bg status-warning-text",
  error: "status-error-bg status-error-text",
  tertiary: "status-tertiary-bg status-tertiary-text",
  info: "status-info-bg status-info-text",
};

export interface ExpenseCategoryBadgeProps {
  category: ExpensesCategory;
}

export default function ExpenseCategoryBadge({ category }: ExpenseCategoryBadgeProps) {
  const config = EXPENSE_CATEGORY_CONFIG[category] ?? EXPENSE_CATEGORY_CONFIG.other;
  const classes = CATEGORY_BG[config.color] ?? CATEGORY_BG.tertiary;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

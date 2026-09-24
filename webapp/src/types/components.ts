import type { ButtonHTMLAttributes, ForwardRefExoticComponent, HTMLAttributes, ReactNode, Ref, SVGProps } from "react";
import type { LucideIcon } from "lucide-react";

export type {
  ButtonHTMLAttributes,
  ForwardRefExoticComponent,
  HTMLAttributes,
  ReactNode,
  Ref,
  SVGProps,
  LucideIcon,
};

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "link";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  children?: ReactNode;
}

export interface MoneyProps extends HTMLAttributes<HTMLSpanElement> {
  amount: number | string;
  currency?: string;
  decimalPlaces?: number;
  signed?: boolean;
  placeholder?: string;
}

export interface ColumnDef<TData> {
  header: ReactNode;
  accessor: keyof TData | ((row: TData) => unknown);
  cell?: (row: TData, value: unknown) => ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
}

export interface DataTableProps<TData> extends HTMLAttributes<HTMLDivElement> {
  columns: ColumnDef<TData>[];
  data: TData[];
  sortColumn?: string | null;
  sortOrder?: "asc" | "desc";
  onSort?: (column: string) => void;
  totalRows?: number;
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  isLoading?: boolean;
  emptyMessage?: ReactNode;
  rowKey?: keyof TData | ((row: TData) => string);
  selectedRows?: Set<string>;
  onSelectRow?: (id: string) => void;
  onSelectAll?: (selected: boolean) => void;
  selectAllChecked?: boolean;
  selectAllIndeterminate?: boolean;
  actions?: ReactNode;
  rowClassName?: (row: TData) => string;
}

export interface ToastProps {
  id: string;
  type?: ToastType;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastContextValue {
  addToast: (toast: Omit<ToastProps, "id">) => string;
  removeToast: (id: string) => void;
  toast: (
    message: string,
    options?: {
      type?: ToastType;
      title?: string;
      duration?: number;
      actionLabel?: string;
      onAction?: () => void;
    }
  ) => void;
}

export interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data?: Record<string, string>) => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  showInput?: boolean;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  inputRequiredMatch?: string;
  isLoading?: boolean;
}

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  variant?: "default" | "compact" | "sidebar";
}

export interface TopBarProps {
  onSearchFocus?: () => void;
  onCommandPalette?: () => void;
  notifications?: Array<{ id: string; title: string; message: string; unread: boolean; time: string }>;
  workspaces?: Array<{ id: string; name: string; currency: string }>;
  currentWorkspaceId?: string;
  onWorkspaceChange?: (id: string) => void;
  user?: { name: string; email: string; avatar?: string };
  onLogout?: () => void;
  onSettings?: () => void;
}

export interface AppShellProps {
  children: ReactNode;
  topBar?: TopBarProps;
  sidebar?: ReactNode;
  bottomBar?: ReactNode;
  className?: string;
}

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  title: string;
  breadcrumbs?: BreadcrumbItem[];
  description?: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export interface FeatureFlagProps {
  feature: string;
  requiredPlan?: string;
  children?: ReactNode;
  fallback?: ReactNode;
  planOnly?: boolean;
}

export interface UpgradePromptProps {
  feature: string;
  requiredPlan?: string;
  title?: string;
  description?: string;
  message?: string;
  children?: ReactNode;
}

export interface StatusBadgeProps {
  status: string;
  isOverdue?: boolean;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

export interface CustomerStatusBadgeProps {
  status: string;
  showIcon?: boolean;
  className?: string;
}

export interface ProjectStatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
}

export interface SubscriptionCardProps {
  onUpgrade?: () => void;
  compact?: boolean;
}

export type InvoiceStatusType =
  | "draft"
  | "sent"
  | "viewed"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "void"
  | "pending"
  | "failed"
  | "refunded";

export interface InvoiceStatusProps {
  status: InvoiceStatusType | (string & {});
  isOverdue?: boolean;
  showIcon?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export type PaymentStatusType = "paid" | "pending" | "failed" | "refunded" | "partially_paid" | "cancelled" | "requires_action";

export interface PaymentStatusProps {
  status: PaymentStatusType | (string & {});
  showIcon?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

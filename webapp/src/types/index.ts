export * from "./api";
export * from "./settings";

export {
  DEFAULT_LINE_ITEM,
  DEFAULT_FEE,
  DEFAULT_DISCOUNT,
  LINE_ITEM_UNITS,
  generateRowId,
} from "./quote-builder";

export type {
  BuilderLineItem,
  BuilderFee,
  BuilderDiscount,
  QuoteBuilderData,
  SaveState,
} from "./quote-builder";

export type {
  DiscountType,
  DiscountDefinition,
  LineItemInput,
  FeeInput,
  InvoiceCalculationInput,
  CalculatedLineItem,
  CalculatedFee,
  CalculationResult,
} from "./calculation";

export { calculationEngine, discountAmount, CalculationEngine } from "../utils/calculation";

export type { CurrencyCode, CurrencyMetadata } from "./currency";

export {
  SUPPORTED_CURRENCIES,
  getCurrencyMetadata,
  getDefaultCurrency,
  formatMoney,
} from "./currency";

export type {
  ValidationSeverity,
  ValidationIssue,
  ValidatableItem,
  ValidatableFee,
  ValidationInput,
  InvoiceValidationState,
} from "./validation";

export {
  EMPTY_VALIDATION_STATE,
  validateInvoice,
  validateInvoiceSync,
} from "./validation";

export type { AnalyticsEventName, AnalyticsEvent, Analytics } from "./analytics";

export { ANALYTICS_EVENTS, analytics } from "./analytics";

export type { FeatureItem, FaqItem, TemplateModule, FeatureIcon } from "./landing";

export { pricingFeatures, faqs, templateModules } from "./landing";

export type { CustomerFormValues } from "./customer-schema";

export { CustomerFormSchema, validateCustomerForm } from "./customer-schema";

export type {
  User,
  AuthContextType,
  Plan,
  SubscriptionCache,
  SubscriptionContextType,
  Theme,
  ThemeContextType,
  PlanTier,
  TierOrder,
} from "./app";

export type {
  ButtonVariant,
  ButtonSize,
  ButtonProps,
  MoneyProps,
  ColumnDef,
  DataTableProps,
  ToastProps,
  ToastType,
  ToastContextValue,
  ConfirmationDialogProps,
  EmptyStateProps,
  TopBarProps,
  AppShellProps,
  BreadcrumbItem,
  PageHeaderProps,
  FeatureFlagProps,
  UpgradePromptProps,
  StatusBadgeProps,
  CustomerStatusBadgeProps,
  ProjectStatusBadgeProps,
  SubscriptionCardProps,
  InvoiceStatusType,
  InvoiceStatusProps,
  PaymentStatusType,
  PaymentStatusProps,
} from "./components";

export type {
  ComponentDefinition,
  RenderContext,
  InspectorContext,
  PaletteItem,
  InsertComponentParams,
  UpdateComponentParams,
  MoveComponentParams,
  MoveComponentToParams,
  RemoveComponentParams,
  DuplicateComponentParams,
  SetSettingsParams,
  DocumentOperation,
  ValidationResult,
} from "../document-model";

export {
  insertComponent,
  updateComponent,
  moveComponent,
  removeComponent,
  duplicateComponent,
  setDocumentSettings,
} from "../document-model";

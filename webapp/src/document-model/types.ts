import { z } from "zod";

export type ComponentId = string;
export type SectionId = string;
export type RowId = string;
export type ColumnId = string;
export type ParentId = ComponentId | SectionId | RowId | ColumnId;
export type UUID = string;

export function makeUUID(): UUID {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface StyleProps {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | "normal" | "bold";
  color?: string;
  backgroundColor?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  padding?: string | number;
  paddingTop?: string | number;
  paddingRight?: string | number;
  paddingBottom?: string | number;
  paddingLeft?: string | number;
  margin?: string | number;
  marginTop?: string | number;
  marginRight?: string | number;
  marginBottom?: string | number;
  border?: string;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderRadius?: string | number;
  width?: string | number;
  height?: string | number;
  minWidth?: string | number;
  minHeight?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;
  display?: "block" | "inline-block" | "flex" | "grid" | "none";
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
  gap?: string | number;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  opacity?: number;
  visibility?: "visible" | "hidden" | "collapse";
  overflow?: "visible" | "hidden" | "scroll" | "auto";
  [key: string]: unknown;
}

export interface LayoutStyleProps extends StyleProps {
  columns?: number;
  columnGap?: string | number;
  rowGap?: string | number;
}

export type ComponentType =
  | "text"
  | "image"
  | "logo"
  | "customerInfo"
  | "invoiceNumber"
  | "date"
  | "lineItems"
  | "subtotal"
  | "tax"
  | "discount"
  | "paymentTerms"
  | "signature"
  | "customField"
  | "notes"
  | "terms"
  | "paymentInstructions"
  | "fees"
  | "total"
  | "amountDue"
  | "businessInfo"
  | "spacer"
  | "divider"
  | "section"
  | "row"
  | "column";

export const StructuralComponentTypes: ComponentType[] = ["section", "row", "column"];
export const BusinessComponentTypes: ComponentType[] = [
  "text", "image", "logo", "customerInfo", "invoiceNumber", "date",
  "lineItems", "subtotal", "tax", "discount", "paymentTerms", "signature",
  "customField", "notes", "terms", "paymentInstructions", "fees",
  "total", "amountDue", "businessInfo", "spacer", "divider"
];

export function isStructuralComponent(type: ComponentType): boolean {
  return StructuralComponentTypes.includes(type);
}

export function isBusinessComponent(type: ComponentType): boolean {
  return BusinessComponentTypes.includes(type);
}

export interface BaseComponent {
  id: ComponentId;
  type: ComponentType;
  props: Record<string, unknown>;
  style: StyleProps;
  children?: ComponentId[];
  parentId?: ComponentId | SectionId | RowId | ColumnId;
  visible?: boolean;
  condition?: string;
}

export interface TextComponent extends BaseComponent {
  type: "text";
  props: {
    content: string;
    format?: "plain" | "markdown" | "html";
  };
}

export interface ImageComponent extends BaseComponent {
  type: "image" | "logo";
  props: {
    src: string;
    alt?: string;
    width?: number | string;
    height?: number | string;
    fit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  };
}

export interface CustomerInfoComponent extends BaseComponent {
  type: "customerInfo";
  props: {
    showName: boolean;
    showCompany: boolean;
    showEmail: boolean;
    showAddress: boolean;
    showPhone: boolean;
    label?: string;
  };
}

export interface InvoiceNumberComponent extends BaseComponent {
  type: "invoiceNumber";
  props: {
    prefix?: string;
    format?: string;
    label?: string;
  };
}

export interface DateComponent extends BaseComponent {
  type: "date";
  props: {
    dateType: "issue" | "due" | "custom";
    format?: string;
    label?: string;
    customValue?: string;
  };
}

export interface LineItemsComponent extends BaseComponent {
  type: "lineItems";
  props: {
    columns: LineItemColumn[];
    showHeader: boolean;
    showQuantity: boolean;
    showUnit: boolean;
    showUnitPrice: boolean;
    showDiscount: boolean;
    showTax: boolean;
    showLineTotal: boolean;
    currency: string;
    allowMultiPage: boolean;
    emptyStateMessage?: string;
  };
}

export interface LineItemColumn {
  key: string;
  label: string;
  width?: string | number;
  align?: "left" | "center" | "right";
  visible: boolean;
}

export interface SubtotalComponent extends BaseComponent {
  type: "subtotal";
  props: {
    label?: string;
    currency: string;
  };
}

export interface TaxComponent extends BaseComponent {
  type: "tax";
  props: {
    label?: string;
    currency: string;
    showBreakdown: boolean;
  };
}

export interface DiscountComponent extends BaseComponent {
  type: "discount";
  props: {
    label?: string;
    currency: string;
  };
}

export interface PaymentTermsComponent extends BaseComponent {
  type: "paymentTerms";
  props: {
    content: string;
    label?: string;
  };
}

export interface SignatureComponent extends BaseComponent {
  type: "signature";
  props: {
    label?: string;
    placeholder?: string;
    showDate: boolean;
    showName: boolean;
  };
}

export interface CustomFieldComponent extends BaseComponent {
  type: "customField";
  props: {
    key: string;
    label: string;
    value: string;
    type: "text" | "number" | "date" | "select";
    options?: string[];
  };
}

export interface NotesComponent extends BaseComponent {
  type: "notes";
  props: {
    content: string;
    label?: string;
  };
}

export interface TermsComponent extends BaseComponent {
  type: "terms";
  props: {
    content: string;
    label?: string;
  };
}

export interface PaymentInstructionsComponent extends BaseComponent {
  type: "paymentInstructions";
  props: {
    content: string;
    label?: string;
  };
}

export interface FeesComponent extends BaseComponent {
  type: "fees";
  props: {
    label?: string;
    currency: string;
    showHeader: boolean;
  };
}

export interface TotalComponent extends BaseComponent {
  type: "total";
  props: {
    label?: string;
    currency: string;
  };
}

export interface AmountDueComponent extends BaseComponent {
  type: "amountDue";
  props: {
    label?: string;
    currency: string;
  };
}

export interface BusinessInfoComponent extends BaseComponent {
  type: "businessInfo";
  props: {
    showName: boolean;
    showEmail: boolean;
    showPhone: boolean;
    showWebsite: boolean;
    showAddress: boolean;
    showLogo: boolean;
    label?: string;
  };
}

export interface SpacerComponent extends BaseComponent {
  type: "spacer";
  props: {
    height: number | string;
  };
}

export interface DividerComponent extends BaseComponent {
  type: "divider";
  props: {
    thickness: number;
    color: string;
    style: "solid" | "dashed" | "dotted";
  };
}

export interface SectionComponent extends BaseComponent {
  type: "section";
  props: {
    name: string;
    fullWidth: boolean;
  };
  children: RowId[];
}

export interface RowComponent extends BaseComponent {
  type: "row";
  props: {
    name: string;
    columns: number;
    columnGap: number | string;
    rowGap: number | string;
  };
  children: ColumnId[];
}

export interface ColumnComponent extends BaseComponent {
  type: "column";
  props: {
    name: string;
    span: number;
  };
  children: ComponentId[];
}

export type AnyComponent =
  | TextComponent
  | ImageComponent
  | CustomerInfoComponent
  | InvoiceNumberComponent
  | DateComponent
  | LineItemsComponent
  | SubtotalComponent
  | TaxComponent
  | DiscountComponent
  | PaymentTermsComponent
  | SignatureComponent
  | CustomFieldComponent
  | NotesComponent
  | TermsComponent
  | PaymentInstructionsComponent
  | FeesComponent
  | TotalComponent
  | AmountDueComponent
  | BusinessInfoComponent
  | SpacerComponent
  | DividerComponent
  | SectionComponent
  | RowComponent
  | ColumnComponent;

export interface InvoiceDocument {
  id: UUID;
  version: number;
  name: string;
  businessId: UUID;
  createdAt: string;
  updatedAt: string;
  sections: Record<SectionId, SectionComponent>;
  rows: Record<RowId, RowComponent>;
  columns: Record<ColumnId, ColumnComponent>;
  components: Record<ComponentId, AnyComponent>;
  rootSectionId: SectionId;
  settings: DocumentSettings;
}

export interface DocumentSettings {
  pageSize: "A4" | "Letter" | "Legal";
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
  defaultFont: string;
  defaultFontSize: number;
  defaultColor: string;
  currency: string;
  locale: string;
}

export interface DragState {
  activeComponentId: ComponentId | null;
  activeComponentType: ComponentType | null;
  source: "palette" | "canvas";
  originalParentId: ComponentId | SectionId | RowId | ColumnId | null;
  originalIndex: number;
  targetParentId: ComponentId | SectionId | RowId | ColumnId | null;
  targetIndex: number;
  dragOverlay: React.ReactNode | null;
}

export interface EditorState {
  document: InvoiceDocument;
  selectedComponentId: ComponentId | null;
  dragState: DragState | null;
  history: InvoiceDocument[];
  historyIndex: number;
  dirty: boolean;
}

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  pageSize: "A4",
  orientation: "portrait",
  margins: { top: 40, right: 40, bottom: 40, left: 40 },
  defaultFont: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  defaultFontSize: 14,
  defaultColor: "#1f2937",
  currency: "USD",
  locale: "en-US",
};

export function createEmptyDocument(businessId: UUID, name = "Untitled Invoice"): InvoiceDocument {
  const rootSectionId = makeUUID();
  const rowId = makeUUID();
  const columnId = makeUUID();

  const rootSection: SectionComponent = {
    id: rootSectionId,
    type: "section",
    props: { name: "Main", fullWidth: true },
    style: {},
    children: [rowId],
    parentId: undefined,
    visible: true,
  };

  const row: RowComponent = {
    id: rowId,
    type: "row",
    props: { name: "Header Row", columns: 1, columnGap: 16, rowGap: 16 },
    style: {},
    children: [columnId],
    parentId: rootSectionId,
    visible: true,
  };

  const column: ColumnComponent = {
    id: columnId,
    type: "column",
    props: { name: "Main Column", span: 12 },
    style: {},
    children: [],
    parentId: rowId,
    visible: true,
  };

  return {
    id: makeUUID(),
    version: 1,
    name,
    businessId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sections: { [rootSectionId]: rootSection },
    rows: { [rowId]: row },
    columns: { [columnId]: column },
    components: {},
    rootSectionId,
    settings: DEFAULT_DOCUMENT_SETTINGS,
  };
}

export function createComponent<T extends AnyComponent>(type: T["type"], props: T["props"], style: StyleProps = {}): T {
  const id = makeUUID();
  return {
    id,
    type,
    props,
    style,
    children: [],
    parentId: undefined,
    visible: true,
  } as unknown as T;
}
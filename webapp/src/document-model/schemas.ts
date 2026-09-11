import { z } from "zod";
import {
  ComponentType,
  StyleProps,
  TextComponent,
  ImageComponent,
  CustomerInfoComponent,
  InvoiceNumberComponent,
  DateComponent,
  LineItemsComponent,
  LineItemColumn,
  SubtotalComponent,
  TaxComponent,
  DiscountComponent,
  PaymentTermsComponent,
  SignatureComponent,
  CustomFieldComponent,
  NotesComponent,
  TermsComponent,
  PaymentInstructionsComponent,
  FeesComponent,
  TotalComponent,
  AmountDueComponent,
  BusinessInfoComponent,
  SpacerComponent,
  DividerComponent,
  SectionComponent,
  RowComponent,
  ColumnComponent,
  AnyComponent,
  InvoiceDocument,
  DocumentSettings,
} from "./types";

export const stylePropsSchema = z.record(z.string(), z.unknown());

export const lineItemColumnSchema: z.ZodType<LineItemColumn> = z.object({
  key: z.string(),
  label: z.string(),
  width: z.union([z.string(), z.number()]).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  visible: z.boolean(),
});

export const textComponentSchema = z.object({
  id: z.string(),
  type: z.literal("text"),
  props: z.object({
    content: z.string(),
    format: z.enum(["plain", "markdown", "html"]).optional(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<TextComponent>;

export const imageComponentSchema = z.object({
  id: z.string(),
  type: z.union([z.literal("image"), z.literal("logo")]),
  props: z.object({
    src: z.string(),
    alt: z.string().optional(),
    width: z.union([z.string(), z.number()]).optional(),
    height: z.union([z.string(), z.number()]).optional(),
    fit: z.enum(["cover", "contain", "fill", "none", "scale-down"]).optional(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<ImageComponent>;

export const customerInfoComponentSchema = z.object({
  id: z.string(),
  type: z.literal("customerInfo"),
  props: z.object({
    showName: z.boolean(),
    showCompany: z.boolean(),
    showEmail: z.boolean(),
    showAddress: z.boolean(),
    showPhone: z.boolean(),
    label: z.string().optional(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<CustomerInfoComponent>;

export const invoiceNumberComponentSchema = z.object({
  id: z.string(),
  type: z.literal("invoiceNumber"),
  props: z.object({
    prefix: z.string().optional(),
    format: z.string().optional(),
    label: z.string().optional(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<InvoiceNumberComponent>;

export const dateComponentSchema = z.object({
  id: z.string(),
  type: z.literal("date"),
  props: z.object({
    dateType: z.enum(["issue", "due", "custom"]),
    format: z.string().optional(),
    label: z.string().optional(),
    customValue: z.string().optional(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<DateComponent>;

export const lineItemsComponentSchema = z.object({
  id: z.string(),
  type: z.literal("lineItems"),
  props: z.object({
    columns: z.array(lineItemColumnSchema),
    showHeader: z.boolean(),
    showQuantity: z.boolean(),
    showUnit: z.boolean(),
    showUnitPrice: z.boolean(),
    showDiscount: z.boolean(),
    showTax: z.boolean(),
    showLineTotal: z.boolean(),
    currency: z.string(),
    allowMultiPage: z.boolean(),
    emptyStateMessage: z.string().optional(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<LineItemsComponent>;

export const subtotalComponentSchema = z.object({
  id: z.string(),
  type: z.literal("subtotal"),
  props: z.object({
    label: z.string().optional(),
    currency: z.string(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<SubtotalComponent>;

export const taxComponentSchema = z.object({
  id: z.string(),
  type: z.literal("tax"),
  props: z.object({
    label: z.string().optional(),
    currency: z.string(),
    showBreakdown: z.boolean(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<TaxComponent>;

export const discountComponentSchema = z.object({
  id: z.string(),
  type: z.literal("discount"),
  props: z.object({
    label: z.string().optional(),
    currency: z.string(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<DiscountComponent>;

export const paymentTermsComponentSchema = z.object({
  id: z.string(),
  type: z.literal("paymentTerms"),
  props: z.object({
    content: z.string(),
    label: z.string().optional(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<PaymentTermsComponent>;

export const signatureComponentSchema = z.object({
  id: z.string(),
  type: z.literal("signature"),
  props: z.object({
    label: z.string().optional(),
    placeholder: z.string().optional(),
    showDate: z.boolean(),
    showName: z.boolean(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<SignatureComponent>;

export const customFieldComponentSchema = z.object({
  id: z.string(),
  type: z.literal("customField"),
  props: z.object({
    key: z.string(),
    label: z.string(),
    value: z.string(),
    type: z.enum(["text", "number", "date", "select"]),
    options: z.array(z.string()).optional(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<CustomFieldComponent>;

export const notesComponentSchema = z.object({
  id: z.string(),
  type: z.literal("notes"),
  props: z.object({
    content: z.string(),
    label: z.string().optional(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<NotesComponent>;

export const termsComponentSchema = z.object({
  id: z.string(),
  type: z.literal("terms"),
  props: z.object({
    content: z.string(),
    label: z.string().optional(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<TermsComponent>;

export const paymentInstructionsComponentSchema = z.object({
  id: z.string(),
  type: z.literal("paymentInstructions"),
  props: z.object({
    content: z.string(),
    label: z.string().optional(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<PaymentInstructionsComponent>;

export const feesComponentSchema = z.object({
  id: z.string(),
  type: z.literal("fees"),
  props: z.object({
    label: z.string().optional(),
    currency: z.string(),
    showHeader: z.boolean(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<FeesComponent>;

export const totalComponentSchema = z.object({
  id: z.string(),
  type: z.literal("total"),
  props: z.object({
    label: z.string().optional(),
    currency: z.string(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<TotalComponent>;

export const amountDueComponentSchema = z.object({
  id: z.string(),
  type: z.literal("amountDue"),
  props: z.object({
    label: z.string().optional(),
    currency: z.string(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<AmountDueComponent>;

export const businessInfoComponentSchema = z.object({
  id: z.string(),
  type: z.literal("businessInfo"),
  props: z.object({
    showName: z.boolean(),
    showEmail: z.boolean(),
    showPhone: z.boolean(),
    showWebsite: z.boolean(),
    showAddress: z.boolean(),
    showLogo: z.boolean(),
    label: z.string().optional(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<BusinessInfoComponent>;

export const spacerComponentSchema = z.object({
  id: z.string(),
  type: z.literal("spacer"),
  props: z.object({
    height: z.union([z.string(), z.number()]),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<SpacerComponent>;

export const dividerComponentSchema = z.object({
  id: z.string(),
  type: z.literal("divider"),
  props: z.object({
    thickness: z.number(),
    color: z.string(),
    style: z.enum(["solid", "dashed", "dotted"]),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<DividerComponent>;

export const sectionComponentSchema = z.object({
  id: z.string(),
  type: z.literal("section"),
  props: z.object({
    name: z.string(),
    fullWidth: z.boolean(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<SectionComponent>;

export const rowComponentSchema = z.object({
  id: z.string(),
  type: z.literal("row"),
  props: z.object({
    name: z.string(),
    columns: z.number(),
    columnGap: z.union([z.string(), z.number()]),
    rowGap: z.union([z.string(), z.number()]),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<RowComponent>;

export const columnComponentSchema = z.object({
  id: z.string(),
  type: z.literal("column"),
  props: z.object({
    name: z.string(),
    span: z.number(),
  }),
  style: stylePropsSchema,
  children: z.array(z.string()),
  parentId: z.string().optional(),
  visible: z.boolean().optional(),
  condition: z.string().optional(),
}) satisfies z.ZodType<ColumnComponent>;

export const anyComponentSchema: z.ZodType<AnyComponent> = z.discriminatedUnion("type", [
  textComponentSchema,
  imageComponentSchema,
  customerInfoComponentSchema,
  invoiceNumberComponentSchema,
  dateComponentSchema,
  lineItemsComponentSchema,
  subtotalComponentSchema,
  taxComponentSchema,
  discountComponentSchema,
  paymentTermsComponentSchema,
  signatureComponentSchema,
  customFieldComponentSchema,
  notesComponentSchema,
  termsComponentSchema,
  paymentInstructionsComponentSchema,
  feesComponentSchema,
  totalComponentSchema,
  amountDueComponentSchema,
  businessInfoComponentSchema,
  spacerComponentSchema,
  dividerComponentSchema,
  sectionComponentSchema,
  rowComponentSchema,
  columnComponentSchema,
]);

export const documentSettingsSchema: z.ZodType<DocumentSettings> = z.object({
  pageSize: z.enum(["A4", "Letter", "Legal"]),
  orientation: z.enum(["portrait", "landscape"]),
  margins: z.object({
    top: z.number(),
    right: z.number(),
    bottom: z.number(),
    left: z.number(),
  }),
  defaultFont: z.string(),
  defaultFontSize: z.number(),
  defaultColor: z.string(),
  currency: z.string(),
  locale: z.string(),
});

export const invoiceDocumentSchema: z.ZodType<InvoiceDocument> = z.object({
  id: z.string(),
  version: z.number(),
  name: z.string(),
  businessId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sections: z.record(z.string(), sectionComponentSchema),
  rows: z.record(z.string(), rowComponentSchema),
  columns: z.record(z.string(), columnComponentSchema),
  components: z.record(z.string(), anyComponentSchema),
  rootSectionId: z.string(),
  settings: documentSettingsSchema,
});

export function validateComponent(component: unknown): AnyComponent {
  return anyComponentSchema.parse(component);
}

export function validateDocument(document: unknown): InvoiceDocument {
  return invoiceDocumentSchema.parse(document);
}

export const componentSchemas: Record<ComponentType, z.ZodType<any>> = {
  text: textComponentSchema,
  image: imageComponentSchema,
  logo: imageComponentSchema,
  customerInfo: customerInfoComponentSchema,
  invoiceNumber: invoiceNumberComponentSchema,
  date: dateComponentSchema,
  lineItems: lineItemsComponentSchema,
  subtotal: subtotalComponentSchema,
  tax: taxComponentSchema,
  discount: discountComponentSchema,
  paymentTerms: paymentTermsComponentSchema,
  signature: signatureComponentSchema,
  customField: customFieldComponentSchema,
  notes: notesComponentSchema,
  terms: termsComponentSchema,
  paymentInstructions: paymentInstructionsComponentSchema,
  fees: feesComponentSchema,
  total: totalComponentSchema,
  amountDue: amountDueComponentSchema,
  businessInfo: businessInfoComponentSchema,
  spacer: spacerComponentSchema,
  divider: dividerComponentSchema,
  section: sectionComponentSchema,
  row: rowComponentSchema,
  column: columnComponentSchema,
};

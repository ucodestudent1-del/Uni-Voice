import {
  createEmptyDocument,
  insertComponent,
  getChildren,
  InvoiceDocument,
  ComponentType,
  ParentId,
  StyleProps,
  LineItemColumn,
  invoiceDocumentSchema,
} from "..";
import { getDefaultDocument } from "../converter";

export type PresetCategory = "blank" | "default" | "industry";

export interface PresetMetadata {
  key: string;
  name: string;
  description: string;
  category: PresetCategory;
  industry?: string;
}

export interface PresetTemplate {
  metadata: PresetMetadata;
  build: (businessId: string) => InvoiceDocument;
}

const USD = "USD";

function lastKey(map: Record<string, unknown>): string {
  const keys = Object.keys(map);
  return keys[keys.length - 1];
}

const standardLineColumns = (currency = USD): LineItemColumn[] => [
  { key: "description", label: "Description", width: "40%", align: "left", visible: true },
  { key: "quantity", label: "Qty", width: "15%", align: "right", visible: true },
  { key: "unitPrice", label: "Rate", width: "20%", align: "right", visible: true },
  { key: "amount", label: "Amount", width: "25%", align: "right", visible: true },
];

class PresetBuilder {
  doc: InvoiceDocument;
  private rootIdx = 0;

  constructor(businessId: string, name: string) {
    this.doc = createEmptyDocument(businessId, name);
  }

  get root(): ParentId {
    return this.doc.rootSectionId;
  }

  insertRoot(type: ComponentType, props?: Record<string, unknown>, style?: StyleProps): this {
    this.doc = insertComponent(this.doc, { type, parentId: this.doc.rootSectionId, index: this.rootIdx, props, style });
    this.rootIdx++;
    return this;
  }

  append(parentId: ParentId, type: ComponentType, props?: Record<string, unknown>, style?: StyleProps): this {
    const siblings = getChildren(this.doc, parentId);
    this.doc = insertComponent(this.doc, { type, parentId, index: siblings.length, props, style });
    return this;
  }

  add(parentId: ParentId, type: ComponentType, props?: Record<string, unknown>, style?: StyleProps): this {
    if (parentId === this.doc.rootSectionId) {
      return this.insertRoot(type, props, style);
    }
    return this.append(parentId, type, props, style);
  }

  addRow(name = "Row", columns = 2, columnGap: number | string = 16, rowGap: number | string = 16): string {
    this.insertRoot("row", { name, columns, columnGap, rowGap });
    return this.lastRowId();
  }

  addSection(name = "Section", fullWidth = true): string {
    this.insertRoot("section", { name, fullWidth });
    return this.lastSectionId();
  }

  addColumn(rowId: string, name = "Column", span = 6, style?: StyleProps): string {
    this.append(rowId, "column", { name, span }, style);
    return this.lastColumnId();
  }

  lastRowId(): string {
    return lastKey(this.doc.rows);
  }
  lastColumnId(): string {
    return lastKey(this.doc.columns);
  }
  lastSectionId(): string {
    return lastKey(this.doc.sections);
  }

  build(): InvoiceDocument {
    return this.doc;
  }
}

function addSpacer(b: PresetBuilder, h: number | string = 16): PresetBuilder {
  return b.add(b.root, "spacer", { height: h });
}

function addDivider(b: PresetBuilder, thickness = 1, color = "#e2e8f0", style: "solid" | "dashed" | "dotted" = "solid"): PresetBuilder {
  return b.add(b.root, "divider", { thickness, color, style });
}

function addBusinessInfo(
  b: PresetBuilder,
  opts: { showAddress?: boolean; showPhone?: boolean; showWebsite?: boolean; showLogo?: boolean; label?: string } = {}
): PresetBuilder {
  const { showAddress = false, showPhone = false, showWebsite = false, showLogo = false, label = "From" } = opts;
  b.add(b.root, "businessInfo", {
    showName: true,
    showEmail: true,
    showPhone,
    showWebsite,
    showAddress,
    showLogo,
    label,
  });
  return addSpacer(b, 16);
}

function addInvoiceHeader(b: PresetBuilder): { rowId: string; leftCol: string; rightCol: string } {
  const rowId = b.addRow("Header", 2, 24, 16);
  const leftCol = b.addColumn(rowId, "Business", 6);
  const rightCol = b.addColumn(rowId, "Invoice Details", 6, { textAlign: "right" });
  b.append(rightCol, "invoiceNumber", { prefix: "#", label: "Invoice" }, { textAlign: "right", fontWeight: "bold" });
  b.append(rightCol, "date", { dateType: "issue", label: "Issue Date" });
  b.append(rightCol, "date", { dateType: "due", label: "Due Date" });
  return { rowId, leftCol, rightCol };
}

function addCustomerInfo(b: PresetBuilder, label = "Bill To", showCompany = true): PresetBuilder {
  b.add(b.root, "customerInfo", {
    showName: true,
    showCompany,
    showEmail: true,
    showAddress: true,
    showPhone: false,
    label,
  });
  return addSpacer(b);
}

function addLineItems(
  b: PresetBuilder,
  parentId: ParentId,
  columns: LineItemColumn[],
  currency = USD,
  showDiscount = false
): PresetBuilder {
  return b.add(parentId, "lineItems", {
    columns,
    showHeader: true,
    showQuantity: true,
    showUnit: true,
    showUnitPrice: true,
    showDiscount,
    showTax: true,
    showLineTotal: true,
    currency,
    allowMultiPage: true,
    emptyStateMessage: "No line items added yet",
  });
}

function addTotalsBlock(
  b: PresetBuilder,
  opts: { discount?: boolean; tax?: boolean; fees?: boolean; currency?: string } = {}
): PresetBuilder {
  const { discount = false, tax = true, fees = false, currency = USD } = opts;
  const rowId = b.addRow("Totals", 1, 16, 16);
  const colId = b.addColumn(rowId, "Totals Column", 12, {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  });
  b.append(colId, "subtotal", { label: "Subtotal", currency });
  if (discount) b.append(colId, "discount", { label: "Discount", currency });
  if (tax) b.append(colId, "tax", { label: "Tax", currency, showBreakdown: true });
  if (fees) b.append(colId, "fees", { label: "Fees", currency, showHeader: false });
  b.append(colId, "total", { label: "Total", currency }, { paddingTop: "8px", borderTop: "2px solid #e2e8f0", width: "100%" });
  b.append(colId, "amountDue", { label: "Amount Due", currency });
  return b;
}

function addCustomField(
  b: PresetBuilder,
  parentId: ParentId,
  key: string,
  label: string,
  value = "",
  type: "text" | "number" | "date" | "select" = "text",
  options?: string[]
): PresetBuilder {
  const props: Record<string, unknown> = { key, label, value, type };
  if (options) props.options = options;
  return b.add(parentId, "customField", props);
}

function addPaymentTerms(b: PresetBuilder, content = "Net 30", label = "Payment Terms"): PresetBuilder {
  return b.add(b.root, "paymentTerms", { content, label });
}

function addNotes(b: PresetBuilder, content: string, label = "Notes"): PresetBuilder {
  return b.add(b.root, "notes", { content, label });
}

function addTerms(b: PresetBuilder, content: string, label = "Terms"): PresetBuilder {
  return b.add(b.root, "terms", { content, label });
}

function addPaymentInstructions(b: PresetBuilder, content: string, label = "Payment Instructions"): PresetBuilder {
  return b.add(b.root, "paymentInstructions", { content, label });
}

function addSignature(b: PresetBuilder): PresetBuilder {
  addSpacer(b, 32);
  return b.add(b.root, "signature", {
    label: "Authorized Signature",
    placeholder: "__________________________",
    showDate: true,
    showName: true,
  });
}

export const BLANK_PRESET: PresetTemplate = {
  metadata: {
    key: "blank",
    name: "Blank Canvas",
    description: "Empty canvas — build your invoice from scratch",
    category: "blank",
  },
  build: (businessId: string) => createEmptyDocument(businessId, "Blank Invoice"),
};

export const PROFESSIONAL_PRESET: PresetTemplate = {
  metadata: {
    key: "professional",
    name: "Professional Default",
    description: "Clean, professional invoice with a standard business layout",
    category: "default",
  },
  build: (businessId: string) => getDefaultDocument(businessId),
};

function constructionInvoice(businessId: string): InvoiceDocument {
  const b = new PresetBuilder(businessId, "Construction Invoice");
  addBusinessInfo(b, { showAddress: true, showPhone: true });
  const header = addInvoiceHeader(b);
  addCustomField(b, header.leftCol, "job_site", "Job Site", "123 Main St, Suite 100");
  addCustomField(b, header.leftCol, "project", "Project #", "PROJ-2024-001");
  addSpacer(b, 8);
  addDivider(b);
  addSpacer(b, 16);
  addCustomerInfo(b);
  addSpacer(b);
  addCustomField(b, b.root, "job_number", "Job Number", "JOB-001");

  const laborSection = b.addSection("Labor");
  addLineItems(
    b,
    laborSection,
    [
      { key: "description", label: "Description", width: "45%", align: "left", visible: true },
      { key: "hours", label: "Hours", width: "18%", align: "right", visible: true },
      { key: "rate", label: "Rate", width: "18%", align: "right", visible: true },
      { key: "amount", label: "Line Total", width: "19%", align: "right", visible: true },
    ]
  );

  const materialsSection = b.addSection("Materials");
  addLineItems(
    b,
    materialsSection,
    [
      { key: "description", label: "Description", width: "40%", align: "left", visible: true },
      { key: "quantity", label: "Qty", width: "20%", align: "right", visible: true },
      { key: "unitPrice", label: "Unit Price", width: "20%", align: "right", visible: true },
      { key: "amount", label: "Line Total", width: "20%", align: "right", visible: true },
    ]
  );
  addSpacer(b);

  addTotalsBlock(b, { tax: true });
  addSpacer(b);
  addCustomField(b, b.root, "deposit", "Deposit", "0.00", "number");
  addCustomField(b, b.root, "retention", "Retention %", "5", "number");
  addPaymentTerms(b, "Net 30");
  addNotes(b, "A lien waiver is required before final payment is processed.", "Notes");
  addSignature(b);
  return b.build();
}

function consultingInvoice(businessId: string): InvoiceDocument {
  const b = new PresetBuilder(businessId, "Consulting Invoice");
  addBusinessInfo(b, { showWebsite: true });
  const header = addInvoiceHeader(b);
  addCustomField(
    b,
    header.leftCol,
    "milestone",
    "Milestone",
    "",
    "select",
    ["Kickoff", "Design", "Review", "Delivery"]
  );

  addSpacer(b, 8);
  addDivider(b);
  addSpacer(b, 16);
  addCustomerInfo(b);
  addCustomField(b, b.root, "retainer", "Retainer", "0.00", "number");
  addLineItems(
    b,
    b.root,
    [
      { key: "description", label: "Description", width: "40%", align: "left", visible: true },
      { key: "hours", label: "Hours", width: "20%", align: "right", visible: true },
      { key: "rate", label: "Rate", width: "20%", align: "right", visible: true },
      { key: "amount", label: "Amount", width: "20%", align: "right", visible: true },
    ]
  );
  addSpacer(b);
  addTotalsBlock(b, { discount: true, tax: true });
  addSpacer(b);
  addCustomField(b, b.root, "expenses", "Expense Reimbursement", "0.00", "number");
  addNotes(b, "Reimbursable expenses are billed separately upon receipt of receipts.", "Notes");
  addPaymentTerms(b, "Net 15");
  addSignature(b);
  return b.build();
}

function photographyInvoice(businessId: string): InvoiceDocument {
  const b = new PresetBuilder(businessId, "Photography Invoice");
  addBusinessInfo(b, { showWebsite: true });
  const header = addInvoiceHeader(b);
  addCustomField(b, header.leftCol, "delivery_date", "Delivery Date", "2024-12-25", "date");
  addSpacer(b);
  addDivider(b);
  addSpacer(b, 16);
  addCustomerInfo(b);
  addLineItems(
    b,
    b.root,
    [
      { key: "package", label: "Package", width: "25%", align: "left", visible: true },
      { key: "usage", label: "Usage Rights", width: "25%", align: "left", visible: true },
      { key: "quantity", label: "Qty", width: "15%", align: "right", visible: true },
      { key: "unitPrice", label: "Price", width: "15%", align: "right", visible: true },
      { key: "amount", label: "Total", width: "20%", align: "right", visible: true },
    ]
  );
  addSpacer(b);
  addTotalsBlock(b, { tax: true });
  addSpacer(b);
  addNotes(b, "All images remain the property of the photographer until full payment is received.", "Notes");
  addTerms(b, "Usage rights are granted upon receipt of full payment. License expires after one year.", "Terms");
  addSignature(b);
  return b.build();
}

function freelancingInvoice(businessId: string): InvoiceDocument {
  const b = new PresetBuilder(businessId, "Freelance Invoice");
  addBusinessInfo(b, { showWebsite: true });
  const header = addInvoiceHeader(b);
  addCustomField(b, header.leftCol, "project", "Project", "Website Redesign");
  addSpacer(b);
  addDivider(b);
  addSpacer(b, 16);
  addCustomerInfo(b);
  addLineItems(
    b,
    b.root,
    [
      { key: "task", label: "Task", width: "40%", align: "left", visible: true },
      { key: "hours", label: "Hours", width: "20%", align: "right", visible: true },
      { key: "rate", label: "Rate", width: 20, align: "right", visible: true },
      { key: "amount", label: "Total", width: "20%", align: "right", visible: true },
    ]
  );
  addSpacer(b);
  addTotalsBlock(b, { tax: true });
  addSpacer(b);
  addCustomField(b, b.root, "platform_fee", "Platform Fee", "0.00", "number");
  addPaymentInstructions(b, "Payment via preferred platform or direct bank transfer.");
  addNotes(b, "Thank you for your business! Please reach out with any questions.", "Notes");
  addPaymentTerms(b, "Net 30");
  addSignature(b);
  return b.build();
}

function legalServicesInvoice(businessId: string): InvoiceDocument {
  const b = new PresetBuilder(businessId, "Legal Services Invoice");
  addBusinessInfo(b, { showAddress: true, showPhone: true });
  const header = addInvoiceHeader(b);
  addCustomField(b, header.leftCol, "case_number", "Case Number", "CV-2024-1234");
  addSpacer(b);
  addDivider(b);
  addSpacer(b, 16);
  addCustomerInfo(b);
  addLineItems(
    b,
    b.root,
    [
      { key: "description", label: "Description", width: "35%", align: "left", visible: true },
      { key: "time", label: "Time (hrs)", width: "20%", align: "right", visible: true },
      { key: "rate", label: "Rate", width: "20%", align: "right", visible: true },
      { key: "amount", label: "Total", width: "25%", align: "right", visible: true },
    ]
  );
  addSpacer(b);
  addTotalsBlock(b, { tax: true });
  addSpacer(b);
  addCustomField(b, b.root, "court_costs", "Court Costs", "0.00", "number");
  addCustomField(b, b.root, "retainer_balance", "Retainer Balance", "0.00", "number");
  addTerms(b, "Attorney-client privilege applies to all communications. Fees are subject to the retainer agreement dated 2024-01-01.", "Terms");
  addSignature(b);
  return b.build();
}

function landscapingInvoice(businessId: string): InvoiceDocument {
  const b = new PresetBuilder(businessId, "Landscaping Invoice");
  addBusinessInfo(b, { showAddress: true, showPhone: true });
  const header = addInvoiceHeader(b);
  addCustomField(b, header.leftCol, "property_address", "Property Address", "456 Oak Avenue");
  addSpacer(b);
  addDivider(b);
  addSpacer(b, 16);
  addCustomerInfo(b);
  addLineItems(
    b,
    b.root,
    [
      { key: "service", label: "Service", width: "35%", align: "left", visible: true },
      { key: "season", label: "Season", width: "20%", align: "left", visible: true },
      { key: "quantity", label: "Qty", width: "15%", align: "right", visible: true },
      { key: "rate", label: "Rate", width: "15%", align: "right", visible: true },
      { key: "amount", label: "Total", width: "15%", align: "right", visible: true },
    ]
  );
  addSpacer(b);
  addTotalsBlock(b, { tax: true });
  addSpacer(b);
  addNotes(b, "Property must be accessible on the scheduled service date. Please remove obstacles from the work area beforehand.", "Notes");
  addPaymentTerms(b, "Due on Receipt");
  addSignature(b);
  return b.build();
}

function cleaningInvoice(businessId: string): InvoiceDocument {
  const b = new PresetBuilder(businessId, "Cleaning Invoice");
  addBusinessInfo(b, { showPhone: true });
  const header = addInvoiceHeader(b);
  addCustomField(
    b,
    header.leftCol,
    "frequency",
    "Frequency",
    "",
    "select",
    ["Weekly", "Bi-weekly", "Monthly", "One-time"]
  );
  addCustomField(b, header.leftCol, "service_location", "Service Location", "Main Building");
  addSpacer(b);
  addDivider(b);
  addSpacer(b, 16);
  addCustomerInfo(b);
  addLineItems(
    b,
    b.root,
    [
      { key: "service", label: "Service", width: "35%", align: "left", visible: true },
      { key: "visits", label: "Visits", width: "20%", align: "right", visible: true },
      { key: "rate", label: "Rate", width: "20%", align: "right", visible: true },
      { key: "amount", label: "Total", width: "25%", align: "right", visible: true },
    ]
  );
  addSpacer(b);
  addTotalsBlock(b, { tax: true });
  addSpacer(b);
  addCustomField(b, b.root, "property_access", "Property Access", "Leave keys with building management", "text");
  addNotes(b, "Please leave keys with building management or property supervisor before each visit.", "Notes");
  addPaymentTerms(b, "Net 15");
  addSignature(b);
  return b.build();
}

function automotiveInvoice(businessId: string): InvoiceDocument {
  const b = new PresetBuilder(businessId, "Automotive Service Invoice");
  addBusinessInfo(b, { showAddress: true, showPhone: true });
  const header = addInvoiceHeader(b);
  addCustomField(b, header.leftCol, "vin", "VIN", "1HGBH41JXMN109186");
  addCustomField(
    b,
    header.leftCol,
    "service_type",
    "Service Type",
    "",
    "select",
    ["Repair", "Maintenance", "Diagnostic", "Inspection"]
  );
  addSpacer(b);
  addDivider(b);
  addSpacer(b, 16);
  addCustomerInfo(b);
  addLineItems(
    b,
    b.root,
    [
      { key: "description", label: "Description", width: "35%", align: "left", visible: true },
      { key: "type", label: "Type", width: "15%", align: "left", visible: true },
      { key: "quantity", label: "Qty", width: "15%", align: "right", visible: true },
      { key: "rate", label: "Rate", width: "15%", align: "right", visible: true },
      { key: "amount", label: "Total", width: "20%", align: "right", visible: true },
    ]
  );
  addSpacer(b);
  addTotalsBlock(b, { tax: true });
  addSpacer(b);
  addCustomField(b, b.root, "warranty", "Warranty", "12 months parts, 90 days labor", "text");
  addNotes(b, "Parts carry a 12-month warranty. Labor carries a 90-day warranty from the date of service.", "Notes");
  addSignature(b);
  return b.build();
}

function retailInvoice(businessId: string): InvoiceDocument {
  const b = new PresetBuilder(businessId, "Retail Invoice");
  addBusinessInfo(b, { showAddress: true, showPhone: true, showLogo: true });
  const header = addInvoiceHeader(b);
  addCustomField(b, header.leftCol, "order_number", "Order #", "ORD-7742");
  addSpacer(b);
  addDivider(b);
  addSpacer(b, 16);
  addCustomerInfo(b);
  addLineItems(
    b,
    b.root,
    [
      { key: "sku", label: "SKU", width: "15%", align: "left", visible: true },
      { key: "product", label: "Product", width: "35%", align: "left", visible: true },
      { key: "quantity", label: "Qty", width: "15%", align: "right", visible: true },
      { key: "unitPrice", label: "Price", width: "15%", align: "right", visible: true },
      { key: "amount", label: "Total", width: "20%", align: "right", visible: true },
    ],
    USD,
    true
  );
  addSpacer(b);
  addTotalsBlock(b, { discount: true, tax: true });
  addSpacer(b);
  addNotes(b, "Returns accepted within 30 days with receipt. A 15% restocking fee applies to all returns.", "Notes");
  addTerms(b, "Prices are tax-inclusive. Store credit honored for returns within the return window.", "Terms");
  addSignature(b);
  return b.build();
}

function professionalServicesInvoice(businessId: string): InvoiceDocument {
  const b = new PresetBuilder(businessId, "Professional Services Invoice");
  addBusinessInfo(b, { showWebsite: true });
  const header = addInvoiceHeader(b);
  addCustomField(b, header.leftCol, "project_code", "Project Code", "PRJ-2024-09");
  addSpacer(b);
  addDivider(b);
  addSpacer(b, 16);
  addCustomerInfo(b);
  addLineItems(
    b,
    b.root,
    [
      { key: "description", label: "Description", width: "40%", align: "left", visible: true },
      { key: "milestone", label: "Milestone", width: "30%", align: "left", visible: true },
      { key: "amount", label: "Amount", width: "30%", align: "right", visible: true },
    ]
  );
  addSpacer(b);
  addTotalsBlock(b, { discount: true, tax: true, fees: true });
  addSpacer(b);
  addNotes(b, "Reimbursable expenses are subject to a 10% markup. Please retain all receipts.", "Notes");
  addPaymentTerms(b, "Upon Receipt");
  addSignature(b);
  return b.build();
}

export const INDUSTRY_PRESETS: PresetTemplate[] = [
  { metadata: { key: "construction", name: "Construction Invoice", description: "Job-site billing with labor and materials sections, deposit, and retention", category: "industry", industry: "construction" },   build: constructionInvoice },
  { metadata: { key: "consulting", name: "Consulting Invoice", description: "Milestone billing with hours/rate table, retainer, and expense reimbursement", category: "industry", industry: "consulting" },   build: consultingInvoice },
  { metadata: { key: "photography", name: "Photography Invoice", description: "Package-based line items with usage rights notes and delivery date", category: "industry", industry: "photography" },   build: photographyInvoice },
  { metadata: { key: "freelancing", name: "Freelance Invoice", description: "Project-based billing with hours breakdown and platform fee field", category: "industry", industry: "freelancing" },   build: freelancingInvoice },
  { metadata: { key: "legal", name: "Legal Services Invoice", description: "Time entry table with court costs, retainer balance, and case number", category: "industry", industry: "legal" },   build: legalServicesInvoice },
  { metadata: { key: "landscaping", name: "Landscaping Invoice", description: "Seasonal services with property address and materials vs. labor split", category: "industry", industry: "landscaping" },   build: landscapingInvoice },
  { metadata: { key: "cleaning", name: "Cleaning Invoice", description: "Recurring schedule with frequency field and property access notes", category: "industry", industry: "cleaning" },   build: cleaningInvoice },
  { metadata: { key: "automotive", name: "Automotive Service Invoice", description: "VIN-based service with type dropdown and warranty info", category: "industry", industry: "automotive" },   build: automotiveInvoice },
  { metadata: { key: "retail", name: "Retail Invoice", description: "SKU-based pricing with discount tiers and returns policy", category: "industry", industry: "retail" },   build: retailInvoice },
  { metadata: { key: "professional-services", name: "Professional Services Invoice", description: "Retainer and milestone billing with expense markup and project code", category: "industry", industry: "professional services" },   build: professionalServicesInvoice },
];

export const ALL_PRESETS: PresetTemplate[] = [BLANK_PRESET, PROFESSIONAL_PRESET, ...INDUSTRY_PRESETS];

export const INDUSTRY_PRESET_KEYS = INDUSTRY_PRESETS.map((p) => p.metadata.key);

export function getPresetTemplate(key: string): PresetTemplate | undefined {
  return ALL_PRESETS.find((p) => p.metadata.key === key);
}

export function validatePreset(doc: InvoiceDocument): boolean {
  return invoiceDocumentSchema.safeParse(doc).success;
}

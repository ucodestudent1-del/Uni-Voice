import {
  InvoiceDocument,
  AnyComponent,
  ComponentId,
  ComponentType,
  ParentId,
  StyleProps,
  createEmptyDocument,
  createComponent,
  UUID,
  makeUUID,
} from "./types";
import { DocumentBuilder, insertComponent } from "./document-operations";
import { getComponentDefinition } from "./registry";
import { ApiInvoice, ApiCustomer, ApiBusiness } from "../types/api";

export function invoiceToDocument(invoice: ApiInvoice, business: ApiBusiness, customer?: ApiCustomer): InvoiceDocument {
  const doc = createEmptyDocument(invoice.business_id as UUID, "Untitled Invoice");

  const builder = new DocumentBuilder(doc);
  let currentParent: ParentId = doc.rootSectionId;
  let insertIndex = 0;

  const insert = (type: ComponentType, props?: any, style?: StyleProps) => {
    builder.insertComponent({
      type,
      parentId: currentParent,
      index: insertIndex,
      props,
      style,
    });
    insertIndex++;
  };

  insert("businessInfo", {
    showName: true,
    showEmail: true,
    showPhone: !!business.phone,
    showWebsite: !!business.website,
    showAddress: !!(business.address_line_1 || business.address_line_2),
    showLogo: !!business.logo_url,
    label: "From",
  });

  insert("spacer", { height: 16 });

  const headerRowId = `row_${makeUUID()}`;
  const headerCompanyColId = `col_${makeUUID()}`;
  const headerInvoiceColId = `col_${makeUUID()}`;

  builder.insertComponent({
    type: "row",
    parentId: currentParent,
    index: insertIndex++,
    props: { name: "Header", columns: 2, columnGap: 24, rowGap: 16 },
  });

  const rows = Object.values(builder.document.rows);
  const lastRow = rows[rows.length - 1];
  const rowParentId = lastRow.id;

  builder.insertComponent({
    type: "column",
    parentId: rowParentId as ParentId,
    index: 0,
    props: { name: "Business", span: 6 },
  });
  builder.insertComponent({
    type: "column",
    parentId: rowParentId as ParentId,
    index: 1,
    props: { name: "Invoice", span: 6 },
  });

  const columns = Object.values(builder.document.columns);
  const rightCol = columns[columns.length - 1];

  builder.insertComponent({
    type: "invoiceNumber",
    parentId: rightCol.id as ParentId,
    index: 0,
    props: { prefix: "#", label: "Invoice" },
    style: { textAlign: "right", fontWeight: "bold" },
  });
  builder.insertComponent({
    type: "date",
    parentId: rightCol.id as ParentId,
    index: 1,
    props: { dateType: "issue", label: "Issue Date" },
  });
  builder.insertComponent({
    type: "date",
    parentId: rightCol.id as ParentId,
    index: 2,
    props: { dateType: "due", label: "Due Date" },
  });

  const businessCol = columns.find((c) => c.id !== rightCol.id);
  if (businessCol) {
    builder.insertComponent({
      type: "businessInfo",
      parentId: businessCol.id as ParentId,
      index: 0,
      props: {
        showName: true,
        showEmail: true,
        showPhone: !!business.phone,
        showWebsite: !!business.website,
        showAddress: false,
        showLogo: !!business.logo_url,
        label: "From",
      },
    });
  }

  insert("spacer", { height: 24 });

  insert("customerInfo", {
    showName: true,
    showCompany: !!customer?.company_name,
    showEmail: !!customer?.email,
    showAddress: !!(customer?.address_line_1 || customer?.address_line_2),
    showPhone: !!customer?.phone,
    label: "Bill To",
  });

  insert("spacer", { height: 24 });

  insert("lineItems", {
    columns: [
      { key: "description", label: "Description", width: "40%", align: "left", visible: true },
      { key: "quantity", label: "Qty", width: "15%", align: "right", visible: true },
      { key: "unitPrice", label: "Rate", width: "20%", align: "right", visible: true },
      { key: "amount", label: "Amount", width: "25%", align: "right", visible: true },
    ],
    showHeader: true,
    showQuantity: true,
    showUnit: true,
    showUnitPrice: true,
    showDiscount: false,
    showTax: true,
    showLineTotal: true,
    currency: invoice.currency,
    allowMultiPage: true,
    emptyStateMessage: "No line items added yet",
  });

  insert("spacer", { height: 16 });

  const totalsRowParent = currentParent;
  const totalsRowId = `row_${makeUUID()}`;
  builder.insertComponent({
    type: "row",
    parentId: currentParent,
    index: insertIndex++,
    props: { name: "Totals", columns: 1, columnGap: 16, rowGap: 16 },
  });

  const totalsRows = Object.values(builder.document.rows);
  const lastTotalsRow = totalsRows[totalsRows.length - 1];
  builder.insertComponent({
    type: "column",
    parentId: lastTotalsRow.id as ParentId,
    index: 0,
    props: { name: "Totals Column", span: 12 },
    style: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  });

  const totalsCol = Object.values(builder.document.columns).slice(-1)[0];
  builder.insertComponent({
    type: "subtotal",
    parentId: totalsCol.id as ParentId,
    index: 0,
    props: { label: "Subtotal", currency: invoice.currency },
  });
  builder.insertComponent({
    type: "discount",
    parentId: totalsCol.id as ParentId,
    index: 1,
    props: { label: "Discount", currency: invoice.currency },
  });
  builder.insertComponent({
    type: "tax",
    parentId: totalsCol.id as ParentId,
    index: 2,
    props: { label: "Tax", currency: invoice.currency, showBreakdown: true },
  });
  builder.insertComponent({
    type: "fees",
    parentId: totalsCol.id as ParentId,
    index: 3,
    props: { label: "Fees", currency: invoice.currency, showHeader: false },
  });
  builder.insertComponent({
    type: "total",
    parentId: totalsCol.id as ParentId,
    index: 4,
    props: { label: "Total", currency: invoice.currency },
    style: { paddingTop: "8px", borderTop: "2px solid #e2e8f0", width: "100%" },
  });
  builder.insertComponent({
    type: "amountDue",
    parentId: totalsCol.id as ParentId,
    index: 5,
    props: { label: "Amount Due", currency: invoice.currency },
  });

  if (invoice.notes) {
    insert("spacer", { height: 16 });
    insert("notes", { content: invoice.notes, label: "Notes" });
  }

  if (invoice.terms) {
    insert("spacer", { height: 8 });
    insert("terms", { content: invoice.terms, label: "Terms" });
  }

  if (invoice.payment_instructions) {
    insert("spacer", { height: 8 });
    insert("paymentInstructions", { content: invoice.payment_instructions, label: "Payment Instructions" });
  }

  insert("spacer", { height: 32 });
  insert("signature", {
    label: "Authorized Signature",
    placeholder: "__________________________",
    showDate: true,
    showName: true,
  });

  return builder.document;
}

export function getDefaultDocument(businessId: string): InvoiceDocument {
  const doc = createEmptyDocument(businessId as UUID, "New Invoice");
  const builder = new DocumentBuilder(doc);

  let idx = 0;
  const insert = (type: ComponentType, props?: any, style?: StyleProps) => {
    builder.insertComponent({
      type,
      parentId: doc.rootSectionId,
      index: idx,
      props,
      style,
    });
    idx++;
  };

  insert("businessInfo", {
    showName: true,
    showEmail: true,
    showPhone: false,
    showWebsite: false,
    showAddress: false,
    showLogo: false,
    label: "From",
  });
  insert("spacer", { height: 16 });

  const rowId = `row_${makeUUID()}`;
  const col1 = `col_${makeUUID()}`;
  const col2 = `col_${makeUUID()}`;
  builder.insertComponent({
    type: "row",
    parentId: doc.rootSectionId,
    index: idx++,
    props: { name: "Header", columns: 2, columnGap: 24, rowGap: 16 },
  });

  const rows = Object.values(builder.document.rows);
  const lastRow = rows[rows.length - 1];
  builder.insertComponent({
    type: "column",
    parentId: lastRow.id as ParentId,
    index: 0,
    props: { name: "Left", span: 6 },
  });
  builder.insertComponent({
    type: "column",
    parentId: lastRow.id as ParentId,
    index: 1,
    props: { name: "Right", span: 6 },
    style: { textAlign: "right" },
  });

  const cols = Object.values(builder.document.columns);
  const rightCol = cols[cols.length - 1];
  builder.insertComponent({
    type: "invoiceNumber",
    parentId: rightCol.id as ParentId,
    index: 0,
    props: { prefix: "#", label: "Invoice" },
    style: { textAlign: "right", fontWeight: "bold" },
  });
  builder.insertComponent({
    type: "date",
    parentId: rightCol.id as ParentId,
    index: 1,
    props: { dateType: "issue", label: "Issue Date" },
  });
  builder.insertComponent({
    type: "date",
    parentId: rightCol.id as ParentId,
    index: 2,
    props: { dateType: "due", label: "Due Date" },
  });

  insert("spacer", { height: 24 });
  insert("customerInfo", {
    showName: true,
    showCompany: true,
    showEmail: true,
    showAddress: true,
    showPhone: false,
    label: "Bill To",
  });
  insert("spacer", { height: 24 });
  insert("lineItems", {
    columns: [
      { key: "description", label: "Description", width: "40%", align: "left", visible: true },
      { key: "quantity", label: "Qty", width: "15%", align: "right", visible: true },
      { key: "unitPrice", label: "Rate", width: "20%", align: "right", visible: true },
      { key: "amount", label: "Amount", width: "25%", align: "right", visible: true },
    ],
    showHeader: true,
    showQuantity: true,
    showUnit: true,
    showUnitPrice: true,
    showDiscount: false,
    showTax: true,
    showLineTotal: true,
    currency: "USD",
    allowMultiPage: true,
    emptyStateMessage: "No line items added yet",
  });
  insert("spacer", { height: 16 });

  const totalsRowId = `row_${makeUUID()}`;
  builder.insertComponent({
    type: "row",
    parentId: doc.rootSectionId,
    index: idx++,
    props: { name: "Totals", columns: 1, columnGap: 16, rowGap: 16 },
  });

  const totalRows = Object.values(builder.document.rows);
  const lastTotalRow = totalRows[totalRows.length - 1];
  builder.insertComponent({
    type: "column",
    parentId: lastTotalRow.id as ParentId,
    index: 0,
    props: { name: "Totals Column", span: 12 },
    style: { display: "flex", flexDirection: "column", alignItems: "flex-end" },
  });

  const totalCols = Object.values(builder.document.columns);
  const lastTotalCol = totalCols[totalCols.length - 1];
  builder.insertComponent({
    type: "subtotal",
    parentId: lastTotalCol.id as ParentId,
    index: 0,
    props: { label: "Subtotal", currency: "USD" },
  });
  builder.insertComponent({
    type: "tax",
    parentId: lastTotalCol.id as ParentId,
    index: 1,
    props: { label: "Tax", currency: "USD", showBreakdown: true },
  });
  builder.insertComponent({
    type: "total",
    parentId: lastTotalCol.id as ParentId,
    index: 2,
    props: { label: "Total", currency: "USD" },
    style: { paddingTop: "8px", borderTop: "2px solid #e2e8f0", width: "100%" },
  });
  builder.insertComponent({
    type: "amountDue",
    parentId: lastTotalCol.id as ParentId,
    index: 3,
    props: { label: "Amount Due", currency: "USD" },
  });
  insert("spacer", { height: 16 });
  insert("paymentTerms", { content: "Net 30", label: "Payment Terms" });
  insert("spacer", { height: 32 });
  insert("signature", {
    label: "Authorized Signature",
    placeholder: "__________________________",
    showDate: true,
    showName: true,
  });

  return builder.document;
}

export function documentToInvoice(doc: InvoiceDocument, existingInvoice?: Partial<any>): any {
  return {
    currency: doc.settings.currency,
    notes: getComponentProp(doc, "notes", "content"),
    terms: getComponentProp(doc, "terms", "content"),
    paymentInstructions: getComponentProp(doc, "paymentInstructions", "content"),
    templateId: existingInvoice?.templateId || undefined,
  };
}

function getComponentProp(doc: InvoiceDocument, type: ComponentType, propName: string): string | undefined {
  const component = Object.values(doc.components).find((c) => c.type === type);
  if (!component) return undefined;
  return (component.props as Record<string, unknown>)[propName] as string | undefined;
}

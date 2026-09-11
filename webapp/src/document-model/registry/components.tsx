import { registerComponent, PaletteItem } from "./index";
import { ComponentDefinition, RenderContext, InspectorContext } from "./index";
import {
  TextComponent,
  ImageComponent,
  CustomerInfoComponent,
  InvoiceNumberComponent,
  DateComponent,
  LineItemsComponent,
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
  LineItemColumn,
} from "../types";

import { z } from "zod";

export function registerAllComponents() {
  registerTextComponent();
  registerImageComponent();
  registerCustomerInfoComponent();
  registerInvoiceNumberComponent();
  registerDateComponent();
  registerLineItemsComponent();
  registerSubtotalComponent();
  registerTaxComponent();
  registerDiscountComponent();
  registerPaymentTermsComponent();
  registerSignatureComponent();
  registerCustomFieldComponent();
  registerNotesComponent();
  registerTermsComponent();
  registerPaymentInstructionsComponent();
  registerFeesComponent();
  registerTotalComponent();
  registerAmountDueComponent();
  registerBusinessInfoComponent();
  registerSpacerComponent();
  registerDividerComponent();
  registerSectionComponent();
  registerRowComponent();
  registerColumnComponent();
}

function registerTextComponent() {
  const def: ComponentDefinition<TextComponent> = {
    type: "text",
    label: "Text",
    description: "Add custom text content",
    icon: null,
    category: "content",
    defaultProps: { content: "Your text here...", format: "plain" },
    defaultStyle: { fontSize: 14, color: "#333", textAlign: "left" },
    schema: z.object({
      id: z.string(),
      type: z.literal("text"),
      props: z.object({
        content: z.string(),
        format: z.enum(["plain", "markdown", "html"]).optional(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component, ctx) => {
      const { content, format = "plain" } = component.props;
      let rendered: React.ReactNode = content;
      if (format === "markdown") {
        rendered = <p style={{ whiteSpace: "pre-wrap" }}>{content}</p>;
      } else if (format === "html") {
        rendered = <div dangerouslySetInnerHTML={{ __html: content }} />;
      } else {
        rendered = <p style={{ whiteSpace: "pre-wrap" }}>{content}</p>;
      }
      return (
        <div
          style={{
            fontSize: component.style.fontSize,
            fontFamily: component.style.fontFamily,
            fontWeight: component.style.fontWeight,
            color: component.style.color,
            textAlign: component.style.textAlign || "left",
            padding: component.style.padding,
            margin: component.style.margin,
            backgroundColor: component.style.backgroundColor,
            ...component.style,
          }}
        >
          {rendered}
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
            <textarea
              value={component.props.content}
              onChange={(e) => onChange({ content: e.target.value }, {})}
              rows={3}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Format</label>
            <select
              value={component.props.format || "plain"}
              onChange={(e) => onChange({ format: e.target.value as any }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="plain">Plain text</option>
              <option value="markdown">Markdown</option>
              <option value="html">HTML</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Font Size</label>
              <input
                type="number"
                value={component.style.fontSize || 14}
                onChange={(e) => onChange({}, { fontSize: parseInt(e.target.value) || 14 })}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
              <input
                type="color"
                value={component.style.color || "#333333"}
                onChange={(e) => onChange({}, { color: e.target.value })}
                className="w-full h-9 border border-slate-300 rounded-lg cursor-pointer"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Alignment</label>
            <div className="flex gap-2">
              {(["left", "center", "right", "justify"] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => onChange({}, { textAlign: align })}
                  className={`px-3 py-1 text-xs rounded ${
                    component.style.textAlign === align
                      ? "bg-primary-100 text-primary-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {align}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerImageComponent() {
  const def: ComponentDefinition<ImageComponent> = {
    type: "image",
    label: "Image",
    description: "Add an image or company logo",
    icon: null,
    category: "content",
    defaultProps: { src: "", alt: "Image", width: "auto", height: "auto", fit: "contain" },
    defaultStyle: { maxWidth: "100%", height: "auto" },
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    schema: z.object({
      id: z.string(),
      type: z.union([z.literal("image"), z.literal("logo")]),
      props: z.object({
        src: z.string(),
        alt: z.string().optional(),
        width: z.union([z.string(), z.number()]).optional(),
        height: z.union([z.string(), z.number()]).optional(),
        fit: z.enum(["cover", "contain", "fill", "none", "scale-down"]).optional(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    render: (component) => {
      const { src, alt, fit = "contain" } = component.props;
      if (!src) {
        return (
          <div className="border border-slate-200 rounded-lg bg-slate-50 text-center py-6 text-sm text-slate-400">
            No image selected
          </div>
        );
      }
      return (
        <img
          src={src}
          alt={alt || "Image"}
          style={{
            objectFit: fit,
            width: component.props.width,
            height: component.props.height,
            maxWidth: "100%",
            ...component.style,
          }}
        />
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Image URL</label>
            <input
              type="url"
              value={component.props.src || ""}
              onChange={(e) => onChange({ src: e.target.value }, {})}
              placeholder="https://example.com/logo.png"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Alt Text</label>
            <input
              type="text"
              value={component.props.alt || ""}
              onChange={(e) => onChange({ alt: e.target.value }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fit</label>
            <select
              value={component.props.fit || "contain"}
              onChange={(e) => onChange({ fit: e.target.value as any }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="contain">Contain</option>
              <option value="cover">Cover</option>
              <option value="fill">Fill</option>
              <option value="none">None</option>
              <option value="scale-down">Scale-down</option>
            </select>
          </div>
        </div>
      );
    },
  };
  registerComponent(def);

  const logoDef: ComponentDefinition<ImageComponent> = {
    ...def,
    type: "logo",
    label: "Logo",
    description: "Company logo image",
    category: "content",
    defaultProps: { src: "", alt: "Logo", fit: "contain" },
    schema: def.schema,
    render: (component) => {
      const { src, alt = "Logo" } = component.props;
      if (!src) {
        return (
          <div className="border border-slate-200 rounded-lg bg-slate-50 text-center py-4 text-sm text-slate-400">
            No logo selected
          </div>
        );
      }
      return (
        <img
          src={src}
          alt={alt}
          style={{
            maxHeight: "80px",
            maxWidth: "100%",
            objectFit: "contain",
            ...component.style,
          }}
        />
      );
    },
  };
  registerComponent(logoDef);
}

function registerCustomerInfoComponent() {
  const def: ComponentDefinition<CustomerInfoComponent> = {
    type: "customerInfo",
    label: "Customer Info",
    description: "Display customer billing information",
    icon: null,
    category: "business",
    defaultProps: {
      showName: true,
      showCompany: true,
      showEmail: true,
      showAddress: true,
      showPhone: false,
      label: "Bill To",
    },
    defaultStyle: { textAlign: "left" },
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    schema: z.object({
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
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    render: (component, ctx) => {
      const customer = ctx.customer;
      const { showName, showCompany, showEmail, showAddress, showPhone, label } = component.props;
      return (
        <div style={{ ...component.style }}>
          {label && <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</h3>}
          {customer && (
            <div className="space-y-1">
              {showName && customer.name && <p className="font-semibold text-slate-900">{customer.name}</p>}
              {showCompany && customer.company_name && <p className="text-sm text-slate-600">{customer.company_name}</p>}
              {showEmail && customer.email && <p className="text-sm text-slate-500">{customer.email}</p>}
              {showAddress && customer.address && <p className="text-sm text-slate-500 whitespace-pre-line">{customer.address}</p>}
              {showPhone && customer.phone && <p className="text-sm text-slate-500">{customer.phone}</p>}
            </div>
          )}
          {!customer && (
            <p className="text-sm text-slate-400">No customer selected</p>
          )}
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              placeholder="e.g. Bill To"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showName}
                onChange={(e) => onChange({ showName: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Name
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showCompany}
                onChange={(e) => onChange({ showCompany: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Company
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showEmail}
                onChange={(e) => onChange({ showEmail: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Email
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showAddress}
                onChange={(e) => onChange({ showAddress: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Address
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showPhone}
                onChange={(e) => onChange({ showPhone: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Phone
            </label>
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerInvoiceNumberComponent() {
  const def: ComponentDefinition<InvoiceNumberComponent> = {
    type: "invoiceNumber",
    label: "Invoice Number",
    description: "Display the invoice number",
    icon: null,
    category: "business",
    defaultProps: { prefix: "#", label: "Invoice" },
    defaultStyle: { fontSize: 18, fontWeight: "bold", textAlign: "right" },
    schema: z.object({
      id: z.string(),
      type: z.literal("invoiceNumber"),
      props: z.object({
        prefix: z.string().optional(),
        format: z.string().optional(),
        label: z.string().optional(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component, ctx) => {
      const invoice = ctx.invoice;
      const { prefix = "#", label } = component.props;
      return (
        <div style={{ ...component.style }}>
          {label && <span className="text-xs text-slate-500">{label}</span>}
          <span>{prefix}{invoice?.invoiceNumber || "—"}</span>
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Prefix</label>
            <input
              type="text"
              value={component.props.prefix || ""}
              onChange={(e) => onChange({ prefix: e.target.value || undefined }, {})}
              placeholder="e.g. #"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              placeholder="e.g. Invoice"
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Font Size</label>
            <input
              type="number"
              value={component.style.fontSize || 14}
              onChange={(e) => onChange({}, { fontSize: parseInt(e.target.value) || 14 })}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerDateComponent() {
  const def: ComponentDefinition<DateComponent> = {
    type: "date",
    label: "Date",
    description: "Display issue or due date",
    icon: null,
    category: "business",
    defaultProps: { dateType: "issue", format: "YYYY-MM-DD", label: "Issue Date" },
    defaultStyle: { fontSize: 14, color: "#333", textAlign: "right" },
    schema: z.object({
      id: z.string(),
      type: z.literal("date"),
      props: z.object({
        dateType: z.enum(["issue", "due", "custom"]),
        format: z.string().optional(),
        label: z.string().optional(),
        customValue: z.string().optional(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component, ctx) => {
      const invoice = ctx.invoice;
      const { dateType, format, label, customValue } = component.props;
      let value: string;
      switch (dateType) {
        case "issue":
          value = invoice?.issueDate || new Date().toISOString().split("T")[0];
          break;
        case "due":
          value = invoice?.dueDate || new Date().toISOString().split("T")[0];
          break;
        case "custom":
          value = customValue || "";
          break;
        default:
          value = "";
      }
      return (
        <div style={{ ...component.style }}>
          {label && <span className="text-xs text-slate-500">{label}</span>}
          <span>{value}</span>
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date Type</label>
            <select
              value={component.props.dateType || "issue"}
              onChange={(e) => onChange({ dateType: e.target.value as any }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="issue">Issue Date</option>
              <option value="due">Due Date</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          {component.props.dateType === "custom" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Custom Value</label>
              <input
                type="text"
                value={component.props.customValue || ""}
                onChange={(e) => onChange({ customValue: e.target.value }, {})}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerLineItemsComponent() {
  const defaultColumns: LineItemColumn[] = [
    { key: "description", label: "Description", width: "40%", align: "left", visible: true },
    { key: "quantity", label: "Qty", width: "15%", align: "right", visible: true },
    { key: "unitPrice", label: "Rate", width: "20%", align: "right", visible: true },
    { key: "amount", label: "Amount", width: "25%", align: "right", visible: true },
  ];

  const def: ComponentDefinition<LineItemsComponent> = {
    type: "lineItems",
    label: "Line Items",
    description: "Display line item table",
    icon: null,
    category: "totals",
    defaultProps: {
      columns: defaultColumns,
      showHeader: true,
      showQuantity: true,
      showUnit: true,
      showUnitPrice: true,
      showDiscount: false,
      showTax: true,
      showLineTotal: true,
      currency: "USD",
      allowMultiPage: true,
      emptyStateMessage: "No line items yet",
    },
    defaultStyle: { width: "100%", borderCollapse: "collapse" },
    schema: z.object({
      id: z.string(),
      type: z.literal("lineItems"),
      props: z.object({
        columns: z.array(z.object({
          key: z.string(),
          label: z.string(),
          width: z.union([z.string(), z.number()]).optional(),
          align: z.enum(["left", "center", "right"]).optional(),
          visible: z.boolean(),
        })),
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
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component, ctx) => {
      const items = ctx.invoice?.items || [];
      const currency = ctx.currency || component.props.currency;
      const { columns, showHeader, allowMultiPage } = component.props;

      return (
        <div className="overflow-x-auto" style={{ ...component.style }}>
          <table className="w-full border-collapse">
            {showHeader && (
              <thead>
                <tr className="border-b border-slate-200">
                  {columns.filter((c) => c.visible).map((col) => (
                    <th
                      key={col.key}
                      className="text-left text-xs font-semibold text-slate-500 uppercase py-3"
                      style={{ textAlign: col.align || "left", width: col.width }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {items.map((item: any, i: number) => (
                <tr key={item.id || i} className="border-b border-slate-100">
                  {columns.filter((c) => c.visible).map((col) => {
                    let value: React.ReactNode = "";
                    switch (col.key) {
                      case "description":
                        value = item.description || "—";
                        break;
                      case "quantity":
                        value = `${item.quantity} ${item.unit || "each"}`;
                        break;
                      case "unitPrice":
                        value = ctx.calculations?.formatCurrency(item.unitPrice, currency);
                        break;
                      case "amount":
                        value = ctx.calculations?.formatCurrency(
                          ctx.calculations.computeLineTotal(item, currency),
                          currency
                        );
                        break;
                    }
                    return (
                      <td key={col.key} className="py-3 text-sm" style={{ textAlign: col.align || "left" }}>
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={columns.filter((c) => c.visible).length} className="py-8 text-center text-sm text-slate-400">
                    {component.props.emptyStateMessage || "No items"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {!allowMultiPage && <div className="text-xs text-slate-400 mt-2">Table constrained to current page</div>}
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <input
              type="text"
              value={component.props.currency || "USD"}
              onChange={(e) => onChange({ currency: e.target.value.toUpperCase() }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showHeader}
                onChange={(e) => onChange({ showHeader: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Show Header
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.allowMultiPage}
                onChange={(e) => onChange({ allowMultiPage: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Allow Multi-Page
            </label>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Columns</label>
            {component.props.columns.map((col, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <input
                  type="text"
                  value={col.label}
                  onChange={(e) => {
                    const cols = [...component.props.columns];
                    cols[idx] = { ...cols[idx], label: e.target.value };
                    onChange({ columns: cols }, {});
                  }}
                  className="flex-1 text-xs border border-slate-300 rounded-lg px-2 py-1"
                />
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={(e) => {
                      const cols = [...component.props.columns];
                      cols[idx] = { ...cols[idx], visible: e.target.checked };
                      onChange({ columns: cols }, {});
                    }}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  Visible
                </label>
              </div>
            ))}
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerSubtotalComponent() {
  const def: ComponentDefinition<SubtotalComponent> = {
    type: "subtotal",
    label: "Subtotal",
    description: "Show the subtotal amount",
    icon: null,
    category: "totals",
    defaultProps: { label: "Subtotal", currency: "USD" },
    defaultStyle: { display: "flex", justifyContent: "space-between", padding: "8px 0" },
    schema: z.object({
      id: z.string(),
      type: z.literal("subtotal"),
      props: z.object({
        label: z.string().optional(),
        currency: z.string(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component, ctx) => {
      const value = ctx.calculations?.subtotal || "0.00";
      const currency = ctx.currency || component.props.currency;
      return (
        <div style={{ ...component.style }}>
          <span className="text-slate-600">{component.props.label || "Subtotal"}</span>
          <span className="font-medium text-slate-900">
            {ctx.calculations?.formatCurrency(value, currency)}
          </span>
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <input
              type="text"
              value={component.props.currency || "USD"}
              onChange={(e) => onChange({ currency: e.target.value.toUpperCase() }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerTaxComponent() {
  const def: ComponentDefinition<TaxComponent> = {
    type: "tax",
    label: "Tax",
    description: "Show tax breakdown",
    icon: null,
    category: "totals",
    defaultProps: { label: "Tax", currency: "USD", showBreakdown: true },
    defaultStyle: { display: "flex", justifyContent: "space-between", padding: "8px 0" },
    schema: z.object({
      id: z.string(),
      type: z.literal("tax"),
      props: z.object({
        label: z.string().optional(),
        currency: z.string(),
        showBreakdown: z.boolean(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component, ctx) => {
      const value = ctx.calculations?.taxTotal || "0.00";
      const currency = ctx.currency || component.props.currency;
      return (
        <div style={{ ...component.style }}>
          <span className="text-slate-600">{component.props.label || "Tax"}</span>
          <span className="font-medium text-slate-900">
            {ctx.calculations?.formatCurrency(value, currency)}
          </span>
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <input
              type="text"
              value={component.props.currency || "USD"}
              onChange={(e) => onChange({ currency: e.target.value.toUpperCase() }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={component.props.showBreakdown}
              onChange={(e) => onChange({ showBreakdown: e.target.checked }, {})}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            Show Tax Breakdown
          </label>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerDiscountComponent() {
  const def: ComponentDefinition<DiscountComponent> = {
    type: "discount",
    label: "Discount",
    description: "Show discount amount",
    icon: null,
    category: "totals",
    defaultProps: { label: "Discount", currency: "USD" },
    defaultStyle: { display: "flex", justifyContent: "space-between", padding: "8px 0" },
    schema: z.object({
      id: z.string(),
      type: z.literal("discount"),
      props: z.object({
        label: z.string().optional(),
        currency: z.string(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component, ctx) => {
      const value = ctx.calculations?.discountTotal || "0.00";
      const currency = ctx.currency || component.props.currency;
      return (
        <div style={{ ...component.style }}>
          <span className="text-slate-600">{component.props.label || "Discount"}</span>
          <span className="font-medium text-slate-900">
            -{ctx.calculations?.formatCurrency(value, currency)}
          </span>
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <input
              type="text"
              value={component.props.currency || "USD"}
              onChange={(e) => onChange({ currency: e.target.value.toUpperCase() }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerPaymentTermsComponent() {
  const def: ComponentDefinition<PaymentTermsComponent> = {
    type: "paymentTerms",
    label: "Payment Terms",
    description: "Display payment terms",
    icon: null,
    category: "business",
    defaultProps: { content: "Net 30", label: "Payment Terms" },
    defaultStyle: { fontSize: 14, color: "#333" },
    schema: z.object({
      id: z.string(),
      type: z.literal("paymentTerms"),
      props: z.object({
        content: z.string(),
        label: z.string().optional(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component, ctx) => {
      return (
        <div style={{ ...component.style }}>
          {component.props.label && <span className="text-xs text-slate-500">{component.props.label}</span>}
          <p className="text-sm text-slate-700 whitespace-pre-line">{component.props.content}</p>
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
            <textarea
              value={component.props.content || ""}
              onChange={(e) => onChange({ content: e.target.value }, {})}
              rows={3}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerSignatureComponent() {
  const def: ComponentDefinition<SignatureComponent> = {
    type: "signature",
    label: "Signature",
    description: "Add a signature line",
    icon: null,
    category: "business",
    defaultProps: { label: "Authorized Signature", placeholder: "__________________________", showDate: true, showName: true },
    defaultStyle: { marginTop: "32px", textAlign: "right" },
    schema: z.object({
      id: z.string(),
      type: z.literal("signature"),
      props: z.object({
        label: z.string().optional(),
        placeholder: z.string().optional(),
        showDate: z.boolean(),
        showName: z.boolean(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component) => {
      return (
        <div style={{ ...component.style }}>
          {component.props.label && <p className="text-xs text-slate-500 mb-1">{component.props.label}</p>}
          <p className="text-sm text-slate-700">{component.props.placeholder || "__________________________"}</p>
          {component.props.showDate && <p className="text-xs text-slate-500 mt-1">Date: ______________</p>}
          {component.props.showName && <p className="text-xs text-slate-500 mt-1">Name: ______________</p>}
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Placeholder</label>
            <input
              type="text"
              value={component.props.placeholder || ""}
              onChange={(e) => onChange({ placeholder: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showDate}
                onChange={(e) => onChange({ showDate: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Show Date
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showName}
                onChange={(e) => onChange({ showName: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Show Name
            </label>
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerCustomFieldComponent() {
  const def: ComponentDefinition<CustomFieldComponent> = {
    type: "customField",
    label: "Custom Field",
    description: "Add a custom field value",
    icon: null,
    category: "content",
    defaultProps: { key: "custom_field_1", label: "Custom Field", value: "", type: "text" },
    defaultStyle: { fontSize: 14, color: "#333", display: "flex", justifyContent: "space-between", padding: "4px 0" },
    schema: z.object({
      id: z.string(),
      type: z.literal("customField"),
      props: z.object({
        key: z.string(),
        label: z.string(),
        value: z.string(),
        type: z.enum(["text", "number", "date", "select"]),
        options: z.array(z.string()).optional(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component) => {
      return (
        <div style={{ ...component.style }}>
          <span className="text-slate-600">{component.props.label}</span>
          <span className="font-medium text-slate-900">{component.props.value}</span>
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label}
              onChange={(e) => onChange({ label: e.target.value }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
            <input
              type="text"
              value={component.props.value}
              onChange={(e) => onChange({ value: e.target.value }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Key</label>
            <input
              type="text"
              value={component.props.key}
              onChange={(e) => onChange({ key: e.target.value }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerNotesComponent() {
  const def: ComponentDefinition<NotesComponent> = {
    type: "notes",
    label: "Notes",
    description: "Display additional notes",
    icon: null,
    category: "content",
    defaultProps: { content: "Thank you for your business!", label: "Notes" },
    defaultStyle: { fontSize: 14, color: "#333", marginTop: "16px" },
    schema: z.object({
      id: z.string(),
      type: z.literal("notes"),
      props: z.object({
        content: z.string(),
        label: z.string().optional(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component) => {
      return (
        <div style={{ ...component.style }}>
          {component.props.label && <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{component.props.label}</p>}
          <p className="text-sm text-slate-700 whitespace-pre-line">{component.props.content}</p>
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
            <textarea
              value={component.props.content || ""}
              onChange={(e) => onChange({ content: e.target.value }, {})}
              rows={3}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerTermsComponent() {
  const def: ComponentDefinition<TermsComponent> = {
    type: "terms",
    label: "Terms",
    description: "Payment terms and conditions",
    icon: null,
    category: "business",
    defaultProps: { content: "Net 30", label: "Terms" },
    defaultStyle: { fontSize: 12, color: "#666", marginTop: "16px" },
    schema: z.object({
      id: z.string(),
      type: z.literal("terms"),
      props: z.object({
        content: z.string(),
        label: z.string().optional(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component) => {
      return (
        <div style={{ ...component.style }}>
          {component.props.label && <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{component.props.label}</p>}
          <p className="text-xs text-slate-500 whitespace-pre-line">{component.props.content}</p>
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
            <textarea
              value={component.props.content || ""}
              onChange={(e) => onChange({ content: e.target.value }, {})}
              rows={3}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerPaymentInstructionsComponent() {
  const def: ComponentDefinition<PaymentInstructionsComponent> = {
    type: "paymentInstructions",
    label: "Payment Instructions",
    description: "How to pay this invoice",
    icon: null,
    category: "business",
    defaultProps: { content: "Please pay via bank transfer to the account below.", label: "Payment Instructions" },
    defaultStyle: { fontSize: 14, color: "#333", marginTop: "16px" },
    schema: z.object({
      id: z.string(),
      type: z.literal("paymentInstructions"),
      props: z.object({
        content: z.string(),
        label: z.string().optional(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component) => {
      return (
        <div style={{ ...component.style }}>
          {component.props.label && <p className="text-xs font-semibold text-slate-500 uppercase mb-1">{component.props.label}</p>}
          <p className="text-sm text-slate-700 whitespace-pre-line">{component.props.content}</p>
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content</label>
            <textarea
              value={component.props.content || ""}
              onChange={(e) => onChange({ content: e.target.value }, {})}
              rows={3}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerFeesComponent() {
  const def: ComponentDefinition<FeesComponent> = {
    type: "fees",
    label: "Fees",
    description: "Show additional fees",
    icon: null,
    category: "totals",
    defaultProps: { label: "Fees", currency: "USD", showHeader: false },
    defaultStyle: {},
    schema: z.object({
      id: z.string(),
      type: z.literal("fees"),
      props: z.object({
        label: z.string().optional(),
        currency: z.string(),
        showHeader: z.boolean(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component, ctx) => {
      const fees = ctx.invoice?.fees || [];
      const currency = ctx.currency || component.props.currency;
      if (fees.length === 0) return null;
      return (
        <div style={{ ...component.style }}>
          {component.props.showHeader && (
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">{component.props.label || "Fees"}</h4>
          )}
          {fees.map((fee: any, i: number) => (
            <div key={i} className="flex justify-between py-1">
              <span className="text-sm text-slate-600">{fee.description}</span>
              <span className="text-sm font-medium text-slate-900">
                {ctx.calculations?.formatCurrency(fee.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <input
              type="text"
              value={component.props.currency || "USD"}
              onChange={(e) => onChange({ currency: e.target.value.toUpperCase() }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={component.props.showHeader}
              onChange={(e) => onChange({ showHeader: e.target.checked }, {})}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            Show Header
          </label>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerTotalComponent() {
  const def: ComponentDefinition<TotalComponent> = {
    type: "total",
    label: "Total",
    description: "Show the total amount",
    icon: null,
    category: "totals",
    defaultProps: { label: "Total", currency: "USD" },
    defaultStyle: { display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "2px solid #e2e8f0" },
    schema: z.object({
      id: z.string(),
      type: z.literal("total"),
      props: z.object({
        label: z.string().optional(),
        currency: z.string(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component, ctx) => {
      const value = ctx.calculations?.total || "0.00";
      const currency = ctx.currency || component.props.currency;
      return (
        <div style={{ ...component.style }}>
          <span className="text-lg font-semibold text-slate-900">{component.props.label || "Total"}</span>
          <span className="text-xl font-bold text-slate-900">
            {ctx.calculations?.formatCurrency(value, currency)}
          </span>
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <input
              type="text"
              value={component.props.currency || "USD"}
              onChange={(e) => onChange({ currency: e.target.value.toUpperCase() }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerAmountDueComponent() {
  const def: ComponentDefinition<AmountDueComponent> = {
    type: "amountDue",
    label: "Amount Due",
    description: "Show the amount due",
    icon: null,
    category: "totals",
    defaultProps: { label: "Amount Due", currency: "USD" },
    defaultStyle: { display: "flex", justifyContent: "space-between", padding: "12px 0" },
    schema: z.object({
      id: z.string(),
      type: z.literal("amountDue"),
      props: z.object({
        label: z.string().optional(),
        currency: z.string(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component, ctx) => {
      const value = ctx.calculations?.amountDue || "0.00";
      const currency = ctx.currency || component.props.currency;
      return (
        <div style={{ ...component.style }}>
          <span className="text-lg font-semibold text-slate-900">{component.props.label || "Amount Due"}</span>
          <span className="text-xl font-bold text-primary-700">
            {ctx.calculations?.formatCurrency(value, currency)}
          </span>
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
            <input
              type="text"
              value={component.props.currency || "USD"}
              onChange={(e) => onChange({ currency: e.target.value.toUpperCase() }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerBusinessInfoComponent() {
  const def: ComponentDefinition<BusinessInfoComponent> = {
    type: "businessInfo",
    label: "Business Info",
    description: "Display business details",
    icon: null,
    category: "business",
    defaultProps: {
      showName: true,
      showEmail: true,
      showPhone: false,
      showWebsite: false,
      showAddress: false,
      showLogo: true,
      label: "From",
    },
    defaultStyle: { textAlign: "left" },
    schema: z.object({
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
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component, ctx) => {
      const business = ctx.business;
      const { showName, showEmail, showPhone, showWebsite, showAddress, showLogo, label } = component.props;
      return (
        <div style={{ ...component.style }}>
          {label && <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</h3>}
          {business && (
            <div className="space-y-1">
              {showLogo && business.logo_url && (
                <img src={business.logo_url} alt={business.name} className="h-12 w-auto mb-2" />
              )}
              {showName && business.name && <p className="text-xl font-bold text-slate-900">{business.name}</p>}
              {showEmail && business.email && <p className="text-sm text-slate-500">{business.email}</p>}
              {showPhone && business.phone && <p className="text-sm text-slate-500">{business.phone}</p>}
              {showWebsite && business.website && <p className="text-sm text-slate-500">{business.website}</p>}
              {showAddress && business.address && <p className="text-sm text-slate-500 whitespace-pre-line">{business.address}</p>}
            </div>
          )}
          {!business && <p className="text-sm text-slate-400">No business set</p>}
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Label</label>
            <input
              type="text"
              value={component.props.label || ""}
              onChange={(e) => onChange({ label: e.target.value || undefined }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showName}
                onChange={(e) => onChange({ showName: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Name
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showEmail}
                onChange={(e) => onChange({ showEmail: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Email
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showPhone}
                onChange={(e) => onChange({ showPhone: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Phone
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showWebsite}
                onChange={(e) => onChange({ showWebsite: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Website
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showAddress}
                onChange={(e) => onChange({ showAddress: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Address
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={component.props.showLogo}
                onChange={(e) => onChange({ showLogo: e.target.checked }, {})}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              Logo
            </label>
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerSpacerComponent() {
  const def: ComponentDefinition<SpacerComponent> = {
    type: "spacer",
    label: "Spacer",
    description: "Add vertical space",
    icon: null,
    category: "content",
    defaultProps: { height: 16 },
    defaultStyle: { height: "16px" },
    schema: z.object({
      id: z.string(),
      type: z.literal("spacer"),
      props: z.object({
        height: z.union([z.string(), z.number()]),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component) => {
      const height = component.props.height;
      return <div style={{ height, ...component.style }} />;
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Height (px)</label>
            <input
              type="number"
              value={component.props.height || 16}
              onChange={(e) => onChange({ height: parseInt(e.target.value) || 16 }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerDividerComponent() {
  const def: ComponentDefinition<DividerComponent> = {
    type: "divider",
    label: "Divider",
    description: "Add a line separator",
    icon: null,
    category: "content",
    defaultProps: { thickness: 1, color: "#e0e0e0", style: "solid" },
    defaultStyle: {},
    schema: z.object({
      id: z.string(),
      type: z.literal("divider"),
      props: z.object({
        thickness: z.number(),
        color: z.string(),
        style: z.enum(["solid", "dashed", "dotted"]),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()).optional(),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    canHaveChildren: false,
    allowedParentTypes: ["column", "row", "section"],
    render: (component) => {
      return (
        <hr
          style={{
            height: `${component.props.thickness}px`,
            backgroundColor: component.props.color,
            border: "none",
            borderTop: `${component.props.thickness}px ${component.props.style} ${component.props.color}`,
            margin: "16px 0",
            ...component.style,
          }}
        />
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Thickness (px)</label>
            <input
              type="number"
              value={component.props.thickness || 1}
              onChange={(e) => onChange({ thickness: parseInt(e.target.value) || 1 }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
            <input
              type="color"
              value={component.props.color || "#e0e0e0"}
              onChange={(e) => onChange({ color: e.target.value }, {})}
              className="w-full h-9 border border-slate-300 rounded-lg cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Style</label>
            <select
              value={component.props.style || "solid"}
              onChange={(e) => onChange({ style: e.target.value as any }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerSectionComponent() {
  const def: ComponentDefinition<SectionComponent> = {
    type: "section",
    label: "Section",
    description: "A container for rows and columns",
    icon: null,
    category: "structure",
    defaultProps: { name: "Section", fullWidth: true },
    defaultStyle: { width: "100%", padding: "16px 0" },
    canHaveChildren: true,
    allowedParentTypes: ["section"],
    schema: z.object({
      id: z.string(),
      type: z.literal("section"),
      props: z.object({
        name: z.string(),
        fullWidth: z.boolean(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    render: (component, ctx, children) => {
      return (
        <section
          style={{
            width: component.props.fullWidth ? "100%" : "auto",
            padding: component.style.padding || "16px 0",
            ...component.style,
          }}
        >
          {children}
        </section>
      );
    },
    inspector: (component, onChange, _ctx) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={component.props.name}
              onChange={(e) => onChange({ name: e.target.value }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={component.props.fullWidth}
              onChange={(e) => onChange({ fullWidth: e.target.checked }, {})}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            Full Width
          </label>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerRowComponent() {
  const def: ComponentDefinition<RowComponent> = {
    type: "row",
    label: "Row",
    description: "A row that contains columns",
    icon: null,
    category: "structure",
    defaultProps: { name: "Row", columns: 2, columnGap: 16, rowGap: 16 },
    defaultStyle: { display: "flex", gap: "16px", width: "100%", flexWrap: "wrap" },
    canHaveChildren: true,
    allowedParentTypes: ["section"],
    schema: z.object({
      id: z.string(),
      type: z.literal("row"),
      props: z.object({
        name: z.string(),
        columns: z.number(),
        columnGap: z.union([z.string(), z.number()]),
        rowGap: z.union([z.string(), z.number()]),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    render: (component, ctx, children) => {
      const gapStr = typeof component.props.columnGap === "string" ? component.props.columnGap : `${component.props.columnGap}px`;
      return (
        <div
          className="flex flex-wrap items-start"
          style={{
            gap: gapStr,
            ...component.style,
          }}
        >
          {children}
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={component.props.name}
              onChange={(e) => onChange({ name: e.target.value }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Columns</label>
            <input
              type="number"
              min={1}
              max={4}
              value={component.props.columns}
              onChange={(e) => onChange({ columns: parseInt(e.target.value) || 2 }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gap (px)</label>
            <input
              type="number"
              min={0}
              value={typeof component.props.columnGap === "number" ? component.props.columnGap : 16}
              onChange={(e) => onChange({ columnGap: parseInt(e.target.value) || 16 }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}

function registerColumnComponent() {
  const def: ComponentDefinition<ColumnComponent> = {
    type: "column",
    label: "Column",
    description: "A column within a row",
    icon: null,
    category: "structure",
    defaultProps: { name: "Column", span: 1 },
    defaultStyle: { flex: 1, minWidth: "120px" },
    canHaveChildren: true,
    allowedParentTypes: ["row"],
    schema: z.object({
      id: z.string(),
      type: z.literal("column"),
      props: z.object({
        name: z.string(),
        span: z.number(),
      }),
      style: z.record(z.string(), z.unknown()),
      children: z.array(z.string()),
      parentId: z.string().optional(),
      visible: z.boolean().optional(),
      condition: z.string().optional(),
    }) as any,
    render: (component, ctx, children) => {
      return (
        <div
          className="flex flex-col"
          style={{
            flex: `${component.props.span || 1} 1 0%`,
            minWidth: "120px",
            ...component.style,
          }}
        >
          {children}
        </div>
      );
    },
    inspector: (component, onChange) => {
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={component.props.name}
              onChange={(e) => onChange({ name: e.target.value }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Span</label>
            <input
              type="number"
              min={1}
              max={12}
              value={component.props.span || 1}
              onChange={(e) => onChange({ span: parseInt(e.target.value) || 1 }, {})}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      );
    },
  };
  registerComponent(def);
}


import React from "react";
import type { FrontendInvoiceTemplateDocument } from "../document-model/invoice-template-schemas";
import { getChildren, findComponentDeep } from "../document-model";

interface TemplateRenderProps {
  document: FrontendInvoiceTemplateDocument;
  business: any;
  customer: any;
  invoice: any;
  lineItems: any[];
  fees: any[];
  totals: any;
  currency?: string;
  locale?: string;
}

enum ComponentRendererType {
  Text = "text",
  Image = "image",
  Logo = "logo",
  CustomerInfo = "customerInfo",
  BusinessInfo = "businessInfo",
  InvoiceNumber = "invoiceNumber",
  Date = "date",
  LineItems = "lineItems",
  Subtotal = "subtotal",
  Tax = "tax",
  Discount = "discount",
  Fees = "fees",
  Total = "total",
  AmountDue = "amountDue",
  PaymentTerms = "paymentTerms",
  Notes = "notes",
  Terms = "terms",
  PaymentInstructions = "paymentInstructions",
  Signature = "signature",
  CustomField = "customField",
  Spacer = "spacer",
  Divider = "divider",
  Section = "section",
  Row = "row",
  Column = "column",
}

function formatCurrency(value: unknown, currency: string, locale: string): string {
  const num = Number(value);
  if (isNaN(num)) return "";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: currency === "JPY" || currency === "KRW" || currency === "VND" ? 0 : 2,
    maximumFractionDigits: currency === "JPY" || currency === "KRW" || currency === "VND" ? 0 : 2,
  }).format(num);
}

function formatRate(value: unknown): string {
  const num = Number(value);
  if (isNaN(num) || num === 0) return "0.00%";
  return `${(num * 100).toFixed(2)}%`;
}

function formatDate(value: unknown, fmt?: string): string {
  if (!value) return "";
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return "";
  if (fmt === "short") return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (fmt === "long") return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  return d.toISOString().slice(0, 10);
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function evaluateCondition(condition: string | undefined, ctx: RenderContext): boolean {
  if (!condition) return true;
  try {
    return Boolean(evalCondition(condition, ctx));
  } catch {
    return true;
  }
}

function evalCondition(condition: string, ctx: RenderContext): boolean {
  const safeScope = {
    business: ctx.business,
    customer: ctx.customer,
    invoice: ctx.invoice,
    lineItems: ctx.lineItems,
    fees: ctx.fees,
    totals: ctx.totals,
    currency: ctx.currency,
    locale: ctx.locale,
    Boolean,
    String,
    Number,
    isNaN,
    parseFloat,
    parseInt,
  };
  // eslint-disable-next-line no-new-func
  const fn = new Function(...Object.keys(safeScope), `return ${condition};`);
  return Boolean(fn(...Object.values(safeScope)));
}

interface RenderContext extends TemplateRenderProps {
  business: any;
  customer: any;
  invoice: any;
  lineItems: any[];
  fees: any[];
  totals: any;
  currency: string;
  locale: string;
  calculations?: any;
}

function styleToReactStyle(style: Record<string, unknown> | undefined): React.CSSProperties {
  if (!style) return {};
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(style)) {
    const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (typeof value === "number" && !key.includes("zIndex") && !key.includes("opacity") && !key.includes("weight")) {
      result[camelKey] = `${value}px`;
    } else {
      result[camelKey] = value as string | number;
    }
  }
  return result as React.CSSProperties;
}

function renderLineItemValue(item: Record<string, unknown>, key: string, currency: string, locale: string): string {
  switch (key) {
    case "description":
      return String(item.description ?? "");
    case "quantity":
    case "hours":
    case "visits":
      return Number(item.quantity).toFixed(2);
    case "unit":
      return String(item.unit ?? "");
    case "unitPrice":
    case "rate":
    case "price":
      return formatCurrency(item.unitPrice, currency, locale);
    case "discount":
      return formatCurrency(item.discount, currency, locale);
    case "taxRate":
      return formatRate(item.taxRate);
    case "taxAmount":
    case "tax":
      return formatCurrency(item.taxAmount, currency, locale);
    case "lineSubtotal":
    case "subtotal":
      return formatCurrency(item.lineSubtotal, currency, locale);
    case "lineTotal":
    case "amount":
    case "total":
      return formatCurrency(item.lineTotal, currency, locale);
    case "sku":
      return String(item.sku ?? "");
    case "product":
      return String(item.product ?? "");
    case "package":
      return String(item.package ?? "");
    case "usage":
      return String(item.usage ?? "");
    case "task":
      return String(item.task ?? "");
    case "type":
      return String(item.type ?? "");
    case "service":
      return String(item.service ?? "");
    case "milestone":
      return String(item.milestone ?? "");
    default:
      const val = item[key];
      if (key.toLowerCase().includes("price") || key.toLowerCase().includes("amount") || key.toLowerCase().includes("total")) {
        return formatCurrency(val, currency, locale);
      }
      if (key.toLowerCase().includes("tax") || key.toLowerCase().includes("rate")) {
        return formatRate(val);
      }
      return String(val ?? "");
  }
}

function renderComponent(
  comp: any,
  doc: any,
  ctx: RenderContext
): React.ReactNode {
  if (!comp) return null;
  const visible = comp.visible !== false;
  if (!visible) return null;

  const style = styleToReactStyle(comp.style as Record<string, unknown> | undefined);
  const dataComponent = comp.id as string;
  const compType = comp.type as string;

  const childIds = comp.children as string[] | undefined;
  const children = childIds && childIds.length > 0
    ? childIds.map((id) => {
        const child = findComponentDeep(doc as any, id);
        return child ? <React.Fragment key={id}>{renderComponent(child, doc, ctx)}</React.Fragment> : null;
      })
    : undefined;

  const baseProps = {
    "data-component": dataComponent,
    style,
  };

  switch (compType) {
    case ComponentRendererType.Text: {
      const props = comp.props as any;
      return (
        <div {...baseProps}>{props?.content ?? ""}</div>
      );
    }

    case ComponentRendererType.Image:
    case ComponentRendererType.Logo: {
      const props = comp.props as any;
      const imgStyle: React.CSSProperties = props?.width || props?.height
        ? { width: props.width, height: props.height, objectFit: props.fit ?? "contain" }
        : { maxWidth: "100%", height: "auto" };
      return <img {...baseProps} src={props?.src ?? ""} alt={props?.alt ?? ""} style={{ ...style, ...imgStyle }} />;
    }

    case ComponentRendererType.CustomerInfo: {
      const props = comp.props as any;
      const c = ctx.customer;
      if (!c) return <div {...baseProps}>No customer</div>;
      const showName = props?.showName;
      const showCompany = props?.showCompany;
      const showEmail = props?.showEmail;
      const showAddress = props?.showAddress;
      const showPhone = props?.showPhone;
      const label = props?.label as string | undefined;

      return (
        <div {...baseProps}>
          {label && <div className="label">{label}</div>}
          <div className="customer-info">
            {showName && <div className="customer-name">{c.name ?? ""}</div>}
            {showCompany && c.companyName && <div className="customer-company">{c.companyName}</div>}
            {showEmail && c.email && <div className="customer-email">{c.email}</div>}
            {showAddress && c.address && (
              <div className="customer-address">
                {formatAddressReact(c.address as Record<string, unknown>)}
              </div>
            )}
            {showPhone && c.phone && <div className="customer-phone">{c.phone}</div>}
          </div>
        </div>
      );
    }

    case ComponentRendererType.BusinessInfo: {
      const props = comp.props as any;
      const b = ctx.business;
      const showName = props?.showName;
      const showEmail = props?.showEmail;
      const showPhone = props?.showPhone;
      const showWebsite = props?.showWebsite;
      const showAddress = props?.showAddress;
      const showLogo = props?.showLogo;
      const label = props?.label as string | undefined;

      return (
        <div {...baseProps}>
          {label && <div className="label">{label}</div>}
          {showLogo && b.logoUrl && (
            <img className="logo" src={b.logoUrl as string} alt={b.name as string} style={{ maxHeight: 60 }} />
          )}
          <div className="business-info">
            {showName && <div className="business-name">{b.name ?? ""}</div>}
            {showEmail && b.email && <div className="business-email">{b.email}</div>}
            {showPhone && b.phone && <div className="business-phone">{b.phone}</div>}
            {showWebsite && b.website && <div className="business-website">{b.website}</div>}
            {showAddress && b.address && (
              <div className="business-address">
                {formatAddressReact(b.address as Record<string, unknown>)}
              </div>
            )}
          </div>
        </div>
      );
    }

    case ComponentRendererType.InvoiceNumber: {
      const props = comp.props as any;
      const prefix = (props?.prefix as string) ?? "";
      const label = props?.label as string | undefined;
      const number = ctx.invoice.invoiceNumber ?? "";
      return (
        <div {...baseProps}>
          {label && <div className="label">{label}</div>}
          <div className="invoice-number">{prefix}{number}</div>
        </div>
      );
    }

    case ComponentRendererType.Date: {
      const props = comp.props as any;
      const dateType = props?.dateType as string;
      const fmt = props?.format as string | undefined;
      const label = props?.label as string | undefined;
      let rawDate: unknown = null;
      if (dateType === "issue") rawDate = ctx.invoice.issueDate;
      else if (dateType === "due") rawDate = ctx.invoice.dueDate;
      else rawDate = props?.customValue ?? null;
      const formatted = formatDate(rawDate, fmt);

      return (
        <div {...baseProps}>
          {label && <div className="label">{label}</div>}
          <div className="date-value">{formatted}</div>
        </div>
      );
    }

    case ComponentRendererType.LineItems: {
      const props = comp.props as any;
      const columns = (props?.columns as Array<{
        key: string;
        label: string;
        width?: string | number;
        align?: string;
        visible: boolean;
      }>) ?? [];
      const showHeader = props?.showHeader ?? true;

      return (
        <div {...baseProps}>
          <table className="line-items" style={{ width: "100%", borderCollapse: "collapse" }}>
            {showHeader && (
              <thead>
                <tr>
                  {columns.filter((c) => c.visible).map((col) => (
                    <th key={col.key} style={{ textAlign: (col.align ?? "left") as React.CSSProperties["textAlign"] }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {ctx.lineItems.map((item, idx) => (
                <tr key={idx}>
                  {columns.filter((c) => c.visible).map((col) => (
                    <td key={col.key} style={{ textAlign: (col.align ?? "left") as React.CSSProperties["textAlign"] }}>
                      {renderLineItemValue(item, col.key, ctx.currency, ctx.locale)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case ComponentRendererType.Subtotal: {
      const props = comp.props as any;
      const label = (props?.label as string) ?? "Subtotal";
      const currency = (props?.currency as string) ?? ctx.currency;
      return (
        <div {...baseProps}>
          <span className="label">{label}:</span>{" "}
          <span className="value">{formatCurrency(ctx.totals.subtotal, currency, ctx.locale)}</span>
        </div>
      );
    }

    case ComponentRendererType.Tax: {
      const props = comp.props as any;
      const label = (props?.label as string) ?? "Tax";
      const currency = (props?.currency as string) ?? ctx.currency;
      return (
        <div {...baseProps}>
          <span className="label">{label}:</span>{" "}
          <span className="value">{formatCurrency(ctx.totals.taxTotal, currency, ctx.locale)}</span>
        </div>
      );
    }

    case ComponentRendererType.Discount: {
      const props = comp.props as any;
      const label = (props?.label as string) ?? "Discount";
      const currency = (props?.currency as string) ?? ctx.currency;
      return (
        <div {...baseProps}>
          <span className="label">{label}:</span>{" "}
          <span className="value">({formatCurrency(ctx.totals.discountTotal, currency, ctx.locale)})</span>
        </div>
      );
    }

    case ComponentRendererType.Fees: {
      const props = comp.props as any;
      const label = (props?.label as string) ?? "Fees";
      const currency = (props?.currency as string) ?? ctx.currency;
      return (
        <div {...baseProps}>
          <span className="label">{label}:</span>{" "}
          <span className="value">{formatCurrency(ctx.totals.feeTotal, currency, ctx.locale)}</span>
        </div>
      );
    }

    case ComponentRendererType.Total: {
      const props = comp.props as any;
      const label = (props?.label as string) ?? "Total";
      const currency = (props?.currency as string) ?? ctx.currency;
      return (
        <div {...baseProps}>
          <span className="label">{label}:</span>{" "}
          <span className="value">{formatCurrency(ctx.totals.total, currency, ctx.locale)}</span>
        </div>
      );
    }

    case ComponentRendererType.AmountDue: {
      const props = comp.props as any;
      const label = (props?.label as string) ?? "Amount Due";
      const currency = (props?.currency as string) ?? ctx.currency;
      return (
        <div {...baseProps}>
          <span className="label">{label}:</span>{" "}
          <span className="value">{formatCurrency(ctx.totals.amountDue, currency, ctx.locale)}</span>
        </div>
      );
    }

    case ComponentRendererType.PaymentTerms: {
      const props = comp.props as any;
      const content = props?.content as string ?? "";
      const label = props?.label as string | undefined;
      return (
        <div {...baseProps}>
          {label && <div className="label">{label}</div>}
          <div className="content">{content}</div>
        </div>
      );
    }

    case ComponentRendererType.Notes: {
      const props = comp.props as any;
      const content = props?.content as string ?? "";
      const label = props?.label as string | undefined;
      return (
        <div {...baseProps}>
          {label && <div className="label">{label}</div>}
          <div className="content">{content}</div>
        </div>
      );
    }

    case ComponentRendererType.Terms: {
      const props = comp.props as any;
      const content = props?.content as string ?? "";
      const label = props?.label as string | undefined;
      return (
        <div {...baseProps}>
          {label && <div className="label">{label}</div>}
          <div className="content">{content}</div>
        </div>
      );
    }

    case ComponentRendererType.PaymentInstructions: {
      const props = comp.props as any;
      const content = props?.content as string ?? "";
      const label = props?.label as string | undefined;
      return (
        <div {...baseProps}>
          {label && <div className="label">{label}</div>}
          <div className="content">{content}</div>
        </div>
      );
    }

    case ComponentRendererType.Signature: {
      const props = comp.props as any;
      const label = (props?.label as string) ?? "Signature";
      const placeholder = (props?.placeholder as string) ?? "__________________________";
      const showDate = props?.showDate !== false;
      const showName = props?.showName !== false;

      return (
        <div {...baseProps}>
          <div className="label">{label}</div>
          <div className="signature">{placeholder}</div>
          {showDate && <div className="signature-date">Date: {new Date().toLocaleDateString(ctx.locale)}</div>}
          {showName && <div className="signature-name">Name: </div>}
        </div>
      );
    }

    case ComponentRendererType.CustomField: {
      const props = comp.props as any;
      const key = props?.key as string ?? "";
      const label = (props?.label as string) ?? key;
      const value = props?.value as string ?? "";
      return (
        <div {...baseProps}>
          <span className="label">{label}:</span> <span className="value">{value}</span>
        </div>
      );
    }

    case ComponentRendererType.Spacer: {
      const props = comp.props as any;
      const height = props?.height ?? 16;
      const h = typeof height === "number" ? `${height}px` : height;
      return <div {...baseProps} style={{ ...style, height: h as string | number }} />;
    }

    case ComponentRendererType.Divider: {
      const props = comp.props as any;
      const thickness = (props?.thickness as number) ?? 1;
      const color = (props?.color as string) ?? "#e2e8f0";
      const divStyle = (props?.style as string) ?? "solid";
      return (
        <hr
          {...baseProps}
          style={{ ...style, height: `${thickness}px`, border: `${thickness}px ${divStyle} ${color}` }}
        />
      );
    }

    case ComponentRendererType.Section: {
      const props = comp.props as any;
      const fullWidth = props?.fullWidth !== false;
      const sectionStyle: React.CSSProperties = fullWidth ? { width: "100%" } : { width: "auto" };
      const childIds = comp.children as string[] | undefined;

      if (!childIds || childIds.length === 0) {
        return <section {...baseProps} style={{ ...style, ...sectionStyle }} />;
      }

      return (
        <section {...baseProps} style={{ ...style, ...sectionStyle }}>
          {childIds.map((id) => {
            const child = doc.sections[id] || doc.rows[id] || doc.columns[id];
            if (!child) return null;
            return <React.Fragment key={id}>{renderComponent(child, doc, ctx)}</React.Fragment>;
          })}
        </section>
      );
    }

    case ComponentRendererType.Row: {
      const props = comp.props as any;
      const columnGap = (props?.columnGap as number | string) ?? 16;
      const gap = typeof columnGap === "number" ? `${columnGap}px` : columnGap;
      const childIds = comp.children as string[] | undefined;

      const rowStyle: React.CSSProperties = {
        display: "flex",
        flexDirection: "row" as const,
        gap,
        ...style,
      };

      if (!childIds || childIds.length === 0) {
        return <div {...baseProps} style={rowStyle} />;
      }

      return (
        <div {...baseProps} style={rowStyle}>
          {childIds.map((id) => {
            const child = doc.columns[id];
            if (!child) return null;
            return <React.Fragment key={id}>{renderComponent(child, doc, ctx)}</React.Fragment>;
          })}
        </div>
      );
    }

    case ComponentRendererType.Column: {
      const props = comp.props as any;
      const span = (props?.span as number) ?? 1;
      const childIds = comp.children as string[] | undefined;

      const colStyle: React.CSSProperties = {
        flex: span,
        ...style,
      };

      if (!childIds || childIds.length === 0) {
        return <div {...baseProps} style={colStyle} />;
      }

      return (
        <div {...baseProps} style={colStyle}>
          {childIds.map((id) => {
            const child = findComponentDeep(doc as any, id);
            if (!child) return null;
            return <React.Fragment key={id}>{renderComponent(child, doc, ctx)}</React.Fragment>;
          })}
        </div>
      );
    }

    default:
      return <div {...baseProps}>Unknown component: {compType}</div>;
  }
}

function formatAddressReact(address: any): React.ReactNode {
  if (!address) return null;
  return (
    <>
      <div>{address.addressLine1 ?? ""}</div>
      {address.addressLine2 && <div>{address.addressLine2}</div>}
      <div>
        {[address.city, address.stateOrRegion, address.postalCode].filter(Boolean).join(", ")}
      </div>
      <div>{address.countryCode ?? ""}</div>
    </>
  );
}

export function TemplateRender({
  document,
  business,
  customer,
  invoice,
  lineItems,
  fees,
  totals,
  currency = "USD",
  locale = "en-US",
}: TemplateRenderProps): React.ReactElement {
  const ctx: RenderContext = {
    document,
    business,
    customer,
    invoice,
    lineItems,
    fees,
    totals,
    currency,
    locale,
  };

  const rootSection = document.sections[document.rootSectionId];
  if (!rootSection) {
    return <div className="error">Invalid document structure</div>;
  }

  const childIds = (rootSection.children ?? []) as string[];
  const settings = document.settings;
  const margins = settings.margins ?? { top: 40, right: 40, bottom: 40, left: 40 };

  return (
    <div
      className="template-render"
      style={{
        fontFamily: settings.defaultFont,
        fontSize: `${settings.defaultFontSize}px`,
        color: settings.defaultColor,
        padding: `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`,
      }}
    >
      {childIds.map((id) => {
        const child = document.sections[id] || document.rows[id] || document.columns[id] || document.components[id];
        if (!child) return null;
        return <React.Fragment key={id}>{renderComponent(child, document, ctx)}</React.Fragment>;
      })}
    </div>
  );
}

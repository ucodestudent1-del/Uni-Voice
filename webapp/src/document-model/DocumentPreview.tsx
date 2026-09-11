import React from "react";
import { InvoiceDocument, AnyComponent } from "./types";
import { findComponent, getChildren } from "./document-operations";
import { getComponentDefinition, RenderContext } from "./registry/index";
import { initializeRegistry } from "./index";
import { Decimal } from "decimal.js";

initializeRegistry();

interface DocumentPreviewProps {
  document: InvoiceDocument;
  business: any;
  customer: any;
  invoice: any;
  calculations: any;
  currency: string;
  locale: string;
  className?: string;
}

function createRenderContext(
  doc: InvoiceDocument,
  business: any,
  customer: any,
  invoice: any,
  calculations: any,
  currency: string,
  locale: string,
  isEditing: boolean
): RenderContext {
  return {
    document: doc,
    business,
    customer,
    invoice,
    calculations,
    currency,
    locale,
    isEditing,
    selectedComponentId: null,
    onSelect: () => {},
  };
}

function renderComponent(
  component: AnyComponent,
  doc: InvoiceDocument,
  ctx: RenderContext,
  depth: number = 0
): React.ReactNode {
  const def = getComponentDefinition(component.type);
  if (!def) return null;

  const isStructural = component.type === "section" || component.type === "row" || component.type === "column";
  const childrenIds = getChildren(doc, component.id);

  let content: React.ReactNode;
  if (isStructural && childrenIds.length > 0) {
    const childElements = childrenIds.map((childId) => {
      const child = findComponent(doc, childId);
      if (!child) return null;
      return renderComponent(child, doc, ctx, depth + 1);
    });

    let flexDirection: React.CSSProperties["flexDirection"] = "column";
    if (component.type === "row") {
      flexDirection = "row";
    }

    content = (
      <div
        className="relative"
        style={{
          display: "flex",
          flexDirection,
          gap: component.type === "row" ? `${(component.props as any)?.columnGap || 16}px` : "0",
          width: component.props && typeof component.props === "object" && "fullWidth" in component.props
            ? component.props.fullWidth === false ? "auto" : "100%"
            : "100%",
          ...component.style,
        }}
      >
        {childElements}
      </div>
    );
  } else {
    content = def.render(component, ctx, undefined);
  }

  return (
    <div
      key={component.id}
      className="relative"
      style={{
        ...component.style,
        ...(component.visible === false ? { display: "none" } : {}),
      }}
      data-component-id={component.id}
      data-component-type={component.type}
    >
      {content}
    </div>
  );
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  document,
  business,
  customer,
  invoice,
  calculations,
  currency,
  locale,
  className = "",
}) => {
  const ctx = createRenderContext(document, business, customer, invoice, calculations, currency, locale, false);
  const rootSection = document.sections[document.rootSectionId];

  if (!rootSection) {
    return <div className="p-6">Invalid document</div>;
  }

  const children = getChildren(document, document.rootSectionId);

  return (
    <div className={`bg-white p-8 ${className}`} style={{
      fontFamily: document.settings.defaultFont,
      fontSize: `${document.settings.defaultFontSize}px`,
      color: document.settings.defaultColor,
    }}>
      {children.map((childId) => {
        const child = findComponent(document, childId);
        if (!child) return null;
        return renderComponent(child, document, ctx);
      })}
    </div>
  );
};

export default DocumentPreview;

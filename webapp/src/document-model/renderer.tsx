import React from "react";
import { InvoiceDocument, AnyComponent, ComponentType } from "./types";
import { getChildren, findComponent } from "./document-operations";
import { getComponentDefinition, RenderContext } from "./registry";

export interface StructuralRendererProps {
  document: InvoiceDocument;
  context: RenderContext;
  isEditing: boolean;
  selectedComponentId: string | null;
  onSelect: (id: string) => void;
  activeDrag?: {
    operation: "create" | "reorder";
    componentType: ComponentType | null;
  } | null;
}

function renderComponent(
  component: AnyComponent,
  doc: InvoiceDocument,
  ctx: RenderContext,
  options: {
    isEditing: boolean;
    selectedComponentId: string | null;
    onSelect: (id: string) => void;
    activeDrag?: {
      operation: "create" | "reorder";
      componentType: ComponentType | null;
    } | null;
    depth: number;
  }
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
      return renderComponent(child, doc, ctx, { ...options, depth: options.depth + 1 });
    });

    let flexDirection: React.CSSProperties["flexDirection"] = "column";
    if (component.type === "row") {
      flexDirection = "row";
    }

    const columnGap = component.type === "row" ? `${(component.props as any)?.columnGap || 16}px` : "0";
    const fullWidth = component.props && typeof component.props === "object" && "fullWidth" in component.props
      ? (component.props as any).fullWidth === false ? "auto" : "100%"
      : "100%";

    content = (
      <div
        className="relative"
        style={{
          display: "flex",
          flexDirection,
          gap: columnGap,
          width: fullWidth,
          ...component.style,
        }}
      >
        {childElements}
      </div>
    );
  } else {
    content = def.render(component, ctx, undefined);
  }

  const style: React.CSSProperties = {
    ...component.style,
    ...(component.visible === false ? { display: "none" } : {}),
  };

  return (
    <div
      key={component.id}
      className="relative"
      style={style}
      data-component-id={component.id}
      data-component-type={component.type}
    >
      {content}
    </div>
  );
}

export function renderDocumentTree(
  doc: InvoiceDocument,
  context: RenderContext,
  options: {
    isEditing: boolean;
    selectedComponentId: string | null;
    onSelect: (id: string) => void;
    activeDrag?: {
      operation: "create" | "reorder";
      componentType: ComponentType | null;
    } | null;
  }
): React.ReactNode {
  const rootSection = doc.sections[doc.rootSectionId];
  if (!rootSection) return <div className="p-6">Invalid document</div>;

  const children = getChildren(doc, doc.rootSectionId);

  return (
    <div
      style={{
        fontFamily: doc.settings.defaultFont,
        fontSize: `${doc.settings.defaultFontSize}px`,
        color: doc.settings.defaultColor,
      }}
    >
      {children.map((childId) => {
        const child = findComponent(doc, childId);
        if (!child) return null;
        return renderComponent(child, doc, context, { ...options, depth: 0 });
      })}
    </div>
  );
}

export function createRenderContext(
  doc: InvoiceDocument,
  business: any,
  customer: any,
  invoice: any,
  calculations: any,
  currency: string,
  locale: string,
  isEditing: boolean,
  selectedComponentId: string | null = null,
  onSelect: (id: string) => void = () => {}
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
    selectedComponentId,
    onSelect,
  };
}
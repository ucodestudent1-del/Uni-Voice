import React, { useMemo } from "react";
import { InvoiceDocument } from "./types";
import { renderDocumentTree, createRenderContext } from "./renderer";

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
  const ctx = useMemo(
    () => createRenderContext(document, business, customer, invoice, calculations, currency, locale, false),
    [document, business, customer, invoice, calculations, currency, locale]
  );

  return (
    <div className={`bg-surface p-8 ${className}`}>
      {renderDocumentTree(document, ctx, {
        isEditing: false,
        selectedComponentId: null,
        onSelect: () => {},
      })}
    </div>
  );
};

export default DocumentPreview;

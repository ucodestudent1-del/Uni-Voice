import React, { useMemo } from "react";
import { InvoiceDocument } from "./types";
import { renderDocumentTree, createRenderContext } from "./renderer";

interface DocumentPreviewProps {
  document: InvoiceDocument;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  business: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customer: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoice: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

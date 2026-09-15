export * from "./types";
export * from "./schemas";
export * from "./document-operations";
export * from "./registry";
export * from "./converter";
export * from "./invoice-template-schemas";
export { DocumentPreview } from "./DocumentPreview";
export { renderDocumentTree, createRenderContext } from "./renderer";

import { registerAllComponents } from "./registry/components";

export { registerAllComponents };

export function initializeRegistry() {
  registerAllComponents();
}

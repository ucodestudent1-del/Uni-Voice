import type { InvoiceTemplate } from "../schemas/invoice-template.js";
import type { InvoiceTemplateRevision } from "../schemas/invoice-template.js";

export interface InvoiceTemplateModel extends InvoiceTemplate {}

export interface InvoiceTemplateRevisionModel extends InvoiceTemplateRevision {}

export {
  InvoiceTemplateLifecycleSchema,
  InvoiceTemplateStatus,
  INVOICE_TEMPLATE_CURRENT_SCHEMA_VERSION,
  INVOICE_TEMPLATE_SCHEMA_VERSIONS,
} from "../schemas/invoice-template.js";

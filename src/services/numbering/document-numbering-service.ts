import { query, getClient } from "../../db/pool.js";
import { logger } from "../../utils/logger.js";
import { BusinessLogicError } from "../../domain/errors.js";

export type DocumentTypeKey =
  | "invoice"
  | "quote"
  | "credit-note"
  | "debit-note"
  | "payment-voucher"
  | "receipt"
  | "purchase-order"
  | "recurring-invoice"
  | "delivery-note"
  | "packing-slip"
  | "pro-forma-invoice"
  | "estimate";

export interface DocumentNumberConfig {
  prefix: string;
  padding: number;
  includesYear: boolean;
}

const DEFAULT_CONFIGS: Record<DocumentTypeKey, DocumentNumberConfig> = {
  invoice: { prefix: "INV", padding: 6, includesYear: true },
  quote: { prefix: "QOT", padding: 6, includesYear: true },
  "credit-note": { prefix: "CN", padding: 6, includesYear: true },
  "debit-note": { prefix: "DN", padding: 6, includesYear: true },
  "payment-voucher": { prefix: "PV", padding: 6, includesYear: true },
  receipt: { prefix: "REC", padding: 6, includesYear: true },
  "purchase-order": { prefix: "PO", padding: 6, includesYear: true },
  "recurring-invoice": { prefix: "RI", padding: 6, includesYear: true },
  "delivery-note": { prefix: "DN", padding: 6, includesYear: true },
  "packing-slip": { prefix: "PS", padding: 6, includesYear: true },
  "pro-forma-invoice": { prefix: "PI", padding: 6, includesYear: true },
  estimate: { prefix: "EST", padding: 6, includesYear: true },
};

const SETTING_COLUMNS: Record<DocumentTypeKey, string> = {
  invoice: "invoice_number_prefix",
  quote: "quote_number_prefix",
  "credit-note": "credit_note_prefix",
  "debit-note": "debit_note_prefix",
  "payment-voucher": "payment_voucher_prefix",
  receipt: "receipt_prefix",
  "purchase-order": "purchase_order_prefix",
  "recurring-invoice": "recurring_invoice_prefix",
  "delivery-note": "delivery_note_prefix",
  "packing-slip": "packing_slip_prefix",
  "pro-forma-invoice": "pro_forma_invoice_prefix",
  estimate: "estimate_prefix",
};

const SEQUENCE_TABLES: Record<DocumentTypeKey, string> = {
  invoice: "invoice_number_sequences",
  quote: "quote_number_sequences",
  "credit-note": "credit_note_number_sequences",
  "debit-note": "debit_note_number_sequences",
  "payment-voucher": "payment_voucher_number_sequences",
  receipt: "receipt_number_sequences",
  "purchase-order": "purchase_order_number_sequences",
  "recurring-invoice": "recurring_invoice_number_sequences",
  "delivery-note": "delivery_note_number_sequences",
  "packing-slip": "packing_slip_number_sequences",
  "pro-forma-invoice": "pro_forma_invoice_number_sequences",
  estimate: "estimate_number_sequences",
};

function pad(num: number, size: number): string {
  return num.toString().padStart(size, "0");
}

function formatNumber(assignedNumber: number, config: DocumentNumberConfig, date: Date): string {
  const padded = pad(assignedNumber, config.padding);
  if (config.includesYear) {
    const year = date.getFullYear().toString();
    return `${config.prefix}-${year}-${padded}`;
  }
  return `${config.prefix}-${padded}`;
}

export interface GeneratedDocumentNumber {
  number: string;
  sequenceValue: number;
}

export class DocumentNumberingService {
  async getConfig(businessId: string, docType: DocumentTypeKey): Promise<DocumentNumberConfig> {
    const prefixCol = SETTING_COLUMNS[docType];
    const paddingCol = prefixCol.replace("_prefix", "_padding");
    const yearCol = prefixCol.replace("_prefix", "_includes_year");

    let res;
    try {
      res = await query(
        `SELECT ${prefixCol}, ${paddingCol}, ${yearCol}
         FROM business_settings
         WHERE business_id = $1`,
        [businessId]
      );
    } catch {
      return { ...DEFAULT_CONFIGS[docType] };
    }

    const defaults = DEFAULT_CONFIGS[docType];

    if (!res.rows.length) {
      return { ...defaults };
    }

    const row = res.rows[0];
    return {
      prefix: row[prefixCol] ?? defaults.prefix,
      padding: Number(row[paddingCol] ?? defaults.padding),
      includesYear: Boolean(row[yearCol] ?? defaults.includesYear),
    };
  }

  async generate(businessId: string, docType: DocumentTypeKey, date: Date = new Date()): Promise<string> {
    const config = await this.getConfig(businessId, docType);
    const tableName = SEQUENCE_TABLES[docType];
    const client = await getClient();

    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO ${tableName} (business_id, prefix, next_number, padding, includes_year)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (business_id) DO UPDATE SET
           prefix = EXCLUDED.prefix,
           padding = EXCLUDED.padding,
           includes_year = EXCLUDED.includes_year
         WHERE ${tableName}.prefix IS DISTINCT FROM EXCLUDED.prefix
            OR ${tableName}.padding IS DISTINCT FROM EXCLUDED.padding
            OR ${tableName}.includes_year IS DISTINCT FROM EXCLUDED.includes_year`,
        [businessId, config.prefix, config.padding, config.includesYear]
      );

      const res = await client.query(
        `UPDATE ${tableName}
         SET next_number = next_number + 1
         WHERE business_id = $1
         RETURNING next_number - 1 AS assigned_number`,
        [businessId]
      );

      if (res.rowCount === 0) {
        throw new BusinessLogicError(
          `Failed to generate ${docType} number for business ${businessId}`,
          `${docType.toUpperCase()}_NUMBER_FAILED`
        );
      }

      const assignedNumber = Number(res.rows[0].assigned_number);
      const number = formatNumber(assignedNumber, config, date);
      await client.query("COMMIT");
      logger.info(`Generated ${docType} number ${number} for business ${businessId}`);
      return number;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `${docType} number generation failed for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }
}

export const documentNumberingService = new DocumentNumberingService();
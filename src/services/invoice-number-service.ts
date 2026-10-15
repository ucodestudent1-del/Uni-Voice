import { query, getClient } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { BusinessLogicError } from "../domain/errors.js";

const DEFAULT_INVOICE_CONFIG = {
  prefix: "INV",
  padding: 6,
  includesYear: true,
};

const DEFAULT_CREDIT_NOTE_CONFIG = {
  prefix: "CN",
  padding: 6,
  includesYear: true,
};

const DEFAULT_QUOTE_CONFIG = {
  prefix: "QOT",
  padding: 6,
  includesYear: true,
};

function pad(num: number, size: number): string {
  return num.toString().padStart(size, "0");
}

function formatInvoiceNumber(assignedNumber: number, config: typeof DEFAULT_INVOICE_CONFIG, date: Date): string {
  const padded = pad(assignedNumber, config.padding);
  if (config.includesYear) {
    const year = date.getFullYear().toString();
    return `${config.prefix}-${year}-${padded}`;
  }
  return `${config.prefix}-${padded}`;
}

function formatCreditNoteNumber(assignedNumber: number, config: typeof DEFAULT_CREDIT_NOTE_CONFIG, date: Date): string {
  const padded = pad(assignedNumber, config.padding);
  if (config.includesYear) {
    const year = date.getFullYear().toString();
    return `${config.prefix}-${year}-${padded}`;
  }
  return `${config.prefix}-${padded}`;
}

function formatQuoteNumber(assignedNumber: number, config: typeof DEFAULT_QUOTE_CONFIG, date: Date): string {
  const padded = pad(assignedNumber, config.padding);
  if (config.includesYear) {
    const year = date.getFullYear().toString();
    return `${config.prefix}-${year}-${padded}`;
  }
  return `${config.prefix}-${padded}`;
}

export interface InvoiceNumberConfig {
  prefix: string;
  padding: number;
  includesYear: boolean;
}

export class InvoiceNumberService {
  async getConfig(businessId: string): Promise<InvoiceNumberConfig> {
    const res = await query(
      `SELECT invoice_number_prefix, invoice_number_padding, invoice_includes_year
       FROM business_settings
       WHERE business_id = $1`,
      [businessId]
    );
    if (!res.rows.length) {
      return { ...DEFAULT_INVOICE_CONFIG };
    }
    return {
      prefix: res.rows[0].invoice_number_prefix ?? DEFAULT_INVOICE_CONFIG.prefix,
      padding: Number(res.rows[0].invoice_number_padding ?? DEFAULT_INVOICE_CONFIG.padding),
      includesYear: Boolean(res.rows[0].invoice_includes_year ?? DEFAULT_INVOICE_CONFIG.includesYear),
    };
  }

  async generate(businessId: string, date: Date = new Date()): Promise<string> {
    const config = await this.getConfig(businessId);
    const client = await getClient();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO invoice_number_sequences (business_id, prefix, next_number, padding, includes_year)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (business_id) DO UPDATE SET
           prefix = EXCLUDED.prefix,
           padding = EXCLUDED.padding,
           includes_year = EXCLUDED.includes_year
         WHERE invoice_number_sequences.prefix IS DISTINCT FROM EXCLUDED.prefix
            OR invoice_number_sequences.padding IS DISTINCT FROM EXCLUDED.padding
            OR invoice_number_sequences.includes_year IS DISTINCT FROM EXCLUDED.includes_year`,
        [businessId, config.prefix, config.padding, config.includesYear]
      );

      const res = await client.query(
        `UPDATE invoice_number_sequences
         SET next_number = next_number + 1
         WHERE business_id = $1
         RETURNING next_number - 1 AS assigned_number`,
        [businessId]
      );

      if (res.rowCount === 0) {
        throw new BusinessLogicError(
          `Failed to generate invoice number for business ${businessId}`,
          "INVOICE_NUMBER_FAILED"
        );
      }

      const assignedNumber = Number(res.rows[0].assigned_number);
      const number = formatInvoiceNumber(assignedNumber, config, date);
      await client.query("COMMIT");
      logger.info(`Generated invoice number ${number} for business ${businessId}`);
      return number;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Invoice number generation failed for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }
}

export const invoiceNumberService = new InvoiceNumberService();

export class QuoteNumberService {
  async getConfig(businessId: string): Promise<InvoiceNumberConfig> {
    const res = await query(
      `SELECT quote_number_prefix, quote_number_padding, quote_includes_year
       FROM business_settings
       WHERE business_id = $1`,
      [businessId]
    );
    if (!res.rows.length) {
      return { ...DEFAULT_QUOTE_CONFIG };
    }
    return {
      prefix: res.rows[0].quote_number_prefix ?? DEFAULT_QUOTE_CONFIG.prefix,
      padding: Number(res.rows[0].quote_number_padding ?? DEFAULT_QUOTE_CONFIG.padding),
      includesYear: Boolean(res.rows[0].quote_includes_year ?? DEFAULT_QUOTE_CONFIG.includesYear),
    };
  }

  async generate(businessId: string, date: Date = new Date()): Promise<string> {
    const config = await this.getConfig(businessId);
    const client = await getClient();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO quote_number_sequences (business_id, prefix, next_number, padding, includes_year)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (business_id) DO UPDATE SET
           prefix = EXCLUDED.prefix,
           padding = EXCLUDED.padding,
           includes_year = EXCLUDED.includes_year
         WHERE quote_number_sequences.prefix IS DISTINCT FROM EXCLUDED.prefix
            OR quote_number_sequences.padding IS DISTINCT FROM EXCLUDED.padding
            OR quote_number_sequences.includes_year IS DISTINCT FROM EXCLUDED.includes_year`,
        [businessId, config.prefix, config.padding, config.includesYear]
      );

      const res = await client.query(
        `UPDATE quote_number_sequences
         SET next_number = next_number + 1
         WHERE business_id = $1
         RETURNING next_number - 1 AS assigned_number`,
        [businessId]
      );

      if (res.rowCount === 0) {
        throw new BusinessLogicError(
          `Failed to generate quote number for business ${businessId}`,
          "QUOTE_NUMBER_FAILED"
        );
      }

      const assignedNumber = Number(res.rows[0].assigned_number);
      const number = formatQuoteNumber(assignedNumber, config, date);
      await client.query("COMMIT");
      logger.info(`Generated quote number ${number} for business ${businessId}`);
      return number;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Quote number generation failed for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }
}

export const quoteNumberService = new QuoteNumberService();

export class CreditNoteNumberService {
  async getConfig(businessId: string): Promise<InvoiceNumberConfig> {
    const res = await query(
      `SELECT prefix, padding, includes_year
       FROM credit_note_number_sequences
       WHERE business_id = $1`,
      [businessId]
    );
    if (!res.rows.length) {
      return { ...DEFAULT_CREDIT_NOTE_CONFIG };
    }
    return {
      prefix: res.rows[0].prefix ?? DEFAULT_CREDIT_NOTE_CONFIG.prefix,
      padding: Number(res.rows[0].padding ?? DEFAULT_CREDIT_NOTE_CONFIG.padding),
      includesYear: Boolean(res.rows[0].includes_year ?? DEFAULT_CREDIT_NOTE_CONFIG.includesYear),
    };
  }

  async generate(businessId: string, date: Date = new Date()): Promise<string> {
    const config = await this.getConfig(businessId);
    const client = await getClient();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO credit_note_number_sequences (business_id, prefix, next_number, padding, includes_year)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (business_id) DO UPDATE SET
           prefix = EXCLUDED.prefix,
           padding = EXCLUDED.padding,
           includes_year = EXCLUDED.includes_year
         WHERE credit_note_number_sequences.prefix IS DISTINCT FROM EXCLUDED.prefix
            OR credit_note_number_sequences.padding IS DISTINCT FROM EXCLUDED.padding
            OR credit_note_number_sequences.includes_year IS DISTINCT FROM EXCLUDED.includes_year`,
        [businessId, config.prefix, config.padding, config.includesYear]
      );

      const res = await client.query(
        `UPDATE credit_note_number_sequences
         SET next_number = next_number + 1
         WHERE business_id = $1
         RETURNING next_number - 1 AS assigned_number`,
        [businessId]
      );

      if (res.rowCount === 0) {
        throw new BusinessLogicError(
          `Failed to generate credit note number for business ${businessId}`,
          "CREDIT_NOTE_NUMBER_FAILED"
        );
      }

      const assignedNumber = Number(res.rows[0].assigned_number);
      const number = formatCreditNoteNumber(assignedNumber, config, date);
      await client.query("COMMIT");
      logger.info(`Generated credit note number ${number} for business ${businessId}`);
      return number;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Credit note number generation failed for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }
}

export const creditNoteNumberService = new CreditNoteNumberService();

import { query, getClient } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { BusinessLogicError } from "../domain/errors.js";

const DEFAULT_INVOICE_CONFIG = {
  prefix: "INV",
  padding: 6,
  includesYear: true,
};

const DEFAULT_PAYMENT_VOUCHER_CONFIG = {
  prefix: "PV",
  padding: 6,
  includesYear: true,
};

const DEFAULT_DEBIT_NOTE_CONFIG = {
  prefix: "DN",
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

function formatPaymentVoucherNumber(assignedNumber: number, config: typeof DEFAULT_PAYMENT_VOUCHER_CONFIG, date: Date): string {
  const padded = pad(assignedNumber, config.padding);
  if (config.includesYear) {
    const year = date.getFullYear().toString();
    return `${config.prefix}-${year}-${padded}`;
  }
  return `${config.prefix}-${padded}`;
}

function formatDebitNoteNumber(assignedNumber: number, config: typeof DEFAULT_DEBIT_NOTE_CONFIG, date: Date): string {
  const padded = pad(assignedNumber, config.padding);
  if (config.includesYear) {
    const year = date.getFullYear().toString();
    return `${config.prefix}-${year}-${padded}`;
  }
  return `${config.prefix}-${padded}`;
}

export class PaymentVoucherNumberService {
  async getConfig(businessId: string): Promise<InvoiceNumberConfig> {
    const res = await query(
      `SELECT payment_voucher_prefix, payment_voucher_padding, payment_voucher_includes_year
       FROM business_settings
       WHERE business_id = $1`,
      [businessId]
    );
    if (!res.rows.length) {
      return { ...DEFAULT_PAYMENT_VOUCHER_CONFIG };
    }
    return {
      prefix: res.rows[0].payment_voucher_prefix ?? DEFAULT_PAYMENT_VOUCHER_CONFIG.prefix,
      padding: Number(res.rows[0].payment_voucher_padding ?? DEFAULT_PAYMENT_VOUCHER_CONFIG.padding),
      includesYear: Boolean(res.rows[0].payment_voucher_includes_year ?? DEFAULT_PAYMENT_VOUCHER_CONFIG.includesYear),
    };
  }

  async generate(businessId: string, date: Date = new Date()): Promise<string> {
    const config = await this.getConfig(businessId);
    const client = await getClient();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO payment_voucher_number_sequences (business_id, prefix, next_number, padding, includes_year)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (business_id) DO UPDATE SET
           prefix = EXCLUDED.prefix,
           padding = EXCLUDED.padding,
           includes_year = EXCLUDED.includes_year
         WHERE payment_voucher_number_sequences.prefix IS DISTINCT FROM EXCLUDED.prefix
            OR payment_voucher_number_sequences.padding IS DISTINCT FROM EXCLUDED.padding
            OR payment_voucher_number_sequences.includes_year IS DISTINCT FROM EXCLUDED.includes_year`,
        [businessId, config.prefix, config.padding, config.includesYear]
      );

      const res = await client.query(
        `UPDATE payment_voucher_number_sequences
         SET next_number = next_number + 1
         WHERE business_id = $1
         RETURNING next_number - 1 AS assigned_number`,
        [businessId]
      );

      if (res.rowCount === 0) {
        throw new BusinessLogicError(
          `Failed to generate payment voucher number for business ${businessId}`,
          "PAYMENT_VOUCHER_NUMBER_FAILED"
        );
      }

      const assignedNumber = Number(res.rows[0].assigned_number);
      const number = formatPaymentVoucherNumber(assignedNumber, config, date);
      await client.query("COMMIT");
      logger.info(`Generated payment voucher number ${number} for business ${businessId}`);
      return number;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Payment voucher number generation failed for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }
}

export const paymentVoucherNumberService = new PaymentVoucherNumberService();

export class DebitNoteNumberService {
  async getConfig(businessId: string): Promise<InvoiceNumberConfig> {
    const res = await query(
      `SELECT debit_note_prefix, debit_note_padding, debit_note_includes_year
       FROM business_settings
       WHERE business_id = $1`,
      [businessId]
    );
    if (!res.rows.length) {
      return { ...DEFAULT_DEBIT_NOTE_CONFIG };
    }
    return {
      prefix: res.rows[0].debit_note_prefix ?? DEFAULT_DEBIT_NOTE_CONFIG.prefix,
      padding: Number(res.rows[0].debit_note_padding ?? DEFAULT_DEBIT_NOTE_CONFIG.padding),
      includesYear: Boolean(res.rows[0].debit_note_includes_year ?? DEFAULT_DEBIT_NOTE_CONFIG.includesYear),
    };
  }

  async generate(businessId: string, date: Date = new Date()): Promise<string> {
    const config = await this.getConfig(businessId);
    const client = await getClient();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO debit_note_number_sequences (business_id, prefix, next_number, padding, includes_year)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (business_id) DO UPDATE SET
           prefix = EXCLUDED.prefix,
           padding = EXCLUDED.padding,
           includes_year = EXCLUDED.includes_year
         WHERE debit_note_number_sequences.prefix IS DISTINCT FROM EXCLUDED.prefix
            OR debit_note_number_sequences.padding IS DISTINCT FROM EXCLUDED.padding
            OR debit_note_number_sequences.includes_year IS DISTINCT FROM EXCLUDED.includes_year`,
        [businessId, config.prefix, config.padding, config.includesYear]
      );

      const res = await client.query(
        `UPDATE debit_note_number_sequences
         SET next_number = next_number + 1
         WHERE business_id = $1
         RETURNING next_number - 1 AS assigned_number`,
        [businessId]
      );

      if (res.rowCount === 0) {
        throw new BusinessLogicError(
          `Failed to generate debit note number for business ${businessId}`,
          "DEBIT_NOTE_NUMBER_FAILED"
        );
      }

      const assignedNumber = Number(res.rows[0].assigned_number);
      const number = formatDebitNoteNumber(assignedNumber, config, date);
      await client.query("COMMIT");
      logger.info(`Generated debit note number ${number} for business ${businessId}`);
      return number;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Debit note number generation failed for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }
}

export const debitNoteNumberService = new DebitNoteNumberService();

const DEFAULT_PURCHASE_ORDER_CONFIG = {
  prefix: "PO",
  padding: 6,
  includesYear: true,
};

function formatPurchaseOrderNumber(assignedNumber: number, config: typeof DEFAULT_PURCHASE_ORDER_CONFIG, date: Date): string {
  const padded = pad(assignedNumber, config.padding);
  if (config.includesYear) {
    const year = date.getFullYear().toString();
    return `${config.prefix}-${year}-${padded}`;
  }
  return `${config.prefix}-${padded}`;
}

export class PurchaseOrderNumberService {
  async getConfig(businessId: string): Promise<InvoiceNumberConfig> {
    const res = await query(
      `SELECT purchase_order_prefix, purchase_order_padding, purchase_order_includes_year
       FROM business_settings
       WHERE business_id = $1`,
      [businessId]
    );
    if (!res.rows.length) {
      return { ...DEFAULT_PURCHASE_ORDER_CONFIG };
    }
    return {
      prefix: res.rows[0].purchase_order_prefix ?? DEFAULT_PURCHASE_ORDER_CONFIG.prefix,
      padding: Number(res.rows[0].purchase_order_padding ?? DEFAULT_PURCHASE_ORDER_CONFIG.padding),
      includesYear: Boolean(res.rows[0].purchase_order_includes_year ?? DEFAULT_PURCHASE_ORDER_CONFIG.includesYear),
    };
  }

  async generate(businessId: string, date: Date = new Date()): Promise<string> {
    const config = await this.getConfig(businessId);
    const client = await getClient();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO purchase_order_number_sequences (business_id, prefix, next_number, padding, includes_year)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (business_id) DO UPDATE SET
           prefix = EXCLUDED.prefix,
           padding = EXCLUDED.padding,
           includes_year = EXCLUDED.includes_year
         WHERE purchase_order_number_sequences.prefix IS DISTINCT FROM EXCLUDED.prefix
            OR purchase_order_number_sequences.padding IS DISTINCT FROM EXCLUDED.padding
            OR purchase_order_number_sequences.includes_year IS DISTINCT FROM EXCLUDED.includes_year`,
        [businessId, config.prefix, config.padding, config.includesYear]
      );

      const res = await client.query(
        `UPDATE purchase_order_number_sequences
         SET next_number = next_number + 1
         WHERE business_id = $1
         RETURNING next_number - 1 AS assigned_number`,
        [businessId]
      );

      if (res.rowCount === 0) {
        throw new BusinessLogicError(
          `Failed to generate purchase order number for business ${businessId}`,
          "PURCHASE_ORDER_NUMBER_FAILED"
        );
      }

      const assignedNumber = Number(res.rows[0].assigned_number);
      const number = formatPurchaseOrderNumber(assignedNumber, config, date);
      await client.query("COMMIT");
      logger.info(`Generated purchase order number ${number} for business ${businessId}`);
      return number;
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Purchase order number generation failed for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }
}

export const purchaseOrderNumberService = new PurchaseOrderNumberService();

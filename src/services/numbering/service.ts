import { query, getClient } from "../../db/pool.js";
import { logger } from "../../utils/logger.js";

export interface NumberSequenceConfig {
  prefix: string;
  nextNumber: number;
  padding: number;
  includesYear: boolean;
}

export interface GeneratedInvoiceNumber {
  number: string;
  assignedNumber: number;
  config: NumberSequenceConfig;
}

const DEFAULT_CONFIG: Omit<NumberSequenceConfig, "nextNumber"> = {
  prefix: "INV",
  padding: 6,
  includesYear: true,
};

function pad(num: number, size: number): string {
  return num.toString().padStart(size, "0");
}

function formatNumber(assignedNumber: number, config: NumberSequenceConfig, date: Date): string {
  const year = date.getFullYear().toString();
  const padded = pad(assignedNumber, config.padding);
  if (config.includesYear) {
    return `${config.prefix}-${year}-${padded}`;
  }
  return `${config.prefix}-${padded}`;
}

/**
 * Generates invoice numbers atomically per business using a DB-level row lock.
 *
 * The sequence row is created on demand. Concurrent generators serialize on
 * the row lock acquired by the atomic UPDATE, guaranteeing uniqueness and
 * no gaps (beyond transaction rollbacks).
 */
export class InvoiceNumberService {
  async ensureSequence(businessId: string, config?: Partial<NumberSequenceConfig>): Promise<void> {
    const mergedPrefix = config?.prefix ?? DEFAULT_CONFIG.prefix;
    const mergedPadding = config?.padding ?? DEFAULT_CONFIG.padding;
    const mergedIncludesYear = config?.includesYear ?? DEFAULT_CONFIG.includesYear;
    await query(
      `INSERT INTO invoice_number_sequences (business_id, prefix, next_number, padding, includes_year)
       VALUES ($1, $2, 1, $3, $4)
       ON CONFLICT (business_id) DO NOTHING`,
      [businessId, mergedPrefix, mergedPadding, mergedIncludesYear]
    );
  }

  async updateSequenceConfig(businessId: string, config: Partial<NumberSequenceConfig>): Promise<void> {
    await query(
      `INSERT INTO invoice_number_sequences (business_id, prefix, next_number, padding, includes_year)
       VALUES ($1, COALESCE($2, 'INV'), COALESCE($3, 1), COALESCE($4, 6), COALESCE($5, true))
       ON CONFLICT (business_id) DO UPDATE SET
         prefix = COALESCE($2, invoice_number_sequences.prefix),
         next_number = COALESCE($3, invoice_number_sequences.next_number),
         padding = COALESCE($4, invoice_number_sequences.padding),
         includes_year = COALESCE($5, invoice_number_sequences.includes_year)`,
      [
        businessId,
        config.prefix ?? null,
        config.nextNumber ?? null,
        config.padding ?? null,
        config.includesYear ?? null,
      ]
    );
  }

  async generate(businessId: string, date: Date = new Date()): Promise<GeneratedInvoiceNumber> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO invoice_number_sequences (business_id, prefix, next_number, padding, includes_year)
         VALUES ($1, $2, 1, $3, $4)
         ON CONFLICT (business_id) DO NOTHING`,
        [businessId, DEFAULT_CONFIG.prefix, DEFAULT_CONFIG.padding, DEFAULT_CONFIG.includesYear]
      );

      const res = await client.query(
        `UPDATE invoice_number_sequences
         SET next_number = next_number + 1
         WHERE business_id = $1
         RETURNING prefix, next_number - 1 AS assigned_number, padding, includes_year`,
        [businessId]
      );

      if (res.rowCount === 0) {
        throw new Error(`Failed to generate invoice number for business ${businessId}`);
      }

      const row = res.rows[0];
      const config: NumberSequenceConfig = {
        prefix: row.prefix,
        nextNumber: Number(row.assigned_number),
        padding: Number(row.padding),
        includesYear: Boolean(row.includes_year),
      };

      await client.query("COMMIT");
      const number = formatNumber(config.nextNumber, config, date);
      logger.info(`Generated invoice number ${number} for business ${businessId}`);
      return { number, assignedNumber: config.nextNumber, config };
    } catch (e) {
      await client.query("ROLLBACK");
      logger.error({ err: e }, `Invoice number generation failed for business ${businessId}`);
      throw e;
    } finally {
      client.release();
    }
  }

  format(_existingConfig: NumberSequenceConfig, assignedNumber: number, date: Date): string {
    return formatNumber(assignedNumber, _existingConfig, date);
  }
}

export const invoiceNumberService = new InvoiceNumberService();

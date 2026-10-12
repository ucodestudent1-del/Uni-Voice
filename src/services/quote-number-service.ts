import { query, getClient } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { BusinessLogicError } from "../domain/errors.js";

const DEFAULT_CONFIG = {
  prefix: "QOT",
  padding: 6,
  includesYear: true,
};

function pad(num: number, size: number): string {
  return num.toString().padStart(size, "0");
}

function formatQuoteNumber(assignedNumber: number, config: typeof DEFAULT_CONFIG, date: Date): string {
  const padded = pad(assignedNumber, config.padding);
  if (config.includesYear) {
    const year = date.getFullYear().toString();
    return `${config.prefix}-${year}-${padded}`;
  }
  return `${config.prefix}-${padded}`;
}

export interface QuoteNumberConfig {
  prefix: string;
  padding: number;
  includesYear: boolean;
}

export class QuoteNumberService {
  async getConfig(businessId: string): Promise<QuoteNumberConfig> {
    const res = await query(
      `SELECT quote_number_prefix, quote_number_padding, quote_includes_year
       FROM business_settings
       WHERE business_id = $1`,
      [businessId]
    );
    if (!res.rows.length) {
      return { ...DEFAULT_CONFIG };
    }
    return {
      prefix: res.rows[0].quote_number_prefix ?? DEFAULT_CONFIG.prefix,
      padding: Number(res.rows[0].quote_number_padding ?? DEFAULT_CONFIG.padding),
      includesYear: Boolean(res.rows[0].quote_includes_year ?? DEFAULT_CONFIG.includesYear),
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

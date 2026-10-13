import { Decimal } from "decimal.js";
import { query } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { NotFoundError, ConflictError, BusinessLogicError } from "../domain/errors.js";
import type { TaxRule, TaxRuleCreateInput, TaxRuleUpdateInput, TaxRuleSearchQuery, TaxEvaluationContext, TaxRuleConditionInput } from "../domain/schemas/tax-rule.js";

export class TaxRuleService {
  async findMany(businessId: string, params: TaxRuleSearchQuery): Promise<{
    taxRules: TaxRule[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const { limit, offset, enabled, countryCode } = params;
    const conditions: string[] = ["business_id = $1"];
    const values: unknown[] = [businessId];
    let paramIdx = 2;

    if (enabled !== undefined) {
      conditions.push(`enabled = $${paramIdx++}`);
      values.push(enabled);
    }
    if (countryCode) {
      conditions.push(`country_code = $${paramIdx++}`);
      values.push(countryCode.toUpperCase());
    }

    const totalResult = await query(
      `SELECT COUNT(*)::int as total FROM tax_rules WHERE ${conditions.join(" AND ")}`,
      values,
    );

    const count = Number(totalResult.rows[0]?.total ?? 0);

    const result = await query(
      `SELECT * FROM tax_rules WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...values, limit, offset],
    );

    const taxRules: TaxRule[] = await Promise.all(
      result.rows.map(async (row) => {
        const conditionsResult = await query(
          `SELECT * FROM tax_rule_conditions WHERE tax_rule_id = $1 ORDER BY sort_order`,
          [row.id],
        );
        return {
          id: row.id,
          businessId: row.business_id,
          name: row.name,
          code: row.code,
          rate: row.rate,
          type: row.type,
          countryCode: row.country_code,
          region: row.region,
          isCompound: row.is_compound,
          isDefault: row.is_default,
          enabled: row.enabled,
          conditions: conditionsResult.rows.map((c) => ({
            id: c.id,
            field: c.field,
            operator: c.operator,
            value: c.value,
            sortOrder: c.sort_order,
          })),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }),
    );

    return {
      taxRules,
      total: count,
      limit,
      offset,
    };
  }

  async findById(businessId: string, id: string): Promise<TaxRule | null> {
    const result = await query(
      `SELECT * FROM tax_rules WHERE id = $1 AND business_id = $2`,
      [id, businessId],
    );

    if (!result.rows.length) {
      return null;
    }

    const row = result.rows[0];

    const conditionsResult = await query(
      `SELECT * FROM tax_rule_conditions WHERE tax_rule_id = $1 ORDER BY sort_order`,
      [id],
    );

    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      code: row.code,
      rate: row.rate,
      type: row.type,
      countryCode: row.country_code,
      region: row.region,
      isCompound: row.is_compound,
      isDefault: row.is_default,
      enabled: row.enabled,
      conditions: conditionsResult.rows.map((c) => ({
        id: c.id,
        field: c.field,
        operator: c.operator,
        value: c.value,
        sortOrder: c.sort_order,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async create(businessId: string, input: TaxRuleCreateInput, userId?: string): Promise<TaxRule> {
    const existing = await query(
      `SELECT 1 FROM tax_rules WHERE business_id = $1 AND name = $2`,
      [businessId, input.name],
    );

    if (existing.rows.length) {
      throw new ConflictError(`A tax rule with name "${input.name}" already exists`);
    }

    const result = await query(
      `INSERT INTO tax_rules (
        business_id, name, code, rate, type, country_code, region,
        is_compound, is_default, enabled, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *`,
      [
        businessId,
        input.name,
        input.code ?? null,
        input.rate,
        input.type ?? "percentage",
        input.countryCode ?? null,
        input.region ?? null,
        input.isCompound ?? false,
        input.isDefault ?? false,
        input.enabled ?? true,
      ],
    );

    const row = result.rows[0];

    const conditions: TaxRuleConditionInput[] = input.conditions ?? [];
    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i];
      await query(
        `INSERT INTO tax_rule_conditions (tax_rule_id, field, operator, value, sort_order, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [row.id, cond.field, cond.operator, cond.value, cond.sortOrder ?? i],
      );
    }

    logger.info(`Created tax rule ${row.id} for business ${businessId}`);

    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      code: row.code,
      rate: row.rate,
      type: row.type,
      countryCode: row.country_code,
      region: row.region,
      isCompound: row.is_compound,
      isDefault: row.is_default,
      enabled: row.enabled,
      conditions,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async update(businessId: string, id: string, input: TaxRuleUpdateInput): Promise<TaxRule> {
    const existing = await this.findById(businessId, id);
    if (!existing) {
      throw new NotFoundError(`Tax rule ${id} not found`);
    }

    const updates: string[] = [];
    const values: unknown[] = [businessId, id];
    let paramIdx = 3;

    const fieldMap: Record<string, string> = {
      name: "name",
      code: "code",
      rate: "rate",
      type: "type",
      countryCode: "country_code",
      region: "region",
      isCompound: "is_compound",
      isDefault: "is_default",
      enabled: "enabled",
    };

    for (const [key, val] of Object.entries(input)) {
      if (key === "conditions") continue;
      const col = fieldMap[key];
      if (col) {
        updates.push(`${col} = $${paramIdx++}`);
        values.push(val);
      }
    }

    if (input.isDefault === true) {
      await query(
        `UPDATE tax_rules SET is_default = FALSE WHERE business_id = $1 AND id != $2 AND is_default = TRUE`,
        [businessId, id],
      );
    }

    if (updates.length > 0) {
      updates.push("updated_at = NOW()");
      await query(
        `UPDATE tax_rules SET ${updates.join(", ")} WHERE id = $2 AND business_id = $1`,
        values,
      );
    }

    if (input.conditions !== undefined) {
      await query(`DELETE FROM tax_rule_conditions WHERE tax_rule_id = $1`, [id]);
      for (let i = 0; i < input.conditions.length; i++) {
        const cond = input.conditions[i];
        await query(
          `INSERT INTO tax_rule_conditions (tax_rule_id, field, operator, value, sort_order, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [id, cond.field, cond.operator, cond.value, cond.sortOrder ?? i],
        );
      }
    }

    logger.info(`Updated tax rule ${id} for business ${businessId}`);

    return (await this.findById(businessId, id))!;
  }

  async delete(businessId: string, id: string): Promise<void> {
    const result = await query(
      `DELETE FROM tax_rules WHERE id = $1 AND business_id = $2 RETURNING id`,
      [id, businessId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError(`Tax rule ${id} not found`);
    }

    logger.info(`Deleted tax rule ${id} for business ${businessId}`);
  }

  async evaluate(context: TaxEvaluationContext, businessId: string): Promise<TaxRule[]> {
    const taxRules = await this.findMany(businessId, {
      limit: 200,
      offset: 0,
      enabled: true,
    });

    const applicable: TaxRule[] = [];

    for (const rule of taxRules.taxRules) {
      if (!rule.conditions || rule.conditions.length === 0) {
        if (rule.isDefault) {
          applicable.push(rule);
        }
        continue;
      }

      let matches = true;
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          matches = false;
          break;
        }
      }

      if (matches) {
        applicable.push(rule);
      }
    }

    return applicable;
  }

  private evaluateCondition(
    condition: TaxRuleConditionInput,
    context: TaxEvaluationContext,
  ): boolean {
    const { field, operator, value } = condition;
    const contextValue = this.getContextValue(field, context);

    switch (operator) {
      case "equals":
        return contextValue === value;
      case "not_equals":
        return contextValue !== value;
      case "in":
        return value.split(",").map((v) => v.trim()).includes(contextValue ?? "");
      case "not_in":
        return !value.split(",").map((v) => v.trim()).includes(contextValue ?? "");
      case "contains":
        return contextValue?.toLowerCase().includes(value.toLowerCase()) ?? false;
      case "greater_than":
        return Number(contextValue ?? 0) > Number(value);
      case "less_than":
        return Number(contextValue ?? 0) < Number(value);
      case "greater_than_or_equal":
        return Number(contextValue ?? 0) >= Number(value);
      case "less_than_or_equal":
        return Number(contextValue ?? 0) <= Number(value);
      default:
        return false;
    }
  }

  private getContextValue(field: string, context: TaxEvaluationContext): string | undefined | null {
    const fieldMap: Record<string, unknown> = {
      customer_country: context.customerCountry,
      customer_state: context.customerState,
      currency: context.currency,
      total_amount_min: context.totalAmount,
      total_amount_max: context.totalAmount,
      product_category: (context.productCategories ?? []).join(","),
      item_description: "any",
    };
    return fieldMap[field] as string | undefined | null;
  }

  async getDefault(businessId: string): Promise<TaxRule | null> {
    const result = await query(
      `SELECT * FROM tax_rules WHERE business_id = $1 AND is_default = TRUE AND enabled = TRUE LIMIT 1`,
      [businessId],
    );

    if (!result.rows.length) {
      return null;
    }

    const row = result.rows[0];

    const conditionsResult = await query(
      `SELECT * FROM tax_rule_conditions WHERE tax_rule_id = $1 ORDER BY sort_order`,
      [row.id],
    );

    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      code: row.code,
      rate: row.rate,
      type: row.type,
      countryCode: row.country_code,
      region: row.region,
      isCompound: row.is_compound,
      isDefault: row.is_default,
      enabled: row.enabled,
      conditions: conditionsResult.rows.map((c) => ({
        id: c.id,
        field: c.field,
        operator: c.operator,
        value: c.value,
        sortOrder: c.sort_order,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  evaluateRule(rule: TaxRule, context: TaxEvaluationContext): { matched: boolean; matchedConditions: number } {
    if (!rule.conditions || rule.conditions.length === 0) {
      return { matched: rule.isDefault ?? false, matchedConditions: 0 };
    }

    let matchedCount = 0;
    for (const condition of rule.conditions) {
      if (this.evaluateCondition(condition, context)) {
        matchedCount++;
      } else {
        return { matched: false, matchedConditions: matchedCount };
      }
    }

    return { matched: true, matchedConditions: matchedCount };
  }
}

export const taxRuleService = new TaxRuleService();

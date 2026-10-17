import { Decimal } from "decimal.js";
import { query } from "../db/pool.js";
import { logger } from "../utils/logger.js";
import { NotFoundError, ConflictError } from "../domain/errors.js";
import type {
  DiscountRule,
  DiscountRuleCreateInput,
  DiscountRuleUpdateInput,
  DiscountRuleSearchQuery,
  DiscountEvaluationContext,
} from "../domain/schemas/discount-rule.js";

export class DiscountRuleService {
  async findMany(businessId: string, params: DiscountRuleSearchQuery): Promise<{
    discountRules: DiscountRule[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const { limit, offset, active } = params;
    const conditions: string[] = ["business_id = $1"];
    const values: unknown[] = [businessId];
    let paramIdx = 2;

    if (active !== undefined) {
      conditions.push(`is_active = $${paramIdx++}`);
      values.push(active);
    }

    const totalResult = await query(
      `SELECT COUNT(*)::int as total FROM discount_rules WHERE ${conditions.join(" AND ")}`,
      values,
    );

    const count = Number(totalResult.rows[0]?.total ?? 0);

    const result = await query(
      `SELECT * FROM discount_rules WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...values, limit, offset],
    );

    const discountRules: DiscountRule[] = result.rows.map((row) => ({
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      type: row.type,
      value: row.value,
      scope: row.scope,
      appliesTo: row.applies_to,
      minAmount: row.min_amount,
      maxDiscount: row.max_discount,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return {
      discountRules,
      total: count,
      limit,
      offset,
    };
  }

  async findById(businessId: string, id: string): Promise<DiscountRule | null> {
    const result = await query(
      `SELECT * FROM discount_rules WHERE id = $1 AND business_id = $2`,
      [id, businessId],
    );

    if (!result.rows.length) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      type: row.type,
      value: row.value,
      scope: row.scope,
      appliesTo: row.applies_to,
      minAmount: row.min_amount,
      maxDiscount: row.max_discount,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async create(businessId: string, input: DiscountRuleCreateInput): Promise<DiscountRule> {
    const existing = await query(
      `SELECT 1 FROM discount_rules WHERE business_id = $1 AND name = $2`,
      [businessId, input.name],
    );

    if (existing.rows.length) {
      throw new ConflictError(`A discount rule with name "${input.name}" already exists`);
    }

    const result = await query(
      `INSERT INTO discount_rules (
        business_id, name, type, value, scope, applies_to, min_amount, max_discount,
        starts_at, ends_at, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        businessId,
        input.name,
        input.type ?? "percentage",
        input.value,
        input.scope ?? "invoice",
        input.appliesTo ?? null,
        input.minAmount ?? null,
        input.maxDiscount ?? null,
        input.startsAt ? new Date(input.startsAt) : null,
        input.endsAt ? new Date(input.endsAt) : null,
        input.isActive ?? true,
      ],
    );

    const row = result.rows[0];
    logger.info(`Created discount rule ${row.id} for business ${businessId}`);

    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name,
      type: row.type,
      value: row.value,
      scope: row.scope,
      appliesTo: row.applies_to,
      minAmount: row.min_amount,
      maxDiscount: row.max_discount,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async update(businessId: string, id: string, input: DiscountRuleUpdateInput): Promise<DiscountRule> {
    const existing = await this.findById(businessId, id);
    if (!existing) {
      throw new NotFoundError(`Discount rule ${id} not found`);
    }

    const updates: string[] = [];
    const values: unknown[] = [businessId, id];
    let paramIdx = 3;

    const fieldMap: Record<string, string> = {
      name: "name",
      type: "type",
      value: "value",
      scope: "scope",
      appliesTo: "applies_to",
      minAmount: "min_amount",
      maxDiscount: "max_discount",
      startsAt: "starts_at",
      endsAt: "ends_at",
      isActive: "is_active",
    };

    for (const [key, val] of Object.entries(input)) {
      const col = fieldMap[key];
      if (col) {
        updates.push(`${col} = $${paramIdx++}`);
        if (key === "startsAt" || key === "endsAt") {
          values.push(val ? new Date(val as string) : null);
        } else {
          values.push(val);
        }
      }
    }

    if (updates.length > 0) {
      updates.push("updated_at = NOW()");
      await query(
        `UPDATE discount_rules SET ${updates.join(", ")} WHERE id = $2 AND business_id = $1`,
        values,
      );
    }

    logger.info(`Updated discount rule ${id} for business ${businessId}`);

    return (await this.findById(businessId, id))!;
  }

  async delete(businessId: string, id: string): Promise<void> {
    const result = await query(
      `DELETE FROM discount_rules WHERE id = $1 AND business_id = $2 RETURNING id`,
      [id, businessId],
    );

    if (result.rowCount === 0) {
      throw new NotFoundError(`Discount rule ${id} not found`);
    }

    logger.info(`Deleted discount rule ${id} for business ${businessId}`);
  }

  async evaluate(context: DiscountEvaluationContext, businessId: string): Promise<{
    applicableRules: DiscountRule[];
    totalDiscount: Decimal;
  }> {
    const now = new Date();
    const { invoiceDate, subtotal } = context;

    const result = await query(
      `SELECT * FROM discount_rules
       WHERE business_id = $1 AND is_active = TRUE
       AND (starts_at IS NULL OR starts_at <= $2)
       AND (ends_at IS NULL OR ends_at >= $2)`,
      [businessId, invoiceDate ? new Date(invoiceDate) : now],
    );

    let applicableRules: DiscountRule[] = [];
    let totalDiscount = new Decimal(0);

    const subtotalDecimal = new Decimal(subtotal || 0);

    for (const row of result.rows) {
      const rule: DiscountRule = {
        id: row.id,
        businessId: row.business_id,
        name: row.name,
        type: row.type,
        value: row.value,
        scope: row.scope,
        appliesTo: row.applies_to,
        minAmount: row.min_amount,
        maxDiscount: row.max_discount,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };

      if (rule.minAmount && subtotalDecimal.lt(rule.minAmount)) {
        continue;
      }

      applicableRules.push(rule);

      const discountAmount = this.computeRuleDiscount(rule, subtotalDecimal);

      const cappedDiscount = rule.maxDiscount
        ? Decimal.min(discountAmount, new Decimal(rule.maxDiscount))
        : discountAmount;

      totalDiscount = totalDiscount.plus(cappedDiscount);
    }

    return {
      applicableRules,
      totalDiscount: totalDiscount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    };
  }

  private computeRuleDiscount(rule: DiscountRule, base: Decimal): Decimal {
    const value = new Decimal(rule.value);

    if (rule.type === "percentage") {
      return base.mul(value.div(100));
    } else {
      return value;
    }
  }
}

export const discountRuleService = new DiscountRuleService();

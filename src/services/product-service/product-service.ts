import type { ProductServiceStatus } from "../../domain/models/product-service.js";
import { Decimal } from "decimal.js";
import type { ProductService, ProductServiceSnapshot, InvoiceLineItemSnapshot } from "../../domain/models/product-service.js";
import type { CurrencyCode } from "../../domain/value-objects/currency.js";
import { SUPPORTED_CURRENCIES } from "../../domain/value-objects/currency.js";
import {
  CreateProductServiceSchema,
  UpdateProductServiceSchema,
  type CreateProductServiceInput,
  type UpdateProductServiceInput,
  type CatalogSearchInput,
  type CatalogSelectionInput,
  type PagedProductServices,
  type ProductServiceDTO,
  type ProductServiceSnapshotDTO,
} from "../../schemas/product-service.js";
import { productServiceRepository, type CatalogFilter } from "../../repositories/product-service.repo.js";
import { NotFoundError, BusinessLogicError, ConflictError } from "../../domain/errors.js";
import { query } from "../../db/pool.js";

const CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);

export class ProductServiceService {
  async create(
    tenantId: string,
    input: CreateProductServiceInput,
    createdBy?: string
  ): Promise<ProductServiceDTO> {
    const parsed = CreateProductServiceSchema.parse(input);
    this.validatePricing(parsed);

    const created = await productServiceRepository.create(tenantId, {
      type: parsed.type,
      name: parsed.name,
      description: parsed.description ?? null,
      sku: parsed.sku ?? null,
      unit: parsed.unit ?? "each",
      unitPrice: parsed.unitPrice,
      taxCategory: parsed.taxCategory ?? null,
      currency: parsed.currency,
      status: parsed.status ?? "active",
      discountType: parsed.discountType ?? "percentage",
      discountValue: parsed.discountValue,
    });

    await productServiceRepository.createSnapshot(created.id, tenantId, createdBy);

    return this.toDTO(created);
  }

  async getById(tenantId: string, id: string): Promise<ProductServiceDTO> {
    const ps = await productServiceRepository.findById(tenantId, id);
    return this.toDTO(ps);
  }

  async update(
    tenantId: string,
    id: string,
    input: UpdateProductServiceInput,
    expectedVersion?: number
  ): Promise<ProductServiceDTO> {
    const parsed = UpdateProductServiceSchema.parse(input);

    if (parsed.unitPrice !== undefined || parsed.discountValue !== undefined) {
      const existing = await productServiceRepository.findById(tenantId, id);
      this.validatePricing({
        unitPrice: parsed.unitPrice ?? existing.unitPrice,
        discountValue: parsed.discountValue ?? existing.discountValue,
        currency: parsed.currency ?? existing.currency,
      });
    }

    const repoInput: Record<string, unknown> = {
      type: parsed.type,
      name: parsed.name,
      description: parsed.description,
      sku: parsed.sku,
      unit: parsed.unit,
      unitPrice: parsed.unitPrice ?? undefined,
      taxCategory: parsed.taxCategory,
      currency: parsed.currency,
      discountType: parsed.discountType,
      discountValue: parsed.discountValue ?? undefined,
    };

    const updated = await productServiceRepository.update(
      tenantId,
      id,
      repoInput as any,
      expectedVersion
    );

    return this.toDTO(updated);
  }

  async archive(tenantId: string, id: string): Promise<ProductServiceDTO> {
    if (!(await this.canArchive(tenantId, id))) {
      throw new BusinessLogicError(
        "Cannot archive: product/service is referenced in a finalized invoice"
      );
    }

    const archived = await productServiceRepository.archive(tenantId, id);
    return this.toDTO(archived);
  }

  async restore(tenantId: string, id: string): Promise<ProductServiceDTO> {
    const restored = await productServiceRepository.restore(tenantId, id);
    return this.toDTO(restored);
  }

  async search(tenantId: string, params: CatalogSearchInput): Promise<PagedProductServices> {
    const filter: CatalogFilter = {
      search: params.search,
      type: params.type,
      status: params.status === "all" ? undefined : (params.status as ProductServiceStatus),
      taxCategory: params.taxCategory,
      hasSku: params.hasSku,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder,
      limit: params.limit,
      offset: params.offset,
    };

    const result = await productServiceRepository.findMany(tenantId, filter);
    return {
      data: result.data.map((ps) => this.toDTO(ps)),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
    };
  }

  async getForSelection(tenantId: string, params: CatalogSelectionInput): Promise<ProductServiceDTO[]> {
    const items = await productServiceRepository.findForSelection(tenantId, {
      search: params.search,
      type: params.type,
      onlyActive: params.onlyActive,
      limit: params.limit,
      offset: params.offset,
    });
    return items.map((ps) => this.toDTO(ps));
  }

  async createSnapshot(tenantId: string, productId: string, createdBy?: string): Promise<ProductServiceSnapshotDTO> {
    const snapshot = await productServiceRepository.createSnapshot(productId, tenantId, createdBy);
    return this.snapshotToDTO(snapshot);
  }

  async bulk(
    tenantId: string,
    items: Array<CreateProductServiceInput & { id?: string; _action?: "create" | "update" | "upsert" }>,
    conflictStrategy: "skip" | "overwrite" = "overwrite"
  ): Promise<{ created: number; updated: number; skipped: number; items: ProductServiceDTO[] }> {
    const results: ProductServiceDTO[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of items) {
      try {
        if (item._action === "create") {
          const ps = await this.create(tenantId, item);
          results.push(ps);
          created++;
        } else {
          const existing = item.id
            ? await this.getByIdOrNull(tenantId, item.id)
            : item.sku
              ? await productServiceRepository.findBySku(tenantId, item.sku)
              : null;

          if (existing) {
            if (conflictStrategy === "skip") {
              results.push(this.toDTO(existing));
              skipped++;
            } else {
              const ps = await this.update(tenantId, existing.id, item);
              results.push(ps);
              updated++;
            }
          } else {
            const ps = await this.create(tenantId, item);
            results.push(ps);
            created++;
          }
        }
      } catch (e) {
        if (e instanceof ConflictError && conflictStrategy === "skip") {
          skipped++;
        } else if (e instanceof ConflictError && conflictStrategy === "overwrite" && item.sku) {
          const existing = await productServiceRepository.findBySku(tenantId, item.sku);
          if (existing) {
            const ps = await this.update(tenantId, existing.id, item);
            results.push(ps);
            updated++;
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
    }

    return { created, updated, skipped, items: results };
  }

  async countByStatus(tenantId: string): Promise<Record<string, number>> {
    return productServiceRepository.countByStatus(tenantId);
  }

  toSnapshot(product: ProductService): ProductServiceSnapshot {
    return {
      productId: product.id,
      productType: product.type,
      name: product.name,
      description: product.description,
      sku: product.sku,
      unit: product.unit,
      unitPrice: product.unitPrice,
      taxCategory: product.taxCategory,
      taxRate: product.defaultTaxRate,
      discountType: product.discountType,
      discountValue: product.discountValue,
      currency: product.currency,
    };
  }

  lineItemFromSnapshot(
    snapshot: ProductServiceSnapshot,
    quantity: Decimal.Value,
    overrides?: {
      description?: string;
      unitPrice?: Decimal.Value;
      taxRate?: Decimal.Value;
      discountType?: "fixed" | "percentage";
      discountValue?: Decimal.Value;
      isTaxInclusive?: boolean;
    }
  ): InvoiceLineItemSnapshot {
    const unitPrice = new Decimal(overrides?.unitPrice ?? snapshot.unitPrice);
    const qty = new Decimal(quantity);
    const base = unitPrice.mul(qty);

    let discountAmount = new Decimal(0);
    if (overrides?.discountValue !== undefined) {
      const d = new Decimal(overrides.discountValue);
      if (!d.isZero()) {
        discountAmount = this.computeDiscount(overrides.discountType ?? snapshot.discountType, d, base, qty);
      }
    } else if (!new Decimal(snapshot.discountValue).isZero()) {
      discountAmount = this.computeDiscount(snapshot.discountType, new Decimal(snapshot.discountValue), base, qty);
    }

    const discountType = discountAmount.isZero() ? "fixed" : (overrides?.discountType ?? snapshot.discountType);
    const effectiveDiscountValue = discountAmount.isZero() ? new Decimal(0) : (overrides?.discountValue ?? new Decimal(snapshot.discountValue));

    return {
      catalogProductId: snapshot.productId,
      catalogName: snapshot.name,
      catalogSku: snapshot.sku,
      catalogTaxCategory: snapshot.taxCategory,
      catalogUnitPrice: unitPrice.toFixed(6),
      catalogTaxRate: overrides?.taxRate
        ? new Decimal(overrides.taxRate).toFixed(4)
        : new Decimal(snapshot.taxRate).toFixed(4),
      description: overrides?.description ?? snapshot.name,
      quantity: qty,
      unit: snapshot.unit,
      unitPrice,
      discount: discountAmount,
      discountType,
      discountValue: effectiveDiscountValue,
      taxRate: overrides?.taxRate ?? new Decimal(snapshot.taxRate),
      isTaxInclusive: overrides?.isTaxInclusive ?? false,
    };
  }

  private async canArchive(tenantId: string, id: string): Promise<boolean> {
    const res = await query(
      `SELECT 1 FROM invoice_items
       WHERE product_id = $1 AND invoice_id IN (
         SELECT id FROM invoices WHERE business_id = $2 AND is_finalized = TRUE
       )
       LIMIT 1`,
      [id, tenantId]
    );
    return res.rows.length === 0;
  }

  private validatePricing(input: {
    unitPrice?: Decimal.Value;
    discountValue?: Decimal.Value;
    currency: CurrencyCode;
  }): void {
    const price = new Decimal(input.unitPrice ?? 0);
    if (price.isNegative()) {
      throw new BusinessLogicError("Unit price must be >= 0");
    }

    const discount = new Decimal(input.discountValue ?? 0);
    if (discount.isNegative()) {
      throw new BusinessLogicError("Discount value must be >= 0");
    }

    if (!CURRENCY_SET.has(input.currency)) {
      throw new BusinessLogicError(`Unsupported currency: ${input.currency}`);
    }
  }

  private computeDiscount(
    type: "fixed" | "percentage",
    value: Decimal,
    base: Decimal,
    quantity: Decimal
  ): Decimal {
    let amount: Decimal;
    if (type === "percentage") {
      amount = base.mul(value.div(100));
    } else {
      amount = value.mul(quantity);
    }
    if (amount.gt(base)) amount = base;
    if (amount.isNegative()) amount = new Decimal(0);
    return amount;
  }

  private toDTO(ps: ProductService): ProductServiceDTO {
    return {
      id: ps.id,
      tenantId: ps.tenantId,
      type: ps.type,
      name: ps.name,
      description: ps.description,
      sku: ps.sku,
      unit: ps.unit,
      unitPrice: ps.unitPrice,
      taxCategory: ps.taxCategory,
      currency: ps.currency,
      status: ps.status,
      discountType: ps.discountType,
      discountValue: ps.discountValue,
      version: ps.version,
      createdAt: ps.createdAt,
      updatedAt: ps.updatedAt,
    };
  }

  private snapshotToDTO(snapshot: ProductServiceSnapshot): ProductServiceSnapshotDTO {
    return {
      productId: snapshot.productId,
      productType: snapshot.productType,
      name: snapshot.name,
      description: snapshot.description,
      sku: snapshot.sku,
      unit: snapshot.unit,
      unitPrice: snapshot.unitPrice,
      taxCategory: snapshot.taxCategory,
      taxRate: snapshot.taxRate,
      discountType: snapshot.discountType,
      discountValue: snapshot.discountValue,
      currency: snapshot.currency,
    };
  }

  private async getByIdOrNull(tenantId: string, id: string): Promise<ProductService | null> {
    try {
      return await productServiceRepository.findById(tenantId, id);
    } catch (e) {
      if (e instanceof NotFoundError) return null;
      throw e;
    }
  }
}

export const productServiceService = new ProductServiceService();

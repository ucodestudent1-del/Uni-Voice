import { ManualTaxProvider } from "./manual-provider.js";
import type { TaxProvider, TaxContext, TaxCalculation, TaxProviderConfig } from "./types.js";
import { env } from "../../config/index.js";

export class TaxService {
  private provider: TaxProvider;

  constructor(provider?: TaxProvider) {
    if (provider) {
      this.provider = provider;
    } else {
      this.provider = TaxService.createProvider(env.TAX_PROVIDER);
    }
  }

  static createProvider(type: string): TaxProvider {
    switch (type) {
      case "manual":
        return new ManualTaxProvider();
      case "avalara":
        return new StubTaxProvider("avalara");
      case "taxjar":
        return new StubTaxProvider("taxjar");
      default:
        return new ManualTaxProvider();
    }
  }

  getProviderName(): string {
    return this.provider.name;
  }

  calculateTax(context: TaxContext): Promise<TaxCalculation> {
    return this.provider.calculateTax(context);
  }

  isExempt(context: TaxContext): Promise<boolean> {
    if (this.provider.isExempt) {
      return this.provider.isExempt(context);
    }
    return Promise.resolve(false);
  }
}

/**
 * Stub provider for future external tax providers (Avalara, TaxJar).
 * Raises a clear error so developers know to configure a real provider
 * once the integration keys are available.
 */
export class StubTaxProvider implements TaxProvider {
  readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
  calculateTax(_context: TaxContext): Promise<TaxCalculation> {
    return Promise.reject(
      new Error(`Tax provider '${this.name}' is not configured. Add API credentials to enable it.`)
    );
  }
}

export const taxService = new TaxService();

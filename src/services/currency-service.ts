import { Decimal } from "decimal.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/index.js";
import { query } from "../db/pool.js";
import { getCurrencyMetadata, type CurrencyCode, SUPPORTED_CURRENCIES, type CurrencyMetadata } from "../domain/value-objects/currency.js";

const ROUND = Decimal.ROUND_HALF_UP;

async function fetchExchangeRate(from: CurrencyCode, to: CurrencyCode): Promise<Decimal | null> {
  if (from === to) return new Decimal(1);

  const baseCurrency = env.FX_BASE_CURRENCY ?? "USD";

  if (!env.FX_API_KEY) {
    logger.warn("FX_API_KEY not configured — currency conversion disabled");
    return null;
  }

  const cacheKey = `fx:${baseCurrency}:${from}:${to}`;
  const cached = await query(
    `SELECT value FROM cache_store WHERE key = $1 AND expires_at > NOW()`,
    [cacheKey],
  );

  if (cached.rows.length) {
    try {
      return new Decimal(cached.rows[0].value);
    } catch {
      // fall through
    }
  }

  const fxProvider = env.FX_API_PROVIDER ?? "openexchangerates";

  try {
    if (fxProvider === "openexchangerates") {
      const res = await fetch(
        `https://openexchangerates.org/api/latest.json?app_id=${env.FX_API_KEY}&base=${baseCurrency}`,
      );

      if (!res.ok) {
        throw new Error(`OpenExchangeRates API error: ${res.status}`);
      }

      const data = await res.json() as { rates: Record<string, number> };
      const rate = data.rates[to];
      const fromRate = data.rates[from];

      if (!rate || !fromRate) {
        logger.warn(`Exchange rate not available for ${from} -> ${to}`);
        return null;
      }

      const effectiveRate = new Decimal(rate).div(fromRate);
      await query(
        `INSERT INTO cache_store (key, value, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')
         ON CONFLICT (key) DO UPDATE SET value = $2, expires_at = NOW() + INTERVAL '1 hour'`,
        [cacheKey, effectiveRate.toFixed(6)],
      );

      return effectiveRate;
    }

    if (fxProvider === "exchangerateapi") {
      const res = await fetch(
        `https://v6.exchangerate-api.com/v6/${env.FX_API_KEY}/latest/${from}`,
      );

      if (!res.ok) {
        throw new Error(`ExchangeRate-API error: ${res.status}`);
      }

      const data = await res.json() as { conversion_rates: Record<string, number> };
      const rate = data.conversion_rates[to];

      if (!rate) {
        logger.warn(`Exchange rate not available for ${from} -> ${to}`);
        return null;
      }

      const effectiveRate = new Decimal(rate);
      await query(
        `INSERT INTO cache_store (key, value, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')
         ON CONFLICT (key) DO UPDATE SET value = $2, expires_at = NOW() + INTERVAL '1 hour'`,
        [cacheKey, effectiveRate.toFixed(6)],
      );

      return effectiveRate;
    }
  } catch (err) {
    logger.error({ err, from, to }, "Failed to fetch exchange rate");
  }

  return null;
}

export interface CurrencyConversion {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: Decimal;
  sourceAmount: Decimal;
  convertedAmount: Decimal;
}

export class CurrencyService {
  private baseCurrency: CurrencyCode;

  constructor(baseCurrency?: CurrencyCode) {
    this.baseCurrency = (baseCurrency ?? env.APP_DEFAULT_CURRENCY ?? "USD") as CurrencyCode;
     if (!SUPPORTED_CURRENCIES.includes(this.baseCurrency)) {
      this.baseCurrency = "USD";
    }
  }

  getBaseCurrency(): CurrencyCode {
    return this.baseCurrency;
  }

  getSupportedCurrencies(): CurrencyCode[] {
    return Object.keys(SUPPORTED_CURRENCIES) as CurrencyCode[];
  }

  getCurrencyMeta(currency: CurrencyCode): CurrencyMetadata {
    return getCurrencyMetadata(currency);
  }

  isSupported(currency: string): currency is CurrencyCode {
    return SUPPORTED_CURRENCIES.includes(currency as CurrencyCode);
  }

  async convert(
    amount: Decimal.Value,
    from: CurrencyCode,
    to: CurrencyCode,
  ): Promise<CurrencyConversion> {
    if (from === to) {
      const dp = getCurrencyMetadata(to).decimalPlaces;
      const source = new Decimal(amount);
      return {
        from,
        to,
        rate: new Decimal(1),
        sourceAmount: source,
        convertedAmount: source.toDecimalPlaces(dp, ROUND),
      };
    }

    const rate = await fetchExchangeRate(from, to);

    if (!rate) {
      throw new Error(`Exchange rate not available for ${from} -> ${to}`);
    }

    const meta = getCurrencyMetadata(to);
    const dp = meta.decimalPlaces;

    const sourceAmount = new Decimal(amount);
    const convertedAmount = sourceAmount.mul(rate).toDecimalPlaces(dp, ROUND);

    return {
      from,
      to,
      rate,
      sourceAmount,
      convertedAmount,
    };
  }

  async convertToBase(amount: Decimal.Value, from: CurrencyCode): Promise<Decimal> {
    const result = await this.convert(amount, from, this.baseCurrency);
    return result.convertedAmount;
  }

  async convertFromBase(amount: Decimal.Value, to: CurrencyCode): Promise<Decimal> {
    const result = await this.convert(amount, this.baseCurrency, to);
    return result.convertedAmount;
  }

  async detectCurrencyFromIP(ip: string): Promise<CurrencyCode> {
    if (!env.FX_API_KEY) {
      return this.baseCurrency;
    }

    const cacheKey = `currency:${ip}`;
    const cached = await query(
      `SELECT value FROM cache_store WHERE key = $1 AND expires_at > NOW()`,
      [cacheKey],
    );

    if (cached.rows.length) {
      try {
        const parsed = JSON.parse(cached.rows[0].value) as { currency: CurrencyCode };
        if (parsed.currency && this.isSupported(parsed.currency)) {
          return parsed.currency;
        }
      } catch {
        // fall through
      }
    }

    try {
      const res = await fetch(`https://ipapi.co/${ip}/json/`);
      if (!res.ok) {
        throw new Error(`IP geolocation failed: ${res.status}`);
      }

      const data = await res.json() as { country_code?: string };
      const country = data.country_code?.toUpperCase() ?? "";

      const currency = this.currencyFromCountry(country);

      await query(
        `INSERT INTO cache_store (key, value, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '24 hours')
         ON CONFLICT (key) DO UPDATE SET value = $2, expires_at = NOW() + INTERVAL '24 hours'`,
        [cacheKey, JSON.stringify({ currency })],
      );

      return currency;
    } catch (err) {
      logger.warn({ err, ip }, "IP-based currency detection failed — using base currency");
      return this.baseCurrency;
    }
  }

  private currencyFromCountry(country: string): CurrencyCode {
    const countryToCurrency: Record<string, CurrencyCode> = {
      US: "USD",
      GB: "GBP",
      DE: "EUR",
      FR: "EUR",
      ES: "EUR",
      IT: "EUR",
      NL: "EUR",
      PT: "EUR",
      IE: "EUR",
      AT: "EUR",
      BE: "EUR",
      FI: "EUR",
      GR: "EUR",
      LU: "EUR",
      JP: "JPY",
      CN: "CNY",
      IN: "INR",
      CA: "CAD",
      AU: "AUD",
      CH: "CHF",
      SE: "SEK",
      NO: "NOK",
      DK: "DKK",
      PL: "PLN",
      CZ: "CZK",
      HU: "HUF",
      BRL: "BRL",
      MX: "MXN",
      ZA: "ZAR",
      SG: "SGD",
      HK: "HKD",
      NZ: "NZD",
      KR: "KRW",
      TH: "THB",
      MY: "MYR",
      ID: "IDR",
      PH: "PHP",
      TR: "TRY",
      RU: "RUB",
    };

    const currency = countryToCurrency[country];
    if (currency && this.isSupported(currency)) {
      return currency as CurrencyCode;
    }

    return this.baseCurrency;
  }
}

export const currencyService = new CurrencyService();

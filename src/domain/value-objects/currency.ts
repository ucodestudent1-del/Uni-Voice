import { Decimal } from "decimal.js";

export const SUPPORTED_CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CAD",
  "AUD",
  "CHF",
  "CNY",
  "INR",
  "BRL",
  "MXN",
  "SGD",
  "HKD",
  "NZD",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "HUF",
  "TRY",
  "RUB",
  "ZAR",
  "KRW",
  "THB",
  "IDR",
  "MYR",
  "PHP",
  "VND",
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface CurrencyMetadata {
  code: CurrencyCode;
  name: string;
  symbol: string;
  decimalPlaces: number;
  minorUnitName: string;
  localeKey: string;
}

const CURRENCY_METADATA: Record<string, CurrencyMetadata> = {
  USD: { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2, minorUnitName: "cent", localeKey: "en-US" },
  EUR: { code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2, minorUnitName: "cent", localeKey: "de-DE" },
  GBP: { code: "GBP", name: "Pound Sterling", symbol: "£", decimalPlaces: 2, minorUnitName: "penny", localeKey: "en-GB" },
  JPY: { code: "JPY", name: "Japanese Yen", symbol: "¥", decimalPlaces: 0, minorUnitName: "yen", localeKey: "ja-JP" },
  CAD: { code: "CAD", name: "Canadian Dollar", symbol: "CA$", decimalPlaces: 2, minorUnitName: "cent", localeKey: "en-CA" },
  AUD: { code: "AUD", name: "Australian Dollar", symbol: "A$", decimalPlaces: 2, minorUnitName: "cent", localeKey: "en-AU" },
  CHF: { code: "CHF", name: "Swiss Franc", symbol: "Fr.", decimalPlaces: 2, minorUnitName: "cent", localeKey: "de-CH" },
  CNY: { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimalPlaces: 2, minorUnitName: "cent", localeKey: "zh-CN" },
  INR: { code: "INR", name: "Indian Rupee", symbol: "₹", decimalPlaces: 2, minorUnitName: "paisa", localeKey: "en-IN" },
  BRL: { code: "BRL", name: "Brazilian Real", symbol: "R$", decimalPlaces: 2, minorUnitName: "centavo", localeKey: "pt-BR" },
  MXN: { code: "MXN", name: "Mexican Peso", symbol: "$", decimalPlaces: 2, minorUnitName: "centavo", localeKey: "es-MX" },
  SGD: { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimalPlaces: 2, minorUnitName: "cent", localeKey: "en-SG" },
  HKD: { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", decimalPlaces: 2, minorUnitName: "cent", localeKey: "en-HK" },
  NZD: { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimalPlaces: 2, minorUnitName: "cent", localeKey: "en-NZ" },
  SEK: { code: "SEK", name: "Swedish Krona", symbol: "kr", decimalPlaces: 2, minorUnitName: "öre", localeKey: "sv-SE" },
  NOK: { code: "NOK", name: "Norwegian Krone", symbol: "kr", decimalPlaces: 2, minorUnitName: "øre", localeKey: "no-NO" },
  DKK: { code: "DKK", name: "Danish Krone", symbol: "kr", decimalPlaces: 2, minorUnitName: "øre", localeKey: "da-DK" },
  PLN: { code: "PLN", name: "Polish Złoty", symbol: "zł", decimalPlaces: 2, minorUnitName: "grosz", localeKey: "pl-PL" },
  CZK: { code: "CZK", name: "Czech Koruna", symbol: "Kč", decimalPlaces: 2, minorUnitName: "haléř", localeKey: "cs-CZ" },
  HUF: { code: "HUF", name: "Hungarian Forint", symbol: "Ft", decimalPlaces: 2, minorUnitName: "fillér", localeKey: "hu-HU" },
  TRY: { code: "TRY", name: "Turkish Lira", symbol: "₺", decimalPlaces: 2, minorUnitName: "kuruş", localeKey: "tr-TR" },
  RUB: { code: "RUB", name: "Russian Ruble", symbol: "₽", decimalPlaces: 2, minorUnitName: "kopeck", localeKey: "ru-RU" },
  ZAR: { code: "ZAR", name: "South African Rand", symbol: "R", decimalPlaces: 2, minorUnitName: "cent", localeKey: "en-ZA" },
  KRW: { code: "KRW", name: "South Korean Won", symbol: "₩", decimalPlaces: 0, minorUnitName: "jeon", localeKey: "ko-KR" },
  THB: { code: "THB", name: "Thai Baht", symbol: "฿", decimalPlaces: 2, minorUnitName: "satang", localeKey: "th-TH" },
  IDR: { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimalPlaces: 2, minorUnitName: "sen", localeKey: "id-ID" },
  MYR: { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", decimalPlaces: 2, minorUnitName: "sen", localeKey: "ms-MY" },
  PHP: { code: "PHP", name: "Philippine Peso", symbol: "₱", decimalPlaces: 2, minorUnitName: "centavo", localeKey: "fil-PH" },
  VND: { code: "VND", name: "Vietnamese Đồng", symbol: "₫", decimalPlaces: 0, minorUnitName: "hào", localeKey: "vi-VN" },
};

export function getCurrencyMetadata(code: string): CurrencyMetadata {
  const meta = CURRENCY_METADATA[code.toUpperCase()];
  if (!meta) {
    throw new Error(`Unsupported currency: ${code}`);
  }
  return meta;
}

export function getDefaultCurrency(): CurrencyCode {
  return "USD";
}

export const ROUNDING_MODE = Decimal.ROUND_HALF_UP;

export function formatMoney(amount: Decimal.Value, currency: CurrencyCode, locale?: string): string {
  const meta = getCurrencyMetadata(currency);
  const d = new Decimal(amount);
  const loc = locale ?? meta.localeKey;
  return new Intl.NumberFormat(loc, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: meta.decimalPlaces,
    maximumFractionDigits: meta.decimalPlaces,
  }).format(Number(d.toNumber()));
}

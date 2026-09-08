import { Decimal } from "decimal.js";
import { CurrencyCode, getCurrencyMetadata } from "./currency.js";

export class Money {
  public readonly amount: Decimal;
  public readonly currency: CurrencyCode;

  private constructor(amount: Decimal, currency: CurrencyCode) {
    this.amount = amount;
    this.currency = currency;
  }

  static fromDecimal(amount: Decimal.Value, currency: CurrencyCode): Money {
    const meta = getCurrencyMetadata(currency);
    const d = new Decimal(amount).toDecimalPlaces(meta.decimalPlaces, Decimal.ROUND_HALF_UP);
    return new Money(d, currency);
  }

  static fromMinorUnits(minor: number | string | bigint, currency: CurrencyCode): Money {
    const meta = getCurrencyMetadata(currency);
    const divisor = Math.pow(10, meta.decimalPlaces);
    const d = new Decimal(typeof minor === "bigint" ? minor.toString() : minor).div(divisor);
    return Money.fromDecimal(d, currency);
  }

  static zero(currency: CurrencyCode): Money {
    return Money.fromDecimal(0, currency);
  }

  toMinorUnits(): bigint {
    const meta = getCurrencyMetadata(this.currency);
    const scaled = this.amount.mul(Math.pow(10, meta.decimalPlaces));
    const rounded = scaled.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    return BigInt(rounded.toFixed(0));
  }

  get decimalPlaces(): number {
    return getCurrencyMetadata(this.currency).decimalPlaces;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromDecimal(this.amount.plus(other.amount), this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromDecimal(this.amount.minus(other.amount), this.currency);
  }

  multiply(factor: Decimal.Value): Money {
    return Money.fromDecimal(this.amount.times(factor), this.currency);
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  isNegative(): boolean {
    return this.amount.isNegative();
  }

  isEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.equals(other.amount);
  }

  isGreaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.gt(other.amount);
  }

  isGreaterThanOrEqualTo(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount.gte(other.amount);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }

  toString(): string {
    return `${this.amount.toFixed(this.decimalPlaces)} ${this.currency}`;
  }
}

export function moneyFromDecimal(amount: Decimal.Value, currency: CurrencyCode): Money {
  return Money.fromDecimal(amount, currency);
}

export function moneyFromMinor(minor: number | string | bigint, currency: CurrencyCode): Money {
  return Money.fromMinorUnits(minor, currency);
}

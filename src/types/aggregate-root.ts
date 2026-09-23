import { Decimal } from "decimal.js";
import type { DecimalValue } from "./decimal.js";

export interface Event {
  type: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  aggregateId: string;
}

export abstract class AggregateRoot {
  public readonly id: string;
  public version: number;
  public createdAt: Date;
  public updatedAt: Date;
  private _events: Event[] = [];
  private _version: number = 0;

  constructor(id: string) {
    this.id = id;
    this.version = 0;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  abstract toJSON(): Record<string, unknown>;

  get events(): ReadonlyArray<Event> {
    return this._events;
  }

  protected raise(eventType: string, payload: Record<string, unknown>): void {
    this._events.push({
      type: eventType,
      payload,
      timestamp: new Date(),
      aggregateId: this.id,
    });
    this._version++;
    this.version = this._version;
    this.updatedAt = new Date();
  }

  clearEvents(): void {
    this._events = [];
  }

  protected toDecimal(value: DecimalValue): Decimal {
    return new Decimal(value);
  }
}

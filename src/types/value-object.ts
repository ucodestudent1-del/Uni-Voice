export abstract class ValueObject {
  abstract equals(other: this): boolean;

  abstract toJSON(): Record<string, unknown>;

  toString(): string {
    return JSON.stringify(this.toJSON());
  }
}

export interface Phone {
  number: string;
}

export function validatePhone(number?: string): Phone | null {
  if (!number || number.trim().length === 0) return null;
  const digits = number.replace(/[^\d+()\-.\s]/g, "").trim();
  if (digits.length < 5) return null;
  return { number: number.trim() };
}

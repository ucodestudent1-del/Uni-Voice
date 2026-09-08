export interface Email {
  address: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(address: string): Email {
  const trimmed = address.trim();
  if (!EMAIL_REGEX.test(trimmed)) {
    throw new Error(`Invalid email address: ${address}`);
  }
  return { address: trimmed };
}

export function isValidEmail(address: string): boolean {
  return EMAIL_REGEX.test(address.trim());
}

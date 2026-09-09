import crypto from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const BASE32_LOOKUP: Record<string, number> = {};
for (let i = 0; i < BASE32_ALPHABET.length; i++) {
  BASE32_LOOKUP[BASE32_ALPHABET[i]] = i;
  BASE32_LOOKUP[BASE32_ALPHABET[i].toLowerCase()] = i;
}

export interface TotpOptions {
  step?: number;
  digits?: number;
  window?: number;
}

export const DEFAULT_STEP = 30;
export const DEFAULT_DIGITS = 6;
export const DEFAULT_WINDOW = 1;
export const ISSUER = "InvoiceFlow";

export function bytesToBase32(bytes: Uint8Array | Buffer): string {
  const buf = Buffer.from(bytes);
  let output = "";
  let bits = 0;
  let value = 0;
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(value >>> (bits & 31)) & 31];
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32ToBytes(b32: string): Uint8Array {
  const cleaned = b32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (const ch of cleaned) {
    const val = BASE32_LOOKUP[ch];
    if (val === undefined) {
      throw new Error(`Invalid base32 character: ${ch}`);
    }
    buffer = (buffer << 5) | val;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      bytes.push((buffer >>> (bitsLeft & 31)) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

export function normalizeSecret(secret: string): string {
  return secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
}

export function generateSecret(): string {
  const buf = crypto.randomBytes(20);
  return bytesToBase32(buf).slice(0, 32);
}

export function generateOtpAuthUri(secret: string, label: string, issuer: string = ISSUER): string {
  const normalized = normalizeSecret(secret);
  const encodedLabel = `${encodeURIComponent(issuer)}:${encodeURIComponent(label)}`;
  const qs = `secret=${normalized}&issuer=${encodeURIComponent(issuer)}&digits=${DEFAULT_DIGITS}&period=${DEFAULT_STEP}`;
  return `otpauth://totp/${encodedLabel}?${qs}`;
}

function counterToBytes(counter: number | bigint): Uint8Array {
  const buf = Buffer.alloc(8, 0);
  const big = BigInt.asUintN(64, BigInt(Math.floor(Number(counter))));
  buf.writeBigUInt64BE(big);
  return new Uint8Array(buf);
}

export function hotpBytes(key: Uint8Array | Buffer, counter: number | bigint, digits = DEFAULT_DIGITS): string {
  const hmac = crypto.createHmac("sha1", Buffer.from(key));
  hmac.update(Buffer.from(counterToBytes(counter)));
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const mod = 10 ** digits;
  const otp = binary % mod;
  return String(otp).padStart(digits, "0");
}

export function hotp(secret: string, counter: number | bigint, digits = DEFAULT_DIGITS): string {
  const key = base32ToBytes(normalizeSecret(secret));
  return hotpBytes(key, counter, digits);
}

export function totp(secret: string, now: number = Date.now() / 1000, step = DEFAULT_STEP, digits = DEFAULT_DIGITS): string {
  const counter = Math.floor(now / step);
  return hotp(secret, counter, digits);
}

export interface TotpVerification {
  valid: boolean;
  matchedStep: number | null;
}

export function verifyTotp(
  secret: string,
  token: string,
  now: number = Date.now() / 1000,
  options: TotpOptions = {}
): TotpVerification {
  const step = options.step ?? DEFAULT_STEP;
  const digits = options.digits ?? DEFAULT_DIGITS;
  const window = options.window ?? DEFAULT_WINDOW;

  if (!/^\d+$/.test(token)) {
    return { valid: false, matchedStep: null };
  }
  const cleanToken = token.padStart(digits, "0");
  const currentCounter = BigInt(Math.floor(now / step));

  for (let i = -window; i <= window; i++) {
    const candidate = currentCounter + BigInt(i);
    const generated = hotp(secret, candidate, digits);
    if (generated === cleanToken) {
      return { valid: true, matchedStep: Number(candidate) };
    }
  }
  return { valid: false, matchedStep: null };
}

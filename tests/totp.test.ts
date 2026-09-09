import { describe, it, expect } from "vitest";
import {
  bytesToBase32,
  base32ToBytes,
  normalizeSecret,
  generateSecret,
  generateOtpAuthUri,
  hotpBytes,
  hotp,
  totp,
  verifyTotp,
} from "../src/services/auth/totp.js";

const RFC_SECRET_ASCII = "12345678901234567890";
const rfcSecretBytes = Buffer.from(RFC_SECRET_ASCII, "ascii");

describe("TOTP (RFC 6238)", () => {
  describe("base32 codec", () => {
    it("encodes the RFC secret to a known 32-char value", () => {
      expect(bytesToBase32(rfcSecretBytes)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    });

    it("round-trips arbitrary bytes", () => {
      const original = Buffer.from("super-secret-key-123", "utf8");
      const encoded = bytesToBase32(original);
      const decoded = Buffer.from(base32ToBytes(encoded));
      expect(decoded.equals(original)).toBe(true);
    });

  it("is case-insensitive and ignores padding/non-alphabet chars", () => {
    const original = Buffer.from("hello world", "utf8");
    const encoded = bytesToBase32(original);
    expect(Buffer.from(base32ToBytes(encoded.toLowerCase())).toString("utf8")).toBe("hello world");
    expect(Buffer.from(base32ToBytes(encoded + "===")).toString("utf8")).toBe("hello world");
  });
  });

  describe("generateSecret", () => {
    it("produces a 32-char base32 secret", () => {
      const s = generateSecret();
      expect(s).toMatch(/^[A-Z2-7]{32}$/);
    });

    it("produces unique secrets", () => {
      const a = generateSecret();
      const b = generateSecret();
      expect(a).not.toBe(b);
    });
  });

  describe("generateOtpAuthUri", () => {
    it("builds a standard otpauth://totp URI", () => {
      const uri = generateOtpAuthUri("JBSWY3DPEHPK3PXP", "alice@example.com", "InvoiceFlow");
      expect(uri).toBe(
        "otpauth://totp/InvoiceFlow:alice%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=InvoiceFlow&digits=6&period=30"
      );
    });
  });

  describe("hotpBytes / hotp — RFC 4226 & RFC 6238 vectors", () => {
    it("matches the RFC 6238 SHA1 8-digit test vectors", () => {
      const vectors = [
        { time: 59, counter: 1, expected: "94287082" },
        { time: 1111111109, counter: 37037036, expected: "07081804" },
        { time: 1111111111, counter: 37037037, expected: "14050471" },
        { time: 1234567890, counter: 41152263, expected: "89005924" },
        { time: 2000000000, counter: 66666666, expected: "69279037" },
        { time: 20000000000, counter: 666666666, expected: "65353130" },
      ];
      for (const v of vectors) {
        expect(hotpBytes(rfcSecretBytes, v.counter, 8), `RFC vector at t=${v.time}`).toBe(v.expected);
      }
    });

    it("the 6-digit TOTP values match the RFC 6238 derivation", () => {
      const cases: Array<[number, string]> = [
        [59, "287082"],
        [1111111109, "081804"],
        [1111111111, "050471"],
        [1234567890, "005924"],
        [2000000000, "279037"],
        [20000000000, "353130"],
      ];
      const secret = bytesToBase32(rfcSecretBytes);
      for (const [time, expected] of cases) {
        expect(totp(secret, time, 30, 6), `t=${time}`).toBe(expected);
      }
    });

    it("accepts a base32 secret through hotp()", () => {
      const secret = bytesToBase32(rfcSecretBytes);
      expect(hotp(secret, 1, 8)).toBe("94287082");
    });
  });

  describe("verifyTotp", () => {
    const secret = bytesToBase32(rfcSecretBytes);

    it("accepts the current code", () => {
      const code = totp(secret, 1234567890, 30, 6);
      expect(verifyTotp(secret, code, 1234567890, { step: 30, digits: 6, window: 1 }).valid).toBe(true);
    });

    it("accepts codes within the time window", () => {
      const code = totp(secret, 1234567890, 30, 6);
      expect(verifyTotp(secret, code, 1234567890 + 30, { window: 1 }).valid).toBe(true);
      expect(verifyTotp(secret, code, 1234567890 - 30, { window: 1 }).valid).toBe(true);
    });

    it("rejects codes outside the window", () => {
      const code = totp(secret, 1234567890, 30, 6);
      expect(verifyTotp(secret, code, 1234567890 + 60, { window: 0 }).valid).toBe(false);
    });

    it("rejects an invalid token", () => {
      expect(verifyTotp(secret, "000000", 1234567890).valid).toBe(false);
      expect(verifyTotp(secret, "abcd", 1234567890).valid).toBe(false);
    });

    it("returns the matched step so callers can prevent replay", () => {
      const code = totp(secret, 1234567890, 30, 6);
      const res = verifyTotp(secret, code, 1234567890);
      expect(res.valid).toBe(true);
      expect(res.matchedStep).toBe(Math.floor(1234567890 / 30));
    });
  });
});

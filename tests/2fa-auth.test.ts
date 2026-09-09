import { describe, it, expect, beforeEach } from "vitest";
import { twoFactorService } from "../src/services/auth/two-factor.service.js";
import { totp } from "../src/services/auth/totp.js";
import { resetTestDb, createTestUser } from "./helpers/db.js";
import { query } from "../src/db/pool.js";
import { AppError, UnauthorizedError, ForbiddenError } from "../src/domain/errors.js";

function currentCode(secret: string): string {
  return totp(secret, Date.now() / 1000, 30, 6);
}

const INVALID_CODE = "000000";

describe("TwoFactorService (DB integration)", () => {
  let user: { id: string; email: string; businessId: string };

  beforeEach(async () => {
    await resetTestDb();
    user = await createTestUser();
  });

  it("reports 2FA as disabled for a freshly created user", async () => {
    const status = await twoFactorService.getStatus(user.id);
    expect(status.enabled).toBe(false);
    expect(status.method).toBe("totp");
  });

  it("setup() returns a secret, otpauth URI and recovery codes", async () => {
    const result = await twoFactorService.setup(user.id, user.email);
    expect(result.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(result.otpauthUri).toMatch(/^otpauth:\/\/totp\/InvoiceFlow:/);
    expect(result.otpauthUri).toContain(`secret=${result.secret}`);
    expect(result.otpauthUri).toContain("issuer=InvoiceFlow");
    expect(result.otpauthUri).toContain("digits=6");
    expect(result.otpauthUri).toContain("period=30");
    expect(result.recoveryCodes).toHaveLength(10);
    expect(new Set(result.recoveryCodes).size).toBe(10);

    const res = await query(
      `SELECT code_hash FROM twofa_recovery_codes WHERE user_id = $1 ORDER BY created_at`,
      [user.id]
    );
    expect(res.rows).toHaveLength(10);
    for (const row of res.rows) {
      expect(row.code_hash).not.toMatch(/^\d{6}$/);
      expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("enable() activates 2FA with a valid current TOTP code and rejects an invalid one", async () => {
    const { secret } = await twoFactorService.setup(user.id, user.email);

    const valid = await twoFactorService.enable(user.id, currentCode(secret));
    expect(valid.enabled).toBe(true);

    const status = await twoFactorService.getStatus(user.id);
    expect(status.enabled).toBe(true);
    expect(status.confirmedAt).toBeTruthy();

    await twoFactorService.disable(user.id);
    await twoFactorService.setup(user.id, user.email);
    await expect(twoFactorService.enable(user.id, INVALID_CODE)).rejects.toThrow(UnauthorizedError);
    const after = await twoFactorService.getStatus(user.id);
    expect(after.enabled).toBe(false);
  });

  it("enable() fails if no secret was provisioned", async () => {
    await expect(twoFactorService.enable(user.id, currentCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"))).rejects.toThrow(
      ForbiddenError
    );
  });

  it("verifyLogin() returns a token only after a valid 2FA code", async () => {
    const { secret } = await twoFactorService.setup(user.id, user.email);
    await twoFactorService.enable(user.id, currentCode(secret));

    const result = await twoFactorService.verifyLogin(
      user.id,
      user.email,
      user.businessId,
      currentCode(secret),
      "127.0.0.1"
    );
    expect(result.token).toBeTruthy();
    expect(result.user.id).toBe(user.id);
    expect(result.user.email).toBe(user.email);
    expect(result.user.businessId).toBe(user.businessId);
    expect(result.usedRecoveryCode).toBe(false);
  });

  it("verifyLogin() rejects an invalid code and records the attempt", async () => {
    const { secret } = await twoFactorService.setup(user.id, user.email);
    await twoFactorService.enable(user.id, currentCode(secret));

    await expect(
      twoFactorService.verifyLogin(user.id, user.email, user.businessId, INVALID_CODE)
    ).rejects.toThrow(UnauthorizedError);

    const attempts = await query(
      `SELECT success, error_code FROM twofa_attempts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );
    expect(attempts.rows[0].success).toBe(false);
    expect(attempts.rows[0].error_code).toBe("invalid_code");
  });

  it("verifyLogin() is locked out after too many failed attempts", async () => {
    const { secret } = await twoFactorService.setup(user.id, user.email);
    await twoFactorService.enable(user.id, currentCode(secret));

    for (let i = 0; i < 5; i++) {
      await expect(
        twoFactorService.verifyLogin(user.id, user.email, user.businessId, INVALID_CODE)
      ).rejects.toThrow(UnauthorizedError);
    }

    let lockedErr: unknown;
    try {
      await twoFactorService.verifyLogin(user.id, user.email, user.businessId, currentCode(secret));
    } catch (e) {
      lockedErr = e;
    }
    expect(lockedErr).toBeInstanceOf(AppError);
    expect((lockedErr as AppError).statusCode).toBe(429);
    expect((lockedErr as AppError).code).toBe("TOO_MANY_ATTEMPTS");
  });

  it("verifyLogin() accepts a valid recovery code as a fallback", async () => {
    const { secret, recoveryCodes } = await twoFactorService.setup(user.id, user.email);
    await twoFactorService.enable(user.id, currentCode(secret));

    const code = recoveryCodes[0];
    const result = await twoFactorService.verifyLogin(
      user.id,
      user.email,
      user.businessId,
      code,
      "127.0.0.1"
    );
    expect(result.usedRecoveryCode).toBe(true);
    expect(result.token).toBeTruthy();

    await expect(
      twoFactorService.verifyLogin(user.id, user.email, user.businessId, code)
    ).rejects.toThrow(UnauthorizedError);
  });

  it("disable() clears the secret and recovery codes", async () => {
    const { secret } = await twoFactorService.setup(user.id, user.email);
    await twoFactorService.enable(user.id, currentCode(secret));

    const disabled = await twoFactorService.disable(user.id);
    expect(disabled.disabled).toBe(true);

    const status = await twoFactorService.getStatus(user.id);
    expect(status.enabled).toBe(false);

    const recovery = await query(`SELECT id FROM twofa_recovery_codes WHERE user_id = $1`, [user.id]);
    expect(recovery.rows).toHaveLength(0);
  });

  it("regenerateRecoveryCodes() issues a fresh set after 2FA is enabled", async () => {
    const { secret } = await twoFactorService.setup(user.id, user.email);
    await twoFactorService.enable(user.id, currentCode(secret));

    const regenerated = await twoFactorService.regenerateRecoveryCodes(user.id);
    expect(regenerated).toHaveLength(10);
    const res = await query(`SELECT code_hash FROM twofa_recovery_codes WHERE user_id = $1`, [user.id]);
    expect(res.rows).toHaveLength(10);
  });
});

import crypto from "node:crypto";
import { query } from "../../db/pool.js";
import { UnauthorizedError, ForbiddenError, AppError } from "../../domain/errors.js";
import { generateToken } from "../../middleware/auth.js";
import { logger } from "../../utils/logger.js";
import { generateSecret, generateOtpAuthUri, verifyTotp } from "./totp.js";

export interface TwoFactorStatus {
  enabled: boolean;
  method: string;
  confirmedAt?: string | null;
}

export interface TwoFactorSetupResult {
  secret: string;
  otpauthUri: string;
  recoveryCodes: string[];
}

export interface TwoFactorVerifyResult {
  token: string;
  user: { id: string; email: string; businessId?: string };
  usedRecoveryCode: boolean;
}

export interface RecoveryCodeSummary {
  total: number;
  used: number;
  remaining: number;
  usedAt: (string | null)[];
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 15;
const RECOVERY_CODE_COUNT = 10;

function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const n = crypto.randomInt(100000, 999999);
    codes.push(String(n));
  }
  return codes;
}

function hashRecoveryCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export class TwoFactorService {
  async getStatus(userId: string): Promise<TwoFactorStatus> {
    const res = await query(
      `SELECT two_factor_enabled, two_factor_method, two_factor_confirmed_at
         FROM users WHERE id = $1`,
      [userId]
    );
    if (!res.rows.length) {
      throw new AppError("User not found", 404, "USER_NOT_FOUND");
    }
    const row = res.rows[0];
    return {
      enabled: Boolean(row.two_factor_enabled),
      method: row.two_factor_method ?? "totp",
      confirmedAt: row.two_factor_confirmed_at,
    };
  }

  async setup(userId: string, email: string): Promise<TwoFactorSetupResult> {
    const secret = generateSecret();
    await query(`UPDATE users SET two_factor_secret = $1 WHERE id = $2`, [secret, userId]);

    const recoveryCodes = generateRecoveryCodes();
    await query(`DELETE FROM twofa_recovery_codes WHERE user_id = $1`, [userId]);
    for (const code of recoveryCodes) {
      await query(
        `INSERT INTO twofa_recovery_codes (user_id, code_hash) VALUES ($1, $2)`,
        [userId, hashRecoveryCode(code)]
      );
    }

    logger.info({ userId }, "2FA setup: generated pending secret");
    return {
      secret,
      otpauthUri: generateOtpAuthUri(secret, email),
      recoveryCodes,
    };
  }

  async enable(userId: string, code: string): Promise<{ enabled: boolean }> {
    const res = await query(`SELECT two_factor_secret FROM users WHERE id = $1`, [userId]);
    if (!res.rows.length) throw new AppError("User not found", 404, "USER_NOT_FOUND");
    const secret = res.rows[0].two_factor_secret as string | null;
    if (!secret) {
      throw new ForbiddenError("No 2FA secret provisioned. Call setup() first.");
    }

    const verification = verifyTotp(secret, code);
    if (!verification.valid) {
      await this.recordAttempt(userId, false, "invalid_code");
      throw new UnauthorizedError("Invalid verification code");
    }

    await query(
      `UPDATE users
          SET two_factor_enabled = TRUE,
              two_factor_confirmed_at = NOW(),
              two_factor_method = 'totp'
        WHERE id = $1`,
      [userId]
    );
    await this.recordAttempt(userId, true, null);
    logger.info({ userId }, "2FA enabled");
    return { enabled: true };
  }

  async verifyLogin(
    userId: string,
    email: string,
    businessId: string | undefined,
    code: string,
    ip?: string
  ): Promise<TwoFactorVerifyResult> {
    const res = await query(
      `SELECT two_factor_enabled, two_factor_secret FROM users WHERE id = $1`,
      [userId]
    );
    if (!res.rows.length) throw new UnauthorizedError("Invalid 2FA code");
    const row = res.rows[0];
    if (!row.two_factor_enabled) {
      throw new UnauthorizedError("Two-factor authentication is not enabled for this account");
    }

    const attempts = await this.countRecentFailures(userId);
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      throw new AppError(
        "Too many failed 2FA attempts. Try again later.",
        429,
        "TOO_MANY_ATTEMPTS"
      );
    }

    const secret = row.two_factor_secret as string;
    const verification = verifyTotp(secret, code);
    if (verification.valid) {
      await this.recordAttempt(userId, true, null, ip);
      return {
        token: generateToken(userId, businessId, email),
        user: { id: userId, email, businessId },
        usedRecoveryCode: false,
      };
    }

    const recovered = await this.useRecoveryCode(userId, code);
    if (recovered) {
      await this.recordAttempt(userId, true, "recovery_code", ip);
      return {
        token: generateToken(userId, businessId, email),
        user: { id: userId, email, businessId },
        usedRecoveryCode: true,
      };
    }

    await this.recordAttempt(userId, false, "invalid_code", ip);
    throw new UnauthorizedError("Invalid 2FA code");
  }

  async disable(userId: string): Promise<{ disabled: boolean }> {
    await query(
      `UPDATE users
          SET two_factor_secret = NULL,
              two_factor_enabled = FALSE,
              two_factor_confirmed_at = NULL
        WHERE id = $1`,
      [userId]
    );
    await query(`DELETE FROM twofa_recovery_codes WHERE user_id = $1`, [userId]);
    logger.info({ userId }, "2FA disabled");
    return { disabled: true };
  }

  async regenerateRecoveryCodes(userId: string): Promise<string[]> {
    const res = await query(`SELECT two_factor_enabled FROM users WHERE id = $1`, [userId]);
    if (!res.rows.length || !res.rows[0].two_factor_enabled) {
      throw new ForbiddenError("Two-factor authentication must be enabled first");
    }

    const codes = generateRecoveryCodes();
    await query(`DELETE FROM twofa_recovery_codes WHERE user_id = $1`, [userId]);
    for (const code of codes) {
      await query(
        `INSERT INTO twofa_recovery_codes (user_id, code_hash) VALUES ($1, $2)`,
        [userId, hashRecoveryCode(code)]
      );
    }
    logger.info({ userId }, "2FA recovery codes regenerated");
    return codes;
  }

  async getRecoverySummary(userId: string): Promise<RecoveryCodeSummary> {
    const res = await query(
      `SELECT used, used_at FROM twofa_recovery_codes WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );
    const rows = res.rows as Array<{ used: boolean; used_at: string | null }>;
    const used = rows.filter((r) => r.used).length;
    return {
      total: rows.length,
      used,
      remaining: rows.length - used,
      usedAt: rows.map((r) => (r.used ? (r.used_at ?? null) : null)),
    };
  }

  private async recordAttempt(userId: string, success: boolean, errorCode: string | null, ip?: string): Promise<void> {
    await query(
      `INSERT INTO twofa_attempts (user_id, ip_address, success, error_code) VALUES ($1, $2, $3, $4)`,
      [userId, ip ?? null, success, errorCode]
    );
  }

  private async countRecentFailures(userId: string): Promise<number> {
    const res = await query(
      `SELECT COUNT(*)::int AS count FROM twofa_attempts
        WHERE user_id = $1 AND success = FALSE
          AND created_at > NOW() - INTERVAL '${LOCKOUT_WINDOW_MINUTES} minutes'`,
      [userId]
    );
    return Number(res.rows[0]?.count ?? 0);
  }

  private async useRecoveryCode(userId: string, code: string): Promise<boolean> {
    if (!/^\d{6}$/.test(code)) return false;
    const hash = hashRecoveryCode(code);
    const res = await query(
      `UPDATE twofa_recovery_codes
          SET used = TRUE, used_at = NOW()
        WHERE user_id = $1 AND used = FALSE AND code_hash = $2
        RETURNING id`,
      [userId, hash]
    );
    return res.rows.length > 0;
  }
}

export const twoFactorService = new TwoFactorService();

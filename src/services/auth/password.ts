import argon2 from "argon2";
import { createHash } from "node:crypto";

export interface PasswordPolicyViolation {
  field: string;
  message: string;
}

export interface PasswordValidationResult {
  valid: boolean;
  violations: PasswordPolicyViolation[];
}

const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_POLICY: {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
} = {
  minLength: MIN_PASSWORD_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
};

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const violations: PasswordPolicyViolation[] = [];

  if (password.length < PASSWORD_POLICY.minLength) {
    violations.push({
      field: "password",
      message: `Password must be at least ${PASSWORD_POLICY.minLength} characters long`,
    });
  }

  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    violations.push({
      field: "password",
      message: "Password must contain at least one uppercase letter",
    });
  }

  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    violations.push({
      field: "password",
      message: "Password must contain at least one lowercase letter",
    });
  }

  if (PASSWORD_POLICY.requireDigit && !/\d/.test(password)) {
    violations.push({
      field: "password",
      message: "Password must contain at least one digit",
    });
  }

  if (PASSWORD_POLICY.requireSpecial && !/\W/.test(password)) {
    violations.push({
      field: "password",
      message: "Password must contain at least one special character",
    });
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    timeCost: 3,
    memoryCost: 64 * 1024,
    parallelism: 2,
  });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export interface BreachCheckResult {
  breached: boolean;
  count: number;
}

export async function checkPasswordBreach(password: string): Promise<BreachCheckResult> {
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: {
          "User-Agent": "universal-invoice-generator",
        },
      },
    );

    if (!response.ok) {
      return { breached: false, count: 0 };
    }

    const body = await response.text();
    const hashes = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes(":"));

    for (const hash of hashes) {
      const [existingSuffix, countStr] = hash.split(":");
      if (existingSuffix === suffix) {
        return { breached: true, count: parseInt(countStr, 10) };
      }
    }

    return { breached: false, count: 0 };
  } catch {
    return { breached: false, count: 0 };
  }
}

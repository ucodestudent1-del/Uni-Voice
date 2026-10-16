import { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../domain/errors.js";
import { env, isDev } from "../config/index.js";
import { query } from "../db/pool.js";
import { compareSync, hashSync } from "bcrypt";
import { isAccessTokenRevoked } from "../services/auth/token-denylist.js";
import jwt from "jsonwebtoken";

/**
 * CSRF Protection Strategy:
 *   - Access tokens are sent via the `Authorization: Bearer` header,
 *     which browsers do NOT auto-attach on cross-site requests.
 *   - Refresh tokens are stored in an HTTP-only, SameSite=lax cookie.
 *     SameSite=lax prevents the cookie from being sent on cross-site
 *     POST requests (CSRF) while still allowing it on top-level GET
 *     navigations from external links (e.g., returning from an email
 *     invoice link).
 *   - All state-changing endpoints require a valid Bearer access token;
 *     no cookie-only state mutations exist.
 *   - The `/auth/refresh` endpoint is the only one that reads auth
 *     state from a cookie; it rotates the refresh token on use.
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    businessId?: string;
    email?: string;
    role?: string;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TOKEN_EXPIRES_IN = "15m";
const REFRESH_TOKEN_EXPIRES_IN = "7d";
const ACCESS_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: !isDev,
  sameSite: "lax" as const,
  maxAge: 15 * 60 * 1000, // 15 minutes, matches JWT expiry
  path: "/",
};
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: !isDev,
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.accessToken;
  if (!token) {
    throw new UnauthorizedError("Missing or invalid authorization");
  }

  let decoded: { userId: string; businessId?: string; email?: string };

  try {
    const secret = env.AUTH_JWT_SECRET;
    decoded = jwt.verify(token, secret) as typeof decoded;
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }

  if (!env.REDIS_URL) {
    req.user = {
      id: decoded.userId,
      businessId: decoded.businessId,
      email: decoded.email,
    };
    next();
    return;
  }

  isAccessTokenRevoked(token).then((revoked) => {
    if (revoked) {
      throw new UnauthorizedError("Token has been revoked");
    }

    req.user = {
      id: decoded.userId,
      businessId: decoded.businessId,
      email: decoded.email,
    };
    next();
  }).catch((err) => {
    next(err);
  });
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : req.cookies?.accessToken;
  if (token) {
    try {
      const secret = env.AUTH_JWT_SECRET;
      const decoded = jwt.verify(token, secret) as { userId: string; businessId?: string; email?: string };
      req.user = { id: decoded.userId, businessId: decoded.businessId, email: decoded.email };
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}

export function generateAccessToken(userId: string, businessId?: string, email?: string): string {
  const secret = env.AUTH_JWT_SECRET;
  return jwt.sign({ userId, businessId, email }, secret, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

export function generateRefreshToken(userId: string): string {
  const secret = env.AUTH_JWT_SECRET;
  return jwt.sign({ userId, type: "refresh" }, secret, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

export interface GenerateTokenPairOptions {
  userId: string;
  businessId?: string;
  email?: string;
}

export async function generateTokenPair({
  userId,
  businessId,
  email,
}: GenerateTokenPairOptions): Promise<TokenPair> {
  const accessToken = generateAccessToken(userId, businessId, email);
  const refreshToken = generateRefreshToken(userId);

  // Store hashed refresh token in DB
  const tokenHash = hashSync(refreshToken, 12);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash, expiresAt],
  );

  return { accessToken, refreshToken };
}

export async function consumeRefreshToken(
  refreshToken: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ userId: string } | null> {
  let payload: { userId: string; type?: string };
  try {
    payload = jwt.verify(refreshToken, env.AUTH_JWT_SECRET) as typeof payload;
  } catch {
    return null;
  }

  if (payload.type !== "refresh") {
    return null;
  }

  const userId = payload.userId;

   // Find the stored hash for this user's most recent refresh token
  const result = await query(
    "SELECT id, token_hash FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
    [userId],
  );

  if (!result.rows.length) {
    return null;
  }

  const stored = result.rows[0];

  if (!compareSync(refreshToken, stored.token_hash)) {
    return null;
  }

  // Revoke the old refresh token and issue a new one (rotation)
  await query(
    "UPDATE refresh_tokens SET revoked_at = NOW(), ip_address = $2, user_agent = $3 WHERE id = $1",
    [stored.id, ipAddress ?? null, userAgent ?? null],
  );

  return { userId };
}

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie("refreshToken", REFRESH_TOKEN_COOKIE_OPTIONS);
}

export function setAccessTokenCookie(res: Response, accessToken: string): void {
  res.cookie("accessToken", accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
}

export function clearAccessTokenCookie(res: Response): void {
  res.clearCookie("accessToken", ACCESS_TOKEN_COOKIE_OPTIONS);
}

// Backward-compatible: generates a short-lived access token
export function generateToken(userId: string, businessId?: string, email?: string): string {
  return generateAccessToken(userId, businessId, email);
}

import { env } from "../../config/index.js";
import { generateToken } from "../../middleware/auth.js";
import { getClient } from "../../db/pool.js";
import { logger } from "../../utils/logger.js";
import { AppError, UnauthorizedError } from "../../domain/errors.js";

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_BASE = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

const OAUTH_SCOPES = "openid email profile";

export interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

export interface OAuthResult {
  token: string;
  user: { id: string; email: string; businessId: string | undefined; name: string };
}

export class OAuthService {
  isEnabled(): boolean {
    return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  }

  getRedirectUri(): string {
    if (!env.GOOGLE_CALLBACK_URL) {
      const base = env.APP_PUBLIC_BASE_URL;
      return `${base}/api/auth/oauth/google/callback`;
    }
    return env.GOOGLE_CALLBACK_URL;
  }

  generateAuthUrl(state: string): string {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new AppError("Google OAuth is not configured", 503, "OAUTH_NOT_CONFIGURED");
    }

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: this.getRedirectUri(),
      response_type: "code",
      scope: OAUTH_SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
  }

  private async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    id_token: string;
    refresh_token?: string;
  }> {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      code,
      grant_type: "authorization_code",
      redirect_uri: this.getRedirectUri(),
    });

    const res = await fetch(GOOGLE_TOKEN_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error({ status: res.status, body }, "Google token exchange failed");
      throw new UnauthorizedError("Failed to exchange authorization code");
    }

    const data = (await res.json()) as {
      access_token: string;
      id_token: string;
      refresh_token?: string;
    };

    if (!data.id_token) {
      throw new UnauthorizedError("No ID token returned from Google");
    }

    return data;
  }

  private async fetchGoogleUser(accessToken: string): Promise<GoogleUserInfo> {
    const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new UnauthorizedError("Failed to fetch Google user info");
    }

    return (await res.json()) as GoogleUserInfo;
  }

  async handleCallback(code: string): Promise<OAuthResult> {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new AppError("Google OAuth is not configured", 503, "OAUTH_NOT_CONFIGURED");
    }

    const tokens = await this.exchangeCodeForTokens(code);
    const googleUser = await this.fetchGoogleUser(tokens.access_token);

    if (!googleUser.email_verified) {
      throw new UnauthorizedError("Google email not verified");
    }

    return this.findOrCreateUser(googleUser);
  }

  private async findOrCreateUser(googleUser: GoogleUserInfo): Promise<OAuthResult> {
    const client = await getClient();
    try {
      await client.query("BEGIN");

      const existing = await client.query<{
        id: string;
        google_id: string | null;
        oauth_provider: string;
        email: string;
        avatar_url: string | null;
      }>(
        `SELECT id, google_id, oauth_provider, email, avatar_url FROM users WHERE email = $1 FOR UPDATE`,
        [googleUser.email]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        const row = existing.rows[0]!;

        let needUpdate = false;
        const updates: string[] = [];
        const values: unknown[] = [];
        let i = 1;

        if (row.google_id !== googleUser.sub) {
          updates.push(`google_id = $${i++}`);
          values.push(googleUser.sub);
          needUpdate = true;
        }

        if (row.oauth_provider !== "google") {
          updates.push(`oauth_provider = $${i++}`);
          values.push("google");
          needUpdate = true;
        }

        if (row.avatar_url !== googleUser.picture) {
          updates.push(`avatar_url = $${i++}`);
          values.push(googleUser.picture ?? null);
          needUpdate = true;
        }

        if (needUpdate) {
          values.push(row.id);
          await client.query(
            `UPDATE users SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${i}`,
            values
          );
          logger.info({ userId: row.id }, "Linked Google OAuth identity to existing user");
        }

        await client.query("COMMIT");

        const businessRes = await client.query(
          "SELECT id AS business_id FROM businesses WHERE owner_id = $1 LIMIT 1",
          [row.id]
        );
        const businessId = businessRes.rows[0]?.business_id as string | undefined;

        const token = generateToken(row.id, businessId, row.email);

        return {
          token,
          user: {
            id: row.id,
            email: row.email,
            businessId,
            name: googleUser.name ?? "",
          },
        };
      } else {
        const userId = crypto.randomUUID();
        const businessId = crypto.randomUUID();
        const now = new Date().toISOString();
        const avatarUrl = googleUser.picture ?? null;

        await client.query(
          `INSERT INTO users (id, email, oauth_provider, google_id, avatar_url, created_at, updated_at)
           VALUES ($1, $2, 'google', $3, $4, $5, $5)`,
          [userId, googleUser.email, googleUser.sub, avatarUrl, now]
        );

        await client.query(
          `INSERT INTO businesses (id, owner_id, name, country_code, default_currency, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $6)`,
          [
            businessId,
            userId,
            googleUser.name ?? googleUser.email,
            "US",
            "USD",
            now,
          ]
        );

        await client.query(
          `INSERT INTO business_settings (business_id, default_currency, time_zone, locale, created_at, updated_at)
           VALUES ($1, 'USD', 'UTC', 'en-US', $2, $2)`,
          [businessId, now]
        );

        await client.query(
          `INSERT INTO invoice_number_sequences (business_id, prefix, next_number, padding, includes_year)
           VALUES ($1, 'INV', 1, 6, true)
           ON CONFLICT (business_id) DO NOTHING`,
          [businessId]
        );

        await client.query("COMMIT");

        const token = generateToken(userId, businessId, googleUser.email);

        logger.info({ userId, googleId: googleUser.sub }, "Created new user via Google OAuth");

        return {
          token,
          user: {
            id: userId,
            email: googleUser.email,
            businessId,
            name: googleUser.name ?? "",
          },
        };
      }
    } catch (err) {
      await client.query("ROLLBACK");
      logger.error({ err }, "Failed to find or create OAuth user");
      throw err;
    } finally {
      client.release();
    }
  }
}

export const oauthService = new OAuthService();

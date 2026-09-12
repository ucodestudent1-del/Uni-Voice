import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { resetTestDb, createTestUser } from "./helpers/db.js";
import { query } from "../src/db/pool.js";
import jwt from "jsonwebtoken";

const MOCK_GOOGLE_USER = {
  sub: "google-user-123",
  email: "google-user@example.com",
  email_verified: true,
  name: "Google User",
  given_name: "Google",
  family_name: "User",
  picture: "https://lh3.googleusercontent.com/avatar.jpg",
  locale: "en",
};

const originalEnvironment = {
  APP_ENV: process.env.APP_ENV,
  APP_PUBLIC_BASE_URL: process.env.APP_PUBLIC_BASE_URL,
  APP_FRONTEND_URL: process.env.APP_FRONTEND_URL,
  RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN,
};

function restoreEnvironment() {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function mockFetchResponses(
  tokenResponse: Record<string, unknown>,
  userinfoResponse: Record<string, unknown> = MOCK_GOOGLE_USER
) {
  return vi.spyOn(global, "fetch").mockImplementation(async (input: string | URL | Request) => {
    const urlStr = input.toString();

    if (urlStr.includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify(tokenResponse), { status: 200 });
    }

    if (urlStr.includes("openidconnect.googleapis.com")) {
      return new Response(JSON.stringify(userinfoResponse), { status: 200 });
    }

    return new Response(JSON.stringify({}), { status: 404 });
  });
}

async function loadFreshService() {
  vi.resetModules();
  const mod = await import("../src/services/auth/oauth.service.js");
  const configMod = await import("../src/config/index.js");
  return { oauthService: mod.oauthService, env: configMod.env };
}

describe("OAuthService", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    restoreEnvironment();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CALLBACK_URL;
  });

  describe("isEnabled", () => {
    it("returns false when Google OAuth is not configured", async () => {
      const { oauthService } = await loadFreshService();
      expect(oauthService.isEnabled()).toBe(false);
    });

    it("returns true when both client ID and secret are configured", async () => {
      process.env.GOOGLE_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

      const { oauthService } = await loadFreshService();
      expect(oauthService.isEnabled()).toBe(true);
    });

    it("returns false when only client ID is set", async () => {
      process.env.GOOGLE_CLIENT_ID = "test-client-id";

      const { oauthService } = await loadFreshService();
      expect(oauthService.isEnabled()).toBe(false);
    });
  });

  describe("generateAuthUrl", () => {
    it("throws when Google OAuth is not configured", async () => {
      const { oauthService } = await loadFreshService();
      expect(() => oauthService.generateAuthUrl("test-state")).toThrow("not configured");
    });

    it("generates a valid auth URL with correct parameters", async () => {
      process.env.GOOGLE_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
      process.env.GOOGLE_CALLBACK_URL = "http://localhost:4000/api/auth/oauth/google/callback";

      const { oauthService, env } = await loadFreshService();

      const url = oauthService.generateAuthUrl("test-state-123");

      expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      const params = new URLSearchParams(new URL(url).search);
      expect(params.get("client_id")).toBe("test-client-id");
      expect(params.get("redirect_uri")).toBe(env.GOOGLE_CALLBACK_URL);
      expect(params.get("response_type")).toBe("code");
      expect(params.get("scope")).toBe("openid email profile");
      expect(params.get("access_type")).toBe("offline");
      expect(params.get("prompt")).toBe("consent");
      expect(params.get("state")).toBe("test-state-123");
    });

    it("derives the callback from APP_PUBLIC_BASE_URL when no explicit callback is set", async () => {
      process.env.GOOGLE_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
      process.env.APP_PUBLIC_BASE_URL = "https://api.example.com/";
      delete process.env.GOOGLE_CALLBACK_URL;

      const { oauthService, env } = await loadFreshService();
      const url = oauthService.generateAuthUrl("test-state-123");
      const params = new URLSearchParams(new URL(url).search);

      expect(params.get("redirect_uri")).toBe(
        "https://api.example.com/api/auth/oauth/google/callback"
      );
      expect(env.APP_PUBLIC_BASE_URL).toBe("https://api.example.com");
    });

    it("uses the Railway public domain in production when APP_PUBLIC_BASE_URL is unset", async () => {
      process.env.GOOGLE_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
      process.env.APP_ENV = "production";
      process.env.RAILWAY_PUBLIC_DOMAIN = "api-example.up.railway.app";
      delete process.env.APP_PUBLIC_BASE_URL;
      delete process.env.APP_FRONTEND_URL;
      delete process.env.GOOGLE_CALLBACK_URL;
      vi.doMock("dotenv", () => ({ config: () => ({}) }));

      try {
        const { oauthService, env } = await loadFreshService();
        const url = oauthService.generateAuthUrl("test-state-123");
        const params = new URLSearchParams(new URL(url).search);

        expect(env.APP_PUBLIC_BASE_URL).toBe("https://api-example.up.railway.app");
        expect(params.get("redirect_uri")).toBe(
          "https://api-example.up.railway.app/api/auth/oauth/google/callback"
        );
      } finally {
        vi.doUnmock("dotenv");
      }
    });
  });

  describe("handleCallback", () => {
    beforeEach(() => {
      process.env.GOOGLE_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    });

    it("creates a new user when none exists for the Google email", async () => {
      const { oauthService } = await loadFreshService();
      mockFetchResponses({
        access_token: "mock-access-token",
        id_token: "mock-id-token",
      });

      const result = await oauthService.handleCallback("mock-auth-code");

      expect(result.user.email).toBe("google-user@example.com");
      expect(result.user.id).toBeTruthy();
      expect(result.token).toBeTruthy();

      const userRes = await query(
        "SELECT id, email, oauth_provider, google_id, avatar_url FROM users WHERE email = $1",
        ["google-user@example.com"]
      );
      expect(userRes.rows).toHaveLength(1);
      expect(userRes.rows[0].oauth_provider).toBe("google");
      expect(userRes.rows[0].google_id).toBe("google-user-123");
      expect(userRes.rows[0].avatar_url).toBe("https://lh3.googleusercontent.com/avatar.jpg");

      const businessRes = await query(
        "SELECT id, owner_id FROM businesses WHERE owner_id = $1",
        [userRes.rows[0].id]
      );
      expect(businessRes.rows).toHaveLength(1);

      const settingsRes = await query(
        "SELECT business_id FROM business_settings WHERE business_id = $1",
        [businessRes.rows[0].id]
      );
      expect(settingsRes.rows).toHaveLength(1);

      const seqRes = await query(
        "SELECT business_id FROM invoice_number_sequences WHERE business_id = $1",
        [businessRes.rows[0].id]
      );
      expect(seqRes.rows).toHaveLength(1);
    });

    it("links Google identity to an existing password-based user", async () => {
      const testUser = await createTestUser({
        email: "google-user@example.com",
        password: "Password123!",
      });

      const { oauthService, env } = await loadFreshService();
      mockFetchResponses({
        access_token: "mock-access-token",
        id_token: "mock-id-token",
      });

      const result = await oauthService.handleCallback("mock-auth-code");

      expect(result.user.email).toBe("google-user@example.com");
      expect(result.user.id).toBe(testUser.id);

      const userRes = await query(
        "SELECT oauth_provider, google_id, avatar_url FROM users WHERE id = $1",
        [testUser.id]
      );
      const row = userRes.rows[0]!;
      expect(row.oauth_provider).toBe("google");
      expect(row.google_id).toBe("google-user-123");
      expect(row.avatar_url).toBe("https://lh3.googleusercontent.com/avatar.jpg");

      const decoded = jwt.verify(result.token, env.AUTH_JWT_SECRET) as {
        userId: string;
        businessId: string;
      };
      expect(decoded.userId).toBe(testUser.id);
    });

    it("preserves existing business when linking Google to a password user", async () => {
      await createTestUser({
        email: "google-user@example.com",
        password: "Password123!",
        businessId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      });

      const { oauthService, env } = await loadFreshService();
      mockFetchResponses({
        access_token: "mock-access-token",
        id_token: "mock-id-token",
      });

      const result = await oauthService.handleCallback("mock-auth-code");

      const decoded = jwt.verify(result.token, env.AUTH_JWT_SECRET) as {
        businessId: string;
      };
      expect(decoded.businessId).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    });

    it("throws when Google token exchange fails", async () => {
      const { oauthService } = await loadFreshService();
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })
      );

      await expect(oauthService.handleCallback("bad-code")).rejects.toThrow(
        "Failed to exchange authorization code"
      );
    });

    it("throws when email is not verified", async () => {
      const { oauthService } = await loadFreshService();
      mockFetchResponses(
        { access_token: "mock-access-token", id_token: "mock-id-token" },
        { ...MOCK_GOOGLE_USER, email_verified: false }
      );

      await expect(oauthService.handleCallback("mock-auth-code")).rejects.toThrow(
        "Google email not verified"
      );
    });

    it("throws when OAuth is not configured", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const { oauthService } = await loadFreshService();

      await expect(oauthService.handleCallback("mock-auth-code")).rejects.toThrow("not configured");
    });

    it("generates a valid JWT token with correct payload for new users", async () => {
      const { oauthService, env } = await loadFreshService();
      mockFetchResponses({
        access_token: "mock-access-token",
        id_token: "mock-id-token",
      });

      const result = await oauthService.handleCallback("mock-auth-code");

      const userRes = await query("SELECT id, email FROM users WHERE email = $1", [
        "google-user@example.com",
      ]);
      expect(userRes.rows).toHaveLength(1);

      const businessRes = await query(
        "SELECT id FROM businesses WHERE owner_id = $1",
        [userRes.rows[0].id]
      );
      expect(businessRes.rows).toHaveLength(1);

      const decoded = jwt.verify(result.token, env.AUTH_JWT_SECRET) as {
        userId: string;
        email: string;
        businessId: string;
      };

      expect(decoded.userId).toBe(userRes.rows[0].id);
      expect(decoded.email).toBe(userRes.rows[0].email);
      expect(decoded.businessId).toBe(businessRes.rows[0].id);
    });
  });
});

import { getRedisClient } from "../../db/redis.js";
import { logger } from "../../utils/logger.js";

const DENYLIST_PREFIX = "jwt:denylist:";

export async function revokeAccessToken(
  token: string,
  expiresInSeconds: number,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    logger.warn("Redis not available; access token revocation skipped");
    return;
  }

  const key = `${DENYLIST_PREFIX}${token}`;
  await redis.setex(key, expiresInSeconds, "1");
}

export async function isAccessTokenRevoked(token: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  const key = `${DENYLIST_PREFIX}${token}`;
  const result = await redis.exists(key);
  return result > 0;
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    logger.warn("Redis not available; user token revocation skipped");
    return;
  }

  const pattern = `${DENYLIST_PREFIX}*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

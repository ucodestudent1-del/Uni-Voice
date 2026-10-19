import { getRedisClient, isRedisReady } from "../../db/redis.js";
import { logger } from "../../utils/logger.js";

const DENYLIST_PREFIX = "jwt:denylist:";
const USER_TOKENS_PREFIX = "jwt:user-tokens:";

export async function revokeAccessToken(
  token: string,
  expiresInSeconds: number,
  userId?: string,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    logger.warn("Redis not available; access token revocation skipped");
    return;
  }

  const key = `${DENYLIST_PREFIX}${token}`;
  await redis.setex(key, expiresInSeconds, "1");

  if (userId) {
    const userKey = `${USER_TOKENS_PREFIX}${userId}`;
    await redis.sadd(userKey, token);
    await redis.expire(userKey, Math.max(expiresInSeconds, 0));
  }
}

export async function isAccessTokenRevoked(token: string): Promise<boolean> {
  if (!isRedisReady()) return false;

  const redis = getRedisClient();
  if (!redis) return false;

  const key = `${DENYLIST_PREFIX}${token}`;
  try {
    const result = await redis.exists(key);
    return result > 0;
  } catch (err) {
    logger.warn({ err }, "Redis unavailable during token revocation check; allowing token");
    return false;
  }
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    logger.warn("Redis not available; user token revocation skipped");
    return;
  }

  const userKey = `${USER_TOKENS_PREFIX}${userId}`;
  const tokens = await redis.smembers(userKey);
  if (tokens.length > 0) {
    const pipeline = redis.pipeline();
    for (const token of tokens) {
      pipeline.del(`${DENYLIST_PREFIX}${token}`);
    }
    pipeline.del(userKey);
    await pipeline.exec();
  }
}

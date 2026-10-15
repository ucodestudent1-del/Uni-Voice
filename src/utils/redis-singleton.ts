import { logger } from "./logger.js";
import { env } from "../config/index.js";

type RedisInstance = InstanceType<typeof import("ioredis").default>;
let redisInstance: RedisInstance | null = null;
let redisReady: Promise<void> | null = null;

export function getRedis(): RedisInstance | null {
  if (!env.REDIS_URL) {
    return null;
  }
  return redisInstance;
}

export function ensureRedis(): RedisInstance | null {
  if (!env.REDIS_URL) {
    return null;
  }
  if (redisInstance) {
    return redisInstance;
  }
  if (!redisReady) {
    redisReady = initRedis();
  }
  return redisInstance;
}

export async function initRedis(): Promise<void> {
  if (!env.REDIS_URL || redisInstance) {
    return;
  }

  try {
    const IoredisModule = await import("ioredis");
    const Ioredis = IoredisModule.default as unknown as typeof import("ioredis").default;
    const instance = new Ioredis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      lazyConnect: true,
    });

    instance.on("error", (err: Error) => {
      logger.error({ err }, "Redis error");
    });

    instance.on("connect", () => {
      logger.info("Connected to Redis");
    });

    void instance.connect().catch((err: Error) => {
      logger.warn({ err }, "Redis connect failed");
      redisInstance = null;
    });
    redisInstance = instance;
  } catch (err) {
    logger.warn({ err }, "Redis initialization failed");
    redisInstance = null;
  }
}

export function isRedisAvailable(): boolean {
  return redisInstance !== null && !!env.REDIS_URL;
}

import { logger } from "./logger.js";
import { env } from "../config/index.js";

type RedisInstance = InstanceType<typeof import("ioredis").default>;
let redisInstance: RedisInstance | null = null;

export function getRedis(): RedisInstance | null {
  if (!env.REDIS_URL) {
    return null;
  }
  if (redisInstance) {
    return redisInstance;
  }

  try {
    const Ioredis = require("ioredis");
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

  return redisInstance;
}

export function isRedisAvailable(): boolean {
  return redisInstance !== null && !!env.REDIS_URL;
}

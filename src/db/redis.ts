import { Redis } from "ioredis";
import type { Redis as RedisType } from "ioredis";
import { env, isDev } from "../config/index.js";
import { logger } from "../utils/logger.js";

let redisClient: RedisType | null = null;

export function getRedisClient(): RedisType | null {
  if (!env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL);
    redisClient.on("error", (err: Error) => {
      logger.error({ err }, "Redis connection error");
    });
    redisClient.on("connect", () => {
      if (!isDev) {
        logger.info("Connected to Redis");
      }
    });
  }

  return redisClient;
}

export function getRedisSendCommand(): ((...args: string[]) => Promise<unknown>) | null {
  const client = getRedisClient();
  if (!client) return null;
  return (...args: string[]) => client.call(args[0], ...args.slice(1)) as Promise<unknown>;
}

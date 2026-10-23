import { Redis } from "ioredis";
import type { Redis as RedisType } from "ioredis";
import { env, isDev } from "../config/index.js";
import { logger } from "../utils/logger.js";

let redisClient: RedisType | null = null;
let redisConnected = false;

export function getRedisClient(): RedisType | null {
  if (!env.REDIS_URL) return null;

  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    redisClient.on("error", (err: Error) => {
      logger.error({ err }, "Redis connection error");
    });
    redisClient.on("connect", () => {
      redisConnected = true;
      if (!isDev) {
        logger.info("Connected to Redis");
      }
    });
    redisClient.on("reconnecting", () => {
      redisConnected = false;
    });
    redisClient.on("end", () => {
      redisConnected = false;
    });

    void redisClient.connect().catch((err: Error) => {
      logger.warn({ err }, "Redis initial connection failed; continuing without Redis");
    });
  }

  return redisClient;
}

export function getRedisSendCommand(): ((...args: string[]) => Promise<unknown>) | null {
  const client = getRedisClient();
  if (!client) return null;
  return (...args: string[]) => client.call(args[0], ...args.slice(1)) as Promise<unknown>;
}

export function isRedisReady(): boolean {
  return redisConnected;
}

export function getRedis(): RedisType | null {
  return getRedisClient();
}

export async function initRedis(): Promise<void> {
  getRedisClient();
}

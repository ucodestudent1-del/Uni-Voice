import { Redis } from "ioredis";
import type { Redis as RedisType } from "ioredis";
import { env, isDev } from "../config/index.js";
import { logger } from "../utils/logger.js";

let redisClient: RedisType | null = null;
let redisConnected = false;
let redisReadyResolvers: ((value: void) => void)[] = [];

export function getRedisClient(): RedisType | null {
  if (!env.REDIS_URL) return null;

  if (!redisClient) {
     redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      connectTimeout: 10000,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times >= 5) {
          logger.warn(`Redis retry attempt ${times} — giving up. Redis features disabled.`);
          return null;
        }
        const delay = Math.min(times * 200, 5000);
        return delay;
      },
    });
    redisClient.on("error", (err: Error) => {
      logger.error({ err }, "Redis connection error");
    });
    redisClient.on("connect", () => {
      redisConnected = true;
      redisReadyResolvers.forEach((resolve) => resolve());
      redisReadyResolvers = [];
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
  }

  return redisClient;
}

export function getRedis(): RedisType | null {
  return getRedisClient();
}

export async function initRedis(): Promise<void> {
  if (!env.REDIS_URL) return;
  const client = getRedisClient();
  if (!client) return;
  if (redisConnected) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!redisConnected) {
          reject(new Error("Redis connection timeout"));
        }
      }, 15000);
      redisReadyResolvers.push((value: void) => {
        clearTimeout(timeout);
        resolve(value);
      });
      void client.connect().catch((err: Error) => {
        clearTimeout(timeout);
        logger.warn({ err }, "Redis initial connection failed; continuing without Redis");
        resolve();
      });
    });
  } catch (err) {
    logger.warn({ err }, "Redis initial connection attempt failed; continuing without Redis");
  }
}

export function isRedisReady(): boolean {
  return redisConnected;
}

export function getRedisSendCommand(): ((...args: string[]) => Promise<unknown>) | null {
  const client = getRedisClient();
  if (!client) return null;
  return (...args: string[]) => client.call(args[0], ...args.slice(1)) as Promise<unknown>;
}

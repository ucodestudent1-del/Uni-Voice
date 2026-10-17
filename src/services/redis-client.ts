import { getRedis, initRedis } from "../utils/redis-singleton.js";
import { TtlCache } from "../utils/ttl-cache.js";
import { env } from "../config/index.js";

type RedisInstance = InstanceType<typeof import("ioredis").default>;
const memoryCache = new TtlCache<string>(60 * 1000);

async function getClient(): Promise<RedisInstance | null> {
  if (env.REDIS_URL && !getRedis()) {
    await initRedis();
  }
  return getRedis();
}

export async function redisGet(key: string): Promise<string | null> {
  const client = await getClient();
  if (!client) {
    return memoryCache.get(key) ?? null;
  }
  try {
    return await client.get(key);
  } catch {
    return memoryCache.get(key) ?? null;
  }
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<void> {
  const client = await getClient();
  if (!client) {
    memoryCache.set(key, value);
    return;
  }
  try {
    if (ttlSeconds) {
      await client.setex(key, ttlSeconds, value);
    } else {
      await client.set(key, value);
    }
  } catch {
    memoryCache.set(key, value);
  }
}

export async function redisDel(key: string): Promise<void> {
  const client = await getClient();
  if (!client) {
    memoryCache.delete(key);
    return;
  }
  try {
    await client.del(key);
  } catch {
    memoryCache.delete(key);
  }
}

export async function redisDelPattern(pattern: string): Promise<void> {
  const client = await getClient();
  if (!client) {
    const prefix = pattern.replace(/\*$/, "");
    for (const key of memoryCache["cache"].keys()) {
      if (typeof key === "string" && key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
    return;
  }
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    const prefix = pattern.replace(/\*$/, "");
    for (const key of memoryCache["cache"].keys()) {
      if (typeof key === "string" && key.startsWith(prefix)) {
        memoryCache.delete(key);
      }
    }
  }
}

export async function redisHas(key: string): Promise<boolean> {
  const client = await getClient();
  if (!client) {
    return memoryCache.has(key);
  }
  try {
    return (await client.exists(key)) === 1;
  } catch {
    return memoryCache.has(key);
  }
}

export async function redisGetParsed<T>(key: string): Promise<T | null> {
  const raw = await redisGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function redisSetParsed<T>(
  key: string,
  value: T,
  ttlSeconds?: number,
): Promise<void> {
  const serialized = JSON.stringify(value);
  await redisSet(key, serialized, ttlSeconds);
}

export function isRedisAvailable(): boolean {
  return getRedis() !== null;
}

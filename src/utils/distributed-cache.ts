import { logger } from "../utils/logger.js";
import { env } from "../config/index.js";
import { TtlCache } from "./ttl-cache.js";

type RedisInstance = InstanceType<typeof import("ioredis").default>;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class DistributedCache<T> {
  private localCache: TtlCache<T>;
  private redis: RedisInstance | null = null;
  private ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
    this.localCache = new TtlCache<T>(ttlMs);
    this.initRedis();
  }

  private async initRedis() {
    if (!env.REDIS_URL) {
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
        logger.info("Connected to Redis — distributed cache active");
      });
      void instance.connect().catch((err: Error) => {
        logger.warn({ err }, "Redis connect failed — using local cache only");
        this.redis = null;
      });
      this.redis = instance;
    } catch (err) {
      logger.warn({ err }, "Redis module load failed — using local cache only");
      this.redis = null;
    }
  }

  async get(key: string): Promise<T | undefined> {
    const local = this.localCache.get(key);
    if (local !== undefined) {
      return local;
    }

    if (!this.redis) {
      return undefined;
    }

    try {
      const raw = await this.redis.get(key);
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEntry<T>;
        if (Date.now() > parsed.expiresAt) {
          await this.redis.del(key);
          return undefined;
        }
        this.localCache.set(key, parsed.value);
        return parsed.value;
      }
    } catch (err) {
      logger.warn({ err, key }, "Redis GET failed — falling back to local cache miss");
    }
    return undefined;
  }

  async set(key: string, value: T): Promise<void> {
    const entry: CacheEntry<T> = { value, expiresAt: Date.now() + this.ttlMs };
    this.localCache.set(key, value);

    if (!this.redis) {
      return;
    }

    try {
      const ttlSeconds = Math.floor(this.ttlMs / 1000);
      await this.redis.setex(key, ttlSeconds, JSON.stringify(entry));
    } catch (err) {
      logger.warn({ err, key }, "Redis SET failed");
    }
  }

  async has(key: string): Promise<boolean> {
    if (this.localCache.has(key)) {
      return true;
    }
    if (!this.redis) {
      return false;
    }
    try {
      return (await this.redis.exists(key)) === 1;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    this.localCache.delete(key);
    if (!this.redis) {
      return;
    }
    try {
      await this.redis.del(key);
    } catch {
      void 0;
    }
  }

  clear(): void {
    this.localCache.clear();
    if (this.redis) {
      void this.redis.flushdb().catch((err: Error) => {
        logger.warn({ err }, "Redis FLUSHDB failed");
      });
    }
  }

  async deleteByPattern(pattern: string): Promise<void> {
    if (!this.redis) {
      const prefix = pattern.replace(/\*$/, "");
      for (const key of this.localCache["cache"].keys() as IterableIterator<string>) {
        if (key.startsWith(prefix)) {
          this.localCache.delete(key);
        }
      }
      return;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      const prefix = pattern.replace(/\*$/, "");
      for (const key of this.localCache["cache"].keys() as IterableIterator<string>) {
        if (key.startsWith(prefix)) {
          this.localCache.delete(key);
        }
      }
    }
  }
}

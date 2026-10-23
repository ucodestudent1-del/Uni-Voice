import { Queue, Worker, type Job } from "bullmq";
import type { Redis as IORedisInstance } from "ioredis";
import { logger } from "../utils/logger.js";
import { env } from "../config/index.js";
import { getRedis, initRedis } from "../utils/redis-singleton.js";

interface ScheduledJob {
  name: string;
  data: Record<string, unknown>;
  options?: {
    jobId?: string;
    delay?: number;
    repeat?: { cron?: string; every?: number };
  };
}

type JobHandler = (job: Job) => Promise<unknown> | unknown;

let bullConnection: IORedisInstance | null = null;
let redisSingletonRef: IORedisInstance | null = null;
const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();
const handlers = new Map<string, JobHandler>();

function getBullRedisConnection(): IORedisInstance | null {
  if (!env.REDIS_URL) return null;
  if (bullConnection) return bullConnection;
  const shared = getRedis();
  if (shared) {
    bullConnection = shared;
    redisSingletonRef = shared;
    return bullConnection;
  }
  return null;
}

export function getSchedulerConnection(): IORedisInstance | null {
  return getBullRedisConnection();
}

export function isSchedulerAvailable(): boolean {
  return !!env.REDIS_URL;
}

export function getQueue(name: string): Queue | null {
  if (!env.REDIS_URL) return null;
  const existing = queues.get(name);
  if (existing) return existing;
  const connection = getBullRedisConnection();
  if (!connection) return null;
  try {
    const q = new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    });
    queues.set(name, q);
    return q;
  } catch (err) {
    logger.warn({ err }, `Failed to initialize queue "${name}"`);
    return null;
  }
}

export function registerHandler(queueName: string, handler: JobHandler): void {
  handlers.set(queueName, handler);
}

export async function addScheduledJob(queueName: string, job: ScheduledJob): Promise<Job | null> {
  if (env.REDIS_URL && !getRedis()) {
    await initRedis();
  }
  const q = getQueue(queueName);
  if (!q) {
    if (handlers.has(queueName)) {
      try {
        await handlers.get(queueName)!({ data: job.data } as Job);
      } catch (err) {
        logger.error({ err }, `Synchronous job handler failed for queue "${queueName}"`);
        return null;
      }
    }
    return null;
  }
  return q.add(job.name, job.data, job.options);
}

export async function scheduleRepeatableJob(
  queueName: string,
  name: string,
  data: Record<string, unknown>,
  repeat: { cron?: string; every?: number },
): Promise<void> {
  const q = getQueue(queueName);
  if (!q) {
    logger.warn(`Cannot schedule repeatable job — queue "${queueName}" unavailable`);
    return;
  }

  const schedulerOpts: Record<string, unknown> = {};
  if (repeat.cron) {
    schedulerOpts.repeat = { ...repeat, cron: repeat.cron };
  } else if (repeat.every) {
    schedulerOpts.repeat = { every: repeat.every };
  }

  await q.upsertJobScheduler(
    name,
    schedulerOpts as Record<string, unknown>,
    {
      ...data,
    } as Record<string, unknown>,
  );
  logger.info({ queueName, name, repeat }, "Scheduled repeatable job");
}

export async function startWorker(
  queueName: string,
  concurrency = 1,
): Promise<Worker | null> {
  if (!env.REDIS_URL) {
    logger.info(`Scheduler not available (REDIS_URL not set) — "${queueName}" worker disabled`);
    return null;
  }

  const connection = getBullRedisConnection();
  if (!connection) return null;

  const handler = handlers.get(queueName);
  if (!handler) {
    logger.warn(`No handler registered for queue "${queueName}"`);
    return null;
  }

  try {
    const worker = new Worker(
      queueName,
      async (job: Job) => {
        return handler(job);
      },
      {
        connection,
        concurrency,
      },
    );

    worker.on("completed", (job: Job) => {
      logger.info({ jobId: job.id, queue: queueName }, "Scheduled job completed");
    });

    worker.on("failed", (job: Job | undefined, err: Error) => {
      logger.error({ err, jobId: job?.id, queue: queueName }, "Scheduled job failed");
    });

    workers.set(queueName, worker);
    logger.info(`Started worker for "${queueName}" queue`);
    return worker;
  } catch (err) {
    logger.error({ err }, `Failed to start worker for "${queueName}"`);
    return null;
  }
}

export async function stopAllWorkers(): Promise<void> {
  for (const [name, worker] of workers) {
    try {
      await worker.close();
      logger.info(`Stopped worker "${name}"`);
    } catch (err) {
      logger.warn({ err }, `Error stopping worker "${name}"`);
    }
    workers.delete(name);
  }

  for (const [name, queue] of queues) {
    try {
      await queue.close();
      logger.info(`Closed queue "${name}"`);
    } catch (err) {
      logger.warn({ err }, `Error closing queue "${name}"`);
    }
    queues.delete(name);
  }

  if (bullConnection) {
    try {
      if (bullConnection !== redisSingletonRef) {
        await bullConnection.quit();
        logger.info("Redis connection closed");
      } else {
        logger.info("Redis connection left open (shared singleton)");
      }
    } catch (err) {
      logger.warn({ err }, "Error closing Redis connection");
    }
    bullConnection = null;
  }
}

export function getRepeatableJobsConfig(cron: string): { cron: string } {
  return { cron };
}

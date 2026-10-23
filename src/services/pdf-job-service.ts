import { Queue, Worker, Job } from "bullmq";
import type { Redis as IORedisInstance } from "ioredis";
import { logger } from "../utils/logger.js";
import { env } from "../config/index.js";
import { initRedis, getRedis } from "../utils/redis-singleton.js";
import { query } from "../db/pool.js";

const QUEUE_NAME = "pdf-generation";
const PDF_CACHE_TTL_SECONDS = 3600;

let queue: Queue | null = null;
let worker: Worker | null = null;
let bullConnection: IORedisInstance | null = null;

function getBullRedisConnection(): IORedisInstance | null {
  if (!env.REDIS_URL) return null;
  if (bullConnection) return bullConnection;
  const shared = getRedis();
  if (shared) {
    bullConnection = shared;
    return bullConnection;
  }
  return null;
}

export function getQueue(): Queue | null {
  if (!env.REDIS_URL) {
    return null;
  }
  if (!queue) {
    const connection = getBullRedisConnection();
    if (!connection) {
      return null;
    }
    try {
      queue = new Queue(QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      });
      logger.info("PDF generation queue initialized");
    } catch (err) {
      logger.warn({ err }, "Failed to initialize PDF queue — PDFs will be generated synchronously");
      queue = null;
    }
  }
  return queue;
}

export async function enqueuePdfGeneration(
  businessId: string,
  documentId: string,
  docType: "invoice" | "credit-note" | "quote",
): Promise<string | null> {
  if (env.REDIS_URL && !getRedis()) {
    await initRedis();
  }
  const q = getQueue();
  if (!q) {
    return null;
  }
  try {
    const job = await q.add("generate", {
      businessId,
      documentId,
      docType,
    }, { jobId: `pdf:${docType}:${documentId}` });
    return job.id ?? null;
  } catch (err) {
    logger.warn({ err, documentId }, "Failed to enqueue PDF generation");
    return null;
  }
}

export async function getPdfJobStatus(jobId: string): Promise<{ status: string; error?: string }> {
  if (env.REDIS_URL && !getRedis()) {
    await initRedis();
  }
  const q = getQueue();
  if (!q) {
    return { status: "unavailable" };
  }
  try {
    const job = await q.getJob(jobId);
    if (!job) {
      return { status: "not_found" };
    }
    return {
      status: await job.getState(),
      error: job.failedReason,
    };
  } catch (err) {
    logger.warn({ err, jobId }, "Failed to get PDF job status");
    return { status: "error", error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function startPdfWorker(): Promise<void> {
  if (!env.REDIS_URL) {
    return;
  }
  await initRedis();
  const connection = getRedis();
  if (!connection) {
    logger.warn("Redis connection not available — PDF worker will be disabled");
    return;
  }

  const bullConnection = getBullRedisConnection();
  if (!bullConnection) {
    logger.warn("BullMQ Redis connection not available — PDF worker will be disabled");
    return;
  }

  try {
    const redisInfo = await bullConnection.info();
    const versionMatch = redisInfo.match(/redis_version:(\d+)\.(\d+)\.(\d+)/);
    if (versionMatch) {
      const major = parseInt(versionMatch[1], 10);
      if (major < 5) {
        logger.warn(
          `Redis version ${versionMatch[1]}.${versionMatch[2]}.${versionMatch[3]} is below the minimum required (5.0.0) for BullMQ. Background PDF worker will be disabled. PDFs will be generated synchronously.`,
        );
        return;
      }
    }
  } catch (err) {
    logger.warn({ err }, "Could not check Redis version — skipping PDF worker initialization");
    return;
  }

  const { invoiceService } = await import("./invoice-service.js");

  try {
    worker = new Worker(
      QUEUE_NAME,
    async (job: Job) => {
      const { businessId, documentId, docType } = job.data as {
        businessId: string;
        documentId: string;
        docType: "invoice" | "credit-note" | "quote";
      };

      let pdfBuffer: Buffer;
      if (docType === "invoice") {
        const invoice = await invoiceService.findById(businessId, documentId);
        if (!invoice) throw new Error(`Invoice ${documentId} not found`);
        pdfBuffer = await invoiceService.generatePdf(businessId, documentId, invoice);
      } else if (docType === "credit-note") {
        const creditNoteRes = await query(
          `SELECT * FROM credit_notes WHERE id = $1 AND business_id = $2`,
          [documentId, businessId],
        );
        if (!creditNoteRes.rows.length) throw new Error(`Credit note ${documentId} not found`);
        pdfBuffer = await invoiceService.generateCreditNotePdf(businessId, documentId, creditNoteRes.rows[0]);
      } else {
        const quoteRes = await query(
          `SELECT * FROM quotes WHERE id = $1 AND business_id = $2`,
          [documentId, businessId],
        );
        if (!quoteRes.rows.length) throw new Error(`Quote ${documentId} not found`);
        const { quoteService } = await import("./quote-service.js");
        pdfBuffer = await quoteService.generatePdf(businessId, documentId, quoteRes.rows[0]);
      }

      const cacheKey = `pdf:${docType}:${documentId}`;
      await connection.setex(cacheKey, PDF_CACHE_TTL_SECONDS, pdfBuffer.toString("base64"));

      return { bytes: pdfBuffer.length };
    },
    {
      connection: bullConnection,
      concurrency: 2,
    },
  );

   worker.on("completed", (job: Job) => {
     logger.info({ jobId: job.id }, "PDF generation job completed");
   });

   worker.on("failed", (job: Job | undefined, err: Error) => {
     logger.error({ err, jobId: job?.id }, "PDF generation job failed");
   });

   worker.on("error", (err: Error) => {
     logger.error({ err }, "PDF worker error (non-fatal)");
   });

   logger.info("PDF generation worker started");
  } catch (err) {
    logger.warn({ err }, "Failed to start PDF worker — PDF generation will use synchronous fallback");
    worker = null;
  }
}

export async function stopPdfWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (bullConnection) {
    await bullConnection.quit();
    bullConnection = null;
  }
}

export async function getCachedPdf(
  docType: "invoice" | "credit-note" | "quote",
  documentId: string,
): Promise<Buffer | null> {
  if (env.REDIS_URL && !getRedis()) {
    await initRedis();
  }
  const connection = getRedis();
  if (!connection) {
    return null;
  }
  const cacheKey = `pdf:${docType}:${documentId}`;
  try {
    const cached = await connection.get(cacheKey);
    if (cached) {
      return Buffer.from(cached, "base64");
    }
  } catch (err) {
    logger.warn({ err, cacheKey }, "Redis GET for PDF cache failed");
  }
  return null;
}

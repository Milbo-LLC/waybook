import { Worker } from "bullmq";
import { and, eq } from "drizzle-orm";
import IORedis from "ioredis";
import sharp from "sharp";
import { createDb, schema } from "@waybook/db";
import { env } from "./env.js";
import { getObjectBuffer, putObjectBuffer } from "./r2.js";

const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true
});

const { db, pool } = createDb(env.DATABASE_URL);

const worker = new Worker<{ mediaId: string }>(
  env.MEDIA_PROCESSING_QUEUE,
  async (job) => {
    const mediaId = job.data.mediaId;

    await db
      .update(schema.mediaAssets)
      .set({ status: "processing" })
      .where(eq(schema.mediaAssets.id, mediaId));

    // Placeholder: image/audio derivation pipeline (Sharp/FFmpeg) can be attached here.
    const [current] = await db
      .select({
        id: schema.mediaAssets.id,
        storageKeyOriginal: schema.mediaAssets.storageKeyOriginal,
        type: schema.mediaAssets.type,
        mimeType: schema.mediaAssets.mimeType
      })
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.id, mediaId))
      .limit(1);

    if (!current) throw new Error(`media asset not found: ${mediaId}`);

    let displayKey: string | null = null;
    let thumbnailKey: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    let aspectRatio: number | null = null;
    let transcodeStatus: "none" | "pending" | "processing" | "ready" | "failed" = "none";

    if (current.type === "photo") {
      const source = await getObjectBuffer(current.storageKeyOriginal);
      const transformed = sharp(source).rotate();
      const metadata = await transformed.metadata();
      const output = await transformed.webp({ quality: 85 }).toBuffer();

      displayKey = current.storageKeyOriginal.replace(/\/original(\.[^/]+)?$/, "/display.webp");
      await putObjectBuffer({
        key: displayKey,
        body: output,
        contentType: "image/webp"
      });

      width = metadata.width ?? null;
      height = metadata.height ?? null;
      aspectRatio = width && height ? width / height : null;
      transcodeStatus = "ready";
    } else if (current.type === "video") {
      displayKey = null;
      thumbnailKey = current.storageKeyOriginal.replace(/\/original(\.[^/]+)?$/, "/thumbnail.jpg");
      transcodeStatus = "ready";
    } else if (current.type === "audio") {
      displayKey = null;
      transcodeStatus = "none";
    }

    await db
      .update(schema.mediaAssets)
      .set({
        status: "ready",
        storageKeyDisplay: displayKey,
        thumbnailKey,
        width,
        height,
        aspectRatio,
        transcodeStatus
      })
      .where(eq(schema.mediaAssets.id, mediaId));

    await db.insert(schema.jobEvents).values({
      queue: env.MEDIA_PROCESSING_QUEUE,
      jobId: job.id ?? `media:${mediaId}`,
      eventType: "completed",
      payload: { mediaId }
    });
  },
  {
    connection: redis,
    concurrency: 10
  }
);

worker.on("failed", async (job, error) => {
  if (job?.data.mediaId) {
    await db
      .update(schema.mediaAssets)
      .set({
        status: "failed",
        transcodeStatus: "failed"
      })
      .where(eq(schema.mediaAssets.id, job.data.mediaId));

    await db.insert(schema.jobEvents).values({
      queue: env.MEDIA_PROCESSING_QUEUE,
      jobId: job.id ?? `media:${job.data.mediaId}`,
      eventType: "failed",
      payload: {
        mediaId: job.data.mediaId,
        message: error.message
      }
    });
  }
});

const shutdown = async () => {
  await worker.close();
  await redis.quit();
  await pool.end();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("waybook-worker started");

import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { completeUploadInputSchema, createUploadUrlInputSchema } from "@waybook/contracts";
import { schema } from "@waybook/db";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { claimIdempotencyKey } from "../lib/idempotency.js";
import { mapMedia } from "../lib/mappers.js";
import { mediaProcessingQueue } from "../lib/queue.js";
import { createUploadUrl } from "../lib/r2.js";
import { requireAuthMiddleware } from "../middleware/require-auth.js";
import type { AppBindings } from "../types.js";

const allowedByType: Record<string, string[]> = {
  photo: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  audio: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-m4a"]
};

const maxBytesByType: Record<string, number> = {
  photo: 20 * 1024 * 1024,
  audio: 100 * 1024 * 1024
};

export const mediaRoutes = new Hono<AppBindings>();

mediaRoutes.post(
  "/entries/:entryId/media/upload-url",
  requireAuthMiddleware,
  zValidator("json", createUploadUrlInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const entryId = c.req.param("entryId");
    const payload = c.req.valid("json");

    const allowedMimeTypes = allowedByType[payload.type];
    if (!allowedMimeTypes || !allowedMimeTypes.includes(payload.mimeType)) {
      return c.json({ error: "unsupported_mime_type" }, 400);
    }

    const maxBytes = maxBytesByType[payload.type];
    if (!maxBytes) {
      return c.json({ error: "unsupported_media_type" }, 400);
    }

    if (payload.bytes > maxBytes) {
      return c.json({ error: "file_too_large" }, 400);
    }

    const [entry] = await db
      .select({
        id: schema.entries.id,
        waybookId: schema.entries.waybookId,
        waybookOwnerId: schema.waybooks.userId
      })
      .from(schema.entries)
      .innerJoin(schema.waybooks, eq(schema.entries.waybookId, schema.waybooks.id))
      .where(and(eq(schema.entries.id, entryId), eq(schema.waybooks.userId, user.id)))
      .limit(1);

    if (!entry) return c.json({ error: "not_found" }, 404);

    const claimed = await claimIdempotencyKey(`upload:${entryId}`, payload.idempotencyKey);
    if (!claimed) return c.json({ error: "idempotency_conflict" }, 409);

    const mediaId = randomUUID();
    const extension = payload.fileName.includes(".") ? payload.fileName.split(".").pop() : "bin";
    const storageKey = `user/${user.id}/waybook/${entry.waybookId}/entry/${entryId}/${mediaId}/original.${extension}`;

    const [created] = await db
      .insert(schema.mediaAssets)
      .values({
        id: mediaId,
        entryId,
        type: payload.type,
        status: "pending_upload",
        mimeType: payload.mimeType,
        bytes: payload.bytes,
        storageKeyOriginal: storageKey
      })
      .returning();

    if (!created) return c.json({ error: "create_failed" }, 500);

    const signed = await createUploadUrl({
      key: storageKey,
      contentType: payload.mimeType
    });

    return c.json({
      mediaId: created.id,
      uploadUrl: signed.uploadUrl,
      storageKey,
      expiresAt: signed.expiresAt,
      requiredHeaders: {
        "content-type": payload.mimeType
      }
    });
  }
);

mediaRoutes.post("/media/:mediaId/complete", requireAuthMiddleware, zValidator("json", completeUploadInputSchema), async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const mediaId = c.req.param("mediaId");
  const payload = c.req.valid("json");

  const claimed = await claimIdempotencyKey(`complete:${mediaId}`, payload.idempotencyKey);
  if (!claimed) return c.json({ error: "idempotency_conflict" }, 409);

  const [media] = await db
    .select({
      id: schema.mediaAssets.id,
      entryId: schema.mediaAssets.entryId,
      waybookOwnerId: schema.waybooks.userId
    })
    .from(schema.mediaAssets)
    .innerJoin(schema.entries, eq(schema.mediaAssets.entryId, schema.entries.id))
    .innerJoin(schema.waybooks, eq(schema.entries.waybookId, schema.waybooks.id))
    .where(and(eq(schema.mediaAssets.id, mediaId), eq(schema.waybooks.userId, user.id)))
    .limit(1);

  if (!media) return c.json({ error: "not_found" }, 404);

  await db
    .update(schema.mediaAssets)
    .set({ status: "uploaded" })
    .where(eq(schema.mediaAssets.id, mediaId));

  await mediaProcessingQueue.add(
    "process-media",
    { mediaId },
    {
      jobId: `media:${mediaId}`
    }
  );

  return c.json({ success: true });
});

mediaRoutes.get("/media/:mediaId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const mediaId = c.req.param("mediaId");

  const [row] = await db
    .select({
      id: schema.mediaAssets.id,
      entryId: schema.mediaAssets.entryId,
      type: schema.mediaAssets.type,
      status: schema.mediaAssets.status,
      mimeType: schema.mediaAssets.mimeType,
      bytes: schema.mediaAssets.bytes,
      width: schema.mediaAssets.width,
      height: schema.mediaAssets.height,
      durationMs: schema.mediaAssets.durationMs,
      storageKeyOriginal: schema.mediaAssets.storageKeyOriginal,
      storageKeyDisplay: schema.mediaAssets.storageKeyDisplay,
      createdAt: schema.mediaAssets.createdAt,
      waybookOwnerId: schema.waybooks.userId
    })
    .from(schema.mediaAssets)
    .innerJoin(schema.entries, eq(schema.mediaAssets.entryId, schema.entries.id))
    .innerJoin(schema.waybooks, eq(schema.entries.waybookId, schema.waybooks.id))
    .where(and(eq(schema.mediaAssets.id, mediaId), eq(schema.waybooks.userId, user.id)))
    .limit(1);

  if (!row) return c.json({ error: "not_found" }, 404);

  return c.json(mapMedia(row));
});

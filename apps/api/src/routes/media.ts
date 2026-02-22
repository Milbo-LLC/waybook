import { randomUUID } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { completeUploadInputSchema, createUploadUrlInputSchema } from "@waybook/contracts";
import { schema } from "@waybook/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getEntryAccess, getMediaAccess, hasMinimumRole } from "../lib/access.js";
import { claimIdempotencyKey } from "../lib/idempotency.js";
import { mapMedia } from "../lib/mappers.js";
import { mediaProcessingQueue } from "../lib/queue.js";
import { createUploadUrl, deleteObjectIfExists } from "../lib/r2.js";
import { requireAuthMiddleware } from "../middleware/require-auth.js";
import type { AppBindings } from "../types.js";

const allowedByType: Record<string, string[]> = {
  photo: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  audio: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-m4a"],
  video: ["video/mp4", "video/quicktime", "video/webm"]
};

const maxBytesByType: Record<string, number> = {
  photo: 20 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
  video: 120 * 1024 * 1024
};

const maxVideoDurationMs = 60_000;

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

    if (payload.type === "video" && payload.durationMs && payload.durationMs > maxVideoDurationMs) {
      return c.json({ error: "video_too_long", maxDurationMs: maxVideoDurationMs }, 400);
    }

    const entryAccess = await getEntryAccess(db, entryId, user.id);
    if (!entryAccess || !hasMinimumRole(entryAccess.role, "editor")) return c.json({ error: "not_found" }, 404);
    const entry = entryAccess.entry;

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
        durationMs: payload.durationMs ?? null,
        transcodeStatus: payload.type === "video" ? "pending" : "none",
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

  const mediaAccess = await getMediaAccess(db, mediaId, user.id);
  if (!mediaAccess || !hasMinimumRole(mediaAccess.role, "editor")) return c.json({ error: "not_found" }, 404);

  await db
    .update(schema.mediaAssets)
    .set({ status: "uploaded" })
    .where(eq(schema.mediaAssets.id, mediaId));

  await mediaProcessingQueue.add(
    "process-media",
    { mediaId },
    {
      jobId: `media-${mediaId}`
    }
  );

  return c.json({ success: true });
});

mediaRoutes.get("/media/:mediaId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const mediaId = c.req.param("mediaId");

  const mediaAccess = await getMediaAccess(db, mediaId, user.id);
  if (!mediaAccess || !hasMinimumRole(mediaAccess.role, "viewer")) return c.json({ error: "not_found" }, 404);
  const row = mediaAccess.media;

  return c.json(mapMedia(row));
});

mediaRoutes.delete("/media/:mediaId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const mediaId = c.req.param("mediaId");

  const mediaAccess = await getMediaAccess(db, mediaId, user.id);
  if (!mediaAccess || !hasMinimumRole(mediaAccess.role, "editor")) return c.json({ error: "not_found" }, 404);
  const row = mediaAccess.media;

  await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, row.id));

  await Promise.allSettled([
    deleteObjectIfExists(row.storageKeyOriginal),
    deleteObjectIfExists(row.storageKeyDisplay),
    deleteObjectIfExists(row.thumbnailKey)
  ]);

  return c.json({ success: true });
});

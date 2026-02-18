import { zValidator } from "@hono/zod-validator";
import {
  createWaybookInputSchema,
  type CreateWaybookInput,
  itineraryTypeSchema,
  updateWaybookInputSchema,
  waybookDtoSchema
} from "@waybook/contracts";
import { schema } from "@waybook/db";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { mapEntry, mapMedia, mapWaybook } from "../lib/mappers.js";
import { createPublicSlug, createShareToken, hashToken } from "../lib/security.js";
import { optionalAuthMiddleware, requireAuthMiddleware } from "../middleware/require-auth.js";
import type { AppBindings } from "../types.js";

const listQuerySchema = z.object({
  cursor: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const createShareLinkInputSchema = z.object({
  expiresAt: z.string().datetime({ offset: true }).nullable().optional()
});

const itineraryItemInputSchema = z.object({
  type: itineraryTypeSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      placeName: z.string().max(200).nullable().optional()
    })
    .nullable()
    .optional(),
  startTime: z.string().datetime({ offset: true }).nullable().optional(),
  endTime: z.string().datetime({ offset: true }).nullable().optional(),
  externalLink: z.string().url().nullable().optional()
});

export const waybookRoutes = new Hono<AppBindings>();

waybookRoutes.post("/waybooks", requireAuthMiddleware, zValidator("json", createWaybookInputSchema), async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const payload = c.req.valid("json") as CreateWaybookInput;

  const publicSlug = payload.visibility === "public" ? createPublicSlug() : null;

  const [created] = await db
    .insert(schema.waybooks)
    .values({
      userId: user.id,
      title: payload.title,
      description: payload.description,
      startDate: payload.startDate,
      endDate: payload.endDate,
      visibility: payload.visibility,
      publicSlug
    })
    .returning();

  if (!created) return c.json({ error: "create_failed" }, 500);
  return c.json(waybookDtoSchema.parse(mapWaybook(created)), 201);
});

waybookRoutes.get("/waybooks", requireAuthMiddleware, zValidator("query", listQuerySchema), async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const { cursor, limit } = c.req.valid("query");
  const cursorDate = cursor ? new Date(cursor) : null;

  const rows = await db
    .select()
    .from(schema.waybooks)
    .where(
      and(
        eq(schema.waybooks.userId, user.id),
        cursorDate ? lt(schema.waybooks.createdAt, cursorDate) : undefined
      )
    )
    .orderBy(desc(schema.waybooks.createdAt))
    .limit(limit + 1);

  const items = rows.slice(0, limit).map((row) => mapWaybook(row));
  const hasMore = rows.length > limit;
  const nextCursor = hasMore ? rows[limit - 1]?.createdAt.toISOString() ?? null : null;

  return c.json({ items, page: { hasMore, nextCursor } });
});

waybookRoutes.get("/waybooks/:waybookId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");

  const [waybook] = await db
    .select()
    .from(schema.waybooks)
    .where(and(eq(schema.waybooks.id, waybookId), eq(schema.waybooks.userId, user.id)))
    .limit(1);

  if (!waybook) return c.json({ error: "not_found" }, 404);
  return c.json(mapWaybook(waybook));
});

waybookRoutes.patch(
  "/waybooks/:waybookId",
  requireAuthMiddleware,
  zValidator("json", updateWaybookInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const updates: Partial<typeof schema.waybooks.$inferInsert> = { updatedAt: new Date() };

    if (payload.title !== undefined) updates.title = payload.title;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.startDate !== undefined) updates.startDate = payload.startDate;
    if (payload.endDate !== undefined) updates.endDate = payload.endDate;
    if (payload.coverMediaId !== undefined) updates.coverMediaId = payload.coverMediaId;
    if (payload.visibility !== undefined) updates.visibility = payload.visibility;

    if (payload.visibility === "public") {
      updates.publicSlug = createPublicSlug();
    }

    if (payload.visibility === "private" || payload.visibility === "link_only") {
      updates.publicSlug = null;
    }

    const [updated] = await db
      .update(schema.waybooks)
      .set(updates)
      .where(and(eq(schema.waybooks.id, waybookId), eq(schema.waybooks.userId, user.id)))
      .returning();

    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(mapWaybook(updated));
  }
);

waybookRoutes.delete("/waybooks/:waybookId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");

  const [deleted] = await db
    .delete(schema.waybooks)
    .where(and(eq(schema.waybooks.id, waybookId), eq(schema.waybooks.userId, user.id)))
    .returning({ id: schema.waybooks.id });

  if (!deleted) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});

waybookRoutes.post(
  "/waybooks/:waybookId/share-links",
  requireAuthMiddleware,
  zValidator("json", createShareLinkInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const [waybook] = await db
      .select()
      .from(schema.waybooks)
      .where(and(eq(schema.waybooks.id, waybookId), eq(schema.waybooks.userId, user.id)))
      .limit(1);

    if (!waybook) return c.json({ error: "not_found" }, 404);

    const token = createShareToken();
    const tokenHash = hashToken(token);

    const [inserted] = await db
      .insert(schema.waybookShareLinks)
      .values({
        waybookId,
        tokenHash,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null
      })
      .returning();

    if (!inserted) return c.json({ error: "create_failed" }, 500);

    const shareUrl = `${new URL(c.req.url).origin}/share/${token}`;

    return c.json({
      id: inserted.id,
      token,
      url: shareUrl,
      expiresAt: inserted.expiresAt?.toISOString() ?? null
    });
  }
);

waybookRoutes.delete(
  "/waybooks/:waybookId/share-links/:linkId",
  requireAuthMiddleware,
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const linkId = c.req.param("linkId");

    const [waybook] = await db
      .select({ id: schema.waybooks.id })
      .from(schema.waybooks)
      .where(and(eq(schema.waybooks.id, waybookId), eq(schema.waybooks.userId, user.id)))
      .limit(1);

    if (!waybook) return c.json({ error: "not_found" }, 404);

    await db
      .update(schema.waybookShareLinks)
      .set({ isActive: false })
      .where(and(eq(schema.waybookShareLinks.id, linkId), eq(schema.waybookShareLinks.waybookId, waybookId)));

    return c.body(null, 204);
  }
);

waybookRoutes.get("/waybooks/:waybookId/timeline", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");

  const [waybook] = await db
    .select()
    .from(schema.waybooks)
    .where(and(eq(schema.waybooks.id, waybookId), eq(schema.waybooks.userId, user.id)))
    .limit(1);

  if (!waybook) return c.json({ error: "not_found" }, 404);

  const entryRows = await db
    .select()
    .from(schema.entries)
    .where(eq(schema.entries.waybookId, waybookId))
    .orderBy(desc(schema.entries.capturedAt));

  const entryIds = entryRows.map((entry) => entry.id);
  const mediaRows = entryIds.length
    ? await db
        .select()
        .from(schema.mediaAssets)
        .where(inArray(schema.mediaAssets.entryId, entryIds))
        .orderBy(desc(schema.mediaAssets.createdAt))
    : [];

  const mediaByEntry = new Map<string, ReturnType<typeof mapMedia>[]>();
  for (const media of mediaRows) {
    const list = mediaByEntry.get(media.entryId) ?? [];
    list.push(mapMedia(media));
    mediaByEntry.set(media.entryId, list);
  }

  const entryDtos = entryRows.map((entry) => mapEntry(entry, mediaByEntry.get(entry.id) ?? []));

  const dayMap = new Map<string, typeof entryDtos>();
  for (const entry of entryDtos) {
    const date = entry.capturedAt.slice(0, 10);
    const group = dayMap.get(date) ?? [];
    group.push(entry);
    dayMap.set(date, group);
  }

  const days = [...dayMap.entries()]
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([date, entries]) => ({ date, entries }));

  return c.json({ waybook: mapWaybook(waybook), days });
});

waybookRoutes.get("/waybooks/:waybookId/itinerary-items", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");

  const [waybook] = await db
    .select({ id: schema.waybooks.id })
    .from(schema.waybooks)
    .where(and(eq(schema.waybooks.id, waybookId), eq(schema.waybooks.userId, user.id)))
    .limit(1);

  if (!waybook) return c.json({ error: "not_found" }, 404);

  const items = await db
    .select()
    .from(schema.itineraryItems)
    .where(eq(schema.itineraryItems.waybookId, waybookId))
    .orderBy(desc(schema.itineraryItems.startTime));

  return c.json({
    items: items.map((item) => ({
      id: item.id,
      waybookId: item.waybookId,
      type: item.type,
      name: item.name,
      description: item.description,
      location:
        item.lat !== null && item.lng !== null
          ? { lat: item.lat, lng: item.lng, placeName: item.placeName }
          : null,
      startTime: item.startTime?.toISOString() ?? null,
      endTime: item.endTime?.toISOString() ?? null,
      externalLink: item.externalLink,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    }))
  });
});

waybookRoutes.post(
  "/waybooks/:waybookId/itinerary-items",
  requireAuthMiddleware,
  zValidator("json", itineraryItemInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const [waybook] = await db
      .select({ id: schema.waybooks.id })
      .from(schema.waybooks)
      .where(and(eq(schema.waybooks.id, waybookId), eq(schema.waybooks.userId, user.id)))
      .limit(1);

    if (!waybook) return c.json({ error: "not_found" }, 404);

    const [created] = await db
      .insert(schema.itineraryItems)
      .values({
        waybookId,
        type: payload.type,
        name: payload.name,
        description: payload.description,
        lat: payload.location?.lat,
        lng: payload.location?.lng,
        placeName: payload.location?.placeName,
        startTime: payload.startTime ? new Date(payload.startTime) : null,
        endTime: payload.endTime ? new Date(payload.endTime) : null,
        externalLink: payload.externalLink
      })
      .returning();

    if (!created) return c.json({ error: "create_failed" }, 500);

    return c.json({
      id: created.id,
      waybookId: created.waybookId,
      type: created.type,
      name: created.name,
      description: created.description,
      location:
        created.lat !== null && created.lng !== null
          ? { lat: created.lat, lng: created.lng, placeName: created.placeName }
          : null,
      startTime: created.startTime?.toISOString() ?? null,
      endTime: created.endTime?.toISOString() ?? null,
      externalLink: created.externalLink,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    });
  }
);

waybookRoutes.get("/waybooks/:waybookId/map", requireAuthMiddleware, async (c) => {
  const waybookId = c.req.param("waybookId");
  return c.json(
    {
      error: "not_implemented",
      message: `Map visualization endpoint is planned post-MVP for waybook ${waybookId}.`
    },
    501
  );
});

waybookRoutes.post("/waybooks/:waybookId/ai-summary", requireAuthMiddleware, async (c) => {
  const waybookId = c.req.param("waybookId");
  return c.json(
    {
      error: "not_implemented",
      message: `AI summary generation is planned post-MVP for waybook ${waybookId}.`
    },
    501
  );
});

waybookRoutes.get("/public/w/:publicSlug", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const publicSlug = c.req.param("publicSlug");

  const [waybook] = await db
    .select()
    .from(schema.waybooks)
    .where(and(eq(schema.waybooks.publicSlug, publicSlug), eq(schema.waybooks.visibility, "public")))
    .limit(1);

  if (!waybook) return c.json({ error: "not_found" }, 404);
  return c.json(mapWaybook(waybook));
});

waybookRoutes.get("/public/w/:publicSlug/timeline", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const publicSlug = c.req.param("publicSlug");

  const [waybook] = await db
    .select()
    .from(schema.waybooks)
    .where(and(eq(schema.waybooks.publicSlug, publicSlug), eq(schema.waybooks.visibility, "public")))
    .limit(1);

  if (!waybook) return c.json({ error: "not_found" }, 404);

  const entryRows = await db
    .select()
    .from(schema.entries)
    .where(eq(schema.entries.waybookId, waybook.id))
    .orderBy(desc(schema.entries.capturedAt));

  const entryIds = entryRows.map((entry) => entry.id);
  const mediaRows = entryIds.length
    ? await db
        .select()
        .from(schema.mediaAssets)
        .where(inArray(schema.mediaAssets.entryId, entryIds))
        .orderBy(desc(schema.mediaAssets.createdAt))
    : [];

  const mediaByEntry = new Map<string, ReturnType<typeof mapMedia>[]>();
  for (const media of mediaRows) {
    const list = mediaByEntry.get(media.entryId) ?? [];
    list.push(mapMedia(media));
    mediaByEntry.set(media.entryId, list);
  }

  const entryDtos = entryRows.map((entry) => mapEntry(entry, mediaByEntry.get(entry.id) ?? []));

  const dayMap = new Map<string, typeof entryDtos>();
  for (const entry of entryDtos) {
    const date = entry.capturedAt.slice(0, 10);
    const group = dayMap.get(date) ?? [];
    group.push(entry);
    dayMap.set(date, group);
  }

  const days = [...dayMap.entries()]
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([date, entries]) => ({ date, entries }));

  return c.json({ waybook: mapWaybook(waybook), days });
});

waybookRoutes.get("/public/share/:token", optionalAuthMiddleware, async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");
  const tokenHash = hashToken(token);

  const [share] = await db
    .select()
    .from(schema.waybookShareLinks)
    .where(eq(schema.waybookShareLinks.tokenHash, tokenHash))
    .limit(1);

  if (!share || !share.isActive) return c.json({ error: "not_found" }, 404);
  if (share.expiresAt && share.expiresAt < new Date()) return c.json({ error: "expired" }, 410);

  const [waybook] = await db
    .select()
    .from(schema.waybooks)
    .where(eq(schema.waybooks.id, share.waybookId))
    .limit(1);

  if (!waybook) return c.json({ error: "not_found" }, 404);

  const entryRows = await db
    .select()
    .from(schema.entries)
    .where(eq(schema.entries.waybookId, waybook.id))
    .orderBy(desc(schema.entries.capturedAt));

  const entryIds = entryRows.map((entry) => entry.id);
  const mediaRows = entryIds.length
    ? await db
        .select()
        .from(schema.mediaAssets)
        .where(inArray(schema.mediaAssets.entryId, entryIds))
        .orderBy(desc(schema.mediaAssets.createdAt))
    : [];

  const mediaByEntry = new Map<string, ReturnType<typeof mapMedia>[]>();
  for (const media of mediaRows) {
    const list = mediaByEntry.get(media.entryId) ?? [];
    list.push(mapMedia(media));
    mediaByEntry.set(media.entryId, list);
  }

  const entryDtos = entryRows.map((entry) => mapEntry(entry, mediaByEntry.get(entry.id) ?? []));
  const dayMap = new Map<string, typeof entryDtos>();
  for (const entry of entryDtos) {
    const date = entry.capturedAt.slice(0, 10);
    const group = dayMap.get(date) ?? [];
    group.push(entry);
    dayMap.set(date, group);
  }
  const days = [...dayMap.entries()]
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([date, entries]) => ({ date, entries }));

  return c.json({ waybook: mapWaybook(waybook), days });
});

import { zValidator } from "@hono/zod-validator";
import { createEntryInputSchema, updateEntryInputSchema } from "@waybook/contracts";
import { schema } from "@waybook/db";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { claimIdempotencyKey } from "../lib/idempotency";
import { mapEntry, mapMedia } from "../lib/mappers";
import { requireAuthMiddleware } from "../middleware/require-auth";
import type { AppBindings } from "../types";

const listQuerySchema = z.object({
  cursor: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const entryRoutes = new Hono<AppBindings>();

entryRoutes.post(
  "/waybooks/:waybookId/entries",
  requireAuthMiddleware,
  zValidator("json", createEntryInputSchema),
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

    const claimed = await claimIdempotencyKey(`entry:${waybookId}`, payload.idempotencyKey);
    if (!claimed) return c.json({ error: "idempotency_conflict" }, 409);

    const [created] = await db
      .insert(schema.entries)
      .values({
        waybookId,
        authorUserId: user.id,
        capturedAt: new Date(payload.capturedAt),
        textContent: payload.textContent,
        lat: payload.location?.lat,
        lng: payload.location?.lng,
        placeName: payload.location?.placeName
      })
      .returning();

    if (!created) return c.json({ error: "create_failed" }, 500);
    return c.json(mapEntry(created, []), 201);
  }
);

entryRoutes.get(
  "/waybooks/:waybookId/entries",
  requireAuthMiddleware,
  zValidator("query", listQuerySchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const { cursor, limit } = c.req.valid("query");
    const cursorDate = cursor ? new Date(cursor) : null;

    const [waybook] = await db
      .select({ id: schema.waybooks.id })
      .from(schema.waybooks)
      .where(and(eq(schema.waybooks.id, waybookId), eq(schema.waybooks.userId, user.id)))
      .limit(1);

    if (!waybook) return c.json({ error: "not_found" }, 404);

    const entryRows = await db
      .select()
      .from(schema.entries)
      .where(
        and(
          eq(schema.entries.waybookId, waybookId),
          cursorDate ? lt(schema.entries.capturedAt, cursorDate) : undefined
        )
      )
      .orderBy(desc(schema.entries.capturedAt))
      .limit(limit + 1);

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

    const hasMore = entryRows.length > limit;
    const slice = entryRows.slice(0, limit);

    return c.json({
      items: slice.map((entry) => mapEntry(entry, mediaByEntry.get(entry.id) ?? [])),
      page: {
        hasMore,
        nextCursor: hasMore ? slice[slice.length - 1]?.capturedAt.toISOString() ?? null : null
      }
    });
  }
);

entryRoutes.get("/entries/:entryId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const entryId = c.req.param("entryId");

  const [entry] = await db
    .select({
      id: schema.entries.id,
      waybookId: schema.entries.waybookId,
      authorUserId: schema.entries.authorUserId,
      capturedAt: schema.entries.capturedAt,
      textContent: schema.entries.textContent,
      lat: schema.entries.lat,
      lng: schema.entries.lng,
      placeName: schema.entries.placeName,
      createdAt: schema.entries.createdAt,
      updatedAt: schema.entries.updatedAt,
      waybookOwnerId: schema.waybooks.userId
    })
    .from(schema.entries)
    .innerJoin(schema.waybooks, eq(schema.entries.waybookId, schema.waybooks.id))
    .where(and(eq(schema.entries.id, entryId), eq(schema.waybooks.userId, user.id)))
    .limit(1);

  if (!entry) return c.json({ error: "not_found" }, 404);

  const mediaRows = await db
    .select()
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.entryId, entryId))
    .orderBy(desc(schema.mediaAssets.createdAt));

  return c.json(
    mapEntry(
      {
        id: entry.id,
        waybookId: entry.waybookId,
        authorUserId: entry.authorUserId,
        capturedAt: entry.capturedAt,
        textContent: entry.textContent,
        lat: entry.lat,
        lng: entry.lng,
        placeName: entry.placeName,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      },
      mediaRows.map((media) => mapMedia(media))
    )
  );
});

entryRoutes.patch(
  "/entries/:entryId",
  requireAuthMiddleware,
  zValidator("json", updateEntryInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const entryId = c.req.param("entryId");
    const payload = c.req.valid("json");

    const [owned] = await db
      .select({ id: schema.entries.id })
      .from(schema.entries)
      .innerJoin(schema.waybooks, eq(schema.entries.waybookId, schema.waybooks.id))
      .where(and(eq(schema.entries.id, entryId), eq(schema.waybooks.userId, user.id)))
      .limit(1);

    if (!owned) return c.json({ error: "not_found" }, 404);

    const [updated] = await db
      .update(schema.entries)
      .set({
        textContent: payload.textContent,
        capturedAt: payload.capturedAt ? new Date(payload.capturedAt) : undefined,
        lat: payload.location?.lat,
        lng: payload.location?.lng,
        placeName: payload.location?.placeName,
        updatedAt: new Date()
      })
      .where(eq(schema.entries.id, entryId))
      .returning();

    if (!updated) return c.json({ error: "not_found" }, 404);

    const mediaRows = await db
      .select()
      .from(schema.mediaAssets)
      .where(eq(schema.mediaAssets.entryId, entryId))
      .orderBy(desc(schema.mediaAssets.createdAt));

    return c.json(mapEntry(updated, mediaRows.map((media) => mapMedia(media))));
  }
);

entryRoutes.delete("/entries/:entryId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const entryId = c.req.param("entryId");

  const [owned] = await db
    .select({ id: schema.entries.id })
    .from(schema.entries)
    .innerJoin(schema.waybooks, eq(schema.entries.waybookId, schema.waybooks.id))
    .where(and(eq(schema.entries.id, entryId), eq(schema.waybooks.userId, user.id)))
    .limit(1);

  if (!owned) return c.json({ error: "not_found" }, 404);

  await db.delete(schema.entries).where(eq(schema.entries.id, entryId));

  return c.body(null, 204);
});

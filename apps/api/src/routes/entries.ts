import { zValidator } from "@hono/zod-validator";
import {
  createEntryInputSchema,
  upsertEntryGuidanceInputSchema,
  upsertEntryRatingInputSchema,
  updateEntryInputSchema
} from "@waybook/contracts";
import { schema } from "@waybook/db";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { claimIdempotencyKey } from "../lib/idempotency.js";
import { mapEntry, mapEntryGuidance, mapEntryRating, mapMedia } from "../lib/mappers.js";
import { requireAuthMiddleware } from "../middleware/require-auth.js";
import type { AppBindings } from "../types.js";

const listQuerySchema = z.object({
  cursor: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const entryRoutes = new Hono<AppBindings>();

const getRatingsByEntryIds = async (db: AppBindings["Variables"]["db"], entryIds: string[], userId: string) => {
  if (!entryIds.length) return new Map<string, ReturnType<typeof mapEntryRating>>();
  const rows = await db
    .select()
    .from(schema.entryExperienceRatings)
    .where(and(inArray(schema.entryExperienceRatings.entryId, entryIds), eq(schema.entryExperienceRatings.userId, userId)));
  return new Map(rows.map((row) => [row.entryId, mapEntryRating(row)]));
};

const getGuidanceByEntryIds = async (db: AppBindings["Variables"]["db"], entryIds: string[]) => {
  if (!entryIds.length) return new Map<string, ReturnType<typeof mapEntryGuidance>>();
  const rows = await db
    .select()
    .from(schema.entryGuidance)
    .where(inArray(schema.entryGuidance.entryId, entryIds));
  return new Map(rows.map((row) => [row.entryId, mapEntryGuidance(row)]));
};

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
    await db.insert(schema.promptEvents).values({
      userId: user.id,
      waybookId,
      promptType: "day_reflection",
      triggerReason: "entry_created",
      scheduledFor: new Date(Date.now() + 3 * 60 * 60 * 1000)
    });

    return c.json(mapEntry(created, [], null, null), 201);
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

    const ratingsByEntry = await getRatingsByEntryIds(db, entryIds, user.id);
    const guidanceByEntry = await getGuidanceByEntryIds(db, entryIds);

    const hasMore = entryRows.length > limit;
    const slice = entryRows.slice(0, limit);

    return c.json({
      items: slice.map((entry) =>
        mapEntry(
          entry,
          mediaByEntry.get(entry.id) ?? [],
          ratingsByEntry.get(entry.id) ?? null,
          guidanceByEntry.get(entry.id) ?? null
        )
      ),
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

  const [ratingRow] = await db
    .select()
    .from(schema.entryExperienceRatings)
    .where(and(eq(schema.entryExperienceRatings.entryId, entryId), eq(schema.entryExperienceRatings.userId, user.id)))
    .limit(1);
  const [guidanceRow] = await db
    .select()
    .from(schema.entryGuidance)
    .where(eq(schema.entryGuidance.entryId, entryId))
    .limit(1);

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
      mediaRows.map((media) => mapMedia(media)),
      ratingRow ? mapEntryRating(ratingRow) : null,
      guidanceRow ? mapEntryGuidance(guidanceRow) : null
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

    const [ratingRow] = await db
      .select()
      .from(schema.entryExperienceRatings)
      .where(and(eq(schema.entryExperienceRatings.entryId, entryId), eq(schema.entryExperienceRatings.userId, user.id)))
      .limit(1);
    const [guidanceRow] = await db
      .select()
      .from(schema.entryGuidance)
      .where(eq(schema.entryGuidance.entryId, entryId))
      .limit(1);

    return c.json(
      mapEntry(
        updated,
        mediaRows.map((media) => mapMedia(media)),
        ratingRow ? mapEntryRating(ratingRow) : null,
        guidanceRow ? mapEntryGuidance(guidanceRow) : null
      )
    );
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

entryRoutes.post(
  "/entries/:entryId/rating",
  requireAuthMiddleware,
  zValidator("json", upsertEntryRatingInputSchema),
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

    const [created] = await db
      .insert(schema.entryExperienceRatings)
      .values({
        entryId,
        userId: user.id,
        ratingOverall: payload.ratingOverall,
        valueForMoney: payload.valueForMoney,
        wouldRepeat: payload.wouldRepeat,
        difficulty: payload.difficulty ?? null
      })
      .onConflictDoUpdate({
        target: [schema.entryExperienceRatings.entryId, schema.entryExperienceRatings.userId],
        set: {
          ratingOverall: payload.ratingOverall,
          valueForMoney: payload.valueForMoney,
          wouldRepeat: payload.wouldRepeat,
          difficulty: payload.difficulty ?? null,
          updatedAt: new Date()
        }
      })
      .returning();

    if (!created) return c.json({ error: "create_failed" }, 500);
    return c.json(mapEntryRating(created), 201);
  }
);

entryRoutes.patch(
  "/entries/:entryId/rating",
  requireAuthMiddleware,
  zValidator("json", upsertEntryRatingInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const entryId = c.req.param("entryId");
    const payload = c.req.valid("json");

    const [updated] = await db
      .update(schema.entryExperienceRatings)
      .set({
        ratingOverall: payload.ratingOverall,
        valueForMoney: payload.valueForMoney,
        wouldRepeat: payload.wouldRepeat,
        difficulty: payload.difficulty ?? null,
        updatedAt: new Date()
      })
      .where(and(eq(schema.entryExperienceRatings.entryId, entryId), eq(schema.entryExperienceRatings.userId, user.id)))
      .returning();

    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(mapEntryRating(updated));
  }
);

entryRoutes.post(
  "/entries/:entryId/guidance",
  requireAuthMiddleware,
  zValidator("json", upsertEntryGuidanceInputSchema),
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

    const [created] = await db
      .insert(schema.entryGuidance)
      .values({
        entryId,
        isMustDo: payload.isMustDo ?? false,
        estimatedCostMin: payload.estimatedCostMin ?? null,
        estimatedCostMax: payload.estimatedCostMax ?? null,
        timeNeededMinutes: payload.timeNeededMinutes ?? null,
        bestTimeOfDay: payload.bestTimeOfDay ?? null,
        tipsText: payload.tipsText ?? null,
        accessibilityNotes: payload.accessibilityNotes ?? null
      })
      .onConflictDoUpdate({
        target: [schema.entryGuidance.entryId],
        set: {
          isMustDo: payload.isMustDo ?? false,
          estimatedCostMin: payload.estimatedCostMin ?? null,
          estimatedCostMax: payload.estimatedCostMax ?? null,
          timeNeededMinutes: payload.timeNeededMinutes ?? null,
          bestTimeOfDay: payload.bestTimeOfDay ?? null,
          tipsText: payload.tipsText ?? null,
          accessibilityNotes: payload.accessibilityNotes ?? null,
          updatedAt: new Date()
        }
      })
      .returning();

    if (!created) return c.json({ error: "create_failed" }, 500);
    return c.json(mapEntryGuidance(created), 201);
  }
);

entryRoutes.patch(
  "/entries/:entryId/guidance",
  requireAuthMiddleware,
  zValidator("json", upsertEntryGuidanceInputSchema),
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
      .update(schema.entryGuidance)
      .set({
        isMustDo: payload.isMustDo ?? false,
        estimatedCostMin: payload.estimatedCostMin ?? null,
        estimatedCostMax: payload.estimatedCostMax ?? null,
        timeNeededMinutes: payload.timeNeededMinutes ?? null,
        bestTimeOfDay: payload.bestTimeOfDay ?? null,
        tipsText: payload.tipsText ?? null,
        accessibilityNotes: payload.accessibilityNotes ?? null,
        updatedAt: new Date()
      })
      .where(eq(schema.entryGuidance.entryId, entryId))
      .returning();

    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(mapEntryGuidance(updated));
  }
);

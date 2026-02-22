import { zValidator } from "@hono/zod-validator";
import {
  createInviteInputSchema,
  createPublicReactionInputSchema,
  createWaybookInputSchema,
  type DaySummaryDTO,
  type CreateWaybookInput,
  itineraryTypeSchema,
  upsertDaySummaryInputSchema,
  updateWaybookInputSchema,
  waybookDtoSchema
} from "@waybook/contracts";
import { schema } from "@waybook/db";
import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getWaybookAccess, hasMinimumRole } from "../lib/access.js";
import { sendInviteEmail } from "../lib/email.js";
import { env } from "../lib/env.js";
import { mapDaySummary, mapEntry, mapEntryGuidance, mapEntryRating, mapMedia, mapPublicReaction, mapWaybook } from "../lib/mappers.js";
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

const blockedReactionTerms = ["hate", "kill", "idiot", "stupid", "racist", "sexist"];

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

const getDaySummariesByWaybook = async (db: AppBindings["Variables"]["db"], waybookId: string) => {
  const rows = await db
    .select()
    .from(schema.waybookDaySummaries)
    .where(eq(schema.waybookDaySummaries.waybookId, waybookId))
    .orderBy(desc(schema.waybookDaySummaries.summaryDate));
  return new Map(rows.map((row) => [row.summaryDate, mapDaySummary(row)]));
};

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
  await db.insert(schema.waybookMembers).values({
    waybookId: created.id,
    userId: user.id,
    role: "owner",
    invitedBy: user.id
  });
  return c.json(waybookDtoSchema.parse(mapWaybook(created)), 201);
});

waybookRoutes.get("/waybooks", requireAuthMiddleware, zValidator("query", listQuerySchema), async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const { cursor, limit } = c.req.valid("query");
  const cursorDate = cursor ? new Date(cursor) : null;
  const memberships = await db
    .select({ waybookId: schema.waybookMembers.waybookId })
    .from(schema.waybookMembers)
    .where(eq(schema.waybookMembers.userId, user.id));
  const memberWaybookIds = memberships.map((row) => row.waybookId);

  const rows = await db
    .select()
    .from(schema.waybooks)
    .where(
      and(
        or(
          eq(schema.waybooks.userId, user.id),
          memberWaybookIds.length ? inArray(schema.waybooks.id, memberWaybookIds) : undefined
        ),
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

  const access = await getWaybookAccess(db, waybookId, user.id);

  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);
  return c.json(mapWaybook(access.waybook));
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

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "owner")) return c.json({ error: "not_found" }, 404);

    const [updated] = await db
      .update(schema.waybooks)
      .set(updates)
      .where(eq(schema.waybooks.id, waybookId))
      .returning();

    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(mapWaybook(updated));
  }
);

waybookRoutes.delete("/waybooks/:waybookId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "owner")) return c.json({ error: "not_found" }, 404);

  const [deleted] = await db
    .delete(schema.waybooks)
    .where(eq(schema.waybooks.id, waybookId))
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

    const access = await getWaybookAccess(db, waybookId, user.id);

    if (!access || !hasMinimumRole(access.role, "owner")) return c.json({ error: "not_found" }, 404);

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

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "owner")) return c.json({ error: "not_found" }, 404);

    await db
      .update(schema.waybookShareLinks)
      .set({ isActive: false })
      .where(and(eq(schema.waybookShareLinks.id, linkId), eq(schema.waybookShareLinks.waybookId, waybookId)));

    return c.body(null, 204);
  }
);

waybookRoutes.get("/waybooks/:waybookId/members", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const members = await db
    .select({
      id: schema.waybookMembers.id,
      waybookId: schema.waybookMembers.waybookId,
      userId: schema.waybookMembers.userId,
      role: schema.waybookMembers.role,
      invitedBy: schema.waybookMembers.invitedBy,
      createdAt: schema.waybookMembers.createdAt,
      email: schema.users.email,
      name: schema.users.name,
      image: schema.users.image
    })
    .from(schema.waybookMembers)
    .innerJoin(schema.users, eq(schema.users.id, schema.waybookMembers.userId))
    .where(eq(schema.waybookMembers.waybookId, waybookId))
    .orderBy(desc(schema.waybookMembers.createdAt));

  const invites = await db
    .select()
    .from(schema.waybookInvites)
    .where(and(eq(schema.waybookInvites.waybookId, waybookId), isNull(schema.waybookInvites.acceptedAt)))
    .orderBy(desc(schema.waybookInvites.createdAt));

  return c.json({
    accessRole: access.role,
    members: members.map((member) => ({
      id: member.id,
      waybookId: member.waybookId,
      userId: member.userId,
      role: member.role,
      invitedBy: member.invitedBy,
      createdAt: member.createdAt.toISOString(),
      user: {
        email: member.email,
        name: member.name,
        image: member.image
      }
    })),
    invites: invites.map((invite) => ({
      id: invite.id,
      waybookId: invite.waybookId,
      email: invite.email,
      role: invite.role,
      invitedBy: invite.invitedBy,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
      createdAt: invite.createdAt.toISOString()
    }))
  });
});

waybookRoutes.post(
  "/waybooks/:waybookId/invites",
  requireAuthMiddleware,
  zValidator("json", createInviteInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");
    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "owner")) return c.json({ error: "not_found" }, 404);

    const email = payload.email.trim().toLowerCase();
    const [existingUser] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
    if (existingUser) {
      const [existingMember] = await db
        .select({ id: schema.waybookMembers.id })
        .from(schema.waybookMembers)
        .where(and(eq(schema.waybookMembers.waybookId, waybookId), eq(schema.waybookMembers.userId, existingUser.id)))
        .limit(1);
      if (existingMember) return c.json({ error: "already_member" }, 409);
    }

    const [existingInvite] = await db
      .select()
      .from(schema.waybookInvites)
      .where(and(eq(schema.waybookInvites.waybookId, waybookId), eq(schema.waybookInvites.email, email), isNull(schema.waybookInvites.acceptedAt)))
      .limit(1);

    const token = createShareToken();
    const tokenHash = hashToken(token);
    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
    const [invite] = existingInvite
      ? await db
          .update(schema.waybookInvites)
          .set({
            tokenHash,
            role: payload.role,
            invitedBy: user.id,
            expiresAt,
            acceptedAt: null
          })
          .where(eq(schema.waybookInvites.id, existingInvite.id))
          .returning()
      : await db
          .insert(schema.waybookInvites)
          .values({
            waybookId,
            email,
            tokenHash,
            role: payload.role,
            invitedBy: user.id,
            expiresAt
          })
          .returning();

    if (!invite) return c.json({ error: "create_failed" }, 500);

    const acceptUrl = `${new URL(`/invite/${token}`, env.CORS_ORIGIN).toString()}`;
    const inviterName = user.email ?? "A Waybook traveler";
    try {
      await sendInviteEmail({
        to: email,
        inviterName,
        waybookTitle: access.waybook.title,
        acceptUrl,
        role: payload.role
      });
    } catch (error) {
      return c.json({ error: (error as Error).message }, 503);
    }

    return c.json(
      {
        invite: {
          id: invite.id,
          waybookId: invite.waybookId,
          email: invite.email,
          role: invite.role,
          invitedBy: invite.invitedBy,
          expiresAt: invite.expiresAt?.toISOString() ?? null,
          acceptedAt: invite.acceptedAt?.toISOString() ?? null,
          createdAt: invite.createdAt.toISOString()
        },
        token,
        acceptUrl
      },
      201
    );
  }
);

waybookRoutes.patch(
  "/waybooks/:waybookId/members/:memberId",
  requireAuthMiddleware,
  zValidator("json", z.object({ role: z.enum(["editor", "viewer"]) })),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const memberId = c.req.param("memberId");
    const payload = c.req.valid("json");
    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "owner")) return c.json({ error: "not_found" }, 404);

    const [member] = await db
      .select()
      .from(schema.waybookMembers)
      .where(and(eq(schema.waybookMembers.id, memberId), eq(schema.waybookMembers.waybookId, waybookId)))
      .limit(1);
    if (!member) return c.json({ error: "not_found" }, 404);
    if (member.userId === user.id) return c.json({ error: "cannot_change_owner_role" }, 400);
    if (member.role === "owner") return c.json({ error: "cannot_change_owner_role" }, 400);

    await db
      .update(schema.waybookMembers)
      .set({ role: payload.role })
      .where(eq(schema.waybookMembers.id, memberId));

    return c.json({ success: true });
  }
);

waybookRoutes.delete("/waybooks/:waybookId/members/:memberId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");
  const memberId = c.req.param("memberId");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "owner")) return c.json({ error: "not_found" }, 404);

  const [member] = await db
    .select()
    .from(schema.waybookMembers)
    .where(and(eq(schema.waybookMembers.id, memberId), eq(schema.waybookMembers.waybookId, waybookId)))
    .limit(1);
  if (!member) return c.json({ error: "not_found" }, 404);
  if (member.role === "owner" || member.userId === user.id) return c.json({ error: "cannot_remove_owner" }, 400);

  await db.delete(schema.waybookMembers).where(eq(schema.waybookMembers.id, memberId));
  return c.json({ success: true });
});

waybookRoutes.delete("/waybooks/:waybookId/invites/:inviteId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");
  const inviteId = c.req.param("inviteId");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "owner")) return c.json({ error: "not_found" }, 404);

  await db
    .delete(schema.waybookInvites)
    .where(and(eq(schema.waybookInvites.id, inviteId), eq(schema.waybookInvites.waybookId, waybookId)));
  return c.json({ success: true });
});

waybookRoutes.post("/waybooks/:waybookId/invites/:inviteId/resend", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");
  const inviteId = c.req.param("inviteId");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "owner")) return c.json({ error: "not_found" }, 404);

  const [invite] = await db
    .select()
    .from(schema.waybookInvites)
    .where(and(eq(schema.waybookInvites.id, inviteId), eq(schema.waybookInvites.waybookId, waybookId), isNull(schema.waybookInvites.acceptedAt)))
    .limit(1);
  if (!invite) return c.json({ error: "not_found" }, 404);

  const token = createShareToken();
  const tokenHash = hashToken(token);
  await db
    .update(schema.waybookInvites)
    .set({ tokenHash })
    .where(eq(schema.waybookInvites.id, invite.id));

  const acceptUrl = `${new URL(`/invite/${token}`, env.CORS_ORIGIN).toString()}`;
  const inviterName = user.email ?? "A Waybook traveler";
  try {
    await sendInviteEmail({
      to: invite.email,
      inviterName,
      waybookTitle: access.waybook.title,
      acceptUrl,
      role: invite.role === "owner" ? "editor" : invite.role
    });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 503);
  }

  return c.json({ success: true, acceptUrl });
});

waybookRoutes.post("/invites/:token/accept", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const token = c.req.param("token");
  const tokenHash = hashToken(token);

  const [invite] = await db
    .select()
    .from(schema.waybookInvites)
    .where(eq(schema.waybookInvites.tokenHash, tokenHash))
    .limit(1);

  if (!invite) return c.json({ error: "not_found" }, 404);
  if (invite.acceptedAt) return c.json({ error: "already_accepted" }, 409);
  if (invite.expiresAt && invite.expiresAt < new Date()) return c.json({ error: "expired" }, 410);
  if (!user.email || user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return c.json({ error: "email_mismatch" }, 403);
  }

  await db
    .insert(schema.waybookMembers)
    .values({
      waybookId: invite.waybookId,
      userId: user.id,
      role: invite.role,
      invitedBy: invite.invitedBy
    })
    .onConflictDoUpdate({
      target: [schema.waybookMembers.waybookId, schema.waybookMembers.userId],
      set: { role: invite.role, invitedBy: invite.invitedBy }
    });

  await db
    .update(schema.waybookInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(schema.waybookInvites.id, invite.id));

  return c.json({ success: true, waybookId: invite.waybookId });
});

waybookRoutes.get("/waybooks/:waybookId/timeline", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

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

  const ratingsByEntry = await getRatingsByEntryIds(db, entryIds, user.id);
  const guidanceByEntry = await getGuidanceByEntryIds(db, entryIds);
  const summariesByDate = await getDaySummariesByWaybook(db, waybookId);

  const entryDtos = entryRows.map((entry) =>
    mapEntry(
      entry,
      mediaByEntry.get(entry.id) ?? [],
      ratingsByEntry.get(entry.id) ?? null,
      guidanceByEntry.get(entry.id) ?? null
    )
  );

  const dayMap = new Map<string, typeof entryDtos>();
  for (const entry of entryDtos) {
    const date = entry.capturedAt.slice(0, 10);
    const group = dayMap.get(date) ?? [];
    group.push(entry);
    dayMap.set(date, group);
  }

  const days = [...dayMap.entries()]
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([date, entries]) => ({ date, entries, summary: summariesByDate.get(date) ?? null }));

  return c.json({ waybook: mapWaybook(access.waybook), accessRole: access.role, days });
});

waybookRoutes.get("/waybooks/:waybookId/day-summaries", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const summaries = await db
    .select()
    .from(schema.waybookDaySummaries)
    .where(eq(schema.waybookDaySummaries.waybookId, waybookId))
    .orderBy(desc(schema.waybookDaySummaries.summaryDate));

  return c.json({ items: summaries.map((row) => mapDaySummary(row)) });
});

waybookRoutes.post(
  "/waybooks/:waybookId/day-summaries",
  requireAuthMiddleware,
  zValidator("json", upsertDaySummaryInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const [summary] = await db
      .insert(schema.waybookDaySummaries)
      .values({
        waybookId,
        summaryDate: payload.summaryDate,
        summaryText: payload.summaryText ?? null,
        topMomentEntryId: payload.topMomentEntryId ?? null,
        moodScore: payload.moodScore ?? null,
        energyScore: payload.energyScore ?? null
      })
      .onConflictDoUpdate({
        target: [schema.waybookDaySummaries.waybookId, schema.waybookDaySummaries.summaryDate],
        set: {
          summaryText: payload.summaryText ?? null,
          topMomentEntryId: payload.topMomentEntryId ?? null,
          moodScore: payload.moodScore ?? null,
          energyScore: payload.energyScore ?? null,
          updatedAt: new Date()
        }
      })
      .returning();

    if (!summary) return c.json({ error: "create_failed" }, 500);
    return c.json(mapDaySummary(summary), 201);
  }
);

const updateDaySummaryInputSchema = upsertDaySummaryInputSchema.omit({ summaryDate: true });

waybookRoutes.patch(
  "/waybooks/:waybookId/day-summaries/:date",
  requireAuthMiddleware,
  zValidator("json", updateDaySummaryInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const date = c.req.param("date");
    const payload = c.req.valid("json");

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const [updated] = await db
      .update(schema.waybookDaySummaries)
      .set({
        summaryText: payload.summaryText ?? null,
        topMomentEntryId: payload.topMomentEntryId ?? null,
        moodScore: payload.moodScore ?? null,
        energyScore: payload.energyScore ?? null,
        updatedAt: new Date()
      })
      .where(and(eq(schema.waybookDaySummaries.waybookId, waybookId), eq(schema.waybookDaySummaries.summaryDate, date)))
      .returning();

    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(mapDaySummary(updated));
  }
);

waybookRoutes.get("/waybooks/:waybookId/itinerary-items", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");

  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

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

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

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
  const db = c.get("db");
  const user = c.get("user");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);
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
  const db = c.get("db");
  const user = c.get("user");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);
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

  const guidanceByEntry = await getGuidanceByEntryIds(db, entryIds);
  const summariesByDate = await getDaySummariesByWaybook(db, waybook.id);

  const entryDtos = entryRows.map((entry) =>
    mapEntry(entry, mediaByEntry.get(entry.id) ?? [], null, guidanceByEntry.get(entry.id) ?? null)
  );

  const dayMap = new Map<string, typeof entryDtos>();
  for (const entry of entryDtos) {
    const date = entry.capturedAt.slice(0, 10);
    const group = dayMap.get(date) ?? [];
    group.push(entry);
    dayMap.set(date, group);
  }

  const days = [...dayMap.entries()]
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([date, entries]) => ({ date, entries, summary: summariesByDate.get(date) ?? null }));

  return c.json({ waybook: mapWaybook(waybook), days });
});

waybookRoutes.get("/public/w/:publicSlug/playbook", optionalAuthMiddleware, async (c) => {
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
  const reactionsRows = entryIds.length
    ? await db
        .select()
        .from(schema.entryReactionsPublic)
        .where(inArray(schema.entryReactionsPublic.entryId, entryIds))
        .orderBy(desc(schema.entryReactionsPublic.createdAt))
    : [];
  const guidanceByEntry = await getGuidanceByEntryIds(db, entryIds);
  const summariesByDate = await getDaySummariesByWaybook(db, waybook.id);

  const mediaByEntry = new Map<string, ReturnType<typeof mapMedia>[]>();
  for (const media of mediaRows) {
    const list = mediaByEntry.get(media.entryId) ?? [];
    list.push(mapMedia(media));
    mediaByEntry.set(media.entryId, list);
  }

  const reactionsByEntry = new Map<string, ReturnType<typeof mapPublicReaction>[]>();
  for (const reaction of reactionsRows) {
    const list = reactionsByEntry.get(reaction.entryId) ?? [];
    list.push(mapPublicReaction(reaction));
    reactionsByEntry.set(reaction.entryId, list);
  }

  const entryDtos = entryRows.map((entry) =>
    mapEntry(entry, mediaByEntry.get(entry.id) ?? [], null, guidanceByEntry.get(entry.id) ?? null)
  );

  const dayMap = new Map<string, { date: string; steps: { entry: ReturnType<typeof mapEntry>; reactions: ReturnType<typeof mapPublicReaction>[]; confidenceScore: number }[]; summary: DaySummaryDTO | null }>();
  for (const entry of entryDtos) {
    const date = entry.capturedAt.slice(0, 10);
    const bucket = dayMap.get(date) ?? { date, steps: [], summary: summariesByDate.get(date) ?? null };
    const reactions = reactionsByEntry.get(entry.id) ?? [];
    const confidenceScore = Math.min(100, 50 + reactions.length * 5 + (entry.guidance?.isMustDo ? 20 : 0));
    bucket.steps.push({ entry, reactions, confidenceScore });
    dayMap.set(date, bucket);
  }

  const days = [...dayMap.values()].sort((a, b) => (a.date > b.date ? -1 : 1));

  return c.json({ waybook: mapWaybook(waybook), days });
});

waybookRoutes.post(
  "/public/entries/:entryId/reactions",
  optionalAuthMiddleware,
  zValidator("json", createPublicReactionInputSchema),
  async (c) => {
    const db = c.get("db");
    const entryId = c.req.param("entryId");
    const payload = c.req.valid("json");
    let sessionUser: { id: string } | null = null;
    try {
      const candidate = c.get("user");
      if (candidate?.id) {
        sessionUser = { id: candidate.id };
      }
    } catch {
      sessionUser = null;
    }
    const fingerprint = c.req.header("x-waybook-fingerprint") ?? null;
    const normalizedNote = payload.note?.trim() ?? null;

    if (normalizedNote) {
      const lower = normalizedNote.toLowerCase();
      if (blockedReactionTerms.some((term) => lower.includes(term))) {
        return c.json({ error: "note_flagged" }, 400);
      }
    }

    const [entry] = await db
      .select({ id: schema.entries.id })
      .from(schema.entries)
      .innerJoin(schema.waybooks, eq(schema.entries.waybookId, schema.waybooks.id))
      .where(and(eq(schema.entries.id, entryId), eq(schema.waybooks.visibility, "public")))
      .limit(1);

    if (!entry) return c.json({ error: "not_found" }, 404);

    await db.insert(schema.entryReactionsPublic).values({
      entryId,
      userId: sessionUser?.id ?? null,
      userFingerprint: fingerprint,
      reactionType: payload.reactionType,
      note: normalizedNote
    });

    return c.json({ success: true }, 201);
  }
);

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

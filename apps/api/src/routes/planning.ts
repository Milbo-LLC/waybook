import { zValidator } from "@hono/zod-validator";
import {
  bookingCheckoutInputSchema,
  bookingDocumentInputSchema,
  bookingManualConfirmInputSchema,
  createBookingInputSchema,
  createEntryItineraryLinkInputSchema,
  createExpenseInputSchema,
  createItineraryEventInputSchema,
  createPlanningCommentInputSchema,
  createPlanningItemInputSchema,
  createPlanningVoteInputSchema,
  createTripTaskInputSchema,
  updateBookingInputSchema,
  updateExpenseInputSchema,
  updateItineraryEventInputSchema,
  updateNotificationRuleInputSchema,
  updatePlanningItemInputSchema,
  updateTripPreferencesInputSchema,
  updateTripTaskInputSchema
} from "@waybook/contracts";
import { schema } from "@waybook/db";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getEntryAccess, getWaybookAccess, hasMinimumRole } from "../lib/access.js";
import { requireAuthMiddleware } from "../middleware/require-auth.js";
import type { AppBindings } from "../types.js";

export const planningRoutes = new Hono<AppBindings>();

const parseNullableDateInput = (value: string | null | undefined): Date | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
};

const voteCountsByItemId = async (db: AppBindings["Variables"]["db"], itemIds: string[]) => {
  if (!itemIds.length) return new Map<string, { up: number; down: number }>();
  const rows = await db.select().from(schema.planningVotes).where(inArray(schema.planningVotes.planningItemId, itemIds));
  const counts = new Map<string, { up: number; down: number }>();
  for (const row of rows) {
    const current = counts.get(row.planningItemId) ?? { up: 0, down: 0 };
    if (row.vote === "down") current.down += 1;
    else current.up += 1;
    counts.set(row.planningItemId, current);
  }
  return counts;
};

const mapPlanningItem = (
  row: typeof schema.planningItems.$inferSelect,
  voteCounts: { up: number; down: number } = { up: 0, down: 0 }
) => ({
  id: row.id,
  waybookId: row.waybookId,
  createdByUserId: row.createdByUserId,
  title: row.title,
  description: row.description,
  category: row.category,
  status: row.status,
  location:
    row.lat !== null && row.lng !== null
      ? {
          lat: row.lat,
          lng: row.lng,
          placeName: row.placeName
        }
      : null,
  estimatedCostMin: row.estimatedCostMin,
  estimatedCostMax: row.estimatedCostMax,
  sourceUrl: row.sourceUrl,
  providerHint: row.providerHint,
  votesUp: voteCounts.up,
  votesDown: voteCounts.down,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

const mapTask = (row: typeof schema.tripTasks.$inferSelect) => ({
  id: row.id,
  waybookId: row.waybookId,
  title: row.title,
  description: row.description,
  assignedUserId: row.assignedUserId,
  dueAt: row.dueAt?.toISOString() ?? null,
  status: row.status,
  priority: row.priority,
  createdByUserId: row.createdByUserId,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

const mapBooking = (row: typeof schema.bookingRecords.$inferSelect) => ({
  id: row.id,
  waybookId: row.waybookId,
  planningItemId: row.planningItemId,
  type: row.type,
  provider: row.provider,
  providerBookingId: row.providerBookingId,
  title: row.title,
  bookedForStart: row.bookedForStart?.toISOString() ?? null,
  bookedForEnd: row.bookedForEnd?.toISOString() ?? null,
  bookingStatus: row.bookingStatus,
  checkoutUrl: row.checkoutUrl,
  confirmationCode: row.confirmationCode,
  bookedByUserId: row.bookedByUserId,
  currency: row.currency,
  totalAmountMinor: row.totalAmountMinor,
  refundPolicyText: row.refundPolicyText,
  cancellationDeadline: row.cancellationDeadline?.toISOString() ?? null,
  rawPayload: row.rawPayload,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

const mapExpense = (row: typeof schema.expenseEntries.$inferSelect, splits: Array<typeof schema.expenseSplits.$inferSelect>) => ({
  id: row.id,
  waybookId: row.waybookId,
  bookingRecordId: row.bookingRecordId,
  title: row.title,
  category: row.category,
  paidByUserId: row.paidByUserId,
  currency: row.currency,
  amountMinor: row.amountMinor,
  tripBaseCurrency: row.tripBaseCurrency,
  tripBaseAmountMinor: row.tripBaseAmountMinor,
  fxRate: row.fxRate,
  incurredAt: row.incurredAt.toISOString(),
  notes: row.notes,
  splitMethod: row.splitMethod,
  status: row.status,
  splits: splits.map((split) => ({
    userId: split.userId,
    amountMinor: split.amountMinor,
    percentage: split.percentage,
    shares: split.shares
  })),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

const mapItineraryEvent = (row: typeof schema.itineraryEvents.$inferSelect) => ({
  id: row.id,
  waybookId: row.waybookId,
  planningItemId: row.planningItemId,
  bookingRecordId: row.bookingRecordId,
  title: row.title,
  startTime: row.startTime.toISOString(),
  endTime: row.endTime?.toISOString() ?? null,
  bufferBeforeMin: row.bufferBeforeMin,
  bufferAfterMin: row.bufferAfterMin,
  ownerUserId: row.ownerUserId,
  notes: row.notes,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

const mapNotificationRule = (row: typeof schema.notificationRules.$inferSelect) => ({
  id: row.id,
  waybookId: row.waybookId,
  userId: row.userId,
  channel: row.channel,
  notificationType: row.notificationType,
  enabled: row.enabled,
  leadTimeMin: row.leadTimeMin,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

const mapNotificationEvent = (row: typeof schema.notificationEvents.$inferSelect) => ({
  id: row.id,
  waybookId: row.waybookId,
  userId: row.userId,
  notificationType: row.notificationType,
  channel: row.channel,
  payload: row.payload,
  scheduledFor: row.scheduledFor.toISOString(),
  sentAt: row.sentAt?.toISOString() ?? null,
  status: row.status,
  error: row.error,
  createdAt: row.createdAt.toISOString()
});

const mapTripPreferences = (row: typeof schema.tripPreferences.$inferSelect) => ({
  waybookId: row.waybookId,
  baseCurrency: row.baseCurrency,
  budgetAmountMinor: row.budgetAmountMinor,
  budgetCurrency: row.budgetCurrency,
  defaultSplitMethod: row.defaultSplitMethod,
  pace: row.pace,
  budgetTier: row.budgetTier,
  accessibilityNotes: row.accessibilityNotes,
  quietHoursStart: row.quietHoursStart,
  quietHoursEnd: row.quietHoursEnd,
  updatedAt: row.updatedAt.toISOString()
});

planningRoutes.post(
  "/waybooks/:waybookId/planning-items",
  requireAuthMiddleware,
  zValidator("json", createPlanningItemInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const [created] = await db
      .insert(schema.planningItems)
      .values({
        waybookId,
        createdByUserId: user.id,
        title: payload.title,
        description: payload.description ?? null,
        category: payload.category ?? null,
        status: payload.status ?? "idea",
        lat: payload.location?.lat,
        lng: payload.location?.lng,
        placeName: payload.location?.placeName,
        estimatedCostMin: payload.estimatedCostMin ?? null,
        estimatedCostMax: payload.estimatedCostMax ?? null,
        sourceUrl: payload.sourceUrl ?? null,
        providerHint: payload.providerHint ?? null
      })
      .returning();

    if (!created) return c.json({ error: "create_failed" }, 500);
    return c.json(mapPlanningItem(created), 201);
  }
);

planningRoutes.get("/waybooks/:waybookId/planning-items", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");

  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const items = await db
    .select()
    .from(schema.planningItems)
    .where(eq(schema.planningItems.waybookId, waybookId))
    .orderBy(desc(schema.planningItems.createdAt));
  const votes = await voteCountsByItemId(
    db,
    items.map((item) => item.id)
  );

  return c.json({ items: items.map((item) => mapPlanningItem(item, votes.get(item.id))) });
});

planningRoutes.patch(
  "/planning-items/:itemId",
  requireAuthMiddleware,
  zValidator("json", updatePlanningItemInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const itemId = c.req.param("itemId");
    const payload = c.req.valid("json");

    const [item] = await db.select().from(schema.planningItems).where(eq(schema.planningItems.id, itemId)).limit(1);
    if (!item) return c.json({ error: "not_found" }, 404);

    const access = await getWaybookAccess(db, item.waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const [updated] = await db
      .update(schema.planningItems)
      .set({
        title: payload.title,
        description: payload.description,
        category: payload.category,
        status: payload.status,
        lat: payload.location ? payload.location.lat : undefined,
        lng: payload.location ? payload.location.lng : undefined,
        placeName: payload.location ? payload.location.placeName : undefined,
        estimatedCostMin: payload.estimatedCostMin,
        estimatedCostMax: payload.estimatedCostMax,
        sourceUrl: payload.sourceUrl,
        providerHint: payload.providerHint,
        updatedAt: new Date()
      })
      .where(eq(schema.planningItems.id, itemId))
      .returning();

    if (!updated) return c.json({ error: "not_found" }, 404);
    const votes = await voteCountsByItemId(db, [updated.id]);
    return c.json(mapPlanningItem(updated, votes.get(updated.id)));
  }
);

planningRoutes.delete("/planning-items/:itemId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const itemId = c.req.param("itemId");

  const [item] = await db.select().from(schema.planningItems).where(eq(schema.planningItems.id, itemId)).limit(1);
  if (!item) return c.json({ error: "not_found" }, 404);

  const access = await getWaybookAccess(db, item.waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

  await db.delete(schema.planningItems).where(eq(schema.planningItems.id, itemId));
  return c.json({ success: true });
});

planningRoutes.post(
  "/planning-items/:itemId/votes",
  requireAuthMiddleware,
  zValidator("json", createPlanningVoteInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const itemId = c.req.param("itemId");
    const payload = c.req.valid("json");

    const [item] = await db.select().from(schema.planningItems).where(eq(schema.planningItems.id, itemId)).limit(1);
    if (!item) return c.json({ error: "not_found" }, 404);

    const access = await getWaybookAccess(db, item.waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

    await db
      .insert(schema.planningVotes)
      .values({ planningItemId: itemId, userId: user.id, vote: payload.vote })
      .onConflictDoUpdate({
        target: [schema.planningVotes.planningItemId, schema.planningVotes.userId],
        set: { vote: payload.vote }
      });

    return c.json({ success: true });
  }
);

planningRoutes.post(
  "/planning-items/:itemId/comments",
  requireAuthMiddleware,
  zValidator("json", createPlanningCommentInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const itemId = c.req.param("itemId");
    const payload = c.req.valid("json");

    const [item] = await db.select().from(schema.planningItems).where(eq(schema.planningItems.id, itemId)).limit(1);
    if (!item) return c.json({ error: "not_found" }, 404);

    const access = await getWaybookAccess(db, item.waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

    const [created] = await db
      .insert(schema.planningComments)
      .values({ planningItemId: itemId, userId: user.id, content: payload.content })
      .returning();

    if (!created) return c.json({ error: "create_failed" }, 500);
    return c.json(
      {
        id: created.id,
        planningItemId: created.planningItemId,
        userId: created.userId,
        content: created.content,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString()
      },
      201
    );
  }
);

planningRoutes.get("/planning-items/:itemId/comments", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const itemId = c.req.param("itemId");

  const [item] = await db.select().from(schema.planningItems).where(eq(schema.planningItems.id, itemId)).limit(1);
  if (!item) return c.json({ error: "not_found" }, 404);

  const access = await getWaybookAccess(db, item.waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const comments = await db
    .select()
    .from(schema.planningComments)
    .where(eq(schema.planningComments.planningItemId, itemId))
    .orderBy(asc(schema.planningComments.createdAt));

  return c.json({
    items: comments.map((comment) => ({
      id: comment.id,
      planningItemId: comment.planningItemId,
      userId: comment.userId,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString()
    }))
  });
});

planningRoutes.post(
  "/waybooks/:waybookId/tasks",
  requireAuthMiddleware,
  zValidator("json", createTripTaskInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const [created] = await db
      .insert(schema.tripTasks)
      .values({
        waybookId,
        title: payload.title,
        description: payload.description ?? null,
        assignedUserId: payload.assignedUserId ?? null,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
        status: payload.status ?? "todo",
        priority: payload.priority ?? "medium",
        createdByUserId: user.id
      })
      .returning();

    if (!created) return c.json({ error: "create_failed" }, 500);
    return c.json(mapTask(created), 201);
  }
);

planningRoutes.get("/waybooks/:waybookId/tasks", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const rows = await db
    .select()
    .from(schema.tripTasks)
    .where(eq(schema.tripTasks.waybookId, waybookId))
    .orderBy(asc(schema.tripTasks.status), asc(schema.tripTasks.dueAt));

  return c.json({ items: rows.map(mapTask) });
});

planningRoutes.patch("/tasks/:taskId", requireAuthMiddleware, zValidator("json", updateTripTaskInputSchema), async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const taskId = c.req.param("taskId");
  const payload = c.req.valid("json");

  const [task] = await db.select().from(schema.tripTasks).where(eq(schema.tripTasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: "not_found" }, 404);
  const access = await getWaybookAccess(db, task.waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

  const [updated] = await db
    .update(schema.tripTasks)
    .set({
      title: payload.title,
      description: payload.description,
      assignedUserId: payload.assignedUserId,
      dueAt: parseNullableDateInput(payload.dueAt),
      status: payload.status,
      priority: payload.priority,
      updatedAt: new Date()
    })
    .where(eq(schema.tripTasks.id, taskId))
    .returning();

  if (!updated) return c.json({ error: "not_found" }, 404);
  return c.json(mapTask(updated));
});

planningRoutes.delete("/tasks/:taskId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const taskId = c.req.param("taskId");
  const [task] = await db.select().from(schema.tripTasks).where(eq(schema.tripTasks.id, taskId)).limit(1);
  if (!task) return c.json({ error: "not_found" }, 404);
  const access = await getWaybookAccess(db, task.waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

  await db.delete(schema.tripTasks).where(eq(schema.tripTasks.id, taskId));
  return c.json({ success: true });
});

planningRoutes.post(
  "/waybooks/:waybookId/bookings",
  requireAuthMiddleware,
  zValidator("json", createBookingInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const [created] = await db
      .insert(schema.bookingRecords)
      .values({
        waybookId,
        planningItemId: payload.planningItemId ?? null,
        type: payload.type,
        provider: payload.provider ?? null,
        providerBookingId: payload.providerBookingId ?? null,
        title: payload.title,
        bookedForStart: payload.bookedForStart ? new Date(payload.bookedForStart) : null,
        bookedForEnd: payload.bookedForEnd ? new Date(payload.bookedForEnd) : null,
        bookingStatus: payload.bookingStatus ?? "draft",
        checkoutUrl: payload.checkoutUrl ?? null,
        confirmationCode: payload.confirmationCode ?? null,
        bookedByUserId: payload.bookedByUserId ?? user.id,
        currency: payload.currency ?? null,
        totalAmountMinor: payload.totalAmountMinor ?? null,
        refundPolicyText: payload.refundPolicyText ?? null,
        cancellationDeadline: payload.cancellationDeadline ? new Date(payload.cancellationDeadline) : null,
        rawPayload: payload.rawPayload ?? null
      })
      .returning();

    if (!created) return c.json({ error: "create_failed" }, 500);
    return c.json(mapBooking(created), 201);
  }
);

planningRoutes.get("/waybooks/:waybookId/bookings", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const rows = await db
    .select()
    .from(schema.bookingRecords)
    .where(eq(schema.bookingRecords.waybookId, waybookId))
    .orderBy(desc(schema.bookingRecords.bookedForStart));

  return c.json({ items: rows.map(mapBooking) });
});

planningRoutes.get("/bookings/:bookingId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const bookingId = c.req.param("bookingId");

  const [booking] = await db.select().from(schema.bookingRecords).where(eq(schema.bookingRecords.id, bookingId)).limit(1);
  if (!booking) return c.json({ error: "not_found" }, 404);

  const access = await getWaybookAccess(db, booking.waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);
  return c.json(mapBooking(booking));
});

planningRoutes.patch("/bookings/:bookingId", requireAuthMiddleware, zValidator("json", updateBookingInputSchema), async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const bookingId = c.req.param("bookingId");
  const payload = c.req.valid("json");

  const [booking] = await db.select().from(schema.bookingRecords).where(eq(schema.bookingRecords.id, bookingId)).limit(1);
  if (!booking) return c.json({ error: "not_found" }, 404);

  const access = await getWaybookAccess(db, booking.waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

  const [updated] = await db
    .update(schema.bookingRecords)
    .set({
      planningItemId: payload.planningItemId,
      type: payload.type,
      provider: payload.provider,
      providerBookingId: payload.providerBookingId,
      title: payload.title,
      bookedForStart: parseNullableDateInput(payload.bookedForStart),
      bookedForEnd: parseNullableDateInput(payload.bookedForEnd),
      bookingStatus: payload.bookingStatus,
      checkoutUrl: payload.checkoutUrl,
      confirmationCode: payload.confirmationCode,
      bookedByUserId: payload.bookedByUserId,
      currency: payload.currency,
      totalAmountMinor: payload.totalAmountMinor,
      refundPolicyText: payload.refundPolicyText,
      cancellationDeadline: parseNullableDateInput(payload.cancellationDeadline),
      rawPayload: payload.rawPayload,
      updatedAt: new Date()
    })
    .where(eq(schema.bookingRecords.id, bookingId))
    .returning();

  if (!updated) return c.json({ error: "not_found" }, 404);
  return c.json(mapBooking(updated));
});

planningRoutes.post(
  "/bookings/:bookingId/checkout-link",
  requireAuthMiddleware,
  zValidator("json", bookingCheckoutInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const bookingId = c.req.param("bookingId");
    const payload = c.req.valid("json");

    const [booking] = await db.select().from(schema.bookingRecords).where(eq(schema.bookingRecords.id, bookingId)).limit(1);
    if (!booking) return c.json({ error: "not_found" }, 404);

    const access = await getWaybookAccess(db, booking.waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const [updated] = await db
      .update(schema.bookingRecords)
      .set({
        checkoutUrl: payload.checkoutUrl,
        providerBookingId: payload.providerBookingId ?? booking.providerBookingId,
        bookingStatus: "pending_checkout",
        updatedAt: new Date()
      })
      .where(eq(schema.bookingRecords.id, bookingId))
      .returning();

    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(mapBooking(updated));
  }
);

planningRoutes.post(
  "/bookings/:bookingId/confirm-manual",
  requireAuthMiddleware,
  zValidator("json", bookingManualConfirmInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const bookingId = c.req.param("bookingId");
    const payload = c.req.valid("json");

    const [booking] = await db.select().from(schema.bookingRecords).where(eq(schema.bookingRecords.id, bookingId)).limit(1);
    if (!booking) return c.json({ error: "not_found" }, 404);

    const access = await getWaybookAccess(db, booking.waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const [updated] = await db
      .update(schema.bookingRecords)
      .set({
        confirmationCode: payload.confirmationCode,
        bookingStatus: "confirmed",
        rawPayload: payload.notes ? { notes: payload.notes } : booking.rawPayload,
        updatedAt: new Date()
      })
      .where(eq(schema.bookingRecords.id, bookingId))
      .returning();

    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(mapBooking(updated));
  }
);

planningRoutes.post("/bookings/provider/webhook/:provider", zValidator("json", z.object({
  providerBookingId: z.string().min(1),
  bookingStatus: z.enum(["pending_checkout", "confirmed", "cancelled", "failed", "refunded"]),
  payload: z.unknown().optional()
})), async (c) => {
  const db = c.get("db");
  const provider = c.req.param("provider");
  const payload = c.req.valid("json");

  const [updated] = await db
    .update(schema.bookingRecords)
    .set({ bookingStatus: payload.bookingStatus, rawPayload: payload.payload ?? null, updatedAt: new Date() })
    .where(and(eq(schema.bookingRecords.provider, provider), eq(schema.bookingRecords.providerBookingId, payload.providerBookingId)))
    .returning({ id: schema.bookingRecords.id });

  return c.json({ success: true, updated: Boolean(updated) });
});

planningRoutes.post(
  "/bookings/:bookingId/documents",
  requireAuthMiddleware,
  zValidator("json", bookingDocumentInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const bookingId = c.req.param("bookingId");
    const payload = c.req.valid("json");

    const [booking] = await db.select().from(schema.bookingRecords).where(eq(schema.bookingRecords.id, bookingId)).limit(1);
    if (!booking) return c.json({ error: "not_found" }, 404);

    const access = await getWaybookAccess(db, booking.waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const [media] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, payload.mediaAssetId)).limit(1);
    if (!media) return c.json({ error: "media_not_found" }, 404);

    await db.insert(schema.bookingDocuments).values({
      bookingRecordId: bookingId,
      mediaAssetId: payload.mediaAssetId,
      label: payload.label ?? null
    });

    return c.json({ success: true });
  }
);

planningRoutes.post(
  "/waybooks/:waybookId/expenses",
  requireAuthMiddleware,
  zValidator("json", createExpenseInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const [prefs] = await db.select().from(schema.tripPreferences).where(eq(schema.tripPreferences.waybookId, waybookId)).limit(1);
    const splitMethod = payload.splitMethod ?? prefs?.defaultSplitMethod ?? "equal";

    const [created] = await db
      .insert(schema.expenseEntries)
      .values({
        waybookId,
        bookingRecordId: payload.bookingRecordId ?? null,
        title: payload.title,
        category: payload.category ?? null,
        paidByUserId: payload.paidByUserId,
        currency: payload.currency,
        amountMinor: payload.amountMinor,
        tripBaseCurrency: payload.tripBaseCurrency,
        tripBaseAmountMinor: payload.tripBaseAmountMinor,
        fxRate: payload.fxRate ?? null,
        incurredAt: new Date(payload.incurredAt),
        notes: payload.notes ?? null,
        splitMethod,
        status: payload.status ?? "logged"
      })
      .returning();

    if (!created) return c.json({ error: "create_failed" }, 500);

    if (payload.splits.length > 0) {
      await db.insert(schema.expenseSplits).values(
        payload.splits.map((split) => ({
          expenseEntryId: created.id,
          userId: split.userId,
          amountMinor: split.amountMinor ?? null,
          percentage: split.percentage ?? null,
          shares: split.shares ?? null
        }))
      );
    }

    const splits = await db.select().from(schema.expenseSplits).where(eq(schema.expenseSplits.expenseEntryId, created.id));
    return c.json(mapExpense(created, splits), 201);
  }
);

planningRoutes.get("/waybooks/:waybookId/expenses", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");

  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const rows = await db
    .select()
    .from(schema.expenseEntries)
    .where(eq(schema.expenseEntries.waybookId, waybookId))
    .orderBy(desc(schema.expenseEntries.incurredAt));

  const splits = rows.length
    ? await db.select().from(schema.expenseSplits).where(inArray(schema.expenseSplits.expenseEntryId, rows.map((row) => row.id)))
    : [];

  const splitsByExpenseId = new Map<string, Array<typeof schema.expenseSplits.$inferSelect>>();
  for (const split of splits) {
    const list = splitsByExpenseId.get(split.expenseEntryId) ?? [];
    list.push(split);
    splitsByExpenseId.set(split.expenseEntryId, list);
  }

  return c.json({ items: rows.map((row) => mapExpense(row, splitsByExpenseId.get(row.id) ?? [])) });
});

planningRoutes.patch("/expenses/:expenseId", requireAuthMiddleware, zValidator("json", updateExpenseInputSchema), async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const expenseId = c.req.param("expenseId");
  const payload = c.req.valid("json");

  const [expense] = await db.select().from(schema.expenseEntries).where(eq(schema.expenseEntries.id, expenseId)).limit(1);
  if (!expense) return c.json({ error: "not_found" }, 404);

  const access = await getWaybookAccess(db, expense.waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

  const [updated] = await db
    .update(schema.expenseEntries)
    .set({
      bookingRecordId: payload.bookingRecordId,
      title: payload.title,
      category: payload.category,
      paidByUserId: payload.paidByUserId,
      currency: payload.currency,
      amountMinor: payload.amountMinor,
      tripBaseCurrency: payload.tripBaseCurrency,
      tripBaseAmountMinor: payload.tripBaseAmountMinor,
      fxRate: payload.fxRate,
      incurredAt: payload.incurredAt ? new Date(payload.incurredAt) : undefined,
      notes: payload.notes,
      splitMethod: payload.splitMethod,
      status: payload.status,
      updatedAt: new Date()
    })
    .where(eq(schema.expenseEntries.id, expenseId))
    .returning();

  if (!updated) return c.json({ error: "not_found" }, 404);

  if (payload.splits) {
    await db.delete(schema.expenseSplits).where(eq(schema.expenseSplits.expenseEntryId, expenseId));
    if (payload.splits.length) {
      await db.insert(schema.expenseSplits).values(
        payload.splits.map((split) => ({
          expenseEntryId: expenseId,
          userId: split.userId,
          amountMinor: split.amountMinor ?? null,
          percentage: split.percentage ?? null,
          shares: split.shares ?? null
        }))
      );
    }
  }

  const splits = await db.select().from(schema.expenseSplits).where(eq(schema.expenseSplits.expenseEntryId, expenseId));
  return c.json(mapExpense(updated, splits));
});

planningRoutes.delete("/expenses/:expenseId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const expenseId = c.req.param("expenseId");

  const [expense] = await db.select().from(schema.expenseEntries).where(eq(schema.expenseEntries.id, expenseId)).limit(1);
  if (!expense) return c.json({ error: "not_found" }, 404);

  const access = await getWaybookAccess(db, expense.waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

  await db.delete(schema.expenseEntries).where(eq(schema.expenseEntries.id, expenseId));
  return c.json({ success: true });
});

planningRoutes.get("/waybooks/:waybookId/settlements", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");

  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const [prefs] = await db.select().from(schema.tripPreferences).where(eq(schema.tripPreferences.waybookId, waybookId)).limit(1);
  const currency = prefs?.baseCurrency ?? "USD";

  const expenses = await db.select().from(schema.expenseEntries).where(eq(schema.expenseEntries.waybookId, waybookId));
  const splits = expenses.length
    ? await db.select().from(schema.expenseSplits).where(inArray(schema.expenseSplits.expenseEntryId, expenses.map((e) => e.id)))
    : [];

  const ownerId = access.waybook.userId;
  const members = await db
    .select({ userId: schema.waybookMembers.userId })
    .from(schema.waybookMembers)
    .where(eq(schema.waybookMembers.waybookId, waybookId));
  const participants = new Set([ownerId, ...members.map((m) => m.userId)]);

  const splitsByExpense = new Map<string, Array<typeof schema.expenseSplits.$inferSelect>>();
  for (const split of splits) {
    const arr = splitsByExpense.get(split.expenseEntryId) ?? [];
    arr.push(split);
    splitsByExpense.set(split.expenseEntryId, arr);
  }

  const net = new Map<string, number>();
  for (const userId of participants) net.set(userId, 0);

  for (const expense of expenses) {
    const amount = expense.tripBaseAmountMinor;
    net.set(expense.paidByUserId, (net.get(expense.paidByUserId) ?? 0) + amount);

    const manualSplits = splitsByExpense.get(expense.id) ?? [];
    if (manualSplits.length) {
      const totalShares = manualSplits.reduce((sum, s) => sum + (s.shares ?? 0), 0);
      for (const split of manualSplits) {
        let owed = split.amountMinor ?? 0;
        if (split.percentage !== null) owed = Math.round((amount * split.percentage) / 100);
        if (split.amountMinor === null && split.percentage === null && split.shares !== null && totalShares > 0) {
          owed = Math.round((amount * split.shares) / totalShares);
        }
        net.set(split.userId, (net.get(split.userId) ?? 0) - owed);
      }
    } else {
      const users = [...participants];
      const share = Math.round(amount / Math.max(users.length, 1));
      for (const userId of users) {
        net.set(userId, (net.get(userId) ?? 0) - share);
      }
    }
  }

  const creditors = [...net.entries()].filter(([, value]) => value > 0).map(([userId, value]) => ({ userId, value }));
  const debtors = [...net.entries()].filter(([, value]) => value < 0).map(([userId, value]) => ({ userId, value: -value }));

  creditors.sort((a, b) => b.value - a.value);
  debtors.sort((a, b) => b.value - a.value);

  const items: Array<{ fromUserId: string; toUserId: string; amountMinor: number; currency: string }> = [];
  let cIndex = 0;
  let dIndex = 0;

  while (cIndex < creditors.length && dIndex < debtors.length) {
    const creditor = creditors[cIndex];
    const debtor = debtors[dIndex];
    if (!creditor || !debtor) break;
    const transfer = Math.min(creditor.value, debtor.value);
    if (transfer > 0) {
      items.push({ fromUserId: debtor.userId, toUserId: creditor.userId, amountMinor: transfer, currency });
    }
    creditor.value -= transfer;
    debtor.value -= transfer;
    if (creditor.value <= 0) cIndex += 1;
    if (debtor.value <= 0) dIndex += 1;
  }

  return c.json({ currency, items });
});

planningRoutes.get("/waybooks/:waybookId/budget-summary", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");

  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const rows = await db.select().from(schema.expenseEntries).where(eq(schema.expenseEntries.waybookId, waybookId));
  const [prefs] = await db.select().from(schema.tripPreferences).where(eq(schema.tripPreferences.waybookId, waybookId)).limit(1);

  const byCategory = new Map<string, number>();
  let totalBaseAmountMinor = 0;
  let currency = prefs?.baseCurrency ?? "USD";
  for (const row of rows) {
    totalBaseAmountMinor += row.tripBaseAmountMinor;
    currency = row.tripBaseCurrency;
    const category = row.category ?? "uncategorized";
    byCategory.set(category, (byCategory.get(category) ?? 0) + row.tripBaseAmountMinor);
  }

  const budgetAmountMinor = prefs?.budgetAmountMinor ?? null;

  return c.json({
    totalBaseAmountMinor,
    currency,
    budgetAmountMinor,
    budgetCurrency: prefs?.budgetCurrency ?? currency,
    remainingAmountMinor: budgetAmountMinor !== null ? budgetAmountMinor - totalBaseAmountMinor : null,
    byCategory: [...byCategory.entries()].map(([category, amountMinor]) => ({ category, amountMinor }))
  });
});

planningRoutes.get("/waybooks/:waybookId/preferences", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");

  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const [existing] = await db.select().from(schema.tripPreferences).where(eq(schema.tripPreferences.waybookId, waybookId)).limit(1);
  if (existing) return c.json(mapTripPreferences(existing));

  const [created] = await db
    .insert(schema.tripPreferences)
    .values({ waybookId, baseCurrency: "USD", budgetCurrency: "USD", defaultSplitMethod: "equal" })
    .returning();

  if (!created) return c.json({ error: "create_failed" }, 500);
  return c.json(mapTripPreferences(created));
});

planningRoutes.patch(
  "/waybooks/:waybookId/preferences",
  requireAuthMiddleware,
  zValidator("json", updateTripPreferencesInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    await db
      .insert(schema.tripPreferences)
      .values({
        waybookId,
        baseCurrency: payload.baseCurrency ?? "USD",
        budgetAmountMinor: payload.budgetAmountMinor ?? null,
        budgetCurrency: payload.budgetCurrency ?? payload.baseCurrency ?? "USD",
        defaultSplitMethod: payload.defaultSplitMethod ?? "equal",
        pace: payload.pace ?? null,
        budgetTier: payload.budgetTier ?? null,
        accessibilityNotes: payload.accessibilityNotes ?? null,
        quietHoursStart: payload.quietHoursStart ?? null,
        quietHoursEnd: payload.quietHoursEnd ?? null
      })
      .onConflictDoNothing();

    const updates: Partial<typeof schema.tripPreferences.$inferInsert> = { updatedAt: new Date() };
    if (payload.baseCurrency !== undefined) updates.baseCurrency = payload.baseCurrency;
    if (payload.budgetAmountMinor !== undefined) updates.budgetAmountMinor = payload.budgetAmountMinor;
    if (payload.budgetCurrency !== undefined) updates.budgetCurrency = payload.budgetCurrency;
    if (payload.defaultSplitMethod !== undefined) updates.defaultSplitMethod = payload.defaultSplitMethod;
    if (payload.pace !== undefined) updates.pace = payload.pace;
    if (payload.budgetTier !== undefined) updates.budgetTier = payload.budgetTier;
    if (payload.accessibilityNotes !== undefined) updates.accessibilityNotes = payload.accessibilityNotes;
    if (payload.quietHoursStart !== undefined) updates.quietHoursStart = payload.quietHoursStart;
    if (payload.quietHoursEnd !== undefined) updates.quietHoursEnd = payload.quietHoursEnd;

    const [updated] = await db
      .update(schema.tripPreferences)
      .set(updates)
      .where(eq(schema.tripPreferences.waybookId, waybookId))
      .returning();

    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(mapTripPreferences(updated));
  }
);

planningRoutes.post(
  "/entries/:entryId/itinerary-links",
  requireAuthMiddleware,
  zValidator("json", createEntryItineraryLinkInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const entryId = c.req.param("entryId");
    const payload = c.req.valid("json");

    const access = await getEntryAccess(db, entryId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const [event] = await db
      .select()
      .from(schema.itineraryEvents)
      .where(and(eq(schema.itineraryEvents.id, payload.itineraryEventId), eq(schema.itineraryEvents.waybookId, access.entry.waybookId)))
      .limit(1);
    if (!event) return c.json({ error: "event_not_found" }, 404);

    await db
      .insert(schema.entryItineraryLinks)
      .values({ entryId, itineraryEventId: payload.itineraryEventId })
      .onConflictDoNothing();

    return c.json({ success: true });
  }
);

planningRoutes.delete("/entries/:entryId/itinerary-links/:linkId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const entryId = c.req.param("entryId");
  const linkId = c.req.param("linkId");

  const access = await getEntryAccess(db, entryId, user.id);
  if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

  await db
    .delete(schema.entryItineraryLinks)
    .where(and(eq(schema.entryItineraryLinks.id, linkId), eq(schema.entryItineraryLinks.entryId, entryId)));

  return c.json({ success: true });
});

planningRoutes.get("/waybooks/:waybookId/itinerary-events", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");

  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const rows = await db
    .select()
    .from(schema.itineraryEvents)
    .where(eq(schema.itineraryEvents.waybookId, waybookId))
    .orderBy(asc(schema.itineraryEvents.startTime));

  return c.json({ items: rows.map(mapItineraryEvent) });
});

planningRoutes.post(
  "/waybooks/:waybookId/itinerary-events",
  requireAuthMiddleware,
  zValidator("json", createItineraryEventInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const [created] = await db
      .insert(schema.itineraryEvents)
      .values({
        waybookId,
        planningItemId: payload.planningItemId ?? null,
        bookingRecordId: payload.bookingRecordId ?? null,
        title: payload.title,
        startTime: new Date(payload.startTime),
        endTime: payload.endTime ? new Date(payload.endTime) : null,
        bufferBeforeMin: payload.bufferBeforeMin ?? null,
        bufferAfterMin: payload.bufferAfterMin ?? null,
        ownerUserId: payload.ownerUserId ?? null,
        notes: payload.notes ?? null
      })
      .returning();

    if (!created) return c.json({ error: "create_failed" }, 500);
    return c.json(mapItineraryEvent(created), 201);
  }
);

planningRoutes.patch(
  "/itinerary-events/:eventId",
  requireAuthMiddleware,
  zValidator("json", updateItineraryEventInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const eventId = c.req.param("eventId");
    const payload = c.req.valid("json");

    const [event] = await db.select().from(schema.itineraryEvents).where(eq(schema.itineraryEvents.id, eventId)).limit(1);
    if (!event) return c.json({ error: "not_found" }, 404);

    const access = await getWaybookAccess(db, event.waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const [updated] = await db
      .update(schema.itineraryEvents)
      .set({
        planningItemId: payload.planningItemId,
        bookingRecordId: payload.bookingRecordId,
        title: payload.title,
        startTime: payload.startTime ? new Date(payload.startTime) : undefined,
        endTime: parseNullableDateInput(payload.endTime),
        bufferBeforeMin: payload.bufferBeforeMin,
        bufferAfterMin: payload.bufferAfterMin,
        ownerUserId: payload.ownerUserId,
        notes: payload.notes,
        updatedAt: new Date()
      })
      .where(eq(schema.itineraryEvents.id, eventId))
      .returning();

    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json(mapItineraryEvent(updated));
  }
);

planningRoutes.delete("/itinerary-events/:eventId", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const eventId = c.req.param("eventId");

  const [event] = await db.select().from(schema.itineraryEvents).where(eq(schema.itineraryEvents.id, eventId)).limit(1);
  if (!event) return c.json({ error: "not_found" }, 404);

  const access = await getWaybookAccess(db, event.waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

  await db.delete(schema.itineraryEvents).where(eq(schema.itineraryEvents.id, eventId));
  return c.json({ success: true });
});

planningRoutes.get("/waybooks/:waybookId/notification-rules", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");

  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const rows = await db
    .select()
    .from(schema.notificationRules)
    .where(and(eq(schema.notificationRules.waybookId, waybookId), eq(schema.notificationRules.userId, user.id)))
    .orderBy(asc(schema.notificationRules.notificationType), asc(schema.notificationRules.channel));

  return c.json({ items: rows.map(mapNotificationRule) });
});

planningRoutes.patch(
  "/waybooks/:waybookId/notification-rules",
  requireAuthMiddleware,
  zValidator("json", updateNotificationRuleInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

    for (const rule of payload.rules) {
      await db
        .insert(schema.notificationRules)
        .values({
          waybookId,
          userId: user.id,
          channel: rule.channel,
          notificationType: rule.notificationType,
          enabled: rule.enabled,
          leadTimeMin: rule.leadTimeMin ?? null
        })
        .onConflictDoUpdate({
          target: [
            schema.notificationRules.waybookId,
            schema.notificationRules.userId,
            schema.notificationRules.channel,
            schema.notificationRules.notificationType
          ],
          set: {
            enabled: rule.enabled,
            leadTimeMin: rule.leadTimeMin ?? null,
            updatedAt: new Date()
          }
        });
    }

    const rows = await db
      .select()
      .from(schema.notificationRules)
      .where(and(eq(schema.notificationRules.waybookId, waybookId), eq(schema.notificationRules.userId, user.id)))
      .orderBy(asc(schema.notificationRules.notificationType), asc(schema.notificationRules.channel));

    return c.json({ items: rows.map(mapNotificationRule) });
  }
);

planningRoutes.get("/me/notifications", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  const rows = await db
    .select()
    .from(schema.notificationEvents)
    .where(and(eq(schema.notificationEvents.userId, user.id), isNull(schema.notificationEvents.sentAt)))
    .orderBy(asc(schema.notificationEvents.scheduledFor))
    .limit(100);

  return c.json({ items: rows.map(mapNotificationEvent) });
});

planningRoutes.post("/me/notifications/:id/ack", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const id = c.req.param("id");

  await db
    .update(schema.notificationEvents)
    .set({ sentAt: new Date(), status: "acked" })
    .where(and(eq(schema.notificationEvents.id, id), eq(schema.notificationEvents.userId, user.id)));

  return c.json({ success: true });
});

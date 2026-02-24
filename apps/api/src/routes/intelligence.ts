import { zValidator } from "@hono/zod-validator";
import {
  assistantMessageDtoSchema,
  assistantSessionDtoSchema,
  assistantSessionResponseSchema,
  assistantTripDraftSchema,
  createAssistantMessageInputSchema,
  createAssistantSessionInputSchema,
  createDecisionRoundInputSchema,
  decisionRoundDtoSchema,
  generateScenariosInputSchema,
  listDecisionRoundsResponseSchema,
  listScenariosResponseSchema,
  lockScenarioInputSchema,
  productEventTypeSchema,
  replayBlueprintDtoSchema,
  scenarioDtoSchema,
  trackProductEventInputSchema,
  tripDigestDtoSchema
} from "@waybook/contracts";
import { schema } from "@waybook/db";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { getWaybookAccess, hasMinimumRole } from "../lib/access.js";
import { requireAuthMiddleware } from "../middleware/require-auth.js";
import type { AppBindings } from "../types.js";

export const intelligenceRoutes = new Hono<AppBindings>();

const monthByName: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12
};

const scenarioTypeConfig = {
  balanced: {
    title: "Balanced Plan",
    description: "Balanced options across cost, logistics, and standout experiences."
  },
  budget: {
    title: "Budget-First Plan",
    description: "Low-cost options prioritized without losing trip momentum."
  },
  adventure: {
    title: "Adventure Plan",
    description: "High-energy activities and ambitious pacing."
  }
} as const;

type AssistantDraft = z.infer<typeof assistantTripDraftSchema>;

const defaultDraft = (): AssistantDraft => ({
  title: null,
  description: null,
  startDate: null,
  endDate: null,
  timeframeLabel: null,
  earliestStartDate: null,
  latestEndDate: null,
  budgetAmountMinor: null,
  budgetCurrency: null,
  splitMethod: null
});

const mergeDraft = (
  current: AssistantDraft,
  patch: Partial<AssistantDraft>
): AssistantDraft => {
  return {
    ...current,
    ...patch
  };
};

const parseDraft = (value: unknown) => {
  const parsed = assistantTripDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultDraft();
};

const extractDraftPatch = (content: string): Partial<AssistantDraft> => {
  const lower = content.toLowerCase();
  const patch: Partial<ReturnType<typeof defaultDraft>> = {};

  const budgetMatch = content.match(/\$?\s?(\d[\d,]*(?:\.\d{1,2})?)/);
  if (budgetMatch) {
    const amount = Number(budgetMatch[1]?.replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) {
      patch.budgetAmountMinor = Math.round(amount * 100);
      patch.budgetCurrency = "USD";
    }
  }

  if (lower.includes("equal split")) patch.splitMethod = "equal";
  if (lower.includes("custom split")) patch.splitMethod = "custom";
  if (lower.includes("percentage split")) patch.splitMethod = "percentage";
  if (lower.includes("share split") || lower.includes("shares split")) patch.splitMethod = "shares";

  const monthMatch = lower.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/
  );
  if (monthMatch?.[1]) {
    const monthIndex = monthByName[monthMatch[1]] ?? new Date().getUTCMonth() + 1;
    const now = new Date();
    const year = now.getUTCMonth() + 1 > monthIndex ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
    patch.timeframeLabel = `${monthMatch[1][0]?.toUpperCase()}${monthMatch[1].slice(1)} ${year}`;
  }

  const titleMatch = content.match(/^([^.!\n]{3,80})/);
  if (titleMatch?.[1]) {
    const raw = titleMatch[1].trim();
    if (raw.length >= 3) patch.title = raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  if (!patch.description) {
    patch.description = content.trim().length > 5 ? content.trim().slice(0, 5000) : null;
  }

  return patch;
};

const mapAssistantSession = (row: typeof schema.assistantSessions.$inferSelect) =>
  assistantSessionDtoSchema.parse({
    id: row.id,
    waybookId: row.waybookId,
    userId: row.userId,
    status: row.status === "closed" ? "closed" : "active",
    objective: row.objective,
    draft: parseDraft(row.draftJson),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  });

const mapAssistantMessage = (row: typeof schema.assistantMessages.$inferSelect) =>
  assistantMessageDtoSchema.parse({
    id: row.id,
    sessionId: row.sessionId,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    metadata: row.metadata ?? null,
    createdAt: row.createdAt.toISOString()
  });

const stageSuggestionMap: Record<string, string[]> = {
  destinations: [
    "Lock at least one destination to unblock activity planning.",
    "Use budget and pace constraints before voting."
  ],
  activities: [
    "Lock three activities that fit your budget and trip pace.",
    "Balance one anchor activity with two flexible options."
  ],
  booking: [
    "Confirm one stay and one activity to unlock itinerary generation.",
    "Track cancellation windows for each confirmed booking."
  ],
  itinerary: [
    "Generate itinerary options, then pin must-keep blocks.",
    "Add travel buffers around high-risk transitions."
  ],
  prep: [
    "Finish critical checklist items first.",
    "Assign each open prep task to one owner."
  ],
  capture: [
    "Log one summary and one media artifact per day.",
    "Capture what to repeat vs skip while details are fresh."
  ],
  replay: [
    "Publish replay highlights with practical lessons.",
    "Create a reusable trip template for the next run."
  ]
};

const getSuggestionsForWaybook = async (
  db: AppBindings["Variables"]["db"],
  waybookId: string
): Promise<string[]> => {
  const [stageRow] = await db.select().from(schema.tripStageState).where(eq(schema.tripStageState.waybookId, waybookId)).limit(1);
  const stage = stageRow?.currentStage ?? "destinations";
  return stageSuggestionMap[stage] ?? stageSuggestionMap.destinations ?? [];
};

const buildAssistantReplyText = (
  suggestions: string[],
  draftPatch: Partial<AssistantDraft>
) => {
  const collected: string[] = [];
  if (draftPatch.title) collected.push(`Title set to "${draftPatch.title}".`);
  if (draftPatch.timeframeLabel) collected.push(`Timeframe noted as ${draftPatch.timeframeLabel}.`);
  if (draftPatch.budgetAmountMinor) {
    collected.push(`Budget captured at ${(draftPatch.budgetAmountMinor / 100).toFixed(2)} ${draftPatch.budgetCurrency ?? "USD"}.`);
  }
  if (draftPatch.splitMethod) collected.push(`Split preference recorded: ${draftPatch.splitMethod}.`);

  const summary = collected.length ? collected.join(" ") : "I captured your latest planning context.";
  return `${summary} Next best actions: ${suggestions.join(" ")}`;
};

const getScenarioRows = async (db: AppBindings["Variables"]["db"], waybookId: string) => {
  const scenarioRows = await db
    .select()
    .from(schema.tripScenarios)
    .where(eq(schema.tripScenarios.waybookId, waybookId))
    .orderBy(asc(schema.tripScenarios.scenarioType));

  const scenarioIds = scenarioRows.map((row) => row.id);
  const itemRows = scenarioIds.length
    ? await db
        .select()
        .from(schema.tripScenarioItems)
        .where(inArray(schema.tripScenarioItems.scenarioId, scenarioIds))
        .orderBy(asc(schema.tripScenarioItems.orderIndex))
    : [];
  const itemsByScenario = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const bucket = itemsByScenario.get(item.scenarioId) ?? [];
    bucket.push(item);
    itemsByScenario.set(item.scenarioId, bucket);
  }

  return listScenariosResponseSchema.parse({
    items: scenarioRows.map((row) =>
      scenarioDtoSchema.parse({
        id: row.id,
        waybookId: row.waybookId,
        scenarioType:
          row.scenarioType === "budget" || row.scenarioType === "adventure" ? row.scenarioType : "balanced",
        title: row.title,
        description: row.description,
        createdAt: row.createdAt.toISOString(),
        items: (itemsByScenario.get(row.id) ?? []).map((item) => ({
          id: item.id,
          scenarioId: item.scenarioId,
          itemType:
            item.itemType === "activity" || item.itemType === "booking" || item.itemType === "prep"
              ? item.itemType
              : "destination",
          sourceId: item.sourceId,
          label: item.label,
          details: item.details,
          score: item.score,
          orderIndex: item.orderIndex,
          isLocked: item.isLocked,
          createdAt: item.createdAt.toISOString()
        }))
      })
    )
  });
};

intelligenceRoutes.post(
  "/events",
  requireAuthMiddleware,
  zValidator("json", trackProductEventInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const payload = c.req.valid("json");

    productEventTypeSchema.parse(payload.eventType);
    await db.insert(schema.productEvents).values({
      userId: user.id,
      waybookId: payload.waybookId ?? null,
      eventType: payload.eventType,
      metadata: payload.metadata ?? null
    });

    return c.json({ success: true }, 201);
  }
);

intelligenceRoutes.post(
  "/waybooks/:waybookId/assistant/session",
  requireAuthMiddleware,
  zValidator("json", createAssistantSessionInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

    const initialPatch = payload.message ? extractDraftPatch(payload.message) : {};
    const [createdSession] = await db
      .insert(schema.assistantSessions)
      .values({
        waybookId,
        userId: user.id,
        status: "active",
        objective: payload.objective ?? null,
        draftJson: mergeDraft(defaultDraft(), initialPatch),
        updatedAt: new Date()
      })
      .returning();

    if (!createdSession) return c.json({ error: "create_failed" }, 500);

    const insertedMessages: Array<typeof schema.assistantMessages.$inferSelect> = [];
    if (payload.message) {
      const [userMessage] = await db
        .insert(schema.assistantMessages)
        .values({
          sessionId: createdSession.id,
          role: "user",
          content: payload.message
        })
        .returning();
      if (userMessage) insertedMessages.push(userMessage);

      const suggestions = await getSuggestionsForWaybook(db, waybookId);
      const assistantReply = buildAssistantReplyText(suggestions, initialPatch);
      const [assistantMessage] = await db
        .insert(schema.assistantMessages)
        .values({
          sessionId: createdSession.id,
          role: "assistant",
          content: assistantReply,
          metadata: {
            suggestions
          }
        })
        .returning();
      if (assistantMessage) insertedMessages.push(assistantMessage);
    }

    const suggestions = await getSuggestionsForWaybook(db, waybookId);
    return c.json(
      assistantSessionResponseSchema.parse({
        session: mapAssistantSession(createdSession),
        messages: insertedMessages.map(mapAssistantMessage),
        suggestions
      }),
      201
    );
  }
);

intelligenceRoutes.post(
  "/assistant/sessions/:sessionId/messages",
  requireAuthMiddleware,
  zValidator("json", createAssistantMessageInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const sessionId = c.req.param("sessionId");
    const payload = c.req.valid("json");

    const [session] = await db.select().from(schema.assistantSessions).where(eq(schema.assistantSessions.id, sessionId)).limit(1);
    if (!session) return c.json({ error: "not_found" }, 404);
    const access = await getWaybookAccess(db, session.waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

    const [userMessage] = await db
      .insert(schema.assistantMessages)
      .values({
        sessionId,
        role: "user",
        content: payload.content,
        metadata: payload.stageHint ? { stageHint: payload.stageHint } : null
      })
      .returning();
    if (!userMessage) return c.json({ error: "create_failed" }, 500);

    const patch = extractDraftPatch(payload.content);
    const nextDraft = mergeDraft(parseDraft(session.draftJson), patch);
    await db
      .update(schema.assistantSessions)
      .set({
        draftJson: nextDraft,
        updatedAt: new Date()
      })
      .where(eq(schema.assistantSessions.id, sessionId));

    const suggestions = await getSuggestionsForWaybook(db, session.waybookId);
    const [assistantMessage] = await db
      .insert(schema.assistantMessages)
      .values({
        sessionId,
        role: "assistant",
        content: buildAssistantReplyText(suggestions, patch),
        metadata: {
          suggestions,
          stageHint: payload.stageHint ?? null
        }
      })
      .returning();
    if (!assistantMessage) return c.json({ error: "create_failed" }, 500);

    const [updatedSession] = await db
      .select()
      .from(schema.assistantSessions)
      .where(eq(schema.assistantSessions.id, sessionId))
      .limit(1);
    if (!updatedSession) return c.json({ error: "not_found" }, 404);

    return c.json(
      assistantSessionResponseSchema.parse({
        session: mapAssistantSession(updatedSession),
        messages: [mapAssistantMessage(userMessage), mapAssistantMessage(assistantMessage)],
        suggestions
      })
    );
  }
);

intelligenceRoutes.get("/waybooks/:waybookId/scenarios", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");

  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const payload = await getScenarioRows(db, waybookId);
  return c.json(payload);
});

intelligenceRoutes.post(
  "/waybooks/:waybookId/scenarios:generate",
  requireAuthMiddleware,
  zValidator("json", generateScenariosInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const destinationRows = await db
      .select()
      .from(schema.tripDestinations)
      .where(eq(schema.tripDestinations.waybookId, waybookId))
      .orderBy(desc(schema.tripDestinations.createdAt));
    const destinationVoteRows = destinationRows.length
      ? await db
          .select()
          .from(schema.destinationVotes)
          .where(inArray(schema.destinationVotes.destinationId, destinationRows.map((row) => row.id)))
      : [];
    const destinationVotes = new Map<string, { up: number; down: number }>();
    for (const vote of destinationVoteRows) {
      const current = destinationVotes.get(vote.destinationId) ?? { up: 0, down: 0 };
      if (vote.vote === "down") current.down += 1;
      else current.up += 1;
      destinationVotes.set(vote.destinationId, current);
    }

    const activityRows = await db
      .select()
      .from(schema.activityCandidates)
      .where(eq(schema.activityCandidates.waybookId, waybookId))
      .orderBy(desc(schema.activityCandidates.createdAt));
    const activityVoteRows = activityRows.length
      ? await db
          .select()
          .from(schema.activityVotes)
          .where(inArray(schema.activityVotes.activityCandidateId, activityRows.map((row) => row.id)))
      : [];
    const activityVotes = new Map<string, { up: number; down: number }>();
    for (const vote of activityVoteRows) {
      const current = activityVotes.get(vote.activityCandidateId) ?? { up: 0, down: 0 };
      if (vote.vote === "down") current.down += 1;
      else current.up += 1;
      activityVotes.set(vote.activityCandidateId, current);
    }

    const bookingRows = await db
      .select()
      .from(schema.bookingRecords)
      .where(eq(schema.bookingRecords.waybookId, waybookId))
      .orderBy(desc(schema.bookingRecords.createdAt));
    const prepRows = await db
      .select()
      .from(schema.tripChecklistItems)
      .where(
        and(
          eq(schema.tripChecklistItems.waybookId, waybookId),
          inArray(schema.tripChecklistItems.status, ["todo", "in_progress"])
        )
      )
      .orderBy(asc(schema.tripChecklistItems.createdAt));

    const previous = await getScenarioRows(db, waybookId);
    const lockedCarryover = new Map<
      string,
      Array<{
        itemType: "destination" | "activity" | "booking" | "prep";
        sourceId: string | null;
        label: string;
        details: string | null;
        score: number | null;
      }>
    >();
    for (const scenario of previous.items) {
      lockedCarryover.set(
        scenario.scenarioType,
        scenario.items
          .filter((item) => item.isLocked)
          .map((item) => ({
            itemType: item.itemType,
            sourceId: item.sourceId,
            label: item.label,
            details: item.details,
            score: item.score
          }))
      );
    }

    const destinationCandidates = destinationRows.map((row) => {
      const votes = destinationVotes.get(row.id) ?? { up: 0, down: 0 };
      return {
        itemType: "destination" as const,
        sourceId: row.id,
        label: row.name,
        details: row.rationale ?? null,
        score: votes.up - votes.down + (row.status === "locked" ? 25 : 0),
        status: row.status
      };
    });
    const activityCandidates = activityRows.map((row) => {
      const votes = activityVotes.get(row.id) ?? { up: 0, down: 0 };
      return {
        itemType: "activity" as const,
        sourceId: row.id,
        label: row.title,
        details: row.providerHint ?? row.description ?? null,
        score: votes.up - votes.down + row.confidenceScore,
        costMin: row.estimatedCostMin ?? Number.MAX_SAFE_INTEGER,
        durationMin: row.durationMin ?? 0
      };
    });
    const bookingCandidates = bookingRows.map((row) => ({
      itemType: "booking" as const,
      sourceId: row.id,
      label: row.title,
      details: `${row.type} · ${row.bookingStatus}`,
      score: row.bookingStatus === "confirmed" ? 40 : 15,
      totalAmountMinor: row.totalAmountMinor ?? Number.MAX_SAFE_INTEGER
    }));
    const prepCandidates = prepRows.map((row) => ({
      itemType: "prep" as const,
      sourceId: row.id,
      label: row.title,
      details: row.category ? `${row.category} · ${row.status}` : row.status,
      score: row.isCritical ? 30 : 10
    }));

    const selectScenarioItems = (scenarioType: "balanced" | "budget" | "adventure") => {
      const selected: Array<{
        itemType: "destination" | "activity" | "booking" | "prep";
        sourceId: string | null;
        label: string;
        details: string | null;
        score: number | null;
        isLocked: boolean;
      }> = [];

      const existingLocked = lockedCarryover.get(scenarioType) ?? [];
      for (const item of existingLocked) {
        selected.push({
          ...item,
          isLocked: true
        });
      }

      const seen = new Set(selected.map((item) => `${item.itemType}:${item.sourceId ?? item.label}`));
      const push = (
        item: {
          itemType: "destination" | "activity" | "booking" | "prep";
          sourceId: string | null;
          label: string;
          details: string | null;
          score: number | null;
        },
        isLocked = false
      ) => {
        const key = `${item.itemType}:${item.sourceId ?? item.label}`;
        if (seen.has(key)) return;
        seen.add(key);
        selected.push({ ...item, isLocked });
      };

      const destinations =
        scenarioType === "budget"
          ? [...destinationCandidates].sort((a, b) => (a.status === "locked" ? -1 : 1) || b.score - a.score)
          : [...destinationCandidates].sort((a, b) => b.score - a.score);
      const activities =
        scenarioType === "budget"
          ? [...activityCandidates].sort((a, b) => a.costMin - b.costMin || b.score - a.score)
          : scenarioType === "adventure"
            ? [...activityCandidates].sort((a, b) => b.durationMin - a.durationMin || b.score - a.score)
            : [...activityCandidates].sort((a, b) => b.score - a.score);
      const bookings =
        scenarioType === "budget"
          ? [...bookingCandidates].sort((a, b) => a.totalAmountMinor - b.totalAmountMinor || b.score - a.score)
          : [...bookingCandidates].sort((a, b) => b.score - a.score);

      destinations.slice(0, 2).forEach((item) => push(item, item.status === "locked"));
      activities.slice(0, scenarioType === "adventure" ? 4 : 3).forEach((item) => push(item, false));
      bookings.slice(0, 2).forEach((item) => push(item, item.details.includes("confirmed")));
      prepCandidates.slice(0, 2).forEach((item) => push(item, false));

      if (payload.prompt?.trim()) {
        push(
          {
            itemType: "prep",
            sourceId: null,
            label: "Prompt alignment note",
            details: payload.prompt.trim().slice(0, 220),
            score: 5
          },
          false
        );
      }

      return selected;
    };

    for (const scenarioType of Object.keys(scenarioTypeConfig) as Array<"balanced" | "budget" | "adventure">) {
      const config = scenarioTypeConfig[scenarioType];
      const [upsertedScenario] = await db
        .insert(schema.tripScenarios)
        .values({
          waybookId,
          scenarioType,
          title: config.title,
          description: config.description,
          createdByUserId: user.id,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [schema.tripScenarios.waybookId, schema.tripScenarios.scenarioType],
          set: {
            title: config.title,
            description: config.description,
            createdByUserId: user.id,
            updatedAt: new Date()
          }
        })
        .returning();
      if (!upsertedScenario) continue;

      await db.delete(schema.tripScenarioItems).where(eq(schema.tripScenarioItems.scenarioId, upsertedScenario.id));
      const items = selectScenarioItems(scenarioType);
      if (items.length) {
        await db.insert(schema.tripScenarioItems).values(
          items.map((item, orderIndex) => ({
            scenarioId: upsertedScenario.id,
            itemType: item.itemType,
            sourceId: item.sourceId,
            label: item.label,
            details: item.details,
            score: item.score,
            orderIndex,
            isLocked: item.isLocked
          }))
        );
      }
    }

    await db.insert(schema.productEvents).values({
      userId: user.id,
      waybookId,
      eventType: "scenario_generated",
      metadata: {
        source: "scenarios:generate"
      }
    });

    const response = await getScenarioRows(db, waybookId);
    return c.json(response);
  }
);

intelligenceRoutes.post(
  "/waybooks/:waybookId/scenarios/:scenarioId/lock",
  requireAuthMiddleware,
  zValidator("json", lockScenarioInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const scenarioId = c.req.param("scenarioId");
    const payload = c.req.valid("json");

    const [scenario] = await db.select().from(schema.tripScenarios).where(eq(schema.tripScenarios.id, scenarioId)).limit(1);
    if (!scenario || scenario.waybookId !== waybookId) return c.json({ error: "not_found" }, 404);
    const access = await getWaybookAccess(db, scenario.waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    if (payload.itemIds?.length) {
      await db
        .update(schema.tripScenarioItems)
        .set({ isLocked: true })
        .where(
          and(
            eq(schema.tripScenarioItems.scenarioId, scenarioId),
            inArray(schema.tripScenarioItems.id, payload.itemIds)
          )
        );
    } else {
      await db
        .update(schema.tripScenarioItems)
        .set({ isLocked: true })
        .where(eq(schema.tripScenarioItems.scenarioId, scenarioId));
    }

    await db.insert(schema.productEvents).values({
      userId: user.id,
      waybookId: scenario.waybookId,
      eventType: "scenario_locked",
      metadata: {
        scenarioId,
        itemCount: payload.itemIds?.length ?? null
      }
    });

    const payloadRows = await getScenarioRows(db, scenario.waybookId);
    const updatedScenario = payloadRows.items.find((item) => item.id === scenarioId);
    if (!updatedScenario) return c.json({ error: "not_found" }, 404);
    return c.json(updatedScenario);
  }
);

intelligenceRoutes.get("/waybooks/:waybookId/decision-rounds", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const rows = await db
    .select()
    .from(schema.decisionRounds)
    .where(eq(schema.decisionRounds.waybookId, waybookId))
    .orderBy(desc(schema.decisionRounds.createdAt));

  return c.json(
    listDecisionRoundsResponseSchema.parse({
      items: rows.map((row) =>
        decisionRoundDtoSchema.parse({
          id: row.id,
          waybookId: row.waybookId,
          topic: row.topic,
          scope:
            row.scope === "destinations" || row.scope === "activities" ? row.scope : "planning",
          summary: row.summary,
          recommendation: row.recommendation,
          options: Array.isArray(row.optionsJson) ? row.optionsJson : [],
          createdAt: row.createdAt.toISOString()
        })
      )
    })
  );
});

intelligenceRoutes.post(
  "/waybooks/:waybookId/decision-rounds",
  requireAuthMiddleware,
  zValidator("json", createDecisionRoundInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const waybookId = c.req.param("waybookId");
    const payload = c.req.valid("json");

    const access = await getWaybookAccess(db, waybookId, user.id);
    if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

    const options: Array<{ label: string; votesUp: number; votesDown: number; score: number }> = [];
    if (payload.scope === "destinations") {
      const rows = await db.select().from(schema.tripDestinations).where(eq(schema.tripDestinations.waybookId, waybookId));
      const votes = rows.length
        ? await db.select().from(schema.destinationVotes).where(inArray(schema.destinationVotes.destinationId, rows.map((row) => row.id)))
        : [];
      const counts = new Map<string, { up: number; down: number }>();
      for (const vote of votes) {
        const current = counts.get(vote.destinationId) ?? { up: 0, down: 0 };
        if (vote.vote === "down") current.down += 1;
        else current.up += 1;
        counts.set(vote.destinationId, current);
      }
      for (const row of rows) {
        const vote = counts.get(row.id) ?? { up: 0, down: 0 };
        options.push({
          label: row.name,
          votesUp: vote.up,
          votesDown: vote.down,
          score: vote.up - vote.down + (row.status === "locked" ? 2 : 0)
        });
      }
    } else if (payload.scope === "activities") {
      const rows = await db.select().from(schema.activityCandidates).where(eq(schema.activityCandidates.waybookId, waybookId));
      const votes = rows.length
        ? await db
            .select()
            .from(schema.activityVotes)
            .where(inArray(schema.activityVotes.activityCandidateId, rows.map((row) => row.id)))
        : [];
      const counts = new Map<string, { up: number; down: number }>();
      for (const vote of votes) {
        const current = counts.get(vote.activityCandidateId) ?? { up: 0, down: 0 };
        if (vote.vote === "down") current.down += 1;
        else current.up += 1;
        counts.set(vote.activityCandidateId, current);
      }
      for (const row of rows) {
        const vote = counts.get(row.id) ?? { up: 0, down: 0 };
        options.push({
          label: row.title,
          votesUp: vote.up,
          votesDown: vote.down,
          score: vote.up - vote.down + Math.round(row.confidenceScore / 10)
        });
      }
    } else {
      const rows = await db.select().from(schema.planningItems).where(eq(schema.planningItems.waybookId, waybookId));
      const votes = rows.length
        ? await db.select().from(schema.planningVotes).where(inArray(schema.planningVotes.planningItemId, rows.map((row) => row.id)))
        : [];
      const counts = new Map<string, { up: number; down: number }>();
      for (const vote of votes) {
        const current = counts.get(vote.planningItemId) ?? { up: 0, down: 0 };
        if (vote.vote === "down") current.down += 1;
        else current.up += 1;
        counts.set(vote.planningItemId, current);
      }
      for (const row of rows) {
        const vote = counts.get(row.id) ?? { up: 0, down: 0 };
        options.push({
          label: row.title,
          votesUp: vote.up,
          votesDown: vote.down,
          score: vote.up - vote.down
        });
      }
    }

    const ranked = options
      .sort((a, b) => b.score - a.score || b.votesUp - a.votesUp)
      .slice(0, payload.maxOptions);
    const leader = ranked[0];
    const runnerUp = ranked[1];
    const topic = payload.topic ?? `Resolve ${payload.scope} tie-break`;
    const summary =
      ranked.length > 0
        ? `Compared ${ranked.length} options. Leader: ${leader?.label ?? "none"} (${leader?.votesUp ?? 0} up / ${leader?.votesDown ?? 0} down).`
        : "No options were available for this decision scope.";
    const recommendation =
      ranked.length === 0
        ? "Add options first, then rerun this round."
        : runnerUp && runnerUp.score === leader?.score
          ? `Tie detected between ${leader?.label} and ${runnerUp.label}. Use a final in-trip message vote.`
          : `Move forward with "${leader?.label}" and archive lower-ranked options.`;

    const [created] = await db
      .insert(schema.decisionRounds)
      .values({
        waybookId,
        createdByUserId: user.id,
        topic,
        scope: payload.scope,
        summary,
        recommendation,
        optionsJson: ranked
      })
      .returning();
    if (!created) return c.json({ error: "create_failed" }, 500);

    return c.json(
      decisionRoundDtoSchema.parse({
        id: created.id,
        waybookId: created.waybookId,
        topic: created.topic,
        scope:
          created.scope === "destinations" || created.scope === "activities" ? created.scope : "planning",
        summary: created.summary,
        recommendation: created.recommendation,
        options: Array.isArray(created.optionsJson) ? created.optionsJson : [],
        createdAt: created.createdAt.toISOString()
      }),
      201
    );
  }
);

intelligenceRoutes.get("/waybooks/:waybookId/digest/today", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "viewer")) return c.json({ error: "not_found" }, 404);

  const [stageRow] = await db.select().from(schema.tripStageState).where(eq(schema.tripStageState.waybookId, waybookId)).limit(1);
  const [confirmedStay] = await db
    .select()
    .from(schema.bookingRecords)
    .where(
      and(
        eq(schema.bookingRecords.waybookId, waybookId),
        eq(schema.bookingRecords.bookingStatus, "confirmed"),
        eq(schema.bookingRecords.type, "stay")
      )
    )
    .limit(1);
  const [confirmedActivity] = await db
    .select()
    .from(schema.bookingRecords)
    .where(
      and(
        eq(schema.bookingRecords.waybookId, waybookId),
        eq(schema.bookingRecords.bookingStatus, "confirmed"),
        eq(schema.bookingRecords.type, "activity")
      )
    )
    .limit(1);
  const criticalRemaining = await db
    .select()
    .from(schema.tripChecklistItems)
    .where(
      and(
        eq(schema.tripChecklistItems.waybookId, waybookId),
        eq(schema.tripChecklistItems.isCritical, true),
        inArray(schema.tripChecklistItems.status, ["todo", "in_progress"])
      )
    );

  const pendingBookings = await db
    .select()
    .from(schema.bookingRecords)
    .where(
      and(
        eq(schema.bookingRecords.waybookId, waybookId),
        inArray(schema.bookingRecords.bookingStatus, ["draft", "pending_checkout"])
      )
    );

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const startDate = access.waybook.startDate ? new Date(access.waybook.startDate) : null;
  const daysUntilTrip =
    startDate === null ? null : Math.max(0, Math.ceil((startDate.getTime() - new Date(today).getTime()) / 86400000));

  const highlights = [
    confirmedStay ? "A stay booking is confirmed." : "No stay booking confirmed yet.",
    confirmedActivity ? "At least one activity booking is confirmed." : "No activity booking confirmed yet.",
    criticalRemaining.length === 0 ? "Critical prep is clear." : `${criticalRemaining.length} critical prep items remain.`
  ];

  const riskFlags: Array<{ level: "low" | "medium" | "high"; message: string }> = [];
  if (!confirmedStay) riskFlags.push({ level: "medium", message: "No confirmed stay yet." });
  if (!confirmedActivity) riskFlags.push({ level: "medium", message: "No confirmed activity booking yet." });
  if (criticalRemaining.length > 0) {
    riskFlags.push({
      level: criticalRemaining.length > 3 ? "high" : "medium",
      message: `${criticalRemaining.length} critical prep items are still open.`
    });
  }
  if (daysUntilTrip !== null && daysUntilTrip <= 3 && pendingBookings.length > 0) {
    riskFlags.push({
      level: "high",
      message: `${pendingBookings.length} booking actions are still pending within ${daysUntilTrip} days of departure.`
    });
  }
  if (!riskFlags.length) riskFlags.push({ level: "low", message: "Trip operations look healthy for today." });

  const nextActions = [];
  if (!confirmedStay) {
    nextActions.push({
      id: "book-stay",
      title: "Confirm a stay",
      reason: "A confirmed stay unblocks itinerary confidence.",
      ctaLabel: "Review stays"
    });
  }
  if (!confirmedActivity) {
    nextActions.push({
      id: "book-activity",
      title: "Confirm one anchor activity",
      reason: "Anchors make itinerary generation more reliable.",
      ctaLabel: "Review activities"
    });
  }
  if (criticalRemaining.length > 0) {
    nextActions.push({
      id: "clear-critical-prep",
      title: "Close critical prep tasks",
      reason: "Critical prep tasks are still open.",
      ctaLabel: "Open checklist"
    });
  }
  if (!nextActions.length) {
    nextActions.push({
      id: "capture-story",
      title: "Capture today’s highlights",
      reason: "Ops are stable, so focus on memories and notes.",
      ctaLabel: "Open capture"
    });
  }

  const contingencySuggestions = [
    "Keep one low-commitment activity as fallback in each day block.",
    "If weather shifts, swap to indoor options and preserve transit buffers.",
    "Pin one backup dinner option near your evening location."
  ];

  return c.json(
    tripDigestDtoSchema.parse({
      waybookId,
      date: today,
      currentStage: stageRow?.currentStage ?? "destinations",
      highlights,
      contingencySuggestions,
      riskFlags,
      nextActions
    })
  );
});

intelligenceRoutes.post("/waybooks/:waybookId/replay/build", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const waybookId = c.req.param("waybookId");
  const access = await getWaybookAccess(db, waybookId, user.id);
  if (!access || !hasMinimumRole(access.role, "editor")) return c.json({ error: "not_found" }, 404);

  const destinations = await db
    .select()
    .from(schema.tripDestinations)
    .where(and(eq(schema.tripDestinations.waybookId, waybookId), eq(schema.tripDestinations.status, "locked")))
    .orderBy(asc(schema.tripDestinations.createdAt));
  const bookings = await db
    .select()
    .from(schema.bookingRecords)
    .where(and(eq(schema.bookingRecords.waybookId, waybookId), eq(schema.bookingRecords.bookingStatus, "confirmed")))
    .orderBy(asc(schema.bookingRecords.createdAt));
  const daySummaries = await db
    .select()
    .from(schema.waybookDaySummaries)
    .where(eq(schema.waybookDaySummaries.waybookId, waybookId))
    .orderBy(desc(schema.waybookDaySummaries.summaryDate));
  const entries = await db
    .select()
    .from(schema.entries)
    .where(eq(schema.entries.waybookId, waybookId))
    .orderBy(desc(schema.entries.capturedAt))
    .limit(40);
  const ratings = entries.length
    ? await db
        .select()
        .from(schema.entryExperienceRatings)
        .where(inArray(schema.entryExperienceRatings.entryId, entries.map((entry) => entry.id)))
    : [];
  const guidance = entries.length
    ? await db
        .select()
        .from(schema.entryGuidance)
        .where(inArray(schema.entryGuidance.entryId, entries.map((entry) => entry.id)))
    : [];

  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const lessons = new Set<string>();
  for (const rating of ratings) {
    if (rating.wouldRepeat === false && rating.ratingOverall <= 3) {
      const entry = entryById.get(rating.entryId);
      if (entry?.textContent) lessons.add(`Avoid repeating: ${entry.textContent.slice(0, 100)}`);
    }
  }
  for (const note of guidance) {
    if (note.isMustDo) {
      const entry = entryById.get(note.entryId);
      if (entry?.textContent) lessons.add(`Repeat-worthy: ${entry.textContent.slice(0, 100)}`);
    }
  }
  if (!lessons.size) lessons.add("Capture one lesson daily to improve replay quality.");

  const headline = `${access.waybook.title}: practical replay`;
  const summaryText =
    daySummaries[0]?.summaryText ??
    (entries[0]?.textContent
      ? `Latest highlight: ${entries[0].textContent.slice(0, 180)}`
      : "Trip replay generated from planning and capture signals.");
  const sections = [
    {
      title: "Destinations to Keep",
      items: destinations.map((item) => item.name).slice(0, 6)
    },
    {
      title: "Confirmed Bookings",
      items: bookings.map((item) => `${item.title} (${item.type})`).slice(0, 6)
    },
    {
      title: "Lessons for Next Time",
      items: Array.from(lessons).slice(0, 6)
    }
  ];
  const templatePrompt = `Plan a trip like "${access.waybook.title}" with ${destinations
    .map((item) => item.name)
    .slice(0, 3)
    .join(", ") || "the same vibe"}, preserving the most successful moments and avoiding previous misses.`;

  await db.insert(schema.productEvents).values({
    userId: user.id,
    waybookId,
    eventType: "replay_published",
    metadata: {
      destinationCount: destinations.length,
      bookingCount: bookings.length
    }
  });

  return c.json(
    replayBlueprintDtoSchema.parse({
      waybookId,
      headline,
      summary: summaryText,
      lessons: Array.from(lessons).slice(0, 8),
      templatePrompt,
      sections,
      createdAt: new Date().toISOString()
    })
  );
});

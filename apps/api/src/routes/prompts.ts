import { zValidator } from "@hono/zod-validator";
import { ackPromptInputSchema } from "@waybook/contracts";
import { schema } from "@waybook/db";
import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { Hono } from "hono";
import { mapPrompt } from "../lib/mappers.js";
import { requireAuthMiddleware } from "../middleware/require-auth.js";
import type { AppBindings } from "../types.js";

export const promptRoutes = new Hono<AppBindings>();

promptRoutes.get("/prompts/next", requireAuthMiddleware, async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const now = new Date();

  const [nextPrompt] = await db
    .select()
    .from(schema.promptEvents)
    .where(
      and(
        eq(schema.promptEvents.userId, user.id),
        isNull(schema.promptEvents.dismissedAt),
        isNull(schema.promptEvents.actedAt),
        lte(schema.promptEvents.scheduledFor, now)
      )
    )
    .orderBy(asc(schema.promptEvents.scheduledFor))
    .limit(1);

  if (!nextPrompt) return c.json(null);
  return c.json(mapPrompt(nextPrompt));
});

promptRoutes.post(
  "/prompts/ack",
  requireAuthMiddleware,
  zValidator("json", ackPromptInputSchema),
  async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const { action, promptId } = c.req.valid("json");

    const updates: Partial<typeof schema.promptEvents.$inferInsert> = {};
    if (action === "shown") updates.shownAt = new Date();
    if (action === "dismissed") updates.dismissedAt = new Date();
    if (action === "acted") updates.actedAt = new Date();

    const [updated] = await db
      .update(schema.promptEvents)
      .set(updates)
      .where(and(eq(schema.promptEvents.id, promptId), eq(schema.promptEvents.userId, user.id)))
      .returning({ id: schema.promptEvents.id });

    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json({ success: true });
  }
);

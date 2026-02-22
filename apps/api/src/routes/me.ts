import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@waybook/db";
import { requireAuthMiddleware } from "../middleware/require-auth.js";
import type { AppBindings } from "../types.js";

export const meRoutes = new Hono<AppBindings>();

meRoutes.get("/me", requireAuthMiddleware, async (c) => {
  const user = c.get("user");
  return c.json({ userId: user.id, email: user.email });
});

meRoutes.get("/me/invites", requireAuthMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  if (!user.email) return c.json({ items: [] });

  const invites = await db
    .select({
      id: schema.waybookInvites.id,
      waybookId: schema.waybookInvites.waybookId,
      role: schema.waybookInvites.role,
      expiresAt: schema.waybookInvites.expiresAt,
      createdAt: schema.waybookInvites.createdAt,
      inviterId: schema.users.id,
      inviterName: schema.users.name,
      inviterEmail: schema.users.email,
      waybookTitle: schema.waybooks.title
    })
    .from(schema.waybookInvites)
    .innerJoin(schema.waybooks, eq(schema.waybookInvites.waybookId, schema.waybooks.id))
    .innerJoin(schema.users, eq(schema.waybookInvites.invitedBy, schema.users.id))
    .where(and(eq(schema.waybookInvites.email, user.email.toLowerCase()), isNull(schema.waybookInvites.acceptedAt)));

  return c.json({
    items: invites.map((invite) => ({
      id: invite.id,
      waybookId: invite.waybookId,
      waybookTitle: invite.waybookTitle,
      role: invite.role,
      invitedBy: {
        id: invite.inviterId,
        name: invite.inviterName,
        email: invite.inviterEmail
      },
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      createdAt: invite.createdAt.toISOString()
    }))
  });
});

meRoutes.post("/me/invites/:inviteId/accept", requireAuthMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const inviteId = c.req.param("inviteId");
  if (!user.email) return c.json({ error: "email_required" }, 403);

  const [invite] = await db
    .select()
    .from(schema.waybookInvites)
    .where(and(eq(schema.waybookInvites.id, inviteId), eq(schema.waybookInvites.email, user.email.toLowerCase()), isNull(schema.waybookInvites.acceptedAt)))
    .limit(1);
  if (!invite) return c.json({ error: "not_found" }, 404);
  if (invite.expiresAt && invite.expiresAt < new Date()) return c.json({ error: "expired" }, 410);

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
      set: {
        role: invite.role,
        invitedBy: invite.invitedBy
      }
    });

  await db
    .update(schema.waybookInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(schema.waybookInvites.id, invite.id));

  return c.json({ success: true, waybookId: invite.waybookId });
});

meRoutes.delete("/me/invites/:inviteId", requireAuthMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const inviteId = c.req.param("inviteId");
  if (!user.email) return c.json({ error: "email_required" }, 403);

  await db
    .delete(schema.waybookInvites)
    .where(and(eq(schema.waybookInvites.id, inviteId), eq(schema.waybookInvites.email, user.email.toLowerCase()), isNull(schema.waybookInvites.acceptedAt)));

  return c.json({ success: true });
});

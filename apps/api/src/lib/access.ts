import { schema } from "@waybook/db";
import { and, eq } from "drizzle-orm";
import type { AppBindings } from "../types.js";

export type WaybookAccessRole = "owner" | "editor" | "viewer";

const roleRank: Record<WaybookAccessRole, number> = {
  viewer: 1,
  editor: 2,
  owner: 3
};

export const hasMinimumRole = (role: WaybookAccessRole, minimum: WaybookAccessRole) => roleRank[role] >= roleRank[minimum];

export const getWaybookAccess = async (
  db: AppBindings["Variables"]["db"],
  waybookId: string,
  userId: string
): Promise<
  | {
      role: WaybookAccessRole;
      waybook: typeof schema.waybooks.$inferSelect;
    }
  | null
> => {
  const [waybook] = await db.select().from(schema.waybooks).where(eq(schema.waybooks.id, waybookId)).limit(1);
  if (!waybook) return null;

  if (waybook.userId === userId) {
    return { role: "owner", waybook };
  }

  const [membership] = await db
    .select()
    .from(schema.waybookMembers)
    .where(and(eq(schema.waybookMembers.waybookId, waybookId), eq(schema.waybookMembers.userId, userId)))
    .limit(1);

  if (!membership) return null;

  return {
    role: membership.role,
    waybook
  };
};

export const getEntryAccess = async (
  db: AppBindings["Variables"]["db"],
  entryId: string,
  userId: string
): Promise<
  | {
      role: WaybookAccessRole;
      entry: typeof schema.entries.$inferSelect;
      waybook: typeof schema.waybooks.$inferSelect;
    }
  | null
> => {
  const [entry] = await db.select().from(schema.entries).where(eq(schema.entries.id, entryId)).limit(1);
  if (!entry) return null;

  const access = await getWaybookAccess(db, entry.waybookId, userId);
  if (!access) return null;

  return {
    role: access.role,
    waybook: access.waybook,
    entry
  };
};

export const getMediaAccess = async (
  db: AppBindings["Variables"]["db"],
  mediaId: string,
  userId: string
): Promise<
  | {
      role: WaybookAccessRole;
      media: typeof schema.mediaAssets.$inferSelect;
      entry: typeof schema.entries.$inferSelect;
      waybook: typeof schema.waybooks.$inferSelect;
    }
  | null
> => {
  const [media] = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, mediaId)).limit(1);
  if (!media) return null;

  const entryAccess = await getEntryAccess(db, media.entryId, userId);
  if (!entryAccess) return null;

  return {
    role: entryAccess.role,
    media,
    entry: entryAccess.entry,
    waybook: entryAccess.waybook
  };
};

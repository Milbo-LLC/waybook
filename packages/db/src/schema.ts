import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const now = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const waybookVisibilityEnum = pgEnum("waybook_visibility", ["private", "link_only", "public"]);
export const mediaTypeEnum = pgEnum("media_type", ["photo", "audio", "video"]);
export const mediaStatusEnum = pgEnum("media_status", ["pending_upload", "uploaded", "processing", "ready", "failed"]);
export const itineraryTypeEnum = pgEnum("itinerary_type", ["hotel", "restaurant", "attraction", "activity"]);
export const mediaTranscodeStatusEnum = pgEnum("media_transcode_status", ["none", "pending", "processing", "ready", "failed"]);
export const reactionTypeEnum = pgEnum("reaction_type", [
  "worth_it",
  "skip_it",
  "family_friendly",
  "budget_friendly",
  "photogenic"
]);
export const promptTypeEnum = pgEnum("prompt_type", ["itinerary_gap", "location_gap", "day_reflection"]);
export const waybookMemberRoleEnum = pgEnum("waybook_member_role", ["owner", "editor", "viewer"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: varchar("name", { length: 120 }),
  image: text("image"),
  createdAt: now(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("accounts_user_id_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_unique").on(table.providerId, table.accountId)
  ]
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("verifications_identifier_value_unique").on(table.identifier, table.value)]
);

export const waybooks = pgTable(
  "waybooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    coverMediaId: uuid("cover_media_id"),
    visibility: waybookVisibilityEnum("visibility").notNull().default("private"),
    publicSlug: varchar("public_slug", { length: 120 }),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("waybooks_user_created_idx").on(table.userId, table.createdAt),
    uniqueIndex("waybooks_public_slug_unique").on(table.publicSlug).where(sql`${table.publicSlug} is not null`)
  ]
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    textContent: text("text_content"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    placeName: varchar("place_name", { length: 200 }),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("entries_waybook_captured_idx").on(table.waybookId, table.capturedAt)]
);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    type: mediaTypeEnum("type").notNull(),
    storageKeyOriginal: text("storage_key_original").notNull(),
    storageKeyDisplay: text("storage_key_display"),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    durationMs: integer("duration_ms"),
    thumbnailKey: text("thumbnail_key"),
    transcodeStatus: mediaTranscodeStatusEnum("transcode_status").notNull().default("none"),
    playbackDurationMs: integer("playback_duration_ms"),
    aspectRatio: doublePrecision("aspect_ratio"),
    status: mediaStatusEnum("status").notNull().default("pending_upload"),
    metadata: jsonb("metadata"),
    createdAt: now()
  },
  (table) => [index("media_assets_entry_created_idx").on(table.entryId, table.createdAt)]
);

export const waybookShareLinks = pgTable(
  "waybook_share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: now()
  },
  (table) => [
    index("waybook_share_links_waybook_active_idx").on(table.waybookId, table.isActive),
    uniqueIndex("waybook_share_links_token_hash_unique").on(table.tokenHash)
  ]
);

export const waybookMembers = pgTable(
  "waybook_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: waybookMemberRoleEnum("role").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: now()
  },
  (table) => [
    uniqueIndex("waybook_members_waybook_user_unique").on(table.waybookId, table.userId),
    index("waybook_members_user_idx").on(table.userId),
    index("waybook_members_waybook_role_idx").on(table.waybookId, table.role)
  ]
);

export const waybookInvites = pgTable(
  "waybook_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    tokenHash: text("token_hash").notNull(),
    role: waybookMemberRoleEnum("role").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: now()
  },
  (table) => [
    uniqueIndex("waybook_invites_token_hash_unique").on(table.tokenHash),
    index("waybook_invites_waybook_email_idx").on(table.waybookId, table.email),
    index("waybook_invites_waybook_created_idx").on(table.waybookId, table.createdAt)
  ]
);

export const itineraryItems = pgTable(
  "itinerary_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    type: itineraryTypeEnum("type").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    placeName: varchar("place_name", { length: 200 }),
    startTime: timestamp("start_time", { withTimezone: true }),
    endTime: timestamp("end_time", { withTimezone: true }),
    externalLink: text("external_link"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("itinerary_items_waybook_start_idx").on(table.waybookId, table.startTime)]
);

export const jobEvents = pgTable(
  "job_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    queue: varchar("queue", { length: 80 }).notNull(),
    jobId: varchar("job_id", { length: 120 }).notNull(),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    payload: jsonb("payload"),
    createdAt: now()
  },
  (table) => [index("job_events_queue_created_idx").on(table.queue, table.createdAt)]
);

export const entryExperienceRatings = pgTable(
  "entry_experience_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ratingOverall: integer("rating_overall").notNull(),
    valueForMoney: integer("value_for_money").notNull(),
    wouldRepeat: boolean("would_repeat").notNull(),
    difficulty: integer("difficulty"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("entry_experience_ratings_entry_user_unique").on(table.entryId, table.userId),
    index("entry_experience_ratings_entry_created_idx").on(table.entryId, table.createdAt)
  ]
);

export const waybookDaySummaries = pgTable(
  "waybook_day_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    summaryDate: date("summary_date").notNull(),
    summaryText: text("summary_text"),
    topMomentEntryId: uuid("top_moment_entry_id").references(() => entries.id, { onDelete: "set null" }),
    moodScore: integer("mood_score"),
    energyScore: integer("energy_score"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("waybook_day_summaries_waybook_date_unique").on(table.waybookId, table.summaryDate),
    index("waybook_day_summaries_waybook_date_idx").on(table.waybookId, table.summaryDate)
  ]
);

export const entryGuidance = pgTable(
  "entry_guidance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    isMustDo: boolean("is_must_do").notNull().default(false),
    estimatedCostMin: integer("estimated_cost_min"),
    estimatedCostMax: integer("estimated_cost_max"),
    timeNeededMinutes: integer("time_needed_minutes"),
    bestTimeOfDay: varchar("best_time_of_day", { length: 80 }),
    tipsText: text("tips_text"),
    accessibilityNotes: text("accessibility_notes"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("entry_guidance_entry_unique").on(table.entryId)]
);

export const entryReactionsPublic = pgTable(
  "entry_reactions_public",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    userFingerprint: varchar("user_fingerprint", { length: 160 }),
    reactionType: reactionTypeEnum("reaction_type").notNull(),
    note: text("note"),
    createdAt: now()
  },
  (table) => [index("entry_reactions_public_entry_created_idx").on(table.entryId, table.createdAt)]
);

export const promptEvents = pgTable(
  "prompt_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    promptType: promptTypeEnum("prompt_type").notNull(),
    triggerReason: varchar("trigger_reason", { length: 120 }).notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    shownAt: timestamp("shown_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    actedAt: timestamp("acted_at", { withTimezone: true }),
    createdAt: now()
  },
  (table) => [
    index("prompt_events_user_scheduled_idx").on(table.userId, table.scheduledFor),
    index("prompt_events_waybook_scheduled_idx").on(table.waybookId, table.scheduledFor)
  ]
);

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
export const mediaTypeEnum = pgEnum("media_type", ["photo", "audio"]);
export const mediaStatusEnum = pgEnum("media_status", ["pending_upload", "uploaded", "processing", "ready", "failed"]);
export const itineraryTypeEnum = pgEnum("itinerary_type", ["hotel", "restaurant", "attraction", "activity"]);

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

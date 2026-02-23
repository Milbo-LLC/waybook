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
export const planningItemStatusEnum = pgEnum("planning_item_status", [
  "idea",
  "shortlisted",
  "planned",
  "booked",
  "done",
  "skipped"
]);
export const bookingTypeEnum = pgEnum("booking_type", ["activity", "stay", "transport", "flight", "other"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "draft",
  "pending_checkout",
  "confirmed",
  "cancelled",
  "failed",
  "refunded"
]);
export const expenseSplitMethodEnum = pgEnum("expense_split_method", ["equal", "custom", "percentage", "shares"]);
export const expenseStatusEnum = pgEnum("expense_status", ["logged", "settled"]);
export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "done"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high"]);
export const notificationChannelEnum = pgEnum("notification_channel", ["in_app", "email"]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "task_due",
  "booking_deadline",
  "day_plan_start",
  "summary_prompt"
]);
export const tripStageEnum = pgEnum("trip_stage", [
  "destinations",
  "activities",
  "booking",
  "itinerary",
  "prep",
  "capture",
  "replay"
]);
export const stageStatusEnum = pgEnum("stage_status", ["locked", "available", "complete"]);
export const destinationStatusEnum = pgEnum("destination_status", ["proposed", "locked", "rejected"]);
export const activityStatusEnum = pgEnum("activity_status", ["suggested", "shortlisted", "locked", "discarded"]);
export const messageScopeEnum = pgEnum("message_scope", ["trip", "dm"]);
export const messageDeliveryStatusEnum = pgEnum("message_delivery_status", ["sent", "failed", "read"]);

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
    startDate: date("start_date"),
    endDate: date("end_date"),
    timeframeLabel: varchar("timeframe_label", { length: 120 }),
    earliestStartDate: date("earliest_start_date"),
    latestEndDate: date("latest_end_date"),
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

export const planningItems = pgTable(
  "planning_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 80 }),
    status: planningItemStatusEnum("status").notNull().default("idea"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    placeName: varchar("place_name", { length: 200 }),
    estimatedCostMin: integer("estimated_cost_min"),
    estimatedCostMax: integer("estimated_cost_max"),
    sourceUrl: text("source_url"),
    providerHint: varchar("provider_hint", { length: 80 }),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("planning_items_waybook_status_created_idx").on(table.waybookId, table.status, table.createdAt)]
);

export const planningVotes = pgTable(
  "planning_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planningItemId: uuid("planning_item_id")
      .notNull()
      .references(() => planningItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vote: varchar("vote", { length: 8 }).notNull(),
    createdAt: now()
  },
  (table) => [
    uniqueIndex("planning_votes_item_user_unique").on(table.planningItemId, table.userId),
    index("planning_votes_item_created_idx").on(table.planningItemId, table.createdAt)
  ]
);

export const planningComments = pgTable(
  "planning_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planningItemId: uuid("planning_item_id")
      .notNull()
      .references(() => planningItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("planning_comments_item_created_idx").on(table.planningItemId, table.createdAt)]
);

export const tripTasks = pgTable(
  "trip_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: taskStatusEnum("status").notNull().default("todo"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("trip_tasks_waybook_status_due_idx").on(table.waybookId, table.status, table.dueAt)]
);

export const bookingRecords = pgTable(
  "booking_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    planningItemId: uuid("planning_item_id").references(() => planningItems.id, { onDelete: "set null" }),
    type: bookingTypeEnum("type").notNull(),
    provider: varchar("provider", { length: 80 }),
    providerBookingId: varchar("provider_booking_id", { length: 160 }),
    title: varchar("title", { length: 220 }).notNull(),
    bookedForStart: timestamp("booked_for_start", { withTimezone: true }),
    bookedForEnd: timestamp("booked_for_end", { withTimezone: true }),
    bookingStatus: bookingStatusEnum("booking_status").notNull().default("draft"),
    checkoutUrl: text("checkout_url"),
    confirmationCode: varchar("confirmation_code", { length: 120 }),
    bookedByUserId: uuid("booked_by_user_id").references(() => users.id, { onDelete: "set null" }),
    currency: varchar("currency", { length: 8 }),
    totalAmountMinor: integer("total_amount_minor"),
    refundPolicyText: text("refund_policy_text"),
    cancellationDeadline: timestamp("cancellation_deadline", { withTimezone: true }),
    rawPayload: jsonb("raw_payload"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("booking_records_waybook_status_start_idx").on(table.waybookId, table.bookingStatus, table.bookedForStart),
    index("booking_records_provider_external_idx").on(table.provider, table.providerBookingId)
  ]
);

export const bookingDocuments = pgTable(
  "booking_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingRecordId: uuid("booking_record_id")
      .notNull()
      .references(() => bookingRecords.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 140 }),
    createdAt: now()
  },
  (table) => [index("booking_documents_booking_created_idx").on(table.bookingRecordId, table.createdAt)]
);

export const expenseEntries = pgTable(
  "expense_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    bookingRecordId: uuid("booking_record_id").references(() => bookingRecords.id, { onDelete: "set null" }),
    title: varchar("title", { length: 220 }).notNull(),
    category: varchar("category", { length: 80 }),
    paidByUserId: uuid("paid_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currency: varchar("currency", { length: 8 }).notNull(),
    amountMinor: integer("amount_minor").notNull(),
    tripBaseCurrency: varchar("trip_base_currency", { length: 8 }).notNull(),
    tripBaseAmountMinor: integer("trip_base_amount_minor").notNull(),
    fxRate: doublePrecision("fx_rate"),
    incurredAt: timestamp("incurred_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
    splitMethod: expenseSplitMethodEnum("split_method").notNull().default("equal"),
    status: expenseStatusEnum("status").notNull().default("logged"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("expense_entries_waybook_incurred_idx").on(table.waybookId, table.incurredAt)]
);

export const expenseSplits = pgTable(
  "expense_splits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseEntryId: uuid("expense_entry_id")
      .notNull()
      .references(() => expenseEntries.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor"),
    percentage: integer("percentage"),
    shares: integer("shares"),
    createdAt: now()
  },
  (table) => [
    index("expense_splits_expense_user_idx").on(table.expenseEntryId, table.userId),
    uniqueIndex("expense_splits_expense_user_unique").on(table.expenseEntryId, table.userId)
  ]
);

export const itineraryEvents = pgTable(
  "itinerary_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    planningItemId: uuid("planning_item_id").references(() => planningItems.id, { onDelete: "set null" }),
    bookingRecordId: uuid("booking_record_id").references(() => bookingRecords.id, { onDelete: "set null" }),
    title: varchar("title", { length: 220 }).notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),
    bufferBeforeMin: integer("buffer_before_min"),
    bufferAfterMin: integer("buffer_after_min"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    isAutoGenerated: boolean("is_auto_generated").notNull().default(false),
    generationVersion: integer("generation_version").notNull().default(0),
    lockedByBooking: boolean("locked_by_booking").notNull().default(false),
    notes: text("notes"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("itinerary_events_waybook_start_idx").on(table.waybookId, table.startTime)]
);

export const entryItineraryLinks = pgTable(
  "entry_itinerary_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    itineraryEventId: uuid("itinerary_event_id")
      .notNull()
      .references(() => itineraryEvents.id, { onDelete: "cascade" }),
    createdAt: now()
  },
  (table) => [
    index("entry_itinerary_links_entry_created_idx").on(table.entryId, table.createdAt),
    uniqueIndex("entry_itinerary_links_entry_event_unique").on(table.entryId, table.itineraryEventId)
  ]
);

export const tripPreferences = pgTable("trip_preferences", {
  waybookId: uuid("waybook_id")
    .primaryKey()
    .references(() => waybooks.id, { onDelete: "cascade" }),
  baseCurrency: varchar("base_currency", { length: 8 }).notNull().default("USD"),
  budgetAmountMinor: integer("budget_amount_minor"),
  budgetCurrency: varchar("budget_currency", { length: 8 }).notNull().default("USD"),
  defaultSplitMethod: expenseSplitMethodEnum("default_split_method").notNull().default("equal"),
  pace: varchar("pace", { length: 40 }),
  budgetTier: varchar("budget_tier", { length: 40 }),
  accessibilityNotes: text("accessibility_notes"),
  quietHoursStart: varchar("quiet_hours_start", { length: 5 }),
  quietHoursEnd: varchar("quiet_hours_end", { length: 5 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const notificationRules = pgTable(
  "notification_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    notificationType: notificationTypeEnum("notification_type").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    leadTimeMin: integer("lead_time_min"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("notification_rules_waybook_user_channel_type_unique").on(
      table.waybookId,
      table.userId,
      table.channel,
      table.notificationType
    )
  ]
);

export const notificationEvents = pgTable(
  "notification_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notificationType: notificationTypeEnum("notification_type").notNull(),
    channel: notificationChannelEnum("channel").notNull(),
    payload: jsonb("payload"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    status: varchar("status", { length: 32 }).notNull().default("scheduled"),
    error: text("error"),
    createdAt: now()
  },
  (table) => [index("notification_events_user_scheduled_status_idx").on(table.userId, table.scheduledFor, table.status)]
);

export const tripStageState = pgTable("trip_stage_state", {
  waybookId: uuid("waybook_id")
    .primaryKey()
    .references(() => waybooks.id, { onDelete: "cascade" }),
  currentStage: tripStageEnum("current_stage").notNull().default("destinations"),
  stageMetaJson: jsonb("stage_meta_json"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const tripDestinations = pgTable(
  "trip_destinations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 220 }).notNull(),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    placeId: varchar("place_id", { length: 160 }),
    rationale: text("rationale"),
    status: destinationStatusEnum("status").notNull().default("proposed"),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: now()
  },
  (table) => [index("trip_destinations_waybook_status_created_idx").on(table.waybookId, table.status, table.createdAt)]
);

export const destinationVotes = pgTable(
  "destination_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => tripDestinations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vote: varchar("vote", { length: 8 }).notNull(),
    createdAt: now()
  },
  (table) => [
    uniqueIndex("destination_votes_destination_user_unique").on(table.destinationId, table.userId),
    index("destination_votes_destination_created_idx").on(table.destinationId, table.createdAt)
  ]
);

export const activityCandidates = pgTable(
  "activity_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    destinationId: uuid("destination_id")
      .notNull()
      .references(() => tripDestinations.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    description: text("description"),
    providerHint: varchar("provider_hint", { length: 80 }),
    sourceUrl: text("source_url"),
    estimatedCostMin: integer("estimated_cost_min"),
    estimatedCostMax: integer("estimated_cost_max"),
    durationMin: integer("duration_min"),
    status: activityStatusEnum("status").notNull().default("suggested"),
    confidenceScore: integer("confidence_score").notNull().default(50),
    researchPayloadJson: jsonb("research_payload_json"),
    createdAt: now()
  },
  (table) => [index("activity_candidates_waybook_status_created_idx").on(table.waybookId, table.status, table.createdAt)]
);

export const activityVotes = pgTable(
  "activity_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    activityCandidateId: uuid("activity_candidate_id")
      .notNull()
      .references(() => activityCandidates.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vote: varchar("vote", { length: 8 }).notNull(),
    createdAt: now()
  },
  (table) => [
    uniqueIndex("activity_votes_candidate_user_unique").on(table.activityCandidateId, table.userId),
    index("activity_votes_candidate_created_idx").on(table.activityCandidateId, table.createdAt)
  ]
);

export const tripChecklistItems = pgTable(
  "trip_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 220 }).notNull(),
    category: varchar("category", { length: 80 }),
    isCritical: boolean("is_critical").notNull().default(false),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: taskStatusEnum("status").notNull().default("todo"),
    notes: text("notes"),
    createdAt: now(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("trip_checklist_items_waybook_status_due_idx").on(table.waybookId, table.status, table.dueAt)]
);

export const tripMessages = pgTable(
  "trip_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waybookId: uuid("waybook_id")
      .notNull()
      .references(() => waybooks.id, { onDelete: "cascade" }),
    scope: messageScopeEnum("scope").notNull(),
    threadKey: varchar("thread_key", { length: 120 }).notNull(),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: now()
  },
  (table) => [
    index("trip_messages_waybook_thread_created_idx").on(table.waybookId, table.threadKey, table.createdAt),
    index("trip_messages_waybook_scope_created_idx").on(table.waybookId, table.scope, table.createdAt)
  ]
);

export const tripMessageReceipts = pgTable(
  "trip_message_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => tripMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: messageDeliveryStatusEnum("status").notNull().default("sent"),
    readAt: timestamp("read_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("trip_message_receipts_message_user_unique").on(table.messageId, table.userId),
    index("trip_message_receipts_user_status_idx").on(table.userId, table.status)
  ]
);

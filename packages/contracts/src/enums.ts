import { z } from "zod";

export const waybookVisibilitySchema = z.enum(["private", "link_only", "public"]);
export type WaybookVisibility = z.infer<typeof waybookVisibilitySchema>;

export const mediaTypeSchema = z.enum(["photo", "audio", "video"]);
export type MediaType = z.infer<typeof mediaTypeSchema>;

export const mediaStatusSchema = z.enum([
  "pending_upload",
  "uploaded",
  "processing",
  "ready",
  "failed"
]);
export type MediaStatus = z.infer<typeof mediaStatusSchema>;

export const itineraryTypeSchema = z.enum([
  "hotel",
  "restaurant",
  "attraction",
  "activity"
]);
export type ItineraryType = z.infer<typeof itineraryTypeSchema>;

export const reactionTypeSchema = z.enum([
  "worth_it",
  "skip_it",
  "family_friendly",
  "budget_friendly",
  "photogenic"
]);
export type ReactionType = z.infer<typeof reactionTypeSchema>;

export const promptTypeSchema = z.enum([
  "itinerary_gap",
  "location_gap",
  "day_reflection"
]);
export type PromptType = z.infer<typeof promptTypeSchema>;

export const waybookMemberRoleSchema = z.enum(["owner", "editor", "viewer"]);
export type WaybookMemberRole = z.infer<typeof waybookMemberRoleSchema>;

export const planningItemStatusSchema = z.enum([
  "idea",
  "shortlisted",
  "planned",
  "booked",
  "done",
  "skipped"
]);
export type PlanningItemStatus = z.infer<typeof planningItemStatusSchema>;

export const bookingTypeSchema = z.enum(["activity", "stay", "transport", "flight", "other"]);
export type BookingType = z.infer<typeof bookingTypeSchema>;

export const bookingStatusSchema = z.enum([
  "draft",
  "pending_checkout",
  "confirmed",
  "cancelled",
  "failed",
  "refunded"
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const expenseSplitMethodSchema = z.enum(["equal", "custom", "percentage", "shares"]);
export type ExpenseSplitMethod = z.infer<typeof expenseSplitMethodSchema>;

export const expenseStatusSchema = z.enum(["logged", "settled"]);
export type ExpenseStatus = z.infer<typeof expenseStatusSchema>;

export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

export const notificationChannelSchema = z.enum(["in_app", "email"]);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const notificationTypeSchema = z.enum([
  "task_due",
  "booking_deadline",
  "day_plan_start",
  "summary_prompt"
]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const tripStageSchema = z.enum([
  "destinations",
  "activities",
  "booking",
  "itinerary",
  "prep",
  "capture",
  "replay"
]);
export type TripStage = z.infer<typeof tripStageSchema>;

export const stageStatusSchema = z.enum(["locked", "available", "complete"]);
export type StageStatus = z.infer<typeof stageStatusSchema>;

export const destinationStatusSchema = z.enum(["proposed", "locked", "rejected"]);
export type DestinationStatus = z.infer<typeof destinationStatusSchema>;

export const activityStatusSchema = z.enum(["suggested", "shortlisted", "locked", "discarded"]);
export type ActivityStatus = z.infer<typeof activityStatusSchema>;

export const messageScopeSchema = z.enum(["trip", "dm"]);
export type MessageScope = z.infer<typeof messageScopeSchema>;

export const messageDeliveryStatusSchema = z.enum(["sent", "failed", "read"]);
export type MessageDeliveryStatus = z.infer<typeof messageDeliveryStatusSchema>;

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

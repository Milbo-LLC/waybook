import { z } from "zod";

export const waybookVisibilitySchema = z.enum(["private", "link_only", "public"]);
export type WaybookVisibility = z.infer<typeof waybookVisibilitySchema>;

export const mediaTypeSchema = z.enum(["photo", "audio"]);
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

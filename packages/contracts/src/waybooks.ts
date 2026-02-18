import { z } from "zod";
import { cursorPageSchema, idSchema, isoDateTimeSchema } from "./common.js";
import { waybookVisibilitySchema } from "./enums.js";
import { entryDtoSchema } from "./entries.js";

export const waybookDtoSchema = z.object({
  id: idSchema,
  userId: idSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(5000).nullable(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  coverMediaId: idSchema.nullable(),
  visibility: waybookVisibilitySchema,
  publicSlug: z.string().min(6).max(120).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type WaybookDTO = z.infer<typeof waybookDtoSchema>;

export const createWaybookInputSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(5000).nullable(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  visibility: waybookVisibilitySchema.default("private")
});
export type CreateWaybookInput = z.infer<typeof createWaybookInputSchema>;

export const updateWaybookInputSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(5000).nullable().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  coverMediaId: idSchema.nullable().optional(),
  visibility: waybookVisibilitySchema.optional()
});
export type UpdateWaybookInput = z.infer<typeof updateWaybookInputSchema>;

export const listWaybooksResponseSchema = z.object({
  items: z.array(waybookDtoSchema),
  page: cursorPageSchema
});
export type ListWaybooksResponse = z.infer<typeof listWaybooksResponseSchema>;

export const timelineDaySchema = z.object({
  date: z.string().date(),
  entries: z.array(entryDtoSchema)
});
export type TimelineDayDTO = z.infer<typeof timelineDaySchema>;

export const timelineResponseSchema = z.object({
  waybook: waybookDtoSchema,
  days: z.array(timelineDaySchema)
});
export type TimelineResponse = z.infer<typeof timelineResponseSchema>;

export const createShareLinkResponseSchema = z.object({
  id: idSchema,
  token: z.string().min(16),
  url: z.string().url(),
  expiresAt: isoDateTimeSchema.nullable()
});
export type CreateShareLinkResponse = z.infer<typeof createShareLinkResponseSchema>;

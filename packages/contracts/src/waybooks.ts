import { z } from "zod";
import { cursorPageSchema, idSchema, isoDateTimeSchema } from "./common.js";
import { daySummaryDtoSchema, publicReactionDtoSchema } from "./experience.js";
import { waybookMemberRoleSchema, waybookVisibilitySchema } from "./enums.js";
import { entryDtoSchema } from "./entries.js";

export const waybookDtoSchema = z.object({
  id: idSchema,
  userId: idSchema,
  title: z.string().min(1).max(160),
  description: z.string().max(5000).nullable(),
  startDate: z.string().date().nullable(),
  endDate: z.string().date().nullable(),
  timeframeLabel: z.string().max(120).nullable(),
  earliestStartDate: z.string().date().nullable(),
  latestEndDate: z.string().date().nullable(),
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
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  timeframeLabel: z.string().max(120).nullable().optional(),
  earliestStartDate: z.string().date().nullable().optional(),
  latestEndDate: z.string().date().nullable().optional(),
  visibility: waybookVisibilitySchema.default("private")
}).superRefine((value, ctx) => {
  if (!value.startDate && !value.endDate && !value.timeframeLabel && !value.earliestStartDate && !value.latestEndDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startDate"],
      message: "Provide exact dates or a general timeframe."
    });
  }
  if ((value.startDate && !value.endDate) || (!value.startDate && value.endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "Provide both start and end dates for exact date mode."
    });
  }
  if (value.startDate && value.endDate && value.endDate < value.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "End date must be on or after start date."
    });
  }
  if (value.earliestStartDate && value.latestEndDate && value.latestEndDate < value.earliestStartDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["latestEndDate"],
      message: "Latest end must be on or after earliest start."
    });
  }
});
export type CreateWaybookInput = z.infer<typeof createWaybookInputSchema>;

export const updateWaybookInputSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  description: z.string().max(5000).nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  timeframeLabel: z.string().max(120).nullable().optional(),
  earliestStartDate: z.string().date().nullable().optional(),
  latestEndDate: z.string().date().nullable().optional(),
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
  entries: z.array(entryDtoSchema),
  summary: daySummaryDtoSchema.nullable()
});
export type TimelineDayDTO = z.infer<typeof timelineDaySchema>;

export const timelineResponseSchema = z.object({
  waybook: waybookDtoSchema,
  accessRole: waybookMemberRoleSchema,
  days: z.array(timelineDaySchema)
});
export type TimelineResponse = z.infer<typeof timelineResponseSchema>;

export const playbookDayStepSchema = z.object({
  entry: entryDtoSchema,
  reactions: z.array(publicReactionDtoSchema),
  confidenceScore: z.number().int().min(0).max(100)
});
export type PlaybookDayStep = z.infer<typeof playbookDayStepSchema>;

export const playbookDaySchema = z.object({
  date: z.string().date(),
  summary: daySummaryDtoSchema.nullable(),
  steps: z.array(playbookDayStepSchema)
});
export type PlaybookDay = z.infer<typeof playbookDaySchema>;

export const playbookResponseSchema = z.object({
  waybook: waybookDtoSchema,
  days: z.array(playbookDaySchema)
});
export type PlaybookResponse = z.infer<typeof playbookResponseSchema>;

export const createShareLinkResponseSchema = z.object({
  id: idSchema,
  token: z.string().min(16),
  url: z.string().url(),
  expiresAt: isoDateTimeSchema.nullable()
});
export type CreateShareLinkResponse = z.infer<typeof createShareLinkResponseSchema>;

export const deleteWaybookInputSchema = z.object({
  confirmationText: z.string().min(1)
});
export type DeleteWaybookInput = z.infer<typeof deleteWaybookInputSchema>;

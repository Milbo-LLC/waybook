import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common.js";
import { reactionTypeSchema } from "./enums.js";

export const entryRatingDtoSchema = z.object({
  id: idSchema,
  entryId: idSchema,
  userId: idSchema,
  ratingOverall: z.number().int().min(1).max(5),
  valueForMoney: z.number().int().min(1).max(5),
  wouldRepeat: z.boolean(),
  difficulty: z.number().int().min(1).max(5).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type EntryRatingDTO = z.infer<typeof entryRatingDtoSchema>;

export const upsertEntryRatingInputSchema = z.object({
  ratingOverall: z.number().int().min(1).max(5),
  valueForMoney: z.number().int().min(1).max(5),
  wouldRepeat: z.boolean(),
  difficulty: z.number().int().min(1).max(5).nullable().optional()
});
export type UpsertEntryRatingInput = z.infer<typeof upsertEntryRatingInputSchema>;

export const daySummaryDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  summaryDate: z.string().date(),
  summaryText: z.string().max(5000).nullable(),
  topMomentEntryId: idSchema.nullable(),
  moodScore: z.number().int().min(1).max(5).nullable(),
  energyScore: z.number().int().min(1).max(5).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type DaySummaryDTO = z.infer<typeof daySummaryDtoSchema>;

export const upsertDaySummaryInputSchema = z.object({
  summaryDate: z.string().date(),
  summaryText: z.string().max(5000).nullable().optional(),
  topMomentEntryId: idSchema.nullable().optional(),
  moodScore: z.number().int().min(1).max(5).nullable().optional(),
  energyScore: z.number().int().min(1).max(5).nullable().optional()
});
export type UpsertDaySummaryInput = z.infer<typeof upsertDaySummaryInputSchema>;

export const entryGuidanceDtoSchema = z.object({
  id: idSchema,
  entryId: idSchema,
  isMustDo: z.boolean(),
  estimatedCostMin: z.number().int().nullable(),
  estimatedCostMax: z.number().int().nullable(),
  timeNeededMinutes: z.number().int().nullable(),
  bestTimeOfDay: z.string().max(80).nullable(),
  tipsText: z.string().max(5000).nullable(),
  accessibilityNotes: z.string().max(5000).nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type EntryGuidanceDTO = z.infer<typeof entryGuidanceDtoSchema>;

export const upsertEntryGuidanceInputSchema = z.object({
  isMustDo: z.boolean().optional(),
  estimatedCostMin: z.number().int().nullable().optional(),
  estimatedCostMax: z.number().int().nullable().optional(),
  timeNeededMinutes: z.number().int().nullable().optional(),
  bestTimeOfDay: z.string().max(80).nullable().optional(),
  tipsText: z.string().max(5000).nullable().optional(),
  accessibilityNotes: z.string().max(5000).nullable().optional()
});
export type UpsertEntryGuidanceInput = z.infer<typeof upsertEntryGuidanceInputSchema>;

export const publicReactionDtoSchema = z.object({
  id: idSchema,
  entryId: idSchema,
  reactionType: reactionTypeSchema,
  note: z.string().max(500).nullable(),
  createdAt: isoDateTimeSchema
});
export type PublicReactionDTO = z.infer<typeof publicReactionDtoSchema>;

export const createPublicReactionInputSchema = z.object({
  reactionType: reactionTypeSchema,
  note: z.string().max(500).nullable().optional()
});
export type CreatePublicReactionInput = z.infer<typeof createPublicReactionInputSchema>;

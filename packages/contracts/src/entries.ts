import { z } from "zod";
import { cursorPageSchema, idSchema, isoDateTimeSchema, optionalLocationSchema } from "./common.js";
import { entryGuidanceDtoSchema, entryRatingDtoSchema } from "./experience.js";
import { mediaDtoSchema } from "./media.js";

export const entryDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  authorUserId: idSchema,
  capturedAt: isoDateTimeSchema,
  textContent: z.string().max(5000).nullable(),
  location: optionalLocationSchema,
  media: z.array(mediaDtoSchema),
  itineraryEventIds: z.array(idSchema).default([]),
  bookingSummaryTags: z.array(z.string()).default([]),
  rating: entryRatingDtoSchema.nullable(),
  guidance: entryGuidanceDtoSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type EntryDTO = z.infer<typeof entryDtoSchema>;

export const createEntryInputSchema = z.object({
  capturedAt: isoDateTimeSchema,
  textContent: z.string().max(5000).nullable(),
  location: optionalLocationSchema,
  idempotencyKey: z.string().min(8).max(128)
});
export type CreateEntryInput = z.infer<typeof createEntryInputSchema>;

export const updateEntryInputSchema = z.object({
  textContent: z.string().max(5000).nullable().optional(),
  location: optionalLocationSchema.optional(),
  capturedAt: isoDateTimeSchema.optional()
});
export type UpdateEntryInput = z.infer<typeof updateEntryInputSchema>;

export const listEntriesResponseSchema = z.object({
  items: z.array(entryDtoSchema),
  page: cursorPageSchema
});
export type ListEntriesResponse = z.infer<typeof listEntriesResponseSchema>;

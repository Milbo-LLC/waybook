import { z } from "zod";

export const idSchema = z.string().uuid();
export const isoDateTimeSchema = z.string().datetime({ offset: true });
export const cursorPageSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean()
});

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  placeName: z.string().min(1).max(200).nullable()
});

export const optionalLocationSchema = locationSchema.nullable();

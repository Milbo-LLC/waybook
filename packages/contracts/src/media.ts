import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common";
import { mediaStatusSchema, mediaTypeSchema } from "./enums";

export const mediaDtoSchema = z.object({
  id: idSchema,
  entryId: idSchema,
  type: mediaTypeSchema,
  status: mediaStatusSchema,
  mimeType: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().nonnegative().nullable(),
  height: z.number().int().nonnegative().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  originalUrl: z.string().url().nullable(),
  displayUrl: z.string().url().nullable(),
  createdAt: isoDateTimeSchema
});
export type MediaDTO = z.infer<typeof mediaDtoSchema>;

export const createUploadUrlInputSchema = z.object({
  type: mediaTypeSchema,
  mimeType: z.string().min(1),
  bytes: z.number().int().positive(),
  fileName: z.string().min(1),
  idempotencyKey: z.string().min(8).max(128)
});
export type CreateUploadUrlInput = z.infer<typeof createUploadUrlInputSchema>;

export const createUploadUrlResponseSchema = z.object({
  mediaId: idSchema,
  uploadUrl: z.string().url(),
  storageKey: z.string().min(1),
  expiresAt: isoDateTimeSchema,
  requiredHeaders: z.record(z.string())
});
export type CreateUploadUrlResponse = z.infer<typeof createUploadUrlResponseSchema>;

export const completeUploadInputSchema = z.object({
  idempotencyKey: z.string().min(8).max(128)
});
export type CompleteUploadInput = z.infer<typeof completeUploadInputSchema>;

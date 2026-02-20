import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common.js";
import { promptTypeSchema } from "./enums.js";

export const promptDtoSchema = z.object({
  id: idSchema,
  userId: idSchema,
  waybookId: idSchema,
  promptType: promptTypeSchema,
  triggerReason: z.string().max(120),
  scheduledFor: isoDateTimeSchema,
  shownAt: isoDateTimeSchema.nullable(),
  dismissedAt: isoDateTimeSchema.nullable(),
  actedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema
});
export type PromptDTO = z.infer<typeof promptDtoSchema>;

export const ackPromptInputSchema = z.object({
  promptId: idSchema,
  action: z.enum(["shown", "dismissed", "acted"])
});
export type AckPromptInput = z.infer<typeof ackPromptInputSchema>;

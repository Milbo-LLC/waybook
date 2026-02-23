import { z } from "zod";
import { idSchema, isoDateTimeSchema, locationSchema } from "./common.js";
import {
  activityStatusSchema,
  bookingTypeSchema,
  destinationStatusSchema,
  messageDeliveryStatusSchema,
  messageScopeSchema,
  stageStatusSchema,
  tripStageSchema
} from "./enums.js";

export const stageItemSchema = z.object({
  stage: tripStageSchema,
  status: stageStatusSchema,
  missingRequirements: z.array(z.string())
});
export type StageItemDTO = z.infer<typeof stageItemSchema>;

export const tripStageStateDtoSchema = z.object({
  waybookId: idSchema,
  currentStage: tripStageSchema,
  stages: z.array(stageItemSchema),
  updatedAt: isoDateTimeSchema
});
export type TripStageStateDTO = z.infer<typeof tripStageStateDtoSchema>;

export const destinationDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  createdByUserId: idSchema,
  name: z.string(),
  location: locationSchema.nullable(),
  placeId: z.string().nullable(),
  rationale: z.string().nullable(),
  status: destinationStatusSchema,
  votesUp: z.number().int().nonnegative(),
  votesDown: z.number().int().nonnegative(),
  lockedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema
});
export type DestinationDTO = z.infer<typeof destinationDtoSchema>;
export const listDestinationsResponseSchema = z.object({ items: z.array(destinationDtoSchema) });
export type ListDestinationsResponse = z.infer<typeof listDestinationsResponseSchema>;

export const createDestinationInputSchema = z.object({
  name: z.string().min(1).max(220),
  location: locationSchema.nullable().optional(),
  placeId: z.string().max(160).nullable().optional(),
  rationale: z.string().max(5000).nullable().optional()
});
export type CreateDestinationInput = z.infer<typeof createDestinationInputSchema>;

export const createDestinationVoteInputSchema = z.object({
  vote: z.enum(["up", "down"])
});
export type CreateDestinationVoteInput = z.infer<typeof createDestinationVoteInputSchema>;

export const activityCandidateDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  destinationId: idSchema,
  title: z.string(),
  description: z.string().nullable(),
  providerHint: z.string().nullable(),
  sourceUrl: z.string().url().nullable(),
  estimatedCostMin: z.number().int().nullable(),
  estimatedCostMax: z.number().int().nullable(),
  durationMin: z.number().int().nullable(),
  status: activityStatusSchema,
  confidenceScore: z.number().int().min(0).max(100),
  researchPayload: z.unknown().nullable(),
  votesUp: z.number().int().nonnegative(),
  votesDown: z.number().int().nonnegative(),
  createdAt: isoDateTimeSchema
});
export type ActivityCandidateDTO = z.infer<typeof activityCandidateDtoSchema>;
export const listActivityCandidatesResponseSchema = z.object({ items: z.array(activityCandidateDtoSchema) });
export type ListActivityCandidatesResponse = z.infer<typeof listActivityCandidatesResponseSchema>;

export const runActivityResearchInputSchema = z.object({
  maxPerDestination: z.number().int().min(1).max(10).default(5)
});
export type RunActivityResearchInput = z.infer<typeof runActivityResearchInputSchema>;

export const createActivityVoteInputSchema = z.object({
  vote: z.enum(["up", "down"])
});
export type CreateActivityVoteInput = z.infer<typeof createActivityVoteInputSchema>;

export const updateActivityStatusInputSchema = z.object({
  status: activityStatusSchema
});
export type UpdateActivityStatusInput = z.infer<typeof updateActivityStatusInputSchema>;

export const stayRecommendationDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  location: z.string(),
  provider: z.string(),
  sourceUrl: z.string().url(),
  estimatedNightlyCostMin: z.number().int().nullable(),
  estimatedNightlyCostMax: z.number().int().nullable(),
  rationale: z.string()
});
export type StayRecommendationDTO = z.infer<typeof stayRecommendationDtoSchema>;
export const listStayRecommendationsResponseSchema = z.object({ items: z.array(stayRecommendationDtoSchema) });
export type ListStayRecommendationsResponse = z.infer<typeof listStayRecommendationsResponseSchema>;

export const embeddedCheckoutSessionInputSchema = z.object({
  returnUrl: z.string().url(),
  cancelUrl: z.string().url().optional()
});
export type EmbeddedCheckoutSessionInput = z.infer<typeof embeddedCheckoutSessionInputSchema>;

export const embeddedCheckoutSessionResponseSchema = z.object({
  checkoutUrl: z.string().url(),
  providerReference: z.string()
});
export type EmbeddedCheckoutSessionResponse = z.infer<typeof embeddedCheckoutSessionResponseSchema>;

export const embeddedCheckoutCompleteInputSchema = z.object({
  providerReference: z.string().min(1),
  status: z.enum(["pending_checkout", "confirmed", "cancelled", "failed"]).default("confirmed"),
  confirmationCode: z.string().max(120).nullable().optional()
});
export type EmbeddedCheckoutCompleteInput = z.infer<typeof embeddedCheckoutCompleteInputSchema>;

export const itineraryGenerationResultSchema = z.object({
  generatedCount: z.number().int().nonnegative(),
  generationVersion: z.number().int().nonnegative()
});
export type ItineraryGenerationResultDTO = z.infer<typeof itineraryGenerationResultSchema>;

export const checklistItemDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  title: z.string(),
  category: z.string().nullable(),
  isCritical: z.boolean(),
  assignedUserId: idSchema.nullable(),
  dueAt: isoDateTimeSchema.nullable(),
  status: z.enum(["todo", "in_progress", "done"]),
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type ChecklistItemDTO = z.infer<typeof checklistItemDtoSchema>;
export const listChecklistItemsResponseSchema = z.object({ items: z.array(checklistItemDtoSchema) });
export type ListChecklistItemsResponse = z.infer<typeof listChecklistItemsResponseSchema>;

export const createChecklistItemInputSchema = z.object({
  title: z.string().min(1).max(220),
  category: z.string().max(80).nullable().optional(),
  isCritical: z.boolean().default(false),
  assignedUserId: idSchema.nullable().optional(),
  dueAt: isoDateTimeSchema.nullable().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  notes: z.string().max(5000).nullable().optional()
});
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemInputSchema>;

export const updateChecklistItemInputSchema = createChecklistItemInputSchema.partial();
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemInputSchema>;

export const readinessScoreDtoSchema = z.object({
  score: z.number().int().min(0).max(100),
  criticalRemaining: z.number().int().nonnegative(),
  totalRemaining: z.number().int().nonnegative(),
  daysUntilTrip: z.number().int()
});
export type ReadinessScoreDTO = z.infer<typeof readinessScoreDtoSchema>;

export const tripMessageDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  scope: messageScopeSchema,
  threadKey: z.string(),
  senderUserId: idSchema,
  body: z.string(),
  createdAt: isoDateTimeSchema
});
export type TripMessageDTO = z.infer<typeof tripMessageDtoSchema>;
export const listTripMessagesResponseSchema = z.object({ items: z.array(tripMessageDtoSchema) });
export type ListTripMessagesResponse = z.infer<typeof listTripMessagesResponseSchema>;

export const createTripMessageInputSchema = z.object({
  scope: messageScopeSchema,
  threadKey: z.string().min(1).max(120),
  body: z.string().min(1).max(5000)
});
export type CreateTripMessageInput = z.infer<typeof createTripMessageInputSchema>;

export const messageReceiptDtoSchema = z.object({
  id: idSchema,
  messageId: idSchema,
  userId: idSchema,
  status: messageDeliveryStatusSchema,
  readAt: isoDateTimeSchema.nullable()
});
export type MessageReceiptDTO = z.infer<typeof messageReceiptDtoSchema>;

export const dmThreadDtoSchema = z.object({
  threadKey: z.string(),
  participantIds: z.array(idSchema),
  lastMessageAt: isoDateTimeSchema.nullable()
});
export type DMThreadDTO = z.infer<typeof dmThreadDtoSchema>;
export const listDmThreadsResponseSchema = z.object({ items: z.array(dmThreadDtoSchema) });
export type ListDMThreadsResponse = z.infer<typeof listDmThreadsResponseSchema>;

export const markMessageReadInputSchema = z.object({
  status: messageDeliveryStatusSchema.default("read")
});
export type MarkMessageReadInput = z.infer<typeof markMessageReadInputSchema>;

export const staysRecommendInputSchema = z.object({
  budgetTier: z.string().max(40).nullable().optional(),
  bookingType: bookingTypeSchema.default("stay")
});
export type StaysRecommendInput = z.infer<typeof staysRecommendInputSchema>;

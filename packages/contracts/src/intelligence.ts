import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./common.js";
import { expenseSplitMethodSchema, tripStageSchema } from "./enums.js";

export const productEventTypeSchema = z.enum([
  "trip_created",
  "ai_prompt_started",
  "scenario_generated",
  "scenario_locked",
  "booking_action_clicked",
  "replay_published"
]);
export type ProductEventType = z.infer<typeof productEventTypeSchema>;

export const trackProductEventInputSchema = z.object({
  eventType: productEventTypeSchema,
  waybookId: idSchema.nullable().optional(),
  metadata: z.unknown().optional()
});
export type TrackProductEventInput = z.infer<typeof trackProductEventInputSchema>;

export const assistantTripDraftSchema = z.object({
  title: z.string().max(160).nullable(),
  description: z.string().max(5000).nullable(),
  startDate: z.string().date().nullable(),
  endDate: z.string().date().nullable(),
  timeframeLabel: z.string().max(120).nullable(),
  earliestStartDate: z.string().date().nullable(),
  latestEndDate: z.string().date().nullable(),
  budgetAmountMinor: z.number().int().nullable(),
  budgetCurrency: z.string().max(8).nullable(),
  splitMethod: expenseSplitMethodSchema.nullable()
});
export type AssistantTripDraft = z.infer<typeof assistantTripDraftSchema>;

export const assistantSessionStatusSchema = z.enum(["active", "closed"]);
export type AssistantSessionStatus = z.infer<typeof assistantSessionStatusSchema>;

export const assistantMessageRoleSchema = z.enum(["user", "assistant"]);
export type AssistantMessageRole = z.infer<typeof assistantMessageRoleSchema>;

export const assistantSessionDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  userId: idSchema,
  status: assistantSessionStatusSchema,
  objective: z.string().nullable(),
  draft: assistantTripDraftSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type AssistantSessionDTO = z.infer<typeof assistantSessionDtoSchema>;

export const assistantMessageDtoSchema = z.object({
  id: idSchema,
  sessionId: idSchema,
  role: assistantMessageRoleSchema,
  content: z.string(),
  metadata: z.unknown().nullable(),
  createdAt: isoDateTimeSchema
});
export type AssistantMessageDTO = z.infer<typeof assistantMessageDtoSchema>;

export const createAssistantSessionInputSchema = z.object({
  objective: z.string().max(500).nullable().optional(),
  message: z.string().min(1).max(4000).optional()
});
export type CreateAssistantSessionInput = z.infer<typeof createAssistantSessionInputSchema>;

export const createAssistantMessageInputSchema = z.object({
  content: z.string().min(1).max(4000),
  stageHint: tripStageSchema.nullable().optional()
});
export type CreateAssistantMessageInput = z.infer<typeof createAssistantMessageInputSchema>;

export const assistantSessionResponseSchema = z.object({
  session: assistantSessionDtoSchema,
  messages: z.array(assistantMessageDtoSchema),
  suggestions: z.array(z.string())
});
export type AssistantSessionResponse = z.infer<typeof assistantSessionResponseSchema>;

export const mapMarkerEntityTypeSchema = z.enum([
  "destination",
  "activity",
  "planning_item",
  "itinerary_item",
  "entry"
]);
export type MapMarkerEntityType = z.infer<typeof mapMarkerEntityTypeSchema>;

export const mapMarkerStatusSchema = z.enum(["proposed", "locked", "confirmed", "captured", "active"]);
export type MapMarkerStatus = z.infer<typeof mapMarkerStatusSchema>;

export const mapRouteTravelModeSchema = z.enum(["walk", "drive", "transit", "mixed"]);
export type MapRouteTravelMode = z.infer<typeof mapRouteTravelModeSchema>;

const mapRoutePointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const mapMarkerDtoSchema = z.object({
  entityType: mapMarkerEntityTypeSchema,
  entityId: idSchema,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  status: mapMarkerStatusSchema,
  label: z.string(),
  subtitle: z.string().nullable()
});
export type MapMarkerDTO = z.infer<typeof mapMarkerDtoSchema>;

export const mapRouteDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  travelMode: mapRouteTravelModeSchema,
  coordinates: z.array(mapRoutePointSchema)
});
export type MapRouteDTO = z.infer<typeof mapRouteDtoSchema>;

export const mapLayerDtoSchema = z.object({
  markers: z.array(mapMarkerDtoSchema),
  routes: z.array(mapRouteDtoSchema)
});
export type MapLayerDTO = z.infer<typeof mapLayerDtoSchema>;

export const aiSummaryCitationSourceSchema = z.enum(["destination", "activity", "booking", "entry", "checklist"]);
export type AiSummaryCitationSource = z.infer<typeof aiSummaryCitationSourceSchema>;

export const aiSummaryCitationDtoSchema = z.object({
  sourceType: aiSummaryCitationSourceSchema,
  sourceId: idSchema.nullable(),
  label: z.string()
});
export type AiSummaryCitationDTO = z.infer<typeof aiSummaryCitationDtoSchema>;

export const aiSummaryResponseSchema = z.object({
  summary: z.string(),
  citations: z.array(aiSummaryCitationDtoSchema),
  generatedAt: isoDateTimeSchema
});
export type AiSummaryResponse = z.infer<typeof aiSummaryResponseSchema>;

export const scenarioTypeSchema = z.enum(["balanced", "budget", "adventure"]);
export type ScenarioType = z.infer<typeof scenarioTypeSchema>;

export const scenarioItemTypeSchema = z.enum(["destination", "activity", "booking", "prep"]);
export type ScenarioItemType = z.infer<typeof scenarioItemTypeSchema>;

export const scenarioItemDtoSchema = z.object({
  id: idSchema,
  scenarioId: idSchema,
  itemType: scenarioItemTypeSchema,
  sourceId: idSchema.nullable(),
  label: z.string(),
  details: z.string().nullable(),
  score: z.number().int().nullable(),
  orderIndex: z.number().int().nonnegative(),
  isLocked: z.boolean(),
  createdAt: isoDateTimeSchema
});
export type ScenarioItemDTO = z.infer<typeof scenarioItemDtoSchema>;

export const scenarioDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  scenarioType: scenarioTypeSchema,
  title: z.string(),
  description: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  items: z.array(scenarioItemDtoSchema)
});
export type ScenarioDTO = z.infer<typeof scenarioDtoSchema>;

export const listScenariosResponseSchema = z.object({
  items: z.array(scenarioDtoSchema)
});
export type ListScenariosResponse = z.infer<typeof listScenariosResponseSchema>;

export const generateScenariosInputSchema = z.object({
  prompt: z.string().max(500).nullable().optional()
});
export type GenerateScenariosInput = z.infer<typeof generateScenariosInputSchema>;

export const lockScenarioInputSchema = z.object({
  itemIds: z.array(idSchema).min(1).optional()
});
export type LockScenarioInput = z.infer<typeof lockScenarioInputSchema>;

export const decisionScopeSchema = z.enum(["destinations", "activities", "planning"]);
export type DecisionScope = z.infer<typeof decisionScopeSchema>;

export const decisionRoundOptionDtoSchema = z.object({
  label: z.string(),
  votesUp: z.number().int().nonnegative(),
  votesDown: z.number().int().nonnegative(),
  score: z.number().int()
});
export type DecisionRoundOptionDTO = z.infer<typeof decisionRoundOptionDtoSchema>;

export const decisionRoundDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  topic: z.string(),
  scope: decisionScopeSchema,
  summary: z.string(),
  recommendation: z.string(),
  options: z.array(decisionRoundOptionDtoSchema),
  createdAt: isoDateTimeSchema
});
export type DecisionRoundDTO = z.infer<typeof decisionRoundDtoSchema>;

export const listDecisionRoundsResponseSchema = z.object({
  items: z.array(decisionRoundDtoSchema)
});
export type ListDecisionRoundsResponse = z.infer<typeof listDecisionRoundsResponseSchema>;

export const createDecisionRoundInputSchema = z.object({
  topic: z.string().min(1).max(220).optional(),
  scope: decisionScopeSchema.default("planning"),
  maxOptions: z.number().int().min(2).max(8).default(5)
});
export type CreateDecisionRoundInput = z.infer<typeof createDecisionRoundInputSchema>;

export const tripDigestRiskLevelSchema = z.enum(["low", "medium", "high"]);
export type TripDigestRiskLevel = z.infer<typeof tripDigestRiskLevelSchema>;

export const tripDigestRiskFlagSchema = z.object({
  level: tripDigestRiskLevelSchema,
  message: z.string()
});
export type TripDigestRiskFlag = z.infer<typeof tripDigestRiskFlagSchema>;

export const tripDigestActionSchema = z.object({
  id: z.string(),
  title: z.string(),
  reason: z.string(),
  ctaLabel: z.string()
});
export type TripDigestAction = z.infer<typeof tripDigestActionSchema>;

export const tripDigestDtoSchema = z.object({
  waybookId: idSchema,
  date: z.string().date(),
  currentStage: tripStageSchema,
  highlights: z.array(z.string()),
  contingencySuggestions: z.array(z.string()),
  riskFlags: z.array(tripDigestRiskFlagSchema),
  nextActions: z.array(tripDigestActionSchema)
});
export type TripDigestDTO = z.infer<typeof tripDigestDtoSchema>;

export const replayBlueprintSectionSchema = z.object({
  title: z.string(),
  items: z.array(z.string())
});
export type ReplayBlueprintSection = z.infer<typeof replayBlueprintSectionSchema>;

export const replayBlueprintDtoSchema = z.object({
  waybookId: idSchema,
  headline: z.string(),
  summary: z.string(),
  lessons: z.array(z.string()),
  templatePrompt: z.string(),
  sections: z.array(replayBlueprintSectionSchema),
  createdAt: isoDateTimeSchema
});
export type ReplayBlueprintDTO = z.infer<typeof replayBlueprintDtoSchema>;


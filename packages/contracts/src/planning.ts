import { z } from "zod";
import { idSchema, isoDateTimeSchema, locationSchema } from "./common.js";
import {
  bookingStatusSchema,
  bookingTypeSchema,
  expenseSplitMethodSchema,
  expenseStatusSchema,
  notificationChannelSchema,
  notificationTypeSchema,
  planningItemStatusSchema,
  taskPrioritySchema,
  taskStatusSchema
} from "./enums.js";

const optionalLocationSchema = locationSchema.nullable().optional();

export const planningItemDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  createdByUserId: idSchema,
  title: z.string().min(1).max(220),
  description: z.string().nullable(),
  category: z.string().nullable(),
  status: planningItemStatusSchema,
  location: optionalLocationSchema,
  estimatedCostMin: z.number().int().nullable(),
  estimatedCostMax: z.number().int().nullable(),
  sourceUrl: z.string().url().nullable(),
  providerHint: z.string().nullable(),
  votesUp: z.number().int().nonnegative().default(0),
  votesDown: z.number().int().nonnegative().default(0),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type PlanningItemDTO = z.infer<typeof planningItemDtoSchema>;
export const listPlanningItemsResponseSchema = z.object({ items: z.array(planningItemDtoSchema) });
export type ListPlanningItemsResponse = z.infer<typeof listPlanningItemsResponseSchema>;

export const createPlanningItemInputSchema = z.object({
  title: z.string().min(1).max(220),
  description: z.string().max(5000).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  status: planningItemStatusSchema.optional(),
  location: optionalLocationSchema,
  estimatedCostMin: z.number().int().nullable().optional(),
  estimatedCostMax: z.number().int().nullable().optional(),
  sourceUrl: z.string().url().nullable().optional(),
  providerHint: z.string().max(80).nullable().optional()
});
export type CreatePlanningItemInput = z.infer<typeof createPlanningItemInputSchema>;

export const updatePlanningItemInputSchema = createPlanningItemInputSchema.partial();
export type UpdatePlanningItemInput = z.infer<typeof updatePlanningItemInputSchema>;

export const planningCommentDtoSchema = z.object({
  id: idSchema,
  planningItemId: idSchema,
  userId: idSchema,
  content: z.string().min(1),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type PlanningCommentDTO = z.infer<typeof planningCommentDtoSchema>;
export const listPlanningCommentsResponseSchema = z.object({ items: z.array(planningCommentDtoSchema) });
export type ListPlanningCommentsResponse = z.infer<typeof listPlanningCommentsResponseSchema>;

export const createPlanningVoteInputSchema = z.object({
  vote: z.enum(["up", "down"])
});
export type CreatePlanningVoteInput = z.infer<typeof createPlanningVoteInputSchema>;

export const createPlanningCommentInputSchema = z.object({
  content: z.string().min(1).max(5000)
});
export type CreatePlanningCommentInput = z.infer<typeof createPlanningCommentInputSchema>;

export const tripTaskDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  title: z.string().min(1).max(220),
  description: z.string().nullable(),
  assignedUserId: idSchema.nullable(),
  dueAt: isoDateTimeSchema.nullable(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  createdByUserId: idSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type TripTaskDTO = z.infer<typeof tripTaskDtoSchema>;
export const listTasksResponseSchema = z.object({ items: z.array(tripTaskDtoSchema) });
export type ListTasksResponse = z.infer<typeof listTasksResponseSchema>;

export const createTripTaskInputSchema = z.object({
  title: z.string().min(1).max(220),
  description: z.string().max(5000).nullable().optional(),
  assignedUserId: idSchema.nullable().optional(),
  dueAt: isoDateTimeSchema.nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional()
});
export type CreateTripTaskInput = z.infer<typeof createTripTaskInputSchema>;

export const updateTripTaskInputSchema = createTripTaskInputSchema.partial();
export type UpdateTripTaskInput = z.infer<typeof updateTripTaskInputSchema>;
export type UpdateTaskInput = UpdateTripTaskInput;

export const bookingRecordDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  planningItemId: idSchema.nullable(),
  type: bookingTypeSchema,
  provider: z.string().nullable(),
  providerBookingId: z.string().nullable(),
  title: z.string().min(1).max(220),
  bookedForStart: isoDateTimeSchema.nullable(),
  bookedForEnd: isoDateTimeSchema.nullable(),
  bookingStatus: bookingStatusSchema,
  checkoutUrl: z.string().url().nullable(),
  confirmationCode: z.string().nullable(),
  bookedByUserId: idSchema.nullable(),
  currency: z.string().nullable(),
  totalAmountMinor: z.number().int().nullable(),
  refundPolicyText: z.string().nullable(),
  cancellationDeadline: isoDateTimeSchema.nullable(),
  rawPayload: z.unknown().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type BookingRecordDTO = z.infer<typeof bookingRecordDtoSchema>;
export const listWaybookBookingsResponseSchema = z.object({ items: z.array(bookingRecordDtoSchema) });
export type ListWaybookBookingsResponse = z.infer<typeof listWaybookBookingsResponseSchema>;

export const createBookingInputSchema = z.object({
  planningItemId: idSchema.nullable().optional(),
  type: bookingTypeSchema,
  provider: z.string().max(80).nullable().optional(),
  providerBookingId: z.string().max(160).nullable().optional(),
  title: z.string().min(1).max(220),
  bookedForStart: isoDateTimeSchema.nullable().optional(),
  bookedForEnd: isoDateTimeSchema.nullable().optional(),
  bookingStatus: bookingStatusSchema.optional(),
  checkoutUrl: z.string().url().nullable().optional(),
  confirmationCode: z.string().max(120).nullable().optional(),
  bookedByUserId: idSchema.nullable().optional(),
  currency: z.string().max(8).nullable().optional(),
  totalAmountMinor: z.number().int().nullable().optional(),
  refundPolicyText: z.string().max(5000).nullable().optional(),
  cancellationDeadline: isoDateTimeSchema.nullable().optional(),
  rawPayload: z.unknown().nullable().optional()
});
export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;

export const updateBookingInputSchema = createBookingInputSchema.partial();
export type UpdateBookingInput = z.infer<typeof updateBookingInputSchema>;

export const bookingCheckoutInputSchema = z.object({
  checkoutUrl: z.string().url(),
  providerBookingId: z.string().max(160).nullable().optional()
});
export type BookingCheckoutInput = z.infer<typeof bookingCheckoutInputSchema>;

export const bookingManualConfirmInputSchema = z.object({
  confirmationCode: z.string().max(120).min(1),
  notes: z.string().max(5000).nullable().optional()
});
export type BookingManualConfirmInput = z.infer<typeof bookingManualConfirmInputSchema>;

export const bookingDocumentInputSchema = z.object({
  mediaAssetId: idSchema,
  label: z.string().max(140).nullable().optional()
});
export type BookingDocumentInput = z.infer<typeof bookingDocumentInputSchema>;

export const expenseSplitInputSchema = z.object({
  userId: idSchema,
  amountMinor: z.number().int().nullable().optional(),
  percentage: z.number().int().nullable().optional(),
  shares: z.number().int().nullable().optional()
});
export type ExpenseSplitInput = z.infer<typeof expenseSplitInputSchema>;

export const expenseEntryDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  bookingRecordId: idSchema.nullable(),
  title: z.string().min(1).max(220),
  category: z.string().nullable(),
  paidByUserId: idSchema,
  currency: z.string().max(8),
  amountMinor: z.number().int(),
  tripBaseCurrency: z.string().max(8),
  tripBaseAmountMinor: z.number().int(),
  fxRate: z.number().nullable(),
  incurredAt: isoDateTimeSchema,
  notes: z.string().nullable(),
  splitMethod: expenseSplitMethodSchema,
  status: expenseStatusSchema,
  splits: z.array(expenseSplitInputSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type ExpenseEntryDTO = z.infer<typeof expenseEntryDtoSchema>;
export const listWaybookExpensesResponseSchema = z.object({ items: z.array(expenseEntryDtoSchema) });
export type ListWaybookExpensesResponse = z.infer<typeof listWaybookExpensesResponseSchema>;

export const createExpenseInputSchema = z.object({
  bookingRecordId: idSchema.nullable().optional(),
  title: z.string().min(1).max(220),
  category: z.string().max(80).nullable().optional(),
  paidByUserId: idSchema,
  currency: z.string().min(3).max(8),
  amountMinor: z.number().int(),
  tripBaseCurrency: z.string().min(3).max(8),
  tripBaseAmountMinor: z.number().int(),
  fxRate: z.number().nullable().optional(),
  incurredAt: isoDateTimeSchema,
  notes: z.string().max(5000).nullable().optional(),
  splitMethod: expenseSplitMethodSchema.optional(),
  status: expenseStatusSchema.optional(),
  splits: z.array(expenseSplitInputSchema).default([])
});
export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;

export const updateExpenseInputSchema = createExpenseInputSchema.partial();
export type UpdateExpenseInput = z.infer<typeof updateExpenseInputSchema>;

export const settlementItemSchema = z.object({
  fromUserId: idSchema,
  toUserId: idSchema,
  amountMinor: z.number().int(),
  currency: z.string().max(8)
});
export type SettlementItem = z.infer<typeof settlementItemSchema>;
export const settlementSummaryResponseSchema = z.object({
  currency: z.string().max(8),
  items: z.array(settlementItemSchema)
});
export type SettlementSummaryResponse = z.infer<typeof settlementSummaryResponseSchema>;

export const itineraryEventDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  planningItemId: idSchema.nullable(),
  bookingRecordId: idSchema.nullable(),
  title: z.string().min(1).max(220),
  startTime: isoDateTimeSchema,
  endTime: isoDateTimeSchema.nullable(),
  bufferBeforeMin: z.number().int().nullable(),
  bufferAfterMin: z.number().int().nullable(),
  ownerUserId: idSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type ItineraryEventDTO = z.infer<typeof itineraryEventDtoSchema>;
export const listWaybookItineraryEventsResponseSchema = z.object({ items: z.array(itineraryEventDtoSchema) });
export type ListWaybookItineraryEventsResponse = z.infer<typeof listWaybookItineraryEventsResponseSchema>;

export const createItineraryEventInputSchema = z.object({
  planningItemId: idSchema.nullable().optional(),
  bookingRecordId: idSchema.nullable().optional(),
  title: z.string().min(1).max(220),
  startTime: isoDateTimeSchema,
  endTime: isoDateTimeSchema.nullable().optional(),
  bufferBeforeMin: z.number().int().nullable().optional(),
  bufferAfterMin: z.number().int().nullable().optional(),
  ownerUserId: idSchema.nullable().optional(),
  notes: z.string().max(5000).nullable().optional()
});
export type CreateItineraryEventInput = z.infer<typeof createItineraryEventInputSchema>;

export const updateItineraryEventInputSchema = createItineraryEventInputSchema.partial();
export type UpdateItineraryEventInput = z.infer<typeof updateItineraryEventInputSchema>;

export const createEntryItineraryLinkInputSchema = z.object({
  itineraryEventId: idSchema
});
export type CreateEntryItineraryLinkInput = z.infer<typeof createEntryItineraryLinkInputSchema>;

export const notificationRuleDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  userId: idSchema,
  channel: notificationChannelSchema,
  notificationType: notificationTypeSchema,
  enabled: z.boolean(),
  leadTimeMin: z.number().int().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});
export type NotificationRuleDTO = z.infer<typeof notificationRuleDtoSchema>;
export const listNotificationRulesResponseSchema = z.object({ items: z.array(notificationRuleDtoSchema) });
export type ListNotificationRulesResponse = z.infer<typeof listNotificationRulesResponseSchema>;

export const updateNotificationRuleInputSchema = z.object({
  rules: z.array(
    z.object({
      channel: notificationChannelSchema,
      notificationType: notificationTypeSchema,
      enabled: z.boolean(),
      leadTimeMin: z.number().int().nullable().optional()
    })
  )
});
export type UpdateNotificationRuleInput = z.infer<typeof updateNotificationRuleInputSchema>;

export const notificationEventDtoSchema = z.object({
  id: idSchema,
  waybookId: idSchema,
  userId: idSchema,
  notificationType: notificationTypeSchema,
  channel: notificationChannelSchema,
  payload: z.unknown().nullable(),
  scheduledFor: isoDateTimeSchema,
  sentAt: isoDateTimeSchema.nullable(),
  status: z.string(),
  error: z.string().nullable(),
  createdAt: isoDateTimeSchema
});
export type NotificationEventDTO = z.infer<typeof notificationEventDtoSchema>;
export const listNotificationEventsResponseSchema = z.object({ items: z.array(notificationEventDtoSchema) });
export type ListNotificationEventsResponse = z.infer<typeof listNotificationEventsResponseSchema>;

export const ackNotificationInputSchema = z.object({
  status: z.enum(["acked", "dismissed"]).default("acked")
});
export type AckNotificationInput = z.infer<typeof ackNotificationInputSchema>;

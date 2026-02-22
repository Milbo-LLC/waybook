import type {
  AckPromptInput,
  AcceptInviteResponse,
  BookingCheckoutInput,
  BookingDocumentInput,
  BookingManualConfirmInput,
  BookingRecordDTO,
  CreateBookingInput,
  CreateEntryItineraryLinkInput,
  CreateExpenseInput,
  CreateInviteInput,
  CreateInviteResponse,
  CreateItineraryEventInput,
  CreatePlanningCommentInput,
  CreatePlanningItemInput,
  CreatePlanningVoteInput,
  CreatePublicReactionInput,
  CreateTripTaskInput,
  CreateEntryInput,
  CreateUploadUrlInput,
  CreateWaybookInput,
  DaySummaryDTO,
  ExpenseEntryDTO,
  EntryDTO,
  EntryGuidanceDTO,
  EntryRatingDTO,
  ItineraryEventDTO,
  ListEntriesResponse,
  ListNotificationEventsResponse,
  ListNotificationRulesResponse,
  ListPendingInvitesResponse,
  ListMembersResponse,
  ListPlanningCommentsResponse,
  ListPlanningItemsResponse,
  ListTasksResponse,
  ListWaybookBookingsResponse,
  ListWaybookExpensesResponse,
  ListWaybookItineraryEventsResponse,
  ListWaybooksResponse,
  PlaybookResponse,
  PlanningCommentDTO,
  PlanningItemDTO,
  PromptDTO,
  SettlementSummaryResponse,
  TimelineResponse,
  TripTaskDTO,
  UpsertDaySummaryInput,
  UpsertEntryGuidanceInput,
  UpsertEntryRatingInput,
  UpdateBookingInput,
  UpdateExpenseInput,
  UpdateItineraryEventInput,
  UpdateMemberRoleInput,
  UpdateNotificationRuleInput,
  UpdatePlanningItemInput,
  UpdateTaskInput,
  UpdateEntryInput,
  UpdateWaybookInput,
  WaybookDTO
} from "./index.js";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export class WaybookApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getHeaders: () => Promise<Record<string, string>> | Record<string, string> = () => ({}),
    private readonly credentials: RequestCredentials = "include"
  ) {}

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = {
      "content-type": "application/json",
      ...(await this.getHeaders()),
      ...options.headers
    };

    const requestInit: RequestInit = {
      method: options.method ?? "GET",
      headers,
      credentials: this.credentials
    };

    if (options.body !== undefined) {
      requestInit.body = JSON.stringify(options.body);
    }

    if (options.signal) {
      requestInit.signal = options.signal;
    }

    const response = await fetch(`${this.baseUrl}${path}`, requestInit);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API ${response.status}: ${errorText || response.statusText}`);
    }

    return (await response.json()) as T;
  }

  getMe() {
    return this.request<{ userId: string; email: string | null }>("/v1/me");
  }

  listWaybooks() {
    return this.request<ListWaybooksResponse>("/v1/waybooks");
  }

  createWaybook(input: CreateWaybookInput) {
    return this.request<WaybookDTO>("/v1/waybooks", { method: "POST", body: input });
  }

  updateWaybook(waybookId: string, input: UpdateWaybookInput) {
    return this.request<WaybookDTO>(`/v1/waybooks/${waybookId}`, { method: "PATCH", body: input });
  }

  listWaybookMembers(waybookId: string) {
    return this.request<ListMembersResponse>(`/v1/waybooks/${waybookId}/members`);
  }

  listPendingInvites() {
    return this.request<ListPendingInvitesResponse>("/v1/me/invites");
  }

  acceptPendingInvite(inviteId: string) {
    return this.request<{ success: true; waybookId: string }>(`/v1/me/invites/${inviteId}/accept`, { method: "POST", body: {} });
  }

  declinePendingInvite(inviteId: string) {
    return this.request<{ success: true }>(`/v1/me/invites/${inviteId}`, { method: "DELETE" });
  }

  createWaybookInvite(waybookId: string, input: CreateInviteInput) {
    return this.request<CreateInviteResponse>(`/v1/waybooks/${waybookId}/invites`, { method: "POST", body: input });
  }

  acceptWaybookInvite(token: string) {
    return this.request<AcceptInviteResponse>(`/v1/invites/${token}/accept`, { method: "POST", body: {} });
  }

  updateWaybookMemberRole(waybookId: string, memberId: string, input: UpdateMemberRoleInput) {
    return this.request<{ success: true }>(`/v1/waybooks/${waybookId}/members/${memberId}`, {
      method: "PATCH",
      body: input
    });
  }

  removeWaybookMember(waybookId: string, memberId: string) {
    return this.request<{ success: true }>(`/v1/waybooks/${waybookId}/members/${memberId}`, {
      method: "DELETE"
    });
  }

  revokeWaybookInvite(waybookId: string, inviteId: string) {
    return this.request<{ success: true }>(`/v1/waybooks/${waybookId}/invites/${inviteId}`, {
      method: "DELETE"
    });
  }

  resendWaybookInvite(waybookId: string, inviteId: string) {
    return this.request<{ success: true; acceptUrl: string }>(`/v1/waybooks/${waybookId}/invites/${inviteId}/resend`, {
      method: "POST",
      body: {}
    });
  }

  listPlanningItems(waybookId: string) {
    return this.request<ListPlanningItemsResponse>(`/v1/waybooks/${waybookId}/planning-items`);
  }

  createPlanningItem(waybookId: string, input: CreatePlanningItemInput) {
    return this.request<PlanningItemDTO>(`/v1/waybooks/${waybookId}/planning-items`, { method: "POST", body: input });
  }

  updatePlanningItem(itemId: string, input: UpdatePlanningItemInput) {
    return this.request<PlanningItemDTO>(`/v1/planning-items/${itemId}`, { method: "PATCH", body: input });
  }

  deletePlanningItem(itemId: string) {
    return this.request<{ success: true }>(`/v1/planning-items/${itemId}`, { method: "DELETE" });
  }

  createPlanningVote(itemId: string, input: CreatePlanningVoteInput) {
    return this.request<{ success: true }>(`/v1/planning-items/${itemId}/votes`, { method: "POST", body: input });
  }

  createPlanningComment(itemId: string, input: CreatePlanningCommentInput) {
    return this.request<PlanningCommentDTO>(`/v1/planning-items/${itemId}/comments`, { method: "POST", body: input });
  }

  listPlanningComments(itemId: string) {
    return this.request<ListPlanningCommentsResponse>(`/v1/planning-items/${itemId}/comments`);
  }

  listTasks(waybookId: string) {
    return this.request<ListTasksResponse>(`/v1/waybooks/${waybookId}/tasks`);
  }

  createTask(waybookId: string, input: CreateTripTaskInput) {
    return this.request<TripTaskDTO>(`/v1/waybooks/${waybookId}/tasks`, { method: "POST", body: input });
  }

  updateTask(taskId: string, input: UpdateTaskInput) {
    return this.request<TripTaskDTO>(`/v1/tasks/${taskId}`, { method: "PATCH", body: input });
  }

  deleteTask(taskId: string) {
    return this.request<{ success: true }>(`/v1/tasks/${taskId}`, { method: "DELETE" });
  }

  listBookings(waybookId: string) {
    return this.request<ListWaybookBookingsResponse>(`/v1/waybooks/${waybookId}/bookings`);
  }

  createBooking(waybookId: string, input: CreateBookingInput) {
    return this.request<BookingRecordDTO>(`/v1/waybooks/${waybookId}/bookings`, { method: "POST", body: input });
  }

  getBooking(bookingId: string) {
    return this.request<BookingRecordDTO>(`/v1/bookings/${bookingId}`);
  }

  updateBooking(bookingId: string, input: UpdateBookingInput) {
    return this.request<BookingRecordDTO>(`/v1/bookings/${bookingId}`, { method: "PATCH", body: input });
  }

  createBookingCheckoutLink(bookingId: string, input: BookingCheckoutInput) {
    return this.request<BookingRecordDTO>(`/v1/bookings/${bookingId}/checkout-link`, { method: "POST", body: input });
  }

  confirmBookingManual(bookingId: string, input: BookingManualConfirmInput) {
    return this.request<BookingRecordDTO>(`/v1/bookings/${bookingId}/confirm-manual`, { method: "POST", body: input });
  }

  attachBookingDocument(bookingId: string, input: BookingDocumentInput) {
    return this.request<{ success: true }>(`/v1/bookings/${bookingId}/documents`, { method: "POST", body: input });
  }

  listExpenses(waybookId: string) {
    return this.request<ListWaybookExpensesResponse>(`/v1/waybooks/${waybookId}/expenses`);
  }

  createExpense(waybookId: string, input: CreateExpenseInput) {
    return this.request<ExpenseEntryDTO>(`/v1/waybooks/${waybookId}/expenses`, { method: "POST", body: input });
  }

  updateExpense(expenseId: string, input: UpdateExpenseInput) {
    return this.request<ExpenseEntryDTO>(`/v1/expenses/${expenseId}`, { method: "PATCH", body: input });
  }

  deleteExpense(expenseId: string) {
    return this.request<{ success: true }>(`/v1/expenses/${expenseId}`, { method: "DELETE" });
  }

  getSettlementSummary(waybookId: string) {
    return this.request<SettlementSummaryResponse>(`/v1/waybooks/${waybookId}/settlements`);
  }

  getBudgetSummary(waybookId: string) {
    return this.request<{ totalBaseAmountMinor: number; currency: string; byCategory: Array<{ category: string; amountMinor: number }> }>(
      `/v1/waybooks/${waybookId}/budget-summary`
    );
  }

  listItineraryEvents(waybookId: string) {
    return this.request<ListWaybookItineraryEventsResponse>(`/v1/waybooks/${waybookId}/itinerary-events`);
  }

  createItineraryEvent(waybookId: string, input: CreateItineraryEventInput) {
    return this.request<ItineraryEventDTO>(`/v1/waybooks/${waybookId}/itinerary-events`, { method: "POST", body: input });
  }

  updateItineraryEvent(eventId: string, input: UpdateItineraryEventInput) {
    return this.request<ItineraryEventDTO>(`/v1/itinerary-events/${eventId}`, { method: "PATCH", body: input });
  }

  deleteItineraryEvent(eventId: string) {
    return this.request<{ success: true }>(`/v1/itinerary-events/${eventId}`, { method: "DELETE" });
  }

  createEntryItineraryLink(entryId: string, input: CreateEntryItineraryLinkInput) {
    return this.request<{ success: true }>(`/v1/entries/${entryId}/itinerary-links`, { method: "POST", body: input });
  }

  deleteEntryItineraryLink(entryId: string, linkId: string) {
    return this.request<{ success: true }>(`/v1/entries/${entryId}/itinerary-links/${linkId}`, { method: "DELETE" });
  }

  listNotificationRules(waybookId: string) {
    return this.request<ListNotificationRulesResponse>(`/v1/waybooks/${waybookId}/notification-rules`);
  }

  updateNotificationRules(waybookId: string, input: UpdateNotificationRuleInput) {
    return this.request<ListNotificationRulesResponse>(`/v1/waybooks/${waybookId}/notification-rules`, {
      method: "PATCH",
      body: input
    });
  }

  listMyNotifications() {
    return this.request<ListNotificationEventsResponse>("/v1/me/notifications");
  }

  acknowledgeNotification(id: string) {
    return this.request<{ success: true }>(`/v1/me/notifications/${id}/ack`, { method: "POST", body: {} });
  }

  listEntries(waybookId: string) {
    return this.request<ListEntriesResponse>(`/v1/waybooks/${waybookId}/entries`);
  }

  createEntry(waybookId: string, input: CreateEntryInput) {
    return this.request<EntryDTO>(`/v1/waybooks/${waybookId}/entries`, {
      method: "POST",
      body: input
    });
  }

  updateEntry(entryId: string, input: UpdateEntryInput) {
    return this.request<EntryDTO>(`/v1/entries/${entryId}`, { method: "PATCH", body: input });
  }

  createUploadUrl(entryId: string, input: CreateUploadUrlInput) {
    return this.request<{
      mediaId: string;
      uploadUrl: string;
      storageKey: string;
      expiresAt: string;
      requiredHeaders: Record<string, string>;
    }>(`/v1/entries/${entryId}/media/upload-url`, {
      method: "POST",
      body: input
    });
  }

  completeUpload(mediaId: string, idempotencyKey: string) {
    return this.request<{ success: true }>(`/v1/media/${mediaId}/complete`, {
      method: "POST",
      body: { idempotencyKey }
    });
  }

  deleteMedia(mediaId: string) {
    return this.request<{ success: true }>(`/v1/media/${mediaId}`, {
      method: "DELETE"
    });
  }

  getTimeline(waybookId: string) {
    return this.request<TimelineResponse>(`/v1/waybooks/${waybookId}/timeline`);
  }

  createEntryRating(entryId: string, input: UpsertEntryRatingInput) {
    return this.request<EntryRatingDTO>(`/v1/entries/${entryId}/rating`, { method: "POST", body: input });
  }

  updateEntryRating(entryId: string, input: UpsertEntryRatingInput) {
    return this.request<EntryRatingDTO>(`/v1/entries/${entryId}/rating`, { method: "PATCH", body: input });
  }

  listDaySummaries(waybookId: string) {
    return this.request<{ items: DaySummaryDTO[] }>(`/v1/waybooks/${waybookId}/day-summaries`);
  }

  createDaySummary(waybookId: string, input: UpsertDaySummaryInput) {
    return this.request<DaySummaryDTO>(`/v1/waybooks/${waybookId}/day-summaries`, { method: "POST", body: input });
  }

  updateDaySummary(waybookId: string, date: string, input: Omit<UpsertDaySummaryInput, "summaryDate">) {
    return this.request<DaySummaryDTO>(`/v1/waybooks/${waybookId}/day-summaries/${date}`, {
      method: "PATCH",
      body: input
    });
  }

  createEntryGuidance(entryId: string, input: UpsertEntryGuidanceInput) {
    return this.request<EntryGuidanceDTO>(`/v1/entries/${entryId}/guidance`, { method: "POST", body: input });
  }

  updateEntryGuidance(entryId: string, input: UpsertEntryGuidanceInput) {
    return this.request<EntryGuidanceDTO>(`/v1/entries/${entryId}/guidance`, { method: "PATCH", body: input });
  }

  getPublicPlaybook(publicSlug: string) {
    return this.request<PlaybookResponse>(`/v1/public/w/${publicSlug}/playbook`);
  }

  createPublicReaction(entryId: string, input: CreatePublicReactionInput) {
    return this.request<{ success: true }>(`/v1/public/entries/${entryId}/reactions`, {
      method: "POST",
      body: input
    });
  }

  getNextPrompt() {
    return this.request<PromptDTO | null>("/v1/prompts/next");
  }

  acknowledgePrompt(input: AckPromptInput) {
    return this.request<{ success: true }>(`/v1/prompts/ack`, { method: "POST", body: input });
  }
}

import type {
  AckPromptInput,
  AcceptInviteResponse,
  CreateInviteInput,
  CreateInviteResponse,
  CreatePublicReactionInput,
  CreateEntryInput,
  CreateUploadUrlInput,
  CreateWaybookInput,
  DaySummaryDTO,
  EntryDTO,
  EntryGuidanceDTO,
  EntryRatingDTO,
  ListEntriesResponse,
  ListMembersResponse,
  ListWaybooksResponse,
  PlaybookResponse,
  PromptDTO,
  TimelineResponse,
  UpsertDaySummaryInput,
  UpsertEntryGuidanceInput,
  UpsertEntryRatingInput,
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

  createWaybookInvite(waybookId: string, input: CreateInviteInput) {
    return this.request<CreateInviteResponse>(`/v1/waybooks/${waybookId}/invites`, { method: "POST", body: input });
  }

  acceptWaybookInvite(token: string) {
    return this.request<AcceptInviteResponse>(`/v1/invites/${token}/accept`, { method: "POST", body: {} });
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

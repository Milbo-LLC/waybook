import type {
  CreateEntryInput,
  CreateUploadUrlInput,
  CreateWaybookInput,
  EntryDTO,
  ListEntriesResponse,
  ListWaybooksResponse,
  TimelineResponse,
  UpdateEntryInput,
  UpdateWaybookInput,
  WaybookDTO
} from "./index";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export class WaybookApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getHeaders: () => Promise<Record<string, string>> | Record<string, string> = () => ({})
  ) {}

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = {
      "content-type": "application/json",
      ...(await this.getHeaders()),
      ...options.headers
    };

    const requestInit: RequestInit = {
      method: options.method ?? "GET",
      headers
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

  getTimeline(waybookId: string) {
    return this.request<TimelineResponse>(`/v1/waybooks/${waybookId}/timeline`);
  }
}

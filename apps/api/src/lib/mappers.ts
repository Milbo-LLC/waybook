import type {
  DaySummaryDTO,
  EntryDTO,
  EntryGuidanceDTO,
  EntryRatingDTO,
  MediaDTO,
  PromptDTO,
  PublicReactionDTO,
  WaybookDTO
} from "@waybook/contracts";
import { toPublicMediaUrl } from "./r2.js";

type WaybookRow = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  coverMediaId: string | null;
  visibility: "private" | "link_only" | "public";
  publicSlug: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type EntryRow = {
  id: string;
  waybookId: string;
  authorUserId: string;
  capturedAt: Date;
  textContent: string | null;
  lat: number | null;
  lng: number | null;
  placeName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MediaRow = {
  id: string;
  entryId: string;
  type: "photo" | "audio" | "video";
  status: "pending_upload" | "uploaded" | "processing" | "ready" | "failed";
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  thumbnailKey: string | null;
  transcodeStatus: "none" | "pending" | "processing" | "ready" | "failed";
  playbackDurationMs: number | null;
  aspectRatio: number | null;
  storageKeyOriginal: string;
  storageKeyDisplay: string | null;
  createdAt: Date;
};

export const mapWaybook = (row: WaybookRow): WaybookDTO => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export const mapMedia = (row: MediaRow): MediaDTO => ({
  id: row.id,
  entryId: row.entryId,
  type: row.type,
  status: row.status,
  mimeType: row.mimeType,
  bytes: row.bytes,
  width: row.width,
  height: row.height,
  durationMs: row.durationMs,
  thumbnailUrl: toPublicMediaUrl(row.thumbnailKey),
  transcodeStatus: row.transcodeStatus,
  playbackDurationMs: row.playbackDurationMs,
  aspectRatio: row.aspectRatio,
  originalUrl: toPublicMediaUrl(row.storageKeyOriginal),
  displayUrl: toPublicMediaUrl(row.storageKeyDisplay),
  createdAt: row.createdAt.toISOString()
});

export const mapEntry = (
  row: EntryRow,
  media: MediaDTO[],
  rating: EntryRatingDTO | null = null,
  guidance: EntryGuidanceDTO | null = null
): EntryDTO => ({
  id: row.id,
  waybookId: row.waybookId,
  authorUserId: row.authorUserId,
  capturedAt: row.capturedAt.toISOString(),
  textContent: row.textContent,
  location:
    row.lat !== null && row.lng !== null
      ? {
          lat: row.lat,
          lng: row.lng,
          placeName: row.placeName
        }
      : null,
  media,
  rating,
  guidance,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export const mapEntryRating = (row: {
  id: string;
  entryId: string;
  userId: string;
  ratingOverall: number;
  valueForMoney: number;
  wouldRepeat: boolean;
  difficulty: number | null;
  createdAt: Date;
  updatedAt: Date;
}): EntryRatingDTO => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export const mapEntryGuidance = (row: {
  id: string;
  entryId: string;
  isMustDo: boolean;
  estimatedCostMin: number | null;
  estimatedCostMax: number | null;
  timeNeededMinutes: number | null;
  bestTimeOfDay: string | null;
  tipsText: string | null;
  accessibilityNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): EntryGuidanceDTO => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export const mapDaySummary = (row: {
  id: string;
  waybookId: string;
  summaryDate: string;
  summaryText: string | null;
  topMomentEntryId: string | null;
  moodScore: number | null;
  energyScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}): DaySummaryDTO => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export const mapPublicReaction = (row: {
  id: string;
  entryId: string;
  reactionType: "worth_it" | "skip_it" | "family_friendly" | "budget_friendly" | "photogenic";
  note: string | null;
  createdAt: Date;
}): PublicReactionDTO => ({
  ...row,
  createdAt: row.createdAt.toISOString()
});

export const mapPrompt = (row: {
  id: string;
  userId: string;
  waybookId: string;
  promptType: "itinerary_gap" | "location_gap" | "day_reflection";
  triggerReason: string;
  scheduledFor: Date;
  shownAt: Date | null;
  dismissedAt: Date | null;
  actedAt: Date | null;
  createdAt: Date;
}): PromptDTO => ({
  ...row,
  scheduledFor: row.scheduledFor.toISOString(),
  shownAt: row.shownAt?.toISOString() ?? null,
  dismissedAt: row.dismissedAt?.toISOString() ?? null,
  actedAt: row.actedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString()
});

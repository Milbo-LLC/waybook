import type { EntryDTO, MediaDTO, WaybookDTO } from "@waybook/contracts";
import { toPublicMediaUrl } from "./r2";

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
  type: "photo" | "audio";
  status: "pending_upload" | "uploaded" | "processing" | "ready" | "failed";
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
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
  originalUrl: toPublicMediaUrl(row.storageKeyOriginal),
  displayUrl: toPublicMediaUrl(row.storageKeyDisplay),
  createdAt: row.createdAt.toISOString()
});

export const mapEntry = (row: EntryRow, media: MediaDTO[]): EntryDTO => ({
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
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

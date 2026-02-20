"use client";

import { Card } from "@waybook/ui";
import type { EntryDTO } from "@waybook/contracts";
import { useState } from "react";
import { apiClient } from "@/lib/api";

export const EntryList = ({ entries, onRefresh }: { entries: EntryDTO[]; onRefresh?: () => Promise<void> | void }) => {
  const [updatingEntryId, setUpdatingEntryId] = useState<string | null>(null);

  if (!entries.length) {
    return <Card>No entries yet.</Card>;
  }

  return (
    <div className="grid gap-3">
      {entries.map((entry) => (
        <Card key={entry.id}>
          <p className="text-sm text-slate-500">{new Date(entry.capturedAt).toLocaleString()}</p>
          {entry.textContent ? <p className="mt-2 text-sm">{entry.textContent}</p> : null}
          {entry.rating ? (
            <p className="mt-2 text-xs text-slate-600">
              Rating: {entry.rating.ratingOverall}/5, value {entry.rating.valueForMoney}/5, would repeat{" "}
              {entry.rating.wouldRepeat ? "yes" : "no"}
            </p>
          ) : null}
          {entry.guidance?.isMustDo ? <p className="mt-1 text-xs font-medium text-brand-700">Must do</p> : null}
          {entry.location ? (
            <p className="mt-2 text-xs text-slate-500">
              {entry.location.placeName ?? "Pinned location"} ({entry.location.lat.toFixed(4)}, {entry.location.lng.toFixed(4)})
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="rounded border px-2 py-1 text-xs"
              disabled={updatingEntryId === entry.id}
              onClick={async () => {
                setUpdatingEntryId(entry.id);
                try {
                  await apiClient.createEntryRating(entry.id, {
                    ratingOverall: 5,
                    valueForMoney: 5,
                    wouldRepeat: true,
                    difficulty: 2
                  });
                  await onRefresh?.();
                } finally {
                  setUpdatingEntryId(null);
                }
              }}
              type="button"
            >
              Amazing
            </button>
            <button
              className="rounded border px-2 py-1 text-xs"
              disabled={updatingEntryId === entry.id}
              onClick={async () => {
                setUpdatingEntryId(entry.id);
                try {
                  await apiClient.createEntryRating(entry.id, {
                    ratingOverall: 4,
                    valueForMoney: 4,
                    wouldRepeat: true,
                    difficulty: 3
                  });
                  await onRefresh?.();
                } finally {
                  setUpdatingEntryId(null);
                }
              }}
              type="button"
            >
              Good
            </button>
            <button
              className="rounded border px-2 py-1 text-xs"
              disabled={updatingEntryId === entry.id}
              onClick={async () => {
                setUpdatingEntryId(entry.id);
                try {
                  await apiClient.createEntryRating(entry.id, {
                    ratingOverall: 2,
                    valueForMoney: 2,
                    wouldRepeat: false,
                    difficulty: 3
                  });
                  await onRefresh?.();
                } finally {
                  setUpdatingEntryId(null);
                }
              }}
              type="button"
            >
              Skip next time
            </button>
            <button
              className="rounded border px-2 py-1 text-xs"
              disabled={updatingEntryId === entry.id}
              onClick={async () => {
                setUpdatingEntryId(entry.id);
                try {
                  await apiClient.createEntryGuidance(entry.id, {
                    isMustDo: !(entry.guidance?.isMustDo ?? false)
                  });
                  await onRefresh?.();
                } finally {
                  setUpdatingEntryId(null);
                }
              }}
              type="button"
            >
              {entry.guidance?.isMustDo ? "Unmark Must Do" : "Mark Must Do"}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
};

"use client";

import { Card } from "@waybook/ui";
import type { EntryDTO } from "@waybook/contracts";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { apiClient } from "@/lib/api";

const looksLikeTiptapHtml = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("<") || !trimmed.endsWith(">")) return false;
  return /<(p|h1|h2|h3|h4|h5|h6|ul|ol|li|blockquote|pre|code|hr|strong|em|u|s)\b/i.test(trimmed);
};

export const EntryList = ({ entries, onRefresh }: { entries: EntryDTO[]; onRefresh?: () => Promise<void> | void }) => {
  const [updatingEntryId, setUpdatingEntryId] = useState<string | null>(null);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{
    media: EntryDTO["media"];
    index: number;
  } | null>(null);

  useEffect(() => {
    if (!viewer) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewer(null);
      if (event.key === "ArrowRight") {
        setViewer((current) =>
          current
            ? {
                ...current,
                index: (current.index + 1) % current.media.length
              }
            : current
        );
      }
      if (event.key === "ArrowLeft") {
        setViewer((current) =>
          current
            ? {
                ...current,
                index: (current.index - 1 + current.media.length) % current.media.length
              }
            : current
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewer]);

  if (!entries.length) {
    return <Card>No entries yet.</Card>;
  }

  const handleDeleteMedia = async (mediaId: string) => {
    setDeletingMediaId(mediaId);
    try {
      await apiClient.deleteMedia(mediaId);
      await onRefresh?.();
      setViewer((current) => {
        if (!current) return current;
        const nextMedia = current.media.filter((item) => item.id !== mediaId);
        if (!nextMedia.length) return null;
        return {
          media: nextMedia,
          index: Math.min(current.index, nextMedia.length - 1)
        };
      });
    } finally {
      setDeletingMediaId(null);
    }
  };

  const viewerMedia = viewer ? viewer.media[viewer.index] : null;
  const viewerMediaUrl = viewerMedia ? viewerMedia.displayUrl ?? viewerMedia.originalUrl : null;

  return (
    <>
      <div className="grid gap-3">
        {entries.map((entry) => (
          <Card key={entry.id}>
            <p className="text-sm text-slate-500">{new Date(entry.capturedAt).toLocaleString()}</p>
            {entry.textContent ? (
              looksLikeTiptapHtml(entry.textContent) ? (
                <div
                  className="prose prose-slate prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-slate-500 mt-2 max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: entry.textContent }}
                />
              ) : (
                <div className="prose prose-slate prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-slate-500 mt-2 max-w-none text-sm">
                  <ReactMarkdown rehypePlugins={[rehypeSanitize]} remarkPlugins={[remarkGfm]}>
                    {entry.textContent}
                  </ReactMarkdown>
                </div>
              )
            ) : null}
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
            {entry.media.length ? (
              <div className="mt-3 columns-1 gap-2 sm:columns-2 lg:columns-3">
                {entry.media.map((media, mediaIndex) => {
                  const url = media.displayUrl ?? media.originalUrl;
                  if (!url) return null;

                  if (media.type === "audio") {
                    return (
                      <div key={media.id} className="mb-2 break-inside-avoid rounded border border-slate-200 bg-white p-2">
                        <audio className="w-full" controls src={url} />
                        <button
                          className="mt-2 rounded border px-2 py-1 text-xs"
                          disabled={deletingMediaId === media.id}
                          onClick={() => void handleDeleteMedia(media.id)}
                          type="button"
                        >
                          {deletingMediaId === media.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={media.id}
                      className="group relative mb-2 break-inside-avoid overflow-hidden rounded border border-slate-200 bg-slate-100"
                    >
                      <button className="block w-full" onClick={() => setViewer({ media: entry.media, index: mediaIndex })} type="button">
                        {media.type === "photo" ? (
                          <img alt="Waybook media" className="h-auto w-full object-contain" loading="lazy" src={url} />
                        ) : (
                          <video
                            className="h-auto w-full object-contain"
                            poster={media.thumbnailUrl ?? undefined}
                            preload="metadata"
                            src={url}
                          />
                        )}
                      </button>
                      <button
                        className="absolute right-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white"
                        disabled={deletingMediaId === media.id}
                        onClick={() => void handleDeleteMedia(media.id)}
                        type="button"
                      >
                        {deletingMediaId === media.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  );
                })}
              </div>
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
      {viewer && viewerMedia && viewerMediaUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button
            className="absolute right-4 top-4 rounded bg-white/10 px-3 py-2 text-sm text-white"
            onClick={() => setViewer(null)}
            type="button"
          >
            Close
          </button>
          {viewer.media.length > 1 ? (
            <>
              <button
                className="absolute left-4 rounded bg-white/10 px-3 py-2 text-white"
                onClick={() =>
                  setViewer((current) =>
                    current
                      ? {
                          ...current,
                          index: (current.index - 1 + current.media.length) % current.media.length
                        }
                      : current
                  )
                }
                type="button"
              >
                Prev
              </button>
              <button
                className="absolute right-20 rounded bg-white/10 px-3 py-2 text-white"
                onClick={() =>
                  setViewer((current) =>
                    current
                      ? {
                          ...current,
                          index: (current.index + 1) % current.media.length
                        }
                      : current
                  )
                }
                type="button"
              >
                Next
              </button>
            </>
          ) : null}
          <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-xs text-white">
            {viewer.index + 1} / {viewer.media.length}
          </div>
          <button
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-red-600/80 px-3 py-2 text-sm text-white"
            disabled={deletingMediaId === viewerMedia.id}
            onClick={() => void handleDeleteMedia(viewerMedia.id)}
            type="button"
          >
            {deletingMediaId === viewerMedia.id ? "Deleting..." : "Delete media"}
          </button>
          <div className="flex max-h-[85vh] w-full max-w-6xl items-center justify-center">
            {viewerMedia.type === "photo" ? (
              <img alt="Fullscreen media" className="max-h-[85vh] max-w-full object-contain" src={viewerMediaUrl} />
            ) : null}
            {viewerMedia.type === "video" ? (
              <video
                className="max-h-[85vh] max-w-full object-contain"
                controls
                poster={viewerMedia.thumbnailUrl ?? undefined}
                src={viewerMediaUrl}
              />
            ) : null}
            {viewerMedia.type === "audio" ? <audio className="w-full max-w-xl" controls src={viewerMediaUrl} /> : null}
          </div>
        </div>
      ) : null}
    </>
  );
};

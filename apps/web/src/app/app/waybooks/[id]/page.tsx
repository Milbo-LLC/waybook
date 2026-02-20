"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { EntryList } from "@/features/entries/entry-list";
import { ShareLinkCard } from "@/features/share/share-link-card";
import { UploadPanel } from "@/features/media/upload-panel";
import { apiClient } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";

export default function WaybookDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const waybookId = useMemo(() => params.id, [params.id]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Awaited<ReturnType<typeof apiClient.getTimeline>> | null>(null);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof apiClient.listEntries>>["items"]>([]);
  const [quickNote, setQuickNote] = useState("");
  const [savingQuickEntry, setSavingQuickEntry] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);

  const loadWaybook = async () => {
    if (!waybookId) return;
    const [timelineResponse, entriesResponse] = await Promise.all([
      apiClient.getTimeline(waybookId),
      apiClient.listEntries(waybookId)
    ]);
    setTimeline(timelineResponse);
    setEntries(entriesResponse.items);
  };

  useEffect(() => {
    if (!waybookId) return;

    const run = async () => {
      const session = await getSession();
      if (!session) {
        router.replace("/login" as any);
        return;
      }

      try {
        await loadWaybook();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load waybook");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [router, waybookId]);

  const firstEntry = entries[0];
  const todayDate = new Date().toISOString().slice(0, 10);
  const todaySummary = timeline?.days.find((day) => day.date === todayDate)?.summary ?? null;

  return (
    <PageShell>
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{timeline?.waybook.title ?? "Waybook"}</h1>
          {timeline ? (
            <p className="text-sm text-slate-600">
              {timeline.waybook.startDate} to {timeline.waybook.endDate}
            </p>
          ) : null}
        </div>
        <LogoutButton />
      </header>

      {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {waybookId ? <ShareLinkCard waybookId={waybookId} /> : null}
      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Quick capture</h2>
        <p className="mt-1 text-sm text-slate-600">Thoughtless logging: write a note and save instantly.</p>
        <textarea
          className="mt-3 w-full rounded border p-2 text-sm"
          onChange={(event) => setQuickNote(event.target.value)}
          placeholder="What happened? What made this memorable?"
          rows={3}
          value={quickNote}
        />
        <div className="mt-3 flex gap-2">
          <button
            className="rounded bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={savingQuickEntry || !quickNote.trim()}
            onClick={async () => {
              if (!waybookId || !quickNote.trim()) return;
              setSavingQuickEntry(true);
              setError(null);
              try {
                await apiClient.createEntry(waybookId, {
                  capturedAt: new Date().toISOString(),
                  textContent: quickNote.trim(),
                  location: null,
                  idempotencyKey: crypto.randomUUID()
                });
                setQuickNote("");
                await loadWaybook();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Unable to save entry");
              } finally {
                setSavingQuickEntry(false);
              }
            }}
            type="button"
          >
            {savingQuickEntry ? "Saving..." : "Save capture"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Daily reflection</h2>
        <p className="mt-1 text-sm text-slate-600">Top memory and quick reflection for today.</p>
        <textarea
          className="mt-3 w-full rounded border p-2 text-sm"
          onChange={(event) => setSummaryText(event.target.value)}
          placeholder={todaySummary?.summaryText ?? "What stood out today?"}
          rows={3}
          value={summaryText}
        />
        <div className="mt-3 flex gap-2">
          <button
            className="rounded bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={savingSummary}
            onClick={async () => {
              if (!waybookId) return;
              setSavingSummary(true);
              setError(null);
              try {
                await apiClient.createDaySummary(waybookId, {
                  summaryDate: todayDate,
                  summaryText: summaryText.trim() || todaySummary?.summaryText || null,
                  topMomentEntryId: entries[0]?.id ?? null,
                  moodScore: 4,
                  energyScore: 4
                });
                setSummaryText("");
                await loadWaybook();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Unable to save daily reflection");
              } finally {
                setSavingSummary(false);
              }
            }}
            type="button"
          >
            {savingSummary ? "Saving..." : "Save reflection"}
          </button>
        </div>
      </section>
      {firstEntry ? <UploadPanel entryId={firstEntry.id} onUploaded={loadWaybook} /> : null}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Entries</h2>
        <EntryList entries={entries} onRefresh={loadWaybook} />
      </section>
    </PageShell>
  );
}

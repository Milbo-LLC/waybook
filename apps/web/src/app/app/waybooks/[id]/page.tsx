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

  useEffect(() => {
    if (!waybookId) return;

    const run = async () => {
      const session = await getSession();
      if (!session) {
        router.replace("/login" as any);
        return;
      }

      try {
        const [timelineResponse, entriesResponse] = await Promise.all([
          apiClient.getTimeline(waybookId),
          apiClient.listEntries(waybookId)
        ]);
        setTimeline(timelineResponse);
        setEntries(entriesResponse.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load waybook");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [router, waybookId]);

  const firstEntry = entries[0];

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
      {firstEntry ? <UploadPanel entryId={firstEntry.id} /> : null}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Entries</h2>
        <EntryList entries={entries} />
      </section>
    </PageShell>
  );
}

import { PageShell } from "@/components/page-shell";
import { EntryList } from "@/features/entries/entry-list";
import { ShareLinkCard } from "@/features/share/share-link-card";
import { UploadPanel } from "@/features/media/upload-panel";
import { apiClient } from "@/lib/api";

export default async function WaybookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [waybook, entries] = await Promise.all([
    apiClient.getTimeline(id).catch(() => null),
    apiClient.listEntries(id).catch(() => ({ items: [], page: { hasMore: false, nextCursor: null } }))
  ]);

  if (!waybook) {
    return (
      <PageShell>
        <p>Unable to load this waybook. Check auth/session configuration.</p>
      </PageShell>
    );
  }

  const firstEntry = entries.items[0];

  return (
    <PageShell>
      <header>
        <h1 className="text-3xl font-semibold">{waybook.waybook.title}</h1>
        <p className="text-sm text-slate-600">{waybook.waybook.startDate} to {waybook.waybook.endDate}</p>
      </header>

      <ShareLinkCard waybookId={id} />

      {firstEntry ? <UploadPanel entryId={firstEntry.id} /> : null}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Entries</h2>
        <EntryList entries={entries.items} />
      </section>
    </PageShell>
  );
}

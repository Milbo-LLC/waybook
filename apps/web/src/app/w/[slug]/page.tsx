import { PageShell } from "@/components/page-shell";

async function fetchPublic(slug: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787"}/v1/public/w/${slug}/timeline`, {
    cache: "no-store"
  });

  if (!response.ok) return null;
  return (await response.json()) as {
    waybook: { title: string; description: string | null };
    days: { date: string; entries: { id: string; textContent: string | null; capturedAt: string }[] }[];
  };
}

export default async function PublicWaybookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await fetchPublic(slug);

  if (!data) {
    return (
      <PageShell>
        <p>Waybook not found.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 className="text-3xl font-semibold">{data.waybook.title}</h1>
      {data.waybook.description ? <p className="text-slate-700">{data.waybook.description}</p> : null}
      <div className="grid gap-4">
        {data.days.map((day) => (
          <section key={day.date} className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">{day.date}</h2>
            <div className="mt-2 grid gap-2">
              {day.entries.map((entry) => (
                <article key={entry.id} className="rounded border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">{new Date(entry.capturedAt).toLocaleTimeString()}</p>
                  <p className="text-sm">{entry.textContent ?? "(No text)"}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}

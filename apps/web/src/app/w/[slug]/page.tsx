import { PageShell } from "@/components/page-shell";

async function fetchPublic(slug: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787"}/v1/public/w/${slug}/playbook`, {
    cache: "no-store"
  });

  if (!response.ok) return null;
  return (await response.json()) as {
    waybook: { title: string; description: string | null };
    days: {
      date: string;
      summary: { summaryText: string | null } | null;
      steps: {
        entry: {
          id: string;
          textContent: string | null;
          capturedAt: string;
          guidance: { isMustDo: boolean } | null;
        };
        confidenceScore: number;
      }[];
    }[];
    blueprint?: {
      headline: string;
      summary: string;
      practicalBlocks: Array<{ title: string; items: string[] }>;
    };
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
      {data.blueprint ? (
        <section className="rounded-xl border bg-slate-50 p-4">
          <h2 className="text-lg font-semibold">{data.blueprint.headline}</h2>
          <p className="mt-1 text-sm text-slate-600">{data.blueprint.summary}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {data.blueprint.practicalBlocks.map((block) => (
              <article key={block.title} className="rounded border border-slate-200 bg-white p-3">
                <p className="text-sm font-semibold">{block.title}</p>
                <p className="mt-1 text-xs text-slate-600">{block.items.join(" • ")}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <div className="grid gap-4">
        {data.days.map((day) => (
          <section key={day.date} className="rounded-xl border bg-white p-4">
            <h2 className="font-semibold">{day.date}</h2>
            {day.summary?.summaryText ? <p className="mt-1 text-sm text-slate-600">{day.summary.summaryText}</p> : null}
            <div className="mt-2 grid gap-2">
              {day.steps.map((step) => (
                <article key={step.entry.id} className="rounded border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">{new Date(step.entry.capturedAt).toLocaleTimeString()}</p>
                  <p className="text-sm">{step.entry.textContent ?? "(No text)"}</p>
                  {step.entry.guidance?.isMustDo ? <p className="mt-1 text-xs font-medium text-brand-700">Must do</p> : null}
                  <p className="mt-1 text-xs text-slate-500">Confidence: {step.confidenceScore}%</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}

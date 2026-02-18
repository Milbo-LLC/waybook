import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export default function MarketingPage() {
  return (
    <PageShell>
      <section className="rounded-3xl bg-gradient-to-br from-brand-100 to-white p-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Waybook</p>
        <h1 className="mt-2 text-4xl font-bold">Capture once. Keep forever. Share effortlessly.</h1>
        <p className="mt-4 max-w-2xl text-slate-700">
          Waybook turns your trip photos, notes, and locations into a structured digital keepsake others can follow and recreate.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/app" className="rounded-md bg-brand-700 px-4 py-2 text-white">
            Open dashboard
          </Link>
        </div>
      </section>
    </PageShell>
  );
}

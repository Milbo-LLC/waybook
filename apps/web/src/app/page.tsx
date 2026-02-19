"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { getSession, type SessionUser } from "@/lib/auth";

export default function MarketingPage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextSession = await getSession();
        if (active) {
          setSession(nextSession);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <PageShell>
      <section className="rounded-3xl bg-gradient-to-br from-brand-100 to-white p-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Waybook</p>
        <h1 className="mt-2 text-4xl font-bold">Capture once. Keep forever. Share effortlessly.</h1>
        <p className="mt-4 max-w-2xl text-slate-700">
          Waybook turns your trip photos, notes, and locations into a structured digital keepsake others can follow and recreate.
        </p>
        {loading ? (
          <p className="mt-6 text-sm text-slate-600">Loading...</p>
        ) : session ? (
          <div className="mt-6 flex gap-3">
            <Link href={"/app" as any} className="rounded-md bg-brand-700 px-4 py-2 text-white">
              Open dashboard
            </Link>
            <Link href={"/app/waybooks/new" as any} className="rounded-md border border-brand-700 px-4 py-2 text-brand-700">
              New Waybook
            </Link>
          </div>
        ) : (
          <div className="mt-6 flex gap-3">
            <Link href={"/login" as any} className="rounded-md bg-brand-700 px-4 py-2 text-white">
              Sign in
            </Link>
            <Link href={"/signup" as any} className="rounded-md border border-brand-700 px-4 py-2 text-brand-700">
              Create account
            </Link>
          </div>
        )}
      </section>
    </PageShell>
  );
}

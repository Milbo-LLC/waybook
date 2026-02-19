"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WaybookCard } from "@/features/waybooks/waybook-card";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api";
import { getSession, type SessionUser } from "@/lib/auth";

export default function MarketingPage() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [waybooks, setWaybooks] = useState<Awaited<ReturnType<typeof apiClient.listWaybooks>>["items"]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextSession = await getSession();
        if (active) {
          setSession(nextSession);
        }

        if (nextSession) {
          const response = await apiClient.listWaybooks();
          if (active) {
            setWaybooks(response.items);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load waybooks");
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
      {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {session ? (
        <>
          <header className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Your Waybooks</h1>
            <div className="flex items-center gap-2">
              <Link href="/app/waybooks/new" className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white">
                New Waybook
              </Link>
              <LogoutButton />
            </div>
          </header>
          <div className="grid gap-3">
            {waybooks.map((waybook) => (
              <WaybookCard key={waybook.id} waybook={waybook} />
            ))}
          </div>
        </>
      ) : (
        <section className="rounded-3xl bg-gradient-to-br from-brand-100 to-white p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">Waybook</p>
          <h1 className="mt-2 text-4xl font-bold">Capture once. Keep forever. Share effortlessly.</h1>
          <p className="mt-4 max-w-2xl text-slate-700">
            Waybook turns your trip photos, notes, and locations into a structured digital keepsake others can follow and recreate.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href={"/login" as any} className="rounded-md bg-brand-700 px-4 py-2 text-white">
              Sign in
            </Link>
            <Link href={"/signup" as any} className="rounded-md border border-brand-700 px-4 py-2 text-brand-700">
              Create account
            </Link>
          </div>
        </section>
      )}
    </PageShell>
  );
}

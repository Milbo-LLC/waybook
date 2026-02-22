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
  const [pendingInvites, setPendingInvites] = useState<Awaited<ReturnType<typeof apiClient.listPendingInvites>>["items"]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const nextSession = await getSession();
        if (active) {
          setSession(nextSession);
        }

        if (nextSession) {
          const [response, invitesResponse] = await Promise.all([apiClient.listWaybooks(), apiClient.listPendingInvites()]);
          if (active) {
            setWaybooks(response.items);
            setPendingInvites(invitesResponse.items);
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

  if (loading) {
    return (
      <PageShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-700" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
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
            {pendingInvites.length ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-semibold">Pending Invites</h2>
                <div className="mt-3 space-y-2">
                  {pendingInvites.map((invite) => (
                    <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-sm">
                      <div>
                        <p className="font-medium">{invite.waybookTitle}</p>
                        <p className="text-xs text-slate-500">
                          Invited by {invite.invitedBy.name || invite.invitedBy.email || "Waybook user"} as {invite.role}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="rounded bg-brand-700 px-3 py-1.5 text-xs font-medium text-white"
                          onClick={async () => {
                            await apiClient.acceptPendingInvite(invite.id);
                            const [response, invitesResponse] = await Promise.all([
                              apiClient.listWaybooks(),
                              apiClient.listPendingInvites()
                            ]);
                            setWaybooks(response.items);
                            setPendingInvites(invitesResponse.items);
                          }}
                          type="button"
                        >
                          Accept
                        </button>
                        <button
                          className="rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600"
                          onClick={async () => {
                            await apiClient.declinePendingInvite(invite.id);
                            setPendingInvites((current) => current.filter((item) => item.id !== invite.id));
                          }}
                          type="button"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
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

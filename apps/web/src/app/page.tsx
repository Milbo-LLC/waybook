"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppTopbar } from "@/components/app-topbar";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageShell } from "@/components/page-shell";
import { WaybookCard } from "@/features/waybooks/waybook-card";
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
        if (active) setSession(nextSession);

        if (nextSession) {
          const [response, invitesResponse] = await Promise.all([apiClient.listWaybooks(), apiClient.listPendingInvites()]);
          if (active) {
            setWaybooks(response.items);
            setPendingInvites(invitesResponse.items);
          }
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load waybooks");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <PageShell className="pt-20">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--brand)]" />
        </div>
      </PageShell>
    );
  }

  return (
    <>
      <AppTopbar
        user={session}
        rightSlot={
          session ? (
            <>
              <Link href="/app/waybooks/new" className="wb-btn-primary hidden sm:inline-flex">
                New Trip
              </Link>
              <LogoutButton />
            </>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link className="wb-btn-secondary" href={"/login" as any}>
                Sign in
              </Link>
              <Link className="wb-btn-primary" href={"/signup" as any}>
                Get started
              </Link>
            </div>
          )
        }
      />

      <PageShell className="pt-20">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {session ? (
          <>
            <section className="wb-surface p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Dashboard</p>
                  <h1 className="wb-title mt-1 text-3xl">Your trips</h1>
                  <p className="wb-muted mt-2 text-sm">Plan, decide, book, capture, and replay every trip in one place.</p>
                </div>
                <Link href="/app/waybooks/new" className="wb-btn-primary sm:hidden">
                  New Trip
                </Link>
              </div>
            </section>

            <div className="grid gap-4">
              {pendingInvites.length ? (
                <section className="wb-surface p-5">
                  <h2 className="wb-title text-lg">Invites waiting for you</h2>
                  <p className="wb-muted mt-1 text-sm">Accept to collaborate instantly. Decline if it is not relevant.</p>
                  <div className="mt-4 space-y-2">
                    {pendingInvites.map((invite) => (
                      <div key={invite.id} className="wb-surface-soft flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                        <div>
                          <p className="font-semibold">{invite.waybookTitle}</p>
                          <p className="wb-muted text-xs">
                            Invited by {invite.invitedBy.name || invite.invitedBy.email || "Waybook user"} as {invite.role}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="wb-btn-primary !rounded-lg !px-3 !py-1.5 !text-xs"
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
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700"
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

              <section className="grid gap-3">
                {waybooks.length ? (
                  waybooks.map((waybook) => <WaybookCard key={waybook.id} waybook={waybook} />)
                ) : (
                  <div className="wb-surface p-8 text-center">
                    <h2 className="wb-title text-xl">No trips yet</h2>
                    <p className="wb-muted mt-2 text-sm">Create your first trip to start planning and capturing memories.</p>
                    <Link className="wb-btn-primary mt-4 inline-flex" href="/app/waybooks/new">
                      Create your first trip
                    </Link>
                  </div>
                )}
              </section>
            </div>
          </>
        ) : (
          <section className="wb-surface overflow-hidden p-0">
            <div className="grid gap-8 p-8 md:grid-cols-[1.15fr_0.85fr] md:p-10">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Travel lifecycle, unified</p>
                <h1 className="wb-title mt-3 text-4xl leading-tight md:text-5xl">Plan. Decide. Book. Capture. Replay.</h1>
                <p className="wb-muted mt-4 max-w-2xl text-base">
                  Waybook gives friend groups one source of truth for ideas, decisions, bookings, expenses, and replayable lessons.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link className="wb-btn-primary" href={"/signup" as any}>
                    Start for free
                  </Link>
                  <Link className="wb-btn-secondary" href={"/login" as any}>
                    I already have an account
                  </Link>
                </div>
              </div>
              <div className="wb-surface-soft p-4 md:p-5">
                <p className="text-sm font-semibold text-slate-800">Why teams love it</p>
                <div className="mt-3 space-y-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <p className="font-semibold">Clear structure</p>
                    <p className="wb-muted mt-1 text-xs">No scattered docs or chats. Everything trip-related lives together.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <p className="font-semibold">Fast capture</p>
                    <p className="wb-muted mt-1 text-xs">Drop media and notes in seconds, even while in motion.</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <p className="font-semibold">Replayable output</p>
                    <p className="wb-muted mt-1 text-xs">Turn each trip into a practical blueprint for the next one.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </PageShell>
    </>
  );
}

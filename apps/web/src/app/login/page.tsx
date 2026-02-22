"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { startGoogleSignIn } from "@/lib/auth";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [safeNext, setSafeNext] = useState<string | null>(null);

  useEffect(() => {
    const nextPath = new URLSearchParams(window.location.search).get("next");
    setSafeNext(nextPath && nextPath.startsWith("/") ? nextPath : null);
  }, []);

  return (
    <PageShell className="pt-16">
      <div className="mx-auto w-full max-w-md wb-surface p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Welcome back</p>
        <h1 className="wb-title mt-2 text-3xl">Sign in to Waybook</h1>
        <p className="wb-muted mt-2 text-sm">Continue with your Google account.</p>

        <button
          className="wb-btn-primary mt-6 w-full"
          disabled={submitting}
          onClick={async () => {
            setError(null);
            setSubmitting(true);
            try {
              const nextPath = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
              const callbackPath = nextPath && nextPath.startsWith("/") ? nextPath : "/auth/callback";
              await startGoogleSignIn(callbackPath);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Unable to start Google sign in");
              setSubmitting(false);
            }
          }}
          type="button"
        >
          {submitting ? "Redirecting to Google..." : "Continue with Google"}
        </button>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <p className="wb-muted mt-5 text-sm">
          New here?{" "}
          <Link href={(safeNext ? `/signup?next=${encodeURIComponent(safeNext)}` : "/signup") as any} className="font-semibold text-[var(--brand)]">
            Sign up with Google
          </Link>
        </p>
      </div>
    </PageShell>
  );
}

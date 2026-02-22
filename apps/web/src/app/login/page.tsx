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
    <PageShell>
      <div className="mx-auto w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in to Waybook</h1>
        <p className="mt-1 text-sm text-slate-600">Continue with your Google account.</p>

        <button
          className="mt-4 w-full rounded bg-brand-700 px-4 py-2 text-white"
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

        <p className="mt-4 text-sm text-slate-600">
          New here?{" "}
          <Link href={(safeNext ? `/signup?next=${encodeURIComponent(safeNext)}` : "/signup") as any} className="text-brand-700">
            Sign up with Google
          </Link>
        </p>
      </div>
    </PageShell>
  );
}

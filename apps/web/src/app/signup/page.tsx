"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/page-shell";
import { startGoogleSignIn } from "@/lib/auth";

export default function SignupPage() {
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
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">Get started</p>
        <h1 className="wb-title mt-2 text-3xl">Create your account</h1>
        <p className="wb-muted mt-2 text-sm">Waybook currently supports Google sign-in.</p>

        <button
          className="wb-btn-primary mt-6 w-full"
          disabled={submitting}
          onClick={async () => {
            setError(null);
            setSubmitting(true);
            try {
              await startGoogleSignIn(safeNext ?? "/auth/callback");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Unable to start Google sign up");
              setSubmitting(false);
            }
          }}
          type="button"
        >
          {submitting ? "Redirecting to Google..." : "Sign up with Google"}
        </button>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <p className="wb-muted mt-5 text-sm">
          Already have an account?{" "}
          <Link href={(safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : "/login") as any} className="font-semibold text-[var(--brand)]">
            Sign in
          </Link>
        </p>
      </div>
    </PageShell>
  );
}

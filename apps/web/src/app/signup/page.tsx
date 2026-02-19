"use client";

import Link from "next/link";
import { useState } from "react";
import { PageShell } from "@/components/page-shell";
import { startGoogleSignIn } from "@/lib/auth";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Create your Waybook account</h1>
        <p className="mt-1 text-sm text-slate-600">Waybook uses Google OAuth only.</p>

        <button
          className="mt-4 w-full rounded bg-brand-700 px-4 py-2 text-white"
          disabled={submitting}
          onClick={async () => {
            setError(null);
            setSubmitting(true);
            try {
              await startGoogleSignIn("/auth/callback");
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

        <p className="mt-4 text-sm text-slate-600">
          Already have an account? <Link href={"/login" as any} className="text-brand-700">Sign in</Link>
        </p>
      </div>
    </PageShell>
  );
}

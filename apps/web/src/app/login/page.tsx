"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageShell } from "@/components/page-shell";
import { signInWithEmail } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in to Waybook</h1>
        <p className="mt-1 text-sm text-slate-600">Use your email and password.</p>

        <form
          className="mt-4 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setSubmitting(true);
            try {
              await signInWithEmail({ email, password });
              router.push("/app");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Unable to sign in");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <input
            className="rounded border p-2"
            type="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="rounded border p-2"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button className="rounded bg-brand-700 px-4 py-2 text-white" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>

        <p className="mt-4 text-sm text-slate-600">
          No account yet? <Link href={"/signup" as any} className="text-brand-700">Create one</Link>
        </p>
      </div>
    </PageShell>
  );
}

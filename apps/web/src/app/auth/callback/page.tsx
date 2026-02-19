"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { getSession } from "@/lib/auth";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const pollSession = async () => {
      while (!cancelled && attempts < 40) {
        attempts += 1;
        const session = await getSession();
        if (session) {
          router.replace("/" as any);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      if (!cancelled) {
        router.replace("/login" as any);
      }
    };

    void pollSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <PageShell>
      <div className="rounded-2xl border bg-white p-8 text-sm text-slate-600">
        Completing sign in...
      </div>
    </PageShell>
  );
}

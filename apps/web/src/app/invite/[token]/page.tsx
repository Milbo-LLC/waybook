"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api";
import { getSession } from "@/lib/auth";

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [message, setMessage] = useState("Accepting invite...");

  useEffect(() => {
    const run = async () => {
      const session = await getSession();
      if (!session) {
        router.replace(`/login?next=${encodeURIComponent(`/invite/${params.token}`)}` as any);
        return;
      }

      try {
        const response = await apiClient.acceptWaybookInvite(params.token);
        router.replace(`/app/waybooks/${response.waybookId}` as any);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Unable to accept invite.");
      }
    };

    void run();
  }, [params.token, router]);

  return (
    <PageShell>
      <p className="text-sm text-slate-600">{message}</p>
    </PageShell>
  );
}

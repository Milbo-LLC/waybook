"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WaybookCard } from "@/features/waybooks/waybook-card";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [waybooks, setWaybooks] = useState<Awaited<ReturnType<typeof apiClient.listWaybooks>>["items"]>([]);

  useEffect(() => {
    const run = async () => {
      const session = await getSession();
      if (!session) {
        router.replace("/login" as any);
        return;
      }

      try {
        const response = await apiClient.listWaybooks();
        setWaybooks(response.items);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [router]);

  return (
    <PageShell>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Waybooks</h1>
        <div className="flex items-center gap-2">
          <Link href="/app/waybooks/new" className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white">
            New Waybook
          </Link>
          <LogoutButton />
        </div>
      </header>
      {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
      <div className="grid gap-3">
        {waybooks.map((waybook) => (
          <WaybookCard key={waybook.id} waybook={waybook} />
        ))}
      </div>
    </PageShell>
  );
}

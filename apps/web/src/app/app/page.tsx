import Link from "next/link";
import { WaybookCard } from "@/features/waybooks/waybook-card";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api";
import { AuthNotice } from "@/features/auth/auth-notice";

export default async function DashboardPage() {
  let waybooks: Awaited<ReturnType<typeof apiClient.listWaybooks>>["items"] = [];

  try {
    const response = await apiClient.listWaybooks();
    waybooks = response.items;
  } catch {
    waybooks = [];
  }

  return (
    <PageShell>
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your Waybooks</h1>
        <Link href="/app/waybooks/new" className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white">
          New Waybook
        </Link>
      </header>
      <AuthNotice />
      <div className="grid gap-3">
        {waybooks.map((waybook) => (
          <WaybookCard key={waybook.id} waybook={waybook} />
        ))}
      </div>
    </PageShell>
  );
}

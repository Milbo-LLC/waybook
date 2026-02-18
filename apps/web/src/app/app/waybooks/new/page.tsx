"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { useEffect } from "react";

export default function NewWaybookPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const run = async () => {
      const session = await getSession();
      if (!session) {
        router.replace("/login" as any);
      }
    };
    void run();
  }, [router]);

  return (
    <PageShell>
      <h1 className="text-2xl font-semibold">Create Waybook</h1>
      <form
        className="grid max-w-xl gap-3 rounded-xl border bg-white p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          const created = await apiClient.createWaybook({
            title,
            startDate,
            endDate,
            description: description || null,
            visibility: "private"
          });
          router.push(`/app/waybooks/${created.id}`);
        }}
      >
        <input className="rounded border p-2" placeholder="Trip title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input className="rounded border p-2" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        <input className="rounded border p-2" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        <textarea className="rounded border p-2" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button className="rounded bg-brand-700 px-4 py-2 text-white" disabled={saving}>
          {saving ? "Creating..." : "Create"}
        </button>
      </form>
    </PageShell>
  );
}

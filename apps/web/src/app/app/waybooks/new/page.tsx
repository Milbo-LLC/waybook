"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createWaybookInputSchema } from "@waybook/contracts";
import { AppTopbar } from "@/components/app-topbar";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api";
import { getSession, type SessionUser } from "@/lib/auth";

type DateMode = "exact" | "flexible";

const monthByName: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12
};

const parseKickoffDraft = (text: string) => {
  const normalized = text.trim();
  const lower = normalized.toLowerCase();

  const patch: {
    title: string;
    description: string | null;
    timeframeLabel: string | null;
    budgetAmount: string;
    budgetCurrency: string;
    splitMethod: "equal" | "custom" | "percentage" | "shares";
  } = {
    title: "Trip",
    description: normalized || null,
    timeframeLabel: null,
    budgetAmount: "",
    budgetCurrency: "USD",
    splitMethod: "equal"
  };

  const titleMatch = normalized.match(/^([^.!\n]{3,80})/);
  if (titleMatch?.[1]) {
    patch.title = titleMatch[1].trim();
  }

  const monthMatch = lower.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/
  );
  if (monthMatch?.[1]) {
    const month = monthMatch[1];
    const monthNumber = monthByName[month] ?? new Date().getUTCMonth() + 1;
    const now = new Date();
    const year = now.getUTCMonth() + 1 > monthNumber ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
    patch.timeframeLabel = `${month[0]?.toUpperCase()}${month.slice(1)} ${year}`;
  }

  const budgetMatch = normalized.match(/\$?\s?(\d[\d,]*(?:\.\d{1,2})?)/);
  if (budgetMatch?.[1]) {
    const amount = Number(budgetMatch[1].replace(/,/g, ""));
    if (Number.isFinite(amount) && amount > 0) patch.budgetAmount = amount.toFixed(2);
  }

  if (lower.includes("custom split")) patch.splitMethod = "custom";
  if (lower.includes("percentage split")) patch.splitMethod = "percentage";
  if (lower.includes("share split") || lower.includes("shares split")) patch.splitMethod = "shares";
  if (lower.includes("equal split")) patch.splitMethod = "equal";

  return patch;
};

export default function NewTripPage() {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [dateMode, setDateMode] = useState<DateMode>("exact");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [timeframeLabel, setTimeframeLabel] = useState("");
  const [earliestStartDate, setEarliestStartDate] = useState("");
  const [latestEndDate, setLatestEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("USD");
  const [splitMethod, setSplitMethod] = useState<"equal" | "custom" | "percentage" | "shares">("equal");
  const [kickoffText, setKickoffText] = useState("");
  const [kickoffStatus, setKickoffStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const session = await getSession();
      if (!session) {
        router.replace("/login" as any);
        return;
      }
      setSessionUser(session);
    };
    void run();
  }, [router]);

  return (
    <>
      <AppTopbar
        user={sessionUser}
        rightSlot={
          <>
            <Link href="/" className="wb-btn-secondary hidden sm:inline-flex">
              Back to trips
            </Link>
            <LogoutButton />
          </>
        }
      />
      <PageShell className="pt-20">
        <section className="wb-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">New trip</p>
          <h1 className="wb-title mt-1 text-3xl">Create Trip</h1>
          <p className="wb-muted mt-2 text-sm">
            Start with exact dates or a general timeframe. You can update all details later.
          </p>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </section>

        <section className="mt-4 wb-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="wb-title text-lg">Conversational kickoff</h2>
            <button
              className="wb-btn-secondary !px-3 !py-1.5 !text-xs"
              onClick={async () => {
                const draft = parseKickoffDraft(kickoffText);
                const parseResult = createWaybookInputSchema.safeParse({
                  title: draft.title,
                  description: draft.description,
                  startDate: null,
                  endDate: null,
                  timeframeLabel: draft.timeframeLabel ?? "Flexible timeframe",
                  earliestStartDate: null,
                  latestEndDate: null,
                  visibility: "private"
                });
                if (!parseResult.success) {
                  setKickoffStatus("Could not extract a valid draft. Add destination, month, or budget details.");
                  return;
                }
                setTitle(draft.title);
                setDescription(draft.description ?? "");
                setDateMode("flexible");
                setTimeframeLabel(draft.timeframeLabel ?? "Flexible timeframe");
                setEarliestStartDate("");
                setLatestEndDate("");
                setBudgetAmount(draft.budgetAmount);
                setBudgetCurrency(draft.budgetCurrency);
                setSplitMethod(draft.splitMethod);
                setKickoffStatus("Draft applied. Review and create when ready.");
                try {
                  await apiClient.trackProductEvent({
                    eventType: "ai_prompt_started",
                    metadata: { surface: "new_trip_kickoff" }
                  });
                } catch {
                  // non-blocking analytics
                }
              }}
              type="button"
            >
              Generate draft
            </button>
          </div>
          <p className="wb-muted mt-1 text-sm">
            Example: “Beach trip in June with a $2500 budget and equal split for four friends.”
          </p>
          <textarea
            className="wb-input mt-3 min-h-24 resize-y"
            onChange={(event) => setKickoffText(event.target.value)}
            placeholder="Describe your trip in plain language..."
            value={kickoffText}
          />
          {kickoffStatus ? <p className="mt-2 text-xs text-slate-600">{kickoffStatus}</p> : null}
        </section>

        <form
          className="mt-4 grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError(null);
            try {
              const created = await apiClient.createWaybook({
                title: title.trim(),
                description: description.trim() ? description.trim() : null,
                startDate: dateMode === "exact" ? startDate || null : null,
                endDate: dateMode === "exact" ? endDate || null : null,
                timeframeLabel: dateMode === "flexible" ? timeframeLabel.trim() || null : null,
                earliestStartDate: dateMode === "flexible" ? earliestStartDate || null : null,
                latestEndDate: dateMode === "flexible" ? latestEndDate || null : null,
                visibility: "private"
              });

              const budgetMinor = budgetAmount.trim() ? Math.round(Number(budgetAmount) * 100) : null;
              await apiClient.updateTripPreferences(created.id, {
                budgetAmountMinor: Number.isFinite(budgetMinor) ? budgetMinor : null,
                budgetCurrency,
                baseCurrency: budgetCurrency,
                defaultSplitMethod: splitMethod
              });

              router.push(`/app/waybooks/${created.id}`);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Unable to create trip.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <section className="wb-surface p-5">
            <h2 className="wb-title text-lg">Trip details</h2>
            <div className="mt-3 grid gap-3">
              <input
                className="wb-input"
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Trip name"
                required
                value={title}
              />
              <textarea
                className="wb-input min-h-20 resize-y"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                value={description}
              />
            </div>
          </section>

          <section className="wb-surface p-5">
            <h2 className="wb-title text-lg">When are you going?</h2>
            <div className="mt-3 flex gap-2">
              <button
                className={`wb-pill ${dateMode === "exact" ? "wb-pill-active" : ""}`}
                onClick={() => setDateMode("exact")}
                type="button"
              >
                Exact dates
              </button>
              <button
                className={`wb-pill ${dateMode === "flexible" ? "wb-pill-active" : ""}`}
                onClick={() => setDateMode("flexible")}
                type="button"
              >
                Flexible timeframe
              </button>
            </div>

            {dateMode === "exact" ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Start date</span>
                  <input className="wb-input" onChange={(e) => setStartDate(e.target.value)} required type="date" value={startDate} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">End date</span>
                  <input className="wb-input" onChange={(e) => setEndDate(e.target.value)} required type="date" value={endDate} />
                </label>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2 text-sm">
                  <span className="mb-1 block text-slate-600">Timeframe label</span>
                  <input
                    className="wb-input"
                    onChange={(e) => setTimeframeLabel(e.target.value)}
                    placeholder="e.g., Summer 2026"
                    value={timeframeLabel}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Earliest start (optional)</span>
                  <input className="wb-input" onChange={(e) => setEarliestStartDate(e.target.value)} type="date" value={earliestStartDate} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-slate-600">Latest end (optional)</span>
                  <input className="wb-input" onChange={(e) => setLatestEndDate(e.target.value)} type="date" value={latestEndDate} />
                </label>
              </div>
            )}
          </section>

          <section className="wb-surface p-5">
            <h2 className="wb-title text-lg">Budget and split defaults</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr_220px]">
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Currency</span>
                <input
                  className="wb-input uppercase"
                  maxLength={8}
                  onChange={(e) => setBudgetCurrency(e.target.value.toUpperCase())}
                  value={budgetCurrency}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Budget amount (optional)</span>
                <input
                  className="wb-input"
                  min="0"
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={budgetAmount}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Default split method</span>
                <select className="wb-input" onChange={(e) => setSplitMethod(e.target.value as any)} value={splitMethod}>
                  <option value="equal">Equal</option>
                  <option value="percentage">Percentage</option>
                  <option value="shares">Shares</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            <button className="wb-btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Create trip"}
            </button>
            <Link className="wb-btn-secondary" href="/">
              Cancel
            </Link>
          </div>
        </form>
      </PageShell>
    </>
  );
}

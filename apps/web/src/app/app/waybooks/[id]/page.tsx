"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { ListMembersResponse, TripStageStateDTO } from "@waybook/contracts";
import { AppTopbar } from "@/components/app-topbar";
import { LogoutButton } from "@/components/auth/logout-button";
import { EntryList } from "@/features/entries/entry-list";
import { PageShell } from "@/components/page-shell";
import { apiClient } from "@/lib/api";
import { formatTripDateRange } from "@/lib/dates";
import { getSession, type SessionUser } from "@/lib/auth";

type StageKey = TripStageStateDTO["currentStage"];
type WorkspaceSection = "workflow" | "members" | "messages" | "settings";

const stageLabels: Record<StageKey, string> = {
  destinations: "Destinations",
  activities: "Activities",
  booking: "Booking",
  itinerary: "Itinerary",
  prep: "Prep",
  capture: "Capture",
  replay: "Replay"
};

const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();

const formatDictationText = (raw: string, previousText: string) => {
  const text = normalizeWhitespace(raw);
  if (!text) return "";

  const previous = previousText.trim();
  const shouldCapitalize = previous.length === 0 || /[.!?]\s*$/.test(previous);
  const withCapital = shouldCapitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  return /[.!?]$/.test(withCapital) ? withCapital : `${withCapital}.`;
};

export default function WaybookGuidedLifecyclePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const waybookId = useMemo(() => params.id, [params.id]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const [timeline, setTimeline] = useState<Awaited<ReturnType<typeof apiClient.getTimeline>> | null>(null);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof apiClient.listEntries>>["items"]>([]);
  const [stageState, setStageState] = useState<TripStageStateDTO | null>(null);
  const [activeStage, setActiveStage] = useState<StageKey>("destinations");
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>("workflow");

  const [membersData, setMembersData] = useState<ListMembersResponse | null>(null);
  const [destinations, setDestinations] = useState<Awaited<ReturnType<typeof apiClient.listDestinations>>["items"]>([]);
  const [activities, setActivities] = useState<Awaited<ReturnType<typeof apiClient.listActivityCandidates>>["items"]>([]);
  const [bookings, setBookings] = useState<Awaited<ReturnType<typeof apiClient.listBookings>>["items"]>([]);
  const [stays, setStays] = useState<Awaited<ReturnType<typeof apiClient.recommendStays>>["items"]>([]);
  const [itinerary, setItinerary] = useState<Awaited<ReturnType<typeof apiClient.listItineraryEvents>>["items"]>([]);
  const [checklist, setChecklist] = useState<Awaited<ReturnType<typeof apiClient.listChecklistItems>>["items"]>([]);
  const [readiness, setReadiness] = useState<Awaited<ReturnType<typeof apiClient.getReadinessScore>> | null>(null);
  const [tripMessages, setTripMessages] = useState<Awaited<ReturnType<typeof apiClient.listMessages>>["items"]>([]);
  const [dmThreads, setDmThreads] = useState<Awaited<ReturnType<typeof apiClient.listDMThreads>>["items"]>([]);
  const [selectedDmThread, setSelectedDmThread] = useState<string | null>(null);
  const [dmMessages, setDmMessages] = useState<Awaited<ReturnType<typeof apiClient.listMessages>>["items"]>([]);
  const [dmTargetUserId, setDmTargetUserId] = useState("");
  const [tripPreferences, setTripPreferences] = useState<Awaited<ReturnType<typeof apiClient.getTripPreferences>> | null>(null);
  const [budgetSummary, setBudgetSummary] = useState<Awaited<ReturnType<typeof apiClient.getBudgetSummary>> | null>(null);

  const [destinationName, setDestinationName] = useState("");
  const [destinationRationale, setDestinationRationale] = useState("");
  const [bookingTitle, setBookingTitle] = useState("");
  const [bookingType, setBookingType] = useState<"activity" | "stay" | "transport" | "flight" | "other">("activity");
  const [checklistTitle, setChecklistTitle] = useState("");
  const [tripMessageText, setTripMessageText] = useState("");
  const [dmMessageText, setDmMessageText] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetCurrencyInput, setBudgetCurrencyInput] = useState("USD");
  const [splitMethodInput, setSplitMethodInput] = useState<"equal" | "custom" | "percentage" | "shares">("equal");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expensePayerId, setExpensePayerId] = useState("");
  const [expenseStatus, setExpenseStatus] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingTrip, setDeletingTrip] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [savingCapture, setSavingCapture] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDictating, setIsDictating] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [dictationHint, setDictationHint] = useState<string | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const keepListeningRef = useRef(false);

  const [summaryText, setSummaryText] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: "Capture what happened..." })],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-slate prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-slate-500 min-h-[170px] max-w-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
      }
    }
  });

  const currentStage = stageState?.currentStage ?? "destinations";
  const stageMeta = stageState?.stages ?? [];
  const activeStageMeta = stageMeta.find((stage) => stage.stage === activeStage);
  const canAccessActiveStage = activeStageMeta?.status !== "locked";
  const accessRole = timeline?.accessRole ?? "viewer";
  const canEdit = accessRole === "owner" || accessRole === "editor";
  const canManageMembers = accessRole === "owner";
  const todayDate = new Date().toISOString().slice(0, 10);
  const todaySummary = timeline?.days.find((day) => day.date === todayDate)?.summary ?? null;

  const loadAll = async () => {
    if (!waybookId) return;
    const [
      timelineResponse,
      entriesResponse,
      stageResponse,
      membersResponse,
      destinationsResponse,
      activitiesResponse,
      bookingsResponse,
      itineraryResponse,
      checklistResponse,
      readinessResponse,
      messagesResponse,
      dmThreadsResponse,
      tripPreferencesResponse,
      budgetSummaryResponse
    ] = await Promise.all([
      apiClient.getTimeline(waybookId),
      apiClient.listEntries(waybookId),
      apiClient.getStageState(waybookId),
      apiClient.listWaybookMembers(waybookId),
      apiClient.listDestinations(waybookId),
      apiClient.listActivityCandidates(waybookId),
      apiClient.listBookings(waybookId),
      apiClient.listItineraryEvents(waybookId),
      apiClient.listChecklistItems(waybookId),
      apiClient.getReadinessScore(waybookId),
      apiClient.listMessages(waybookId, "trip", "trip:main"),
      apiClient.listDMThreads(waybookId),
      apiClient.getTripPreferences(waybookId),
      apiClient.getBudgetSummary(waybookId)
    ]);

    setTimeline(timelineResponse);
    setEntries(entriesResponse.items);
    setStageState(stageResponse);
    setActiveStage((prev) => {
      const existing = stageResponse.stages.find((stage) => stage.stage === prev);
      if (existing && existing.status !== "locked") return prev;
      return stageResponse.currentStage;
    });
    setMembersData(membersResponse);
    setDestinations(destinationsResponse.items);
    setActivities(activitiesResponse.items);
    setBookings(bookingsResponse.items);
    setItinerary(itineraryResponse.items);
    setChecklist(checklistResponse.items);
    setReadiness(readinessResponse);
    setTripMessages(messagesResponse.items);
    setDmThreads(dmThreadsResponse.items);
    const currentThread = selectedDmThread ?? dmThreadsResponse.items[0]?.threadKey ?? null;
    setSelectedDmThread(currentThread);
    if (currentThread) {
      const dmResponse = await apiClient.listMessages(waybookId, "dm", currentThread);
      setDmMessages(dmResponse.items);
    } else {
      setDmMessages([]);
    }
    setTripPreferences(tripPreferencesResponse);
    setBudgetSummary(budgetSummaryResponse);
    setBudgetInput(tripPreferencesResponse.budgetAmountMinor !== null ? (tripPreferencesResponse.budgetAmountMinor / 100).toFixed(2) : "");
    setBudgetCurrencyInput(tripPreferencesResponse.budgetCurrency || tripPreferencesResponse.baseCurrency || "USD");
    setSplitMethodInput(tripPreferencesResponse.defaultSplitMethod);
    if (!expensePayerId) {
      const ownerId = timelineResponse.waybook.userId;
      setExpensePayerId(ownerId);
    }
  };

  useEffect(() => {
    if (!waybookId) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      const session = await getSession();
      if (!session) {
        router.replace("/login" as any);
        return;
      }
      setSessionUser(session);
      try {
        await loadAll();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load trip";
        if (message.includes("API 401")) {
          router.replace("/login" as any);
          return;
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [router, waybookId]);

  useEffect(() => {
    const ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    setSpeechSupported(Boolean(ctor));
  }, []);

  useEffect(
    () => () => {
      keepListeningRef.current = false;
      if (recognitionRef.current) recognitionRef.current.stop();
    },
    []
  );

  useEffect(() => {
    const firstMember = membersData?.members.find((member) => member.userId !== sessionUser?.id);
    if (!dmTargetUserId && firstMember) {
      setDmTargetUserId(firstMember.userId);
    }
  }, [membersData, sessionUser, dmTargetUserId]);

  useEffect(() => {
    if (!waybookId || !selectedDmThread) return;
    void (async () => {
      const response = await apiClient.listMessages(waybookId, "dm", selectedDmThread);
      setDmMessages(response.items);
    })();
  }, [waybookId, selectedDmThread]);

  const uploadFileToEntry = async (entryId: string, file: File) => {
    const type = file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "photo";
    const upload = await apiClient.createUploadUrl(entryId, {
      type,
      mimeType: file.type,
      bytes: file.size,
      durationMs: undefined,
      fileName: file.name,
      idempotencyKey: crypto.randomUUID()
    });
    const uploadResponse = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: upload.requiredHeaders,
      body: file
    });
    if (!uploadResponse.ok) throw new Error(`Upload failed for ${file.name}: ${uploadResponse.status}`);
    await apiClient.completeUpload(upload.mediaId, crypto.randomUUID());
  };

  const stopDictation = () => {
    keepListeningRef.current = false;
    setIsDictating(false);
    setLiveTranscript("");
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  const startDictation = () => {
    const SpeechRecognitionCtor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setDictationHint("Speech-to-text is not supported in this browser.");
      return;
    }
    let recognition = recognitionRef.current;
    if (!recognition) {
      recognition = new SpeechRecognitionCtor();
      recognitionRef.current = recognition;
    }

    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript ?? "";
        if (event.results[i].isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (finalText.trim()) {
        const formatted = formatDictationText(finalText, editor?.getText() ?? "");
        if (formatted) editor?.chain().focus().insertContent(`${formatted} `).run();
      }
      setLiveTranscript(normalizeWhitespace(interim));
    };
    recognition.onend = () => {
      if (!keepListeningRef.current) {
        setIsDictating(false);
        setLiveTranscript("");
        return;
      }
      setTimeout(() => {
        try {
          recognition.start();
        } catch {
          // best effort restart
        }
      }, 250);
    };
    keepListeningRef.current = true;
    setIsDictating(true);
    setDictationHint(null);
    try {
      recognition.start();
    } catch (err) {
      keepListeningRef.current = false;
      setIsDictating(false);
      setDictationHint(err instanceof Error ? err.message : "Unable to start speech recognition.");
    }
  };

  if (loading) {
    return (
      <PageShell className="pt-20">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-[var(--brand)]" />
        </div>
      </PageShell>
    );
  }

  if (!timeline) {
    return (
      <PageShell className="pt-20">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? "Unable to load this trip."}
        </div>
      </PageShell>
    );
  }

  return (
    <>
      <AppTopbar
        user={sessionUser}
        rightSlot={
          <>
            <Link href="/app/waybooks/new" className="wb-btn-primary hidden sm:inline-flex">
              New Trip
            </Link>
            <LogoutButton />
          </>
        }
      />
      <PageShell className="pb-8 pt-20">
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        <section className="wb-surface px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <button
                  aria-label="Back to trips"
                  className="text-xl leading-none text-slate-700 transition hover:text-slate-900"
                  onClick={() => router.push("/")}
                  type="button"
                >
                  ←
                </button>
                <h1 className="wb-title truncate text-2xl leading-tight">{timeline.waybook.title}</h1>
              </div>
              <p className="wb-muted mt-1 text-sm">
                {formatTripDateRange(
                  timeline.waybook.startDate,
                  timeline.waybook.endDate,
                  timeline.waybook.timeframeLabel,
                  timeline.waybook.earliestStartDate,
                  timeline.waybook.latestEndDate
                )}
              </p>
              {timeline.waybook.description ? <p className="wb-muted mt-2 text-sm">{timeline.waybook.description}</p> : null}
            </div>
            {readiness ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                <p className="text-xs text-slate-500">Readiness</p>
                <p className="text-lg font-semibold text-slate-800">{readiness.score}%</p>
                <p className="text-xs text-slate-500">{readiness.daysUntilTrip} days</p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className={`wb-pill ${workspaceSection === "workflow" ? "wb-pill-active" : ""}`}
              onClick={() => setWorkspaceSection("workflow")}
              type="button"
            >
              Workflow
            </button>
            <button
              className={`wb-pill ${workspaceSection === "members" ? "wb-pill-active" : ""}`}
              onClick={() => setWorkspaceSection("members")}
              type="button"
            >
              Members
            </button>
            <button
              className={`wb-pill ${workspaceSection === "messages" ? "wb-pill-active" : ""}`}
              onClick={() => setWorkspaceSection("messages")}
              type="button"
            >
              Messages
            </button>
            <button
              className={`wb-pill ${workspaceSection === "settings" ? "wb-pill-active" : ""}`}
              onClick={() => setWorkspaceSection("settings")}
              type="button"
            >
              Settings
            </button>
          </div>

          {workspaceSection === "workflow" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {stageMeta.map((stage) => (
                <button
                  key={stage.stage}
                  className={`wb-pill ${activeStage === stage.stage ? "wb-pill-active" : ""} ${stage.status === "locked" ? "cursor-not-allowed opacity-50" : ""}`}
                  disabled={stage.status === "locked"}
                  onClick={() => setActiveStage(stage.stage)}
                  title={stage.missingRequirements.join(" ")}
                  type="button"
                >
                  {stageLabels[stage.stage]}
                </button>
              ))}
              {canEdit ? (
                <button
                  className="wb-btn-secondary !px-3 !py-1.5 !text-xs"
                  onClick={async () => {
                    await apiClient.advanceStage(waybookId);
                    await loadAll();
                  }}
                  type="button"
                >
                  Complete stage
                </button>
              ) : null}
            </div>
          ) : null}
          {workspaceSection === "workflow" && activeStageMeta?.status === "locked" && activeStageMeta.missingRequirements.length ? (
            <p className="mt-2 text-xs text-amber-700">Locked: {activeStageMeta.missingRequirements.join(" ")}</p>
          ) : null}
        </section>

        <div className="mt-4 space-y-4">
          {workspaceSection === "workflow" ? (
            <div className="space-y-4">
              {!canAccessActiveStage ? null : null}
 

            {activeStage === "destinations" && canAccessActiveStage ? (
              <section className="wb-surface p-5">
                <h2 className="wb-title text-lg">Destination selection</h2>
                <p className="wb-muted mt-1 text-sm">Propose destinations, vote, then lock finalists.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    className="wb-input"
                    onChange={(event) => setDestinationName(event.target.value)}
                    placeholder="Destination name (e.g., Lisbon)"
                    value={destinationName}
                  />
                  <input
                    className="wb-input"
                    onChange={(event) => setDestinationRationale(event.target.value)}
                    placeholder="Why this destination?"
                    value={destinationRationale}
                  />
                  <button
                    className="wb-btn-primary disabled:opacity-60"
                    disabled={!canEdit}
                    onClick={async () => {
                      if (!destinationName.trim()) return;
                      await apiClient.createDestination(waybookId, {
                        name: destinationName.trim(),
                        rationale: destinationRationale.trim() || null
                      });
                      setDestinationName("");
                      setDestinationRationale("");
                      await loadAll();
                    }}
                    type="button"
                  >
                    Add
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {destinations.map((destination) => (
                    <div key={destination.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{destination.name}</p>
                          <p className="text-xs text-slate-500">
                            {destination.status}
                            {destination.rationale ? ` • ${destination.rationale}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="rounded border px-2 py-1 text-xs"
                            onClick={async () => {
                              await apiClient.voteDestination(destination.id, { vote: "up" });
                              await loadAll();
                            }}
                            type="button"
                          >
                            👍 {destination.votesUp}
                          </button>
                          <button
                            className="rounded border px-2 py-1 text-xs"
                            onClick={async () => {
                              await apiClient.voteDestination(destination.id, { vote: "down" });
                              await loadAll();
                            }}
                            type="button"
                          >
                            👎 {destination.votesDown}
                          </button>
                          {canEdit ? (
                            destination.status === "locked" ? (
                              <button
                                className="rounded border px-2 py-1 text-xs"
                                onClick={async () => {
                                  await apiClient.unlockDestination(destination.id);
                                  await loadAll();
                                }}
                                type="button"
                              >
                                Unlock
                              </button>
                            ) : (
                              <button
                                className="rounded border px-2 py-1 text-xs"
                                onClick={async () => {
                                  await apiClient.lockDestination(destination.id);
                                  await loadAll();
                                }}
                                type="button"
                              >
                                Lock
                              </button>
                            )
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!destinations.length ? <p className="text-sm text-slate-500">No destinations yet.</p> : null}
                </div>
              </section>
            ) : null}

            {activeStage === "activities" && canAccessActiveStage ? (
              <section className="wb-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="wb-title text-lg">Activity discovery</h2>
                    <p className="wb-muted mt-1 text-sm">Research, vote, and lock must-do activities.</p>
                  </div>
                  <button
                    className="wb-btn-primary disabled:opacity-60"
                    disabled={!canEdit}
                    onClick={async () => {
                      await apiClient.runActivityResearch(waybookId, { maxPerDestination: 5 });
                      await loadAll();
                    }}
                    type="button"
                  >
                    Research activities
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {activities.map((activity) => (
                    <div key={activity.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{activity.title}</p>
                          <p className="text-xs text-slate-500">
                            {activity.providerHint || "source"} • confidence {activity.confidenceScore}% • {activity.status}
                          </p>
                          {activity.sourceUrl ? (
                            <a className="text-xs text-blue-600 underline" href={activity.sourceUrl} rel="noreferrer" target="_blank">
                              Source link
                            </a>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="rounded border px-2 py-1 text-xs"
                            onClick={async () => {
                              await apiClient.voteActivity(activity.id, { vote: "up" });
                              await loadAll();
                            }}
                            type="button"
                          >
                            👍 {activity.votesUp}
                          </button>
                          <button
                            className="rounded border px-2 py-1 text-xs"
                            onClick={async () => {
                              await apiClient.voteActivity(activity.id, { vote: "down" });
                              await loadAll();
                            }}
                            type="button"
                          >
                            👎 {activity.votesDown}
                          </button>
                          {canEdit ? (
                            <>
                              <button
                                className="rounded border px-2 py-1 text-xs"
                                onClick={async () => {
                                  await apiClient.shortlistActivity(activity.id);
                                  await loadAll();
                                }}
                                type="button"
                              >
                                Shortlist
                              </button>
                              <button
                                className="rounded border px-2 py-1 text-xs"
                                onClick={async () => {
                                  await apiClient.lockActivity(activity.id);
                                  await loadAll();
                                }}
                                type="button"
                              >
                                Lock
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!activities.length ? <p className="text-sm text-slate-500">Run research to generate activity candidates.</p> : null}
                </div>
              </section>
            ) : null}

            {activeStage === "booking" && canAccessActiveStage ? (
              <section className="wb-surface p-5">
                <h2 className="wb-title text-lg">Booking</h2>
                <p className="wb-muted mt-1 text-sm">Track confirmations and complete provider checkout in app.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                  <input className="wb-input" onChange={(e) => setBookingTitle(e.target.value)} placeholder="Booking title" value={bookingTitle} />
                  <select
                    className="rounded-lg border border-slate-200 p-2 text-sm"
                    onChange={(e) => setBookingType(e.target.value as any)}
                    value={bookingType}
                  >
                    <option value="activity">activity</option>
                    <option value="stay">stay</option>
                    <option value="transport">transport</option>
                    <option value="flight">flight</option>
                    <option value="other">other</option>
                  </select>
                  <button
                    className="wb-btn-primary disabled:opacity-60"
                    disabled={!canEdit}
                    onClick={async () => {
                      if (!bookingTitle.trim()) return;
                      await apiClient.createBooking(waybookId, { title: bookingTitle.trim(), type: bookingType });
                      setBookingTitle("");
                      await loadAll();
                    }}
                    type="button"
                  >
                    Add booking
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="wb-btn-secondary !px-3 !py-1.5 !text-xs"
                    onClick={async () => {
                      const response = await apiClient.recommendStays(waybookId, { budgetTier: null, bookingType: "stay" });
                      setStays(response.items);
                    }}
                    type="button"
                  >
                    Recommend stays
                  </button>
                </div>
                {stays.length ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-medium">Suggested stays</p>
                    <div className="mt-2 space-y-2">
                      {stays.map((stay) => (
                        <div key={stay.id} className="rounded-lg border border-slate-200 bg-white p-2 text-sm">
                          <p className="font-medium">{stay.title}</p>
                          <p className="text-xs text-slate-500">{stay.location} • {stay.provider}</p>
                          <a className="text-xs text-blue-600 underline" href={stay.sourceUrl} rel="noreferrer" target="_blank">
                            Provider page
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="mt-4 space-y-2">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                      <div>
                        <p className="font-medium">{booking.title}</p>
                        <p className="text-xs text-slate-500">{booking.type} • {booking.bookingStatus}</p>
                      </div>
                      {canEdit ? (
                        <div className="flex gap-2">
                          <button
                            className="rounded border px-2 py-1 text-xs"
                            onClick={async () => {
                              const result = await apiClient.createEmbeddedCheckoutSession(booking.id, {
                                returnUrl: `${window.location.origin}/app/waybooks/${waybookId}`
                              });
                              window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
                            }}
                            type="button"
                          >
                            Checkout
                          </button>
                          <button
                            className="rounded border px-2 py-1 text-xs"
                            onClick={async () => {
                              await apiClient.completeEmbeddedCheckout(booking.id, {
                                providerReference: booking.providerBookingId || crypto.randomUUID(),
                                status: "confirmed"
                              });
                              await loadAll();
                            }}
                            type="button"
                          >
                            Mark confirmed
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {!bookings.length ? <p className="text-sm text-slate-500">No bookings yet.</p> : null}
                </div>
              </section>
            ) : null}

            {activeStage === "itinerary" && canAccessActiveStage ? (
              <section className="wb-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="wb-title text-lg">Auto itinerary</h2>
                    <p className="wb-muted mt-1 text-sm">Generate from bookings + locked activities, then adjust if needed.</p>
                  </div>
                  <button
                    className="wb-btn-primary disabled:opacity-60"
                    disabled={!canEdit}
                    onClick={async () => {
                      await apiClient.generateItinerary(waybookId);
                      await loadAll();
                    }}
                    type="button"
                  >
                    Generate itinerary
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {itinerary.map((event) => (
                    <div key={event.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-xs text-slate-500">{new Date(event.startTime).toLocaleString()}</p>
                    </div>
                  ))}
                  {!itinerary.length ? <p className="text-sm text-slate-500">No itinerary yet. Generate once booking coverage is complete.</p> : null}
                </div>
              </section>
            ) : null}

            {activeStage === "prep" && canAccessActiveStage ? (
              <section className="wb-surface p-5">
                <h2 className="wb-title text-lg">Pre-trip prep</h2>
                <p className="wb-muted mt-1 text-sm">Track critical deadlines so this trip actually happens.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input className="wb-input" onChange={(e) => setChecklistTitle(e.target.value)} placeholder="Checklist item" value={checklistTitle} />
                  <button
                    className="wb-btn-primary disabled:opacity-60"
                    disabled={!canEdit}
                    onClick={async () => {
                      if (!checklistTitle.trim()) return;
                      await apiClient.createChecklistItem(waybookId, {
                        title: checklistTitle.trim(),
                        isCritical: true
                      });
                      setChecklistTitle("");
                      await loadAll();
                    }}
                    type="button"
                  >
                    Add critical item
                  </button>
                </div>
                <div className="mt-4 space-y-2">
                  {checklist.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                      <div>
                        <p className="font-medium">
                          {item.title} {item.isCritical ? <span className="text-xs text-red-600">(critical)</span> : null}
                        </p>
                        <p className="text-xs text-slate-500">{item.status}</p>
                      </div>
                      {canEdit ? (
                        <select
                          className="rounded border px-2 py-1 text-xs"
                          onChange={async (event) => {
                            await apiClient.updateChecklistItem(item.id, { status: event.target.value as any });
                            await loadAll();
                          }}
                          value={item.status}
                        >
                          <option value="todo">todo</option>
                          <option value="in_progress">in progress</option>
                          <option value="done">done</option>
                        </select>
                      ) : null}
                    </div>
                  ))}
                  {!checklist.length ? <p className="text-sm text-slate-500">No checklist items yet.</p> : null}
                </div>
              </section>
            ) : null}

            {activeStage === "capture" && canAccessActiveStage ? (
              <section className="wb-surface p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="wb-title text-lg">Capture + reflection</h2>
                    <p className="wb-muted mt-1 text-sm">Capture quickly and reflect daily while the trip is live.</p>
                  </div>
                  <button
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      isDictating ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
                    }`}
                    onClick={() => (isDictating ? stopDictation() : startDictation())}
                    type="button"
                  >
                    {isDictating ? "Stop listening" : "Speak to write"}
                  </button>
                </div>
                <div className="mt-4">
                  <EditorContent editor={editor} />
                  {isDictating ? (
                    <p className="mt-2 text-xs text-slate-500">Listening... {liveTranscript ? `"${liveTranscript}"` : "start talking"}</p>
                  ) : null}
                  {!speechSupported ? <p className="mt-2 text-xs text-amber-700">Speech-to-text is browser dependent.</p> : null}
                  {dictationHint ? <p className="mt-2 text-xs text-slate-500">{dictationHint}</p> : null}
                </div>
                <div className="mt-4">
                  <label className="text-sm font-medium">Add media</label>
                  <input
                    ref={fileInputRef}
                    accept="image/*,video/*,audio/*"
                    className="mt-2 block w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm"
                    multiple
                    onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
                    type="file"
                  />
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    className="wb-btn-primary disabled:opacity-60"
                    disabled={savingCapture || !canEdit}
                    onClick={async () => {
                      const html = editor?.getHTML() ?? "";
                      const text = editor?.getText().trim() ?? "";
                      if (!text && selectedFiles.length === 0) return;
                      setSavingCapture(true);
                      setCaptureStatus("Creating entry...");
                      try {
                        const entry = await apiClient.createEntry(waybookId, {
                          capturedAt: new Date().toISOString(),
                          textContent: text ? html : null,
                          location: null,
                          idempotencyKey: crypto.randomUUID()
                        });
                        for (const file of selectedFiles) await uploadFileToEntry(entry.id, file);
                        editor?.commands.clearContent();
                        setSelectedFiles([]);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                        setCaptureStatus("Saved");
                        await loadAll();
                      } catch (err) {
                        setCaptureStatus(err instanceof Error ? err.message : "Unable to save capture");
                      } finally {
                        setSavingCapture(false);
                      }
                    }}
                    type="button"
                  >
                    {savingCapture ? "Saving..." : "Save capture"}
                  </button>
                </div>
                {captureStatus ? <p className="mt-2 text-xs text-slate-500">{captureStatus}</p> : null}
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="text-sm font-semibold">Daily reflection</p>
                  <textarea
                    className="mt-2 w-full rounded border p-2 text-sm"
                    onChange={(event) => setSummaryText(event.target.value)}
                    placeholder={todaySummary?.summaryText ?? "What stood out today?"}
                    rows={3}
                    value={summaryText}
                  />
                  <button
                    className="wb-btn-secondary mt-2 !px-3 !py-1.5 !text-xs"
                    disabled={savingSummary || !canEdit}
                    onClick={async () => {
                      setSavingSummary(true);
                      try {
                        await apiClient.createDaySummary(waybookId, {
                          summaryDate: todayDate,
                          summaryText: summaryText.trim() || todaySummary?.summaryText || null,
                          topMomentEntryId: entries[0]?.id ?? null,
                          moodScore: 4,
                          energyScore: 4
                        });
                        setSummaryText("");
                        await loadAll();
                      } finally {
                        setSavingSummary(false);
                      }
                    }}
                    type="button"
                  >
                    {savingSummary ? "Saving..." : "Save reflection"}
                  </button>
                </div>
                <div className="mt-6">
                  <EntryList entries={entries} onRefresh={loadAll} />
                </div>
              </section>
            ) : null}

            {activeStage === "replay" && canAccessActiveStage ? (
              <section className="wb-surface p-5">
                <h2 className="wb-title text-lg">Replay blueprint</h2>
                <p className="wb-muted mt-1 text-sm">
                  This stage assembles a sanitized playbook from itinerary + reflections + ratings. Booking/payment details stay private.
                </p>
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  Replay output endpoint and rendering scaffold are enabled in the lifecycle model. Final polish can now focus on ranking and formatting.
                </div>
              </section>
            ) : null}
          </div>
          ) : null}

          {workspaceSection === "members" ? (
            <section className="wb-surface p-5">
              <h2 className="wb-title text-lg">Member management</h2>
              <p className="wb-muted mt-1 text-sm">Invite people, manage roles, and monitor pending invites.</p>

              <div className="mt-4 space-y-2">
                {membersData?.members.map((member) => (
                  <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span>{member.user.name || member.user.email || member.userId}</span>
                      {sessionUser?.id === member.userId ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">You</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{member.role}</span>
                      {canManageMembers && sessionUser?.id !== member.userId && member.role !== "owner" ? (
                        <>
                          <select
                            className="rounded border px-2 py-1 text-xs"
                            onChange={async (event) => {
                              await apiClient.updateWaybookMemberRole(waybookId, member.id, {
                                role: event.target.value as "editor" | "viewer"
                              });
                              await loadAll();
                            }}
                            value={member.role}
                          >
                            <option value="editor">editor</option>
                            <option value="viewer">viewer</option>
                          </select>
                          <button
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                            onClick={async () => {
                              await apiClient.removeWaybookMember(waybookId, member.id);
                              await loadAll();
                            }}
                            type="button"
                          >
                            Remove
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {canManageMembers ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                  <input
                    className="wb-input"
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="friend@example.com"
                    type="email"
                    value={inviteEmail}
                  />
                  <select
                    className="rounded-lg border border-slate-200 p-2 text-sm"
                    onChange={(event) => setInviteRole(event.target.value as "editor" | "viewer")}
                    value={inviteRole}
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    className="wb-btn-primary !px-3 !py-1.5 !text-xs"
                    onClick={async () => {
                      if (!inviteEmail.trim()) return;
                      setInviteStatus("Sending...");
                      try {
                        await apiClient.createWaybookInvite(waybookId, { email: inviteEmail.trim(), role: inviteRole });
                        setInviteEmail("");
                        setInviteStatus("Invite sent.");
                        await loadAll();
                      } catch (err) {
                        setInviteStatus(err instanceof Error ? err.message : "Unable to send invite.");
                      }
                    }}
                    type="button"
                  >
                    Invite
                  </button>
                  {inviteStatus ? <p className="text-xs text-slate-500 sm:col-span-3">{inviteStatus}</p> : null}
                </div>
              ) : null}

              <div className="mt-4 border-t border-slate-100 pt-4">
                <h3 className="wb-title text-base">Pending invites</h3>
                <div className="mt-2 space-y-2">
                  {membersData?.invites.map((invite) => (
                    <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm">
                      <div>
                        <p className="font-medium">{invite.email}</p>
                        <p className="text-xs text-slate-500">{invite.role} • sent {new Date(invite.createdAt).toLocaleString()}</p>
                      </div>
                      {canManageMembers ? (
                        <div className="flex items-center gap-2">
                          <button
                            className="rounded border px-2 py-1 text-xs"
                            onClick={async () => {
                              await apiClient.resendWaybookInvite(waybookId, invite.id);
                              await loadAll();
                            }}
                            type="button"
                          >
                            Resend
                          </button>
                          <button
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700"
                            onClick={async () => {
                              await apiClient.revokeWaybookInvite(waybookId, invite.id);
                              await loadAll();
                            }}
                            type="button"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {!membersData?.invites.length ? <p className="text-sm text-slate-500">No pending invites.</p> : null}
                </div>
              </div>
            </section>
          ) : null}

          {workspaceSection === "messages" ? (
            <section className="wb-surface p-5">
              <h2 className="wb-title text-lg">Messages</h2>
              <p className="wb-muted mt-1 text-sm">Trip channel and direct messages are managed in one place.</p>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">Trip channel</p>
                  <div className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {tripMessages.map((message) => {
                      const sender = membersData?.members.find((m) => m.userId === message.senderUserId);
                      return (
                        <div key={message.id} className="rounded bg-slate-50 p-2 text-sm">
                          <p className="text-xs font-medium text-slate-600">{sender?.user.name || sender?.user.email || "Trip member"}</p>
                          <p className="mt-1">{message.body}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{new Date(message.createdAt).toLocaleString()}</p>
                        </div>
                      );
                    })}
                    {!tripMessages.length ? <p className="text-sm text-slate-500">No trip messages yet.</p> : null}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input className="wb-input" onChange={(e) => setTripMessageText(e.target.value)} placeholder="Message the trip..." value={tripMessageText} />
                    <button
                      className="wb-btn-secondary !px-3 !py-1.5 !text-xs"
                      onClick={async () => {
                        if (!tripMessageText.trim()) return;
                        await apiClient.createMessage(waybookId, {
                          scope: "trip",
                          threadKey: "trip:main",
                          body: tripMessageText.trim()
                        });
                        setTripMessageText("");
                        await loadAll();
                      }}
                      type="button"
                    >
                      Send
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-semibold text-slate-800">Direct messages</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <select className="wb-input" onChange={(event) => setDmTargetUserId(event.target.value)} value={dmTargetUserId}>
                      <option value="">Select a member</option>
                      {membersData?.members
                        .filter((member) => member.userId !== sessionUser?.id)
                        .map((member) => (
                          <option key={member.userId} value={member.userId}>
                            {member.user.name || member.user.email || member.userId}
                          </option>
                        ))}
                    </select>
                    <button
                      className="wb-btn-secondary !px-3 !py-1.5 !text-xs"
                      disabled={!dmTargetUserId || !sessionUser?.id}
                      onClick={async () => {
                        if (!dmTargetUserId || !sessionUser?.id) return;
                        const sortedIds = [sessionUser.id, dmTargetUserId].sort();
                        const thread = `dm:${sortedIds.join(":")}`;
                        setSelectedDmThread(thread);
                        const exists = dmThreads.some((item) => item.threadKey === thread);
                        if (!exists) {
                          setDmThreads((current) => [
                            { threadKey: thread, participantIds: [sessionUser.id, dmTargetUserId], lastMessageAt: null },
                            ...current
                          ]);
                        }
                      }}
                      type="button"
                    >
                      Open DM
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-[200px_1fr]">
                    <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                      {dmThreads.map((thread) => {
                        const otherUserId = thread.participantIds.find((id) => id !== sessionUser?.id) ?? thread.participantIds[0];
                        const otherMember = membersData?.members.find((member) => member.userId === otherUserId);
                        const label = otherMember?.user.name || otherMember?.user.email || "Direct chat";
                        return (
                          <button
                            key={thread.threadKey}
                            className={`w-full rounded-md px-2 py-1 text-left text-xs ${selectedDmThread === thread.threadKey ? "bg-slate-100 font-semibold" : "hover:bg-slate-50"}`}
                            onClick={() => setSelectedDmThread(thread.threadKey)}
                            type="button"
                          >
                            <p className="truncate">{label}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500">{thread.lastMessageAt ? new Date(thread.lastMessageAt).toLocaleString() : "No messages yet"}</p>
                          </button>
                        );
                      })}
                      {!dmThreads.length ? <p className="text-xs text-slate-500">No DM threads yet.</p> : null}
                    </div>

                    <div>
                      <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
                        {dmMessages.map((message) => {
                          const mine = message.senderUserId === sessionUser?.id;
                          const sender = membersData?.members.find((member) => member.userId === message.senderUserId);
                          return (
                            <div key={message.id} className={`rounded p-2 text-sm ${mine ? "bg-emerald-50" : "bg-slate-50"}`}>
                              <p className="text-xs font-medium text-slate-600">{mine ? "You" : sender?.user.name || sender?.user.email || "Member"}</p>
                              <p className="mt-1">{message.body}</p>
                              <p className="mt-1 text-[11px] text-slate-500">{new Date(message.createdAt).toLocaleString()}</p>
                            </div>
                          );
                        })}
                        {!dmMessages.length ? <p className="text-xs text-slate-500">{selectedDmThread ? "No messages in this thread." : "Open a thread to start messaging."}</p> : null}
                      </div>

                      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                        <input className="wb-input" onChange={(e) => setDmMessageText(e.target.value)} placeholder="Send a direct message..." value={dmMessageText} />
                        <button
                          className="wb-btn-secondary !px-3 !py-1.5 !text-xs"
                          disabled={!selectedDmThread}
                          onClick={async () => {
                            if (!dmMessageText.trim() || !selectedDmThread) return;
                            await apiClient.createMessage(waybookId, {
                              scope: "dm",
                              threadKey: selectedDmThread,
                              body: dmMessageText.trim()
                            });
                            setDmMessageText("");
                            await loadAll();
                          }}
                          type="button"
                        >
                          Send DM
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {workspaceSection === "settings" ? (
            <section className="wb-surface p-5">
              <h2 className="wb-title text-lg">Trip settings</h2>
              <p className="wb-muted mt-1 text-sm">Budget defaults, expense tracking, and destructive actions.</p>

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Spent</p>
                <p className="text-lg font-semibold text-slate-900">
                  {budgetSummary
                    ? `${(budgetSummary.totalBaseAmountMinor / 100).toLocaleString(undefined, {
                        style: "currency",
                        currency: budgetSummary.currency || "USD"
                      })}`
                    : "—"}
                </p>
                {budgetSummary && budgetSummary.budgetAmountMinor !== null ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Remaining{" "}
                    {(Number(budgetSummary.remainingAmountMinor ?? 0) / 100).toLocaleString(undefined, {
                      style: "currency",
                      currency: budgetSummary.budgetCurrency || budgetSummary.currency || "USD"
                    })}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">No trip budget set yet.</p>
                )}
              </div>
              {canEdit ? (
                <>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px_180px_auto]">
                    <input
                      className="wb-input"
                      min="0"
                      onChange={(event) => setBudgetInput(event.target.value)}
                      placeholder="Budget (optional)"
                      step="0.01"
                      type="number"
                      value={budgetInput}
                    />
                    <input
                      className="wb-input uppercase"
                      maxLength={8}
                      onChange={(event) => setBudgetCurrencyInput(event.target.value.toUpperCase())}
                      value={budgetCurrencyInput}
                    />
                    <select
                      className="wb-input"
                      onChange={(event) => setSplitMethodInput(event.target.value as "equal" | "custom" | "percentage" | "shares")}
                      value={splitMethodInput}
                    >
                      <option value="equal">Equal split</option>
                      <option value="percentage">Percentage split</option>
                      <option value="shares">Shares split</option>
                      <option value="custom">Custom split</option>
                    </select>
                    <button
                      className="wb-btn-secondary !px-3 !py-1.5 !text-xs"
                      onClick={async () => {
                        const budgetAmountMinor = budgetInput.trim() ? Math.round(Number(budgetInput) * 100) : null;
                        await apiClient.updateTripPreferences(waybookId, {
                          budgetAmountMinor: Number.isFinite(budgetAmountMinor) ? budgetAmountMinor : null,
                          budgetCurrency: budgetCurrencyInput,
                          baseCurrency: budgetCurrencyInput,
                          defaultSplitMethod: splitMethodInput
                        });
                        await loadAll();
                      }}
                      type="button"
                    >
                      Save
                    </button>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick expense</p>
                    <div className="grid gap-2 sm:grid-cols-[1fr_160px_200px_auto]">
                      <input
                        className="wb-input"
                        onChange={(event) => setExpenseTitle(event.target.value)}
                        placeholder="Expense title"
                        value={expenseTitle}
                      />
                      <input
                        className="wb-input"
                        min="0"
                        onChange={(event) => setExpenseAmount(event.target.value)}
                        placeholder="Amount"
                        step="0.01"
                        type="number"
                        value={expenseAmount}
                      />
                      <select className="wb-input" onChange={(event) => setExpensePayerId(event.target.value)} value={expensePayerId}>
                        {[timeline.waybook.userId, ...(membersData?.members ?? []).map((member) => member.userId)]
                          .filter((value, index, arr) => arr.indexOf(value) === index)
                          .map((userId) => {
                            const member = membersData?.members.find((item) => item.userId === userId);
                            const label = member?.user.name || member?.user.email || userId;
                            return (
                              <option key={userId} value={userId}>
                                Paid by {label}
                              </option>
                            );
                          })}
                      </select>
                      <button
                        className="wb-btn-primary !px-3 !py-1.5 !text-xs"
                        onClick={async () => {
                          if (!expenseTitle.trim() || !expenseAmount.trim() || !expensePayerId) return;
                          setExpenseStatus("Saving expense...");
                          try {
                            const amountMinor = Math.round(Number(expenseAmount) * 100);
                            const participants = [timeline.waybook.userId, ...(membersData?.members ?? []).map((member) => member.userId)]
                              .filter((value, index, arr) => arr.indexOf(value) === index);
                            const splitMethod = tripPreferences?.defaultSplitMethod ?? splitMethodInput;
                            const splits =
                              splitMethod === "percentage"
                                ? participants.map((userId) => ({
                                    userId,
                                    percentage: Math.floor(100 / Math.max(participants.length, 1))
                                  }))
                                : splitMethod === "shares"
                                  ? participants.map((userId) => ({ userId, shares: 1 }))
                                  : [];

                            await apiClient.createExpense(waybookId, {
                              title: expenseTitle.trim(),
                              category: "trip",
                              paidByUserId: expensePayerId,
                              currency: budgetCurrencyInput,
                              amountMinor,
                              tripBaseCurrency: tripPreferences?.baseCurrency || budgetCurrencyInput,
                              tripBaseAmountMinor: amountMinor,
                              fxRate: null,
                              incurredAt: new Date().toISOString(),
                              notes: null,
                              splitMethod,
                              status: "logged",
                              splits
                            });
                            setExpenseTitle("");
                            setExpenseAmount("");
                            setExpenseStatus("Expense saved.");
                            await loadAll();
                          } catch (err) {
                            setExpenseStatus(err instanceof Error ? err.message : "Unable to save expense.");
                          }
                        }}
                        type="button"
                      >
                        Add expense
                      </button>
                    </div>
                    {expenseStatus ? <p className="text-xs text-slate-500">{expenseStatus}</p> : null}
                  </div>
                </>
              ) : null}

              {accessRole === "owner" ? (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <h3 className="wb-title text-base text-red-700">Danger zone</h3>
                  <p className="mt-1 text-xs text-red-700">Delete this trip permanently.</p>
                  <button
                    className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700"
                    onClick={() => {
                      setDeleteConfirmText("");
                      setShowDeleteModal(true);
                    }}
                    type="button"
                  >
                    Delete trip
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </PageShell>
      {showDeleteModal ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/50 p-4">
          <div className="wb-surface w-full max-w-md p-5">
            <h3 className="wb-title text-lg">Delete trip</h3>
            <p className="mt-1 text-sm text-red-700">
              This permanently deletes the trip, entries, bookings, expenses, and member access.
            </p>
            <p className="mt-3 text-xs text-slate-600">
              Type <code className="rounded bg-slate-100 px-1 py-0.5">{`delete ${timeline.waybook.title}`}</code> to confirm.
            </p>
            <input
              className="wb-input mt-2"
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder={`delete ${timeline.waybook.title}`}
              value={deleteConfirmText}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button className="wb-btn-secondary !px-3 !py-1.5 !text-xs" onClick={() => setShowDeleteModal(false)} type="button">
                Cancel
              </button>
              <button
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
                disabled={deletingTrip || !deleteConfirmText.trim()}
                onClick={async () => {
                  setDeletingTrip(true);
                  try {
                    await apiClient.deleteWaybook(waybookId, { confirmationText: deleteConfirmText });
                    router.replace("/");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Unable to delete trip.");
                  } finally {
                    setDeletingTrip(false);
                  }
                }}
                type="button"
              >
                {deletingTrip ? "Deleting..." : "Delete trip"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

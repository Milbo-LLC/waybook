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

  const [membersData, setMembersData] = useState<ListMembersResponse | null>(null);
  const [destinations, setDestinations] = useState<Awaited<ReturnType<typeof apiClient.listDestinations>>["items"]>([]);
  const [activities, setActivities] = useState<Awaited<ReturnType<typeof apiClient.listActivityCandidates>>["items"]>([]);
  const [bookings, setBookings] = useState<Awaited<ReturnType<typeof apiClient.listBookings>>["items"]>([]);
  const [stays, setStays] = useState<Awaited<ReturnType<typeof apiClient.recommendStays>>["items"]>([]);
  const [itinerary, setItinerary] = useState<Awaited<ReturnType<typeof apiClient.listItineraryEvents>>["items"]>([]);
  const [checklist, setChecklist] = useState<Awaited<ReturnType<typeof apiClient.listChecklistItems>>["items"]>([]);
  const [readiness, setReadiness] = useState<Awaited<ReturnType<typeof apiClient.getReadinessScore>> | null>(null);
  const [tripMessages, setTripMessages] = useState<Awaited<ReturnType<typeof apiClient.listMessages>>["items"]>([]);

  const [destinationName, setDestinationName] = useState("");
  const [destinationRationale, setDestinationRationale] = useState("");
  const [bookingTitle, setBookingTitle] = useState("");
  const [bookingType, setBookingType] = useState<"activity" | "stay" | "transport" | "flight" | "other">("activity");
  const [checklistTitle, setChecklistTitle] = useState("");
  const [messageText, setMessageText] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

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
      messagesResponse
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
      apiClient.listMessages(waybookId, "trip", "trip:main")
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
              <p className="wb-muted mt-1 text-sm">{formatTripDateRange(timeline.waybook.startDate, timeline.waybook.endDate)}</p>
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
          {activeStageMeta?.status === "locked" && activeStageMeta.missingRequirements.length ? (
            <p className="mt-2 text-xs text-amber-700">Locked: {activeStageMeta.missingRequirements.join(" ")}</p>
          ) : null}
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
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

          <aside className="space-y-4">
            <section className="wb-surface p-4">
              <h3 className="wb-title text-base">Members</h3>
              <div className="mt-3 space-y-2">
                {membersData?.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded border p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span>{member.user.name || member.user.email || member.userId}</span>
                      {sessionUser?.id === member.userId ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">You</span>
                      ) : null}
                    </div>
                    <span className="text-xs text-slate-500">{member.role}</span>
                  </div>
                ))}
              </div>
              {canManageMembers ? (
                <div className="mt-3 grid gap-2">
                  <input
                    className="wb-input"
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="friend@example.com"
                    type="email"
                    value={inviteEmail}
                  />
                  <div className="flex gap-2">
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
                  </div>
                  {inviteStatus ? <p className="text-xs text-slate-500">{inviteStatus}</p> : null}
                </div>
              ) : null}
            </section>

            <section className="wb-surface p-4">
              <h3 className="wb-title text-base">Trip channel</h3>
              <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {tripMessages.map((message) => (
                  <div key={message.id} className="rounded bg-slate-50 p-2 text-sm">
                    <p>{message.body}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{new Date(message.createdAt).toLocaleString()}</p>
                  </div>
                ))}
                {!tripMessages.length ? <p className="text-xs text-slate-500">No messages yet.</p> : null}
              </div>
              <div className="mt-2 flex gap-2">
                <input className="wb-input" onChange={(e) => setMessageText(e.target.value)} placeholder="Message the trip..." value={messageText} />
                <button
                  className="wb-btn-secondary !px-3 !py-1.5 !text-xs"
                  onClick={async () => {
                    if (!messageText.trim()) return;
                    await apiClient.createMessage(waybookId, {
                      scope: "trip",
                      threadKey: "trip:main",
                      body: messageText.trim()
                    });
                    setMessageText("");
                    await loadAll();
                  }}
                  type="button"
                >
                  Send
                </button>
              </div>
            </section>
          </aside>
        </div>
      </PageShell>
    </>
  );
}

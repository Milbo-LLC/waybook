"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { ListMembersResponse } from "@waybook/contracts";
import { PageShell } from "@/components/page-shell";
import { EntryList } from "@/features/entries/entry-list";
import { apiClient } from "@/lib/api";
import { getSession, signOut, type SessionUser } from "@/lib/auth";

type TabKey = "plan" | "itinerary" | "bookings" | "expenses" | "capture" | "reflect" | "timeline" | "members" | "settings";

const normalizeWhitespace = (text: string) => text.replace(/\s+/g, " ").trim();

const formatDictationText = (raw: string, previousText: string) => {
  const text = normalizeWhitespace(raw);
  if (!text) return "";

  const previous = previousText.trim();
  const shouldCapitalize = previous.length === 0 || /[.!?]\s*$/.test(previous);
  const withCapital = shouldCapitalize ? text.charAt(0).toUpperCase() + text.slice(1) : text;
  return /[.!?]$/.test(withCapital) ? withCapital : `${withCapital}.`;
};

export default function WaybookDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const waybookId = useMemo(() => params.id, [params.id]);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [timeline, setTimeline] = useState<Awaited<ReturnType<typeof apiClient.getTimeline>> | null>(null);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof apiClient.listEntries>>["items"]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("plan");

  const [savingQuickEntry, setSavingQuickEntry] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDictating, setIsDictating] = useState(false);
  const [captureHtml, setCaptureHtml] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [dictationHint, setDictationHint] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  const [summaryText, setSummaryText] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);

  const [settingsDraft, setSettingsDraft] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    visibility: "private" as "private" | "link_only" | "public"
  });
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [membersData, setMembersData] = useState<ListMembersResponse | null>(null);
  const [planningItems, setPlanningItems] = useState<Awaited<ReturnType<typeof apiClient.listPlanningItems>>["items"]>([]);
  const [tripTasks, setTripTasks] = useState<Awaited<ReturnType<typeof apiClient.listTasks>>["items"]>([]);
  const [bookingRecords, setBookingRecords] = useState<Awaited<ReturnType<typeof apiClient.listBookings>>["items"]>([]);
  const [expenseEntries, setExpenseEntries] = useState<Awaited<ReturnType<typeof apiClient.listExpenses>>["items"]>([]);
  const [itineraryEvents, setItineraryEvents] = useState<Awaited<ReturnType<typeof apiClient.listItineraryEvents>>["items"]>([]);
  const [settlementSummary, setSettlementSummary] = useState<Awaited<ReturnType<typeof apiClient.getSettlementSummary>> | null>(null);

  const [planTitle, setPlanTitle] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [bookingTitle, setBookingTitle] = useState("");
  const [bookingType, setBookingType] = useState<"activity" | "stay" | "transport" | "flight" | "other">("activity");
  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCurrency, setExpenseCurrency] = useState("USD");
  const [itineraryTitle, setItineraryTitle] = useState("");
  const [itineraryStart, setItineraryStart] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [memberActionId, setMemberActionId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const keepListeningRef = useRef(false);

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: "Write your memory here..." })],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-slate prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-slate-500 min-h-[170px] max-w-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
      }
    },
    onUpdate({ editor }) {
      setCaptureHtml(editor.getHTML());
    }
  });

  const loadWaybook = async () => {
    if (!waybookId) return;
    const [
      timelineResponse,
      entriesResponse,
      membersResponse,
      planningResponse,
      tasksResponse,
      bookingsResponse,
      expensesResponse,
      itineraryResponse,
      settlementsResponse
    ] = await Promise.all([
      apiClient.getTimeline(waybookId),
      apiClient.listEntries(waybookId),
      apiClient.listWaybookMembers(waybookId),
      apiClient.listPlanningItems(waybookId),
      apiClient.listTasks(waybookId),
      apiClient.listBookings(waybookId),
      apiClient.listExpenses(waybookId),
      apiClient.listItineraryEvents(waybookId),
      apiClient.getSettlementSummary(waybookId)
    ]);
    setTimeline(timelineResponse);
    setEntries(entriesResponse.items);
    setMembersData(membersResponse);
    setPlanningItems(planningResponse.items);
    setTripTasks(tasksResponse.items);
    setBookingRecords(bookingsResponse.items);
    setExpenseEntries(expensesResponse.items);
    setItineraryEvents(itineraryResponse.items);
    setSettlementSummary(settlementsResponse);
    setSettingsDraft({
      title: timelineResponse.waybook.title,
      description: timelineResponse.waybook.description ?? "",
      startDate: timelineResponse.waybook.startDate,
      endDate: timelineResponse.waybook.endDate,
      visibility: timelineResponse.waybook.visibility
    });
  };

  useEffect(() => {
    if (!waybookId) return;

    const run = async () => {
      setLoading(true);
      setError(null);
      setTimeline(null);
      setEntries([]);

      const session = await getSession();
      if (!session) {
        router.replace("/login" as any);
        return;
      }
      setSessionUser(session);

      try {
        await loadWaybook();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load waybook";
        if (message.includes("API 401")) {
          router.replace("/login" as any);
          return;
        }
        if (message.includes("API 404")) {
          router.replace("/");
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

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(
    () => () => {
      keepListeningRef.current = false;
      if (recognitionRef.current) recognitionRef.current.stop();
    },
    []
  );

  const todayDate = new Date().toISOString().slice(0, 10);
  const todaySummary = timeline?.days.find((day) => day.date === todayDate)?.summary ?? null;
  const captureText = editor?.getText().trim() ?? "";
  const canSaveCapture = Boolean(captureText) || selectedFiles.length > 0;
  const accessRole = timeline?.accessRole ?? "viewer";
  const canEditTripContent = accessRole === "owner" || accessRole === "editor";
  const canManageTrip = accessRole === "owner";

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
    if (!uploadResponse.ok) {
      throw new Error(`Upload failed for ${file.name}: ${uploadResponse.status}`);
    }

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
      setDictationHint("Speech-to-text is not supported in this mobile browser. Use your keyboard mic.");
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

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        keepListeningRef.current = false;
        setIsDictating(false);
        setDictationHint("Mic permission denied. Enable microphone access in browser settings.");
        return;
      }
      setDictationHint(event.error === "no-speech" ? "No speech detected. Keep talking..." : `Speech error: ${event.error}`);
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
          // If restart fails, onend will fire again and retry.
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

  const toggleDictation = () => {
    if (isDictating) stopDictation();
    else startDictation();
  };

  const saveTripSettings = async () => {
    if (!waybookId || !timeline) return;
    setSettingsError(null);
    setSettingsStatus(null);

    if (settingsDraft.endDate < settingsDraft.startDate) {
      setSettingsError("End date must be on or after start date.");
      return;
    }

    const previous = timeline.waybook;
    const optimistic = {
      ...previous,
      title: settingsDraft.title.trim() || previous.title,
      description: settingsDraft.description.trim() || null,
      startDate: settingsDraft.startDate,
      endDate: settingsDraft.endDate,
      visibility: settingsDraft.visibility
    };

    setSavingSettings(true);
    setTimeline((current) => (current ? { ...current, waybook: optimistic } : current));
    setSettingsStatus("Saving...");

    try {
      const updated = await apiClient.updateWaybook(waybookId, {
        title: optimistic.title,
        description: optimistic.description,
        startDate: optimistic.startDate,
        endDate: optimistic.endDate,
        visibility: optimistic.visibility
      });
      setTimeline((current) => (current ? { ...current, waybook: updated } : current));
      setSettingsStatus("Saved");
    } catch (err) {
      setTimeline((current) => (current ? { ...current, waybook: previous } : current));
      setSettingsStatus(null);
      setSettingsError(err instanceof Error ? err.message : "Unable to update trip settings.");
    } finally {
      setSavingSettings(false);
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
      <header className="fixed inset-x-0 top-0 z-[120] border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <button className="wb-title text-lg" onClick={() => router.push("/")} type="button">
            Waybook
          </button>
          <div className="relative" ref={profileMenuRef}>
            <button
              aria-label="Open profile menu"
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200"
              onClick={() => setProfileOpen((open) => !open)}
              type="button"
            >
              {sessionUser?.image ? (
                <img
                  alt={sessionUser.name ? `${sessionUser.name} avatar` : "Profile avatar"}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                  src={sessionUser.image}
                />
              ) : (
                <span className="text-xs font-semibold text-slate-700">
                  {sessionUser?.name?.trim()?.charAt(0).toUpperCase() || sessionUser?.email?.charAt(0).toUpperCase() || "?"}
                </span>
              )}
            </button>
            {profileOpen ? (
              <div className="absolute right-0 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  className="w-full rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  onClick={async () => {
                    await signOut();
                    router.push("/login" as any);
                  }}
                  type="button"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <PageShell className="overflow-x-hidden pb-8 pt-20">
      <section className="wb-surface sticky top-16 z-[70] px-4 py-3">
        <div className="flex items-start gap-2">
          <button
            aria-label="Back to trips"
            className="mt-0.5 text-xl leading-none text-slate-700 transition hover:text-slate-900"
            onClick={() => router.push("/")}
            type="button"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="wb-title truncate text-xl leading-tight">{timeline?.waybook.title ?? "Waybook"}</h1>
            <p className="wb-muted text-xs">
              {timeline.waybook.startDate} to {timeline.waybook.endDate}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {(["plan", "itinerary", "bookings", "expenses", "capture", "reflect", "timeline", "members", "settings"] as TabKey[]).map((tab) => (
            <button
              key={tab}
              className={`wb-pill capitalize ${
                activeTab === tab ? "wb-pill-active" : ""
              }`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {activeTab === "plan" ? (
        <section className="wb-surface p-5">
          <h2 className="wb-title text-lg">Plan</h2>
          <p className="wb-muted mt-1 text-sm">Capture ideas, vote, and assign prep tasks.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className="wb-input"
              onChange={(event) => setPlanTitle(event.target.value)}
              placeholder="Add a planning idea (e.g., Zipline in Monteverde)"
              value={planTitle}
            />
            <button
              className="wb-btn-primary disabled:opacity-60"
              disabled={!canEditTripContent}
              onClick={async () => {
                if (!planTitle.trim()) return;
                await apiClient.createPlanningItem(waybookId, { title: planTitle.trim(), location: null });
                setPlanTitle("");
                await loadWaybook();
              }}
              type="button"
            >
              Add idea
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {planningItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-slate-500 capitalize">{item.status.replace("_", " ")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="rounded border px-2 py-1 text-xs"
                      onClick={async () => {
                        await apiClient.createPlanningVote(item.id, { vote: "up" });
                        await loadWaybook();
                      }}
                      type="button"
                    >
                      👍 {item.votesUp}
                    </button>
                    <button
                      className="rounded border px-2 py-1 text-xs"
                      onClick={async () => {
                        await apiClient.createPlanningVote(item.id, { vote: "down" });
                        await loadWaybook();
                      }}
                      type="button"
                    >
                      👎 {item.votesDown}
                    </button>
                    {canEditTripContent ? (
                      <select
                        className="rounded border px-2 py-1 text-xs"
                        onChange={async (event) => {
                          await apiClient.updatePlanningItem(item.id, { status: event.target.value as any });
                          await loadWaybook();
                        }}
                        value={item.status}
                      >
                        <option value="idea">idea</option>
                        <option value="shortlisted">shortlisted</option>
                        <option value="planned">planned</option>
                        <option value="booked">booked</option>
                        <option value="done">done</option>
                        <option value="skipped">skipped</option>
                      </select>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {!planningItems.length ? <p className="text-sm text-slate-500">No plan items yet.</p> : null}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold">Trip tasks</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_200px_auto]">
              <input
                className="wb-input"
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Task title"
                value={taskTitle}
              />
              <input
                className="rounded-lg border border-slate-200 p-2 text-sm"
                onChange={(event) => setTaskDueAt(event.target.value)}
                type="datetime-local"
                value={taskDueAt}
              />
              <button
                className="wb-btn-primary disabled:opacity-60"
                disabled={!canEditTripContent}
                onClick={async () => {
                  if (!taskTitle.trim()) return;
                  await apiClient.createTask(waybookId, {
                    title: taskTitle.trim(),
                    dueAt: taskDueAt ? new Date(taskDueAt).toISOString() : null
                  });
                  setTaskTitle("");
                  setTaskDueAt("");
                  await loadWaybook();
                }}
                type="button"
              >
                Add task
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {tripTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded border border-slate-200 p-2 text-sm">
                  <div>
                    <p>{task.title}</p>
                    <p className="text-xs text-slate-500">
                      {task.dueAt ? new Date(task.dueAt).toLocaleString() : "No due date"}
                    </p>
                  </div>
                  {canEditTripContent ? (
                    <select
                      className="rounded border px-2 py-1 text-xs"
                      onChange={async (event) => {
                        await apiClient.updateTask(task.id, { status: event.target.value as any });
                        await loadWaybook();
                      }}
                      value={task.status}
                    >
                      <option value="todo">todo</option>
                      <option value="in_progress">in progress</option>
                      <option value="done">done</option>
                    </select>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "itinerary" ? (
        <section className="wb-surface p-5">
          <h2 className="wb-title text-lg">Itinerary</h2>
          <p className="wb-muted mt-1 text-sm">Schedule what the trip will actually look like day-to-day.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px_auto]">
            <input
              className="wb-input"
              onChange={(event) => setItineraryTitle(event.target.value)}
              placeholder="Event title"
              value={itineraryTitle}
            />
            <input
              className="rounded-lg border border-slate-200 p-2 text-sm"
              onChange={(event) => setItineraryStart(event.target.value)}
              type="datetime-local"
              value={itineraryStart}
            />
            <button
              className="wb-btn-primary disabled:opacity-60"
              disabled={!canEditTripContent}
              onClick={async () => {
                if (!itineraryTitle.trim() || !itineraryStart) return;
                await apiClient.createItineraryEvent(waybookId, {
                  title: itineraryTitle.trim(),
                  startTime: new Date(itineraryStart).toISOString()
                });
                setItineraryTitle("");
                setItineraryStart("");
                await loadWaybook();
              }}
              type="button"
            >
              Add event
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {itineraryEvents.map((event) => (
              <div key={event.id} className="rounded border border-slate-200 p-3 text-sm">
                <p className="font-medium">{event.title}</p>
                <p className="text-xs text-slate-500">{new Date(event.startTime).toLocaleString()}</p>
              </div>
            ))}
            {!itineraryEvents.length ? <p className="text-sm text-slate-500">No itinerary events yet.</p> : null}
          </div>
        </section>
      ) : null}

      {activeTab === "bookings" ? (
        <section className="wb-surface p-5">
          <h2 className="wb-title text-lg">Bookings</h2>
          <p className="wb-muted mt-1 text-sm">Track provider checkouts and confirmations in one place.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]">
            <input
              className="wb-input"
              onChange={(event) => setBookingTitle(event.target.value)}
              placeholder="Booking title"
              value={bookingTitle}
            />
            <select
              className="rounded-lg border border-slate-200 p-2 text-sm"
              onChange={(event) => setBookingType(event.target.value as any)}
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
              disabled={!canEditTripContent}
              onClick={async () => {
                if (!bookingTitle.trim()) return;
                await apiClient.createBooking(waybookId, {
                  title: bookingTitle.trim(),
                  type: bookingType
                });
                setBookingTitle("");
                await loadWaybook();
              }}
              type="button"
            >
              Add booking
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {bookingRecords.map((booking) => (
              <div key={booking.id} className="flex items-center justify-between rounded border border-slate-200 p-3 text-sm">
                <div>
                  <p className="font-medium">{booking.title}</p>
                  <p className="text-xs text-slate-500">
                    {booking.type} • {booking.bookingStatus}
                  </p>
                </div>
                {canEditTripContent ? (
                  <select
                    className="rounded border px-2 py-1 text-xs"
                    onChange={async (event) => {
                      await apiClient.updateBooking(booking.id, { bookingStatus: event.target.value as any });
                      await loadWaybook();
                    }}
                    value={booking.bookingStatus}
                  >
                    <option value="draft">draft</option>
                    <option value="pending_checkout">pending_checkout</option>
                    <option value="confirmed">confirmed</option>
                    <option value="cancelled">cancelled</option>
                    <option value="failed">failed</option>
                    <option value="refunded">refunded</option>
                  </select>
                ) : null}
              </div>
            ))}
            {!bookingRecords.length ? <p className="text-sm text-slate-500">No bookings yet.</p> : null}
          </div>
        </section>
      ) : null}

      {activeTab === "expenses" ? (
        <section className="wb-surface p-5">
          <h2 className="wb-title text-lg">Expenses</h2>
          <p className="wb-muted mt-1 text-sm">Track spend and see who should settle with whom.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_120px_auto]">
            <input
              className="wb-input"
              onChange={(event) => setExpenseTitle(event.target.value)}
              placeholder="Expense title"
              value={expenseTitle}
            />
            <input
              className="rounded-lg border border-slate-200 p-2 text-sm"
              onChange={(event) => setExpenseAmount(event.target.value)}
              placeholder="Amount"
              type="number"
              value={expenseAmount}
            />
            <input
              className="rounded-lg border border-slate-200 p-2 text-sm"
              onChange={(event) => setExpenseCurrency(event.target.value.toUpperCase())}
              placeholder="USD"
              value={expenseCurrency}
            />
            <button
              className="wb-btn-primary disabled:opacity-60"
              disabled={!canEditTripContent}
              onClick={async () => {
                const amount = Number(expenseAmount);
                if (!expenseTitle.trim() || Number.isNaN(amount) || amount <= 0 || !sessionUser) return;
                const minor = Math.round(amount * 100);
                await apiClient.createExpense(waybookId, {
                  title: expenseTitle.trim(),
                  paidByUserId: sessionUser.id,
                  currency: expenseCurrency || "USD",
                  amountMinor: minor,
                  tripBaseCurrency: expenseCurrency || "USD",
                  tripBaseAmountMinor: minor,
                  incurredAt: new Date().toISOString(),
                  splits: []
                });
                setExpenseTitle("");
                setExpenseAmount("");
                await loadWaybook();
              }}
              type="button"
            >
              Add expense
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {expenseEntries.map((expense) => (
              <div key={expense.id} className="rounded border border-slate-200 p-3 text-sm">
                <p className="font-medium">{expense.title}</p>
                <p className="text-xs text-slate-500">
                  {(expense.amountMinor / 100).toFixed(2)} {expense.currency} • paid by {expense.paidByUserId.slice(0, 8)}
                </p>
              </div>
            ))}
            {!expenseEntries.length ? <p className="text-sm text-slate-500">No expenses yet.</p> : null}
          </div>

          {settlementSummary?.items.length ? (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="text-sm font-semibold">Settlement suggestions</h3>
              <div className="mt-2 space-y-2">
                {settlementSummary.items.map((item, index) => (
                  <p key={`${item.fromUserId}-${item.toUserId}-${index}`} className="text-sm text-slate-700">
                    {item.fromUserId.slice(0, 8)} pays {item.toUserId.slice(0, 8)} {(item.amountMinor / 100).toFixed(2)} {item.currency}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "capture" ? (
        <section className="wb-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
                <h2 className="wb-title text-lg">Capture</h2>
                <p className="wb-muted mt-1 text-sm">Write naturally. Add media. Save once.</p>
            </div>
            <button
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                isDictating ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
              }`}
              onClick={toggleDictation}
              type="button"
            >
              {isDictating ? "Stop Listening" : "Speak to Write"}
            </button>
          </div>

          <div className="mt-4">
            <EditorContent editor={editor} />
            {isDictating ? (
              <p className="mt-2 text-xs text-slate-500">Listening... {liveTranscript ? `"${liveTranscript}"` : "start talking"}</p>
            ) : null}
            {!speechSupported ? (
              <p className="mt-2 text-xs text-amber-700">Speech-to-text is limited on mobile browsers.</p>
            ) : null}
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
            {selectedFiles.length ? (
              <p className="mt-1 text-xs text-slate-500">
                {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} selected
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex gap-2">
            <button
                className="wb-btn-primary disabled:opacity-60"
              disabled={savingQuickEntry || !canSaveCapture || !canEditTripContent}
              onClick={async () => {
                if (!waybookId) return;
                setSavingQuickEntry(true);
                setCaptureStatus("Creating entry...");
                setError(null);
                try {
                  const entry = await apiClient.createEntry(waybookId, {
                    capturedAt: new Date().toISOString(),
                    textContent: captureText ? captureHtml : null,
                    location: null,
                    idempotencyKey: crypto.randomUUID()
                  });

                  if (selectedFiles.length) {
                    setCaptureStatus(`Uploading ${selectedFiles.length} file(s)...`);
                    for (const file of selectedFiles) await uploadFileToEntry(entry.id, file);
                  }

                  setCaptureHtml("");
                  editor?.commands.clearContent();
                  setSelectedFiles([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                  setCaptureStatus("Saved");
                  await loadWaybook();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to save entry");
                  setCaptureStatus(null);
                } finally {
                  setSavingQuickEntry(false);
                }
              }}
              type="button"
            >
              {!canEditTripContent ? "Read only" : savingQuickEntry ? "Saving..." : "Save post"}
            </button>
          </div>
          {captureStatus ? <p className="mt-2 text-xs text-slate-500">{captureStatus}</p> : null}
        </section>
      ) : null}

      {activeTab === "reflect" ? (
        <section className="wb-surface p-4">
          <h2 className="wb-title text-lg">Daily reflection</h2>
          <p className="wb-muted mt-1 text-sm">Top memory and quick reflection for today.</p>
          <textarea
            className="mt-3 w-full rounded border p-2 text-sm"
            onChange={(event) => setSummaryText(event.target.value)}
            placeholder={todaySummary?.summaryText ?? "What stood out today?"}
            rows={3}
            value={summaryText}
          />
          <div className="mt-3 flex gap-2">
            <button
              className="wb-btn-primary disabled:opacity-60"
              disabled={savingSummary || !canEditTripContent}
              onClick={async () => {
                if (!waybookId) return;
                setSavingSummary(true);
                setError(null);
                try {
                  await apiClient.createDaySummary(waybookId, {
                    summaryDate: todayDate,
                    summaryText: summaryText.trim() || todaySummary?.summaryText || null,
                    topMomentEntryId: entries[0]?.id ?? null,
                    moodScore: 4,
                    energyScore: 4
                  });
                  setSummaryText("");
                  await loadWaybook();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Unable to save daily reflection");
                } finally {
                  setSavingSummary(false);
                }
              }}
              type="button"
            >
              {!canEditTripContent ? "Read only" : savingSummary ? "Saving..." : "Save reflection"}
            </button>
          </div>
        </section>
      ) : null}

      {activeTab === "timeline" ? (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Timeline</h2>
          <EntryList entries={entries} onRefresh={loadWaybook} />
        </section>
      ) : null}

      {activeTab === "members" ? (
        <section className="wb-surface p-4">
          <h2 className="wb-title text-lg">Members</h2>
          <p className="wb-muted mt-1 text-sm">Invite people by email so they can post to this trip.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px_auto]">
            <input
              className="w-full rounded border p-2 text-sm"
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="friend@example.com"
              type="email"
              value={inviteEmail}
            />
            <select
              className="rounded border p-2 text-sm"
              onChange={(event) => setInviteRole(event.target.value as "editor" | "viewer")}
              value={inviteRole}
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              className="wb-btn-primary disabled:opacity-60"
              disabled={!canManageTrip}
              onClick={async () => {
                if (!canManageTrip) {
                  setInviteStatus("Only trip owners can invite members.");
                  return;
                }
                if (!inviteEmail.trim()) {
                  setInviteStatus("Enter an email to invite.");
                  return;
                }
                setInviteStatus("Sending invite...");
                try {
                  await apiClient.createWaybookInvite(waybookId, {
                    email: inviteEmail.trim(),
                    role: inviteRole
                  });
                  setInviteEmail("");
                  setInviteRole("editor");
                  setInviteStatus("Invite created.");
                  await loadWaybook();
                } catch (err) {
                  setInviteStatus(err instanceof Error ? err.message : "Unable to create invite.");
                }
              }}
              type="button"
            >
              Add member
            </button>
          </div>
          {inviteStatus ? <p className="mt-2 text-xs text-slate-500">{inviteStatus}</p> : null}
          {membersData?.members.length ? (
            <div className="mt-4 space-y-2">
              {membersData.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span>{member.user.name || member.user.email || member.userId}</span>
                    {sessionUser?.id === member.userId ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">You</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageTrip && member.role !== "owner" ? (
                      <select
                        className="rounded border px-2 py-1 text-xs"
                        disabled={memberActionId === member.id}
                        onChange={async (event) => {
                          const role = event.target.value as "editor" | "viewer";
                          setMemberActionId(member.id);
                          setInviteStatus("Updating role...");
                          try {
                            await apiClient.updateWaybookMemberRole(waybookId, member.id, { role });
                            await loadWaybook();
                            setInviteStatus("Role updated.");
                          } catch (err) {
                            setInviteStatus(err instanceof Error ? err.message : "Unable to update role.");
                          } finally {
                            setMemberActionId(null);
                          }
                        }}
                        value={member.role}
                      >
                        <option value="editor">editor</option>
                        <option value="viewer">viewer</option>
                      </select>
                    ) : (
                      <span className="text-xs text-slate-500">{member.role}</span>
                    )}
                    {canManageTrip && member.role !== "owner" ? (
                      <button
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                        disabled={memberActionId === member.id}
                        onClick={async () => {
                          setMemberActionId(member.id);
                          setInviteStatus("Removing member...");
                          try {
                            await apiClient.removeWaybookMember(waybookId, member.id);
                            await loadWaybook();
                            setInviteStatus("Member removed.");
                          } catch (err) {
                            setInviteStatus(err instanceof Error ? err.message : "Unable to remove member.");
                          } finally {
                            setMemberActionId(null);
                          }
                        }}
                        type="button"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {membersData?.invites.length ? (
            <div className="mt-4 space-y-2">
              {membersData.invites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between rounded border border-dashed p-2 text-sm">
                  <span>{invite.email}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                      invited as {invite.role}
                      {invite.expiresAt ? `, expires ${new Date(invite.expiresAt).toLocaleDateString()}` : ""}
                    </span>
                    {canManageTrip ? (
                      <>
                        <button
                          className="rounded border px-2 py-1 text-xs"
                          disabled={memberActionId === invite.id}
                          onClick={async () => {
                            setMemberActionId(invite.id);
                            setInviteStatus("Resending invite...");
                            try {
                              await apiClient.resendWaybookInvite(waybookId, invite.id);
                              await loadWaybook();
                              setInviteStatus("Invite resent.");
                            } catch (err) {
                              setInviteStatus(err instanceof Error ? err.message : "Unable to resend invite.");
                            } finally {
                              setMemberActionId(null);
                            }
                          }}
                          type="button"
                        >
                          Resend
                        </button>
                        <button
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                          disabled={memberActionId === invite.id}
                          onClick={async () => {
                            setMemberActionId(invite.id);
                            setInviteStatus("Revoking invite...");
                            try {
                              await apiClient.revokeWaybookInvite(waybookId, invite.id);
                              await loadWaybook();
                              setInviteStatus("Invite revoked.");
                            } catch (err) {
                              setInviteStatus(err instanceof Error ? err.message : "Unable to revoke invite.");
                            } finally {
                              setMemberActionId(null);
                            }
                          }}
                          type="button"
                        >
                          Revoke
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {activeTab === "settings" ? (
        <section className="space-y-4">
          <div className="wb-surface p-4">
            <h2 className="wb-title text-lg">Trip Settings</h2>
            <p className="wb-muted mt-1 text-sm">Edit trip details and visibility.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Title</span>
                <input
                  className="w-full rounded border p-2"
                  onChange={(event) => setSettingsDraft((prev) => ({ ...prev, title: event.target.value }))}
                  value={settingsDraft.title}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Visibility</span>
                <select
                  className="w-full rounded border p-2"
                  onChange={(event) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      visibility: event.target.value as "private" | "link_only" | "public"
                    }))
                  }
                  value={settingsDraft.visibility}
                >
                  <option value="private">private</option>
                  <option value="link_only">link only</option>
                  <option value="public">public</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Start date</span>
                <input
                  className="w-full rounded border p-2"
                  onChange={(event) => setSettingsDraft((prev) => ({ ...prev, startDate: event.target.value }))}
                  type="date"
                  value={settingsDraft.startDate}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">End date</span>
                <input
                  className="w-full rounded border p-2"
                  onChange={(event) => setSettingsDraft((prev) => ({ ...prev, endDate: event.target.value }))}
                  type="date"
                  value={settingsDraft.endDate}
                />
              </label>
            </div>
            <label className="mt-3 block text-sm">
              <span className="mb-1 block text-slate-600">Description</span>
              <textarea
                className="w-full rounded border p-2"
                onChange={(event) => setSettingsDraft((prev) => ({ ...prev, description: event.target.value }))}
                rows={4}
                value={settingsDraft.description}
              />
            </label>
            <div className="mt-3 flex items-center gap-3">
              <button
                className="wb-btn-primary disabled:opacity-60"
                disabled={savingSettings || !canManageTrip}
                onClick={() => void saveTripSettings()}
                type="button"
              >
                {!canManageTrip ? "Owner only" : savingSettings ? "Saving..." : "Save settings"}
              </button>
              {settingsStatus ? <span className="text-xs text-slate-500">{settingsStatus}</span> : null}
            </div>
            {settingsError ? <p className="mt-2 text-xs text-red-600">{settingsError}</p> : null}
          </div>
        </section>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-2 sm:hidden">
        <div className="grid grid-cols-4 gap-2">
          <button className="rounded border px-2 py-2 text-xs" onClick={() => router.push("/")} type="button">
            Back
          </button>
          <button
            className={`rounded px-2 py-2 text-xs ${activeTab === "capture" ? "bg-brand-700 text-white" : "border"}`}
            onClick={() => setActiveTab("capture")}
            type="button"
          >
            Add
          </button>
          <button
            className={`rounded px-2 py-2 text-xs ${activeTab === "timeline" ? "bg-brand-700 text-white" : "border"}`}
            onClick={() => setActiveTab("timeline")}
            type="button"
          >
            Timeline
          </button>
          <button
            className={`rounded px-2 py-2 text-xs ${activeTab === "settings" ? "bg-brand-700 text-white" : "border"}`}
            onClick={() => setActiveTab("settings")}
            type="button"
          >
            Settings
          </button>
        </div>
      </nav>
      <div className="h-16 sm:hidden" />
    </PageShell>
    </>
  );
}

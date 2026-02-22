"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { PageShell } from "@/components/page-shell";
import { EntryList } from "@/features/entries/entry-list";
import { ShareLinkCard } from "@/features/share/share-link-card";
import { apiClient } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";

type TabKey = "capture" | "timeline" | "members" | "settings";

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
  const shareSectionRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Awaited<ReturnType<typeof apiClient.getTimeline>> | null>(null);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof apiClient.listEntries>>["items"]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("capture");

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
    const [timelineResponse, entriesResponse] = await Promise.all([
      apiClient.getTimeline(waybookId),
      apiClient.listEntries(waybookId)
    ]);
    setTimeline(timelineResponse);
    setEntries(entriesResponse.items);
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
      const session = await getSession();
      if (!session) {
        router.replace("/login" as any);
        return;
      }

      try {
        await loadWaybook();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load waybook");
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

  const todayDate = new Date().toISOString().slice(0, 10);
  const todaySummary = timeline?.days.find((day) => day.date === todayDate)?.summary ?? null;
  const captureText = editor?.getText().trim() ?? "";
  const canSaveCapture = Boolean(captureText) || selectedFiles.length > 0;

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

  return (
    <PageShell>
      <header className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <button className="text-xs text-slate-500 hover:text-slate-700" onClick={() => router.push("/")} type="button">
              Trips / {timeline?.waybook.title ?? "Trip"}
            </button>
            <h1 className="truncate text-xl font-semibold">{timeline?.waybook.title ?? "Waybook"}</h1>
            {timeline ? (
              <p className="text-xs text-slate-500">
                {timeline.waybook.startDate} to {timeline.waybook.endDate}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
              onClick={() => {
                setActiveTab("settings");
                setTimeout(() => shareSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }}
              type="button"
            >
              Share
            </button>
            <button
              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700"
              onClick={() => setActiveTab("settings")}
              type="button"
            >
              Settings
            </button>
            <LogoutButton />
          </div>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {(["capture", "timeline", "members", "settings"] as TabKey[]).map((tab) => (
            <button
              key={tab}
              className={`rounded-full px-3 py-1 text-xs capitalize ${
                activeTab === tab ? "bg-brand-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"
              }`}
              onClick={() => setActiveTab(tab)}
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {activeTab === "capture" ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Capture</h2>
                <p className="mt-1 text-sm text-slate-600">Write naturally. Add media. Save once.</p>
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
                className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={savingQuickEntry || !canSaveCapture}
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
                {savingQuickEntry ? "Saving..." : "Save post"}
              </button>
            </div>
            {captureStatus ? <p className="mt-2 text-xs text-slate-500">{captureStatus}</p> : null}
          </section>

          <section className="rounded-xl border bg-white p-4">
            <h2 className="text-lg font-semibold">Daily reflection</h2>
            <p className="mt-1 text-sm text-slate-600">Top memory and quick reflection for today.</p>
            <textarea
              className="mt-3 w-full rounded border p-2 text-sm"
              onChange={(event) => setSummaryText(event.target.value)}
              placeholder={todaySummary?.summaryText ?? "What stood out today?"}
              rows={3}
              value={summaryText}
            />
            <div className="mt-3 flex gap-2">
              <button
                className="rounded bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={savingSummary}
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
                {savingSummary ? "Saving..." : "Save reflection"}
              </button>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "timeline" ? (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Timeline</h2>
          <EntryList entries={entries} onRefresh={loadWaybook} />
        </section>
      ) : null}

      {activeTab === "members" ? (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold">Members</h2>
          <p className="mt-1 text-sm text-slate-600">
            Member invites are next. This tab will support owner/editor/viewer roles and invite links.
          </p>
        </section>
      ) : null}

      {activeTab === "settings" ? (
        <section className="space-y-4">
          <div ref={shareSectionRef}>
            {waybookId ? <ShareLinkCard waybookId={waybookId} /> : null}
          </div>
          <div className="rounded-xl border bg-white p-4">
            <h2 className="text-lg font-semibold">Trip Settings</h2>
            <p className="mt-1 text-sm text-slate-600">Edit trip details and visibility.</p>
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
                className="rounded bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={savingSettings}
                onClick={() => void saveTripSettings()}
                type="button"
              >
                {savingSettings ? "Saving..." : "Save settings"}
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
  );
}

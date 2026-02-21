"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { EntryList } from "@/features/entries/entry-list";
import { ShareLinkCard } from "@/features/share/share-link-card";
import { apiClient } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";

export default function WaybookDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const waybookId = useMemo(() => params.id, [params.id]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Awaited<ReturnType<typeof apiClient.getTimeline>> | null>(null);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof apiClient.listEntries>>["items"]>([]);
  const [savingQuickEntry, setSavingQuickEntry] = useState(false);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDictating, setIsDictating] = useState(false);
  const [captureHtml, setCaptureHtml] = useState("");
  const [summaryText, setSummaryText] = useState("");
  const [savingSummary, setSavingSummary] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const loadWaybook = async () => {
    if (!waybookId) return;
    const [timelineResponse, entriesResponse] = await Promise.all([
      apiClient.getTimeline(waybookId),
      apiClient.listEntries(waybookId)
    ]);
    setTimeline(timelineResponse);
    setEntries(entriesResponse.items);
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

  useEffect(
    () => () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    },
    []
  );

  const todayDate = new Date().toISOString().slice(0, 10);
  const todaySummary = timeline?.days.find((day) => day.date === todayDate)?.summary ?? null;
  const captureText = captureHtml.replace(/<[^>]+>/g, " ").trim();
  const hasCaptureText = Boolean(captureText);
  const canSaveCapture = hasCaptureText || selectedFiles.length > 0;

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

  const toggleDictation = () => {
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
        : null;

    if (!SpeechRecognitionCtor) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    if (isDictating && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsDictating(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      if (transcript) {
        if (editorRef.current) {
          editorRef.current.focus();
        }
        document.execCommand("insertText", false, `${transcript} `);
        setCaptureHtml(editorRef.current?.innerHTML ?? "");
      }
    };

    recognition.onerror = () => {
      setIsDictating(false);
    };
    recognition.onend = () => {
      setIsDictating(false);
    };

    recognitionRef.current = recognition;
    setIsDictating(true);
    recognition.start();
  };

  return (
    <PageShell>
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{timeline?.waybook.title ?? "Waybook"}</h1>
          {timeline ? (
            <p className="text-sm text-slate-600">
              {timeline.waybook.startDate} to {timeline.waybook.endDate}
            </p>
          ) : null}
        </div>
        <LogoutButton />
      </header>

      {loading ? <p className="text-sm text-slate-500">Loading...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {waybookId ? <ShareLinkCard waybookId={waybookId} /> : null}
      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold">Quick capture</h2>
        <p className="mt-1 text-sm text-slate-600">Write, speak, and attach media in one post flow.</p>
        <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2">
          <div className="mb-2 flex flex-wrap gap-2">
            <button
              className="rounded border bg-white px-2 py-1 text-xs"
              onClick={() => {
                editorRef.current?.focus();
                document.execCommand("bold");
                setCaptureHtml(editorRef.current?.innerHTML ?? "");
              }}
              type="button"
            >
              Bold
            </button>
            <button
              className="rounded border bg-white px-2 py-1 text-xs"
              onClick={() => {
                editorRef.current?.focus();
                document.execCommand("italic");
                setCaptureHtml(editorRef.current?.innerHTML ?? "");
              }}
              type="button"
            >
              Italic
            </button>
            <button
              className="rounded border bg-white px-2 py-1 text-xs"
              onClick={() => {
                editorRef.current?.focus();
                document.execCommand("insertUnorderedList");
                setCaptureHtml(editorRef.current?.innerHTML ?? "");
              }}
              type="button"
            >
              Bullets
            </button>
            <button
              className="rounded border bg-white px-2 py-1 text-xs"
              onClick={toggleDictation}
              type="button"
            >
              {isDictating ? "Stop speaking" : "Speak to write"}
            </button>
          </div>
          <div
            ref={editorRef}
            className="prose prose-slate min-h-[140px] max-w-none rounded border border-slate-300 bg-white p-3 text-sm focus:outline-none"
            contentEditable
            onInput={(event) => setCaptureHtml(event.currentTarget.innerHTML)}
            suppressContentEditableWarning
          />
        </div>
        <div className="mt-3">
          <label className="text-sm font-medium">Add photos/videos</label>
          <input
            ref={fileInputRef}
            accept="image/*,video/*,audio/*"
            className="mt-2 block w-full text-sm"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setSelectedFiles(files);
            }}
            type="file"
          />
          {selectedFiles.length ? (
            <p className="mt-1 text-xs text-slate-500">
              {selectedFiles.length} file{selectedFiles.length === 1 ? "" : "s"} selected
            </p>
          ) : null}
        </div>
        <div className="mt-3 flex gap-2">
          <button
            className="rounded bg-brand-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
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
                  for (const file of selectedFiles) {
                    await uploadFileToEntry(entry.id, file);
                  }
                }

                setCaptureHtml("");
                if (editorRef.current) {
                  editorRef.current.innerHTML = "";
                }
                setSelectedFiles([]);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
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

      <section>
        <h2 className="mb-3 text-xl font-semibold">Entries</h2>
        <EntryList entries={entries} onRefresh={loadWaybook} />
      </section>
    </PageShell>
  );
}

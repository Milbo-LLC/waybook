"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { EditorContent, type Editor, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { PageShell } from "@/components/page-shell";
import { EntryList } from "@/features/entries/entry-list";
import { ShareLinkCard } from "@/features/share/share-link-card";
import { apiClient } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/logout-button";

const ToolbarButton = ({
  label,
  onClick,
  active = false,
  disabled = false
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) => (
  <button
    className={`rounded px-2 py-1 text-xs transition ${
      active ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
    } disabled:cursor-not-allowed disabled:opacity-50`}
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    {label}
  </button>
);

const setLinkPrompt = (editor: Editor | null) => {
  if (!editor) return;
  const previousUrl = editor.getAttributes("link").href ?? "";
  const url = window.prompt("Enter URL", previousUrl);
  if (url === null) return;
  if (!url) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  editor.chain().focus().setLink({ href: url }).run();
};

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
  const recognitionRef = useRef<any>(null);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "What happened? What made this memorable?" }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        defaultProtocol: "https"
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      Subscript,
      Superscript
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-slate min-h-[140px] max-w-none rounded border border-slate-300 bg-white p-3 text-sm focus:outline-none"
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
  const captureText = editor?.getText().trim() ?? "";
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
        editor?.chain().focus().insertContent(`${transcript} `).run();
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
          <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
            <ToolbarButton disabled={!editor?.can().undo()} label="Undo" onClick={() => editor?.chain().focus().undo().run()} />
            <ToolbarButton disabled={!editor?.can().redo()} label="Redo" onClick={() => editor?.chain().focus().redo().run()} />
            <select
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              onChange={(event) => {
                if (!editor) return;
                const value = event.target.value;
                if (value === "p") editor.chain().focus().setParagraph().run();
                if (value === "h1") editor.chain().focus().toggleHeading({ level: 1 }).run();
                if (value === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
                if (value === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run();
              }}
              value={
                editor?.isActive("heading", { level: 1 })
                  ? "h1"
                  : editor?.isActive("heading", { level: 2 })
                    ? "h2"
                    : editor?.isActive("heading", { level: 3 })
                      ? "h3"
                      : "p"
              }
            >
              <option value="p">Paragraph</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </select>
            <ToolbarButton active={editor?.isActive("bold")} label="B" onClick={() => editor?.chain().focus().toggleBold().run()} />
            <ToolbarButton active={editor?.isActive("italic")} label="I" onClick={() => editor?.chain().focus().toggleItalic().run()} />
            <ToolbarButton active={editor?.isActive("strike")} label="S" onClick={() => editor?.chain().focus().toggleStrike().run()} />
            <ToolbarButton
              active={editor?.isActive("underline")}
              label="U"
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            />
            <ToolbarButton
              active={editor?.isActive("highlight")}
              label="HL"
              onClick={() => editor?.chain().focus().toggleHighlight().run()}
            />
            <ToolbarButton active={editor?.isActive("code")} label="Code" onClick={() => editor?.chain().focus().toggleCode().run()} />
            <ToolbarButton
              active={editor?.isActive("codeBlock")}
              label="Code Block"
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
            />
            <ToolbarButton
              active={editor?.isActive("blockquote")}
              label="Quote"
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            />
            <ToolbarButton
              active={editor?.isActive("bulletList")}
              label="• List"
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              active={editor?.isActive("orderedList")}
              label="1. List"
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton label="HR" onClick={() => editor?.chain().focus().setHorizontalRule().run()} />
            <ToolbarButton
              active={editor?.isActive("subscript")}
              label="x2"
              onClick={() => editor?.chain().focus().toggleSubscript().run()}
            />
            <ToolbarButton
              active={editor?.isActive("superscript")}
              label="x^2"
              onClick={() => editor?.chain().focus().toggleSuperscript().run()}
            />
            <ToolbarButton active={editor?.isActive("link")} label="Link" onClick={() => setLinkPrompt(editor)} />
            <ToolbarButton label="Unlink" onClick={() => editor?.chain().focus().unsetLink().run()} />
            <ToolbarButton
              active={editor?.isActive({ textAlign: "left" })}
              label="Left"
              onClick={() => editor?.chain().focus().setTextAlign("left").run()}
            />
            <ToolbarButton
              active={editor?.isActive({ textAlign: "center" })}
              label="Center"
              onClick={() => editor?.chain().focus().setTextAlign("center").run()}
            />
            <ToolbarButton
              active={editor?.isActive({ textAlign: "right" })}
              label="Right"
              onClick={() => editor?.chain().focus().setTextAlign("right").run()}
            />
            <ToolbarButton
              active={editor?.isActive({ textAlign: "justify" })}
              label="Justify"
              onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
            />
            <ToolbarButton label="Clear" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} />
            <ToolbarButton label={isDictating ? "Stop speaking" : "Speak to write"} onClick={toggleDictation} />
          </div>
          <EditorContent editor={editor} />
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
                editor?.commands.clearContent();
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

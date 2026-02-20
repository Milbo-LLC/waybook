"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";

export const UploadPanel = ({ entryId }: { entryId: string }) => {
  const [status, setStatus] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-4">
      <label className="text-sm font-medium">Upload photo or short video</label>
      <input
        className="mt-2 block w-full text-sm"
        type="file"
        accept="image/*,video/*"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;

          try {
            const isVideo = file.type.startsWith("video/");
            const type = isVideo ? "video" : "photo";

            setStatus("Requesting upload URL...");
            const upload = await apiClient.createUploadUrl(entryId, {
              type,
              mimeType: file.type,
              bytes: file.size,
              durationMs: undefined,
              fileName: file.name,
              idempotencyKey: crypto.randomUUID()
            });

            setStatus("Uploading...");
            const uploadResponse = await fetch(upload.uploadUrl, {
              method: "PUT",
              headers: upload.requiredHeaders,
              body: file
            });

            if (!uploadResponse.ok) {
              throw new Error(`Upload failed with status ${uploadResponse.status}`);
            }

            await apiClient.completeUpload(upload.mediaId, crypto.randomUUID());
            setStatus("Uploaded and queued for processing");
          } catch (err) {
            const message = err instanceof Error ? err.message : "Upload failed";
            setStatus(`Upload error: ${message}`);
          }
        }}
      />
      {status ? <p className="mt-2 text-xs text-slate-500">{status}</p> : null}
    </div>
  );
};

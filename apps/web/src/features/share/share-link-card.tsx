"use client";

import { useState } from "react";

export const ShareLinkCard = ({ waybookId }: { waybookId: string }) => {
  const [link, setLink] = useState<string | null>(null);

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <button
        className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white"
        onClick={async () => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787"}/v1/waybooks/${waybookId}/share-links`, {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ expiresAt: null })
          });

          if (!response.ok) return;
          const payload = (await response.json()) as { url: string };
          setLink(payload.url);
        }}
      >
        Generate private share link
      </button>
      {link ? <p className="mt-2 text-sm text-slate-600">{link}</p> : null}
    </div>
  );
};

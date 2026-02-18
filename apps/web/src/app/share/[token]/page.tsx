import { redirect } from "next/navigation";

export default async function ShareTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787"}/v1/public/share/${token}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    return <p className="p-6">Link not found or expired.</p>;
  }

  const payload = (await response.json()) as { waybook: { publicSlug: string | null } };
  if (payload.waybook.publicSlug) {
    redirect(`/w/${payload.waybook.publicSlug}`);
  }

  return <p className="p-6">This trip is link-only and not published via slug.</p>;
}

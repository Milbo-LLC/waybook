"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";

export const LogoutButton = () => {
  const router = useRouter();

  return (
    <button
      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
      onClick={async () => {
        await signOut();
        router.push("/login" as any);
      }}
      type="button"
    >
      Sign out
    </button>
  );
};

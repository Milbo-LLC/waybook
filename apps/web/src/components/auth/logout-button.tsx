"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";

export const LogoutButton = () => {
  const router = useRouter();

  return (
    <button
      className="wb-btn-secondary"
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

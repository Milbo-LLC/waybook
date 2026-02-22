"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth";

type AppTopbarProps = {
  user: SessionUser | null;
  rightSlot?: ReactNode;
};

export const AppTopbar = ({ user, rightSlot }: AppTopbarProps) => {
  return (
    <header className="fixed inset-x-0 top-0 z-[120] border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <Link className="wb-title text-lg" href="/">
          Waybook
        </Link>
        <div className="flex items-center gap-3">
          {rightSlot}
          {user ? (
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1">
              <div className="h-7 w-7 overflow-hidden rounded-full bg-slate-200">
                {user.image ? (
                  <img alt="Profile avatar" className="h-full w-full object-cover" referrerPolicy="no-referrer" src={user.image} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-700">
                    {(user.name || user.email || "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="hidden max-w-[140px] truncate pr-1 text-xs font-medium text-slate-600 sm:block">
                {user.name || user.email}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};

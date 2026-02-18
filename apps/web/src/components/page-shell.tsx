import type { PropsWithChildren } from "react";

export const PageShell = ({ children }: PropsWithChildren) => {
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">{children}</main>;
};

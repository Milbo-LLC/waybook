import type { PropsWithChildren } from "react";

type PageShellProps = PropsWithChildren<{
  className?: string;
}>;

export const PageShell = ({ children, className }: PageShellProps) => {
  return <main className={`mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 ${className ?? ""}`}>{children}</main>;
};

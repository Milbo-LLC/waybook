import type { PropsWithChildren } from "react";

type PageShellProps = PropsWithChildren<{
  className?: string;
}>;

export const PageShell = ({ children, className }: PageShellProps) => {
  return <main className={`mx-auto flex min-w-0 w-full max-w-6xl flex-col gap-6 px-4 py-6 ${className ?? ""}`}>{children}</main>;
};

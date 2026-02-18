import type { PropsWithChildren } from "react";
import { clsx } from "clsx";

export const Card = ({
  children,
  className
}: PropsWithChildren<{ className?: string }>) => {
  return (
    <section className={clsx("rounded-xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      {children}
    </section>
  );
};

export const Stack = ({
  children,
  className
}: PropsWithChildren<{ className?: string }>) => {
  return <div className={clsx("flex flex-col gap-3", className)}>{children}</div>;
};

import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type AlertKind = "info" | "success" | "warning" | "error";

const alertStyles: Record<AlertKind, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: "border-ink-900 text-ink-900" },
  success: { icon: CheckCircle2, className: "border-success text-success" },
  warning: { icon: AlertTriangle, className: "border-warning text-warning" },
  error: { icon: XCircle, className: "border-danger text-danger" },
};

/**
 * Inline message. Status colour is always paired with an icon and a title.
 * `live` makes it announce to screen readers when it appears.
 */
export function Alert({
  kind = "info",
  title,
  children,
  live = false,
  className,
}: {
  kind?: AlertKind;
  title: string;
  children?: ReactNode;
  live?: boolean;
  className?: string;
}) {
  const { icon: Icon, className: kindClass } = alertStyles[kind];
  const role = live ? (kind === "error" ? "alert" : "status") : undefined;
  return (
    <div role={role} className={cn("flex gap-3 rounded-md border-l-4 bg-white p-4", kindClass, className)}>
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        {children ? <div className="mt-1 text-ink-900">{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-silver-200 bg-white px-6 py-12 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-md text-graphite-600">{children}</div> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-silver-200/60", className)} />;
}

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { STATUS_LABELS, type AppointmentStatus } from "@/features/appointments/status-machine";
import { cn } from "@/lib/cn";

export function AdminPageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-display text-3xl">{title}</h1>
        {description ? <div className="mt-1 text-graphite-600">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    // min-w-0: inside grid layouts a wide table must scroll within the panel, not widen the page.
    <section className={cn("min-w-0 rounded-md border border-silver-200 bg-white p-5", className)} aria-label={title}>
      {title || actions ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h2 className="text-lg font-semibold">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const STATUS_STYLE: Record<string, string> = {
  pending: "border-warning text-warning",
  confirmed: "border-success text-success",
  reschedule_requested: "border-warning text-warning",
  completed: "border-graphite-600 text-graphite-600",
  cancelled: "border-steel-400 text-graphite-500",
  rejected: "border-danger text-danger",
  no_show: "border-danger text-danger",
  new: "border-warning text-warning",
  in_progress: "border-ink-900 text-ink-900",
  resolved: "border-success text-success",
  spam: "border-steel-400 text-graphite-500",
  sent: "border-success text-success",
  failed: "border-danger text-danger",
  abandoned: "border-danger text-danger",
  skipped_not_configured: "border-steel-400 text-graphite-500",
};

const OTHER_LABELS: Record<string, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  spam: "Spam",
  sent: "Sent",
  failed: "Failed (will retry)",
  abandoned: "Failed",
  pending: "Pending",
  skipped_not_configured: "Email not set up",
};

/** Status chip: colour + text label (never colour alone). */
export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status as AppointmentStatus] ?? OTHER_LABELS[status] ?? status;
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-sm border px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[status] ?? "border-silver-200")}>
      {label}
    </span>
  );
}

export function Pagination({ page, totalPages, total, hrefFor }: { page: number; totalPages: number; total: number; hrefFor: (page: number) => string }) {
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm text-graphite-600">
      <p>
        {total} result{total === 1 ? "" : "s"} · page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-silver-200 bg-white px-3 hover:border-ink-900">
            <ChevronLeft aria-hidden="true" className="size-4" /> Previous
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className="inline-flex min-h-10 items-center gap-1 rounded-md border border-silver-200 bg-white px-3 hover:border-ink-900">
            Next <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

export function NoPermission() {
  return (
    <div className="rounded-md border border-silver-200 bg-white p-8">
      <h1 className="font-display text-2xl">Owner access required</h1>
      <p className="mt-2 text-graphite-600">Only the clinic owner can open this page. Ask the owner if you need a change made here.</p>
    </div>
  );
}

export function Table({ children, caption }: { children: ReactNode; caption: string }) {
  return (
    // Focusable, labelled region so keyboard users can scroll wide tables (WCAG 2.1.1).
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto rounded-md border border-silver-200 bg-white">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export const th = "border-b border-silver-200 bg-paper-50 px-3 py-2 font-semibold";
export const td = "border-b border-silver-200 px-3 py-2 align-top";

/** Builds a URL with updated query parameters (empty values removed). */
export function withQuery(path: string, current: Record<string, string | undefined>, changes: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...changes })) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

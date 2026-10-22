import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppointmentStatusActions, NoteForm, RescheduleForm, RetryNotificationButton } from "@/components/admin/appointment-actions";
import { AdminPageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { formatPhoneDisplay, telHref } from "@/features/clinic-settings/format";
import { getAppointmentDetail } from "@/features/appointments/admin";
import { canReschedule, checkTransition, TRANSITIONS, type AppointmentStatus } from "@/features/appointments/status-machine";
import { requireAdminPage } from "@/lib/auth/guards";
import { isAppError } from "@/lib/errors";
import { formatLocalDate, formatLocalTime, toLocalDate } from "@/lib/time/ist";

export const metadata: Metadata = { title: "Appointment" };

function when(date: Date) {
  return `${formatLocalDate(date)}, ${formatLocalTime(date)}`;
}

export default async function AppointmentDetailPage({ params }: PageProps<"/admin/appointments/[id]">) {
  await requireAdminPage("staff");
  const { id } = await params;
  let detail;
  try {
    detail = await getAppointmentDetail(id);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const { appointment: a, notifications } = detail;
  const now = new Date();
  const allowed = (Object.keys(TRANSITIONS[a.status]) as Exclude<AppointmentStatus, "pending">[]).filter((to) => checkTransition(a.status, to, { start: a.start, now }).ok);

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/appointments" className="underline">
          ← All appointments
        </Link>
      </p>
      <AdminPageHeader
        title={a.patient.name}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{a.reference}</span>
            <StatusBadge status={a.status} />
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Panel title="Appointment">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold">Time</dt>
              <dd>{when(a.start)}</dd>
              <dt className="font-semibold">Visit</dt>
              <dd>{a.serviceTitle}</dd>
              <dt className="font-semibold">Chair</dt>
              <dd>{a.resourceKey.replace("chair-", "Chair ")}</dd>
              <dt className="font-semibold">Source</dt>
              <dd className="capitalize">{a.source}</dd>
              <dt className="font-semibold">Requested</dt>
              <dd>{when(a.createdAt)}</dd>
              {a.message ? (
                <>
                  <dt className="font-semibold">Patient message</dt>
                  <dd className="whitespace-pre-wrap">{a.message}</dd>
                </>
              ) : null}
            </dl>
          </Panel>

          <Panel title="Change status">
            <AppointmentStatusActions id={String(a._id)} allowed={allowed} />
          </Panel>

          {canReschedule(a.status) ? (
            <Panel title="Reschedule">
              <RescheduleForm id={String(a._id)} today={toLocalDate(now)} />
            </Panel>
          ) : null}

          <Panel title="History">
            <ol className="space-y-3">
              {[...a.history].reverse().map((h, i) => (
                <li key={i} className="border-l-2 border-silver-200 pl-3">
                  <p className="text-sm text-graphite-600">{when(h.at)}</p>
                  <p>
                    {h.action.replace(/_/g, " ")}
                    {h.from ? ` · ${h.from.replace("_", " ")} → ` : " · "}
                    {h.to.replace("_", " ")}
                  </p>
                  {h.note ? <p className="text-sm text-graphite-600">“{h.note}”</p> : null}
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Patient">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold">Name</dt>
              <dd>{a.patient.name}</dd>
              <dt className="font-semibold">Mobile</dt>
              <dd>
                <a href={telHref(a.patient.phoneE164)} className="underline">
                  {formatPhoneDisplay(a.patient.phoneE164)}
                </a>
              </dd>
              <dt className="font-semibold">Email</dt>
              <dd>{a.patient.email ?? "Not given"}</dd>
              <dt className="font-semibold">Reminders</dt>
              <dd>{a.consent.marketingOptIn ? "Opted in" : "Not opted in"}</dd>
            </dl>
          </Panel>

          <Panel title="Internal notes">
            {a.internalNotes.length === 0 ? <p className="mb-4 text-sm text-graphite-600">No notes yet.</p> : null}
            <ul className="mb-4 space-y-3">
              {a.internalNotes.map((n, i) => (
                <li key={i} className="rounded-sm bg-paper-50 p-3">
                  <p className="whitespace-pre-wrap">{n.text}</p>
                  <p className="mt-1 text-xs text-graphite-600">{when(n.at)}</p>
                </li>
              ))}
            </ul>
            <NoteForm url={`/api/admin/appointments/${String(a._id)}/notes`} />
          </Panel>

          <Panel title="Notifications">
            {notifications.length === 0 ? (
              <p className="text-sm text-graphite-600">No notifications were needed (no email address or no staff alerts configured).</p>
            ) : (
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li key={String(n._id)} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm">
                      {n.kind.replace(/_/g, " ")} → {n.recipientMasked}
                      {n.lastError ? <span className="block text-xs text-danger">{n.lastError}</span> : null}
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={n.status} />
                      {n.status === "failed" || n.status === "abandoned" || n.status === "skipped_not_configured" ? <RetryNotificationButton id={String(n._id)} /> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

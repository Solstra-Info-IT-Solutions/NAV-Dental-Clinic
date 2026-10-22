import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader, Panel, StatusBadge, Table, td, th } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { dashboardSummary } from "@/features/appointments/admin";
import { ENQUIRY_CATEGORY_LABELS, type EnquiryCategory } from "@/features/enquiries/schemas";
import { requireAdminPage } from "@/lib/auth/guards";
import { formatLocalDate, formatLocalTime } from "@/lib/time/ist";

export const metadata: Metadata = { title: "Dashboard" };

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-md border border-silver-200 bg-white p-4 hover:border-ink-900">
      <p className="text-sm text-graphite-600">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  await requireAdminPage("staff");
  const summary = await dashboardSummary();
  const c = summary.counts;

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description={`Today is ${formatLocalDate(new Date(`${summary.today.date}T06:30:00.000Z`))}. All numbers come directly from the clinic's records.`}
        actions={<ButtonLink href="/admin/appointments/new">New appointment</ButtonLink>}
      />

      {summary.failedNotifications > 0 ? (
        <Alert kind="warning" title={`${summary.failedNotifications} notification(s) could not be sent`} className="mb-6">
          <Link href="/admin/notifications" className="underline">
            Review and retry notifications
          </Link>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Appointments today" value={summary.today.total} href={`/admin/appointments?from=${summary.today.date}&to=${summary.today.date}`} />
        <Stat label="Pending requests" value={c.pending ?? 0} href="/admin/appointments?status=pending" />
        <Stat label="Confirmed" value={c.confirmed ?? 0} href="/admin/appointments?status=confirmed" />
        <Stat label="New enquiries" value={summary.newEnquiries} href="/admin/enquiries?status=new" />
        <Stat label="Completed" value={c.completed ?? 0} href="/admin/appointments?status=completed" />
        <Stat label="Cancelled" value={c.cancelled ?? 0} href="/admin/appointments?status=cancelled" />
        <Stat label="Reschedule requested" value={c.reschedule_requested ?? 0} href="/admin/appointments?status=reschedule_requested" />
        <Stat label="No-shows" value={c.no_show ?? 0} href="/admin/appointments?status=no_show" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Upcoming appointments" actions={<Link href="/admin/appointments" className="text-sm underline">View all</Link>}>
          {summary.upcoming.length === 0 ? (
            <EmptyState title="No upcoming appointments" />
          ) : (
            <Table caption="Upcoming appointments">
              <thead>
                <tr>
                  <th className={th}>When</th>
                  <th className={th}>Patient</th>
                  <th className={th}>Visit</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {summary.upcoming.map((a) => (
                  <tr key={a.id}>
                    <td className={td}>
                      {formatLocalDate(new Date(a.start))}
                      <br />
                      <span className="text-graphite-600">{formatLocalTime(new Date(a.start))}</span>
                    </td>
                    <td className={td}>
                      <Link href={`/admin/appointments/${a.id}`} className="font-medium underline underline-offset-4">
                        {a.patientName}
                      </Link>
                      <br />
                      <span className="font-mono text-xs text-graphite-600">{a.reference}</span>
                    </td>
                    <td className={td}>{a.serviceTitle}</td>
                    <td className={td}>
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel title="Recent enquiries" actions={<Link href="/admin/enquiries" className="text-sm underline">View all</Link>}>
          {summary.recentEnquiries.length === 0 ? (
            <EmptyState title="No enquiries yet" />
          ) : (
            <ul className="divide-y divide-silver-200">
              {summary.recentEnquiries.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <Link href={`/admin/enquiries/${e.id}`} className="font-medium underline underline-offset-4">
                      {e.name}
                    </Link>
                    <p className="text-sm text-graphite-600">
                      {ENQUIRY_CATEGORY_LABELS[e.category as EnquiryCategory]} · {formatLocalDate(new Date(e.createdAt))}
                    </p>
                  </div>
                  <StatusBadge status={e.status} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { RetryNotificationButton } from "@/components/admin/appointment-actions";
import { AdminPageHeader, StatusBadge, Table, td, th } from "@/components/admin/ui";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { getEmailProvider } from "@/features/notifications/email-provider";
import { listNotificationAttempts } from "@/features/notifications/service";
import { requireAdminPage } from "@/lib/auth/guards";
import { formatLocalDate, formatLocalTime } from "@/lib/time/ist";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps<"/admin/notifications">) {
  await requireAdminPage("staff");
  const problemsOnly = (await searchParams).status === "problems";
  const items = await listNotificationAttempts({ problemsOnly, limit: 100 });
  const configured = getEmailProvider() !== null;

  return (
    <>
      <AdminPageHeader
        title="Notifications"
        description="Every email the system tried to send. Failed emails are retried automatically; you can also retry them here."
        actions={
          <Link href={problemsOnly ? "/admin/notifications" : "/admin/notifications?status=problems"} className="inline-flex min-h-11 items-center rounded-md border border-ink-900 px-4 font-semibold">
            {problemsOnly ? "Show all" : "Show problems only"}
          </Link>
        }
      />
      {!configured ? (
        <Alert kind="warning" title="Email sending is not set up yet" className="mb-6">
          <p>Notifications are recorded but not sent. Ask your developer to configure the email provider (see the deployment guide).</p>
        </Alert>
      ) : null}
      {items.length === 0 ? (
        <EmptyState title={problemsOnly ? "No problems" : "No notifications yet"} />
      ) : (
        <Table caption="Notifications">
          <thead>
            <tr>
              <th className={th}>Created</th>
              <th className={th}>Type</th>
              <th className={th}>Recipient</th>
              <th className={th}>Status</th>
              <th className={th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((n) => (
              <tr key={n.id}>
                <td className={td}>
                  {formatLocalDate(new Date(n.createdAt))}
                  <br />
                  <span className="text-graphite-600">{formatLocalTime(new Date(n.createdAt))}</span>
                </td>
                <td className={td}>
                  <Link href={n.subjectType === "appointment" ? `/admin/appointments/${n.subjectId}` : `/admin/enquiries/${n.subjectId}`} className="underline">
                    {n.kind.replace(/_/g, " ")}
                  </Link>
                </td>
                <td className={`${td} text-xs`}>{n.recipientMasked}</td>
                <td className={td}>
                  <StatusBadge status={n.status} />
                  {n.lastError ? <span className="mt-1 block max-w-xs text-xs text-danger">{n.lastError}</span> : null}
                  {n.nextRetryAt ? <span className="mt-1 block text-xs text-graphite-600">Next try {formatLocalTime(new Date(n.nextRetryAt))}</span> : null}
                </td>
                <td className={td}>{n.status !== "sent" && n.status !== "pending" ? <RetryNotificationButton id={n.id} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

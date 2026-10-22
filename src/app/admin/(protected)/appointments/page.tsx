import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader, NoPermission, Pagination, StatusBadge, Table, td, th, withQuery } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { appointmentListQuerySchema, listAppointments } from "@/features/appointments/admin";
import { APPOINTMENT_STATUSES_LIST, STATUS_LABELS } from "@/features/appointments/status-machine";
import { requireAdminPage } from "@/lib/auth/guards";
import { formatLocalDate, formatLocalTime } from "@/lib/time/ist";

export const metadata: Metadata = { title: "Appointments" };

const field = "min-h-11 rounded-sm border border-steel-400 bg-white px-3";

export default async function AppointmentsPage({ searchParams }: PageProps<"/admin/appointments">) {
  const { admin, allowed } = await requireAdminPage("staff");
  if (!allowed) return <NoPermission />;

  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string | undefined>;
  const parsed = appointmentListQuerySchema.safeParse(raw);
  const query = parsed.success ? parsed.data : appointmentListQuerySchema.parse({});
  const { items, page } = await listAppointments(query);
  const current = { status: raw.status, from: raw.from, to: raw.to, q: raw.q, sort: raw.sort };

  return (
    <>
      <AdminPageHeader
        title="Appointments"
        description="Search, filter and open appointments. Mobile numbers are partly hidden in lists; open an appointment to see full details."
        actions={
          <>
            <ButtonLink href="/admin/appointments/new">New appointment</ButtonLink>
            {admin.role === "owner" ? (
              <ButtonLink href="#export" variant="secondary">
                Export
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {!parsed.success ? (
        <Alert kind="warning" title="Some filters were invalid and have been ignored." className="mb-4" />
      ) : null}

      <form method="get" className="mb-4 grid gap-3 rounded-md border border-silver-200 bg-white p-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end" role="search">
        <label className="grid gap-1 text-sm font-semibold">
          Search
          <input name="q" defaultValue={raw.q} placeholder="Name, mobile or reference" className={field} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Status
          <select name="status" defaultValue={raw.status ?? ""} className={field}>
            <option value="">All statuses</option>
            {APPOINTMENT_STATUSES_LIST.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          From
          <input type="date" name="from" defaultValue={raw.from} className={field} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          To
          <input type="date" name="to" defaultValue={raw.to} className={field} />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="min-h-11 rounded-md bg-ink-900 px-4 font-semibold text-platinum-100">
            Apply
          </button>
          <Link href="/admin/appointments" className="inline-flex min-h-11 items-center rounded-md px-3 underline">
            Clear
          </Link>
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No appointments match these filters" />
      ) : (
        <Table caption="Appointments">
          <thead>
            <tr>
              <th className={th}>
                <Link href={withQuery("/admin/appointments", current, { sort: query.sort === "start" ? "-start" : "start", page: undefined })} className="underline">
                  Date and time
                </Link>
              </th>
              <th className={th}>Patient</th>
              <th className={th}>Mobile</th>
              <th className={th}>Visit</th>
              <th className={th}>Status</th>
              <th className={th}>Source</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
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
                <td className={`${td} font-mono text-xs`}>{a.phoneMasked}</td>
                <td className={td}>{a.serviceTitle}</td>
                <td className={td}>
                  <StatusBadge status={a.status} />
                </td>
                <td className={`${td} capitalize`}>{a.source}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page.page} totalPages={page.totalPages} total={page.total} hrefFor={(p) => withQuery("/admin/appointments", current, { page: String(p) })} />

      {admin.role === "owner" ? (
        <section id="export" className="mt-10 rounded-md border border-silver-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Export appointments (CSV)</h2>
          <p className="mt-1 text-sm text-graphite-600">Contains patient names and mobile numbers. Store the file securely. Each export is recorded in the audit log. Up to 92 days.</p>
          <form method="get" action="/api/admin/appointments/export" className="mt-4 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm font-semibold">
              From
              <input type="date" name="from" required className={field} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              To
              <input type="date" name="to" required className={field} />
            </label>
            <button type="submit" className="min-h-11 rounded-md border border-ink-900 px-4 font-semibold">
              Download CSV
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}

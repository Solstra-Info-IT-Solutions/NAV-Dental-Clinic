import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader, Pagination, StatusBadge, Table, td, th, withQuery } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/feedback";
import { ENQUIRY_CATEGORY_LABELS, ENQUIRY_STATUSES, type EnquiryCategory, type EnquiryStatus } from "@/features/enquiries/schemas";
import { listEnquiries } from "@/features/enquiries/service";
import { requireAdminPage } from "@/lib/auth/guards";
import { maskPhone } from "@/lib/logger";
import { formatLocalDate, formatLocalTime } from "@/lib/time/ist";

export const metadata: Metadata = { title: "Enquiries" };

const STATUS_TEXT: Record<EnquiryStatus, string> = { new: "New", in_progress: "In progress", resolved: "Resolved", spam: "Spam" };
const field = "min-h-11 rounded-sm border border-steel-400 bg-white px-3";

export default async function EnquiriesPage({ searchParams }: PageProps<"/admin/enquiries">) {
  const { admin } = await requireAdminPage("staff");
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string | undefined>;
  const status = (ENQUIRY_STATUSES as readonly string[]).includes(raw.status ?? "") ? [raw.status as EnquiryStatus] : [];
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);
  // Spam is hidden unless explicitly requested.
  const effectiveStatus = status.length ? status : (["new", "in_progress", "resolved"] as EnquiryStatus[]);
  const { items, page: meta } = await listEnquiries({ page, pageSize: 20, status: effectiveStatus, q: raw.q?.slice(0, 60) });
  const current = { status: raw.status, q: raw.q };

  return (
    <>
      <AdminPageHeader title="Enquiries" description="Messages from the website contact form. Spam is hidden unless you filter for it and is deleted automatically after 30 days." />
      <form method="get" role="search" className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-silver-200 bg-white p-4">
        <label className="grid gap-1 text-sm font-semibold">
          Search
          <input name="q" defaultValue={raw.q} placeholder="Name or mobile" className={field} />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Status
          <select name="status" defaultValue={raw.status ?? ""} className={field}>
            <option value="">All except spam</option>
            {ENQUIRY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_TEXT[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-md bg-ink-900 px-4 font-semibold text-platinum-100">
          Apply
        </button>
      </form>

      {items.length === 0 ? (
        <EmptyState title="No enquiries match these filters" />
      ) : (
        <Table caption="Enquiries">
          <thead>
            <tr>
              <th className={th}>Received</th>
              <th className={th}>From</th>
              <th className={th}>Mobile</th>
              <th className={th}>Topic</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={String(e._id)}>
                <td className={td}>
                  {formatLocalDate(e.createdAt)}
                  <br />
                  <span className="text-graphite-600">{formatLocalTime(e.createdAt)}</span>
                </td>
                <td className={td}>
                  <Link href={`/admin/enquiries/${String(e._id)}`} className="font-medium underline underline-offset-4">
                    {e.name}
                  </Link>
                </td>
                <td className={`${td} font-mono text-xs`}>{maskPhone(e.phoneE164)}</td>
                <td className={td}>{ENQUIRY_CATEGORY_LABELS[e.category as EnquiryCategory]}</td>
                <td className={td}>
                  <StatusBadge status={e.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} hrefFor={(p) => withQuery("/admin/enquiries", current, { page: String(p) })} />

      {admin.role === "owner" ? (
        <section className="mt-10 rounded-md border border-silver-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Export enquiries (CSV)</h2>
          <p className="mt-1 text-sm text-graphite-600">Excludes spam. Contains personal details; store securely. Recorded in the audit log. Up to 92 days.</p>
          <form method="get" action="/api/admin/enquiries/export" className="mt-4 flex flex-wrap items-end gap-3">
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

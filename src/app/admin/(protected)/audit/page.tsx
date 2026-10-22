import type { Metadata } from "next";

import { AdminPageHeader, NoPermission, Pagination, Table, td, th } from "@/components/admin/ui";
import { listAudit } from "@/features/audit/service";
import { requireAdminPage } from "@/lib/auth/guards";
import { formatLocalDate, formatLocalTime } from "@/lib/time/ist";

export const metadata: Metadata = { title: "Audit log" };

function show(value: unknown): string {
  if (value === undefined || value === null) return "—";
  return typeof value === "string" ? value : JSON.stringify(value).slice(0, 120);
}

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const { allowed } = await requireAdminPage("owner");
  if (!allowed) return <NoPermission />;
  const raw = await searchParams;
  const page = Math.max(1, Number.parseInt(typeof raw.page === "string" ? raw.page : "1", 10) || 1);
  const { items, page: meta } = await listAudit({ page, pageSize: 50 });

  return (
    <>
      <AdminPageHeader title="Audit log" description="Important actions by staff and the system. Entries cannot be edited or deleted. Patient contact details are not copied here." />
      <Table caption="Audit log">
        <thead>
          <tr>
            <th className={th}>When</th>
            <th className={th}>Who</th>
            <th className={th}>Action</th>
            <th className={th}>Record</th>
            <th className={th}>Changes</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id}>
              <td className={`${td} whitespace-nowrap`}>
                {formatLocalDate(new Date(a.at))}
                <br />
                <span className="text-graphite-600">{formatLocalTime(new Date(a.at))}</span>
              </td>
              <td className={td}>{a.actorEmail}</td>
              <td className={`${td} font-mono text-xs`}>{a.action}</td>
              <td className={`${td} text-xs`}>
                {a.entity} <span className="font-mono">{a.entityId}</span>
              </td>
              <td className={`${td} text-xs`}>
                {a.changes.length === 0
                  ? "—"
                  : a.changes.map((c, i) => (
                      <span key={i} className="block">
                        {c.field}: {show(c.from)} → {show(c.to)}
                      </span>
                    ))}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} hrefFor={(p) => `/admin/audit?page=${p}`} />
    </>
  );
}

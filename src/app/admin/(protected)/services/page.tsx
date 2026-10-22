import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageHeader, NoPermission, Table, td, th } from "@/components/admin/ui";
import { ButtonLink } from "@/components/ui/button";
import { listAllServices } from "@/features/services/admin";
import { requireAdminPage } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesAdminPage() {
  const { allowed } = await requireAdminPage("owner");
  if (!allowed) return <NoPermission />;
  const services = await listAllServices();
  return (
    <>
      <AdminPageHeader
        title="Services"
        description="Only publish services the clinic actually offers. Draft services are not visible on the website."
        actions={<ButtonLink href="/admin/services/new">New service</ButtonLink>}
      />
      <Table caption="Services">
        <thead>
          <tr>
            <th className={th}>Order</th>
            <th className={th}>Service</th>
            <th className={th}>Website</th>
            <th className={th}>Online booking</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td className={td}>{s.order}</td>
              <td className={td}>
                <Link href={`/admin/services/${s.id}`} className="font-medium underline underline-offset-4">
                  {s.title}
                </Link>
                <br />
                <span className="font-mono text-xs text-graphite-600">/services/{s.slug}</span>
              </td>
              <td className={td}>{s.published ? <span className="font-semibold text-success">Published</span> : <span className="text-graphite-600">Draft</span>}</td>
              <td className={td}>{s.published && s.bookable ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

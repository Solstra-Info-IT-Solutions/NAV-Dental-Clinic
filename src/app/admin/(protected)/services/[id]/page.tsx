import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ServiceForm } from "@/components/admin/service-form";
import { AdminPageHeader, NoPermission } from "@/components/admin/ui";
import { getService, type AdminService } from "@/features/services/admin";
import { requireAdminPage } from "@/lib/auth/guards";
import { isAppError } from "@/lib/errors";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage({ params }: PageProps<"/admin/services/[id]">) {
  const { allowed } = await requireAdminPage("owner");
  if (!allowed) return <NoPermission />;
  const { id } = await params;

  let service: AdminService | undefined;
  if (id !== "new") {
    try {
      service = await getService(id);
    } catch (error) {
      if (isAppError(error) && error.code === "NOT_FOUND") notFound();
      throw error;
    }
  }

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/services" className="underline">
          ← All services
        </Link>
      </p>
      <AdminPageHeader
        title={service ? service.title : "New service"}
        description={
          service?.published ? (
            <Link href={`/services/${service.slug}`} className="underline" target="_blank">
              View on website
            </Link>
          ) : (
            "Draft — not visible on the website until published."
          )
        }
      />
      <ServiceForm service={service} />
    </>
  );
}

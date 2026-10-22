import type { Metadata } from "next";
import Link from "next/link";

import { ManualAppointmentForm } from "@/components/admin/manual-appointment-form";
import { AdminPageHeader, Panel } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/feedback";
import { listAllServices } from "@/features/services/admin";
import { requireAdminPage } from "@/lib/auth/guards";
import { toLocalDate } from "@/lib/time/ist";

export const metadata: Metadata = { title: "New appointment" };

export default async function NewAppointmentPage() {
  await requireAdminPage("staff");
  const services = (await listAllServices()).filter((s) => s.published).map(({ slug, title }) => ({ slug, title }));

  return (
    <>
      <p className="mb-2 text-sm">
        <Link href="/admin/appointments" className="underline">
          ← All appointments
        </Link>
      </p>
      <AdminPageHeader title="New appointment" description="For patients who book by phone or in person. Free times respect opening hours, closures, blocks and existing bookings." />
      <Panel>
        {services.length === 0 ? (
          <EmptyState title="No published services">Publish at least one service before creating appointments.</EmptyState>
        ) : (
          <ManualAppointmentForm services={services} today={toLocalDate(new Date())} />
        )}
      </Panel>
    </>
  );
}

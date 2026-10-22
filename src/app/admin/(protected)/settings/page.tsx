import type { Metadata } from "next";

import { SettingsForm } from "@/components/admin/settings-form";
import { AdminPageHeader, NoPermission } from "@/components/admin/ui";
import { getAdminSettings } from "@/features/clinic-settings/repository";
import { requireAdminPage } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Clinic settings" };

export default async function SettingsPage() {
  const { allowed } = await requireAdminPage("owner");
  if (!allowed) return <NoPermission />;
  const settings = await getAdminSettings();
  return (
    <>
      <AdminPageHeader title="Clinic settings" description="Details shown on the website and the rules for online booking. Every change is recorded in the audit log." />
      <SettingsForm initial={settings} />
    </>
  );
}

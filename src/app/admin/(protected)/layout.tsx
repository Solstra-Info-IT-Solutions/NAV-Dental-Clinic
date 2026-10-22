import { Suspense, type ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { Skeleton } from "@/components/ui/feedback";
import { requireAdminPage } from "@/lib/auth/guards";

/** Session check runs per request (inside Suspense, as Cache Components requires for request data). */
async function AuthenticatedFrame({ children }: { children: ReactNode }) {
  const { admin } = await requireAdminPage("staff");
  return <AdminShell admin={admin}>{children}</AdminShell>;
}

function FrameFallback() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4 p-8">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-40" />
    </div>
  );
}

export default function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<FrameFallback />}>
      <AuthenticatedFrame>{children}</AuthenticatedFrame>
    </Suspense>
  );
}

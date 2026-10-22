import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import type { AuditActor } from "@/features/audit/service";
import { AppError } from "@/lib/errors";

import { getAuth, type AdminRole } from "./auth";

export type AdminUser = { id: string; email: string; name: string; role: AdminRole };

const RANK: Record<AdminRole, number> = { staff: 1, owner: 2 };

export function hasRole(user: AdminUser, required: AdminRole): boolean {
  return RANK[user.role] >= RANK[required];
}

/** Session lookup from request headers. Disabled or role-less accounts count as signed out. */
export async function getAdminFromHeaders(requestHeaders: Headers): Promise<AdminUser | null> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const user = session.user as typeof session.user & { role?: string; disabled?: boolean };
  if (user.disabled || (user.role !== "owner" && user.role !== "staff")) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Per-request memoised session for Server Components (layout + page share one lookup). */
export const getCurrentAdmin = cache(async (): Promise<AdminUser | null> => getAdminFromHeaders(await headers()));

/**
 * Authorisation for Route Handlers. Never rely on hidden buttons: every admin
 * endpoint calls this before reading input.
 */
export async function requireAdmin(requestHeaders: Headers, role: AdminRole = "staff"): Promise<AdminUser> {
  const admin = await getAdminFromHeaders(requestHeaders);
  if (!admin) throw new AppError("UNAUTHENTICATED");
  if (!hasRole(admin, role)) throw new AppError("FORBIDDEN");
  return admin;
}

/** Authorisation for admin pages: redirects to sign-in when signed out. */
export async function requireAdminPage(role: AdminRole = "staff"): Promise<{ admin: AdminUser; allowed: boolean }> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return { admin, allowed: hasRole(admin, role) };
}

export function auditActor(admin: AdminUser): AuditActor {
  return { id: admin.id, email: admin.email };
}

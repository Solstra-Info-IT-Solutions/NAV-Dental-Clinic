import {
  Bell,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileClock,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { LogoMark } from "@/components/layout/logo";
import type { AdminUser } from "@/lib/auth/guards";

import { AdminNavLink } from "./admin-nav-link";
import { SignOutButton } from "./sign-out-button";

type Item = { href: string; label: string; icon: LucideIcon; ownerOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/appointments", label: "Appointments", icon: CalendarClock },
  { href: "/admin/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/admin/enquiries", label: "Enquiries", icon: MessagesSquare },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/services", label: "Services", icon: Stethoscope, ownerOnly: true },
  { href: "/admin/settings", label: "Clinic settings", icon: Settings, ownerOnly: true },
  { href: "/admin/users", label: "Staff accounts", icon: Users, ownerOnly: true },
  { href: "/admin/audit", label: "Audit log", icon: FileClock, ownerOnly: true },
];

function NavList({ admin }: { admin: AdminUser }) {
  return (
    <ul className="space-y-1">
      {ITEMS.filter((i) => !i.ownerOnly || admin.role === "owner").map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <AdminNavLink href={href} exact={href === "/admin"}>
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </AdminNavLink>
        </li>
      ))}
    </ul>
  );
}

/** Authenticated admin frame. Menu items are filtered by role for clarity only; the server enforces roles. */
export function AdminShell({ admin, children }: { admin: AdminUser; children: ReactNode }) {
  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[15rem_1fr]">
      <aside className="surface-dark hidden flex-col border-r border-ink-700 lg:flex">
        <Link href="/admin" className="flex items-center gap-3 px-5 py-5">
          <LogoMark className="h-8 w-auto text-silver-200" />
          <span className="font-display text-lg">NAV Admin</span>
        </Link>
        <nav aria-label="Admin" className="flex-1 px-3">
          <NavList admin={admin} />
        </nav>
        <div className="border-t border-ink-700 p-4 text-sm">
          <p className="truncate font-semibold">{admin.name}</p>
          <p className="truncate text-silver-300">{admin.email}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-steel-400">{admin.role}</p>
          <SignOutButton className="mt-3" />
        </div>
      </aside>

      {/* Small screens: native disclosure menu, no client JavaScript needed. */}
      <header className="surface-dark flex items-center justify-between px-4 py-3 lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <LogoMark className="h-7 w-auto text-silver-200" />
          <span className="font-display">NAV Admin</span>
        </Link>
        <details className="relative">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md px-3 hover:bg-white/10 [&::-webkit-details-marker]:hidden">
            <ClipboardList aria-hidden="true" className="size-5" />
            Menu
          </summary>
          <nav aria-label="Admin" className="surface-dark absolute right-0 z-40 mt-2 w-64 rounded-md border border-ink-700 p-3 shadow-overlay">
            <NavList admin={admin} />
            <div className="mt-3 border-t border-ink-700 pt-3 text-sm">
              <p className="truncate">{admin.email}</p>
              <SignOutButton className="mt-2" />
            </div>
          </nav>
        </details>
      </header>

      <main id="main-content" tabIndex={-1} className="min-w-0 px-4 py-6 focus:outline-none md:px-8 md:py-8">
        {/* Set only by scripts/with-db.ts when it runs the in-memory development database. */}
        {process.env.NAV_DEV_SAMPLE_DATA === "1" ? (
          <p role="note" className="mb-6 rounded-md bg-warning px-4 py-2 text-sm font-semibold text-white">
            Development database: sample opening hours and temporary data that is deleted when the server stops.
          </p>
        ) : null}
        {children}
      </main>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/cn";

export function isActivePath(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop navigation links with aria-current on the active page. */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="flex items-center gap-1">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative inline-flex min-h-11 items-center px-3 text-[0.9375rem] font-medium transition-colors",
                active ? "text-platinum-100" : "text-silver-300 hover:text-platinum-100",
                "after:absolute after:inset-x-3 after:bottom-1.5 after:h-px after:bg-silver-200 after:transition-opacity",
                active ? "after:opacity-100" : "after:opacity-0",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

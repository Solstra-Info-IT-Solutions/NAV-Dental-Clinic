"use client";

import { Menu, Phone, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { buttonClasses } from "@/components/ui/button";
import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/cn";

import { isActivePath } from "./nav-links";

type MobileNavProps = {
  items: NavItem[];
  phoneHref: string;
  phoneLabel: string;
  bookLabel: string;
  openLabel: string;
  closeLabel: string;
  navLabel: string;
};

/**
 * Disclosure-pattern navigation for small screens: a toggle button controls a
 * panel below the header. Escape closes it and returns focus to the toggle;
 * navigating closes it.
 */
export function MobileNav({ items, phoneHref, phoneLabel, bookLabel, openLabel, closeLabel, navLabel }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Close the menu whenever the route changes (adjusting state during render).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={toggleRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-md text-platinum-100 hover:bg-white/10"
      >
        {open ? <X aria-hidden="true" className="size-6" /> : <Menu aria-hidden="true" className="size-6" />}
        <span className="sr-only">{open ? closeLabel : openLabel}</span>
      </button>

      <div
        ref={panelRef}
        id={panelId}
        hidden={!open}
        className="surface-dark absolute inset-x-0 top-full border-t border-ink-700 shadow-overlay"
      >
        <nav aria-label={navLabel} className="mx-auto max-w-site px-4 pb-6 pt-2">
          <ul className="divide-y divide-ink-700">
            {items.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-12 items-center text-lg",
                      active ? "font-semibold text-platinum-100" : "text-silver-200",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <a href={phoneHref} className={buttonClasses({ variant: "secondary", tone: "dark" })}>
              <Phone aria-hidden="true" className="size-4" />
              {phoneLabel}
            </a>
            <Link href="/appointment" onClick={() => setOpen(false)} className={buttonClasses({ tone: "dark" })}>
              {bookLabel}
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}

import type { Dictionary } from "@/i18n/dictionaries/en";

export type NavItem = { href: string; label: string };

export function primaryNav(t: Dictionary): NavItem[] {
  return [
    { href: "/", label: t.nav.home },
    { href: "/about", label: t.nav.about },
    { href: "/services", label: t.nav.services },
    { href: "/faq", label: t.nav.faq },
    { href: "/contact", label: t.nav.contact },
  ];
}

export function legalNav(t: Dictionary): NavItem[] {
  return [
    { href: "/privacy-policy", label: t.footer.privacy },
    { href: "/terms", label: t.footer.terms },
  ];
}

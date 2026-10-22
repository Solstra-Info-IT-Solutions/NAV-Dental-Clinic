/**
 * English UI strings. A Hindi dictionary (hi.ts) must satisfy the same
 * `Dictionary` type, so missing translations fail the type check.
 */
export const en = {
  nav: {
    label: "Main",
    home: "Home",
    about: "About",
    services: "Services",
    faq: "FAQ",
    contact: "Contact",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
  cta: {
    call: "Call",
    callToBook: "Call to book",
    whatsapp: "WhatsApp",
    book: "Book",
    requestAppointment: "Request an appointment",
    directions: "Get directions",
  },
  common: {
    skipToContent: "Skip to main content",
    breadcrumb: "Breadcrumb",
    opensInNewTab: "(opens in a new tab)",
  },
  footer: {
    legal: "Legal",
    explore: "Explore",
    visit: "Visit the clinic",
    privacy: "Privacy Policy",
    terms: "Terms of Use",
  },
} as const;

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Dictionary = Widen<typeof en>;

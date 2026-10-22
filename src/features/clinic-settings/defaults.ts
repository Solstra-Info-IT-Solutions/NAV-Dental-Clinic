import type { PublicClinicSettings } from "./types";

/**
 * Verified client-supplied facts plus owner-approved defaults
 * (docs/PHASE_01_ARCHITECTURE_DESIGN.md §5). From Phase 3 these seed the
 * `clinic_settings` document and the database becomes the source of truth.
 *
 * Deliberately absent until verified by the clinic: credentials, email,
 * opening hours, WhatsApp, map pin, social links.
 */
export const DEFAULT_PUBLIC_SETTINGS: PublicClinicSettings = {
  clinicName: "NAV Dental Clinic",
  doctorName: "Dr. Ratan Raghav",
  phoneE164: "+918006606001",
  address: {
    line1: "Somna Road",
    line2: "Near Tata Kishan Kendra",
    locality: "Pahasu",
    district: "BSR",
    state: "Uttar Pradesh",
    country: "IN",
  },
  social: {},
  weeklyHours: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
  bookingEnabled: true,
  bookingMode: "request",
  legalPagesApproved: false,
};

export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** "HH:mm", 24-hour, clinic-local (Asia/Kolkata). */
export type LocalTime = string;

export type OpeningInterval = { open: LocalTime; close: LocalTime };

export type ClinicAddress = {
  line1: string;
  line2?: string;
  locality: string;
  district: string;
  state: string;
  postalCode?: string;
  country: "IN";
};

/**
 * The public subset of clinic settings (see docs/API_DOCUMENTATION.md,
 * GET /api/public/settings). Optional fields stay undefined until the clinic
 * verifies them — components must omit, never invent, missing values.
 */
export type PublicClinicSettings = {
  clinicName: string;
  doctorName: string;
  doctorCredentials?: string;
  phoneE164: string;
  whatsappE164?: string;
  email?: string;
  address: ClinicAddress;
  mapUrl?: string;
  geo?: { lat: number; lng: number };
  social: Partial<Record<"facebook" | "instagram" | "youtube" | "x", string>>;
  weeklyHours: Record<Weekday, OpeningInterval[]>;
  bookingEnabled: boolean;
  bookingMode: "request" | "instant";
  legalPagesApproved: boolean;
  /** Owner-edited home page search title/description (Clinic settings → Search engines). */
  seo?: { defaultTitle?: string; defaultDescription?: string };
};

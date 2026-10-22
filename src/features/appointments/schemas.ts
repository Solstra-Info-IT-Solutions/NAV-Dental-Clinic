/**
 * Booking input schemas shared by the browser form and the server. The
 * server always re-parses with these schemas; client validation is only for
 * fast feedback.
 */
import { z } from "zod";

/** Version of the privacy notice shown next to the booking form. Stored with each consent. */
export const PRIVACY_POLICY_VERSION = "2026-10-22-draft";

/** Accepts 10-digit Indian mobiles with optional +91 / 91 / 0 prefix, spaces, dashes or brackets. Outputs E.164. */
export function normaliseIndianMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  const match = /^(?:\+91|91|0)?([6-9]\d{9})$/.exec(digits);
  return match ? `+91${match[1]}` : null;
}

export const indianMobileSchema = z
  .string({ error: "Enter your mobile number." })
  .trim()
  .min(1, "Enter your mobile number.")
  .transform((value, ctx) => {
    const e164 = normaliseIndianMobile(value);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit Indian mobile number." });
      return z.NEVER;
    }
    return e164;
  });

// Strip control characters (keeping newlines in messages) before length checks.
const clean = (value: string) => value.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim();

export const patientNameSchema = z
  .string({ error: "Enter your full name." })
  .transform(clean)
  .pipe(
    z
      .string()
      .min(2, "Enter your full name.")
      .max(80, "Name must be 80 characters or fewer.")
      .regex(/^[\p{L}\p{M} .'-]+$/u, "Use letters, spaces, apostrophes, dots or hyphens only."),
  );

export const optionalEmailSchema = z
  .string()
  .trim()
  .max(120, "Email must be 120 characters or fewer.")
  .optional()
  .transform((v) => (v ? v.toLowerCase() : undefined))
  .pipe(z.email("Enter a valid email address, or leave it blank.").optional());

export const optionalMessageSchema = z
  .string()
  .optional()
  .transform((v) => (v ? clean(v) : undefined))
  .pipe(z.string().max(500, "Message must be 500 characters or fewer.").optional())
  .transform((v) => (v ? v : undefined));

export const serviceSlugSchema = z.string({ error: "Choose the type of visit." }).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Choose the type of visit.");

/** POST /api/public/appointments body (docs/API_DOCUMENTATION.md §1). */
export const appointmentRequestSchema = z.object({
  idempotencyKey: z.uuid(),
  patient: z.object({ name: patientNameSchema, phone: indianMobileSchema, email: optionalEmailSchema }),
  service: serviceSlugSchema,
  start: z.iso.datetime({ message: "Choose an available time." }),
  message: optionalMessageSchema,
  privacyAcknowledged: z.literal(true, { error: "Please confirm you have read the privacy notice." }),
  marketingOptIn: z.boolean().default(false),
  policyVersion: z.string().max(40),
  // Anti-spam signals: honeypot must stay empty; formStartedAt is ms since epoch.
  hp: z.string().max(200).optional().default(""),
  formStartedAt: z.number().int().nonnegative(),
  turnstileToken: z.string().max(2048).optional(),
});
export type AppointmentRequest = z.infer<typeof appointmentRequestSchema>;

/** Browser form fields (subset assembled into an AppointmentRequest on submit). */
export const bookingFormSchema = z.object({
  service: serviceSlugSchema,
  date: z.string({ error: "Choose a date." }).regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  start: z.string({ error: "Choose a time." }).min(1, "Choose a time."),
  name: patientNameSchema,
  phone: indianMobileSchema,
  email: optionalEmailSchema,
  message: optionalMessageSchema,
  privacyAcknowledged: z.boolean().refine((v) => v, { message: "Please confirm you have read the privacy notice." }),
  marketingOptIn: z.boolean(),
  hp: z.string(),
});
export type BookingFormInput = z.input<typeof bookingFormSchema>;
export type BookingFormValues = z.output<typeof bookingFormSchema>;

/** Accepts "nav-k7q2-m9xd-4t", "NAVK7Q2M9XD4T" or spaced variants; outputs canonical "NAV-K7Q2-M9XD-4T". */
export function normaliseReference(input: string): string | null {
  const compact = input.toUpperCase().replace(/[\s-]/g, "");
  const match = /^NAV([0-9A-HJKMNP-TV-Z]{10})$/.exec(compact);
  if (!match) return null;
  const c = match[1];
  return `NAV-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}

export const statusLookupSchema = z.object({
  reference: z
    .string({ error: "Enter your booking reference." })
    .transform((v, ctx) => {
      const ref = normaliseReference(v);
      if (!ref) {
        ctx.addIssue({ code: "custom", message: "Enter the reference exactly as shown, e.g. NAV-K7Q2-M9XD-4T." });
        return z.NEVER;
      }
      return ref;
    }),
  phone: indianMobileSchema,
});
export type StatusLookupInput = z.input<typeof statusLookupSchema>;

export const slotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  service: serviceSlugSchema,
});

export const availableDatesQuerySchema = z.object({
  service: serviceSlugSchema,
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  days: z.coerce.number().int().min(1).max(31).default(14),
});

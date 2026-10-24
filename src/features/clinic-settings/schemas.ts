import { z } from "zod";

import { WEEKDAYS } from "./types";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:mm");
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export const openingIntervalSchema = z
  .object({ open: time, close: time })
  .refine((i) => minutes(i.open) < minutes(i.close), { message: "Closing time must be after opening time", path: ["close"] });

/** A day's intervals must be in order and must not overlap; gaps are breaks. */
export const dayHoursSchema = z
  .array(openingIntervalSchema)
  .max(4)
  .superRefine((intervals, ctx) => {
    for (let i = 1; i < intervals.length; i++) {
      if (minutes(intervals[i].open) < minutes(intervals[i - 1].close)) {
        ctx.addIssue({ code: "custom", message: "Opening times must be in order and must not overlap", path: [i, "open"] });
      }
    }
  });

export const weeklyHoursSchema = z.object(Object.fromEntries(WEEKDAYS.map((d) => [d, dayHoursSchema])) as Record<(typeof WEEKDAYS)[number], typeof dayHoursSchema>);

const indianMobileE164 = z.string().regex(/^\+91[6-9]\d{9}$/, "Use an Indian mobile number in +91 format");
const httpsUrl = z.url({ protocol: /^https$/ }).max(500);

/** Editable clinic settings (admin form, seed). Mirrors docs/DATABASE_SCHEMA.md §1. */
export const clinicSettingsInputSchema = z
  .object({
    clinicName: z.string().trim().min(2).max(80),
    doctorName: z.string().trim().min(2).max(80),
    doctorCredentials: z.string().trim().max(200).default(""),
    doctorRegistrationNo: z.string().trim().max(60).default(""),
    phoneE164: indianMobileE164,
    whatsappEnabled: z.boolean().default(false),
    whatsappE164: indianMobileE164.optional(),
    email: z.email().max(120).optional(),
    address: z.object({
      line1: z.string().trim().min(2).max(120),
      line2: z.string().trim().max(120).optional(),
      locality: z.string().trim().min(2).max(80),
      district: z.string().trim().min(2).max(80),
      state: z.string().trim().min(2).max(80),
      postalCode: z.string().regex(/^\d{6}$/).optional(),
      country: z.literal("IN").default("IN"),
    }),
    geo: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
    mapUrl: httpsUrl.optional(),
    googleBusinessProfileUrl: httpsUrl.optional(),
    social: z
      .object({ facebook: httpsUrl.optional(), instagram: httpsUrl.optional(), youtube: httpsUrl.optional(), x: httpsUrl.optional() })
      .default({}),
    weeklyHours: weeklyHoursSchema,
    slotMinutes: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30), z.literal(45), z.literal(60)]).default(30),
    capacity: z.number().int().min(1).max(5).default(1),
    minNoticeMinutes: z.number().int().min(0).max(10_080).default(120),
    maxAdvanceDays: z.number().int().min(1).max(180).default(30),
    bookingMode: z.enum(["request", "instant"]).default("request"),
    bookingEnabled: z.boolean().default(true),
    notifications: z
      .object({
        staffEmails: z.array(z.email().max(120)).max(5).default([]),
        patientAck: z.boolean().default(true),
        patientStatusEmails: z.boolean().default(true),
        staffNewBooking: z.boolean().default(true),
        staffNewEnquiry: z.boolean().default(true),
      })
      .prefault({}),
    policies: z
      .object({
        cancellationText: z.string().max(1000).default(""),
        retentionMonthsAppointments: z.number().int().min(1).max(120).default(24),
        retentionMonthsEnquiries: z.number().int().min(1).max(120).default(12),
      })
      .prefault({}),
    legalPagesApproved: z.boolean().default(false),
    seo: z
      .object({
        defaultTitle: z.string().trim().max(60, "Keep the search title to 60 characters.").optional(),
        defaultDescription: z.string().trim().max(160, "Keep the search description to 160 characters.").optional(),
      })
      .prefault({}),
  });
// When WhatsApp is enabled without its own number, the booking phone is used (see toPublicSettings).

export type ClinicSettingsInput = z.infer<typeof clinicSettingsInputSchema>;

/**
 * Contact enquiry schemas shared by the browser form and the server.
 */
import { z } from "zod";

import { indianMobileSchema, optionalEmailSchema, patientNameSchema } from "@/features/appointments/schemas";
import { ENQUIRY_CATEGORIES, ENQUIRY_STATUSES } from "./constants";

export { ENQUIRY_CATEGORIES, ENQUIRY_STATUSES };
export type EnquiryCategory = (typeof ENQUIRY_CATEGORIES)[number];
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const ENQUIRY_CATEGORY_LABELS: Record<EnquiryCategory, string> = {
  general: "General question",
  appointment: "About an appointment",
  "treatment-info": "Information about a treatment",
  feedback: "Feedback",
  other: "Something else",
};

const clean = (value: string) => value.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim();

export const enquiryMessageSchema = z
  .string({ error: "Enter your message." })
  .transform(clean)
  .pipe(z.string().min(10, "Please write at least 10 characters.").max(2000, "Message must be 2000 characters or fewer."));

export const enquiryCategorySchema = z.enum(ENQUIRY_CATEGORIES, { error: "Choose what your enquiry is about." });

/** POST /api/public/enquiries body. */
export const enquiryRequestSchema = z.object({
  idempotencyKey: z.uuid(),
  name: patientNameSchema,
  phone: indianMobileSchema,
  email: optionalEmailSchema,
  category: enquiryCategorySchema,
  message: enquiryMessageSchema,
  privacyAcknowledged: z.literal(true, { error: "Please confirm you have read the privacy notice." }),
  hp: z.string().max(200).optional().default(""),
  formStartedAt: z.number().int().nonnegative(),
  turnstileToken: z.string().max(2048).optional(),
});
export type EnquiryRequest = z.infer<typeof enquiryRequestSchema>;

/** Browser form fields. */
export const enquiryFormSchema = z.object({
  name: patientNameSchema,
  phone: indianMobileSchema,
  email: optionalEmailSchema,
  category: z.string().refine((v): v is EnquiryCategory => (ENQUIRY_CATEGORIES as readonly string[]).includes(v), {
    message: "Choose what your enquiry is about.",
  }),
  message: enquiryMessageSchema,
  privacyAcknowledged: z.boolean().refine((v) => v, { message: "Please confirm you have read the privacy notice." }),
  hp: z.string(),
});
export type EnquiryFormInput = z.input<typeof enquiryFormSchema>;
export type EnquiryFormValues = z.output<typeof enquiryFormSchema>;

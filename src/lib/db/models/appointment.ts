import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "reschedule_requested",
  "completed",
  "cancelled",
  "rejected",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

const noteSchema = new Schema(
  { at: { type: Date, required: true }, by: { type: Schema.Types.ObjectId }, text: { type: String, required: true, maxlength: 1000 } },
  { _id: false },
);

const historySchema = new Schema(
  {
    at: { type: Date, required: true },
    by: { type: Schema.Types.ObjectId },
    from: { type: String, enum: APPOINTMENT_STATUSES },
    to: { type: String, enum: APPOINTMENT_STATUSES, required: true },
    action: { type: String, required: true, maxlength: 40 },
    note: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const appointmentSchema = new Schema(
  {
    reference: { type: String, required: true, match: /^NAV-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{2}$/ },
    patient: {
      name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
      phoneE164: { type: String, required: true, match: /^\+91[6-9]\d{9}$/ },
      email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    },
    serviceId: { type: Schema.Types.ObjectId, required: true },
    serviceTitle: { type: String, required: true, maxlength: 80 },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    localDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    resourceKey: { type: String, required: true, match: /^chair-[1-5]$/ },
    status: { type: String, required: true, enum: APPOINTMENT_STATUSES, default: "pending" },
    holdsSlot: { type: Boolean, required: true, default: true },
    message: { type: String, trim: true, maxlength: 500 },
    consent: {
      privacyAcknowledgedAt: { type: Date, required: true },
      marketingOptIn: { type: Boolean, default: false },
      policyVersion: { type: String, required: true, maxlength: 20 },
    },
    source: { type: String, required: true, enum: ["web", "admin", "phone"] },
    idempotencyKey: { type: String, match: /^[0-9a-f-]{36}$/i },
    internalNotes: { type: [noteSchema], default: [] },
    history: { type: [historySchema], default: [] },
    requestMeta: { ipHash: { type: String, maxlength: 64 }, userAgentHash: { type: String, maxlength: 64 } },
    createdBy: { type: Schema.Types.ObjectId },
  },
  { collection: "appointments", timestamps: true },
);

appointmentSchema.index({ reference: 1 }, { unique: true });
appointmentSchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true } } });
appointmentSchema.index({ start: 1, status: 1 });
appointmentSchema.index({ localDate: 1, status: 1 });
appointmentSchema.index({ status: 1, createdAt: -1 });
appointmentSchema.index({ "patient.phoneE164": 1, createdAt: -1 });

export type AppointmentDoc = InferSchemaType<typeof appointmentSchema>;
export const AppointmentModel: Model<AppointmentDoc> =
  (models.Appointment as Model<AppointmentDoc>) ?? model<AppointmentDoc>("Appointment", appointmentSchema);

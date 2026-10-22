import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const intervalSchema = new Schema(
  {
    open: { type: String, required: true, match: TIME },
    close: { type: String, required: true, match: TIME },
  },
  { _id: false },
);

const weekdayHours = { type: [intervalSchema], default: [] };

const clinicSettingsSchema = new Schema(
  {
    _id: { type: String, default: "default" },
    clinicName: { type: String, required: true, trim: true, maxlength: 80 },
    doctorName: { type: String, required: true, trim: true, maxlength: 80 },
    doctorCredentials: { type: String, trim: true, maxlength: 200, default: "" },
    doctorRegistrationNo: { type: String, trim: true, maxlength: 60, default: "" },
    phoneE164: { type: String, required: true, match: /^\+91[6-9]\d{9}$/ },
    whatsappEnabled: { type: Boolean, default: false },
    whatsappE164: { type: String, match: /^\+91[6-9]\d{9}$/ },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    address: {
      type: new Schema(
        {
          line1: { type: String, required: true, maxlength: 120 },
          line2: { type: String, maxlength: 120 },
          locality: { type: String, required: true, maxlength: 80 },
          district: { type: String, required: true, maxlength: 80 },
          state: { type: String, required: true, maxlength: 80 },
          postalCode: { type: String, match: /^\d{6}$/ },
          country: { type: String, enum: ["IN"], default: "IN" },
        },
        { _id: false },
      ),
      required: true,
    },
    geo: {
      type: new Schema({ lat: { type: Number, min: -90, max: 90, required: true }, lng: { type: Number, min: -180, max: 180, required: true } }, { _id: false }),
      default: undefined,
    },
    mapUrl: { type: String, maxlength: 500 },
    googleBusinessProfileUrl: { type: String, maxlength: 500 },
    social: {
      facebook: { type: String, maxlength: 300 },
      instagram: { type: String, maxlength: 300 },
      youtube: { type: String, maxlength: 300 },
      x: { type: String, maxlength: 300 },
    },
    weeklyHours: {
      mon: weekdayHours,
      tue: weekdayHours,
      wed: weekdayHours,
      thu: weekdayHours,
      fri: weekdayHours,
      sat: weekdayHours,
      sun: weekdayHours,
    },
    slotMinutes: { type: Number, enum: [10, 15, 20, 30, 45, 60], default: 30 },
    capacity: { type: Number, min: 1, max: 5, default: 1 },
    minNoticeMinutes: { type: Number, min: 0, max: 10_080, default: 120 },
    maxAdvanceDays: { type: Number, min: 1, max: 180, default: 30 },
    bookingMode: { type: String, enum: ["request", "instant"], default: "request" },
    bookingEnabled: { type: Boolean, default: true },
    notifications: {
      staffEmails: { type: [String], default: [] },
      patientAck: { type: Boolean, default: true },
      patientStatusEmails: { type: Boolean, default: true },
      staffNewBooking: { type: Boolean, default: true },
      staffNewEnquiry: { type: Boolean, default: true },
    },
    seo: {
      defaultTitle: { type: String, maxlength: 60 },
      defaultDescription: { type: String, maxlength: 160 },
      ogImageUrl: { type: String, maxlength: 500 },
    },
    policies: {
      cancellationText: { type: String, maxlength: 1000, default: "" },
      retentionMonthsAppointments: { type: Number, min: 1, max: 120, default: 24 },
      retentionMonthsEnquiries: { type: Number, min: 1, max: 120, default: 12 },
    },
    legalPagesApproved: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId },
    version: { type: Number, default: 1, min: 1 },
  },
  { collection: "clinic_settings", timestamps: true, minimize: false },
);

export type ClinicSettingsDoc = InferSchemaType<typeof clinicSettingsSchema>;

export const ClinicSettingsModel: Model<ClinicSettingsDoc> =
  (models.ClinicSettings as Model<ClinicSettingsDoc>) ?? model<ClinicSettingsDoc>("ClinicSettings", clinicSettingsSchema);

import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { ENQUIRY_CATEGORIES, ENQUIRY_STATUSES } from "@/features/enquiries/constants";

export { ENQUIRY_CATEGORIES, ENQUIRY_STATUSES };

const enquirySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    phoneE164: { type: String, required: true, match: /^\+91[6-9]\d{9}$/ },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    category: { type: String, required: true, enum: ENQUIRY_CATEGORIES },
    message: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    status: { type: String, required: true, enum: ENQUIRY_STATUSES, default: "new" },
    spam: {
      honeypot: { type: Boolean, default: false },
      fillMs: { type: Number, min: 0 },
      turnstile: { type: Boolean },
      score: { type: Number, default: 0 },
    },
    privacyAcknowledgedAt: { type: Date, required: true },
    idempotencyKey: { type: String, match: /^[0-9a-f-]{36}$/i },
    notes: {
      type: [new Schema({ at: { type: Date, required: true }, by: { type: Schema.Types.ObjectId }, text: { type: String, required: true, maxlength: 1000 } }, { _id: false })],
      default: [],
    },
    requestMeta: { ipHash: { type: String, maxlength: 64 } },
    spamExpiresAt: { type: Date },
  },
  { collection: "enquiries", timestamps: true },
);

enquirySchema.index({ status: 1, createdAt: -1 });
enquirySchema.index({ idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true } } });
enquirySchema.index({ phoneE164: 1, createdAt: -1 });
// Enquiries marked as spam delete themselves once spamExpiresAt passes.
enquirySchema.index({ spamExpiresAt: 1 }, { expireAfterSeconds: 0 });

export type EnquiryDoc = InferSchemaType<typeof enquirySchema>;
export const EnquiryModel: Model<EnquiryDoc> = (models.Enquiry as Model<EnquiryDoc>) ?? model<EnquiryDoc>("Enquiry", enquirySchema);

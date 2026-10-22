import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// ── notification_attempts ──────────────────────────────────────────────────
export const NOTIFICATION_KINDS = [
  "appointment_received",
  "appointment_confirmed",
  "appointment_rescheduled",
  "appointment_cancelled",
  "appointment_rejected",
  "staff_new_appointment",
  "staff_new_enquiry",
] as const;
export const NOTIFICATION_STATUSES = ["pending", "sent", "failed", "skipped_not_configured", "abandoned"] as const;

const notificationAttemptSchema = new Schema(
  {
    kind: { type: String, required: true, enum: NOTIFICATION_KINDS },
    channel: { type: String, required: true, enum: ["email", "sms", "whatsapp"], default: "email" },
    subjectType: { type: String, required: true, enum: ["appointment", "enquiry"] },
    subjectId: { type: Schema.Types.ObjectId, required: true },
    audience: { type: String, required: true, enum: ["patient", "staff"] },
    recipientMasked: { type: String, maxlength: 200 },
    status: { type: String, required: true, enum: NOTIFICATION_STATUSES, default: "pending" },
    attempts: { type: Number, default: 0, min: 0 },
    nextRetryAt: { type: Date },
    providerMessageId: { type: String, maxlength: 200 },
    lastError: { type: String, maxlength: 500 },
  },
  { collection: "notification_attempts", timestamps: true },
);
notificationAttemptSchema.index({ status: 1, nextRetryAt: 1 });
notificationAttemptSchema.index({ subjectType: 1, subjectId: 1 });

export type NotificationAttemptDoc = InferSchemaType<typeof notificationAttemptSchema>;
export const NotificationAttemptModel: Model<NotificationAttemptDoc> =
  (models.NotificationAttempt as Model<NotificationAttemptDoc>) ??
  model<NotificationAttemptDoc>("NotificationAttempt", notificationAttemptSchema);

// ── audit_logs (append-only) ───────────────────────────────────────────────
const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId },
    actorEmail: { type: String, maxlength: 120 },
    action: { type: String, required: true, maxlength: 60 },
    entity: { type: String, required: true, maxlength: 40 },
    entityId: { type: String, required: true, maxlength: 60 },
    changes: {
      type: [new Schema({ field: { type: String, required: true }, from: Schema.Types.Mixed, to: Schema.Types.Mixed }, { _id: false })],
      default: [],
    },
    ipHash: { type: String, maxlength: 64 },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { collection: "audit_logs" },
);
auditLogSchema.index({ entity: 1, entityId: 1, at: -1 });
auditLogSchema.index({ at: -1 });
auditLogSchema.index({ actorId: 1, at: -1 });
// Append-only: block updates and deletes through the model.
for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete", "replaceOne"] as const) {
  auditLogSchema.pre(op, function () {
    throw new Error("audit_logs is append-only");
  });
}

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;
export const AuditLogModel: Model<AuditLogDoc> = (models.AuditLog as Model<AuditLogDoc>) ?? model<AuditLogDoc>("AuditLog", auditLogSchema);

// ── rate_limits (fixed window counters, auto-expiring) ─────────────────────
const rateLimitSchema = new Schema(
  {
    key: { type: String, required: true, maxlength: 64 },
    windowStart: { type: Date, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: "rate_limits" },
);
rateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimitDoc = InferSchemaType<typeof rateLimitSchema>;
export const RateLimitModel: Model<RateLimitDoc> = (models.RateLimit as Model<RateLimitDoc>) ?? model<RateLimitDoc>("RateLimit", rateLimitSchema);

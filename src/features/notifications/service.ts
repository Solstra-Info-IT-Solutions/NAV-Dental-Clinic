import "server-only";

import { Types } from "mongoose";

import { addressOneLine } from "@/features/clinic-settings/format";
import { findSettings, toPublicSettings } from "@/features/clinic-settings/repository";
import { absoluteUrl } from "@/config/site";
import { AppointmentModel, NotificationAttemptModel, type AppointmentDoc, type ClinicSettingsDoc } from "@/lib/db/models";
import { logger, maskEmail } from "@/lib/logger";

import { EmailProviderError, getEmailProvider } from "./email-provider";
import { patientAppointmentEmail, staffNewAppointmentEmail, type AppointmentEvent, type RenderedEmail, type TemplateAppointment } from "./templates";

/** Delay before retry n (1-based). After the last entry the attempt is abandoned. */
export const RETRY_BACKOFF_MINUTES = [5, 30, 120, 720];
const MAX_ATTEMPTS = RETRY_BACKOFF_MINUTES.length + 1;

type Kind =
  | "appointment_received"
  | "appointment_confirmed"
  | "appointment_rescheduled"
  | "appointment_cancelled"
  | "appointment_rejected"
  | "staff_new_appointment"
  | "staff_new_enquiry";

const EVENT_KIND: Record<AppointmentEvent, Kind> = {
  received: "appointment_received",
  confirmed: "appointment_confirmed",
  rescheduled: "appointment_rescheduled",
  cancelled: "appointment_cancelled",
  rejected: "appointment_rejected",
};

type AppointmentWithId = AppointmentDoc & { _id: Types.ObjectId };

type Resolved = { to: string[]; email: RenderedEmail } | null;

function templateData(a: AppointmentWithId): TemplateAppointment {
  return {
    reference: a.reference,
    serviceTitle: a.serviceTitle,
    start: a.start,
    status: a.status,
    patientName: a.patient.name,
    patientPhoneE164: a.patient.phoneE164,
    message: a.message ?? undefined,
    source: a.source,
  };
}

function clinicData(settings: ClinicSettingsDoc) {
  const pub = toPublicSettings(settings);
  return { clinicName: pub.clinicName, phoneE164: pub.phoneE164, addressLine: addressOneLine(pub.address) };
}

/**
 * Rebuilds the message from current data at send time, so retries never send
 * stale details and recipient addresses are not duplicated into the log.
 */
async function resolveMessage(kind: Kind, subjectId: Types.ObjectId): Promise<Resolved> {
  const [appointment, settings] = await Promise.all([AppointmentModel.findById(subjectId).lean<AppointmentWithId>().exec(), findSettings()]);
  if (!appointment || !settings) return null;
  const clinic = clinicData(settings);
  if (kind === "staff_new_appointment") {
    const to = settings.notifications?.staffEmails ?? [];
    return to.length ? { to, email: staffNewAppointmentEmail(templateData(appointment), clinic, absoluteUrl("/admin/appointments")) } : null;
  }
  const event = (Object.keys(EVENT_KIND) as AppointmentEvent[]).find((e) => EVENT_KIND[e] === kind);
  if (!event || !appointment.patient.email) return null;
  return { to: [appointment.patient.email], email: patientAppointmentEmail(event, templateData(appointment), clinic) };
}

async function deliver(attemptId: Types.ObjectId): Promise<"sent" | "failed" | "skipped_not_configured" | "abandoned" | "skipped"> {
  const attempt = await NotificationAttemptModel.findById(attemptId).lean().exec();
  if (!attempt) return "skipped";

  const resolved = await resolveMessage(attempt.kind as Kind, attempt.subjectId);
  if (!resolved) {
    await NotificationAttemptModel.updateOne({ _id: attemptId }, { $set: { status: "abandoned", lastError: "Recipient or subject no longer available" }, $unset: { nextRetryAt: 1 } });
    return "abandoned";
  }

  const provider = getEmailProvider();
  if (!provider) {
    await NotificationAttemptModel.updateOne({ _id: attemptId }, { $set: { status: "skipped_not_configured" }, $unset: { nextRetryAt: 1 } });
    return "skipped_not_configured";
  }

  const attempts = attempt.attempts + 1;
  try {
    const { id } = await provider.send({ to: resolved.to, ...resolved.email });
    await NotificationAttemptModel.updateOne(
      { _id: attemptId },
      { $set: { status: "sent", attempts, providerMessageId: id }, $unset: { nextRetryAt: 1, lastError: 1 } },
    );
    return "sent";
  } catch (error) {
    const retryable = !(error instanceof EmailProviderError) || error.retryable;
    const delay = RETRY_BACKOFF_MINUTES[attempts - 1];
    const giveUp = !retryable || attempts >= MAX_ATTEMPTS || delay === undefined;
    await NotificationAttemptModel.updateOne(
      { _id: attemptId },
      {
        $set: {
          status: giveUp ? "abandoned" : "failed",
          attempts,
          lastError: (error instanceof Error ? error.message : "Unknown error").slice(0, 500),
          ...(giveUp ? {} : { nextRetryAt: new Date(Date.now() + delay * 60_000) }),
        },
        ...(giveUp ? { $unset: { nextRetryAt: 1 } } : {}),
      },
    );
    logger.warn("notification.failed", { attemptId: String(attemptId), kind: attempt.kind, attempts, giveUp, error });
    return giveUp ? "abandoned" : "failed";
  }
}

async function enqueue(kind: Kind, subjectId: Types.ObjectId, audience: "patient" | "staff", recipients: string[]) {
  const attempt = await NotificationAttemptModel.create({
    kind,
    channel: "email",
    subjectType: "appointment",
    subjectId,
    audience,
    recipientMasked: recipients.map(maskEmail).join(", ").slice(0, 200),
    status: "pending",
  });
  return deliver(attempt._id);
}

/**
 * Records and sends the notifications for an appointment event. Never throws:
 * a notification problem must not affect the booking, it is recorded instead.
 */
export async function notifyAppointmentEvent(appointmentId: Types.ObjectId | string, event: AppointmentEvent): Promise<void> {
  try {
    const id = new Types.ObjectId(String(appointmentId));
    const [appointment, settings] = await Promise.all([AppointmentModel.findById(id).lean<AppointmentWithId>().exec(), findSettings()]);
    if (!appointment || !settings) return;
    const prefs = settings.notifications;

    const patientWanted = event === "received" ? prefs?.patientAck !== false : prefs?.patientStatusEmails !== false;
    if (patientWanted && appointment.patient.email) await enqueue(EVENT_KIND[event], id, "patient", [appointment.patient.email]);

    const staff = prefs?.staffEmails ?? [];
    if (event === "received" && prefs?.staffNewBooking !== false && staff.length > 0) await enqueue("staff_new_appointment", id, "staff", staff);
  } catch (error) {
    logger.error("notification.enqueue_failed", { appointmentId: String(appointmentId), event, error });
  }
}

/** Retries failed attempts whose backoff has elapsed (cron). */
export async function processDueNotifications(now = new Date(), limit = 50) {
  const due = await NotificationAttemptModel.find({ status: "failed", nextRetryAt: { $lte: now } })
    .sort({ nextRetryAt: 1 })
    .limit(limit)
    .select({ _id: 1 })
    .lean()
    .exec();
  const totals = { processed: 0, sent: 0, failed: 0, abandoned: 0, skipped_not_configured: 0 };
  for (const { _id } of due) {
    const result = await deliver(_id);
    totals.processed++;
    if (result in totals) totals[result as keyof typeof totals]++;
  }
  return totals;
}

/** Manual retry from the admin dashboard (Phase 6). */
export async function retryNotification(attemptId: string) {
  if (!Types.ObjectId.isValid(attemptId)) return "skipped" as const;
  return deliver(new Types.ObjectId(attemptId));
}

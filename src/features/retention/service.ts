import "server-only";

import { recordAudit } from "@/features/audit/service";
import { findSettings } from "@/features/clinic-settings/repository";
import { AppointmentModel, EnquiryModel, NotificationAttemptModel, SlotHoldModel } from "@/lib/db/models";

export type PurgeSummary = {
  dryRun: boolean;
  appointmentCutoff: string;
  enquiryCutoff: string;
  appointments: number;
  enquiries: number;
  holds: number;
  notifications: number;
};

function monthsBefore(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

/**
 * Deletes personal data older than the clinic's retention periods
 * (Clinic settings → Policies). Appointments are judged by when they ended,
 * enquiries by when they arrived. Dry run unless `apply` is true; the deletion
 * itself is audited with counts only (no personal data).
 */
export async function purgeExpiredData(options: { apply: boolean; now?: Date }): Promise<PurgeSummary> {
  const settings = await findSettings();
  if (!settings) throw new Error("Clinic settings not found. Run npm run db:init first.");
  const now = options.now ?? new Date();
  const appointmentCutoff = monthsBefore(now, settings.policies?.retentionMonthsAppointments ?? 24);
  const enquiryCutoff = monthsBefore(now, settings.policies?.retentionMonthsEnquiries ?? 12);

  const appointmentIds = (await AppointmentModel.find({ end: { $lt: appointmentCutoff } }).select({ _id: 1 }).lean().exec()).map((a) => a._id);
  const enquiryIds = (await EnquiryModel.find({ createdAt: { $lt: enquiryCutoff } }).select({ _id: 1 }).lean().exec()).map((e) => e._id);

  const holdFilter = { holderType: "appointment" as const, holderId: { $in: appointmentIds } };
  const notificationFilter = {
    $or: [
      { subjectType: "appointment" as const, subjectId: { $in: appointmentIds } },
      { subjectType: "enquiry" as const, subjectId: { $in: enquiryIds } },
    ],
  };

  const summary: PurgeSummary = {
    dryRun: !options.apply,
    appointmentCutoff: appointmentCutoff.toISOString(),
    enquiryCutoff: enquiryCutoff.toISOString(),
    appointments: appointmentIds.length,
    enquiries: enquiryIds.length,
    holds: await SlotHoldModel.countDocuments(holdFilter),
    notifications: await NotificationAttemptModel.countDocuments(notificationFilter),
  };
  if (!options.apply || (appointmentIds.length === 0 && enquiryIds.length === 0)) return summary;

  await SlotHoldModel.deleteMany(holdFilter);
  await NotificationAttemptModel.deleteMany(notificationFilter);
  await AppointmentModel.deleteMany({ _id: { $in: appointmentIds } });
  await EnquiryModel.deleteMany({ _id: { $in: enquiryIds } });
  await recordAudit({
    actor: "system",
    action: "data.purged",
    entity: "retention",
    entityId: now.toISOString().slice(0, 10),
    changes: [
      { field: "appointments", to: summary.appointments },
      { field: "enquiries", to: summary.enquiries },
    ],
  });
  return summary;
}

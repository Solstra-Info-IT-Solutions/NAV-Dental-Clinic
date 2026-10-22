import "server-only";

import { Types } from "mongoose";
import { z } from "zod";

import type { AuditActor } from "@/features/audit/service";
import { AppointmentModel, EnquiryModel, NotificationAttemptModel, ServiceModel } from "@/lib/db/models";
import { AppError } from "@/lib/errors";
import { maskPhone } from "@/lib/logger";
import { addDays, formatLocalTime, isValidLocalDate, localDayBounds, toLocalDate } from "@/lib/time/ist";
import { toCsv } from "@/lib/csv";

import { dayAvailability, findBookableService, loadBookingRules, type BookableService } from "./availability";
import { indianMobileSchema, optionalEmailSchema, optionalMessageSchema, patientNameSchema } from "./schemas";
import { reserveAppointment, type StoredAppointment } from "./service";
import { APPOINTMENT_STATUSES_LIST, type AppointmentStatus } from "./status-machine";

const dateString = z.string().refine(isValidLocalDate, "Use a valid date (YYYY-MM-DD).");

export const appointmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(20),
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").filter(Boolean) : []))
    .pipe(z.array(z.enum(APPOINTMENT_STATUSES_LIST))),
  from: dateString.optional(),
  to: dateString.optional(),
  q: z.string().trim().max(60).optional(),
  sort: z.enum(["start", "-start", "-createdAt"]).default("start"),
});
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;

export type AppointmentSummary = {
  id: string;
  reference: string;
  patientName: string;
  phoneMasked: string;
  serviceTitle: string;
  start: string;
  status: AppointmentStatus;
  source: string;
  createdAt: string;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function toSummary(a: StoredAppointment): AppointmentSummary {
  return {
    id: String(a._id),
    reference: a.reference,
    patientName: a.patient.name,
    phoneMasked: maskPhone(a.patient.phoneE164),
    serviceTitle: a.serviceTitle,
    start: a.start.toISOString(),
    status: a.status,
    source: a.source,
    createdAt: a.createdAt.toISOString(),
  };
}

function listFilter(query: Pick<AppointmentListQuery, "status" | "from" | "to" | "q">): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (query.status.length) filter.status = { $in: query.status };
  if (query.from || query.to) {
    filter.localDate = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
  }
  if (query.q) {
    const term = query.q.trim();
    const digits = term.replace(/\D/g, "");
    filter.$or = [
      { reference: { $regex: escapeRegex(term.toUpperCase()) } },
      { "patient.name": { $regex: escapeRegex(term), $options: "i" } },
      ...(digits.length >= 4 ? [{ "patient.phoneE164": { $regex: escapeRegex(digits) } }] : []),
    ];
  }
  return filter;
}

const SORTS: Record<AppointmentListQuery["sort"], Record<string, 1 | -1>> = {
  start: { start: 1 },
  "-start": { start: -1 },
  "-createdAt": { createdAt: -1 },
};

export async function listAppointments(query: AppointmentListQuery) {
  const filter = listFilter(query);
  const [items, total] = await Promise.all([
    AppointmentModel.find(filter)
      .sort(SORTS[query.sort])
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .lean<StoredAppointment[]>()
      .exec(),
    AppointmentModel.countDocuments(filter),
  ]);
  return {
    items: items.map(toSummary),
    page: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) },
  };
}

export async function getAppointmentDetail(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new AppError("NOT_FOUND");
  const appointment = await AppointmentModel.findById(id).lean<StoredAppointment>().exec();
  if (!appointment) throw new AppError("NOT_FOUND");
  const notifications = await NotificationAttemptModel.find({ subjectType: "appointment", subjectId: appointment._id })
    .sort({ createdAt: -1 })
    .lean()
    .exec();
  return { appointment, notifications };
}

export async function addAppointmentNote(params: { appointmentId: string; text: string; actor: AuditActor }): Promise<void> {
  if (!Types.ObjectId.isValid(params.appointmentId)) throw new AppError("NOT_FOUND");
  const result = await AppointmentModel.updateOne(
    { _id: params.appointmentId },
    { $push: { internalNotes: { at: new Date(), by: params.actor !== "system" ? params.actor.id : undefined, text: params.text } } },
  );
  if (result.matchedCount === 0) throw new AppError("NOT_FOUND");
}

export const manualAppointmentSchema = z.object({
  patient: z.object({ name: patientNameSchema, phone: indianMobileSchema, email: optionalEmailSchema }),
  service: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Choose a service."),
  start: z.iso.datetime({ message: "Choose a time." }),
  message: optionalMessageSchema,
  source: z.enum(["phone", "admin"]).default("phone"),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
  notifyPatient: z.boolean().default(false),
  idempotencyKey: z.uuid().optional(),
});
export type ManualAppointmentInput = z.infer<typeof manualAppointmentSchema>;

/** Phone / walk-in booking by staff: same hold transaction; may ignore the minimum notice, never a held slot or closed time. */
export async function createManualAppointment(input: ManualAppointmentInput, actor: AuditActor) {
  const service = await findServiceForStaff(input.service);
  return reserveAppointment({
    service,
    start: new Date(input.start),
    patient: { name: input.patient.name, phoneE164: input.patient.phone, email: input.patient.email },
    message: input.message,
    // Consent to process the booking is given verbally to staff; marketing opt-in is never assumed.
    consent: { marketingOptIn: false, policyVersion: "staff-entry" },
    source: input.source,
    status: input.status,
    idempotencyKey: input.idempotencyKey,
    actor,
    ignoreMinNotice: true,
    now: new Date(),
  });
}

/** Staff may book any published service (bookable or not). */
async function findServiceForStaff(slug: string): Promise<BookableService> {
  const bookable = await findBookableService(slug);
  if (bookable) return bookable;
  const doc = await ServiceModel.findOne({ slug, published: true }).lean<{ _id: Types.ObjectId; slug: string; title: string; durationMinutes?: number }>();
  if (!doc) throw new AppError("VALIDATION_FAILED", { fields: { service: "Choose a published service." } });
  return { id: doc._id, slug: doc.slug, title: doc.title, durationMinutes: doc.durationMinutes ?? undefined };
}

/**
 * Free times for staff (minimum notice ignored). For rescheduling, pass the
 * appointment id: its own holds are ignored and its duration is reused.
 */
export async function staffSlots(params: { service?: string; date: string; excludeAppointmentId?: string }) {
  if (!isValidLocalDate(params.date)) throw new AppError("VALIDATION_FAILED", { fields: { date: "Use a valid date." } });
  const { rules } = await loadBookingRules();
  let duration: number | undefined;
  let exclude: Types.ObjectId | undefined;
  if (params.excludeAppointmentId) {
    if (!Types.ObjectId.isValid(params.excludeAppointmentId)) throw new AppError("NOT_FOUND");
    const existing = await AppointmentModel.findById(params.excludeAppointmentId).lean<StoredAppointment>();
    if (!existing) throw new AppError("NOT_FOUND");
    exclude = existing._id;
    duration = Math.round((existing.end.getTime() - existing.start.getTime()) / 60_000);
  } else if (params.service) {
    duration = (await findServiceForStaff(params.service)).durationMinutes;
  } else {
    throw new AppError("VALIDATION_FAILED", { fields: { service: "Choose a service." } });
  }
  const day = await dayAvailability({ rules, localDate: params.date, now: new Date(), durationMinutes: duration, excludeHolderId: exclude, ignoreMinNotice: true });
  return { date: day.date, closed: day.closed, slots: day.slots.map((s) => ({ start: s.start.toISOString(), label: formatLocalTime(s.start) })) };
}

export async function dashboardSummary(now = new Date()) {
  const today = toLocalDate(now);
  const [todayCounts, statusCounts, upcoming, recentEnquiries, failedNotifications, newEnquiries] = await Promise.all([
    AppointmentModel.aggregate<{ _id: string; n: number }>([{ $match: { localDate: today } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    AppointmentModel.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    AppointmentModel.find({ start: { $gte: now }, status: { $in: ["pending", "confirmed", "reschedule_requested"] } })
      .sort({ start: 1 })
      .limit(10)
      .lean<StoredAppointment[]>()
      .exec(),
    EnquiryModel.find({ status: { $ne: "spam" } }).sort({ createdAt: -1 }).limit(5).lean().exec(),
    NotificationAttemptModel.countDocuments({ status: { $in: ["failed", "abandoned"] } }),
    EnquiryModel.countDocuments({ status: "new" }),
  ]);
  const byStatus = (rows: { _id: string; n: number }[]) => Object.fromEntries(rows.map((r) => [r._id, r.n])) as Partial<Record<AppointmentStatus, number>>;
  const todayBy = byStatus(todayCounts);
  return {
    today: {
      date: today,
      total: Object.values(todayBy).reduce((a, b) => a + (b ?? 0), 0),
      pending: todayBy.pending ?? 0,
      confirmed: todayBy.confirmed ?? 0,
    },
    counts: byStatus(statusCounts),
    upcoming: upcoming.map(toSummary),
    recentEnquiries: recentEnquiries.map((e) => ({
      id: String(e._id),
      name: e.name,
      phoneMasked: maskPhone(e.phoneE164),
      category: e.category,
      status: e.status,
      createdAt: (e as unknown as { createdAt: Date }).createdAt.toISOString(),
    })),
    newEnquiries,
    failedNotifications,
  };
}

const MAX_EXPORT_DAYS = 92;

/** Minimal-field CSV for the owner (audited by the caller). */
export async function exportAppointmentsCsv(params: { from: string; to: string; status: AppointmentStatus[] }): Promise<string> {
  if (!isValidLocalDate(params.from) || !isValidLocalDate(params.to) || params.from > params.to) {
    throw new AppError("VALIDATION_FAILED", { fields: { from: "Choose a valid date range." } });
  }
  if (addDays(params.from, MAX_EXPORT_DAYS) < params.to) throw new AppError("VALIDATION_FAILED", { fields: { to: `Export at most ${MAX_EXPORT_DAYS} days at a time.` } });
  const docs = await AppointmentModel.find({
    start: { $gte: localDayBounds(params.from).start, $lt: localDayBounds(params.to).end },
    ...(params.status.length ? { status: { $in: params.status } } : {}),
  })
    .sort({ start: 1 })
    .lean<StoredAppointment[]>()
    .exec();
  return toCsv(
    ["Reference", "Date", "Time", "Service", "Patient name", "Mobile", "Status"],
    docs.map((a) => [a.reference, a.localDate, formatLocalTime(a.start), a.serviceTitle, a.patient.name, a.patient.phoneE164, a.status]),
  );
}

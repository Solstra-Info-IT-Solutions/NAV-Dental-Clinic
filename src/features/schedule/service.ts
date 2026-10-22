import "server-only";

import mongoose, { Types } from "mongoose";
import { z } from "zod";

import { toSummary } from "@/features/appointments/admin";
import { loadBookingRules, loadClosures } from "@/features/appointments/availability";
import type { StoredAppointment } from "@/features/appointments/service";
import { resourceKeys } from "@/features/appointments/slots";
import { recordAudit, type AuditActor } from "@/features/audit/service";
import { AppointmentModel, ClosureModel, SlotBlockModel, SlotHoldModel } from "@/lib/db/models";
import { AppError, isDuplicateKeyError } from "@/lib/errors";
import { addDays, daysBetween, formatLocalTime, fromLocal, isValidLocalDate, localDayBounds, minutesOf, timeOf, toLocalDate, toLocalTime, weekdayOf } from "@/lib/time/ist";

const MINUTE = 60_000;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
const date = z.string().refine(isValidLocalDate, "Use a valid date.");

// ── Day schedule ───────────────────────────────────────────────────────────

export type ScheduleCell = {
  start: string;
  label: string;
  resourceKey: string;
  state: "free" | "appointment" | "block" | "closed";
  appointment?: ReturnType<typeof toSummary>;
  block?: { id: string; reason: string };
};

export async function getScheduleDay(localDate: string) {
  if (!isValidLocalDate(localDate)) throw new AppError("VALIDATION_FAILED", { fields: { date: "Use a valid date." } });
  const { rules } = await loadBookingRules();
  const { start: dayStart, end: dayEnd } = localDayBounds(localDate);
  const [closures, holds] = await Promise.all([
    loadClosures(localDate, localDate),
    SlotHoldModel.find({ start: { $gte: dayStart, $lt: dayEnd } }).lean().exec(),
  ]);
  const appointmentIds = holds.filter((h) => h.holderType === "appointment").map((h) => h.holderId);
  const blockIds = holds.filter((h) => h.holderType === "block").map((h) => h.holderId);
  const [appointments, blocks] = await Promise.all([
    AppointmentModel.find({ _id: { $in: appointmentIds } }).lean<StoredAppointment[]>().exec(),
    SlotBlockModel.find({ _id: { $in: blockIds } }).lean().exec(),
  ]);
  const apptById = new Map(appointments.map((a) => [String(a._id), toSummary(a)]));
  const blockById = new Map(blocks.map((b) => [String(b._id), { id: String(b._id), reason: b.reason }]));
  const holdAt = new Map(holds.map((h) => [`${h.resourceKey}|${h.start.getTime()}`, h]));

  const fullDayClosure = closures.find((c) => c.allDay);
  const partial = closures.filter((c) => !c.allDay && c.startTime && c.endTime).map((c) => ({ from: minutesOf(c.startTime!), to: minutesOf(c.endTime!) }));
  const intervals = rules.weeklyHours[weekdayOf(localDate)] ?? [];
  const cells: ScheduleCell[] = [];

  for (const interval of intervals) {
    for (let t = minutesOf(interval.open); t + rules.slotMinutes <= minutesOf(interval.close); t += rules.slotMinutes) {
      const start = fromLocal(localDate, timeOf(t));
      for (const resourceKey of resourceKeys(rules.capacity)) {
        const hold = holdAt.get(`${resourceKey}|${start.getTime()}`);
        const closed = Boolean(fullDayClosure) || partial.some((p) => t < p.to && t + rules.slotMinutes > p.from);
        const cell: ScheduleCell = { start: start.toISOString(), label: formatLocalTime(start), resourceKey, state: "free" };
        if (hold?.holderType === "appointment") Object.assign(cell, { state: "appointment", appointment: apptById.get(String(hold.holderId)) });
        else if (hold?.holderType === "block") Object.assign(cell, { state: "block", block: blockById.get(String(hold.holderId)) });
        else if (closed) cell.state = "closed";
        cells.push(cell);
      }
    }
  }
  // Holds outside current opening hours (e.g. after hours were changed) are still shown.
  for (const hold of holds) {
    if (!cells.some((c) => c.resourceKey === hold.resourceKey && c.start === hold.start.toISOString())) {
      cells.push({
        start: hold.start.toISOString(),
        label: formatLocalTime(hold.start),
        resourceKey: hold.resourceKey,
        state: hold.holderType === "appointment" ? "appointment" : "block",
        appointment: apptById.get(String(hold.holderId)),
        block: blockById.get(String(hold.holderId)),
      });
    }
  }
  cells.sort((a, b) => a.start.localeCompare(b.start) || a.resourceKey.localeCompare(b.resourceKey));
  return { date: localDate, weekday: weekdayOf(localDate), capacity: rules.capacity, slotMinutes: rules.slotMinutes, closedAllDay: Boolean(fullDayClosure) || intervals.length === 0, closures, cells };
}

// ── Manual slot blocks ─────────────────────────────────────────────────────

export const slotBlockSchema = z
  .object({ date, startTime: time, endTime: time, resourceKey: z.string().regex(/^(chair-[1-5]|all)$/), reason: z.string().trim().min(2, "Give a short reason.").max(120) })
  .refine((v) => minutesOf(v.startTime) < minutesOf(v.endTime), { message: "End must be after start.", path: ["endTime"] });

export async function createSlotBlock(input: z.infer<typeof slotBlockSchema>, actor: AuditActor) {
  const { rules } = await loadBookingRules();
  const startMin = minutesOf(input.startTime);
  const endMin = minutesOf(input.endTime);
  if (startMin % rules.slotMinutes || endMin % rules.slotMinutes) {
    throw new AppError("VALIDATION_FAILED", { fields: { startTime: `Times must line up with the ${rules.slotMinutes}-minute grid.` } });
  }
  if (endMin - startMin > 12 * 60) throw new AppError("VALIDATION_FAILED", { fields: { endTime: "Block at most 12 hours at a time; use a closure for whole days." } });
  const start = fromLocal(input.date, input.startTime);
  const end = fromLocal(input.date, input.endTime);
  if (end.getTime() <= Date.now()) throw new AppError("VALIDATION_FAILED", { fields: { date: "That time has already passed." } });

  const chairs = input.resourceKey === "all" ? resourceKeys(rules.capacity) : [input.resourceKey];
  const starts: Date[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += rules.slotMinutes * MINUTE) starts.push(new Date(t));

  const session = await mongoose.startSession();
  try {
    let blockId: Types.ObjectId | undefined;
    await session.withTransaction(async () => {
      const [block] = await SlotBlockModel.create([{ start, end, resourceKey: input.resourceKey, reason: input.reason, createdBy: actor !== "system" ? actor.id : undefined }], { session });
      await SlotHoldModel.insertMany(
        chairs.flatMap((resourceKey) => starts.map((s) => ({ resourceKey, start: s, holderType: "block", holderId: block._id }))),
        { session },
      );
      await recordAudit({ actor, action: "slot_block.created", entity: "slot_block", entityId: String(block._id), changes: [{ field: "range", to: `${input.date} ${input.startTime}-${input.endTime} ${input.resourceKey}` }] }, session);
      blockId = block._id;
    });
    return { id: String(blockId) };
  } catch (error) {
    if (!isDuplicateKeyError(error, "resourceKey")) throw error;
    const conflicts = await AppointmentModel.find({ holdsSlot: true, start: { $lt: end }, end: { $gt: start }, resourceKey: { $in: chairs } }).lean<StoredAppointment[]>().exec();
    throw new AppError("SLOT_UNAVAILABLE", { message: "Part of that time is already booked or blocked.", details: { conflicts: conflicts.map(toSummary) } });
  } finally {
    await session.endSession();
  }
}

export async function deleteSlotBlock(id: string, actor: AuditActor): Promise<void> {
  if (!Types.ObjectId.isValid(id)) throw new AppError("NOT_FOUND");
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const block = await SlotBlockModel.findByIdAndDelete(id, { session }).lean().exec();
      if (!block) throw new AppError("NOT_FOUND");
      await SlotHoldModel.deleteMany({ holderType: "block", holderId: block._id }, { session });
      await recordAudit({ actor, action: "slot_block.deleted", entity: "slot_block", entityId: id }, session);
    });
  } finally {
    await session.endSession();
  }
}

// ── Closures (holidays) ────────────────────────────────────────────────────

export const closureSchema = z
  .object({
    startDate: date,
    endDate: date,
    allDay: z.boolean(),
    startTime: time.optional(),
    endTime: time.optional(),
    reason: z.string().trim().min(2, "Give a short reason.").max(120),
    publicNote: z.string().trim().max(120).optional(),
  })
  .refine((v) => v.startDate <= v.endDate, { message: "End date must be on or after the start date.", path: ["endDate"] })
  .refine((v) => daysBetween(v.startDate, v.endDate) <= 60, { message: "A closure can cover at most 60 days.", path: ["endDate"] })
  .refine((v) => v.allDay || (v.startTime && v.endTime && minutesOf(v.startTime) < minutesOf(v.endTime)), {
    message: "Give a start and end time for a partial-day closure.",
    path: ["startTime"],
  });

export async function listClosures(fromDate = toLocalDate(new Date())) {
  const docs = await ClosureModel.find({ endDate: { $gte: fromDate } }).sort({ startDate: 1 }).lean().exec();
  return docs.map((c) => ({ id: String(c._id), startDate: c.startDate, endDate: c.endDate, allDay: c.allDay, startTime: c.startTime ?? undefined, endTime: c.endTime ?? undefined, reason: c.reason, publicNote: c.publicNote ?? undefined }));
}

/**
 * Closures never cancel appointments automatically. Active appointments that
 * fall inside the closure are returned so staff can contact those patients.
 */
export async function createClosure(input: z.infer<typeof closureSchema>, actor: AuditActor) {
  const doc = await ClosureModel.create({ ...input, startTime: input.allDay ? undefined : input.startTime, endTime: input.allDay ? undefined : input.endTime, createdBy: actor !== "system" ? actor.id : undefined });
  await recordAudit({ actor, action: "closure.created", entity: "closure", entityId: String(doc._id), changes: [{ field: "dates", to: `${input.startDate}..${input.endDate}` }] });

  const candidates = await AppointmentModel.find({
    holdsSlot: true,
    status: { $in: ["pending", "confirmed", "reschedule_requested"] },
    localDate: { $gte: input.startDate, $lte: input.endDate },
  })
    .sort({ start: 1 })
    .lean<StoredAppointment[]>()
    .exec();
  const affected = input.allDay
    ? candidates
    : candidates.filter((a) => {
        const s = minutesOf(toLocalTime(a.start));
        const e = s + Math.round((a.end.getTime() - a.start.getTime()) / MINUTE);
        return s < minutesOf(input.endTime!) && e > minutesOf(input.startTime!);
      });
  return { id: String(doc._id), affectedAppointments: affected.map(toSummary) };
}

export async function deleteClosure(id: string, actor: AuditActor): Promise<void> {
  if (!Types.ObjectId.isValid(id)) throw new AppError("NOT_FOUND");
  const doc = await ClosureModel.findByIdAndDelete(id).lean().exec();
  if (!doc) throw new AppError("NOT_FOUND");
  await recordAudit({ actor, action: "closure.deleted", entity: "closure", entityId: id, changes: [{ field: "dates", from: `${doc.startDate}..${doc.endDate}` }] });
}

export function nextDays(fromDate: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(fromDate, i));
}

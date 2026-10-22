import "server-only";

import { timingSafeEqual } from "node:crypto";

import mongoose, { Types, type ClientSession } from "mongoose";

import { recordAudit, type AuditActor } from "@/features/audit/service";
import { AppointmentModel, SlotHoldModel, type AppointmentDoc } from "@/lib/db/models";
import { AppError, isDuplicateKeyError } from "@/lib/errors";
import { logger, maskPhone } from "@/lib/logger";
import { addDays, daysBetween, formatLocalTime, toLocalDate } from "@/lib/time/ist";

import {
  dayAvailability,
  findBookableService,
  hasAnyOpeningHours,
  loadBookingRules,
  loadClosures,
  rangeAvailability,
  type BookableService,
} from "./availability";
import { generateReference } from "./reference";
import type { AppointmentRequest } from "./schemas";
import { computeDayAvailability, coveredStarts, type BookingRules } from "./slots";
import { canReschedule, checkTransition, holdsSlot, type AppointmentStatus } from "./status-machine";

export type StoredAppointment = AppointmentDoc & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

export type CreateResult = { appointment: StoredAppointment; replayed: boolean };

export type SlotSuggestion = { start: string; label: string; date: string };

const MAX_REFERENCE_ATTEMPTS = 3;
const MAX_CHAIR_ATTEMPTS = 3;

async function findByIdempotencyKey(key: string): Promise<StoredAppointment | null> {
  return AppointmentModel.findOne({ idempotencyKey: key }).lean<StoredAppointment>().exec();
}

/** Up to `limit` bookable times from `fromDate` onwards (same day first), for 409 responses. */
export async function suggestAlternatives(rules: BookingRules, service: BookableService, fromDate: string, now: Date, limit = 5): Promise<SlotSuggestion[]> {
  const days = await rangeAvailability({ rules, fromDate, days: 7, now, durationMinutes: service.durationMinutes });
  return days
    .flatMap((d) => d.slots.map((s) => ({ start: s.start.toISOString(), label: formatLocalTime(s.start), date: d.date })))
    .slice(0, limit);
}

type ReserveInput = {
  service: BookableService;
  start: Date;
  patient: { name: string; phoneE164: string; email?: string };
  message?: string;
  consent: { marketingOptIn: boolean; policyVersion: string };
  source: "web" | "admin" | "phone";
  status: "pending" | "confirmed";
  idempotencyKey?: string;
  requestMeta?: { ipHash?: string; userAgentHash?: string };
  actor?: AuditActor;
  ignoreMinNotice?: boolean;
  now: Date;
};

/**
 * Core reservation: re-validates the slot against live rules and holds, then
 * inserts the slot holds and the appointment in ONE transaction. The unique
 * {resourceKey,start} index guarantees only one transaction can hold a slot;
 * the losing request receives 409 SLOT_UNAVAILABLE with alternatives.
 */
export async function reserveAppointment(input: ReserveInput): Promise<CreateResult> {
  const { rules } = await loadBookingRules();
  const localDate = toLocalDate(input.start);
  const duration = input.service.durationMinutes ?? rules.slotMinutes;

  if (input.idempotencyKey) {
    const existing = await findByIdempotencyKey(input.idempotencyKey);
    if (existing) return { appointment: existing, replayed: true };
  }

  for (let chairAttempt = 0; chairAttempt < MAX_CHAIR_ATTEMPTS; chairAttempt++) {
    const day = await dayAvailability({ rules, localDate, now: input.now, durationMinutes: duration, ignoreMinNotice: input.ignoreMinNotice });
    const slot = day.slots.find((s) => s.start.getTime() === input.start.getTime());

    if (!slot) {
      // Distinguish "taken by someone else" (409) from "never a valid time" (422).
      const ignoringHolds = await validWithoutHolds(rules, localDate, input, duration);
      if (ignoringHolds) {
        throw new AppError("SLOT_UNAVAILABLE", { details: { alternatives: await suggestAlternatives(rules, input.service, localDate, input.now) } });
      }
      throw new AppError("VALIDATION_FAILED", { fields: { start: "That time is not available. Please choose one of the times shown." } });
    }

    for (let refAttempt = 0; refAttempt < MAX_REFERENCE_ATTEMPTS; refAttempt++) {
      try {
        const appointment = await insertWithHolds(input, slot.resourceKey, slot.end, localDate, duration, rules.slotMinutes);
        logger.info("appointment.created", { appointmentId: String(appointment._id), source: input.source, phone: maskPhone(input.patient.phoneE164) });
        return { appointment, replayed: false };
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        if (input.idempotencyKey) {
          // A concurrent duplicate submission with the same key won the race: replay it.
          const existing = await findByIdempotencyKey(input.idempotencyKey);
          if (existing) return { appointment: existing, replayed: true };
        }
        if (isDuplicateKeyError(error, "reference")) continue; // astronomically rare: draw a new reference
        if (isDuplicateKeyError(error, "resourceKey")) break; // slot taken concurrently: re-check other chairs
        throw error;
      }
    }
  }

  throw new AppError("SLOT_UNAVAILABLE", { details: { alternatives: await suggestAlternatives(rules, input.service, localDate, input.now) } });
}

async function validWithoutHolds(rules: BookingRules, localDate: string, input: ReserveInput, duration: number): Promise<boolean> {
  const closures = await loadClosures(localDate, localDate);
  const free = computeDayAvailability({ rules, localDate, now: input.now, closures, holds: [], durationMinutes: duration, ignoreMinNotice: input.ignoreMinNotice });
  return free.slots.some((s) => s.start.getTime() === input.start.getTime());
}

async function insertWithHolds(
  input: ReserveInput,
  resourceKey: string,
  end: Date,
  localDate: string,
  duration: number,
  slotMinutes: number,
): Promise<StoredAppointment> {
  const session = await mongoose.startSession();
  try {
    let created: StoredAppointment | undefined;
    await session.withTransaction(async () => {
      const _id = new Types.ObjectId();
      const now = new Date();
      await SlotHoldModel.insertMany(
        coveredStarts(input.start, duration, slotMinutes).map((start) => ({ resourceKey, start, holderType: "appointment", holderId: _id })),
        { session },
      );
      const [doc] = await AppointmentModel.create(
        [
          {
            _id,
            reference: generateReference(),
            patient: input.patient,
            serviceId: input.service.id,
            serviceTitle: input.service.title,
            start: input.start,
            end,
            localDate,
            resourceKey,
            status: input.status,
            holdsSlot: true,
            message: input.message,
            consent: { privacyAcknowledgedAt: now, marketingOptIn: input.consent.marketingOptIn, policyVersion: input.consent.policyVersion },
            source: input.source,
            idempotencyKey: input.idempotencyKey,
            history: [{ at: now, to: input.status, action: input.source === "web" ? "requested_online" : "created_by_staff" }],
            requestMeta: input.requestMeta,
            createdBy: input.actor && input.actor !== "system" ? input.actor.id : undefined,
          },
        ],
        { session },
      );
      if (input.source !== "web" && input.actor) {
        await recordAudit({ actor: input.actor, action: "appointment.created", entity: "appointment", entityId: String(_id) }, session);
      }
      created = doc.toObject() as StoredAppointment;
    });
    if (!created) throw new Error("Transaction finished without creating the appointment");
    return created;
  } finally {
    await session.endSession();
  }
}

/** Public web booking: settings decide whether the request is pending or confirmed. */
export async function createWebAppointment(
  request: AppointmentRequest,
  meta: { ipHash?: string; userAgentHash?: string; now?: Date },
): Promise<CreateResult> {
  const now = meta.now ?? new Date();
  const { rules, settings } = await loadBookingRules();
  if (!rules.bookingEnabled || !hasAnyOpeningHours(rules)) throw new AppError("BOOKING_DISABLED");

  const service = await findBookableService(request.service);
  if (!service) throw new AppError("VALIDATION_FAILED", { fields: { service: "Choose one of the listed visit types." } });

  return reserveAppointment({
    service,
    start: new Date(request.start),
    patient: { name: request.patient.name, phoneE164: request.patient.phone, email: request.patient.email },
    message: request.message,
    consent: { marketingOptIn: request.marketingOptIn, policyVersion: request.policyVersion },
    source: "web",
    status: settings.bookingMode === "instant" ? "confirmed" : "pending",
    idempotencyKey: request.idempotencyKey,
    requestMeta: { ipHash: meta.ipHash, userAgentHash: meta.userAgentHash },
    now,
  });
}

async function withSession<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

/**
 * Status change with the transition table enforced server-side. Releasing
 * statuses delete the slot holds in the same transaction.
 */
export async function changeAppointmentStatus(params: {
  appointmentId: string;
  to: AppointmentStatus;
  actor: AuditActor;
  note?: string;
  now?: Date;
}): Promise<StoredAppointment> {
  if (!Types.ObjectId.isValid(params.appointmentId)) throw new AppError("NOT_FOUND");
  const now = params.now ?? new Date();

  return withSession(async (session) => {
    const current = await AppointmentModel.findById(params.appointmentId).session(session).lean<StoredAppointment>().exec();
    if (!current) throw new AppError("NOT_FOUND");
    const check = checkTransition(current.status, params.to, { start: current.start, now });
    if (!check.ok) throw new AppError("INVALID_TRANSITION", { message: check.reason });

    const keepsHold = holdsSlot(params.to);
    const updated = await AppointmentModel.findOneAndUpdate(
      { _id: current._id, status: current.status },
      {
        $set: { status: params.to, holdsSlot: keepsHold },
        $push: {
          history: { at: now, by: params.actor !== "system" ? params.actor.id : undefined, from: current.status, to: params.to, action: "status_changed", note: params.note },
        },
      },
      { session, returnDocument: "after" },
    )
      .lean<StoredAppointment>()
      .exec();
    if (!updated) throw new AppError("CONFLICT", { message: "The appointment was changed by someone else. Reload and try again." });

    if (!keepsHold && current.holdsSlot) {
      await SlotHoldModel.deleteMany({ holderType: "appointment", holderId: current._id }, { session });
    }
    await recordAudit(
      { actor: params.actor, action: "appointment.status_changed", entity: "appointment", entityId: String(current._id), changes: [{ field: "status", from: current.status, to: params.to }] },
      session,
    );
    return updated;
  });
}

/**
 * Moves an appointment to a new start: new holds in, old holds out, times
 * updated — all in one transaction, so neither both nor neither slot is held.
 */
export async function rescheduleAppointment(params: {
  appointmentId: string;
  start: Date;
  actor: AuditActor;
  note?: string;
  now?: Date;
}): Promise<StoredAppointment> {
  if (!Types.ObjectId.isValid(params.appointmentId)) throw new AppError("NOT_FOUND");
  const now = params.now ?? new Date();
  const appointmentId = new Types.ObjectId(params.appointmentId);

  const current = await AppointmentModel.findById(appointmentId).lean<StoredAppointment>().exec();
  if (!current) throw new AppError("NOT_FOUND");
  if (!canReschedule(current.status)) throw new AppError("INVALID_TRANSITION", { message: `A ${current.status} appointment cannot be rescheduled.` });

  const { rules } = await loadBookingRules();
  const duration = Math.round((current.end.getTime() - current.start.getTime()) / 60_000);
  const localDate = toLocalDate(params.start);
  const day = await dayAvailability({ rules, localDate, now, durationMinutes: duration, excludeHolderId: appointmentId, ignoreMinNotice: true });
  const slot = day.slots.find((s) => s.start.getTime() === params.start.getTime());
  if (!slot) throw new AppError("SLOT_UNAVAILABLE", { message: "That time is not available. Choose another time." });

  try {
    return await withSession(async (session) => {
      await SlotHoldModel.deleteMany({ holderType: "appointment", holderId: appointmentId }, { session });
      await SlotHoldModel.insertMany(
        coveredStarts(params.start, duration, rules.slotMinutes).map((start) => ({ resourceKey: slot.resourceKey, start, holderType: "appointment", holderId: appointmentId })),
        { session },
      );
      const updated = await AppointmentModel.findOneAndUpdate(
        { _id: appointmentId, status: current.status },
        {
          $set: { start: params.start, end: slot.end, localDate, resourceKey: slot.resourceKey, status: "confirmed", holdsSlot: true },
          $push: {
            history: { at: now, by: params.actor !== "system" ? params.actor.id : undefined, from: current.status, to: "confirmed", action: "rescheduled", note: params.note },
          },
        },
        { session, returnDocument: "after" },
      )
        .lean<StoredAppointment>()
        .exec();
      if (!updated) throw new AppError("CONFLICT", { message: "The appointment was changed by someone else. Reload and try again." });
      await recordAudit(
        {
          actor: params.actor,
          action: "appointment.rescheduled",
          entity: "appointment",
          entityId: String(appointmentId),
          changes: [{ field: "start", from: current.start.toISOString(), to: params.start.toISOString() }],
        },
        session,
      );
      return updated;
    });
  } catch (error) {
    if (isDuplicateKeyError(error, "resourceKey")) throw new AppError("SLOT_UNAVAILABLE", { message: "That time was just taken. Choose another time." });
    throw error;
  }
}

/** Constant-time string comparison (avoids leaking how many characters matched). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export type PublicStatus = { reference: string; status: AppointmentStatus; serviceTitle: string; start: string };

/**
 * Public status lookup. Requires reference AND the mobile number used to
 * book; any mismatch returns the same NOT_FOUND as an unknown reference.
 */
export async function lookupAppointmentStatus(reference: string, phoneE164: string): Promise<PublicStatus> {
  const doc = await AppointmentModel.findOne({ reference })
    .select({ reference: 1, status: 1, serviceTitle: 1, start: 1, "patient.phoneE164": 1 })
    .lean<StoredAppointment>()
    .exec();
  const stored = doc?.patient.phoneE164 ?? "+910000000000";
  if (!doc || !safeEqual(stored, phoneE164)) throw new AppError("NOT_FOUND", { message: "We could not find a booking with that reference and mobile number." });
  return { reference: doc.reference, status: doc.status, serviceTitle: doc.serviceTitle, start: doc.start.toISOString() };
}

/** Days within the next `days` (from today IST by default) with at least one free slot. */
export async function availableDates(serviceSlug: string, options: { from?: string; days: number; now?: Date }) {
  const now = options.now ?? new Date();
  const { rules } = await loadBookingRules();
  if (!rules.bookingEnabled || !hasAnyOpeningHours(rules)) throw new AppError("BOOKING_DISABLED");
  const service = await findBookableService(serviceSlug);
  if (!service) throw new AppError("VALIDATION_FAILED", { fields: { service: "Choose one of the listed visit types." } });

  const today = toLocalDate(now);
  const from = options.from && options.from > today ? options.from : today;
  const lastAllowed = addDays(today, rules.maxAdvanceDays);
  const days = Math.max(0, Math.min(options.days, daysBetween(from, lastAllowed) + 1));
  const result = days === 0 ? [] : await rangeAvailability({ rules, fromDate: from, days, now, durationMinutes: service.durationMinutes });
  return { from, lastAllowed, dates: result.map((d) => ({ date: d.date, available: d.slots.length > 0 })) };
}

/** Free start times for one clinic day. */
export async function availableSlots(serviceSlug: string, localDate: string, now = new Date()) {
  const { rules } = await loadBookingRules();
  if (!rules.bookingEnabled || !hasAnyOpeningHours(rules)) throw new AppError("BOOKING_DISABLED");
  const service = await findBookableService(serviceSlug);
  if (!service) throw new AppError("VALIDATION_FAILED", { fields: { service: "Choose one of the listed visit types." } });
  const day = await dayAvailability({ rules, localDate, now, durationMinutes: service.durationMinutes });
  return {
    date: day.date,
    timezone: "Asia/Kolkata",
    closed: day.closed,
    slots: day.slots.map((s) => ({ start: s.start.toISOString(), label: formatLocalTime(s.start) })),
  };
}

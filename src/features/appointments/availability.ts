import "server-only";

import type { Types } from "mongoose";

import { findSettings } from "@/features/clinic-settings/repository";
import type { ClinicSettingsDoc } from "@/lib/db/models";
import { ClosureModel, ServiceModel, SlotHoldModel, type ServiceDoc } from "@/lib/db/models";
import { AppError } from "@/lib/errors";
import { addDays, localDayBounds } from "@/lib/time/ist";

import { computeDayAvailability, type BookingRules, type ClosureRule, type DayAvailability, type HeldSlot } from "./slots";

export type BookableService = { id: Types.ObjectId; slug: string; title: string; durationMinutes?: number };

/** Live booking rules straight from the database (never from a page cache). */
export async function loadBookingRules(): Promise<{ rules: BookingRules; settings: ClinicSettingsDoc }> {
  const settings = await findSettings();
  if (!settings) throw new AppError("BOOKING_DISABLED", { message: "Online booking has not been set up yet. Please call the clinic." });
  const rules: BookingRules = {
    weeklyHours: {
      mon: settings.weeklyHours?.mon ?? [],
      tue: settings.weeklyHours?.tue ?? [],
      wed: settings.weeklyHours?.wed ?? [],
      thu: settings.weeklyHours?.thu ?? [],
      fri: settings.weeklyHours?.fri ?? [],
      sat: settings.weeklyHours?.sat ?? [],
      sun: settings.weeklyHours?.sun ?? [],
    },
    slotMinutes: settings.slotMinutes,
    capacity: settings.capacity,
    minNoticeMinutes: settings.minNoticeMinutes,
    maxAdvanceDays: settings.maxAdvanceDays,
    bookingEnabled: settings.bookingEnabled,
  };
  return { rules, settings };
}

export function hasAnyOpeningHours(rules: BookingRules): boolean {
  return Object.values(rules.weeklyHours).some((day) => day.length > 0);
}

export async function findBookableService(slug: string): Promise<BookableService | null> {
  const doc = await ServiceModel.findOne({ slug, published: true, bookable: true }).lean<ServiceDoc & { _id: Types.ObjectId }>().exec();
  return doc ? { id: doc._id, slug: doc.slug, title: doc.title, durationMinutes: doc.durationMinutes ?? undefined } : null;
}

export async function loadClosures(fromDate: string, toDate: string): Promise<ClosureRule[]> {
  const docs = await ClosureModel.find({ startDate: { $lte: toDate }, endDate: { $gte: fromDate } }).lean().exec();
  return docs.map((c) => ({
    startDate: c.startDate,
    endDate: c.endDate,
    allDay: c.allDay,
    startTime: c.startTime ?? undefined,
    endTime: c.endTime ?? undefined,
  }));
}

/** Holds between the start of `fromDate` and the end of `toDate` (IST), optionally excluding one holder. */
export async function loadHolds(fromDate: string, toDate: string, excludeHolderId?: Types.ObjectId): Promise<HeldSlot[]> {
  const docs = await SlotHoldModel.find({
    start: { $gte: localDayBounds(fromDate).start, $lt: localDayBounds(toDate).end },
    ...(excludeHolderId ? { holderId: { $ne: excludeHolderId } } : {}),
  })
    .select({ resourceKey: 1, start: 1 })
    .lean()
    .exec();
  return docs.map((h) => ({ resourceKey: h.resourceKey, start: h.start }));
}

export async function dayAvailability(params: {
  rules: BookingRules;
  localDate: string;
  now: Date;
  durationMinutes?: number;
  excludeHolderId?: Types.ObjectId;
  ignoreMinNotice?: boolean;
}): Promise<DayAvailability> {
  const [closures, holds] = await Promise.all([
    loadClosures(params.localDate, params.localDate),
    loadHolds(params.localDate, params.localDate, params.excludeHolderId),
  ]);
  return computeDayAvailability({ ...params, closures, holds });
}

/** Availability for a run of days using two range queries instead of one per day. */
export async function rangeAvailability(params: {
  rules: BookingRules;
  fromDate: string;
  days: number;
  now: Date;
  durationMinutes?: number;
}): Promise<DayAvailability[]> {
  const toDate = addDays(params.fromDate, params.days - 1);
  const [closures, holds] = await Promise.all([loadClosures(params.fromDate, toDate), loadHolds(params.fromDate, toDate)]);
  return Array.from({ length: params.days }, (_, i) =>
    computeDayAvailability({
      rules: params.rules,
      localDate: addDays(params.fromDate, i),
      now: params.now,
      closures,
      holds,
      durationMinutes: params.durationMinutes,
    }),
  );
}

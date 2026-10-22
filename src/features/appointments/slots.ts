/**
 * Pure availability engine. Given the clinic's rules, closures and existing
 * holds, it lists the start times that can still be booked on a clinic-local
 * day. No I/O: the same function is used for listing slots and for
 * re-validating a submitted slot inside the booking service.
 */
import type { OpeningInterval, Weekday } from "@/features/clinic-settings/types";
import { addDays, daysBetween, fromLocal, minutesOf, timeOf, toLocalDate, weekdayOf } from "@/lib/time/ist";

export type BookingRules = {
  weeklyHours: Record<Weekday, OpeningInterval[]>;
  slotMinutes: number;
  capacity: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  bookingEnabled: boolean;
};

export type ClosureRule = { startDate: string; endDate: string; allDay: boolean; startTime?: string; endTime?: string };
export type HeldSlot = { resourceKey: string; start: Date };
export type AvailableSlot = { start: Date; end: Date; resourceKey: string; time: string };

export type DayAvailability = {
  date: string;
  /** True when the clinic does not open at all that day (weekly off, holiday, outside window). */
  closed: boolean;
  slots: AvailableSlot[];
};

const MINUTE = 60_000;

export function resourceKeys(capacity: number): string[] {
  return Array.from({ length: capacity }, (_, i) => `chair-${i + 1}`);
}

/** Number of grid slots an appointment of `durationMinutes` occupies. */
export function slotsNeeded(durationMinutes: number, slotMinutes: number): number {
  return Math.max(1, Math.ceil(durationMinutes / slotMinutes));
}

/** Every grid-slot start an appointment covers (one hold per entry). */
export function coveredStarts(start: Date, durationMinutes: number, slotMinutes: number): Date[] {
  return Array.from({ length: slotsNeeded(durationMinutes, slotMinutes) }, (_, i) => new Date(start.getTime() + i * slotMinutes * MINUTE));
}

export function bookingWindow(rules: Pick<BookingRules, "maxAdvanceDays">, now: Date): { firstDate: string; lastDate: string } {
  const firstDate = toLocalDate(now);
  return { firstDate, lastDate: addDays(firstDate, rules.maxAdvanceDays) };
}

export function isWithinWindow(localDate: string, rules: Pick<BookingRules, "maxAdvanceDays">, now: Date): boolean {
  const { firstDate } = bookingWindow(rules, now);
  const offset = daysBetween(firstDate, localDate);
  return offset >= 0 && offset <= rules.maxAdvanceDays;
}

function closuresOn(localDate: string, closures: ClosureRule[]): ClosureRule[] {
  return closures.filter((c) => c.startDate <= localDate && localDate <= c.endDate);
}

export function computeDayAvailability(params: {
  rules: BookingRules;
  localDate: string;
  now: Date;
  closures: ClosureRule[];
  holds: HeldSlot[];
  durationMinutes?: number;
  /** Admin bookings may ignore the minimum-notice rule (still never the past or a held slot). */
  ignoreMinNotice?: boolean;
}): DayAvailability {
  const { rules, localDate, now, closures, holds } = params;
  const duration = params.durationMinutes ?? rules.slotMinutes;
  const steps = slotsNeeded(duration, rules.slotMinutes);
  const occupyMinutes = steps * rules.slotMinutes;

  if (!rules.bookingEnabled || !isWithinWindow(localDate, rules, now)) return { date: localDate, closed: true, slots: [] };

  const dayClosures = closuresOn(localDate, closures);
  if (dayClosures.some((c) => c.allDay)) return { date: localDate, closed: true, slots: [] };

  const intervals = rules.weeklyHours[weekdayOf(localDate)] ?? [];
  if (intervals.length === 0) return { date: localDate, closed: true, slots: [] };

  const partial = dayClosures
    .filter((c) => c.startTime && c.endTime)
    .map((c) => ({ from: minutesOf(c.startTime!), to: minutesOf(c.endTime!) }));

  const held = new Set(holds.map((h) => `${h.resourceKey}|${h.start.getTime()}`));
  const earliest = now.getTime() + (params.ignoreMinNotice ? 0 : rules.minNoticeMinutes * MINUTE);
  const chairs = resourceKeys(rules.capacity);
  const slots: AvailableSlot[] = [];

  for (const interval of intervals) {
    const open = minutesOf(interval.open);
    const close = minutesOf(interval.close);
    for (let t = open; t + occupyMinutes <= close; t += rules.slotMinutes) {
      const start = fromLocal(localDate, timeOf(t));
      if (start.getTime() < earliest) continue;
      if (partial.some((p) => t < p.to && t + occupyMinutes > p.from)) continue;

      const covered = coveredStarts(start, duration, rules.slotMinutes);
      const chair = chairs.find((key) => covered.every((c) => !held.has(`${key}|${c.getTime()}`)));
      if (chair) slots.push({ start, end: new Date(start.getTime() + occupyMinutes * MINUTE), resourceKey: chair, time: timeOf(t) });
    }
  }

  return { date: localDate, closed: false, slots };
}

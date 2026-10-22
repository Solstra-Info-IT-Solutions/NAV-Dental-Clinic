/**
 * Clinic-local time helpers. Asia/Kolkata is a fixed UTC+05:30 offset with no
 * daylight saving, so conversions are exact arithmetic — no timezone database
 * is needed. Instants are stored in UTC; dates/times shown to people are IST.
 */
import type { Weekday } from "@/features/clinic-settings/types";

export const IST_OFFSET_MINUTES = 330;
const MINUTE = 60_000;
const DAY = 86_400_000;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const WEEKDAY_BY_INDEX: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Clinic-local calendar date ("YYYY-MM-DD") of an instant. */
export function toLocalDate(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MINUTES * MINUTE).toISOString().slice(0, 10);
}

/** Clinic-local wall-clock time ("HH:mm") of an instant. */
export function toLocalTime(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MINUTES * MINUTE).toISOString().slice(11, 16);
}

export function isValidLocalDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === value;
}

/** UTC instant for a clinic-local date and "HH:mm" time. */
export function fromLocal(localDate: string, time: string): Date {
  const d = DATE_RE.exec(localDate);
  const t = TIME_RE.exec(time);
  if (!d || !t || !isValidLocalDate(localDate)) throw new RangeError(`Invalid local date/time: ${localDate} ${time}`);
  const utcMs = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  return new Date(utcMs - IST_OFFSET_MINUTES * MINUTE);
}

export function addDays(localDate: string, days: number): string {
  const d = DATE_RE.exec(localDate);
  if (!d) throw new RangeError(`Invalid local date: ${localDate}`);
  return new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3])) + days * DAY).toISOString().slice(0, 10);
}

export function weekdayOf(localDate: string): Weekday {
  const d = DATE_RE.exec(localDate);
  if (!d) throw new RangeError(`Invalid local date: ${localDate}`);
  return WEEKDAY_BY_INDEX[new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]))).getUTCDay()];
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"). */
export function daysBetween(from: string, to: string): number {
  return Math.round((fromLocal(to, "00:00").getTime() - fromLocal(from, "00:00").getTime()) / DAY);
}

/** UTC bounds [start, end) of a clinic-local day. */
export function localDayBounds(localDate: string): { start: Date; end: Date } {
  const start = fromLocal(localDate, "00:00");
  return { start, end: new Date(start.getTime() + DAY) };
}

export function minutesOf(time: string): number {
  const t = TIME_RE.exec(time);
  if (!t) throw new RangeError(`Invalid time: ${time}`);
  return Number(t[1]) * 60 + Number(t[2]);
}

export function timeOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });

/** "Tuesday, 3 November 2026" */
export function formatLocalDate(instant: Date): string {
  return dateFormatter.format(instant);
}

/** "10:00 am" → normalised to "10:00 AM" for consistency across runtimes. */
export function formatLocalTime(instant: Date): string {
  return timeFormatter.format(instant).replace(/\s?(am|pm)$/i, (_, p: string) => ` ${p.toUpperCase()}`);
}

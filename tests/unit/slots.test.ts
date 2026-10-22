import { describe, expect, it } from "vitest";

import { computeDayAvailability, coveredStarts, isWithinWindow, type BookingRules } from "@/features/appointments/slots";
import { addDays, formatLocalTime, fromLocal, localDayBounds, toLocalDate, toLocalTime, weekdayOf } from "@/lib/time/ist";

const empty = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

const rules: BookingRules = {
  // Sample hours for tests only — not the clinic's real hours.
  weeklyHours: { ...empty, tue: [{ open: "10:00", close: "12:00" }, { open: "16:00", close: "17:00" }] },
  slotMinutes: 30,
  capacity: 1,
  minNoticeMinutes: 120,
  maxAdvanceDays: 30,
  bookingEnabled: true,
};

// 2026-11-03 is a Tuesday. "now" = Monday 2 Nov 2026, 09:00 IST.
const DAY = "2026-11-03";
const now = fromLocal("2026-11-02", "09:00");

const times = (r: ReturnType<typeof computeDayAvailability>) => r.slots.map((s) => s.time);

describe("IST helpers", () => {
  it("converts between IST wall clock and UTC exactly (+05:30, no DST)", () => {
    expect(fromLocal("2026-11-03", "10:00").toISOString()).toBe("2026-11-03T04:30:00.000Z");
    expect(toLocalDate(new Date("2026-11-02T19:00:00.000Z"))).toBe("2026-11-03"); // 00:30 IST next day
    expect(toLocalTime(new Date("2026-11-03T04:30:00.000Z"))).toBe("10:00");
    expect(formatLocalTime(new Date("2026-11-03T10:30:00.000Z"))).toBe("4:00 PM");
  });

  it("handles month/year boundaries and weekdays", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayOf("2026-11-03")).toBe("tue");
    expect(localDayBounds("2026-11-03").start.toISOString()).toBe("2026-11-02T18:30:00.000Z");
    expect(() => fromLocal("2026-02-30", "10:00")).toThrow();
  });
});

describe("computeDayAvailability", () => {
  it("lists every grid slot inside opening intervals, skipping the break", () => {
    expect(times(computeDayAvailability({ rules, localDate: DAY, now, closures: [], holds: [] }))).toEqual([
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "16:00",
      "16:30",
    ]);
  });

  it("reports weekly off days as closed", () => {
    const result = computeDayAvailability({ rules, localDate: "2026-11-04", now, closures: [], holds: [] });
    expect(result).toMatchObject({ closed: true, slots: [] });
  });

  it("enforces the minimum notice period and never offers past times", () => {
    const sameDayNow = fromLocal(DAY, "09:15"); // earliest = 11:15
    expect(times(computeDayAvailability({ rules, localDate: DAY, now: sameDayNow, closures: [], holds: [] }))).toEqual(["11:30", "16:00", "16:30"]);
    const afternoon = fromLocal(DAY, "16:45");
    expect(times(computeDayAvailability({ rules, localDate: DAY, now: afternoon, closures: [], holds: [], ignoreMinNotice: true }))).toEqual([]);
  });

  it("rejects dates before today or beyond the advance window", () => {
    expect(computeDayAvailability({ rules, localDate: "2026-11-01", now, closures: [], holds: [] }).closed).toBe(true);
    expect(isWithinWindow(addDays("2026-11-02", 30), rules, now)).toBe(true);
    expect(isWithinWindow(addDays("2026-11-02", 31), rules, now)).toBe(false);
  });

  it("removes held slots and offers another chair when capacity allows", () => {
    const holds = [{ resourceKey: "chair-1", start: fromLocal(DAY, "10:30") }];
    expect(times(computeDayAvailability({ rules, localDate: DAY, now, closures: [], holds }))).not.toContain("10:30");

    const twoChairs = computeDayAvailability({ rules: { ...rules, capacity: 2 }, localDate: DAY, now, closures: [], holds });
    expect(twoChairs.slots.find((s) => s.time === "10:30")?.resourceKey).toBe("chair-2");
  });

  it("applies full-day and partial closures", () => {
    const holiday = [{ startDate: "2026-11-01", endDate: "2026-11-05", allDay: true }];
    expect(computeDayAvailability({ rules, localDate: DAY, now, closures: holiday, holds: [] }).closed).toBe(true);

    const partial = [{ startDate: DAY, endDate: DAY, allDay: false, startTime: "10:45", endTime: "11:30" }];
    expect(times(computeDayAvailability({ rules, localDate: DAY, now, closures: partial, holds: [] }))).toEqual(["10:00", "11:30", "16:00", "16:30"]);
  });

  it("only offers starts where a longer service fits entirely and every covered slot is free", () => {
    const result = computeDayAvailability({ rules, localDate: DAY, now, closures: [], holds: [{ resourceKey: "chair-1", start: fromLocal(DAY, "11:00") }], durationMinutes: 60 });
    // 10:00 (10:00+10:30 free) fits; 10:30 overlaps the 11:00 hold; 11:30 would end after 12:00.
    expect(times(result)).toEqual(["10:00", "16:00"]);
    expect(coveredStarts(fromLocal(DAY, "10:00"), 60, 30).map(toLocalTime)).toEqual(["10:00", "10:30"]);
  });

  it("is closed when online booking is disabled", () => {
    expect(computeDayAvailability({ rules: { ...rules, bookingEnabled: false }, localDate: DAY, now, closures: [], holds: [] }).closed).toBe(true);
  });
});

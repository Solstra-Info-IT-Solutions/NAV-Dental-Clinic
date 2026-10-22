/**
 * Appointment status rules (docs/DATABASE_SCHEMA.md §8). This table is the
 * single authority for which status changes are allowed and which statuses
 * occupy a slot.
 */
import type { AppointmentStatus } from "@/lib/db/models/appointment";

export type { AppointmentStatus };

type Rule = { requiresStarted?: boolean };

export const TRANSITIONS: Record<AppointmentStatus, Partial<Record<AppointmentStatus, Rule>>> = {
  pending: { confirmed: {}, cancelled: {}, rejected: {} },
  confirmed: { reschedule_requested: {}, completed: { requiresStarted: true }, cancelled: {}, no_show: { requiresStarted: true } },
  // Leaving reschedule_requested for "confirmed" happens through the reschedule action.
  reschedule_requested: { confirmed: {}, cancelled: {} },
  completed: {},
  cancelled: {},
  rejected: {},
  no_show: {},
};

export const TERMINAL_STATUSES: AppointmentStatus[] = ["completed", "cancelled", "rejected", "no_show"];

/** Statuses that keep their slot holds. Cancelled, rejected and no-show release them. */
const HOLDING: ReadonlySet<AppointmentStatus> = new Set(["pending", "confirmed", "reschedule_requested", "completed"]);

export function holdsSlot(status: AppointmentStatus): boolean {
  return HOLDING.has(status);
}

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

export function checkTransition(from: AppointmentStatus, to: AppointmentStatus, context: { start: Date; now: Date }): TransitionCheck {
  if (from === to) return { ok: false, reason: `The appointment is already ${label(to)}.` };
  const rule = TRANSITIONS[from][to];
  if (!rule) return { ok: false, reason: `A ${label(from)} appointment cannot be marked ${label(to)}.` };
  if (rule.requiresStarted && context.start.getTime() > context.now.getTime()) {
    return { ok: false, reason: `An appointment can only be marked ${label(to)} after its start time.` };
  }
  return { ok: true };
}

export function canReschedule(status: AppointmentStatus): boolean {
  return status === "pending" || status === "confirmed" || status === "reschedule_requested";
}

export function label(status: AppointmentStatus): string {
  return status.replace("_", " ");
}

/** Patient-facing wording for the public status lookup. */
export const PUBLIC_STATUS_TEXT: Record<AppointmentStatus, string> = {
  pending: "Request received – waiting for the clinic to confirm",
  confirmed: "Confirmed",
  reschedule_requested: "The clinic will contact you to agree a new time",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Not available – please call the clinic",
  no_show: "Missed appointment",
};

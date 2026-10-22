/** Submissions completed faster than this are almost certainly automated. */
export const MIN_FILL_MS = 3_000;
/** Ignore absurd clock values (form open for more than a day or from the future). */
const MAX_FILL_MS = 24 * 60 * 60 * 1000;

export type SpamSignals = { honeypot: string; formStartedAt: number; now?: number };

/** Returns a reason when the submission looks automated, otherwise null. */
export function spamReason({ honeypot, formStartedAt, now = Date.now() }: SpamSignals): string | null {
  if (honeypot.trim() !== "") return "honeypot";
  const elapsed = now - formStartedAt;
  if (elapsed < MIN_FILL_MS) return "too_fast";
  if (elapsed > MAX_FILL_MS) return "stale_form";
  return null;
}

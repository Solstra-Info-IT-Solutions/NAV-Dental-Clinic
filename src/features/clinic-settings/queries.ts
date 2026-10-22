import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { DEFAULT_PUBLIC_SETTINGS } from "./defaults";
import type { PublicClinicSettings } from "./types";

export const CLINIC_SETTINGS_TAG = "clinic-settings";

/**
 * Public clinic settings for rendering. Cached and tagged so admin edits can
 * call revalidateTag(CLINIC_SETTINGS_TAG). Phase 3 replaces the body with a
 * MongoDB read; callers do not change.
 */
export async function getPublicSettings(): Promise<PublicClinicSettings> {
  "use cache";
  cacheTag(CLINIC_SETTINGS_TAG);
  cacheLife("hours");
  return DEFAULT_PUBLIC_SETTINGS;
}

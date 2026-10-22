import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { connectToDatabase } from "@/lib/db/connection";
import { logger } from "@/lib/logger";

import { DEFAULT_PUBLIC_SETTINGS } from "./defaults";
import { findSettings, toPublicSettings } from "./repository";
import type { PublicClinicSettings } from "./types";

export const CLINIC_SETTINGS_TAG = "clinic-settings";

/**
 * Public clinic settings from MongoDB, cached and tagged so admin edits can
 * call revalidateTag(CLINIC_SETTINGS_TAG). If the database has not been
 * initialised yet, the verified defaults are used (and a warning logged)
 * rather than failing the whole site.
 */
export async function getPublicSettings(): Promise<PublicClinicSettings> {
  "use cache";
  cacheTag(CLINIC_SETTINGS_TAG);
  cacheLife("hours");
  await connectToDatabase();
  const doc = await findSettings();
  if (!doc) {
    logger.warn("settings.not_initialised", { hint: "run npm run db:init" });
    return DEFAULT_PUBLIC_SETTINGS;
  }
  return toPublicSettings(doc);
}

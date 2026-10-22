/**
 * Shared helpers for CLI scripts (run with `tsx --conditions=react-server`
 * so `server-only` imports resolve outside Next.js).
 */
import mongoose from "mongoose";

import { seedSettings } from "@/features/clinic-settings/repository";
import { seedServices } from "@/features/services/repository";
import { ALL_MODELS, ClinicSettingsModel } from "@/lib/db/models";

/**
 * SAMPLE opening hours for the in-memory development database ONLY. They are
 * not the clinic's real hours and are never written to a database configured
 * through MONGODB_URI. Replace with confirmed hours in the admin dashboard.
 */
export const DEV_SAMPLE_WEEKLY_HOURS = {
  mon: [{ open: "10:00", close: "13:30" }, { open: "16:00", close: "20:00" }],
  tue: [{ open: "10:00", close: "13:30" }, { open: "16:00", close: "20:00" }],
  wed: [{ open: "10:00", close: "13:30" }, { open: "16:00", close: "20:00" }],
  thu: [{ open: "10:00", close: "13:30" }, { open: "16:00", close: "20:00" }],
  fri: [{ open: "10:00", close: "13:30" }, { open: "16:00", close: "20:00" }],
  sat: [{ open: "10:00", close: "13:30" }, { open: "16:00", close: "20:00" }],
  sun: [],
};

/**
 * Better Auth's MongoDB adapter does not create indexes; these enforce unique
 * logins and keep session lookups fast.
 */
async function ensureAuthIndexes(): Promise<void> {
  const db = mongoose.connection.db!;
  await db.collection("user").createIndex({ email: 1 }, { unique: true });
  await db.collection("session").createIndex({ token: 1 }, { unique: true });
  await db.collection("session").createIndex({ userId: 1 });
  await db.collection("session").createIndex({ expiresAt: 1 });
  await db.collection("account").createIndex({ userId: 1 });
  await db.collection("account").createIndex({ providerId: 1, accountId: 1 });
  await db.collection("verification").createIndex({ identifier: 1 });
}

export type InitSummary = { collections: string[]; settingsCreated: boolean; servicesInserted: number };

/**
 * Idempotent database initialisation: creates every collection (multi-document
 * transactions need them to exist), synchronises indexes with the schemas, and
 * seeds settings and services without overwriting existing documents.
 */
export async function initialiseDatabase(options: { devSampleHours?: boolean } = {}): Promise<InitSummary> {
  const existing = new Set((await mongoose.connection.db!.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const model of ALL_MODELS) {
    if (!existing.has(model.collection.collectionName)) await model.createCollection();
    await model.syncIndexes();
  }
  await ensureAuthIndexes();
  const settings = await seedSettings();
  if (options.devSampleHours && settings.created) {
    await ClinicSettingsModel.updateOne({ _id: "default" }, { $set: { weeklyHours: DEV_SAMPLE_WEEKLY_HOURS } });
  }
  const services = await seedServices();
  return {
    collections: ALL_MODELS.map((m) => m.collection.collectionName),
    settingsCreated: settings.created,
    servicesInserted: services.inserted,
  };
}

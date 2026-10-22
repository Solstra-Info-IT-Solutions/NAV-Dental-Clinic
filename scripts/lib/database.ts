/**
 * Shared helpers for CLI scripts (run with `tsx --conditions=react-server`
 * so `server-only` imports resolve outside Next.js).
 */
import mongoose from "mongoose";

import { seedSettings } from "@/features/clinic-settings/repository";
import { seedServices } from "@/features/services/repository";
import { ALL_MODELS } from "@/lib/db/models";

export type InitSummary = { collections: string[]; settingsCreated: boolean; servicesInserted: number };

/**
 * Idempotent database initialisation: creates every collection (multi-document
 * transactions need them to exist), synchronises indexes with the schemas, and
 * seeds settings and services without overwriting existing documents.
 */
export async function initialiseDatabase(): Promise<InitSummary> {
  const existing = new Set((await mongoose.connection.db!.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const model of ALL_MODELS) {
    if (!existing.has(model.collection.collectionName)) await model.createCollection();
    await model.syncIndexes();
  }
  const settings = await seedSettings();
  const services = await seedServices();
  return {
    collections: ALL_MODELS.map((m) => m.collection.collectionName),
    settingsCreated: settings.created,
    servicesInserted: services.inserted,
  };
}

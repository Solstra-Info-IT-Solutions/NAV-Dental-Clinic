/**
 * npm run db:check — read-only health check of the configured database:
 * collections, key indexes, seed data, transaction support and admin
 * accounts. Prints no connection strings or personal data.
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";

import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/connection";
import { ALL_MODELS, ClinicSettingsModel, ServiceModel } from "@/lib/db/models";

loadEnvConfig(process.cwd());

const REQUIRED_INDEXES: Record<string, string[]> = {
  slot_holds: ["resourceKey_1_start_1"],
  appointments: ["reference_1", "idempotencyKey_1"],
  services: ["slug_1"],
  rate_limits: ["expiresAt_1"],
  user: ["email_1"],
  session: ["token_1"],
};

async function main() {
  await connectToDatabase();
  const db = mongoose.connection.db!;
  const ok = (cond: boolean) => (cond ? "OK " : "MISSING");
  let problems = 0;

  console.log(`Database: ${db.databaseName}`);
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const name of [...ALL_MODELS.map((m) => m.collection.collectionName), "user", "session", "account", "verification"]) {
    const present = existing.has(name);
    if (!present && !["account", "verification"].includes(name)) problems++;
    console.log(`  ${ok(present)} collection ${name}`);
  }

  for (const [collection, names] of Object.entries(REQUIRED_INDEXES)) {
    const indexes = existing.has(collection) ? (await db.collection(collection).indexes()).map((i) => i.name ?? "") : [];
    for (const name of names) {
      const present = indexes.includes(name);
      if (!present) problems++;
      console.log(`  ${ok(present)} index ${collection}.${name}`);
    }
  }

  const settings = await ClinicSettingsModel.findById("default").lean();
  const hoursDays = settings ? Object.values(settings.weeklyHours ?? {}).filter((d) => Array.isArray(d) && d.length > 0).length : 0;
  console.log(`  ${ok(Boolean(settings))} clinic settings: ${settings ? `${settings.clinicName}, ${settings.bookingMode} mode, ${settings.slotMinutes}-min slots, opening hours set on ${hoursDays}/7 days` : "not found"}`);
  if (!settings) problems++;

  const published = await ServiceModel.find({ published: true }).select({ slug: 1 }).lean();
  console.log(`  ${ok(published.length > 0)} services: ${await ServiceModel.countDocuments()} total, published: ${published.map((s) => s.slug).join(", ") || "none"}`);

  // Bookings rely on multi-document transactions (replica set / Atlas).
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection("rate_limits").findOne({}, { session });
    });
    console.log("  OK  transactions supported");
  } catch (error) {
    problems++;
    console.log(`  FAILED transactions: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await session.endSession();
  }

  const owners = await db.collection("user").countDocuments({ role: "owner", disabled: { $ne: true } });
  const staff = await db.collection("user").countDocuments({ role: "staff", disabled: { $ne: true } });
  console.log(`  ${owners > 0 ? "OK " : "TODO"} admin accounts: ${owners} owner(s), ${staff} staff`);

  console.log(problems === 0 ? "\nDatabase looks healthy." : `\n${problems} problem(s) found.`);
  if (problems) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error("Check failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectFromDatabase());

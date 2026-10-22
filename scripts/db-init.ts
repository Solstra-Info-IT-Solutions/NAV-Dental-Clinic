/**
 * npm run db:init — create collections and indexes, seed default settings and
 * services. Safe to run repeatedly; never overwrites edited documents.
 */
import { loadEnvConfig } from "@next/env";

import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/connection";

import { initialiseDatabase } from "./lib/database";

loadEnvConfig(process.cwd());

async function main() {
  await connectToDatabase();
  const summary = await initialiseDatabase();
  console.log(`Indexes synchronised for ${summary.collections.length} collections: ${summary.collections.join(", ")}`);
  console.log(summary.settingsCreated ? "Clinic settings created with defaults." : "Clinic settings already exist (unchanged).");
  console.log(`Services inserted: ${summary.servicesInserted} (existing services unchanged).`);
}

main()
  .catch((error: unknown) => {
    console.error("Database initialisation failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectFromDatabase());

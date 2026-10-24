/**
 * npm run db:purge            — dry run: shows what would be deleted
 * npm run db:purge -- --apply — deletes records older than the retention periods
 *
 * Retention periods are set by the owner in Clinic settings → Policies. Run
 * only after the clinic has approved those periods (docs/SECURITY.md §6).
 */
import { parseArgs } from "node:util";

import { loadEnvConfig } from "@next/env";

import { purgeExpiredData } from "@/features/retention/service";
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/connection";

loadEnvConfig(process.cwd());

async function main() {
  const { values } = parseArgs({ options: { apply: { type: "boolean", default: false } } });
  await connectToDatabase();
  const summary = await purgeExpiredData({ apply: values.apply });
  console.log(summary.dryRun ? "DRY RUN — nothing deleted. Re-run with --apply to delete." : "Deleted:");
  console.log(`  Appointments ended before ${summary.appointmentCutoff.slice(0, 10)}: ${summary.appointments}`);
  console.log(`  Enquiries received before ${summary.enquiryCutoff.slice(0, 10)}: ${summary.enquiries}`);
  console.log(`  Related slot holds: ${summary.holds}, notification records: ${summary.notifications}`);
}

main()
  .catch((error: unknown) => {
    console.error("Purge failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectFromDatabase());

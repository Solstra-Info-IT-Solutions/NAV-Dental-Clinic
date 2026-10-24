/**
 * Runs a command (e.g. `next dev`) with a database available.
 *
 * - If MONGODB_URI is set (environment or .env.local), the command runs
 *   against it unchanged.
 * - Otherwise, outside production, an in-memory MongoDB replica set is started
 *   on 127.0.0.1:27027 (or reused if one from another wrapper is already
 *   running), initialised and seeded, and MONGODB_URI is set for the command.
 *   Data lives only as long as the process that started it.
 *
 * Usage: tsx --conditions=react-server scripts/with-db.ts <command> [...args]
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

import { loadEnvConfig } from "@next/env";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

import { createAdminUser, generateTemporaryPassword } from "@/features/admin-users/service";

import { initialiseDatabase } from "./lib/database";

const MEMORY_PORT = 27027;
const REPLSET = "rs0";
const MEMORY_URI = `mongodb://127.0.0.1:${MEMORY_PORT}/?replicaSet=${REPLSET}&directConnection=true`;

loadEnvConfig(process.cwd(), process.argv.includes("dev"));

async function isReachable(uri: string): Promise<boolean> {
  const probe = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 1_500 });
  try {
    await probe.asPromise();
    return true;
  } catch {
    return false;
  } finally {
    await probe.close().catch(() => undefined);
  }
}

/**
 * In-memory development only: makes sure an owner account exists so the admin
 * dashboard can be used. Credentials come from DEV_ADMIN_EMAIL /
 * DEV_ADMIN_PASSWORD, otherwise a random password is generated and printed.
 */
async function ensureDevOwner(): Promise<void> {
  const email = (process.env.DEV_ADMIN_EMAIL || "owner@nav-dental.test").toLowerCase();
  if (await mongoose.connection.db!.collection("user").findOne({ email })) return;
  const password = process.env.DEV_ADMIN_PASSWORD || generateTemporaryPassword();
  await createAdminUser({ name: "Development Owner", email, role: "owner", password, actor: "system" });
  console.log(`[with-db] Development owner account: ${email}${process.env.DEV_ADMIN_PASSWORD ? "" : ` / password: ${password}`} (in-memory database only)`);
}

async function prepareMemoryDatabase(): Promise<MongoMemoryReplSet | null> {
  let replSet: MongoMemoryReplSet | null = null;
  if (await isReachable(MEMORY_URI)) {
    console.log(`[with-db] Reusing in-memory MongoDB already running on port ${MEMORY_PORT}.`);
  } else {
    console.log("[with-db] MONGODB_URI not set: starting in-memory MongoDB replica set (development only, data is temporary)...");
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, name: REPLSET, storageEngine: "wiredTiger" },
      instanceOpts: [{ port: MEMORY_PORT }],
    });
  }
  process.env.MONGODB_URI = MEMORY_URI;
  // Tells the app it is running on throwaway sample data (shows a banner).
  process.env.NAV_DEV_SAMPLE_DATA = "1";
  // `next start` runs in production mode, which requires a salt; a per-session
  // random one is fine because the in-memory data is discarded anyway.
  process.env.RATE_LIMIT_SALT ??= randomBytes(24).toString("base64url");
  process.env.BETTER_AUTH_SECRET ??= randomBytes(32).toString("base64url");
  await mongoose.connect(MEMORY_URI, { dbName: process.env.MONGODB_DB || "nav_dental" });
  const summary = await initialiseDatabase({ devSampleHours: true });
  await ensureDevOwner();
  await mongoose.disconnect();
  console.log(
    `[with-db] Database ready (${summary.collections.length} collections; settings ${summary.settingsCreated ? "seeded with SAMPLE opening hours" : "kept"}; ${summary.servicesInserted} services seeded).`,
  );
  return replSet;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) throw new Error("Usage: with-db <command> [...args]");

  let replSet: MongoMemoryReplSet | null = null;
  if (!process.env.MONGODB_URI) {
    // Hosted builds (any Vercel environment, including previews) must use a real database:
    // a throwaway in-memory database with sample hours must never be deployed.
    if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NODE_ENV === "production") {
      throw new Error("MONGODB_URI must be set for hosted builds; the in-memory database is for local development and CI only.");
    }
    replSet = await prepareMemoryDatabase();
  }

  // A single command string through the shell resolves npm bin shims (next.cmd on Windows).
  // Arguments come from package.json scripts, never from user input.
  const child = spawn([command, ...args].join(" "), { stdio: "inherit", env: process.env, shell: true });

  const shutdown = async (code: number) => {
    if (replSet) await replSet.stop().catch(() => undefined);
    process.exit(code);
  };
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => child.kill(signal));
  }
  child.on("exit", (code) => void shutdown(code ?? 0));
}

main().catch((error: unknown) => {
  console.error("[with-db]", error instanceof Error ? error.message : error);
  process.exit(1);
});

import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { resetServerEnvCache } from "@/config/env.server";
import { connectToDatabase, disconnectFromDatabase } from "@/lib/db/connection";
import { ALL_MODELS } from "@/lib/db/models";

import { initialiseDatabase } from "../../scripts/lib/database";

/**
 * Starts a throwaway single-node replica set (transactions need a replica
 * set) for one test file, initialised exactly like `npm run db:init`.
 * Collections are emptied (not dropped, so indexes stay) before each test.
 */
export function setupTestDatabase(options: { seed?: boolean } = {}) {
  let replSet: MongoMemoryReplSet;

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    process.env.MONGODB_URI = replSet.getUri();
    process.env.MONGODB_DB = "nav_dental_test";
    resetServerEnvCache();
    await connectToDatabase();
    await initialiseDatabase();
  }, 120_000);

  beforeEach(async () => {
    await Promise.all(ALL_MODELS.map((model) => model.collection.deleteMany({})));
    if (options.seed) await initialiseDatabase();
  });

  afterAll(async () => {
    await disconnectFromDatabase();
    await replSet?.stop();
    delete process.env.MONGODB_URI;
    resetServerEnvCache();
  });

  return { mongoose };
}

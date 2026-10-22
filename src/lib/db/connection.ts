import "server-only";

import mongoose from "mongoose";

import { requireMongoUri, serverEnv } from "@/config/env.server";
import { logger } from "@/lib/logger";

// Operator injection is prevented at the boundary: every user-supplied value is
// parsed by Zod into a primitive (string/number/boolean) before it reaches a
// query, so `{ $ne: ... }`-style objects can never be smuggled in. Mongoose's
// global `sanitizeFilter` is NOT used because it also neutralises the
// application's own trusted range operators ($gte/$lt). Unknown filter paths
// throw instead of being silently dropped.
mongoose.set("strictQuery", "throw");
// Indexes are created explicitly by `npm run db:init` (and by tests), never
// implicitly on first model use in production.
mongoose.set("autoIndex", false);

type ConnectionCache = { promise: Promise<typeof mongoose> | null };

// Reuse one connection across hot reloads in development and across
// invocations of the same serverless instance in production.
const globalCache = globalThis as typeof globalThis & { __navMongoose?: ConnectionCache };
const cache: ConnectionCache = (globalCache.__navMongoose ??= { promise: null });

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!cache.promise) {
    const uri = requireMongoUri();
    cache.promise = mongoose
      .connect(uri, {
        dbName: serverEnv().MONGODB_DB,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8_000,
        bufferCommands: false,
      })
      .catch((error: unknown) => {
        // Allow the next request to retry instead of caching the failure.
        cache.promise = null;
        logger.error("db.connect_failed", { error });
        throw error;
      });
  }
  return cache.promise;
}

export async function disconnectFromDatabase(): Promise<void> {
  cache.promise = null;
  await mongoose.disconnect();
}

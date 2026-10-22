import "server-only";

import mongoose from "mongoose";

import { requireMongoUri, serverEnv } from "@/config/env.server";
import { logger } from "@/lib/logger";

// Defence in depth against operator injection: query filters containing
// `$`-prefixed keys from user input are wrapped in $eq, and unknown filter
// paths throw instead of being silently dropped.
mongoose.set("sanitizeFilter", true);
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

import "server-only";

import { z } from "zod";

/**
 * Server-only environment. Parsed lazily so pages that never touch the
 * database (and unit tests) do not require database credentials, but any
 * code path that needs a value fails loudly with a clear message.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, "must be a mongodb:// or mongodb+srv:// connection string")
    .optional(),
  MONGODB_DB: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,38}$/)
    .default("nav_dental"),
  RATE_LIMIT_SALT: z.string().min(16).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    MONGODB_URI: process.env.MONGODB_URI || undefined,
    MONGODB_DB: process.env.MONGODB_DB || undefined,
    RATE_LIMIT_SALT: process.env.RATE_LIMIT_SALT || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${z.prettifyError(parsed.error)}`);
  }
  cached = parsed.data;
  return cached;
}

export function requireMongoUri(): string {
  const { MONGODB_URI } = serverEnv();
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. For local development run `npm run dev` (starts an in-memory MongoDB) or set it in .env.local.",
    );
  }
  return MONGODB_URI;
}

/** Salt for hashing IP addresses. A fixed development salt is allowed outside production only. */
export function rateLimitSalt(): string {
  const { RATE_LIMIT_SALT, NODE_ENV } = serverEnv();
  if (RATE_LIMIT_SALT) return RATE_LIMIT_SALT;
  if (NODE_ENV === "production") throw new Error("RATE_LIMIT_SALT must be set in production.");
  return "development-only-rate-limit-salt";
}

/** Test hook: forget parsed values after mutating process.env. */
export function resetServerEnvCache(): void {
  cached = undefined;
}

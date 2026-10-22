import "server-only";

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import mongoose from "mongoose";

import { authSecret, serverEnv } from "@/config/env.server";
import { siteConfig } from "@/config/site";
import { recordAudit } from "@/features/audit/service";
import { AUTH_COOKIE_PREFIX } from "@/lib/auth/constants";
import { connectToDatabase } from "@/lib/db/connection";
import { logger, maskEmail } from "@/lib/logger";
import { consumeRateLimit, hashIdentifier } from "@/lib/security/rate-limit";

export const ADMIN_ROLES = ["owner", "staff"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const SESSION_HOURS = 8;

function buildAuth(db: mongoose.mongo.Db, client: mongoose.mongo.MongoClient) {
  const production = serverEnv().NODE_ENV === "production";
  return betterAuth({
    appName: "NAV Dental Clinic Admin",
    secret: authSecret(),
    baseURL: serverEnv().BETTER_AUTH_URL ?? siteConfig.url,
    // The canonical site plus the request's own origin (preview deployments,
    // local ports). A cross-site request never matches its own target origin,
    // so this keeps Better Auth's CSRF origin check effective.
    trustedOrigins: (request) => [siteConfig.url, request ? new URL(request.url).origin : undefined],
    database: mongodbAdapter(db, { client }),
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      // Accounts are created only by the owner (admin UI) or `npm run admin:create`.
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
      revokeSessionsOnPasswordReset: true,
    },
    session: {
      expiresIn: SESSION_HOURS * 60 * 60,
      updateAge: 60 * 60,
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "staff", input: false },
        disabled: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 15 * 60, max: 5 },
      },
      // Shared MongoDB-backed limiter, so limits hold across serverless instances.
      customStorage: {
        consume: async (key, rule) => {
          const result = await consumeRateLimit({ scope: "auth", limit: rule.max, windowSeconds: rule.window }, key);
          return { allowed: result.allowed, retryAfter: result.allowed ? null : result.retryAfterSeconds };
        },
      },
    },
    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      useSecureCookies: production,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", secure: production, path: "/" },
      ipAddress: { ipAddressHeaders: ["x-forwarded-for"] },
    },
    databaseHooks: {
      session: {
        create: {
          // Disabled accounts cannot start a session, even with the right password.
          before: async (session) => {
            const user = await db.collection("user").findOne({ _id: new mongoose.Types.ObjectId(String(session.userId)) });
            if (user?.disabled) throw new APIError("FORBIDDEN", { message: "This account has been disabled." });
          },
        },
      },
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email") return;
        const email = typeof ctx.body?.email === "string" ? ctx.body.email.toLowerCase() : "";
        const succeeded = Boolean(ctx.context.newSession);
        const ip = ctx.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
        try {
          await recordAudit({
            actor: succeeded ? { id: ctx.context.newSession!.user.id, email } : { email: maskEmail(email) },
            action: succeeded ? "auth.login_succeeded" : "auth.login_failed",
            entity: "user",
            entityId: succeeded ? ctx.context.newSession!.user.id : "unknown",
            ipHash: ip ? hashIdentifier(ip) : undefined,
          });
        } catch (error) {
          logger.error("auth.audit_failed", { error });
        }
      }),
    },
    // Lets Server Actions set auth cookies; must be the last plugin.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof buildAuth>;

const globalAuth = globalThis as typeof globalThis & { __navAuth?: Promise<Auth> };

/**
 * Lazily creates the auth instance on top of the shared Mongoose connection,
 * so importing this module never opens a connection at build time.
 */
export function getAuth(): Promise<Auth> {
  globalAuth.__navAuth ??= connectToDatabase()
    .then(() => buildAuth(mongoose.connection.db!, mongoose.connection.getClient()))
    .catch((error: unknown) => {
      globalAuth.__navAuth = undefined;
      throw error;
    });
  return globalAuth.__navAuth;
}

/** Test hook: drop the cached instance after the database or env changes. */
export function resetAuthForTests(): void {
  globalAuth.__navAuth = undefined;
}

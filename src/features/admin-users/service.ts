import "server-only";

import { randomInt } from "node:crypto";

import mongoose from "mongoose";
import { z } from "zod";

import { recordAudit, type AuditActor } from "@/features/audit/service";
import { getAuth, type AdminRole } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/connection";
import { AppError } from "@/lib/errors";

export type AdminUserRecord = { id: string; name: string; email: string; role: AdminRole; disabled: boolean; createdAt: Date };

export const createAdminUserSchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(80),
  email: z.email("Enter a valid email address.").max(120).transform((v) => v.toLowerCase()),
  role: z.enum(["owner", "staff"]),
});

export const updateAdminUserSchema = z
  .object({ role: z.enum(["owner", "staff"]).optional(), disabled: z.boolean().optional(), resetPassword: z.literal(true).optional() })
  .refine((v) => v.role !== undefined || v.disabled !== undefined || v.resetPassword, { message: "Nothing to change." });

const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** 20-character random password (~115 bits) without look-alike characters. Shown once, never stored in plain text. */
export function generateTemporaryPassword(): string {
  return Array.from({ length: 20 }, () => PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)]).join("");
}

function users() {
  return mongoose.connection.db!.collection("user");
}

function toRecord(doc: Record<string, unknown>): AdminUserRecord {
  return {
    id: String(doc._id),
    name: String(doc.name ?? ""),
    email: String(doc.email ?? ""),
    role: doc.role === "owner" ? "owner" : "staff",
    disabled: Boolean(doc.disabled),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(0),
  };
}

export async function listAdminUsers(): Promise<AdminUserRecord[]> {
  await connectToDatabase();
  const docs = await users().find({}).sort({ createdAt: 1 }).toArray();
  return docs.map((d) => toRecord(d));
}

async function activeOwnerCount(): Promise<number> {
  return users().countDocuments({ role: "owner", disabled: { $ne: true } });
}

/**
 * Creates an admin account with a credential password. Sign-up is disabled
 * publicly, so this (owner UI or CLI) is the only way accounts are created.
 */
export async function createAdminUser(params: {
  name: string;
  email: string;
  role: AdminRole;
  password?: string;
  actor: AuditActor;
}): Promise<{ user: AdminUserRecord; temporaryPassword?: string }> {
  const auth = await getAuth();
  const ctx = await auth.$context;
  const email = params.email.toLowerCase();
  if (await ctx.internalAdapter.findUserByEmail(email)) {
    throw new AppError("CONFLICT", { message: "An account with this email already exists.", fields: { email: "An account with this email already exists." } });
  }
  const password = params.password ?? generateTemporaryPassword();
  if (password.length < 12 || password.length > 128) throw new AppError("VALIDATION_FAILED", { fields: { password: "Use 12 to 128 characters." } });

  const user = await ctx.internalAdapter.createUser({ name: params.name, email, emailVerified: true, role: params.role, disabled: false }, { method: "admin" });
  await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: await ctx.password.hash(password) });
  await recordAudit({ actor: params.actor, action: "user.created", entity: "user", entityId: user.id, changes: [{ field: "role", to: params.role }] });

  const record = toRecord((await users().findOne({ _id: new mongoose.Types.ObjectId(user.id) })) ?? {});
  return { user: record, temporaryPassword: params.password ? undefined : password };
}

/** Role change, enable/disable or password reset. Never leaves the clinic without an active owner. */
export async function updateAdminUser(params: {
  userId: string;
  role?: AdminRole;
  disabled?: boolean;
  resetPassword?: boolean;
  actor: AuditActor;
}): Promise<{ user: AdminUserRecord; temporaryPassword?: string }> {
  if (!mongoose.Types.ObjectId.isValid(params.userId)) throw new AppError("NOT_FOUND");
  const auth = await getAuth();
  const ctx = await auth.$context;
  const _id = new mongoose.Types.ObjectId(params.userId);
  const current = await users().findOne({ _id });
  if (!current) throw new AppError("NOT_FOUND");

  const losingOwner = current.role === "owner" && !current.disabled && ((params.role && params.role !== "owner") || params.disabled === true);
  if (losingOwner && (await activeOwnerCount()) <= 1) {
    throw new AppError("CONFLICT", { message: "There must always be at least one active owner account." });
  }
  if (params.actor !== "system" && String(params.actor.id) === params.userId && params.disabled === true) {
    throw new AppError("CONFLICT", { message: "You cannot disable your own account." });
  }

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (params.role) set.role = params.role;
  if (params.disabled !== undefined) set.disabled = params.disabled;
  await users().updateOne({ _id }, { $set: set });

  let temporaryPassword: string | undefined;
  if (params.resetPassword) {
    temporaryPassword = generateTemporaryPassword();
    await ctx.internalAdapter.updatePassword(params.userId, await ctx.password.hash(temporaryPassword));
  }
  // Disabling, demoting or resetting a password signs the user out everywhere.
  if (params.disabled || params.resetPassword || (params.role && params.role !== current.role)) {
    await ctx.internalAdapter.deleteUserSessions(params.userId);
  }

  await recordAudit({
    actor: params.actor,
    action: "user.updated",
    entity: "user",
    entityId: params.userId,
    changes: [
      ...(params.role ? [{ field: "role", from: current.role, to: params.role }] : []),
      ...(params.disabled !== undefined ? [{ field: "disabled", from: Boolean(current.disabled), to: params.disabled }] : []),
      ...(params.resetPassword ? [{ field: "password", to: "[reset]" }] : []),
    ],
  });
  return { user: toRecord((await users().findOne({ _id }))!), temporaryPassword };
}

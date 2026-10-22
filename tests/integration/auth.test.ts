// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAdminUser, generateTemporaryPassword, listAdminUsers, updateAdminUser } from "@/features/admin-users/service";
import { getAuth, resetAuthForTests } from "@/lib/auth/auth";
import { getAdminFromHeaders, requireAdmin } from "@/lib/auth/guards";
import { AuditLogModel } from "@/lib/db/models";

import { setupTestDatabase } from "../support/mongo";

const { mongoose } = setupTestDatabase();

beforeAll(() => resetAuthForTests());
afterAll(() => resetAuthForTests());

async function signIn(email: string, password: string): Promise<{ status: number; cookie: string }> {
  const auth = await getAuth();
  const response = await auth.handler(
    new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}` },
      body: JSON.stringify({ email, password }),
    }),
  );
  const cookie = (response.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
  return { status: response.status, cookie };
}

describe("admin authentication", () => {
  it("creates accounts with hashed passwords and signs in", async () => {
    const password = generateTemporaryPassword();
    const { user, temporaryPassword } = await createAdminUser({ name: "Clinic Owner", email: "Owner@Example.com", role: "owner", password, actor: "system" });
    expect(user).toMatchObject({ email: "owner@example.com", role: "owner", disabled: false });
    expect(temporaryPassword).toBeUndefined();

    const account = await mongoose.connection.db!.collection("account").findOne({ providerId: "credential" });
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toContain(password);

    const { status, cookie } = await signIn("owner@example.com", password);
    expect(status).toBe(200);
    expect(cookie).toContain("nav.session_token");
    const admin = await getAdminFromHeaders(new Headers({ cookie }));
    expect(admin).toMatchObject({ email: "owner@example.com", role: "owner" });
    expect(await AuditLogModel.countDocuments({ action: "auth.login_succeeded" })).toBe(1);
  });

  it("rejects wrong passwords, audits the failure and blocks public sign-up", async () => {
    await createAdminUser({ name: "Staff", email: "staff1@example.com", role: "staff", password: generateTemporaryPassword(), actor: "system" });
    const { status } = await signIn("staff1@example.com", "definitely-wrong-password");
    expect(status).toBe(401);
    expect(await AuditLogModel.countDocuments({ action: "auth.login_failed" })).toBeGreaterThanOrEqual(1);

    const auth = await getAuth();
    const signUp = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({ email: "attacker@example.com", password: "a-very-long-password", name: "Attacker" }),
      }),
    );
    expect(signUp.status).toBeGreaterThanOrEqual(400);
    expect(await mongoose.connection.db!.collection("user").countDocuments({ email: "attacker@example.com" })).toBe(0);
  });

  it("enforces roles on the server", async () => {
    const password = generateTemporaryPassword();
    await createAdminUser({ name: "Front Desk", email: "desk@example.com", role: "staff", password, actor: "system" });
    const { cookie } = await signIn("desk@example.com", password);
    await expect(requireAdmin(new Headers({ cookie }), "staff")).resolves.toMatchObject({ role: "staff" });
    await expect(requireAdmin(new Headers({ cookie }), "owner")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireAdmin(new Headers(), "staff")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("disabling an account ends its sessions and blocks new sign-ins", async () => {
    const password = generateTemporaryPassword();
    const { user } = await createAdminUser({ name: "Temp", email: "temp@example.com", role: "staff", password, actor: "system" });
    const { cookie } = await signIn("temp@example.com", password);
    expect(await getAdminFromHeaders(new Headers({ cookie }))).not.toBeNull();

    await updateAdminUser({ userId: user.id, disabled: true, actor: "system" });
    expect(await getAdminFromHeaders(new Headers({ cookie }))).toBeNull();
    expect((await signIn("temp@example.com", password)).status).toBeGreaterThanOrEqual(400);
  });

  it("password reset issues a new temporary password and revokes old sessions", async () => {
    const password = generateTemporaryPassword();
    const { user } = await createAdminUser({ name: "Reset Me", email: "reset@example.com", role: "staff", password, actor: "system" });
    const { cookie } = await signIn("reset@example.com", password);
    const { temporaryPassword } = await updateAdminUser({ userId: user.id, resetPassword: true, actor: "system" });
    expect(temporaryPassword).toHaveLength(20);
    expect(await getAdminFromHeaders(new Headers({ cookie }))).toBeNull();
    expect((await signIn("reset@example.com", password)).status).toBe(401);
    expect((await signIn("reset@example.com", temporaryPassword!)).status).toBe(200);
  });

  it("never removes the last active owner", async () => {
    const owners = (await listAdminUsers()).filter((u) => u.role === "owner" && !u.disabled);
    for (const owner of owners.slice(1)) await updateAdminUser({ userId: owner.id, disabled: true, actor: "system" });
    const last = (await listAdminUsers()).find((u) => u.role === "owner" && !u.disabled)!;
    await expect(updateAdminUser({ userId: last.id, role: "staff", actor: "system" })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(updateAdminUser({ userId: last.id, disabled: true, actor: "system" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects duplicate emails", async () => {
    await createAdminUser({ name: "Dup", email: "dup@example.com", role: "staff", password: generateTemporaryPassword(), actor: "system" });
    await expect(createAdminUser({ name: "Dup", email: "DUP@example.com", role: "staff", actor: "system" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

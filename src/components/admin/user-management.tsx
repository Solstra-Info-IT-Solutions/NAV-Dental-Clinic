"use client";

import { useState, type FormEvent } from "react";

import { InputField, SelectField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import type { AdminUserRecord } from "@/features/admin-users/service";

import { ConfirmButton } from "./confirm-button";
import { useAdminRequest } from "./use-admin-request";

type WithPassword = { user: AdminUserRecord; temporaryPassword?: string };

function OneTimePassword({ email, password }: { email: string; password: string }) {
  return (
    <Alert kind="warning" title={`Temporary password for ${email} — shown only once`} live>
      <p className="mt-2 select-all break-all rounded-sm bg-paper-50 p-3 font-mono text-lg" data-testid="temporary-password">
        {password}
      </p>
      <p className="mt-2 text-sm">Give it to the person privately (not by email or SMS if possible). They should keep it safe; it cannot be shown again.</p>
    </Alert>
  );
}

export function CreateUserForm() {
  const { send, pending, error } = useAdminRequest();
  const [created, setCreated] = useState<WithPassword | null>(null);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreated(null);
    const result = await send<WithPassword>("/api/admin/users", "POST", { name: form.get("name"), email: form.get("email"), role: form.get("role") });
    if (result.ok) {
      setCreated(result.data);
      event.currentTarget?.reset();
    }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? <Alert kind="error" title={error.message} live /> : null}
      {created?.temporaryPassword ? <OneTimePassword email={created.user.email} password={created.temporaryPassword} /> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <InputField id="u-name" name="name" label="Name" required error={error?.fields?.name} />
        <InputField id="u-email" name="email" label="Email" type="email" required error={error?.fields?.email} />
        <SelectField id="u-role" name="role" label="Role" defaultValue="staff">
          <option value="staff">Staff – appointments, schedule, enquiries</option>
          <option value="owner">Owner – everything, incl. settings and accounts</option>
        </SelectField>
      </div>
      <Button type="submit" loading={pending}>
        Create account
      </Button>
    </form>
  );
}

export function UserRowActions({ user, isSelf }: { user: AdminUserRecord; isSelf: boolean }) {
  const { send } = useAdminRequest();
  const [password, setPassword] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <ConfirmButton
          label={user.role === "owner" ? "Make staff" : "Make owner"}
          title={user.role === "owner" ? "Change to staff?" : "Give owner access?"}
          description={user.role === "owner" ? "They will lose access to settings, services, accounts and the audit log." : "Owners can change clinic settings, services and staff accounts."}
          confirmLabel="Change role"
          onConfirm={async () => {
            const r = await send(`/api/admin/users/${user.id}`, "PATCH", { role: user.role === "owner" ? "staff" : "owner" });
            return r.ok ? undefined : r.error.message;
          }}
        />
        {!isSelf ? (
          <ConfirmButton
            label={user.disabled ? "Enable" : "Disable"}
            title={user.disabled ? "Enable this account?" : "Disable this account?"}
            description={user.disabled ? "They will be able to sign in again." : "They are signed out immediately and cannot sign in until enabled again."}
            confirmLabel={user.disabled ? "Enable" : "Disable"}
            danger={!user.disabled}
            onConfirm={async () => {
              const r = await send(`/api/admin/users/${user.id}`, "PATCH", { disabled: !user.disabled });
              return r.ok ? undefined : r.error.message;
            }}
          />
        ) : null}
        <ConfirmButton
          label="Reset password"
          title="Reset this password?"
          description="A new temporary password is created and all their sessions are signed out."
          confirmLabel="Reset password"
          onConfirm={async () => {
            const r = await send<WithPassword>(`/api/admin/users/${user.id}`, "PATCH", { resetPassword: true }, { refresh: !isSelf });
            if (!r.ok) return r.error.message;
            setPassword(r.data.temporaryPassword ?? null);
          }}
        />
      </div>
      {password ? <OneTimePassword email={user.email} password={password} /> : null}
    </div>
  );
}

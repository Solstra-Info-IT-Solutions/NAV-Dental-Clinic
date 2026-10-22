"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { InputField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";

/** Email + password sign-in against Better Auth. Messages never reveal whether an account exists. */
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? ""), rememberMe: false }),
      });
      if (response.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      setError(
        response.status === 429
          ? "Too many sign-in attempts. Please wait 15 minutes and try again."
          : response.status === 403
            ? "This account cannot sign in. Please contact the clinic owner."
            : "The email or password is incorrect.",
      );
    } catch {
      setError("Could not reach the server. Check the connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {error ? <Alert kind="error" title={error} live /> : null}
      <InputField id="login-email" name="email" label="Email" type="email" autoComplete="username" required />
      <InputField id="login-password" name="password" label="Password" type="password" autoComplete="current-password" required minLength={12} />
      <Button type="submit" className="w-full" loading={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

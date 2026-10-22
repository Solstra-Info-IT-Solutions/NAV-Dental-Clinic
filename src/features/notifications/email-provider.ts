import "server-only";

import { serverEnv } from "@/config/env.server";

export type EmailMessage = { to: string[]; subject: string; text: string; html: string; replyTo?: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string }>;
}

export class EmailProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "EmailProviderError";
  }
}

/** Resend over its HTTPS API (https://resend.com/docs/api-reference/emails/send-email). */
export function createResendProvider(apiKey: string, from: string): EmailProvider {
  return {
    name: "resend",
    async send(message) {
      let response: Response;
      try {
        response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: message.to, subject: message.subject, text: message.text, html: message.html, reply_to: message.replyTo }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (error) {
        throw new EmailProviderError(`Network error contacting email provider: ${error instanceof Error ? error.name : "unknown"}`, true);
      }
      const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
      if (!response.ok || !body.id) {
        // 429 and 5xx are worth retrying; 4xx (bad address, unverified domain) are not.
        const retryable = response.status === 429 || response.status >= 500;
        throw new EmailProviderError(`Email provider responded ${response.status}: ${body.name ?? ""} ${body.message ?? ""}`.trim().slice(0, 400), retryable);
      }
      return { id: body.id };
    },
  };
}

let override: EmailProvider | null | undefined;

/** Test hook: force a provider (or `null` for "not configured"); pass `undefined` to restore. */
export function setEmailProviderForTests(provider: EmailProvider | null | undefined): void {
  override = provider;
}

/** The configured provider, or null when email has not been set up yet. */
export function getEmailProvider(): EmailProvider | null {
  if (override !== undefined) return override;
  const { RESEND_API_KEY, EMAIL_FROM } = serverEnv();
  return RESEND_API_KEY && EMAIL_FROM ? createResendProvider(RESEND_API_KEY, EMAIL_FROM) : null;
}

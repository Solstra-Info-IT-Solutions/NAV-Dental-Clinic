"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { ApiErrorPayload } from "@/lib/api/client";

type Method = "POST" | "PATCH" | "PUT" | "DELETE";

export type AdminRequestResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorPayload; status: number };

/**
 * Calls an admin API route and refreshes the Server Components on success.
 * Authorisation happens on the server; this only drives loading/error state.
 */
export function useAdminRequest() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<ApiErrorPayload | null>(null);

  async function send<T = unknown>(url: string, method: Method, body?: unknown, options: { refresh?: boolean } = {}): Promise<AdminRequestResult<T>> {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return { ok: false, status: 401, error: { code: "UNAUTHENTICATED", message: "Your session has ended. Please sign in again." } };
      }
      const json = response.status === 204 ? { data: null } : await response.json().catch(() => null);
      if (!response.ok || !json) {
        const apiError: ApiErrorPayload = json?.error ?? { code: "INTERNAL", message: "Something went wrong. Please try again." };
        setError(apiError);
        return { ok: false, status: response.status, error: apiError };
      }
      if (options.refresh !== false) startTransition(() => router.refresh());
      return { ok: true, data: json.data as T };
    } catch {
      const apiError = { code: "NETWORK", message: "Could not reach the server. Check the connection and try again." };
      setError(apiError);
      return { ok: false, status: 0, error: apiError };
    } finally {
      setPending(false);
    }
  }

  return { send, pending, error, setError };
}

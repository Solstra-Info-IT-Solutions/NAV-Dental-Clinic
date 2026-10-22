/**
 * Browser-side fetch helpers that normalise every outcome (success, API error
 * envelope, network failure) into one discriminated result.
 */
export type ApiErrorPayload = {
  code: string;
  message: string;
  fields?: Record<string, string>;
  requestId?: string;
  [key: string]: unknown;
};

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: ApiErrorPayload };

const NETWORK_ERROR: ApiErrorPayload = {
  code: "NETWORK",
  message: "We could not reach the clinic's website. Check your internet connection and try again.",
};

async function request<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(input, { ...init, headers: { Accept: "application/json", ...init?.headers } });
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR };
  }
  const body = (await response.json().catch(() => null)) as { data?: T; error?: ApiErrorPayload } | null;
  if (response.ok && body && "data" in body) return { ok: true, status: response.status, data: body.data as T };
  return {
    ok: false,
    status: response.status,
    error: body?.error ?? { code: "INTERNAL", message: "Something went wrong. Please try again or call the clinic." },
  };
}

export function getJson<T>(url: string, signal?: AbortSignal): Promise<ApiResult<T>> {
  return request<T>(url, { signal, cache: "no-store" });
}

export function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

import { getAuth } from "@/lib/auth/auth";

/**
 * Better Auth endpoints (sign-in, sign-out, session). Public sign-up is
 * disabled in the auth configuration; the handler is created lazily so the
 * database is only touched at request time.
 */
async function handle(request: Request): Promise<Response> {
  const auth = await getAuth();
  const response = await auth.handler(request);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const GET = handle;
export const POST = handle;

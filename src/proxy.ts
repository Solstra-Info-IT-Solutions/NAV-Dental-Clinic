import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { AUTH_COOKIE_PREFIX } from "@/lib/auth/constants";
import { indexingFromEnv } from "@/lib/seo/indexing";

const CANONICAL = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
const ENFORCE_CANONICAL_HOST = indexingFromEnv();

/**
 * 1. Production only: permanently redirect any other host (e.g. *.vercel.app,
 *    www/non-www) to the canonical domain, so search engines see one site.
 * 2. Optimistic redirect to the sign-in page for /admin without a session
 *    cookie. This is NOT the security boundary — every admin page, API route
 *    and action verifies the session on the server.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (ENFORCE_CANONICAL_HOST && request.nextUrl.host !== CANONICAL.host && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.protocol = CANONICAL.protocol;
    url.host = CANONICAL.host;
    url.port = CANONICAL.port;
    return NextResponse.redirect(url, 308);
  }

  if ((pathname === "/admin" || pathname.startsWith("/admin/")) && pathname !== "/admin/login") {
    if (!getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX })) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Everything except static assets and image optimisation.
  matcher: ["/((?!_next/static|_next/image|brand/|icon.svg|favicon.ico).*)"],
};

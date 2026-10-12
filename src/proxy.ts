/**
 * Route-protection proxy (Next.js 16 file convention).
 *
 * NOTE: In Next.js 16 the `middleware.ts` convention was renamed to
 * `proxy.ts` and the exported function renamed from `middleware` to `proxy`
 * (confirmed in the official Next.js 16.4 docs). This is that file.
 *
 * This is a FIRST-LINE, UX-level gate: it redirects obviously unauthenticated
 * visitors away from protected areas so they never see a flash of a dashboard.
 *
 * It is NOT the security boundary. Real authorization is enforced on the
 * server inside every protected page, server action and route handler via
 * requirePermission/assertPermission. Hiding routes here is never treated as
 * sufficient access control.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/** Routes that require an authenticated session. Covers every module in the
 *  application shell at this stage: dashboard, operators, trips, inspections,
 *  incidents, reports, audit, and settings. */
const PROTECTED_PREFIXES = [
  "/",
  "/operators",
  "/trips",
  "/inspections",
  "/incidents",
  "/reports",
  "/audit",
  "/settings",
] as const;

/** Routes that are always public (no session needed). */
const PUBLIC_PATHS = ["/login", "/forbidden"] as const;

const AUTH_ROUTES_PREFIX = "/api/auth";

function isProtectedPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PROTECTED_PREFIXES.some(
    (prefix) => prefix !== "/" && pathname.startsWith(prefix),
  );
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Never interfere with the auth API itself.
  if (pathname.startsWith(AUTH_ROUTES_PREFIX)) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  const hasSession = Boolean(sessionCookie);

  // Authenticated users have no reason to sit on the login page.
  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const isPublic =
    PUBLIC_PATHS.includes(pathname as (typeof PUBLIC_PATHS)[number]) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon");

  if (!isPublic && isProtectedPath(pathname) && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    // Preserve intended destination for a friendly post-login redirect.
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except static assets; the auth API short-circuits early.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

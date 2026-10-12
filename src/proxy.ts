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
 *
 * PHASE 2 DEFECT C — why this file no longer bounces `/login` to `/`:
 * The proxy can only see whether a session COOKIE is present; it cannot verify
 * it (no database access on this layer). The old "has cookie + on /login ->
 * redirect to /" rule therefore treated an expired or revoked cookie as a valid
 * session, while the dashboard guard treated the very same cookie as
 * unauthenticated and redirected back to /login. The two rules formed an
 * infinite redirect loop for anyone holding a stale cookie.
 *
 * The redirect for already-authenticated users now lives in the `/login` PAGE,
 * where the session is verified server-side against the database. The proxy
 * never trusts the mere presence of a cookie to mean "authenticated".
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/** Routes that require an authenticated session. Covers every module in the
 *  application shell at this stage: dashboard, operators, vehicles, routes,
 *  permits, trips, inspections, incidents, reports, audit, and settings. */
const PROTECTED_PREFIXES = [
  "/",
  "/operators",
  "/vehicles",
  "/routes",
  "/permits",
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

/** Static assets never need a session check. */
function isStaticAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/assets")
  );
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Never interfere with the auth API itself.
  if (pathname.startsWith(AUTH_ROUTES_PREFIX)) {
    return NextResponse.next();
  }

  const isPublic =
    PUBLIC_PATHS.includes(pathname as (typeof PUBLIC_PATHS)[number]) ||
    isStaticAssetPath(pathname);

  if (isPublic) {
    // `/login` is never redirected from here: the page itself verifies the
    // session server-side and forwards authenticated users to the dashboard.
    return NextResponse.next();
  }

  // Presence of a cookie is only a hint that a session MIGHT exist. If it is
  // absent, the visitor is definitely unauthenticated, so send them to login
  // with the intended destination preserved (path only, never a full URL, so
  // the value cannot be turned into an external redirect).
  if (isProtectedPath(pathname) && !getSessionCookie(request)) {
    const loginUrl = new URL("/login", request.url);
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

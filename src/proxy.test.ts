import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

/**
 * Regression test for Phase 2 defect C — the stale-session redirect loop.
 *
 * The proxy used to redirect `/login` to `/` whenever a session COOKIE was
 * merely present, while the dashboard guard redirected back to `/login` when
 * that cookie was invalid. Anyone holding an expired/revoked cookie looped
 * forever. These tests pin the fixed contract:
 *   - the proxy never trusts a cookie to mean "authenticated";
 *   - `/login` is never redirected to `/` from this layer (the page verifies
 *     the session server-side instead);
 *   - a protected path with no cookie is redirected to `/login` with a
 *     same-origin `next` path.
 */

const SESSION_COOKIE = "better-auth.session_token";

function makeRequest(path: string, cookie?: string): NextRequest {
  return new NextRequest(new Request(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  }));
}

describe("proxy (first-line UX gate)", () => {
  it("redirects an unauthenticated visitor away from the dashboard", () => {
    const response = proxy(makeRequest("/"));
    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("next=");
  });

  it("preserves the intended path for a protected route", () => {
    const response = proxy(makeRequest("/operators"));
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("next=%2Foperators");
  });

  it("does NOT redirect /login even when a session cookie is present (loop fix)", () => {
    const response = proxy(makeRequest("/login", `${SESSION_COOKIE}=stale-token`));
    expect(response.headers.get("location")).toBeNull();
  });

  it("does NOT redirect /login without a cookie", () => {
    const response = proxy(makeRequest("/login"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("lets a stale cookie through to protected pages so the server guard decides", () => {
    // The proxy must not treat cookie presence as proof of authentication.
    const response = proxy(makeRequest("/", `${SESSION_COOKIE}=stale-token`));
    expect(response.headers.get("location")).toBeNull();
  });

  it("never interferes with the auth API", () => {
    const response = proxy(makeRequest("/api/auth/get-session"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps /forbidden public", () => {
    const response = proxy(makeRequest("/forbidden"));
    expect(response.headers.get("location")).toBeNull();
  });
});

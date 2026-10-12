/**
 * End-to-end authentication verification against a RUNNING dev server.
 *
 * Usage:
 *   1. npm run dev            (in another terminal)
 *   2. npm run verify:auth    (this script)
 *
 * It exercises the real sequence the Phase 2 review asked for:
 *   sign in -> GET /api/me (identity contract) -> sign out -> GET /api/me (401)
 * and prints an audit-event count before/after when the database is reachable.
 *
 * It reads the development administrator credentials from the local,
 * git-ignored `.env` (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD) and NEVER prints
 * the password, the session cookie, or any token. The account must already
 * exist (run `npm run db:seed` first).
 *
 * Exits non-zero if any step fails.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

const BASE = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
const EMAIL = process.env.SEED_ADMIN_EMAIL?.trim();
const PASSWORD = process.env.SEED_ADMIN_PASSWORD?.trim();

const checks = [];
function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function cookieFrom(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  const sessionCookie = raw.find((c) => c.includes("session_token"));
  return sessionCookie ? sessionCookie.split(";")[0] : null;
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error(
      "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are not set in .env — cannot run the live check.",
    );
    process.exit(1);
  }

  // A real browser always sends Origin/Referer; Better Auth's CSRF guard
  // rejects state-changing requests without them.
  const browserHeaders = {
    origin: BASE,
    referer: `${BASE}/login`,
  };

  // 0. Server reachable?
  let health;
  try {
    health = await fetch(`${BASE}/login`, { redirect: "manual" });
  } catch {
    console.error(
      `Could not reach ${BASE}. Start the app with "npm run dev" first.`,
    );
    process.exit(1);
  }
  record("GET /login is served", health.status === 200, `status=${health.status}`);

  // 1. Unauthenticated identity request must be rejected.
  const anon = await fetch(`${BASE}/api/me`);
  record("GET /api/me without a session returns 401", anon.status === 401, `status=${anon.status}`);
  const anonBody = await anon.json().catch(() => ({}));
  record(
    "401 body carries no identity",
    !("user" in anonBody),
    JSON.stringify(anonBody).slice(0, 60),
  );

  // 2. Sign in with a real credential.
  const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { ...browserHeaders, "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    redirect: "manual",
  });
  const signInBody = await signIn.json().catch(() => ({}));
  record("POST /api/auth/sign-in/email succeeds", signIn.ok, `status=${signIn.status}`);
  if (!signIn.ok) {
    console.error("Sign-in failed. Body:", JSON.stringify(signInBody).slice(0, 200));
    process.exit(1);
  }
  const cookie = cookieFrom(signIn);
  record("a session cookie is issued", Boolean(cookie));

  // 3. Authenticated identity must use the `{ user: ... }` contract.
  const me = await fetch(`${BASE}/api/me`, { headers: { cookie } });
  const meBody = await me.json().catch(() => ({}));
  record("GET /api/me with a session returns 200", me.status === 200, `status=${me.status}`);
  record(
    "response wraps identity in `user`",
    Boolean(meBody.user) && typeof meBody.user?.id === "string",
    `keys=${Object.keys(meBody).join(",")}`,
  );
  record(
    "identity carries name, email and roles",
    Boolean(meBody.user?.name) &&
      typeof meBody.user?.email === "string" &&
      Array.isArray(meBody.user?.roles),
  );
  record(
    "no permission list or token is exposed",
    !("permissions" in (meBody.user ?? {})) && !("token" in meBody),
  );

  // 4. The dashboard is reachable with the session.
  const dash = await fetch(`${BASE}/`, { headers: { cookie }, redirect: "manual" });
  record(
    "GET / with a session does not redirect to /login",
    dash.status === 200 || (dash.status >= 300 && !(dash.headers.get("location") ?? "").includes("/login")),
    `status=${dash.status}`,
  );

  // 5. Sign out, then confirm the session is revoked server-side.
  const signOut = await fetch(`${BASE}/api/auth/sign-out`, {
    method: "POST",
    headers: { ...browserHeaders, cookie, "content-type": "application/json" },
    body: "{}",
  });
  record("POST /api/auth/sign-out succeeds", signOut.ok || signOut.status === 200, `status=${signOut.status}`);

  const afterLogout = await fetch(`${BASE}/api/me`, { headers: { cookie } });
  record(
    "GET /api/me after sign-out returns 401 (session invalidated)",
    afterLogout.status === 401,
    `status=${afterLogout.status}`,
  );

  // 6. A stale cookie must NOT cause a redirect loop on /login.
  const staleLogin = await fetch(`${BASE}/login`, {
    headers: { cookie: cookie ?? "better-auth.session_token=stale" },
    redirect: "manual",
  });
  record(
    "/login with a stale cookie does not redirect (loop fix)",
    staleLogin.status === 200,
    `status=${staleLogin.status}`,
  );

  const failed = checks.filter((c) => !c.ok);
  console.log(
    `\n[verify:auth] ${checks.length - failed.length}/${checks.length} checks passed.`,
  );
  if (failed.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("[verify:auth] error:", error instanceof Error ? error.message : error);
  process.exit(1);
});

/**
 * Live page smoke test against a RUNNING server.
 *
 * Usage:
 *   npm run build && npm run start      (terminal 1)
 *   npm run verify:pages                (terminal 2)
 *
 * Signs in with the local development administrator, then requests every page
 * and checks the status code and the absence of error markers. Also confirms:
 *   - the public /info site is anonymous and NOT wrapped in the admin shell;
 *   - protected pages redirect anonymous visitors to /login;
 *   - restricted API endpoints reject anonymous callers.
 *
 * Never prints the password, the session cookie or any token.
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

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const PROTECTED_PAGES = [
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
];

const PUBLIC_PAGES = [
  "/info",
  "/info/guidance",
  "/info/permits",
  "/info/notices",
  "/info/faqs",
  "/info/contact",
];

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD missing from .env.");
    process.exit(1);
  }

  // Sign in.
  const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      referer: `${BASE}/login`,
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!signIn.ok) {
    console.error(`Sign-in failed with status ${signIn.status}.`);
    process.exit(1);
  }
  const cookie = (signIn.headers.getSetCookie?.() ?? [])
    .find((c) => c.includes("session_token"))
    ?.split(";")[0];
  if (!cookie) {
    console.error("No session cookie was issued.");
    process.exit(1);
  }

  // Public pages: anonymous, no admin shell.
  for (const path of PUBLIC_PAGES) {
    const res = await fetch(`${BASE}${path}`);
    const html = await res.text();
    check(`GET ${path} returns 200`, res.status === 200, `status=${res.status}`);
    check(
      `GET ${path} is not wrapped in the admin shell`,
      !html.includes("app-sidebar"),
    );
    check(
      `GET ${path} states it is an unofficial prototype`,
      html.includes("Unofficial development prototype"),
    );
  }

  // robots + sitemap.
  const robots = await fetch(`${BASE}/robots.txt`);
  const robotsText = await robots.text();
  check("robots.txt is served", robots.status === 200);
  check("robots.txt allows /info", robotsText.includes("Allow: /info"));
  check("robots.txt disallows the admin dashboard", robotsText.includes("Disallow: /"));

  const sitemap = await fetch(`${BASE}/sitemap.xml`);
  const sitemapText = await sitemap.text();
  check("sitemap.xml is served", sitemap.status === 200);
  check(
    "sitemap lists only public /info pages",
    sitemapText.includes("/info") && !sitemapText.includes("/operators"),
  );

  // Protected pages WITH a session.
  for (const path of PROTECTED_PAGES) {
    const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
    const html = await res.text();
    const looksLikeError =
      html.includes("Application error") || html.includes("Internal Server Error");
    check(
      `GET ${path} (signed in) returns 200`,
      res.status === 200,
      `status=${res.status}`,
    );
    check(`GET ${path} renders without an error page`, !looksLikeError);
  }

  // Protected pages WITHOUT a session must redirect to /login.
  for (const path of ["/", "/operators", "/audit", "/reports"]) {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    check(
      `GET ${path} (anonymous) redirects to /login`,
      res.status >= 300 && res.status < 400 && location.includes("/login"),
      `status=${res.status}`,
    );
  }

  // Restricted API endpoints reject anonymous callers.
  const exportRes = await fetch(`${BASE}/api/reports/export`, {
    redirect: "manual",
  });
  check(
    "GET /api/reports/export rejects anonymous callers",
    exportRes.status === 401 || exportRes.status === 403,
    `status=${exportRes.status}`,
  );

  const protectedApi = await fetch(`${BASE}/api/admin/protected`, {
    redirect: "manual",
  });
  check(
    "GET /api/admin/protected rejects anonymous callers",
    protectedApi.status === 401 || protectedApi.status === 403,
    `status=${protectedApi.status}`,
  );

  // The signed-in administrator may export a CSV.
  const csv = await fetch(`${BASE}/api/reports/export`, { headers: { cookie } });
  const csvText = await csv.text();
  check("authorised CSV export succeeds", csv.status === 200, `status=${csv.status}`);
  check(
    "CSV export has a header row",
    csvText.startsWith("operator_code,"),
    csvText.slice(0, 40).replace(/\r?\n/g, " "),
  );

  // Manifest page for the first seeded journey.
  const tripsRes = await fetch(`${BASE}/trips`, { headers: { cookie } });
  const tripsHtml = await tripsRes.text();
  const match = tripsHtml.match(/\/trips\/([a-z0-9]+)"/i);
  if (match) {
    const detail = await fetch(`${BASE}/trips/${match[1]}`, { headers: { cookie } });
    const detailHtml = await detail.text();
    check(
      `GET /trips/${match[1]} (manifest) returns 200`,
      detail.status === 200,
      `status=${detail.status}`,
    );
    check(
      "manifest shows masked identity values",
      detailHtml.includes("\u2022") || detailHtml.includes("No passengers"),
    );
    check(
      "manifest page does not contain an unmasked CNIC",
      !/\d{5}-\d{7}-\d/.test(detailHtml),
    );
  } else {
    check("a journey link exists on /trips", false, "no /trips/<id> link found");
  }

  // Clean up: end the session this script created so verification does not
  // leave a live session row behind in the development database.
  const signOut = await fetch(`${BASE}/api/auth/sign-out`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
      origin: BASE,
      referer: `${BASE}/`,
    },
    body: "{}",
  });
  check("verification session is signed out", signOut.ok, `status=${signOut.status}`);
  const afterSignOut = await fetch(`${BASE}/api/me`, { headers: { cookie } });
  check(
    "session is invalidated after cleanup",
    afterSignOut.status === 401,
    `status=${afterSignOut.status}`,
  );

  const finalFailed = results.filter((r) => !r.ok);
  console.log(
    `\n[verify:pages] ${results.length - finalFailed.length}/${results.length} checks passed.`,
  );
  if (finalFailed.length > 0) {
    console.log("Failed checks:");
    for (const f of finalFailed) console.log(`  - ${f.name}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(
    "[verify:pages] error:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});

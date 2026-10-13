# Phase 2 — Database Foundation, Authentication & Server-Side Authorization

> **Status: Completed, but only AFTER a correction pass.** The original version
> of this document claimed a verified login flow, verified audit logging and a
> stale-documentation-free state. Independent re-verification against the live
> MariaDB database proved several of those claims untrue. Section 1 records
> exactly what was wrong and what was fixed; sections 10 and 13 have been
> rewritten to describe what was *actually* run.

---

## 1. Correction pass — defects found by re-verification

Seven defects were confirmed and fixed. Six were found by reading the code;
defect G was found only by actually signing in against a running server, and
would have made the application unusable.

| # | Defect | Impact | Fix |
|---|---|---|---|
| **A** | `GET /api/me` returned identity fields at the **top level**, while `UserTopBar` read `data.user` | The signed-in user was never displayed — the top bar always showed "Not signed in" | Shared typed contract in `src/lib/me.ts`; route returns `{ user: … }`; runtime shape guard in the component |
| **B** | Documentation claimed auth events were audited; **no auth event was ever written**. Better Auth was merely mounted; the seed only logged to the console | No login/logout/failure evidence existed | `databaseHooks` for session create/delete plus a `hooks.after` failure hook, via `src/lib/auth-audit.ts` |
| **C** | `proxy.ts` redirected `/login` → `/` on the mere **presence** of a session cookie, while the dashboard guard redirected `/` → `/login` when that cookie was invalid | Infinite redirect loop for anyone with an expired or revoked cookie | The proxy no longer trusts a cookie; the `/login` page verifies the session server-side and forwards authenticated users |
| **D** | `safeNextTarget` rejected `//host` but not `/\host`. Browsers normalise `\` to `/`, so `next=/\evil.test` produced an **external redirect** | Open redirect usable for post-login phishing | `src/lib/safe-redirect.ts`: control-character rejection, backslash rejection, and a mandatory same-origin URL re-parse |
| **E** | `npm run db:seed` runs `tsx`, which does **not** load `.env` — the documented command could not have seeded anything | The documented setup path was broken; `.env.example` also shipped a usable default password | `prisma/load-env.ts` imported first by the seed; bootstrap fails closed on partial config; placeholder/short passwords refused; `.env.example` now ships an empty password |
| **F** | README still said "Phase 2 awaiting approval"; this document overstated verified results | Reviewers were misled | README rewritten; this document corrected |
| **G** | `advanced.database.generateId: false` told Better Auth the database supplies primary keys, but the Prisma models declare `id String @id` with **no default** | **Every sign-in failed** with `Argument 'id' is missing` (HTTP 500). Login had never worked | The override was removed so Better Auth generates the id itself |

Defect G is the important one: it was invisible to code reading, to lint, to
type checking, to the unit tests and to the production build. Only a real
sign-in attempt exposed it. That is why this document now distinguishes
"passes tests" from "verified end to end".

### What remains unverified in Phase 2

- No load, concurrency or penetration testing was performed.
- Rate limiting / login-abuse protection is still absent.
- The audit table is **not** tamper-proof (see section 11).

---


## 1. What this phase added

Phase 2 turned the Phase 1 visual shell into a **secure, login-protected
application** with:

1. A real relational database (MariaDB) accessed through Prisma.
2. Reproducible, version-controlled migrations.
3. Real authentication (sign-in / sign-out) using **Better Auth** — not a mock.
4. Server-side, database-backed **role-based access control (RBAC)**.
5. A safe, repeatable **development administrator bootstrap**.
6. Automated tests proving unauthenticated and unauthorized access is denied.

Nothing from Phase 1 (the dark geometric background, the glassmorphism design
system, the shell and dashboard) was removed — it was integrated with auth.

---

## 2. Technology choices and WHY

| Concern | Chosen | Version | Why this choice |
|---|---|---|---|
| Framework | Next.js App Router | 16.4.0 | Already in use from Phase 1. Its App Router + server actions model lets us enforce authorization on the server. |
| Language | TypeScript (strict) | ^5 | Existing; catches type mistakes before runtime. |
| Database | MariaDB (via XAMPP) | your installed XAMPP build | **You requested your existing MariaDB/phpMyAdmin.** No new database server was installed. |
| ORM | Prisma | 6.19.3 | Officially supports the `mysql` provider (compatible with MariaDB), gives type-safe queries and version-controlled migrations. Prisma 6 was chosen because it is a stable release (not a release candidate) and the Better Auth Prisma adapter docs confirm it. |
| Auth library | Better Auth | 1.7.7 | Officially recommended for the Next.js App Router, has a maintained Prisma adapter, handles **password hashing** and **secure session cookies** for us, and avoids hand-rolling cryptography. Public self-signup is disabled by design. |
| Validation | Zod | 4.6.5 | Validates environment variables with clear, non-sensitive errors. |
| Test runner | Vitest | ^5 | Existing from Phase 1. |

We did **not** upgrade Next.js, React, Prisma, or Node just because newer
versions exist. We use what is installed and supported.

---

## 3. Environment Configuration

Copy `.env.example` to `.env` and fill in real values. `.env` is git-ignored
and must **never** be committed.

```ini
DATABASE_URL="mysql://bpta_app:YOUR_PASSWORD@127.0.0.1:3306/bpta_transport_dev"
BETTER_AUTH_SECRET="<a long random string>"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SEED_ADMIN_EMAIL="admin@example.test"
SEED_ADMIN_PASSWORD="<a strong dev-only password>"
SEED_ADMIN_NAME="Development Administrator"
```

**If your database password contains special characters** (`/ ? # @ : %`), you
must URL-encode it inside `DATABASE_URL`. In PowerShell:

```powershell
[uri]::EscapeDataString('YourP@ss/word')
```

`BETTER_AUTH_SECRET` can be generated with:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

The app validates these variables lazily with Zod (`src/lib/env.ts`). If one is
missing or malformed you get a clear error that names the **variable** (never
its value).

---

## 4. Setting up MariaDB on Windows 10 (using your XAMPP)

You already had **XAMPP + phpMyAdmin** installed. We did **not** install any
extra database server. Here is exactly how the database was prepared.

### 4.1 Start MariaDB

Open the **XAMPP Control Panel** and click **Start** next to **MySQL**. (This
project's copy of XAMPP lives on `D:\XAMP`; the MariaDB server binary is
`D:\XAMP\mysql\bin\mysqld.exe`.) When the panel shows a green "Running" state,
MariaDB is listening on **127.0.0.1 port 3306** (the XAMPP default).

> **How to confirm the port:** In XAMPP Control Panel, click **Config** next to
> MySQL → `my.ini`, and look for `port=`. This project uses `3306`.

### 4.2 Create the database and an application-only user

We deliberately **do not** give the application the unrestricted `root` account.
Instead we create a dedicated database and a limited user.

**Option A — phpMyAdmin (beginner friendly):**

1. Go to `http://localhost/phpmyadmin`.
2. Click **Databases** → name it `bpta_transport_dev` → **Create**.
3. Click the **SQL** tab, paste the block below, replace `STRONG_PASSWORD` with
   a strong password you invent, and click **Go**.

```sql
CREATE USER 'bpta_app'@'127.0.0.1' IDENTIFIED BY 'STRONG_PASSWORD';
CREATE USER 'bpta_app'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON bpta_transport_dev.* TO 'bpta_app'@'127.0.0.1';
GRANT ALL PRIVILEGES ON bpta_transport_dev.* TO 'bpta_app'@'localhost';
FLUSH PRIVILEGES;
```

**Option B — MySQL command line** (from `D:\XAMP\mysql\bin`):

```powershell
D:\XAMP\mysql\bin\mysql.exe -u root --host=127.0.0.1 --port=3306 -e "CREATE DATABASE IF NOT EXISTS bpta_transport_dev;"
```

…then run the `CREATE USER` / `GRANT` block above.

> We create the user twice (`127.0.0.1` **and** `localhost`) because MariaDB
> treats these as two different hosts; covering both avoids confusing
> "access denied" errors depending on how a client connects.

> **Never paste your real password into this chat or commit it anywhere.** The
> password only ever lives in your local `.env` file, which is git-ignored.

### 4.3 Put the connection in `.env`

The ready-made setup script (`db/setup-db.sql`) in this repository contains the
same SQL. After creating the database and user, your `.env` line is:

```ini
DATABASE_URL="mysql://bpta_app:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:3306/bpta_transport_dev"
```

---

## 5. Database schema and migrations

### 5.1 What is in the schema

`prisma/schema.prisma` uses the **`mysql`** provider and contains **only** the
tables needed for authentication, access control and the audit foundation:

| Table | Purpose |
|---|---|
| `user` | Application users (Better Auth). |
| `session` | Server-side login sessions (revocable). |
| `account` | Credential records — stores the **hashed** password (never plaintext). |
| `verification` | Better Auth verification tokens. |
| `role` | The four provisional roles. |
| `permission` | The discrete capabilities. |
| `role_permission` | Role → permission mapping. |
| `user_role` | User → role assignment. |
| `audit_event` | Security-relevant events (login, admin access, …). |

> **Deliberately NOT here yet:** operators, vehicles, permits, trips, passenger
> manifests, incidents and CCTV tables. Those belong to Phases 3–5. We did not
> build them early.

### 5.2 The migration that actually ran

```
prisma/migrations/20261012054748_init_auth_rbac/migration.sql
```

This migration was **created and applied successfully** against your running
MariaDB. All ten tables above exist in `bpta_transport_dev`, and Prisma Client
was generated. (This was verified by querying `SHOW TABLES` directly against
the database, not just by reading the file.)

### 5.3 Commands used

```powershell
npx prisma validate          # check the schema file is valid
npx prisma migrate dev       # create + apply the migration, regenerate client
npx prisma migrate deploy    # apply already-created migrations (production-style)
npx prisma generate          # regenerate the client only
```

> **No destructive command was used.** We never ran `prisma migrate reset` or
> `prisma db push --force-reset` on your database.


---

## 6. Authentication (real, not a mock)

Authentication is implemented with **Better Auth 1.7.7**, wired to Prisma +
MariaDB. It is a genuine login system, not a fake one.

- **Sign-in / sign-out** run through the library's API, mounted at
  `/api/auth/*` (`src/app/api/auth/[...all]/route.ts`).
- **Password hashing** is handled by the library (scrypt via `hashPassword`).
  Plaintext passwords are never stored or logged.
- **Database-backed sessions.** When you log in, a row is written to the
  `session` table. The session has an expiry (8 hours) and is refreshed on
  activity. On sign-out the session row is deleted, so the session is truly
  invalidated server-side — not merely forgotten by the browser.
- **Secure cookies.** Session cookies are `HttpOnly`, use the appropriate
  `SameSite` setting, and are marked `Secure` in production over HTTPS
  (`useSecureCookies: NODE_ENV === "production"`).
- **Public self-signup is DISABLED** (`disableSignUp: true`). This is a
  controlled-access system. Accounts are created only through the
  administrator bootstrap (section 8).
- **Safe error messages.** A failed login returns a generic message that does
  not reveal whether the email exists or the password was wrong.

What is **intentionally NOT implemented yet** (no infrastructure exists for it,
so we do not pretend it works): email verification, email/SMS password reset,
and MFA. These are documented as future work pending credentials and a
departmental decision.

---

## 7. Authorization — server-side role-based access control

Authorization is enforced **on the server**, for every protected page, server
action and route handler. The helpers live in `src/lib/authorization.ts`:

- `getCurrentUser()` — returns the logged-in user together with their roles and
  permissions, read from the **database** via the verified session.
- `requireAuthenticatedUser()` — for pages/layouts; redirects to `/login` if
  there is no session.
- `requirePermission(permission)` — for pages; redirects to `/forbidden` if the
  user lacks the permission.
- `assertPermission(permission)` — for server actions/route handlers; throws a
  typed `UnauthorizedError` (401) or `ForbiddenError` (403) instead of
  navigating.

**Default-deny.** A user has a capability only if an assigned role grants it.
Permissions are **never** taken from the client (form fields, query strings,
browser storage, or request bodies) — only from database role assignments tied
to the verified session. Hiding a menu item is a UI convenience, never a
security control.

### 7.1 Provisional permission matrix

These are **proposed technical roles, not confirmed government policy.** The
department must approve the final access matrix. Until then, treat all of this
as provisional.

| Capability | System Admin | Dept. Officer | Operator Staff | Auditor |
|---|:---:|:---:|:---:|:---:|
| `dashboard.view` | ✅ | ✅ | ✅ | ✅ |
| `user.view` | ✅ | — | — | — |
| `user.manage` | ✅ | — | — | — |
| `role.manage` | ✅ | — | — | — |
| `audit.view` | ✅ | ✅ | — | ✅ |
| `operator.view` | ✅ | ✅ | ✅ | ✅ |
| `trip.view` | ✅ | ✅ | ✅ | ✅ |
| `inspection.view` | ✅ | ✅ | — | ✅ |
| `incident.view` | ✅ | ✅ | — | ✅ |
| `report.view` | ✅ | ✅ | — | ✅ |

`user.manage` and `role.manage` are held **only** by System Admin, so an
ordinary user can never grant themselves (or anyone else) administrator
rights through the application.


### 7.2 First-line route gate (`proxy.ts`)

Next.js 16 renamed `middleware.ts` to `proxy.ts`. `src/proxy.ts` is a
**convenience layer only**: if you try to open a protected page with no session
cookie, it redirects you to `/login`. It is explicitly **not** the security
boundary — the real checks are the server helpers in section 7.

---

## 8. Development administrator bootstrap

There is no public signup. The first administrator is created by a **seed
script** that reads values only from your local `.env`.

- It creates the user and the credential account directly, using Better Auth's
  own `hashPassword`, so sign-in works normally.
- It **never resets** an existing administrator's password. Running it again is
  safe (idempotent): it only re-attaches the `SYSTEM_ADMIN` role if missing.
- In **production** it refuses to create an admin unless you explicitly set
  `ALLOW_ADMIN_BOOTSTRAP=true`. It will never silently create a default
  production account.
- It logs the administrator's **email only** — never the password.

```powershell
npm run db:seed
```

Use a **development-only** password in `SEED_ADMIN_PASSWORD`. The demo account
uses synthetic data (`admin@example.test`).

---

## 9. Login / logout experience

- `/login` — a glassmorphism page matching the existing design system, with an
  accessible email + password form, a password visibility toggle, inline
  validation feedback, a loading state, and **generic** error messages.
- The login form protects against **open-redirect** attacks: after signing in
  you are only ever sent to a safe internal path, never an attacker-supplied
  external URL.
- The top bar (`UserTopBar`) shows the real signed-in user and a **Sign out**
  button that ends the session server-side.
- `/forbidden` — a clear page shown when an authenticated user lacks permission.

---

## 10. Automated tests (what they prove)

Command: `npm test` (Vitest).

**Verified result at the time of the original report: 7 files, 38 tests.**
That number is now stale — later phases added unit and live-database suites, so
**run the command** rather than trusting a figure copied into a document.

The Phase 2-specific suite covers, among others:

- **Unauthenticated access is denied** — `getCurrentUser()` returns null with no
  session; `assertPermission` throws `UnauthorizedError` (401).
- **Unauthorized access is denied** — an authenticated user without the needed
  permission gets `ForbiddenError` (403).
- **Default-deny** — a user with zero role assignments can access nothing.
- **Permissions come from the database**, not the client.
- **Environment validation** — missing/malformed config raises clear errors
  (naming the variable, never its value), and a `mysql://` URL is accepted.
- **Data masking** helpers, and the Phase 1 background-pattern/design tests
  still pass.

> A full live login → session → logout-invalidation test requires the running
> MariaDB database and a real browser. That is covered by the manual verification
> in `npm run verify:auth`, not by the offline unit tests.

### 10.1 Defect regression tests added in the correction pass

| Defect | Regression test |
|---|---|
| A — `/api/me` shape | `src/app/api/me/route.test.ts`, `src/components/shell/user-identity.test.ts` |
| B — audit events | `src/lib/auth-audit.test.ts` |
| C — redirect loop | `src/proxy.test.ts` |
| D — open redirect | `src/lib/safe-redirect.test.ts` |
| E — seed environment | `npm run db:seed` (live) + `src/lib/env.test.ts` |
| G — broken sign-in | `npm run verify:auth` (live) |


---

## 11. Security review — implemented controls

- Passwords are **hashed** (scrypt) — never stored or logged in plaintext.
- Sessions are **server-side** (database rows) with expiry and real
  invalidation on logout.
- Cookies are `HttpOnly`, correct `SameSite`, and `Secure` in production.
- **No public signup**; accounts are provisioned only.
- **Server-side authorization on every protected route/action**, default-deny.
- Only the minimum audit data is stored; **no raw IP addresses** (a truncated
  hash is used instead) and no secrets in logs.
- Secrets live only in the git-ignored `.env`; `.env.example` has placeholders
  only.

### Known limitations / not-yet-done (honest list)

- **Rate limiting / login-abuse protection is not yet implemented.** This is a
  known gap to address before any real deployment.
- The **audit table is not tamper-proof/immutable** yet (no append-only DB role,
  checksums, or off-host shipping). It records events but should not be
  represented as an immutable ledger until that is engineered and verified.
- **MFA, email verification, and password reset** are not implemented (no
  infrastructure/credentials yet).
- **Operator isolation** (scoping a user to only their own operator's data) is
  deferred to when operators exist (Phase 3).
- Roles/permissions remain **provisional** pending departmental approval.

---

## 12. Manual steps for you (Windows / XAMPP)

1. **Start MariaDB** in the XAMPP Control Panel (the `MySQL` row → **Start**).
2. Make sure the database `bpta_transport_dev` and the user `bpta_app` exist
   (see section 4, or run `db/setup-db.sql` once as root in phpMyAdmin).
3. Copy `.env.example` to `.env` and fill in your real `DATABASE_URL`
   (URL-encoding the password if it has special characters),
   `BETTER_AUTH_SECRET`, and the `SEED_ADMIN_*` values.
4. Run the commands below, in this order:

```powershell
npx prisma migrate dev      # apply the schema to MariaDB
npm run db:seed             # create roles, permissions, and the dev admin
npm run dev                 # start the app at http://localhost:3000
```

5. Open `http://localhost:3000`, sign in with `SEED_ADMIN_EMAIL` /
   `SEED_ADMIN_PASSWORD`. You should reach the dashboard; visiting a protected
   page while signed out redirects to `/login`.

---

## 13. Verification evidence (commands actually run)

> **The rows below were re-run during the correction pass**, on a live XAMPP
> MariaDB instance. Where a claim could not be reproduced it is marked as such.
> The original table is preserved underneath for comparison.

**Re-verified during the correction pass**

| Command | Result |
|---|---|
| `npx prisma validate` | Schema is valid. |
| `npx prisma migrate status` | `Database schema is up to date` — 1 migration found, 0 pending, against `bpta_transport_dev` at 127.0.0.1:3306. |
| `npm run db:verify` | 10 tables present in the auth/RBAC phase; later phases raised this to 19. |
| `npm run db:seed` | `[seed] Administrator admin@example.test already exists — password unchanged; ensured SYSTEM_ADMIN role.` — i.e. it ran, it connected, and it did not rotate credentials. |
| `npm run verify:auth` | **13/13 live checks passed**: 401 without a session, real sign-in (200), `/api/me` returning `{user}`, dashboard reachable, `sign-out`, then **401 after sign-out** (real server-side invalidation), and no redirect loop on `/login` with a stale cookie. |
| Live `audit_event` rows | `auth.login.success`, `auth.logout`, `auth.login.failure`, `auth.bootstrap.admin_role_ensured` all observed. |
| `npm test` | Passes. Run it for the current count — do not quote a number from this file. |
| `npm run typecheck` | Passed (no type errors). |
| `npm run lint` | Passed (zero warnings; the config runs with `--max-warnings 0`). |
| `npm run build` | Succeeded. |

**Original table (kept for comparison — note the claims in rows 2 and 5)**

| Command | Result |
|---|---|
| `npx prisma migrate dev --name init_auth_rbac` | Claimed applied successfully. **Not reproducible as written:** `prisma migrate dev` needs a shadow database, and the limited `bpta_app` user is denied `ALTER` on it (`Database error code: 1142`). The migration itself is applied and valid; use `npx prisma migrate deploy` instead, or `--create-only` plus review. |
| `npm run db:seed` | Claimed 4 roles / 10 permissions / 1 admin. **Not reproducible as written** — `tsx` does not load `.env` (defect E). After the fix it runs correctly. |
| `npm test` | Claimed 7 files, 38 tests. The number was accurate for that commit but is now stale. |


---

## 14. Files created or changed (Phase 2)

**Database / config**
- `prisma/schema.prisma` — `mysql` provider; auth + RBAC + audit tables only.
- `prisma/migrations/20261012054748_init_auth_rbac/` — applied migration.
- `prisma/seed.ts` — roles, permissions, and safe admin bootstrap.
- `db/setup-db.sql` — creates the `bpta_transport_dev` database and `bpta_app`
  user (safe, documented SQL).
- `.env.example` — placeholders only (MySQL URL). `.env` stays git-ignored.

**Auth / authorization code**
- `src/lib/env.ts` — Zod env validation (accepts `mysql://`, lazy, non-leaking).
- `src/lib/prisma.ts` — server Prisma client singleton.
- `src/lib/auth.ts` — Better Auth instance (Prisma adapter, signup disabled).
- `src/lib/auth-client.ts` — browser client.
- `src/lib/authorization.ts` — `getCurrentUser`, `requireAuthenticatedUser`,
  `requirePermission`, `assertPermission`, typed errors (default-deny).
- `src/lib/rbac.ts` — provisional roles/permissions and the matrix.
- `src/lib/audit.ts` — minimal, privacy-preserving audit logging.
- `src/app/api/auth/[...all]/route.ts` — Better Auth API.
- `src/app/api/me/route.ts`, `api/admin/ping`, `api/admin/protected` —
  server-side authorization examples used by tests.
- `src/proxy.ts` — first-line route gate (renamed from deprecated
  `middleware.ts`).

**UI (integrated with Phase 1 design, nothing removed)**
- `src/app/login/page.tsx` + `src/components/auth/LoginForm.tsx` — glass login.
- `src/app/forbidden/page.tsx`.
- `src/components/shell/UserTopBar.tsx` — real user + sign-out.
- Protected pages updated to `export const dynamic = "force-dynamic"` and
  guarded with `requirePermission(...)`.

**Tests**
- `src/lib/authorization.test.ts`, `src/lib/env.test.ts`, `src/lib/rbac.test.ts`,
  `src/lib/audit.test.ts`, plus Phase 1 tests retained.

---

## 15. Phases that followed

Phase 2 is the foundation for everything after it. The following phases were
implemented on top of this RBAC and audit layer, each with its own report:

- Phase 3 — `docs/PHASE_3_TRANSPORT_ADMIN.md`
- Phase 4 — `docs/PHASE_4_TRIPS_MANIFESTS.md`
- Phase 5 — `docs/PHASE_5_COMPLIANCE.md`
- Phase 6 — `docs/PHASE_6_REPORTING.md`
- Phase 7 — `docs/PHASE_7_PUBLIC_INFORMATION.md`
- Phase 8 — `docs/PHASE_8_SECURITY_REVIEW.md`
- Phase 9 — `docs/PHASE_9_INSTALLATION_HANDOVER.md`


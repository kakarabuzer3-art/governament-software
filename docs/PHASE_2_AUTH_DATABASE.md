# Phase 2 — Database Foundation, Authentication & Server-Side Authorization

> Status: **Completed** (MariaDB/XAMPP integration verified; automated tests
> passing; production build succeeding). This document records what was
> actually implemented, why, and what remains. It is written for a beginner
> and separates confirmed work from things that still need a department
> decision.

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

**Result: 7 test files, 38 tests, all passing.** They cover, among others:

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
> in section 12, not by the offline unit tests.


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

| Command | Result |
|---|---|
| `npx prisma validate` | Schema is valid. |
| `npx prisma migrate dev --name init_auth_rbac` | Migration created and **applied to MariaDB**; client generated. |
| `SHOW TABLES` (mysql client) | All 10 tables present (`user`, `account`, `session`, `verification`, `role`, `permission`, `role_permission`, `user_role`, `audit_event`, `_prisma_migrations`). |
| `npm run db:seed` | 4 roles with correct permission counts (10 / 7 / 7 / 3), 10 permissions, 1 admin user, 1 admin→SYSTEM_ADMIN assignment. |
| `npm test` | **7 files, 38 tests passed.** |
| `npm run typecheck` | Passed (no type errors). |
| `npm run lint` | Passed (no lint errors). |
| `npm run build` | **Succeeded.** Auth-gated routes render as Dynamic (`ƒ`); `/login` is static; Next.js 16 recognizes `proxy.ts`. |


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

## 15. Next phase (not started)

**Phase 3 — Operators, Vehicles, Permits & Routes:** CRUD workflows with
server-side validation, relationships, filters, pagination, and audit events —
all behind the RBAC foundation built here. It will not be started until you
return with the reviewed report and an approved instruction.


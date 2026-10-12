# Phase 8 — Security, Regression and Quality Review

> Status: **Review performed and evidence recorded below.**
> This is a development prototype. Nothing here constitutes a production
> security assurance or a penetration test.

---

## 1. Verification commands and actual results

All commands were run in this workspace against Windows 10, XAMPP MariaDB and
Node.js v24.19.0.

| Command | Result |
|---|---|
| `npm run lint` | Passed — 0 errors, 0 warnings (`--max-warnings 0`) |
| `npm run typecheck` | Passed — no type errors (`strict`) |
| `npm test` | **19 files, 166 tests, all passed** |
| `npm run build` | Succeeded — 29 routes; `/info/*`, `/robots.txt`, `/sitemap.xml` static |
| `npx prisma validate` | Schema valid |
| `npx prisma migrate status` | Schema up to date; 3 migrations applied |
| `npm run db:verify` | 19 tables; live row counts for auth, RBAC and transport tables |
| `npm run verify:auth` | **13/13** live auth checks passed |
| `npm run verify:pages` | **56/56** live page/SEO/authorization checks passed |
| `npx vitest run tests/phase3-integration.test.ts` | **14/14** against live MariaDB |
| `npx vitest run tests/phase4-phase5-integration.test.ts` | **9/9** against live MariaDB |

Test categories are deliberately separated:

- **Unit tests (no I/O)** use mocked collaborators. They prove logic and
  contracts but say nothing about the database.
- **Live-database integration tests** use real Prisma queries against
  `bpta_transport_dev`. They skip automatically when `DATABASE_URL` is absent,
  and they clean up exactly the rows they created (namespaced `ZZ…` prefixes).
  They never reset, truncate or drop anything.
- **Live end-to-end scripts** (`verify:auth`, `verify:pages`) exercise the
  running application over HTTP.

## 2. Authentication and session handling

| Control | Status | Evidence |
|---|---|---|
| Real credential sign-in | Working | `verify:auth` POST returns 200 (it returned **500** before defect G was fixed) |
| Session invalidation on sign-out | Working | `verify:auth`: `/api/me` returns 401 after sign-out; `session` row count returns to 0 |
| No public sign-up | Enforced | `disableSignUp: true` |
| Password hashing | Library-managed | Better Auth scrypt; no plaintext stored or logged |
| Stale cookie does not loop | Fixed and tested | `verify:auth` step 13; `src/proxy.test.ts` |
| Cookie-only access | Not trusted | The proxy is UX only; every page/action re-verifies server-side (`src/proxy.test.ts` asserts it) |
| Login error disclosure | Generic | One message for every rejected credential; no account-enumeration oracle |

## 3. Authorization and RBAC

- **Default deny.** A capability exists only if an assigned database role grants
  it. A user with no role assignments can access nothing
  (`authorization.test.ts`).
- **Server-side enforcement everywhere.** Pages use `requirePermission`; server
  actions use `requireTransportContext` (which calls `assertPermission`); route
  handlers call it directly. Hiding a button is never the control.
- **Direct API requests are rejected.** Verified live: `/api/reports/export` and
  `/api/admin/protected` return **401** to anonymous callers.
- **Least privilege.** `user.manage` and `role.manage` are held only by
  SYSTEM_ADMIN. AUDITOR receives only `*_view` permissions — no manage
  capability and no `report.export`.
- **Permissions are never taken from the client.** Roles and permissions are
  read from `user_role` → `role_permission` via the verified session.

## 4. Operator isolation — the strongest requirement

| Rule | Enforcement | Evidence |
|---|---|---|
| Scope from trusted relations only | `resolveOperatorScope()` reads roles + `user_operator` from the session | `scope.test.ts` (7 tests) |
| Unassigned operator account sees nothing | Empty id list → `operatorId: { in: [] }` | live: `listOperators` returned `total = 0` |
| Cross-operator read denied | Reported as 404 so existence is not confirmed | live: `getOperatorOrThrow` threw `NotFoundError` |
| Cross-operator write denied | `requireOperatorInScope` on every vehicle/permit/trip/inspection/incident write | live: creating a vehicle for a foreign operator threw `NotFoundError` |
| Scoped list contains only own records | Prisma filter fragment on every list query | live: vehicles/permits/incidents lists contained only the assigned operator |
| Employee cannot escalate by role-sharing | Scope is per-user assignments, not per-role | Same live tests |

## 5. Sensitive passenger data

| Control | Status |
|---|---|
| Encryption at rest (AES-256-GCM) | Verified live — stored columns are `v1:` ciphertext and contain no plaintext |
| Tamper detection | Verified — modified ciphertext throws `FieldDecryptionError` |
| Keyed fingerprint (not a plain hash) | Verified — different key yields a different digest |
| Fail closed without a key | Verified — writes are refused, never stored in plaintext |
| Masking in ordinary views | Verified — masked values contain `•`; the encrypted columns are not selected by list queries |
| Reveal requires permission + is audited | Verified — `passenger.revealed` row written; the audit row contains **none** of the revealed values |
| No passenger values in errors/logs | Verified — the reveal audit row was scanned for the CNIC, mobile and address |
| Withdraw instead of delete | Verified live |

## 6. Input validation, integrity and injection

- Every create/update is parsed by Zod **on the server**; the browser form is
  advisory only (`validation.test.ts`, 20 tests).
- Uniqueness is enforced by database constraints as well as pre-checks, so a
  race cannot create a duplicate (`P2002` is mapped to a field-scoped message).
- Relationship integrity: a permit's vehicle must belong to the permit's
  operator; an incident's journey must belong to its operator; foreign keys use
  RESTRICT or SET NULL appropriately.
- **SQL injection**: all reads/writes go through Prisma's parameterised query
  builder. The only raw SQL is in `scripts/verify-db.ts`, where the table name
  comes from a fixed internal array, not from user input.
- **XSS**: React escapes rendered values; no `dangerouslySetInnerHTML` exists
  anywhere in the codebase. Exported CSV is escaped (`csvCell` quotes commas,
  quotes and newlines) and served with `nosniff`.
- **Open redirect**: `safe-redirect.test.ts` (9 cases) covers protocol-relative,
  backslash-normalised, control-character and absolute-URL inputs.
- **Error disclosure**: `toFormState` converts unknown errors to a generic
  message and logs details server-side only; route handlers return generic 500s.

## 7. Auditability

Recorded: auth success/failure/logout, admin bootstrap, all Phase 3–5 record
changes, passenger reveal, report export, and demo-data seeding.

**Not implemented, and stated as such in the UI:** the audit table is not
tamper-proof — no append-only database role, checksum chaining, off-host
shipping or write-once storage. `/audit` carries an explicit warning.

## 8. Accessibility

- Skip link, one `<h1>` per page, real landmarks (`header`/`main`/`nav`/`footer`).
- Form fields have associated labels, `aria-invalid`, `aria-describedby` and
  `role="alert"` error messages.
- Status pills pair colour with text; colour is never the only signal.
- Visible focus rings via a global `:focus-visible` rule.
- `prefers-reduced-motion` disables animation and transition durations.
- Filters and the report form are plain `GET` forms, so they work without
  JavaScript.
- Responsive layouts with a collapsible sidebar and an off-canvas mobile drawer.

**Not verified:** no automated axe/Lighthouse audit, no screen-reader testing,
and no formal keyboard-only walkthrough was performed. Urdu/RTL presentation has
**not** been implemented anywhere; the interface is English-only.

## 9. Dependency and configuration posture

- `npm audit` was **not** run as part of this review; dependency vulnerability
  status is unverified.
- No `--force` / `--legacy-peer-deps` install was performed, and no dependency
  was upgraded.
- Secrets live only in the git-ignored `.env`; `.env.example` contains
  placeholders only, with an empty `SEED_ADMIN_PASSWORD` and an empty
  `FIELD_ENCRYPTION_KEY`.
- `.env` is confirmed ignored by Git (`git check-ignore`).
- The seed refuses placeholder/short passwords and never prints them, and never
  rotates an existing administrator's password.

## 10. Residual risks and known gaps

| Risk | Severity | Note |
|---|---|---|
| No rate limiting or lockout | High for real deployment | Login abuse is unmitigated |
| Audit trail not tamper-proof | High | Not acceptable as sole evidence |
| Local env-var key, no rotation/revocation | High | Needs a managed KMS |
| No MFA / email verification / password reset | Medium | No infrastructure exists |
| No dependency vulnerability scan | Medium | Not run |
| Roles/permissions and status vocabularies provisional | Medium | Awaiting departmental approval |
| No production hosting, backups or DR | High | Out of scope for this prototype |
| No RTL/Urdu support | Medium | Required for real public use |
| No automated accessibility audit | Medium | Manual review only |
| Automated tests do not cover UI interaction | Medium | No browser/E2E test runner; the live smoke test covers server-rendered pages only |

## 11. What was deliberately NOT done

- No penetration test, load test or fuzzing.
- No change to the mandated background or design system.
- No connection to any external government service or identity database.
- No facial recognition, footage storage, streaming or automated enforcement.
- No live deletion or retention automation.
- No `prisma migrate reset`, no destructive schema change, no data deletion
  beyond test rows created by the tests themselves.

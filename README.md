# Balochistan Transport Security & Compliance Management System

**Development prototype — UNAPPROVED, NOT AN OFFICIAL GOVERNMENT SERVICE.**

This repository contains an in-progress development prototype of a passenger
transport security and compliance workflow proposed for Balochistan. It is
**not** approved, certified, endorsed or hosted by any government department,
and it must not be presented as such. Scope, authority, hosting, retention and
acceptance all remain subject to departmental confirmation.

All data in the development database is **synthetic**. No real passenger,
CNIC, vehicle or official record is required, expected or present.

---

## 1. Verified project status

| Phase | Scope | Status | How it was verified |
|---|---|---|---|
| 0 | Workspace audit, requirements register | Complete | `docs/PHASE_0_WORKSPACE_AUDIT.md` |
| 1 | Design foundation (geometric background, glass system, shell) | Complete | Background-pattern unit test still passes |
| 2 | MariaDB + Prisma, Better Auth, server-side RBAC, audit foundation | **Complete — 7 defects fixed** | 13/13 live auth checks; live `audit_event` rows |
| 3 | Operators, vehicles, routes, permits (CRUD) + operator isolation | Complete | 14 live-MariaDB integration tests |
| 4 | Trips + passenger manifests (masking + encryption at rest) | Complete | 9 live-MariaDB integration tests |
| 5 | CCTV inspections + incident records | Complete | Included in the Phase 4/5 integration suite |
| 6 | Database-backed dashboard, reports, audit trail, CSV export | Complete | 56/56 live page checks incl. authorised export |
| 7 | Separate public information site + SEO | Complete | Public pages anonymous & indexable, admin not |
| 8 | Security/regression review | Complete, with documented gaps | See `docs/PHASE_8_SECURITY_REVIEW.md` |
| 9 | Installation & handover guide | Complete | `docs/PHASE_9_INSTALLATION_HANDOVER.md` |

| | |
|---|---|
| Runtime | Node.js 20.9+ (developed and verified on v24.19.0) |
| Framework | Next.js 16.4 (App Router, Turbopack), React 19.3 |
| Language | TypeScript 5, `strict` |
| Database | MariaDB via XAMPP, Prisma 6.19 with the `mysql` provider |
| Auth | Better Auth 1.7.7 (database sessions, no public signup) |
| Validation | Zod 4 (server-side, every write) |
| Tests | Vitest 5 — see section 5 |

### What is NOT built (scope honesty)

Passenger manifests, CCTV and incidents are implemented as described; the
following remain **out of scope or unverified**:

- No government API, NADRA/police/immigration integration, or permit
  verification of any kind. "Permit status" is a *recorded* value only.
- No live CCTV streaming, footage storage, facial recognition or automated
  enforcement. None is planned without separate written approval.
- No email verification, password reset, MFA or rate limiting.
- No production deployment, hosting hardening, backups or DR plan.
- No automatic data deletion. The stated 10-day retention is recorded as a
  minimum only; the approved retention/legal-hold policy is unknown.
- No PDF export. CSV export exists.

---

## 2. Commands (PowerShell, in this folder)

```powershell
npm install          # install dependencies (also runs prisma generate)
npm run dev          # development server -> http://localhost:3000
npm run lint         # ESLint (fails on any warning)
npm run typecheck    # tsc --noEmit
npm test             # Vitest: unit + live-database integration tests
npm run build        # production build

npm run db:seed      # roles/permissions, optional admin, synthetic demo data
npm run db:verify    # READ-ONLY live database inspection
npm run db:deploy    # apply pending migrations (non-destructive)
npm run db:studio    # Prisma Studio

npm run verify:auth  # live login/logout/session-invalidation checks (app must be running)
npm run verify:pages # live page + SEO + authorization smoke test (app must be running)
```

See `docs/PHASE_9_INSTALLATION_HANDOVER.md` for first-time Windows setup.

---

## 3. Project structure

```
prisma/
  schema.prisma         19 tables: auth, RBAC, audit, and Phases 3–5 records
  migrations/           additive, version-controlled migrations
  seed.ts               idempotent seed: roles, admin bootstrap, demo data
  load-env.ts           loads .env for scripts (tsx does not)
scripts/
  verify-db.ts          read-only live database report
  e2e-auth.mjs          live auth sequence verification
  smoke-pages.mjs       live page/SEO/authorization smoke test
src/
  app/                  App Router pages
    api/me/             typed identity contract (shared with the top bar)
    api/reports/export/ permission-checked, audited CSV export
    info/               PUBLIC information site (anonymous, indexable)
    operators|vehicles|routes|permits|trips|inspections|incidents|reports|audit
  components/
    shell/              AppShell (admin chrome; bypassed for /info)
    transport/          shared list/form/filter/pagination/reveal components
    public/             public site frame
    ui/                 glass UI kit (Badge, DataTable, Modal, StatCard…)
  lib/
    authorization.ts    getCurrentUser, requirePermission, assertPermission
    rbac.ts             provisional roles/permissions matrix
    crypto/             AES-256-GCM field encryption + keyed fingerprints
    transport/          scope, validation, services, server actions
    retention.ts        retention policy (automatic deletion DISABLED)
  styles/               tokens, background, glass, shell, auth, transport, public
docs/                   phase reports and this handover set
```

---

## 4. Design system (mandatory visual identity)

- `src/styles/background.css` reproduces the **exact supplied geometric
  pattern** (`#1d1d1d`, `#4e4f51`, `#3c3c3c`, 200px tile, 30° conic repeats) as
  a fixed layer behind every screen — admin **and** public. A unit test guards
  these values so the pattern cannot be silently replaced.
- `src/styles/tokens.css` holds every design token.
- `src/styles/glass.css` holds the reusable glassmorphism components.
- `src/styles/transport.css` and `src/styles/public.css` add module styles
  without redefining the background or palette.
- Reduced-motion, visible focus rings and a skip link are global.

---

## 5. Testing

`npm test` runs Vitest. Test categories are deliberately separated:

| Kind | Files | Notes |
|---|---|---|
| Unit (no I/O) | rbac, scope, validation, masking, crypto, retention, CSV, proxy, redirects, identity rendering | Pure functions, mocked collaborators |
| Live MariaDB integration | `tests/phase3-integration.test.ts`, `tests/phase4-phase5-integration.test.ts` | Real Prisma queries against `bpta_transport_dev` |

Live integration tests **skip automatically** when `DATABASE_URL` is absent,
and each run cleans up only the exact rows it created (namespaced `ZZ…`
prefixes). No test resets, truncates or drops anything.

Run the suites yourself to see current counts — do not rely on a number copied
into a document.

---

## 6. Security & privacy posture

**Implemented**

- Database-backed sessions with real server-side invalidation on sign-out.
- Server-side authorization on every protected page, server action and route
  handler. Default deny. Hiding a button is never the control.
- Operator data isolation from the `user_operator` table — never from a
  submitted operator id. Unassigned operator accounts see nothing.
- AUDITOR is strictly read-only; user/role management is admin-only.
- Passenger identity numbers, mobile numbers and addresses encrypted with
  AES-256-GCM; keyed fingerprints for duplicate detection without decryption.
- Masked-by-default display; full reveal requires permission and is audited.
- Audit events for auth outcomes, administrative changes, reveals and exports.
- Secrets live only in the git-ignored `.env`; `.env.example` has placeholders.

**Known gaps — do not treat this build as production ready**

- The audit table is **not tamper-proof**: no append-only DB role, checksum
  chaining or off-host shipping. It must not be described as immutable.
- Encryption uses a local environment variable, not a managed KMS. There is no
  key rotation or revocation process.
- No rate limiting or login-abuse protection.
- No MFA, email verification or password reset.
- Roles, permissions and all status vocabularies are **provisional** and need
  departmental confirmation.
- No production hosting, backup or disaster-recovery arrangements.

---

## 7. Documentation

- `docs/PHASE_0_WORKSPACE_AUDIT.md` — original audit and architecture
- `docs/PHASE_2_AUTH_DATABASE.md` — auth/database foundation **with corrections**
- `docs/PHASE_3_TRANSPORT_ADMIN.md`
- `docs/PHASE_4_TRIPS_MANIFESTS.md`
- `docs/PHASE_5_COMPLIANCE.md`
- `docs/PHASE_6_REPORTING.md`
- `docs/PHASE_7_PUBLIC_INFORMATION.md`
- `docs/PHASE_8_SECURITY_REVIEW.md`
- `docs/PHASE_9_INSTALLATION_HANDOVER.md`
- `docs/REQUIREMENTS_REGISTER.md` — requirement IDs and statuses
- `docs/DESIGN_SYSTEM.md` — tokens, components, usage rules

# Phase 0 — Workspace Audit & Requirements Baseline

_Date of audit: 10 October 2026 (local environment: Windows 10, PowerShell)_

## 1. Workspace findings

| Item | Result |
|---|---|
| Working directory | `C:\Users\Abuzer Kakar\Desktop\Goverament software` |
| Existing files | **None** — the folder was completely empty (0 items, no hidden files) |
| Existing application | None; this is a green-field project |
| Git repository | Not present → initialized after scaffolding (see §5) |
| Node.js | v24.19.0 ✅ (Next.js 16 requires ≥ 20.9) |
| npm | 11.17.0 ✅ |
| Git | 2.55.0.windows.5 ✅ |
| PostgreSQL / Docker | Not installed (not required until Phase 2) |

**Conclusion:** no existing work existed, so there was nothing to preserve or
migrate. The default architecture from the master instructions was applied.

## 2. Documentation consulted (official sources)

- **Next.js 16.4 release blog** (6 Oct 2026): current stable release; new
  apps enable Cache Components by default; React 19.3.
- **September 2026 Next.js security release** (30 Sep 2026): critical/high
  issues fixed in 16.3.8 / 15.5.27. The scaffolded app uses Next **16.4.0**,
  which is on the patched line.
- **Next.js installation docs**: `next build` no longer runs ESLint — linting
  is a separate npm script (configured accordingly).

## 3. Technical decisions taken (deferred safely; no user input required)

| # | Decision | Rationale |
|---|---|---|
| D1 | Next.js 16.4 + App Router + React 19.3 + TypeScript 5 strict | Default stack from master instructions; verified current & patched |
| D2 | Plain CSS design system (4 files under `src/styles/`) instead of styled-components/Tailwind | The supplied pattern is pure CSS; a token system avoids per-page one-off glass effects and keeps the bundle small for low-RAM machines |
| D3 | Background reproduced **literally** (same values, positions, sizes) as a fixed full-viewport layer | Mandatory visual requirement; guarded by unit test |
| D4 | Inline SVG icon registry (no icon library) | Small footprint, no extra dependency |
| D5 | Vitest (unit) in Phase 1; Playwright (e2e) deferred to a later phase | Lightweight first; still provides real verification now |
| D6 | No database, auth, or real data in Phase 1 | Phase boundary per master plan |
| D7 | App metadata `robots: noindex, nofollow` | Internal tool must never be search-indexed |
| D8 | `@types/node` raised from ^20 → ^24 | Required by Vitest 5 peer dependency; matches installed Node 24 |

## 4. Proposed module structure

Modular monolith under `src/`, one folder per responsibility:

- `auth/` (Phase 2) — sessions, login, password policy
- `users/roles/` (Phase 2) — accounts, roles, permissions
- `operators/vehicles/routes/permits/` (Phase 3)
- `trips/manifests/` (Phase 4)
- `inspections/incidents/` (Phase 5)
- `reports/audit/` (Phase 6)
- `settings/retention/` (Phases 4–6, pending policy)

Shared: `lib/` (utilities), `types/` (contracts), `styles/` (design system),
`components/ui` (reuse), `components/shell` (layout).

## 5. Repository safety

- Git repository initialized; every phase produces reviewable commits.
- `.gitignore` (create-next-app default) excludes `node_modules`, `.next`,
  `.env*` — secrets stay out of source control.
- No `.env` file exists yet; none is needed until Phase 2.

## 6. Risks & blockers identified

| ID | Risk / blocker | Impact | Status |
|---|---|---|---|
| R1 | Project approval, scope and authority unconfirmed | Nothing may claim official status | **Pending department decision** |
| R2 | Retention policy beyond the stated 10-day minimum unknown | Automatic cleanup must stay disabled | **Pending department decision** |
| R3 | Role model (admin/officer/operator/auditor) unconfirmed | Roles are provisional until confirmed | **Pending department decision** |
| R4 | Hosting, data residency and backup arrangements unapproved | No production deployment allowed | **Pending department decision** |
| R5 | No official APIs authorized (NADRA/police/immigration) | Integrations blocked; honest placeholders only | **Pending department decision** |
| R6 | Letter photograph is not a full specification | Requirements register marks unverified items | Ongoing |
| R7 | Dev-machine limits (Windows 10, limited RAM) | Avoid Docker/heavy tooling; minimal deps | Mitigated |

## 7. Assumptions recorded

- A1: English is the first UI language; Urdu/RTL, Pashto and Balochi come
  later when translations are approved.
- A2: The proposed role categories in the master instructions are used only
  as placeholders until the department confirms them.
- A3: The supplied letter's requirements are treated as *proposed* input,
  not confirmed legal obligations (see requirements register).

## 8. Phase 1 plan (as executed)

1. Scaffold Next.js 16.4 + TS + ESLint in place; initialize Git. ✅
2. Design tokens + exact geometric background + glass component CSS. ✅
3. Responsive app shell: collapsible sidebar, mobile drawer, top bar. ✅
4. Dashboard with synthetic data + honest placeholder pages for all
   planned modules. ✅
5. Lint / type-check / unit tests / production build verified. ✅

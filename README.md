# Balochistan Transport Security & Compliance Management System

**Development preview — unapproved project.** This repository contains an
in-progress development version of a passenger transport security and
compliance management system associated with a *proposed* Balochistan
government transport workflow. It is **not** an approved, certified or
officially endorsed government service, and it must not be presented as one
until the department confirms scope, authority, hosting and acceptance.

All data currently shown by the application is **synthetic sample data**.
No real passenger, CNIC, vehicle or official record exists in this codebase.

---

## Current status

| | |
|---|---|
| Phase | **Phase 1 complete** — design foundation + application shell |
| Next | Phase 2 — data architecture and authentication (awaiting approval) |
| Node.js | 20.9+ (developed and tested on v24.19.0) |
| Framework | Next.js 16.4 (App Router, Turbopack), React 19.3, TypeScript 5 (strict) |

## Commands (run in PowerShell, in this folder)

```powershell
npm install        # install dependencies (first time / after changes)
npm run dev        # start the development server -> http://localhost:3000
npm run lint       # ESLint static analysis
npm run typecheck  # TypeScript type checking (no output = success)
npm test           # Vitest unit tests
npm run build      # production build (also type-checks the app)
```

## Project structure

```
src/
  app/                 Pages (App Router): dashboard + module placeholders
  components/
    shell/             AppShell (sidebar, top bar), navigation, placeholders
    ui/                Reusable glass components: Badge, DataTable, Modal,
                       StatCard, EmptyState, icons
    dashboard/         Dashboard-specific client components
  lib/                 Utilities: demo-data (synthetic), masking helpers
  styles/              Design system: tokens.css, background.css, glass.css,
                       shell.css  (imported by app/globals.css)
  types/               Shared TypeScript types
tests/                 Unit tests (background pattern regression guard)
docs/                  Phase reports, requirements register, audit notes
```

## Design system (mandatory visual identity)

- `src/styles/background.css` reproduces the **exact supplied geometric
  pattern** (`#1d1d1d / #4e4f51 / #3c3c3c`, 200px tile, 30° conic repeats)
  as a fixed layer behind the whole application. A unit test guards these
  values so the pattern cannot be silently replaced.
- `src/styles/tokens.css` holds every design token (glass fills, blur,
  spacing, typography, motion, focus rings, semantic status colours).
- `src/styles/glass.css` contains the reusable glassmorphism components
  (panels, buttons, badges, tables, forms, modal, chips) with a fallback
  for browsers without `backdrop-filter`.

## Security & privacy notes

- The app is marked `noindex, nofollow` — it must never be search-indexed.
- No secrets, credentials or real personal data are stored in this repository.
- Authentication, server-side authorization, encryption and audit logging
  are scheduled for later phases (see `docs/REQUIREMENTS_REGISTER.md`).

## Documentation

- `docs/PHASE_0_WORKSPACE_AUDIT.md` — audit findings, architecture, risks
- `docs/REQUIREMENTS_REGISTER.md` — requirement IDs, sources, statuses
- `docs/DESIGN_SYSTEM.md` — tokens, components and usage rules

# Phase 6 — Dashboard, Reports, Audit Trail and Exports

> Status: **Implemented and verified.** All figures come from live MariaDB
> queries, scoped to the signed-in user's permissions and operator scope.

---

## 1. Dashboard — now database-backed

The dashboard (`/`) no longer contains invented statistics. Every card is a live
`COUNT` filtered by the caller's operator scope:

operators · vehicles · active permits (with pending and "expiring within 30
days") · journeys (with upcoming) · manifest entries (aggregate only) · open
incidents.

It also shows the most recent journeys as a real table, a compliance snapshot
built from recorded inspection results and incident statuses, and quick links.

**Why the synthetic data was removed:** `src/lib/demo-data.ts` still exists for
historical reference, but the dashboard no longer imports it. Presenting
fabricated figures inside a government-workflow prototype is not acceptable
even when they are labelled as samples. A comment in that module says so
explicitly so nobody silently reintroduces it.

The manifest-entry card shows **"Restricted"** and a count is never computed for
a user without `manifest.view`.

## 2. Reports

`/reports` renders an **operator-wise summary**: vehicles, active permits,
pending permits, journeys, incidents and inspections per operator, with an
optional inclusive date window applied to journeys (departure), incidents
(occurrence) and inspections (inspection date). Vehicle and permit figures are
current-state totals, and the page says so rather than blurring the two.

Aggregation uses grouped queries (`groupBy`) rather than one query per operator.

Filters are a plain `GET` form — they work without JavaScript and produce
shareable URLs.

## 3. CSV export — a permission-checked, audited route handler

`GET /api/reports/export` is a **route handler**, reachable by direct HTTP
request, so it performs its own authorization:

1. `requireTransportContext(REPORT_EXPORT)` — verifies the session and the
   permission against the database.
2. `getOperatorReport(ctx.scope, range)` — the same scope filtering as the page,
   so an operator cannot export another operator's data.
3. A `report.exported` audit event is written **before** the file is returned.
4. Response headers: `text/csv; charset=utf-8`, an attachment filename,
   `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.

Anonymous callers receive **401**; authenticated callers without the permission
receive **403**. Nothing internal is echoed on failure.

Only CSV is implemented. PDF export was not built and is not claimed.

## 4. Audit trail

`/audit` lists audit events with an action filter, an outcome filter and
pagination, and shows the distinct action types currently recorded.

Recorded events include: `auth.login.success`, `auth.login.failure`,
`auth.logout`, `auth.bootstrap.*`, `operator.*`, `vehicle.*`, `route.*`,
`permit.*`, `trip.*`, `passenger.created|updated|removed|restored|revealed`,
`inspection.*`, `incident.*`, `report.exported` and `system.seed.demo_data`.

### Honest limitation, stated in the UI

The audit table **is not tamper-proof**. No append-only database role, checksum
chaining, off-host shipping or write-once storage has been engineered. The page
carries a prominent warning saying exactly that, so it cannot be mistaken for
immutable evidence. The application exposes no way to edit or delete audit rows,
but a database administrator could alter them.

## 5. Verification evidence

`npm run verify:pages` — **56/56 live checks passed**, including:

| Check | Result |
|---|---|
| `/`, `/reports`, `/audit` signed in | 200, rendered without an error page |
| `/reports`, `/audit` anonymous | 307 redirect to `/login` |
| `GET /api/reports/export` anonymous | **401** |
| `GET /api/reports/export` signed in with permission | **200**, CSV begins with the `operator_code,` header row |
| `GET /api/admin/protected` anonymous | **401** |

Unit coverage for the reporting helpers (date-range parsing, CSV escaping,
header/CRLF handling) lives in `src/lib/transport/reports.test.ts`.

## 6. Pending departmental decisions

- The approved report set, formats (PDF/Excel) and any statutory reporting
  deadlines.
- Who may export data, and whether exports require a second authoriser.
- Whether an export register (separate from the audit trail) is required.

# Phase 3 — Transport Administration (Operators, Vehicles, Routes, Permits)

> Status: **Implemented and verified against live MariaDB.**
> All vocabulary, permissions and workflows below are **provisional** and await
> departmental confirmation.

---

## 1. What was built

Real, database-backed CRUD for four record types — not placeholder screens and
not hardcoded arrays:

| Module | Page | Capabilities |
|---|---|---|
| Operators | `/operators` | Create, update, archive, search, status filter, pagination |
| Vehicles | `/vehicles` | Create, update, archive, search, operator link, unique registration |
| Routes | `/routes` | Create, update, archive, search by code/name/city |
| Permits | `/permits` | Create, update, archive, operator/vehicle/route links, recorded status + provenance |

Every list page supports search, a status filter, pagination and an honest empty
state. Every form shows server-returned field errors and a success banner, and
the submit button disables while the action is in flight.

## 2. Data model

Five new tables, applied by an **additive** migration
(`20261012112548_phase3_transport_records`): `operator`, `vehicle`, `route`,
`permit`, `user_operator`.

- Uniqueness: `operator.code`, `operator.registrationNumber`,
  `vehicle.registrationNumber`, `route.code`, `permit.permitNumber`.
- Foreign keys: `vehicle → operator` (RESTRICT),
  `permit → operator` (RESTRICT), `permit → vehicle` (SET NULL),
  `permit → route` (SET NULL),
  `user_operator → user/operator` (CASCADE).
- Indexes on every status column, the operator columns, cities and
  `permit.expiresOn`.
- **Statuses are plain strings**, validated by Zod, not database enums. The
  value sets are provisional and must be changeable without a schema migration.

### Archiving, never deletion

There is no delete path anywhere in Phase 3. Records are deactivated
(`status = ARCHIVED` plus `archivedAt`) and are excluded from lists unless the
archived status is explicitly requested. History is preserved.

### Permit status is a RECORDED value

`permit.status` is the status *entered by a user*, and `permit.recordedSource`
records where it came from (`MANUAL_ENTRY`, `DOCUMENT_UPLOAD`,
`DEPARTMENT_NOTICE`, `UNVERIFIED`). No government source is contacted and no
permit is verified. The UI states this on the permits page.

## 3. Server-side business logic

`src/lib/transport/` contains a testable service layer:

| File | Responsibility |
|---|---|
| `validation.ts` | Zod schemas for every create/update; controlled vocabularies published for client use |
| `scope.ts` | Operator scope resolution and Prisma filter fragments |
| `context.ts` | `requireTransportContext(permission)` — session + permission + scope |
| `crud.ts` | Pagination, Prisma unique-violation mapping, audit wrapper |
| `errors.ts` | Typed errors → serialisable `FormState` |
| `operators.ts` / `vehicles.ts` / `routes.ts` / `permits.ts` | The four services |
| `actions.ts` | Server actions; one per create/update/archive |

Enforced server-side on every write:

- Zod validation (the browser copy is advisory only).
- Duplicate handling with a **field-scoped** message, backed by a database
  unique constraint so a race cannot slip through.
- Relationship integrity — a permit's vehicle must belong to the permit's
  operator; vehicles, trips and permits must reference existing rows.
- Audit events: `operator.created`, `vehicle.updated`, `permit.archived`, etc.

## 4. Authorization and operator isolation

Permissions added (provisional): `operator.manage`, `vehicle.view`,
`vehicle.manage`, `route.view`, `route.manage`, `permit.view`, `permit.manage`.

| Role | Operators/Vehicles/Routes/Permits |
|---|---|
| System Administrator | Full management |
| Department Officer | Full management |
| Operator Staff | **Read-only, and only their assigned operator's records** |
| Read-Only Auditor | Read-only across the system |

Isolation rules, all enforced from the database — never from a submitted id:

1. `resolveOperatorScope()` maps the verified session's roles and
   `user_operator` rows to a scope. Department-wide roles are unrestricted;
   everyone else is limited to their assignments.
2. An **unassigned** operator account resolves to an empty id list, which
   produces `operatorId: { in: [] }` — it matches nothing.
3. A record outside the scope is reported as **404 Not Found**, so the API
   never confirms that another operator's record exists.
4. `Vehicle.create` and `Permit.create` re-check the target operator against
   the scope, so a crafted form post cannot attach a record to a foreign
   operator.

`user_operator` is a **proposed technical mechanism**, not approved policy.

## 5. Verification evidence

Run by the verification pass:

| Command | Result |
|---|---|
| `npm run db:verify` | `operator`, `vehicle`, `route`, `permit`, `user_operator` present with rows |
| `npx vitest run tests/phase3-integration.test.ts` | **14/14 passed** against live MariaDB |
| Duplicate handling | `ConflictError` observed for duplicate operator code and duplicate vehicle registration |
| Cross-operator denial | `NotFoundError` observed for foreign reads and for attaching a vehicle to a foreign operator |
| Unassigned account | `listOperators` returned `total = 0` |
| Archiving | `status = ARCHIVED` and `archivedAt` set; the row remained in the table |
| Audit | `operator.created`, `operator.updated`, `operator.archived` rows persisted |
| `npm run verify:pages` | All Phase 3 pages return 200 for a signed-in administrator |

The integration test creates only namespaced synthetic rows and removes exactly
those rows afterwards. It never resets or truncates the database.

## 6. Migration strategy note

`npx prisma migrate dev` cannot run here: it requires a shadow database, and the
limited `bpta_app` account is denied `ALTER` on it (`error 1142`). The safe
procedure used instead — and the one to reuse — is:

1. `npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script`
2. **Read the generated SQL** and confirm it is additive (`CREATE TABLE`,
   `ALTER TABLE … ADD CONSTRAINT` only).
3. Save it as `prisma/migrations/<timestamp>_<name>/migration.sql`.
4. `npx prisma migrate deploy`

## 7. Pending departmental decisions

- Final role/permission matrix and whether operators are staffed read-only.
- Official operator, vehicle, route and permit attribute sets.
- Whether permit statuses may ever be treated as authoritative, and from which
  source.
- Whether operators should own routes, or routes remain network-level (the
  current model keeps routes central and links them through permits).

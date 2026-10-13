# Phase 5 — CCTV Inspections and Incident Records

> Status: **Implemented and verified against live MariaDB.**
> Everything in this module records what a person observed and decided. Nothing
> is automated and nothing is inferred.

---

## 1. What was built

| Module | Page | Capability |
|---|---|---|
| CCTV inspections | `/inspections` | Create, update, archive, search, filter by recorded result, pagination |
| Incidents | `/incidents` | Create, update, archive, search, filter by review status, pagination |

New tables: `inspection` and `incident` (same additive migration as Phase 4).

**Inspection fields:** site name, city, optional operator, cameras recorded,
cameras confirmed operational, inspection date, recorded result, findings,
responsible party, follow-up action, next due date.

**Incident fields:** reference, optional operator and journey, date/time of
occurrence, location, category, recorded severity, factual description, review
status, reported by, review notes.

## 2. Honesty rules enforced in code

These are not just documentation claims — they are enforced by validation and
by what the module refuses to model:

1. **A camera is never reported as operational without an inspection.**
   `camerasOperational` cannot exceed `cameraCount` (Zod refinement), and the
   field is labelled "confirmed operational" because it may only be counted when
   observed during an inspection.
2. **The result vocabulary includes `NOT_INSPECTED`.** A record can exist
   without a result being asserted.
3. **No automated judgement about any person.** Incidents carry a factual
   description and a human review status. There is no suspicion score, no
   blacklist, no watchlist and no automated enforcement decision.
4. **No external integration.** There is no connection to police, immigration,
   NADRA or any authority, and the UI says so explicitly.
5. **No streaming, footage storage or facial recognition** exists in the
   prototype. Live video, footage retention and biometrics would each require
   separate written authorisation and legal review.
6. **Severity is a recorded triage value**, entered by a person, not a computed
   risk level.

## 3. Permissions and isolation

- `inspection.view` / `inspection.manage`
- `incident.view` / `incident.manage`
- Auditor: read-only, no manage capability.
- Operator Staff: read-only for inspections, and — importantly — a scoped
  operator account must attach its inspections and incidents to its own
  operator. Submitting no operator as scoped staff is rejected rather than
  silently creating a department-wide record.
- Records without an operator (department-wide) are visible only to
  department-wide roles; scoped staff cannot reach them.
- An incident's optional journey must belong to the same operator.

## 4. Verification evidence

Covered by `tests/phase4-phase5-integration.test.ts` (**9/9 passed**) plus the
live page smoke test:

| Behaviour verified | Evidence |
|---|---|
| Inspection persisted | Row written with `cameraCount = 4`, `camerasOperational = 3` |
| Operational ≤ total | A record with 2 cameras and 5 operational was rejected with `ValidationError` |
| Inspection audited | `inspection.created` audit row present |
| Incident persisted | Row written with the recorded status and severity |
| Incident audited | `incident.created` audit row present |
| Cross-operator denial | A scoped operator's incident list returned zero rows for another operator's data |
| Pages render | `/inspections` and `/incidents` return 200 and render without error |

## 5. Pending departmental decisions

- The approved inspection checklist, evidence requirements and inspector
  authority.
- Whether incident categories, severity levels and closure criteria are
  correct, and who may close an incident.
- Whether any CCTV footage or imagery may ever be stored, and under what
  authority (currently: no).
- Whether any external authority integration is legally permitted (currently:
  none exists).

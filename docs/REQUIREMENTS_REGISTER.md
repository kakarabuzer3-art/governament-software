# Requirements Register

_Status legend: **proposed** (from supplied material, unverified) ·
**confirmed** (departmentally confirmed) · **implemented** · **tested** ·
**blocked** (awaiting decision/authorization)_

Sources:
**L** = supplied letter photograph (Provincial Transport Authority,
Balochistan, Quetta, dated 7 October 2026) + accompanying text ·
**D** = departmental confirmation (none received yet) ·
**E** = engineering recommendation by the development team ·
**P** = proposed enhancement

> ⚠️ The letter photograph is **not** a complete software specification.
> Nothing below may be treated as a legal obligation until the department
> confirms it. No entry claims official approval.

---

## A. Requirements derived from the supplied letter (Source L — all PROPOSED)

| ID | Description | Priority | Acceptance criteria | Dependencies / risks | Status |
|---|---|---|---|---|---|
| REQ-001 | Maintain passenger records: name, father's name, CNIC/identity doc number, permanent address, mobile number, journey info | High | Fields captured per trip; validated client+server; masked in lists; encrypted at rest; no extra personal data collected | Needs field list confirmation; encryption key management (Phase 4) | proposed → Phase 4 |
| REQ-002 | Retain passenger records ≥ 10 days (subject to confirmed policy) | High | Records not deleted before minimum retention; retention configurable; cleanup disabled until policy approved; all deletions audited | **Retention policy beyond 10 days pending** | proposed / blocked → Phase 4 |
| REQ-003 | Record compliance with functional CCTV requirements | High | Inspection records store status, date, findings, responsible party, follow-up; status only from actual inspections | No live video/footage without separate approval | proposed → Phase 5 |
| REQ-004 | Identity-document compliance handling and reporting suspicious activity through authorized channels | High | Document compliance recorded factually; incident workflow with human review; no automated suspicion scoring | Authorized reporting channels must be defined by department | proposed / partially blocked → Phase 5 |
| REQ-005 | Prevent prohibited travel arrangements where supported by verified official requirements | Medium | Only implementable once the exact rule is provided in writing | **Blocked: no verified rule supplied** | blocked |
| REQ-006 | Support inspections, compliance monitoring, reports and administrative follow-up | Medium | Inspection + report modules with permissions, filters and audit events | Depends on REQ-003, role model | proposed → Phases 5–6 |

## B. Engineering recommendations (Source E)

| ID | Description | Priority | Acceptance criteria | Status |
|---|---|---|---|---|
| REC-001 | Design foundation: exact geometric background + glassmorphism design system + responsive shell | High | Background matches supplied source byte-for-value (unit-tested); components reusable; keyboard/focus/reduced-motion supported | **implemented & tested (Phase 1)** |
| REC-002 | Secure authentication and server-side authorization for every sensitive boundary | High | Sessions with expiry, hashed passwords, least-privilege checks in server code, no reliance on hidden UI | planned Phase 2 |
| REC-003 | Sensitive identity data encrypted at rest, masked in views, excluded from logs | High | Documented encryption design + key management; masking helpers unit-tested (Phase 1) | planned Phase 4 (helpers done) |
| REC-004 | Immutable audit trail for create/read-of-sensitive-data/update/export/delete | High | Append-only events; restricted access; export actions recorded | planned Phase 6 |
| REC-005 | Search-engine exclusion of all private screens (`noindex`) plus authorization as real protection | High | Metadata robots noindex/follow on app; verified | **implemented (Phase 1)** |
| REC-006 | Automated verification: lint, typecheck, unit tests, production build per phase | High | All commands green before phase report | **implemented (Phase 1)** |
| REC-007 | Honest placeholders — never fake integrations, statistics or camera health | High | Placeholder pages state phase/status; dashboard labels all data as sample | **implemented (Phase 1)** |
| REC-008 | Multilingual foundation incl. Urdu/RTL | Medium | Layout switches direction without breaking tables/forms | planned Phase 7 |
| REC-009 | Separate public information website with technical/local SEO | Low | Public site structurally separate from this app; content approved before publication | planned Phase 7 |

## C. Pending departmental decisions (BLOCKED until answered)

| ID | Question | Blocks |
|---|---|---|
| PEND-001 | Official approval, scope and authority for this system | Any claim of official status; deployment |
| PEND-002 | Complete retention policy (minimum, maximum, legal holds, backups) | REQ-002 automation |
| PEND-003 | Confirmed role categories and permission matrix | Phase 2 role design |
| PEND-004 | Hosting, data-residency, backup and cost arrangements | Phase 9 deployment |
| PEND-005 | Authorized integrations (NADRA, police, immigration) and their legal basis | Any external verification feature |
| PEND-006 | Exact prohibited-travel rule text (for REQ-005) | REQ-005 |
| PEND-007 | Approved export formats and who may export | Phase 6 exports |
| PEND-008 | Approved languages and translation owners | Phase 7 languages |
| PEND-009 | Logo/emblem usage permission | Any official identity assets |

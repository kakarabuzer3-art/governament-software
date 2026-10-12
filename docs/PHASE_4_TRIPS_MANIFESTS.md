# Phase 4 — Journeys and Passenger Manifests

> Status: **Implemented and verified against live MariaDB.**
> This module handles **sensitive personal data**. Read section 3 before
> considering it suitable for real passenger records.

---

## 1. What was built

| Surface | Location | Capability |
|---|---|---|
| Journeys | `/trips` | Create, update, archive, search, status filter, pagination |
| Manifest | `/trips/[id]` | Add, update, withdraw, restore and (with permission) reveal passenger entries |

New tables: `trip` and `passenger` (migration
`20261012115756_phase4_phase5_trips_manifests_compliance`, additive).

Fields recorded per passenger, per the supplied requirement: passenger name,
father's name, identity document type and number, permanent address and mobile
number — each linked to a journey (and therefore to a vehicle and operator).

## 2. Permissions

- `trip.view` / `trip.manage` — journeys.
- `manifest.view` / `manifest.manage` — passenger data. **These are separate
  from the trip permissions on purpose:** being able to see that a journey
  exists does not grant access to passenger identities. A user without
  `manifest.view` sees a "Restricted" badge instead of a passenger count, and
  the manifest section is not rendered at all (the query is never executed).

Operator isolation applies exactly as in Phase 3: manifests are reachable only
through a journey that belongs to an operator inside the caller's scope.

## 3. Encryption at rest — design and limits

`src/lib/crypto/field-crypto.ts` implements **AES-256-GCM** (authenticated
encryption; tampering is detected on decrypt).

| Field | Storage |
|---|---|
| `identityNumber` | `identityNumberEncrypted` — ciphertext only |
| `mobileNumber` | `mobileEncrypted` — ciphertext only |
| `permanentAddress` | `permanentAddressEncrypted` — ciphertext only |
| Display value | `identityMasked` / `mobileMasked` (masked, non-sensitive) |
| Duplicate detection | `identityFingerprint` — **HMAC-SHA256**, keyed, truncated to 32 hex characters |

Why a **keyed** fingerprint: the CNIC value space is small enough that an
unkeyed hash would be brute-forceable. HMAC with a secret key prevents that
while still allowing duplicate detection **without decrypting**.

Payload format: `v1:<iv>:<authTag>:<ciphertext>` (base64), fresh 96-bit IV per
value, so encrypting the same value twice produces different ciphertext.

**Fail closed:** if `FIELD_ENCRYPTION_KEY` is missing or unusable, passenger
writes are refused outright. Values are never silently stored in plaintext.

### What is NOT engineered (do not overstate)

- No key-management service, no HSM, no automatic rotation or revocation. The
  key lives in a local environment variable.
- No database-level transparent encryption and no encrypted backups.
- Encryption at rest does **not** replace access control, audit, minimisation
  or retention limits.

Production use for real passenger data requires a managed KMS with a documented
rotation/revocation process and an approved backup and retention policy.

## 4. Privacy behaviour

- **Masked by default.** `maskCnic` keeps five leading and one trailing digit;
  `maskMobile` keeps four leading and two trailing. The full value is never
  included in list queries — the encrypted columns are not even selected.
- **Reveal is explicit and audited.** `revealPassengerAction` requires
  `manifest.manage`, re-checks the operator scope through the owning journey,
  and writes a `passenger.revealed` audit event. The revealed values are
  returned to the authorised client only and are **never** logged or stored in
  the audit row.
- **No pre-fill of decrypted values.** The update form deliberately leaves the
  sensitive fields empty rather than rendering stored values into the DOM.
- **Withdraw, never delete.** `removedAt` takes an entry out of the active
  manifest while retaining the record for history.
- **No password/token/identity value ever appears in a log or error message.**

## 5. Retention

`src/lib/retention.ts` records the stated **minimum of 10 days** as a floor that
cannot be lowered, and reads an optional `MANIFEST_RETENTION_DAYS` override.

**Automatic deletion is hard-disabled** (`AUTOMATIC_DELETION_ENABLED: false`).
The approved retention period, legal-hold rules and backup policy are unknown,
so no record is removed automatically. The manifest page states this policy in
plain language.

## 6. Verification evidence

`npx vitest run tests/phase4-phase5-integration.test.ts` — **9/9 passed**
against live MariaDB, including:

| Behaviour verified | Evidence |
|---|---|
| Ciphertext at rest | Stored columns start with `v1:` and contain neither the CNIC, the mobile number nor the address |
| Fingerprint not reversible | 32 hex characters, no plaintext substring |
| Masked display | Masked values contain `•` and omit the full number |
| No leakage via lists | Encrypted columns absent from the list projection |
| Duplicate identity | `ConflictError` for the same CNIC (even with different punctuation) on one journey |
| Reveal | Full values returned, and the `passenger.revealed` audit row contains **none** of them |
| Withdraw/restore | Entry disappears from the active list, row is retained |
| Cross-operator denial | Scoped staff cannot list or add to another operator's manifest |

`npm run verify:pages` additionally confirms that the manifest page renders
successfully, shows masked values, and contains **no unmasked CNIC pattern**.

## 7. Pending departmental decisions

- The approved field list, mandatory-field rules and evidentiary standard.
- Whether identity documents may be retained at all beyond a journey, and for
  how long, under what legal basis.
- Whether a photograph or scanned document may be stored (currently: no).
- The production key-management arrangement.

/**
 * Privacy-preserving, integrity-aware audit logging.
 *
 * WHAT CHANGED IN THE HARDENING PASS (see docs/COMPLETION_GAP_AUDIT.md GAP-05/06)
 *
 *  1. Client identifiers are now hashed with a KEYED digest (HMAC-SHA256)
 *     instead of a bare SHA-256. An unkeyed hash of an IPv4 address is
 *     reversible by brute force (the address space is only 2^32), so the old
 *     "non-reversible" claim was not true. A keyed digest cannot be
 *     pre-computed or brute-forced without the key.
 *  2. If no hashing key can be derived, the identifier is NOT stored at all.
 *     Storing a weak, reversible value would be worse than storing nothing.
 *  3. Persistence failures are reported to the caller and counted, so a silent
 *     audit gap can be detected. `getAuditHealth()` exposes the counter.
 *
 * HONEST LIMITS (unchanged):
 *  - The table is not tamper-proof. There is no append-only database role,
 *    checksum chain or off-host shipping. Do not call it immutable.
 *  - The failure counter is in-process only: it resets when the server
 *    restarts and is not shared between instances. Production needs real
 *    shipping and alerting.
 *  - The stored hash still allows correlation of repeated activity, which is
 *    the point; it is pseudonymous, not anonymous.
 */
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type AuditOutcome = "success" | "failure";

export interface RecordAuditInput {
  action: string;
  outcome: AuditOutcome;
  actorId?: string | null;
  actorRole?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditWriteResult {
  /** True when the event reached the database. */
  persisted: boolean;
  /** True when hashing was unavailable, so the identifier was omitted. */
  identifierOmitted: boolean;
}

// ---------------------------------------------------------------------------
// Hashing key
// ---------------------------------------------------------------------------

let cachedKey: Buffer | null | undefined;

/**
 * Derive the audit hashing key.
 *
 * Preference order:
 *   1. `AUDIT_HASH_KEY` — a dedicated key (recommended for production).
 *   2. `BETTER_AUTH_SECRET` — already required for the application to run.
 *
 * Returns null when neither is available, in which case identifiers are not
 * stored. Cached because the environment does not change at runtime.
 */
export function getAuditHashKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;

  const dedicated = process.env.AUDIT_HASH_KEY?.trim();
  const fallback = process.env.BETTER_AUTH_SECRET?.trim();
  const source = dedicated && dedicated.length >= 16 ? dedicated : fallback;

  cachedKey = source && source.length >= 16 ? Buffer.from(source, "utf8") : null;
  return cachedKey;
}

/** Test-only: forget the cached key after changing the environment. */
export function resetAuditHashKeyCache(): void {
  cachedKey = undefined;
}

/**
 * Keyed, truncated digest of a client identifier (IP address or similar).
 *
 * Returns `undefined` when no key is available — the caller then stores null
 * rather than a reversible value. Never throws.
 */
export function hashIdentifier(
  value: string | null | undefined,
): string | undefined {
  if (!value) return undefined;
  const key = getAuditHashKey();
  if (!key) return undefined;
  return createHmac("sha256", key).update(value.trim()).digest("hex").slice(0, 32);
}

/**
 * Backwards-compatible name used for IP addresses.
 * @deprecated prefer `hashIdentifier` for clarity in new code.
 */
export function hashIp(ip: string | null | undefined): string | undefined {
  return hashIdentifier(ip);
}

// ---------------------------------------------------------------------------
// Health counter
// ---------------------------------------------------------------------------

interface AuditHealth {
  attempts: number;
  failures: number;
  lastFailureAt: string | null;
  lastFailureAction: string | null;
}

const health: AuditHealth = {
  attempts: 0,
  failures: 0,
  lastFailureAt: null,
  lastFailureAction: null,
};

/** In-process visibility into audit persistence. Not a cross-instance metric. */
export function getAuditHealth(): Readonly<AuditHealth> {
  return { ...health };
}

/** Test-only reset. */
export function resetAuditHealth(): void {
  health.attempts = 0;
  health.failures = 0;
  health.lastFailureAt = null;
  health.lastFailureAction = null;
}

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------

/**
 * Write an audit event.
 *
 * Never throws into the caller's control flow: a failed audit write must not
 * mask the real error the user is experiencing. It now REPORTS the outcome so
 * callers and monitoring can detect a gap.
 */
export async function recordAuditEvent(
  input: RecordAuditInput,
): Promise<AuditWriteResult> {
  health.attempts += 1;

  const ipHash = hashIdentifier(input.ipAddress);
  const identifierOmitted = Boolean(input.ipAddress) && ipHash === undefined;

  try {
    await prisma.auditEvent.create({
      data: {
        action: input.action,
        outcome: input.outcome,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        targetId: input.targetId ?? null,
        ipHash: ipHash ?? null,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
      },
    });
    return { persisted: true, identifierOmitted };
  } catch {
    health.failures += 1;
    health.lastFailureAt = new Date().toISOString();
    health.lastFailureAction = input.action;
    // Do not leak details to end users; log the stable marker server-side.
    console.error("[audit] AUDIT_WRITE_FAILED", {
      action: input.action,
      outcome: input.outcome,
      failures: health.failures,
    });
    return { persisted: false, identifierOmitted };
  }
}

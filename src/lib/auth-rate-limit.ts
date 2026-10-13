/**
 * Login rate limiting and abuse ledger (Phase C, GAP-04).
 *
 * DESIGN GOALS
 *  - Stop unlimited password guessing against a known account.
 *  - Do NOT hand an attacker an easy denial-of-service: a targeted lockout of a
 *    legitimate user must not be possible from a third-party address.
 *  - Work correctly behind a reverse proxy without trusting client-supplied
 *    headers (proxy trust is explicit; see `trustedProxyHopsFromEnv`).
 *  - Leave evidence: every block and every recorded attempt is auditable.
 *
 * THE THREE DIMENSIONS
 *  1. `identifier_ip` — failures for one identifier from ONE client address.
 *     This is the precise control: blocking it cannot lock the victim out when
 *     they sign in from somewhere else. Hard block.
 *  2. `ip` — total failures from one client address. Volume control. Hard block.
 *  3. `identifier` alone — used ONLY when no trustworthy client address is
 *     available (no trusted proxy configured). It applies a bounded DELAY, never
 *     a hard block, so a victim can always still sign in. Online guessing stays
 *     impractical while complete denial of service is impossible.
 *
 * PRIVACY: identifiers and addresses are stored only as keyed digests. If no
 * hashing key is available, the identifier dimension is skipped entirely rather
 * than storing a reversible value.
 *
 * HOUSEKEEPING: rows are pruned by age. Pruning removes only throttle history,
 * never user or audit records.
 */
import { prisma } from "@/lib/prisma";
import { hashIdentifier } from "@/lib/audit";

export const LOGIN_RATE_LIMITS = {
  /** Window for the precise (identifier + client address) dimension. */
  pairWindowMs: 10 * 60 * 1000,
  pairMaxFailures: 5,
  /** Window for the per-client-address volume dimension. */
  ipWindowMs: 10 * 60 * 1000,
  ipMaxFailures: 30,
  /** Window for the delay-only fallback (no trustworthy client address). */
  identifierWindowMs: 10 * 60 * 1000,
  /** Failures allowed before the fallback delay starts growing. */
  identifierDelayAfter: 3,
  maxDelayMs: 2500,
  /** How long throttle rows are kept before best-effort pruning. */
  retentionMs: 24 * 60 * 60 * 1000,
} as const;

export type RateLimitScope =
  | "identifier_ip"
  | "ip"
  | "identifier_delay"
  | null;

export interface WindowStats {
  count: number;
  oldestAt: Date | null;
}

export interface LoginRateLimitDecision {
  allowed: boolean;
  /** Seconds the client should wait. 0 when allowed. */
  retryAfterSeconds: number;
  scope: RateLimitScope;
  /** Artificial delay the caller may apply. Always 0 when blocked. */
  delayMs: number;
}

const ALLOWED: LoginRateLimitDecision = {
  allowed: true,
  retryAfterSeconds: 0,
  scope: null,
  delayMs: 0,
};

function secondsUntilWindowEnds(
  oldestAt: Date | null,
  windowMs: number,
  now: Date,
): number {
  if (!oldestAt) return Math.ceil(windowMs / 1000);
  const elapsed = now.getTime() - oldestAt.getTime();
  const remaining = windowMs - elapsed;
  return Math.max(1, Math.ceil(remaining / 1000));
}

/**
 * Pure policy evaluation. No I/O, so every branch is unit testable.
 *
 * `hasClientAddress` tells the policy whether a trustworthy client address was
 * available; when it is false the hard-block dimensions are unavailable and the
 * delay-only fallback applies.
 */
export function evaluateLoginRateLimit(input: {
  identifierIp: WindowStats;
  identifierOnly: WindowStats;
  ip: WindowStats;
  hasClientAddress: boolean;
  now: Date;
  limits?: typeof LOGIN_RATE_LIMITS;
}): LoginRateLimitDecision {
  const limits = input.limits ?? LOGIN_RATE_LIMITS;

  if (input.hasClientAddress) {
    // 1. Precise dimension: this identifier from this address.
    if (input.identifierIp.count >= limits.pairMaxFailures) {
      return {
        allowed: false,
        retryAfterSeconds: secondsUntilWindowEnds(
          input.identifierIp.oldestAt,
          limits.pairWindowMs,
          input.now,
        ),
        scope: "identifier_ip",
        delayMs: 0,
      };
    }
    // 2. Volume dimension: this address in general.
    if (input.ip.count >= limits.ipMaxFailures) {
      return {
        allowed: false,
        retryAfterSeconds: secondsUntilWindowEnds(
          input.ip.oldestAt,
          limits.ipWindowMs,
          input.now,
        ),
        scope: "ip",
        delayMs: 0,
      };
    }
    return ALLOWED;
  }

  // 3. No trustworthy client address: delay only, never a hard block, so a
  //    legitimate user can always eventually sign in.
  const failures = input.identifierOnly.count;
  if (failures >= limits.identifierDelayAfter) {
    const steps = failures - limits.identifierDelayAfter + 1;
    return {
      allowed: true,
      retryAfterSeconds: 0,
      scope: "identifier_delay",
      delayMs: Math.min(steps * 400, limits.maxDelayMs),
    };
  }
  return ALLOWED;
}

// ---------------------------------------------------------------------------
// Keys and persistence
// ---------------------------------------------------------------------------

/** Keyed digest of the submitted identifier, or undefined when unavailable. */
export function loginIdentifierHash(email: string): string | undefined {
  return hashIdentifier(email.trim().toLowerCase());
}

/** Keyed digest of the client address, or undefined when unavailable. */
export function loginClientHash(ipAddress: string | null): string | undefined {
  return hashIdentifier(ipAddress);
}

/** Record one attempt. Never throws. */
export async function recordLoginAttempt(input: {
  identifierHash: string | undefined;
  clientHash: string | undefined;
  outcome: "failure" | "success" | "blocked";
}): Promise<void> {
  if (!input.identifierHash && !input.clientHash) return;
  try {
    await prisma.loginAttempt.create({
      data: {
        identifierHash: input.identifierHash ?? "unavailable",
        ipHash: input.clientHash ?? null,
        outcome: input.outcome,
      },
    });
  } catch (error) {
    // Throttling must never take the sign-in endpoint down.
    console.error("[rate-limit] failed to record attempt", {
      outcome: input.outcome,
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}

async function windowStats(where: {
  identifierHash?: string;
  ipHash?: string;
  since: Date;
}): Promise<WindowStats> {
  const rows = await prisma.loginAttempt.findMany({
    where: {
      outcome: "failure",
      createdAt: { gte: where.since },
      ...(where.identifierHash ? { identifierHash: where.identifierHash } : {}),
      ...(where.ipHash ? { ipHash: where.ipHash } : {}),
    },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return {
    count: rows.length,
    oldestAt: rows.length > 0 ? rows[0].createdAt : null,
  };
}

export interface LoginWindowSnapshot {
  identifierIp: WindowStats;
  identifierOnly: WindowStats;
  ip: WindowStats;
}

/** Load the failure windows needed to evaluate the policy. */
export async function loadLoginWindows(input: {
  identifierHash: string | undefined;
  clientHash: string | undefined;
  now: Date;
  limits?: typeof LOGIN_RATE_LIMITS;
}): Promise<LoginWindowSnapshot> {
  const limits = input.limits ?? LOGIN_RATE_LIMITS;
  const pairSince = new Date(input.now.getTime() - limits.pairWindowMs);
  const idSince = new Date(input.now.getTime() - limits.identifierWindowMs);
  const ipSince = new Date(input.now.getTime() - limits.ipWindowMs);

  const needsIdentifier = Boolean(input.identifierHash);

  const [identifierIp, identifierOnly, ip] = await Promise.all([
    needsIdentifier && input.clientHash
      ? windowStats({
          identifierHash: input.identifierHash,
          ipHash: input.clientHash,
          since: pairSince,
        })
      : Promise.resolve<WindowStats>({ count: 0, oldestAt: null }),
    needsIdentifier
      ? windowStats({ identifierHash: input.identifierHash, since: idSince })
      : Promise.resolve<WindowStats>({ count: 0, oldestAt: null }),
    input.clientHash
      ? windowStats({ ipHash: input.clientHash, since: ipSince })
      : Promise.resolve<WindowStats>({ count: 0, oldestAt: null }),
  ]);

  return { identifierIp, identifierOnly, ip };
}

/**
 * Clear failure history after a SUCCESSFUL sign-in.
 *
 * Scoped to the precise (identifier + address) pair so a successful login from
 * one place cannot wipe the throttle history of an attack from another.
 * Falls back to the identifier alone when no address is available.
 */
export async function clearLoginFailures(input: {
  identifierHash?: string;
  clientHash?: string;
}): Promise<void> {
  if (!input.identifierHash && !input.clientHash) return;
  try {
    if (input.identifierHash && input.clientHash) {
      await prisma.loginAttempt.deleteMany({
        where: { identifierHash: input.identifierHash, ipHash: input.clientHash },
      });
      return;
    }
    if (input.identifierHash) {
      await prisma.loginAttempt.deleteMany({
        where: { identifierHash: input.identifierHash },
      });
      return;
    }
    await prisma.loginAttempt.deleteMany({ where: { ipHash: input.clientHash } });
  } catch (error) {
    console.error("[rate-limit] failed to clear failures", {
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}

/** Best-effort removal of throttle rows older than the retention window. */
export async function pruneLoginAttempts(
  now: Date = new Date(),
): Promise<number> {
  try {
    const cutoff = new Date(now.getTime() - LOGIN_RATE_LIMITS.retentionMs);
    const result = await prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return result.count;
  } catch {
    return 0;
  }
}

/** Human-readable policy summary for documentation and UI. */
export function describeLoginRateLimitPolicy(): string {
  return (
    `${LOGIN_RATE_LIMITS.pairMaxFailures} failed attempts per identifier and client ` +
    `address within ${Math.round(LOGIN_RATE_LIMITS.pairWindowMs / 60000)} minutes ` +
    `triggers a temporary block; ${LOGIN_RATE_LIMITS.ipMaxFailures} failures from a ` +
    `single address also triggers a block. When no trusted client address is ` +
    `available a bounded delay is applied instead of a block, so an attacker ` +
    `cannot lock a real user out.`
  );
}

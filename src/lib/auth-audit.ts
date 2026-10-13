/**
 * Authentication audit recording (Phase 2 defect B).
 *
 * The Phase 2 documentation claimed login success/failure and logout were
 * audited, but the authentication handler merely mounted Better Auth and no
 * auth event was ever written to `audit_event`. These helpers are the missing
 * implementation, kept in their own module so the behaviour is unit-testable
 * without booting Better Auth.
 *
 * PRIVACY / SAFETY RULES (enforced here, verified by tests):
 *  - Never record a password, session token, session cookie, or any other
 *    secret. Only a user id, an outcome, and coarse request metadata.
 *  - Never record the submitted email address on a failed sign-in: doing so
 *    would create a list of attempted accounts, including ones that do not
 *    exist. Failed attempts are recorded with a null actor.
 *  - Raw IP addresses are not stored; `recordAuditEvent` stores a truncated
 *    hash only.
 *  - Recording is best-effort: a failed audit write must never break sign-in,
 *    sign-out or any other flow (guaranteed by `recordAuditEvent` itself).
 */
import { recordAuditEvent } from "@/lib/audit";

/** Stable action keys written to `audit_event.action`. */
export const AUTH_AUDIT_ACTIONS = {
  LOGIN_SUCCESS: "auth.login.success",
  LOGIN_FAILURE: "auth.login.failure",
  LOGOUT: "auth.logout",
} as const;

export type AuthAuditAction =
  (typeof AUTH_AUDIT_ACTIONS)[keyof typeof AUTH_AUDIT_ACTIONS];

/** Coarse client metadata. The raw IP never reaches the database. */
export interface ClientRequestMeta {
  ipAddress: string | null;
  userAgent: string | null;
}

const EMPTY_META: ClientRequestMeta = { ipAddress: null, userAgent: null };

/**
 * Number of proxies in front of the application that we are willing to trust.
 *
 * DEFAULT 0 — trust nothing. `x-forwarded-for` is client-settable, so treating
 * its first element as the real address (the previous behaviour) let an
 * attacker choose what the audit trail recorded. With hops = 0 no address is
 * recorded at all, which is the honest outcome: we cannot know the client
 * address, so we store nothing rather than something forgeable.
 *
 * Behind a real reverse proxy, set this to the exact number of proxies you
 * control (1 for a single nginx/ALB hop) so the address is taken from the
 * position the outermost trusted proxy appended.
 */
export function trustedProxyHopsFromEnv(
  raw: string | undefined = process.env.TRUSTED_PROXY_HOPS,
): number {
  const parsed = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, 8);
}

export interface ClientMetaOptions {
  /** Overrides the environment value. Used by tests. */
  trustedProxyHops?: number;
}

/**
 * Pull the client IP and user agent out of request headers.
 *
 * The address is only used for correlation and only a KEYED hash of it is
 * persisted (see `src/lib/audit.ts`). It is never used for an authorization
 * decision.
 */
export function extractClientMeta(
  headers?: Headers | null,
  options: ClientMetaOptions = {},
): ClientRequestMeta {
  if (!headers) return EMPTY_META;

  const hops = options.trustedProxyHops ?? trustedProxyHopsFromEnv();
  const userAgent = headers.get("user-agent");

  let ipAddress: string | null = null;

  if (hops > 0) {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      const parts = forwarded
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      // The address appended by the outermost trusted proxy sits `hops` from
      // the right; anything further right was added by an untrusted hop.
      const index = parts.length - hops;
      ipAddress = index >= 0 ? parts[index] : null;
    }
    if (!ipAddress) {
      ipAddress = headers.get("x-real-ip")?.trim() || null;
    }
  }

  return {
    ipAddress,
    userAgent: userAgent ? userAgent.slice(0, 255) : null,
  };
}

/**
 * True when a Better Auth hook's `context.returned` value represents a failed
 * request. Better Auth stores the thrown `APIError` there (`statusCode`) or a
 * `Response` (`.status`); a success payload is a plain object without either.
 */
export function isFailedAuthResponse(returned: unknown): boolean {
  if (typeof returned !== "object" || returned === null) return false;
  const candidate = returned as {
    statusCode?: unknown;
    status?: unknown;
  };
  const code =
    typeof candidate.statusCode === "number"
      ? candidate.statusCode
      : typeof candidate.status === "number"
        ? candidate.status
        : null;
  return code !== null && code >= 400;
}

/** Audit action for a failed email sign-in attempt. */
export async function auditLoginFailure(
  meta: ClientRequestMeta,
): Promise<void> {
  await recordAuditEvent({
    action: AUTH_AUDIT_ACTIONS.LOGIN_FAILURE,
    outcome: "failure",
    // Deliberately no actor and no attempted identifier.
    actorId: null,
    targetId: null,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

/** Audit action for a session that was actually created (successful sign-in). */
export async function auditLoginSuccess(input: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  if (!input.userId) return;
  await recordAuditEvent({
    action: AUTH_AUDIT_ACTIONS.LOGIN_SUCCESS,
    outcome: "success",
    actorId: input.userId,
    targetId: input.userId,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}

/** Audit action for a session that was deleted (explicit sign-out/revocation). */
export async function auditLogout(input: {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  if (!input.userId) return;
  await recordAuditEvent({
    action: AUTH_AUDIT_ACTIONS.LOGOUT,
    outcome: "success",
    actorId: input.userId,
    targetId: input.userId,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  });
}

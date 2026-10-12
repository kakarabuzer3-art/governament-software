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
 * Pull the client IP and user agent out of request headers.
 *
 * `x-forwarded-for` is trusted only for the FIRST hop value, and only for
 * correlation; it is never used for an authorization decision, and only a
 * non-reversible hash of it is persisted.
 */
export function extractClientMeta(
  headers?: Headers | null,
): ClientRequestMeta {
  if (!headers) return EMPTY_META;

  const forwarded = headers.get("x-forwarded-for");
  const candidate =
    forwarded?.split(",")[0] ??
    headers.get("x-real-ip") ??
    headers.get("cf-connecting-ip") ??
    null;
  const ipAddress = candidate?.trim() || null;

  const userAgent = headers.get("user-agent");

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

/**
 * Minimal, privacy-preserving audit logging for Phase 2.
 *
 * Only the MINIMUM necessary data is stored. We deliberately do NOT store raw
 * IP addresses; instead we store a short, non-reversible hash so repeated
 * activity can be correlated without retaining a directly identifying value.
 * Full audit hardening (append-only enforcement, off-host shipping, checksums)
 * is a documented later enhancement — this table is not yet tamper-proof.
 */
import { createHash } from "node:crypto";
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

/** Non-reversible, truncated hash of a client IP address. */
export function hashIp(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Write an audit event. Never throws into the caller's control flow: a failed
 * audit write must not mask the real error the user is experiencing, but we
 * still surface it to the server log for operators.
 */
export async function recordAuditEvent(
  input: RecordAuditInput,
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        action: input.action,
        outcome: input.outcome,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        targetId: input.targetId ?? null,
        ipHash: hashIp(input.ipAddress) ?? null,
        userAgent: input.userAgent?.slice(0, 255) ?? null,
      },
    });
  } catch {
    // Do not leak details to end users; log server-side only.
    console.error("[audit] failed to record event", {
      action: input.action,
      outcome: input.outcome,
    });
  }
}

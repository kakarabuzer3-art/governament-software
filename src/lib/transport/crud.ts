/**
 * Shared, dependency-free CRUD helpers: pagination, Prisma error mapping and a
 * thin audit wrapper. Kept pure so they can be unit tested without a database.
 */
import { recordAuditEvent } from "@/lib/audit";
import { ConflictError } from "./errors";

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/** Build a page envelope, clamping the current page into range. */
export function buildPage<T>(
  rows: T[],
  total: number,
  page: number,
  pageSize: number,
): Page<T> {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  return {
    rows,
    total,
    page: safePage,
    pageSize,
    totalPages,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
  };
}

/** Row offset for a page. */
export function skipFor(page: number, pageSize: number): number {
  return (Math.max(page, 1) - 1) * pageSize;
}

/**
 * Detect a Prisma unique-constraint violation WITHOUT importing the Prisma
 * runtime namespace, so these helpers stay usable in unit tests and against
 * mocked clients.
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** The field list Prisma reports for a unique violation, when available. */
export function uniqueTargetFields(error: unknown): string[] {
  const meta = (error as { meta?: { target?: unknown } })?.meta;
  const target = meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];
  return [];
}

/**
 * Turn a unique-constraint violation into a field-scoped ConflictError with a
 * message a human can act on.
 */
export function conflictFromUnique(
  error: unknown,
  fallbackMessage: string,
  fieldMessages: Record<string, string>,
): ConflictError {
  const fields = uniqueTargetFields(error);
  for (const field of fields) {
    if (fieldMessages[field]) {
      return new ConflictError(fieldMessages[field], field);
    }
  }
  return new ConflictError(fallbackMessage);
}

/**
 * Best-effort audit write for an administrative change.
 *
 * `recordAuditEvent` never throws, so a failing audit write can never roll back
 * or break the operation the user asked for; it is logged server-side instead.
 */
export async function auditChange(input: {
  action: string;
  outcome?: "success" | "failure";
  actorId: string;
  actorRole: string | null;
  targetId?: string | null;
}): Promise<void> {
  await recordAuditEvent({
    action: input.action,
    outcome: input.outcome ?? "success",
    actorId: input.actorId,
    actorRole: input.actorRole,
    targetId: input.targetId ?? null,
  });
}

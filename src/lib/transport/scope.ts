/**
 * Operator data-scoping (Phase 3).
 *
 * ROLES ALONE ARE NOT ENOUGH. An OPERATOR_STAFF account must only ever see the
 * records of the operator(s) it is explicitly assigned to. That assignment
 * lives in the `user_operator` table and is read through the verified session —
 * never from a form field, query string or client-supplied operator id.
 *
 * FAIL-CLOSED BY DEFAULT: an operator-staff account with no `user_operator`
 * rows resolves to an empty id list, which matches NO records at all.
 *
 * The wider roles (System Administrator, Department Officer, Read-Only
 * Auditor) are department-wide and are not operator-scoped. This is a
 * provisional technical arrangement pending departmental approval.
 */
import { DEPARTMENT_WIDE_ROLES } from "@/lib/rbac";

/** Minimal shape for deriving the audit role snapshot. */
export interface ActorShape {
  roles: readonly string[];
}

/** Role snapshot stored on every audit event for the acting user. */
export function actorRoleOf(user: ActorShape): string | null {
  return user.roles.length > 0 ? user.roles.join(",").slice(0, 120) : null;
}

/** Resolved data scope for the current user. */
export interface OperatorScope {
  /** True for department-wide roles: no per-operator restriction applies. */
  unrestricted: boolean;
  /** Operator ids the user may access. Empty + restricted means "none". */
  operatorIds: readonly string[];
}

/** Minimal user shape needed to resolve scope. */
export interface ScopedUser {
  roles: readonly string[];
  operatorIds?: readonly string[];
}

/**
 * Resolve the permitted operator scope from trusted server-side state only.
 */
export function resolveOperatorScope(user: ScopedUser): OperatorScope {
  const isDepartmentWide = user.roles.some((role) =>
    (DEPARTMENT_WIDE_ROLES as readonly string[]).includes(role),
  );
  if (isDepartmentWide) {
    return { unrestricted: true, operatorIds: [] };
  }
  return {
    unrestricted: false,
    operatorIds: [...(user.operatorIds ?? [])],
  };
}

/** True when the scope permits access to this specific operator. */
export function canAccessOperator(
  scope: OperatorScope,
  operatorId: string,
): boolean {
  if (scope.unrestricted) return true;
  return scope.operatorIds.includes(operatorId);
}

/**
 * Prisma `where` fragment that restricts a query with an `operatorId` column
 * to the permitted operators. An unrestricted scope adds no filter; a
 * restricted scope with no assignments produces `in: []`, which matches
 * nothing (fail-closed).
 */
export function operatorFilter(
  scope: OperatorScope,
): { operatorId?: { in: string[] } } {
  if (scope.unrestricted) return {};
  return { operatorId: { in: [...scope.operatorIds] } };
}

/**
 * Prisma `where` fragment for models whose OWN id is the operator id
 * (the `operator` table itself).
 */
export function operatorIdFilter(
  scope: OperatorScope,
): { id?: { in: string[] } } {
  if (scope.unrestricted) return {};
  return { id: { in: [...scope.operatorIds] } };
}

/**
 * Request context for transport server actions.
 *
 * Every server action starts by calling `requireTransportContext(permission)`.
 * That single call does two things that must never be skipped:
 *   1. verifies the session and the required permission against the DATABASE
 *      (via assertPermission), and
 *   2. resolves the caller's permitted OPERATOR SCOPE from trusted relations.
 *
 * A hidden button is not a permission check; this is.
 */
import { assertPermission, type CurrentUser } from "@/lib/authorization";
import type { PermissionKey } from "@/lib/rbac";
import {
  actorRoleOf,
  resolveOperatorScope,
  type OperatorScope,
} from "./scope";

export { actorRoleOf };

export interface TransportContext {
  user: CurrentUser;
  scope: OperatorScope;
}

/** Resolve the authenticated user and their operator scope, or throw. */
export async function requireTransportContext(
  permission: PermissionKey,
): Promise<TransportContext> {
  const user = await assertPermission(permission);
  return { user, scope: resolveOperatorScope(user) };
}

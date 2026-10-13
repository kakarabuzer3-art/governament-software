/**
 * Server-side authentication and authorization helpers.
 *
 * SECURITY PRINCIPLES enforced here:
 *  - Default DENY. A user has a capability only if an assigned role grants it.
 *  - All checks read roles/permissions from the DATABASE via the verified
 *    session. We never trust roles from client input, cookies set by the
 *    browser, query strings, or request bodies.
 *  - Session validation goes through Better Auth's server API, which verifies
 *    the signed session cookie and checks server-side session expiry/revocation.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/lib/rbac";
import { ForbiddenError, UnauthorizedError } from "@/lib/authz-errors";

// Re-exported so existing imports from "@/lib/authorization" keep working.
export { ForbiddenError, UnauthorizedError };

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: Set<PermissionKey>;
  /**
   * Operator ids this user is explicitly assigned to (`user_operator`).
   * Operator-staff scoping is derived from this, never from client input.
   * Empty for department-wide roles and for unassigned accounts.
   */
  operatorIds: string[];
  /**
   * True when the account has been disabled by an administrator. A disabled
   * account never reaches this object (getCurrentUser returns null), so this is
   * informational only — it exists so UI code can be explicit.
   */
  disabled: boolean;
}

interface SessionShape {
  session?: { userId?: string; expiresAt?: Date } | null;
  user?: { id?: string; email?: string; name?: string } | null;
}

/**
 * Resolve the current user WITH their database-backed roles and permissions.
 * Returns null when there is no valid session. This is the single source of
 * truth for "who is logged in and what can they do".
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = (await auth.api.getSession({
    headers: await headers(),
  })) as SessionShape | null;

  const userId = session?.user?.id ?? session?.session?.userId;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      disabledAt: true,
      roleAssignments: {
        select: {
          role: {
            select: {
              key: true,
              permissions: {
                select: { permission: { select: { key: true } } },
              },
            },
          },
        },
      },
      operatorAssignments: {
        select: { operatorId: true },
      },
    },
  });

  if (!user) return null;

  // A disabled account is treated as NOT AUTHENTICATED, so every server-side
  // guard (pages, server actions and route handlers) denies it immediately.
  // This is defence in depth: disabling also deletes the account's sessions.
  if (user.disabledAt) return null;

  const roles: string[] = [];
  const permissions = new Set<PermissionKey>();
  for (const assignment of user.roleAssignments) {
    roles.push(assignment.role.key);
    for (const rp of assignment.role.permissions) {
      permissions.add(rp.permission.key as PermissionKey);
    }
  }

  const operatorIds = (user.operatorAssignments ?? []).map(
    (assignment) => assignment.operatorId,
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles,
    permissions,
    operatorIds,
    disabled: false,
  };
}

/**
 * Require an authenticated user. Redirects to the login page (preserving the
 * intended destination) when there is no valid session. Use in pages/layouts.
 */
export async function requireAuthenticatedUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Require a specific permission. Redirects to the login page when
 * unauthenticated, and to a forbidden page when authenticated but lacking the
 * permission. Never grants access by default. Use in pages/layouts.
 */
export async function requirePermission(
  permission: PermissionKey,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (!user.permissions.has(permission)) {
    redirect("/forbidden");
  }
  return user;
}

/**
 * Non-redirecting variant for server actions and route handlers. Throws
 * typed errors instead of navigating, so callers can return proper status
 * codes (401/403).
 */
export async function assertPermission(
  permission: PermissionKey,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  if (!user.permissions.has(permission)) {
    throw new ForbiddenError();
  }
  return user;
}

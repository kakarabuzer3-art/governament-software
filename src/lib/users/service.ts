/**
 * User and access administration — server-side business logic (Phase B).
 *
 * SECURITY RULES ENFORCED HERE (each covered by tests):
 *  - The actor's permission is checked by the caller; every mutation below
 *    additionally re-validates the TARGET and the requested grants against the
 *    database. Nothing from the browser is trusted.
 *  - No actor may grant a role carrying a permission the actor does not hold
 *    themselves (anti-escalation).
 *  - No actor may disable or demote themselves.
 *  - The last enabled SYSTEM_ADMIN cannot be disabled or stripped, which would
 *    lock every administrator out of the system.
 *  - Disabling an account, or REDUCING its permissions, deletes its session
 *    rows so the change takes effect immediately and is not merely cosmetic.
 *  - Password hashes, session tokens and encryption keys never leave this
 *    module, and passwords are never written to the audit trail or a log.
 *  - Records are not deleted. Accounts are disabled, which preserves history.
 */
import type { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/authorization";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  flattenZodError,
  parseSchema,
} from "@/lib/forms";
import {
  auditChange,
  buildPage,
  isUniqueConstraintError,
  skipFor,
  type Page,
} from "@/lib/transport/crud";
import { actorRoleOf } from "@/lib/transport/scope";
import { generateInitialPassword, passwordPolicyError } from "@/lib/passwords";
import {
  createUserSchema,
  disableUserSchema,
  operatorScopeSchema,
  roleChangeSchema,
  type UserStatus,
} from "./validation";
import { ROLES } from "@/lib/rbac";

/** Minimal actor shape. The permission check itself happens in the caller. */
export interface UserAdminContext {
  user: CurrentUser;
}

export const USER_AUDIT = {
  CREATED: "user.created",
  DISABLED: "user.disabled",
  ENABLED: "user.enabled",
  ROLE_ASSIGNED: "user.role.assigned",
  ROLE_REVOKED: "user.role.revoked",
  OPERATOR_ASSIGNED: "user.operator.assigned",
  OPERATOR_REVOKED: "user.operator.revoked",
  SESSIONS_REVOKED: "user.sessions.revoked",
} as const;

/** List projection. Deliberately excludes every credential column. */
export const userListSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  createdAt: true,
  disabledAt: true,
  disabledReason: true,
  roleAssignments: {
    select: { role: { select: { key: true, name: true } } },
  },
  operatorAssignments: {
    select: { operator: { select: { id: true, code: true, name: true } } },
  },
} satisfies Prisma.UserSelect;

export type UserListRow = Prisma.UserGetPayload<{ select: typeof userListSelect }>;

export interface UserListItem extends Omit<UserListRow, "roleAssignments" | "operatorAssignments"> {
  status: UserStatus;
  roleKeys: string[];
  roleNames: string[];
  operators: Array<{ id: string; code: string; name: string }>;
}

function toListItem(row: UserListRow): UserListItem {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified,
    createdAt: row.createdAt,
    disabledAt: row.disabledAt,
    disabledReason: row.disabledReason,
    status: row.disabledAt ? "DISABLED" : "ACTIVE",
    roleKeys: row.roleAssignments.map((a) => a.role.key).sort(),
    roleNames: row.roleAssignments.map((a) => a.role.name).sort(),
    operators: row.operatorAssignments
      .map((a) => a.operator)
      .sort((a, b) => a.code.localeCompare(b.code)),
  };
}

export interface UserListQuery {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
}

export async function listUsers(query: UserListQuery): Promise<Page<UserListItem>> {
  const conditions: Prisma.UserWhereInput[] = [];
  if (query.q) {
    const q = query.q;
    conditions.push({ OR: [{ name: { contains: q } }, { email: { contains: q } }] });
  }
  if (query.status === "ACTIVE") conditions.push({ disabledAt: null });
  if (query.status === "DISABLED") conditions.push({ disabledAt: { not: null } });
  const where: Prisma.UserWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userListSelect,
      orderBy: [{ createdAt: "asc" }],
      skip: skipFor(query.page, query.pageSize),
      take: query.pageSize,
    }),
  ]);
  return buildPage(rows.map(toListItem), total, query.page, query.pageSize);
}

export async function getUserOrThrow(userId: string): Promise<UserListItem> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: userListSelect,
  });
  if (!row) throw new NotFoundError("User account not found.");
  return toListItem(row);
}

/** All provisional roles, for the assignment UI. */
export async function listRoles(): Promise<
  Array<{
    key: string;
    name: string;
    description: string;
    permissionCount: number;
    permissionKeys: string[];
  }>
> {
  const roles = await prisma.role.findMany({
    select: {
      key: true,
      name: true,
      description: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
    orderBy: { key: "asc" },
  });
  return roles.map((role) => ({
    key: role.key,
    name: role.name,
    description: role.description,
    permissionCount: role.permissions.length,
    permissionKeys: role.permissions.map((rp) => rp.permission.key).sort(),
  }));
}

/**
 * Recent audit events where this user is the SUBJECT of the action.
 * Only called by pages that already require `audit.view`.
 */
export async function listUserAuditEvents(
  userId: string,
  take = 15,
): Promise<
  Array<{
    id: string;
    action: string;
    outcome: string;
    actorId: string | null;
    actorRole: string | null;
    createdAt: Date;
  }>
> {
  return prisma.auditEvent.findMany({
    where: { targetId: userId },
    select: {
      id: true,
      action: true,
      outcome: true,
      actorId: true,
      actorRole: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Operators available for scope assignment. */
export async function listOperatorsForScope(): Promise<
  Array<{ id: string; code: string; name: string; status: string }>
> {
  return prisma.operator.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: { id: true, code: true, name: true, status: true },
    orderBy: { code: "asc" },
  });
}

/** Effective permission keys for a user, read from the database. */
export async function effectivePermissions(userId: string): Promise<Set<string>> {
  const rows = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } },
    },
  });
  const permissions = new Set<string>();
  for (const row of rows) {
    for (const rp of row.role.permissions) permissions.add(rp.permission.key);
  }
  return permissions;
}

/** Number of enabled accounts holding SYSTEM_ADMIN. Used to prevent lockout. */
export async function countEnabledSystemAdmins(): Promise<number> {
  return prisma.user.count({
    where: {
      disabledAt: null,
      roleAssignments: { some: { role: { key: ROLES.SYSTEM_ADMIN } } },
    },
  });
}

/** Delete every session row for a user. Returns how many were removed. */
export async function revokeUserSessions(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } });
  return result.count;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface CreateUserResult {
  id: string;
  /** Shown to the administrator ONCE. Never stored, logged or audited. */
  initialPassword: string;
  generated: boolean;
}

export async function createUser(
  ctx: UserAdminContext,
  input: unknown,
): Promise<CreateUserResult> {
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(
      "Some values are invalid. Correct the highlighted fields and try again.",
      flattenZodError(parsed.error),
    );
  }
  const data = parsed.data;

  // --- validate the requested roles against the database -------------------
  const roleKeys = [...new Set(data.roleKeys)];
  const roles = roleKeys.length
    ? await prisma.role.findMany({ where: { key: { in: roleKeys } } })
    : [];
  if (roles.length !== roleKeys.length) {
    throw new ValidationError("One or more selected roles no longer exist.", {
      roleKeys: ["One or more selected roles no longer exist."],
    });
  }
  await assertCanGrantRoles(ctx, roles.map((role) => role.id));

  // --- validate the requested operator scope ------------------------------
  const operatorIds = [...new Set(data.operatorIds)];
  if (operatorIds.length > 0) {
    const found = await prisma.operator.count({ where: { id: { in: operatorIds } } });
    if (found !== operatorIds.length) {
      throw new ValidationError("One or more selected operators no longer exist.", {
        operatorIds: ["One or more selected operators no longer exist."],
      });
    }
  }

  const existing = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError("An account with that email address already exists.", "email");
  }

  // --- initial password ----------------------------------------------------
  const generated = !data.initialPassword;
  const initialPassword = data.initialPassword ?? generateInitialPassword();
  const policyError = passwordPolicyError(initialPassword);
  if (policyError) {
    throw new ValidationError(policyError, { initialPassword: [policyError] });
  }
  const hashed = await hashPassword(initialPassword);

  const userId = `usr_${randomUUID()}`;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: { id: userId, email: data.email, name: data.name },
      });
      await tx.account.create({
        data: {
          id: `acc_${randomUUID()}`,
          accountId: userId,
          providerId: "credential",
          userId,
          password: hashed,
        },
      });
      for (const role of roles) {
        await tx.userRole.create({
          data: { userId, roleId: role.id, assignedBy: ctx.user.id },
        });
      }
      for (const operatorId of operatorIds) {
        await tx.userOperator.create({
          data: { userId, operatorId, assignedBy: ctx.user.id },
        });
      }
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError("An account with that email address already exists.", "email");
    }
    throw error;
  }

  await auditChange({
    action: USER_AUDIT.CREATED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: userId,
  });

  return { id: userId, initialPassword, generated };
}

export async function setUserDisabled(
  ctx: UserAdminContext,
  input: unknown,
): Promise<{ revokedSessions: number }> {
  const data = parseSchema(disableUserSchema, input);
  const target = await getUserOrThrow(data.userId);

  if (target.id === ctx.user.id) {
    throw new ConflictError(
      "You cannot disable your own account. Ask another administrator.",
    );
  }

  const disabling = target.status === "ACTIVE";
  if (!disabling) {
    await prisma.user.update({
      where: { id: target.id },
      data: { disabledAt: null, disabledReason: null },
      select: { id: true },
    });
    await auditChange({
      action: USER_AUDIT.ENABLED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: target.id,
    });
    return { revokedSessions: 0 };
  }

  // Never allow the final enabled administrator to be disabled.
  if (target.roleKeys.includes(ROLES.SYSTEM_ADMIN)) {
    const admins = await countEnabledSystemAdmins();
    if (admins <= 1) {
      throw new ConflictError(
        "This is the last enabled System Administrator. Disable another administrator first, or assign the role to someone else.",
      );
    }
  }

  await prisma.user.update({
    where: { id: target.id },
    data: {
      disabledAt: new Date(),
      disabledReason: data.reason ?? null,
    },
    select: { id: true },
  });

  const revokedSessions = await revokeUserSessions(target.id);

  await auditChange({
    action: USER_AUDIT.DISABLED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: target.id,
  });
  if (revokedSessions > 0) {
    await auditChange({
      action: USER_AUDIT.SESSIONS_REVOKED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: target.id,
    });
  }

  return { revokedSessions };
}

export async function setUserRole(
  ctx: UserAdminContext,
  input: unknown,
): Promise<{ revokedSessions: number }> {
  const data = parseSchema(roleChangeSchema, input);
  const assign = data.assign === "true";
  const target = await getUserOrThrow(data.userId);

  const role = await prisma.role.findUnique({
    where: { key: data.roleKey },
    select: { id: true, key: true },
  });
  if (!role) {
    throw new ValidationError("That role no longer exists.", {
      roleKey: ["That role no longer exists."],
    });
  }

  if (assign) {
    await assertCanGrantRoles(ctx, [role.id]);
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: target.id, roleId: role.id } },
      update: {},
      create: { userId: target.id, roleId: role.id, assignedBy: ctx.user.id },
    });
    await auditChange({
      action: USER_AUDIT.ROLE_ASSIGNED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: target.id,
    });
    // Granting access does not invalidate anything.
    return { revokedSessions: 0 };
  }

  // --- revocation guards ---------------------------------------------------
  if (role.key === ROLES.SYSTEM_ADMIN) {
    if (target.id === ctx.user.id) {
      throw new ConflictError(
        "You cannot remove your own System Administrator role. Ask another administrator.",
      );
    }
    if (target.roleKeys.includes(ROLES.SYSTEM_ADMIN)) {
      const admins = await countEnabledSystemAdmins();
      if (admins <= 1) {
        throw new ConflictError(
          "This is the last enabled System Administrator. That role cannot be removed.",
        );
      }
    }
  }

  const before = await effectivePermissions(target.id);

  await prisma.userRole.deleteMany({
    where: { userId: target.id, roleId: role.id },
  });

  const after = await effectivePermissions(target.id);
  const removed = [...before].filter((permission) => !after.has(permission));

  await auditChange({
    action: USER_AUDIT.ROLE_REVOKED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: target.id,
  });

  // A REDUCTION in effective permissions must not leave live sessions holding
  // the old access. Session rows are deleted so the next request re-authorizes.
  let revokedSessions = 0;
  if (removed.length > 0) {
    revokedSessions = await revokeUserSessions(target.id);
    if (revokedSessions > 0) {
      await auditChange({
        action: USER_AUDIT.SESSIONS_REVOKED,
        actorId: ctx.user.id,
        actorRole: actorRoleOf(ctx.user),
        targetId: target.id,
      });
    }
  }

  return { revokedSessions };
}

export async function setUserOperatorScope(
  ctx: UserAdminContext,
  input: unknown,
): Promise<void> {
  const data = parseSchema(operatorScopeSchema, input);
  const assign = data.assign === "true";
  await getUserOrThrow(data.userId);

  const operator = await prisma.operator.findUnique({
    where: { id: data.operatorId },
    select: { id: true },
  });
  if (!operator) {
    throw new ValidationError("That operator no longer exists.", {
      operatorId: ["That operator no longer exists."],
    });
  }

  if (assign) {
    await prisma.userOperator.upsert({
      where: {
        userId_operatorId: { userId: data.userId, operatorId: data.operatorId },
      },
      update: {},
      create: {
        userId: data.userId,
        operatorId: data.operatorId,
        assignedBy: ctx.user.id,
      },
    });
  } else {
    await prisma.userOperator.deleteMany({
      where: { userId: data.userId, operatorId: data.operatorId },
    });
  }

  await auditChange({
    action: assign ? USER_AUDIT.OPERATOR_ASSIGNED : USER_AUDIT.OPERATOR_REVOKED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: data.userId,
  });

  // Operator scope is read from the database on EVERY request, so the change
  // applies immediately without revoking sessions.
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Anti-escalation: an actor may only grant roles whose permission set is a
 * subset of the actor's own effective permissions.
 */
async function assertCanGrantRoles(
  ctx: UserAdminContext,
  roleIds: string[],
): Promise<void> {
  if (roleIds.length === 0) return;

  const rows = await prisma.rolePermission.findMany({
    where: { roleId: { in: roleIds } },
    select: { permission: { select: { key: true } } },
  });
  const requested = new Set(rows.map((row) => row.permission.key));
  const missing = [...requested].filter(
    (permission) => !ctx.user.permissions.has(permission as never),
  );

  if (missing.length > 0) {
    throw new ConflictError(
      "You cannot grant a role that includes permissions you do not hold yourself.",
    );
  }
}

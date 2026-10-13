import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/authorization";
import type { PermissionKey } from "@/lib/rbac";
import { ConflictError, ValidationError } from "@/lib/forms";
import * as users from "@/lib/users/service";
import { isAcceptablePassword } from "@/lib/passwords";

/**
 * LIVE DATABASE integration test for Phase B — user and access administration.
 *
 * Proves against the real MariaDB database that:
 *  - an account is created with a hashed credential and the requested roles;
 *  - duplicate emails and weak passwords are refused;
 *  - disabling an account sets the marker AND deletes its sessions;
 *  - an actor cannot disable their own account;
 *  - privilege escalation is refused when the actor lacks the permission;
 *  - reducing permissions revokes sessions;
 *  - operator scope assignment is recorded and audited;
 *  - no password or hash is written to the audit trail.
 *
 * Every row created here is namespaced and removed in afterAll. Nothing
 * pre-existing is modified or deleted.
 */

const RUN = `ZZB${Date.now().toString(36).toUpperCase()}`;
const hasDatabase = Boolean(process.env.DATABASE_URL);

const createdUserIds: string[] = [];
const createdOperatorIds: string[] = [];

let actor: CurrentUser;
let actorId = "";
let operatorId = "";

const describeDb = hasDatabase ? describe : describe.skip;

async function permissionsOfRole(key: string): Promise<Set<PermissionKey>> {
  const role = await prisma.role.findUnique({
    where: { key },
    select: { permissions: { select: { permission: { select: { key: true } } } } },
  });
  return new Set(
    (role?.permissions ?? []).map(
      (rp) => rp.permission.key as PermissionKey,
    ),
  );
}

describeDb("Phase B — user administration against live MariaDB", () => {
  beforeAll(async () => {
    const adminUser = await prisma.user.create({
      data: {
        id: `usr_${randomUUID()}`,
        name: "Synthetic Access Administrator",
        email: `${RUN.toLowerCase()}.actor@example.test`,
      },
      select: { id: true },
    });
    actorId = adminUser.id;
    createdUserIds.push(actorId);

    const systemAdminRole = await prisma.role.findUniqueOrThrow({
      where: { key: "SYSTEM_ADMIN" },
      select: { id: true },
    });
    await prisma.userRole.create({
      data: { userId: actorId, roleId: systemAdminRole.id, assignedBy: actorId },
    });

    actor = {
      id: actorId,
      email: `${RUN.toLowerCase()}.actor@example.test`,
      name: "Synthetic Access Administrator",
      roles: ["SYSTEM_ADMIN"],
      permissions: await permissionsOfRole("SYSTEM_ADMIN"),
      operatorIds: [],
      disabled: false,
    };

    const operator = await prisma.operator.create({
      data: { code: `${RUN}-OP`, name: "Synthetic Scoped Operator" },
      select: { id: true },
    });
    operatorId = operator.id;
    createdOperatorIds.push(operatorId);
  });

  afterAll(async () => {
    const ids = [...createdUserIds, ...createdOperatorIds];
    await prisma.auditEvent.deleteMany({
      where: { OR: [{ actorId: { in: createdUserIds } }, { targetId: { in: ids } }] },
    });
    // Deleting a user cascades sessions, accounts, roles and operator links.
    if (createdUserIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    if (createdOperatorIds.length) {
      await prisma.operator.deleteMany({ where: { id: { in: createdOperatorIds } } });
    }
    await prisma.$disconnect();
  });

  it("creates an account with a hashed credential, the requested role and audit evidence", async () => {
    const result = await users.createUser(
      { user: actor },
      {
        name: "Synthetic Officer",
        email: `${RUN}.officer@example.test`,
        roleKeys: ["DEPARTMENT_OFFICER"],
        operatorIds: [],
        initialPassword: "",
      },
    );
    createdUserIds.push(result.id);

    expect(result.generated).toBe(true);
    expect(isAcceptablePassword(result.initialPassword)).toBe(true);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: result.id },
      select: {
        email: true,
        disabledAt: true,
        accounts: { select: { providerId: true, password: true } },
        roleAssignments: { select: { role: { select: { key: true } } } },
      },
    });
    expect(stored.email).toBe(`${RUN.toLowerCase()}.officer@example.test`);
    expect(stored.disabledAt).toBeNull();
    expect(stored.roleAssignments.map((a) => a.role.key)).toEqual([
      "DEPARTMENT_OFFICER",
    ]);

    // The credential is hashed, never stored in plaintext.
    const credential = stored.accounts.find((a) => a.providerId === "credential");
    expect(credential?.password).toBeTruthy();
    expect(credential?.password).not.toBe(result.initialPassword);

    // The audit event exists and contains NO password material.
    const audit = await prisma.auditEvent.findFirst({
      where: { action: "user.created", targetId: result.id },
      select: { actorId: true, outcome: true },
    });
    expect(audit?.outcome).toBe("success");
    expect(audit?.actorId).toBe(actorId);

    const serialised = JSON.stringify(
      await prisma.auditEvent.findMany({ where: { targetId: result.id } }),
    );
    expect(serialised).not.toContain(result.initialPassword);
  });

  it("refuses a duplicate email address", async () => {
    await expect(
      users.createUser(
        { user: actor },
        {
          name: "Duplicate",
          email: `${RUN}.officer@example.test`,
          roleKeys: [],
          operatorIds: [],
          initialPassword: "",
        },
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("refuses a weak or placeholder password", async () => {
    await expect(
      users.createUser(
        { user: actor },
        {
          name: "Weak Password",
          email: `${RUN}.weak@example.test`,
          roleKeys: [],
          operatorIds: [],
          initialPassword: "password",
        },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses an unknown role instead of silently ignoring it", async () => {
    await expect(
      users.createUser(
        { user: actor },
        {
          name: "Bad Role",
          email: `${RUN}.badrole@example.test`,
          roleKeys: ["NOT_A_REAL_ROLE"],
          operatorIds: [],
          initialPassword: "",
        },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses privilege escalation: a role with permissions the actor lacks", async () => {
    const limited: CurrentUser = {
      ...actor,
      roles: ["LIMITED"],
      permissions: new Set<PermissionKey>(["dashboard.view"]),
    };

    await expect(
      users.createUser(
        { user: limited },
        {
          name: "Escalation Attempt",
          email: `${RUN}.escalate@example.test`,
          roleKeys: ["SYSTEM_ADMIN"],
          operatorIds: [],
          initialPassword: "",
        },
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("disables an account, marks it and DELETES its live sessions", async () => {
    const created = await users.createUser(
      { user: actor },
      {
        name: "Synthetic Leaver",
        email: `${RUN}.leaver@example.test`,
        roleKeys: ["OPERATOR_STAFF"],
        operatorIds: [operatorId],
        initialPassword: "",
      },
    );
    createdUserIds.push(created.id);

    // Give the account a live session, as a real sign-in would.
    await prisma.session.create({
      data: {
        id: `ses_${randomUUID()}`,
        token: `tok_${randomUUID()}`,
        userId: created.id,
        expiresAt: new Date(Date.now() + 3600_000),
      },
      select: { id: true },
    });
    expect(await prisma.session.count({ where: { userId: created.id } })).toBe(1);

    const outcome = await users.setUserDisabled(
      { user: actor },
      { userId: created.id, reason: "synthetic leaver" },
    );
    expect(outcome.revokedSessions).toBe(1);

    const after = await prisma.user.findUniqueOrThrow({
      where: { id: created.id },
      select: { disabledAt: true, disabledReason: true },
    });
    expect(after.disabledAt).not.toBeNull();
    expect(after.disabledReason).toBe("synthetic leaver");
    expect(await prisma.session.count({ where: { userId: created.id } })).toBe(0);

    const audit = await prisma.auditEvent.findFirst({
      where: { action: "user.disabled", targetId: created.id },
    });
    expect(audit).not.toBeNull();

    // Re-enabling clears the marker.
    await users.setUserDisabled({ user: actor }, { userId: created.id });
    const reEnabled = await prisma.user.findUniqueOrThrow({
      where: { id: created.id },
      select: { disabledAt: true },
    });
    expect(reEnabled.disabledAt).toBeNull();
  });

  it("refuses to let an administrator disable their own account", async () => {
    await expect(
      users.setUserDisabled({ user: actor }, { userId: actorId }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("revokes sessions when a role change REDUCES permissions", async () => {
    const created = await users.createUser(
      { user: actor },
      {
        name: "Synthetic Demoted",
        email: `${RUN}.demoted@example.test`,
        roleKeys: ["SYSTEM_ADMIN"],
        operatorIds: [],
        initialPassword: "",
      },
    );
    createdUserIds.push(created.id);

    await prisma.session.create({
      data: {
        id: `ses_${randomUUID()}`,
        token: `tok_${randomUUID()}`,
        userId: created.id,
        expiresAt: new Date(Date.now() + 3600_000),
      },
      select: { id: true },
    });

    const role = await prisma.role.findUniqueOrThrow({
      where: { key: "SYSTEM_ADMIN" },
      select: { id: true },
    });

    const outcome = await users.setUserRole(
      { user: actor },
      { userId: created.id, roleKey: "SYSTEM_ADMIN", assign: "false" },
    );

    expect(outcome.revokedSessions).toBe(1);
    expect(await prisma.session.count({ where: { userId: created.id } })).toBe(0);
    expect(
      await prisma.userRole.count({ where: { userId: created.id, roleId: role.id } }),
    ).toBe(0);
  });

  it("assigns and revokes operator scope, auditing both", async () => {
    const created = await users.createUser(
      { user: actor },
      {
        name: "Synthetic Scoped Staff",
        email: `${RUN}.scoped@example.test`,
        roleKeys: ["OPERATOR_STAFF"],
        operatorIds: [],
        initialPassword: "",
      },
    );
    createdUserIds.push(created.id);

    await users.setUserOperatorScope(
      { user: actor },
      { userId: created.id, operatorId, assign: "true" },
    );
    expect(
      await prisma.userOperator.count({
        where: { userId: created.id, operatorId },
      }),
    ).toBe(1);

    const assigned = await prisma.auditEvent.findFirst({
      where: { action: "user.operator.assigned", targetId: created.id },
    });
    expect(assigned).not.toBeNull();

    await users.setUserOperatorScope(
      { user: actor },
      { userId: created.id, operatorId, assign: "false" },
    );
    expect(
      await prisma.userOperator.count({
        where: { userId: created.id, operatorId },
      }),
    ).toBe(0);

    const revoked = await prisma.auditEvent.findFirst({
      where: { action: "user.operator.revoked", targetId: created.id },
    });
    expect(revoked).not.toBeNull();
  });

  it("lists users without exposing credential columns", async () => {
    const page = await users.listUsers({ page: 1, pageSize: 50, q: RUN });
    expect(page.total).toBeGreaterThan(0);
    for (const row of page.rows) {
      expect(Object.keys(row)).not.toContain("password");
      expect(Object.keys(row)).not.toContain("accounts");
      expect(Object.keys(row)).not.toContain("sessions");
    }
    // The API surface cannot leak a hash even by accident.
    expect(JSON.stringify(page.rows)).not.toContain("password");
  });
});

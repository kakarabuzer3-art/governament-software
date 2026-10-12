/**
 * Development seed / administrator bootstrap.
 *
 * Usage:  npm run db:seed
 *
 * What it does (all idempotent — safe to run repeatedly):
 *  1. Ensures the provisional roles and permissions exist, and wires the
 *     role->permission matrix defined in src/lib/rbac.ts.
 *  2. Optionally creates ONE development administrator when the SEED_ADMIN_*
 *     environment values are present.
 *
 * SAFETY RULES enforced here:
 *  - It NEVER deletes the database or resets it.
 *  - It NEVER changes an existing administrator's password (so re-running can
 *    not silently rotate credentials).
 *  - It refuses to create an admin in production unless ALLOW_ADMIN_BOOTSTRAP
 *    is explicitly "true". This prevents accidentally creating a default
 *    production account.
 *  - It never prints the password to any log.
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { ROLE_DEFINITIONS, PERMISSIONS } from "../src/lib/rbac";

const prisma = new PrismaClient();

const isProduction = process.env.NODE_ENV === "production";

/** Generate a unique id string for a new row. */
function generateId(): string {
  return randomUUID();
}

async function ensureRolesAndPermissions(): Promise<void> {
  // 1. Permissions (union of every permission referenced by any role).
  const permissionKeys = new Set<string>(
    ROLE_DEFINITIONS.flatMap((role) => role.permissions as string[]),
  );
  // Guarantee every PERMISSIONS entry exists even if unassigned to a role.
  for (const key of Object.values(PERMISSIONS)) permissionKeys.add(key);

  for (const key of permissionKeys) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: `Capability: ${key}` },
    });
  }

  // 2. Roles.
  for (const def of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { key: def.key },
      update: { name: def.name, description: def.description },
      create: {
        key: def.key,
        name: def.name,
        description: def.description,
      },
    });

    // 3. Role -> permissions (add missing; never remove, to stay idempotent
    //    and avoid silently stripping grants during development).
    for (const permissionKey of def.permissions) {
      const permission = await prisma.permission.findUnique({
        where: { key: permissionKey },
      });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}

async function ensureDevelopmentAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Development Administrator";

  if (!email || !password) {
    console.log(
      "[seed] SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin bootstrap.",
    );
    return;
  }

  if (isProduction && process.env.ALLOW_ADMIN_BOOTSTRAP !== "true") {
    console.error(
      "[seed] Refusing to bootstrap an administrator in production: " +
        "set ALLOW_ADMIN_BOOTSTRAP=true explicitly if this is intended. " +
        "No account was created.",
    );
    return;
  }

  const systemAdmin = await prisma.role.findUnique({
    where: { key: "SYSTEM_ADMIN" },
  });
  if (!systemAdmin) {
    throw new Error("SYSTEM_ADMIN role missing — run role seeding first.");
  }

  // If the user already exists, do NOT reset the password. Just make sure the
  // SYSTEM_ADMIN role is attached (idempotent), then leave credentials alone.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: { userId: existing.id, roleId: systemAdmin.id },
      },
      update: {},
      create: {
        userId: existing.id,
        roleId: systemAdmin.id,
        assignedBy: existing.id,
      },
    });
    console.log(
      `[seed] Administrator ${email} already exists — password unchanged; ensured SYSTEM_ADMIN role.`,
    );
    return;
  }

  // Public sign-up is disabled, so auth.api.signUpEmail is blocked. We create
  // the user + credential account directly, hashing the password with Better
  // Auth's own hashPassword so sign-in verifies it correctly. Credential
  // account convention: providerId="credential", accountId=user.id, hashed
  // password stored on the Account row.
  const userId = `usr_${generateId()}`;
  const hashed = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      id: userId,
      email,
      name,
      emailVerified: false,
    },
  });

  await prisma.account.create({
    data: {
      id: `acc_${generateId()}`,
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: hashed,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: systemAdmin.id,
      assignedBy: user.id,
    },
  });

  // Log the email only — never the password.
  console.log(`[seed] Created development administrator: ${email}`);
}

async function main(): Promise<void> {
  console.log("[seed] Seeding roles, permissions and (optionally) admin…");
  await ensureRolesAndPermissions();
  await ensureDevelopmentAdmin();
  console.log("[seed] Done.");
}

main()
  .catch((error) => {
    console.error("[seed] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

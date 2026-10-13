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
 *  - It refuses placeholder/short passwords, so a usable default credential can
 *    never be committed or silently applied.
 *  - It never prints the password (or any secret) to any log.
 *  - Every bootstrap action is written to `audit_event` (best-effort).
 *
 * PHASE 2 DEFECT E: `./load-env` is imported FIRST. `tsx` does not load `.env`,
 * so without it this script silently ran with no configuration at all.
 */
import "./load-env";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { ROLE_DEFINITIONS, PERMISSIONS } from "../src/lib/rbac";
import {
  encryptField,
  fingerprintField,
  getFieldEncryptionKey,
} from "../src/lib/crypto/field-crypto";
import { maskCnic, maskMobile } from "../src/lib/mask";

let prisma: PrismaClient | null = null;

const isProduction = process.env.NODE_ENV === "production";

/** Audit action keys for the bootstrap path (mirrors AUTH_AUDIT_ACTIONS). */
const BOOTSTRAP_AUDIT = {
  ADMIN_CREATED: "auth.bootstrap.admin_created",
  ADMIN_ROLE_ENSURED: "auth.bootstrap.admin_role_ensured",
  REFUSED: "auth.bootstrap.refused",
} as const;

/**
 * Passwords that must never be usable as a real development credential. This
 * list only needs to catch values that look like committed defaults; the real
 * control is that `.env.example` ships an EMPTY value and the length check.
 */
const FORBIDDEN_PLACEHOLDER_PASSWORDS = new Set([
  "change-me-in-development",
  "changeme",
  "change-me",
  "password",
  "password123",
  "admin",
  "admin123",
  "administrator",
  "replace-with-a-strong-password",
  "your-password",
]);

/** Better Auth enforces this minimum; fail early with a clear message. */
const MIN_PASSWORD_LENGTH = 12;

/** Generate a unique id string for a new row. */
function generateId(): string {
  return randomUUID();
}

/**
 * Refuse to continue without a usable MySQL/MariaDB connection string. Runs
 * BEFORE PrismaClient is constructed so the failure message is actionable
 * instead of an opaque driver error. Never prints the URL itself.
 */
function requireDatabaseUrl(): void {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill it in " +
        "(mysql://USER:PASSWORD@127.0.0.1:3306/bpta_transport_dev).",
    );
  }
  if (!/^mysql:\/\//i.test(url)) {
    throw new Error(
      "DATABASE_URL must be a MySQL/MariaDB connection URL starting with " +
        "'mysql://' (this project uses XAMPP MariaDB, not PostgreSQL/SQLite).",
    );
  }
}

/** Best-effort audit write for the bootstrap path. */
async function writeBootstrapAudit(
  client: PrismaClient,
  action: string,
  actorId: string | null,
  outcome: "success" | "failure" = "success",
): Promise<void> {
  try {
    await client.auditEvent.create({
      data: {
        action,
        outcome,
        actorId,
        actorRole: "SYSTEM_ADMIN",
        targetId: actorId,
      },
    });
  } catch (error) {
    // A missing/unavailable audit table must never block role seeding, but we
    // do surface it to the operator.
    console.warn(
      "[seed] audit event not recorded:",
      error instanceof Error ? error.message : error,
    );
  }
}

async function ensureRolesAndPermissions(client: PrismaClient): Promise<void> {
  // 1. Permissions (union of every permission referenced by any role).
  const permissionKeys = new Set<string>(
    ROLE_DEFINITIONS.flatMap((role) => role.permissions as string[]),
  );
  // Guarantee every PERMISSIONS entry exists even if unassigned to a role.
  for (const key of Object.values(PERMISSIONS)) permissionKeys.add(key);

  for (const key of permissionKeys) {
    await client.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: `Capability: ${key}` },
    });
  }

  // 2. Roles.
  for (const def of ROLE_DEFINITIONS) {
    const role = await client.role.upsert({
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
      const permission = await client.permission.findUnique({
        where: { key: permissionKey },
      });
      if (!permission) continue;
      await client.rolePermission.upsert({
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

/** Validate the bootstrap credential without ever echoing it. */
function assertUsablePassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters ` +
        "(the authentication library enforces the same minimum). Create a " +
        "unique development password and put it only in your git-ignored .env.",
    );
  }
  if (FORBIDDEN_PLACEHOLDER_PASSWORDS.has(password.toLowerCase())) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is a known placeholder value. Set a unique " +
        "development password in your git-ignored .env — placeholder " +
        "credentials must never be usable.",
    );
  }
}

async function ensureDevelopmentAdmin(client: PrismaClient): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Development Administrator";

  // Half-configured bootstrap is a mistake, not an intentional skip: fail
  // loudly rather than appearing to succeed while creating nothing.
  if ((email && !password) || (!email && password)) {
    throw new Error(
      "Incomplete administrator bootstrap: set BOTH SEED_ADMIN_EMAIL and " +
        "SEED_ADMIN_PASSWORD, or neither (to skip admin creation).",
    );
  }

  if (!email || !password) {
    console.log(
      "[seed] SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin bootstrap.",
    );
    return;
  }

  if (isProduction && process.env.ALLOW_ADMIN_BOOTSTRAP !== "true") {
    await writeBootstrapAudit(client, BOOTSTRAP_AUDIT.REFUSED, null, "failure");
    console.error(
      "[seed] Refusing to bootstrap an administrator in production: " +
        "set ALLOW_ADMIN_BOOTSTRAP=true explicitly if this is intended. " +
        "No account was created.",
    );
    return;
  }

  assertUsablePassword(password);

  const systemAdmin = await client.role.findUnique({
    where: { key: "SYSTEM_ADMIN" },
  });
  if (!systemAdmin) {
    throw new Error("SYSTEM_ADMIN role missing — run role seeding first.");
  }

  // If the user already exists, do NOT reset the password. Just make sure the
  // SYSTEM_ADMIN role is attached (idempotent), then leave credentials alone.
  const existing = await client.user.findUnique({ where: { email } });
  if (existing) {
    await client.userRole.upsert({
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
    await writeBootstrapAudit(
      client,
      BOOTSTRAP_AUDIT.ADMIN_ROLE_ENSURED,
      existing.id,
    );
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

  const user = await client.user.create({
    data: {
      id: userId,
      email,
      name,
      emailVerified: false,
    },
  });

  await client.account.create({
    data: {
      id: `acc_${generateId()}`,
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: hashed,
    },
  });

  await client.userRole.create({
    data: {
      userId: user.id,
      roleId: systemAdmin.id,
      assignedBy: user.id,
    },
  });

  await writeBootstrapAudit(client, BOOTSTRAP_AUDIT.ADMIN_CREATED, user.id);

  // Log the email only — never the password.
  console.log(`[seed] Created development administrator: ${email}`);
}

/**
 * Seed a small, clearly-synthetic demonstration dataset (Phases 3–5).
 *
 * WHY: an empty database cannot demonstrate that the workflows actually work,
 * and the internal dashboard now shows live counts. This creates a handful of
 * obviously-fake records so the prototype is explorable immediately.
 *
 * SAFETY RULES:
 *  - Every value is obviously synthetic ("Sample … (synthetic)") and the
 *    identity numbers are deliberately non-real test sequences.
 *  - Idempotent: everything is keyed by its unique business identifier, so
 *    re-running changes nothing.
 *  - Nothing is deleted, and nothing existing is overwritten destructively
 *    (upserts only fill in missing rows).
 *  - Runs only outside production, and can be disabled with SEED_DEMO_DATA=false.
 *  - Passenger identity values are stored ENCRYPTED, exactly as the application
 *    does. If no encryption key is configured, passenger seeding is SKIPPED with
 *    a warning instead of writing plaintext.
 */
async function ensureDemoData(client: PrismaClient): Promise<void> {
  if (isProduction) {
    console.log("[seed] Production detected — skipping synthetic demo data.");
    return;
  }
  const enabled = (process.env.SEED_DEMO_DATA ?? "true").trim().toLowerCase();
  if (enabled === "false" || enabled === "0" || enabled === "no") {
    console.log("[seed] SEED_DEMO_DATA disabled — skipping demo data.");
    return;
  }

  // --- Operators -----------------------------------------------------------
  const operatorA = await client.operator.upsert({
    where: { code: "OPR-DEMO-01" },
    update: {},
    create: {
      code: "OPR-DEMO-01",
      name: "Sample Coastal Transport (synthetic)",
      legalName: "Sample Coastal Transport (Private) Limited (synthetic)",
      city: "Quetta",
      addressLine: "Sample address, synthetic data only",
      contactPhone: "0000-0000000",
      contactEmail: "sample.operator@example.test",
      status: "ACTIVE",
      notes: "Synthetic record created by prisma/seed.ts. Not a real operator.",
    },
  });
  const operatorB = await client.operator.upsert({
    where: { code: "OPR-DEMO-02" },
    update: {},
    create: {
      code: "OPR-DEMO-02",
      name: "Sample Highland Coaches (synthetic)",
      city: "Quetta",
      status: "SUSPENDED",
      notes: "Synthetic record created by prisma/seed.ts. Not a real operator.",
    },
  });

  // --- Vehicles ------------------------------------------------------------
  const vehicleA1 = await client.vehicle.upsert({
    where: { registrationNumber: "SAMPLE-BLA-1001" },
    update: {},
    create: {
      registrationNumber: "SAMPLE-BLA-1001",
      operatorId: operatorA.id,
      vehicleType: "COASTER",
      make: "Sample Make",
      model: "Sample Model",
      modelYear: 2019,
      seatingCapacity: 26,
      status: "ACTIVE",
    },
  });
  await client.vehicle.upsert({
    where: { registrationNumber: "SAMPLE-BLA-1002" },
    update: {},
    create: {
      registrationNumber: "SAMPLE-BLA-1002",
      operatorId: operatorA.id,
      vehicleType: "BUS",
      make: "Sample Make",
      model: "Sample Model",
      modelYear: 2017,
      seatingCapacity: 45,
      status: "MAINTENANCE",
    },
  });
  const vehicleB1 = await client.vehicle.upsert({
    where: { registrationNumber: "SAMPLE-QTA-2001" },
    update: {},
    create: {
      registrationNumber: "SAMPLE-QTA-2001",
      operatorId: operatorB.id,
      vehicleType: "HIACE",
      make: "Sample Make",
      model: "Sample Model",
      modelYear: 2021,
      seatingCapacity: 14,
      status: "ACTIVE",
    },
  });

  // --- Routes --------------------------------------------------------------
  const routeA = await client.route.upsert({
    where: { code: "RTE-DEMO-01" },
    update: {},
    create: {
      code: "RTE-DEMO-01",
      name: "Sample Quetta → Karachi corridor (synthetic)",
      originCity: "Quetta",
      destinationCity: "Karachi",
      distanceKm: 712.5,
      estimatedMinutes: 660,
      status: "ACTIVE",
    },
  });
  const routeB = await client.route.upsert({
    where: { code: "RTE-DEMO-02" },
    update: {},
    create: {
      code: "RTE-DEMO-02",
      name: "Sample Quetta → Gwadar corridor (synthetic)",
      originCity: "Quetta",
      destinationCity: "Gwadar",
      distanceKm: 630,
      estimatedMinutes: 600,
      status: "ACTIVE",
    },
  });

  // --- Permits (recorded status only — never "verified") -------------------
  await client.permit.upsert({
    where: { permitNumber: "SAMPLE-PMT-0001" },
    update: {},
    create: {
      permitNumber: "SAMPLE-PMT-0001",
      operatorId: operatorA.id,
      vehicleId: vehicleA1.id,
      routeId: routeA.id,
      permitType: "ROUTE",
      issuedOn: new Date("2026-01-10T00:00:00.000Z"),
      expiresOn: new Date("2027-01-09T00:00:00.000Z"),
      status: "ACTIVE",
      recordedSource: "MANUAL_ENTRY",
      notes:
        "Synthetic record. Status is a RECORDED value and has not been verified against any government source.",
    },
  });
  await client.permit.upsert({
    where: { permitNumber: "SAMPLE-PMT-0002" },
    update: {},
    create: {
      permitNumber: "SAMPLE-PMT-0002",
      operatorId: operatorB.id,
      vehicleId: vehicleB1.id,
      routeId: routeB.id,
      permitType: "ROUTE",
      status: "PENDING",
      recordedSource: "UNVERIFIED",
      notes: "Synthetic record awaiting a recorded decision.",
    },
  });

  // --- Journeys ------------------------------------------------------------
  const tripA = await client.trip.upsert({
    where: { tripRef: "TRP-DEMO-0001" },
    update: {},
    create: {
      tripRef: "TRP-DEMO-0001",
      operatorId: operatorA.id,
      vehicleId: vehicleA1.id,
      routeId: routeA.id,
      departureAt: new Date("2026-11-01T08:00:00.000Z"),
      status: "SCHEDULED",
      notes: "Synthetic journey.",
    },
  });
  await client.trip.upsert({
    where: { tripRef: "TRP-DEMO-0002" },
    update: {},
    create: {
      tripRef: "TRP-DEMO-0002",
      operatorId: operatorB.id,
      vehicleId: vehicleB1.id,
      routeId: routeB.id,
      departureAt: new Date("2026-11-02T09:30:00.000Z"),
      status: "SCHEDULED",
      notes: "Synthetic journey.",
    },
  });

  // --- Passenger manifest (encrypted at rest) ------------------------------
  const key = getFieldEncryptionKey();

  if (!key) {
    console.warn(
      "[seed] FIELD_ENCRYPTION_KEY is not configured — SKIPPING passenger " +
        "demonstration data (passenger values are never written in plaintext).",
    );
  } else {
    const samples = [
      {
        passengerName: "Sample Passenger One (synthetic)",
        fatherName: "Sample Father One (synthetic)",
        identityNumber: "3520112345671",
        mobileNumber: "03001234567",
        permanentAddress: "Sample House 1, Sample Street, Quetta (synthetic)",
      },
      {
        passengerName: "Sample Passenger Two (synthetic)",
        fatherName: "Sample Father Two (synthetic)",
        identityNumber: "3520198765432",
        mobileNumber: "03211234567",
        permanentAddress: "Sample House 2, Sample Street, Quetta (synthetic)",
      },
    ];

    for (const sample of samples) {
      const fingerprint = fingerprintField(sample.identityNumber, key);
      await client.passenger.upsert({
        where: {
          tripId_identityFingerprint: {
            tripId: tripA.id,
            identityFingerprint: fingerprint,
          },
        },
        update: {},
        create: {
          tripId: tripA.id,
          passengerName: sample.passengerName,
          fatherName: sample.fatherName,
          identityType: "CNIC",
          identityNumberEncrypted: encryptField(sample.identityNumber, key),
          identityFingerprint: fingerprint,
          identityMasked: maskCnic(sample.identityNumber),
          mobileEncrypted: encryptField(sample.mobileNumber, key),
          mobileMasked: maskMobile(sample.mobileNumber),
          permanentAddressEncrypted: encryptField(
            sample.permanentAddress,
            key,
          ),
        },
      });
    }
    console.log("[seed] Ensured 2 synthetic manifest entries (encrypted).");
  }

  // --- CCTV inspection -----------------------------------------------------
  const inspectionSite = "Sample Quetta Terminal (synthetic)";
  const existingInspection = await client.inspection.findFirst({
    where: { siteName: inspectionSite },
    select: { id: true },
  });
  if (!existingInspection) {
    await client.inspection.create({
      data: {
        siteName: inspectionSite,
        city: "Quetta",
        operatorId: operatorA.id,
        cameraCount: 6,
        camerasOperational: 5,
        inspectionDate: new Date("2026-07-15T00:00:00.000Z"),
        result: "PASS_WITH_FINDINGS",
        findings:
          "One camera housing damaged; recording could not be confirmed for that unit.",
        responsibleParty: "Sample Inspection Officer (synthetic)",
        followUpAction: "Requested replacement of the damaged housing.",
        nextDueOn: new Date("2026-10-15T00:00:00.000Z"),
      },
    });
  }

  // --- Incident ------------------------------------------------------------
  await client.incident.upsert({
    where: { reference: "INC-DEMO-0001" },
    update: {},
    create: {
      reference: "INC-DEMO-0001",
      operatorId: operatorA.id,
      occurredOn: new Date("2026-07-20T11:15:00.000Z"),
      location: "Sample Terminal, Quetta (synthetic)",
      category: "Service delay",
      severity: "LOW",
      description:
        "A scheduled service departed 35 minutes late following a temporary road closure. Recorded as an observation only; no person is identified or assessed.",
      status: "UNDER_REVIEW",
      reportedBy: "Sample Terminal Supervisor (synthetic)",
    },
  });

  // A single audit marker so the trail shows the origin of this data.
  try {
    const alreadyMarked = await client.auditEvent.findFirst({
      where: { action: "system.seed.demo_data" },
      select: { id: true },
    });
    if (!alreadyMarked) {
      await client.auditEvent.create({
        data: {
          action: "system.seed.demo_data",
          outcome: "success",
          actorId: null,
          actorRole: "SYSTEM",
          targetId: null,
        },
      });
    }
  } catch {
    // Audit table unavailable — demo data is still usable.
  }

  console.log(
    "[seed] Ensured synthetic demo data (2 operators, 3 vehicles, 2 routes, 2 permits, 2 journeys, 1 inspection, 1 incident).",
  );
}

async function main(): Promise<void> {
  console.log("[seed] Seeding roles, permissions and (optionally) admin…");
  requireDatabaseUrl();
  const client = new PrismaClient();
  prisma = client;
  await ensureRolesAndPermissions(client);
  await ensureDevelopmentAdmin(client);
  await ensureDemoData(client);
  console.log("[seed] Done.");
}

main()
  .catch((error) => {
    console.error("[seed] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/lib/transport/errors";
import type { TransportContext } from "@/lib/transport/context";
import type { PermissionKey } from "@/lib/rbac";
import { resolveOperatorScope } from "@/lib/transport/scope";
import * as operators from "@/lib/transport/operators";
import * as vehicles from "@/lib/transport/vehicles";
import * as routes from "@/lib/transport/routes";
import * as permits from "@/lib/transport/permits";

/**
 * LIVE DATABASE integration test for Phase 3 (MariaDB via XAMPP).
 *
 * This test is deliberately NOT mocked: it proves that the CRUD workflows,
 * uniqueness checks, relationship integrity, operator isolation and audit
 * writes really work against the configured MariaDB database.
 *
 * All data created here is synthetic and namespaced with a per-run prefix
 * (`ZZT...`) so it can be identified and removed afterwards. The test never
 * resets, truncates or drops anything, and only deletes the exact rows it
 * created. If `DATABASE_URL` is unavailable the whole suite is skipped rather
 * than reported as passing.
 */

const RUN = `ZZT${Date.now().toString(36).toUpperCase()}`;
const hasDatabase = Boolean(process.env.DATABASE_URL);

let actorId = "";
const createdOperatorIds: string[] = [];
const createdVehicleIds: string[] = [];
const createdRouteIds: string[] = [];
const createdPermitIds: string[] = [];

function ctxFor(
  roles: string[],
  operatorIds: string[] = [],
  permissions: PermissionKey[] = [],
): TransportContext {
  return {
    user: {
      id: actorId,
      email: `${RUN.toLowerCase()}@example.test`,
      name: "Synthetic Test Actor",
      roles,
      permissions: new Set<PermissionKey>(permissions),
      operatorIds,
    },
    scope: resolveOperatorScope({ roles, operatorIds }),
  };
}

const admin = () => ctxFor(["SYSTEM_ADMIN"]);
const staff = (ids: string[]) => ctxFor(["OPERATOR_STAFF"], ids);

const describeDb = hasDatabase ? describe : describe.skip;

describeDb("Phase 3 CRUD against live MariaDB", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        id: `usr_${randomUUID()}`,
        name: "Synthetic Test Actor",
        email: `${RUN.toLowerCase()}@example.test`,
      },
      select: { id: true },
    });
    actorId = user.id;
  });

  afterAll(async () => {
    // Remove only what this run created, in dependency order.
    await prisma.auditEvent.deleteMany({ where: { actorId } });
    if (createdPermitIds.length) {
      await prisma.permit.deleteMany({ where: { id: { in: createdPermitIds } } });
    }
    if (createdVehicleIds.length) {
      await prisma.vehicle.deleteMany({ where: { id: { in: createdVehicleIds } } });
    }
    if (createdOperatorIds.length) {
      await prisma.operator.deleteMany({ where: { id: { in: createdOperatorIds } } });
    }
    if (createdRouteIds.length) {
      await prisma.route.deleteMany({ where: { id: { in: createdRouteIds } } });
    }
    if (actorId) {
      await prisma.user.delete({ where: { id: actorId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("creates an operator, persists it, and writes an audit event", async () => {
    const created = await operators.createOperator(admin(), {
      code: `${RUN}-OP1`,
      name: "Synthetic Transport Co",
      city: "Quetta",
      status: "ACTIVE",
    });
    createdOperatorIds.push(created.id);

    const stored = await prisma.operator.findUnique({
      where: { id: created.id },
      select: { code: true, name: true, status: true },
    });
    expect(stored?.code).toBe(`${RUN}-OP1`);
    expect(stored?.status).toBe("ACTIVE");

    const audit = await prisma.auditEvent.findFirst({
      where: { action: "operator.created", targetId: created.id },
      select: { outcome: true, actorId: true },
    });
    expect(audit?.outcome).toBe("success");
    expect(audit?.actorId).toBe(actorId);
  });

  it("rejects a duplicate operator code with a field-scoped conflict", async () => {
    await expect(
      operators.createOperator(admin(), {
        code: `${RUN}-OP1`,
        name: "Duplicate Attempt",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects invalid input with field errors", async () => {
    const error = await operators
      .createOperator(admin(), { code: "!!", name: "" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fieldErrors).toHaveProperty("code");
  });

  it("creates a vehicle for an operator and blocks a duplicate registration", async () => {
    const operatorId = createdOperatorIds[0];
    const created = await vehicles.createVehicle(admin(), {
      registrationNumber: `${RUN}-V1`,
      operatorId,
      vehicleType: "COASTER",
      seatingCapacity: "26",
    });
    createdVehicleIds.push(created.id);

    await expect(
      vehicles.createVehicle(admin(), {
        registrationNumber: `${RUN}-V1`,
        operatorId,
        vehicleType: "BUS",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("creates a route", async () => {
    const created = await routes.createRoute(admin(), {
      code: `${RUN}-R1`,
      name: "Synthetic Route",
      originCity: "Quetta",
      destinationCity: "Karachi",
      distanceKm: "712.5",
    });
    createdRouteIds.push(created.id);
    expect(created.id).toBeTruthy();
  });

  it("records a permit and rejects a vehicle from a different operator", async () => {
    // Second operator + vehicle, to prove cross-relationship denial.
    const otherOperator = await operators.createOperator(admin(), {
      code: `${RUN}-OP2`,
      name: "Other Synthetic Operator",
    });
    createdOperatorIds.push(otherOperator.id);
    const otherVehicle = await vehicles.createVehicle(admin(), {
      registrationNumber: `${RUN}-V2`,
      operatorId: otherOperator.id,
    });
    createdVehicleIds.push(otherVehicle.id);

    await expect(
      permits.createPermit(admin(), {
        permitNumber: `${RUN}-P-BAD`,
        operatorId: createdOperatorIds[0],
        vehicleId: otherVehicle.id,
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    const created = await permits.createPermit(admin(), {
      permitNumber: `${RUN}-P1`,
      operatorId: createdOperatorIds[0],
      vehicleId: createdVehicleIds[0],
      routeId: createdRouteIds[0],
      status: "ACTIVE",
      recordedSource: "MANUAL_ENTRY",
    });
    createdPermitIds.push(created.id);
    expect(created.id).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Operator isolation
  // -------------------------------------------------------------------------

  it("shows an operator-staff account ONLY its assigned operator", async () => {
    const mine = createdOperatorIds[0];
    const other = createdOperatorIds[1];

    const page = await operators.listOperators(staff([mine]), {
      page: 1,
      pageSize: 50,
      q: RUN,
    });
    const ids = page.rows.map((row) => row.id);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(other);
  });

  it("shows an UNASSIGNED operator account no records at all", async () => {
    const page = await operators.listOperators(staff([]), {
      page: 1,
      pageSize: 50,
      q: RUN,
    });
    expect(page.total).toBe(0);
    expect(page.rows).toEqual([]);
  });

  it("denies cross-operator reads (reported as not found)", async () => {
    const other = createdOperatorIds[1];
    await expect(
      operators.getOperatorOrThrow(staff([createdOperatorIds[0]]), other),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("denies attaching a vehicle to another operator's account", async () => {
    const other = createdOperatorIds[1];
    await expect(
      vehicles.createVehicle(staff([createdOperatorIds[0]]), {
        registrationNumber: `${RUN}-V-STEAL`,
        operatorId: other,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("hides other operators' vehicles from a scoped list", async () => {
    const mine = createdOperatorIds[0];
    const page = await vehicles.listVehicles(staff([mine]), {
      page: 1,
      pageSize: 50,
      q: RUN,
    });
    expect(page.rows.every((row) => row.operator.id === mine)).toBe(true);
    expect(page.rows.length).toBeGreaterThan(0);
  });

  it("hides other operators' permits from a scoped list", async () => {
    const mine = createdOperatorIds[0];
    const page = await permits.listPermits(staff([mine]), {
      page: 1,
      pageSize: 50,
      q: RUN,
    });
    expect(page.rows.every((row) => row.operator.id === mine)).toBe(true);
  });

  it("archives an operator without deleting it", async () => {
    const operatorId = createdOperatorIds[1];
    await operators.archiveOperator(admin(), operatorId);

    const stored = await prisma.operator.findUnique({
      where: { id: operatorId },
      select: { status: true, archivedAt: true },
    });
    expect(stored?.status).toBe("ARCHIVED");
    expect(stored?.archivedAt).not.toBeNull();

    // Archive is an audited change.
    const audit = await prisma.auditEvent.findFirst({
      where: { action: "operator.archived", targetId: operatorId },
    });
    expect(audit).not.toBeNull();
  });

  it("updates a record and audits the change", async () => {
    const operatorId = createdOperatorIds[0];
    await operators.updateOperator(admin(), operatorId, {
      code: `${RUN}-OP1`,
      name: "Synthetic Transport Co (renamed)",
      status: "ACTIVE",
    });
    const stored = await prisma.operator.findUnique({
      where: { id: operatorId },
      select: { name: true },
    });
    expect(stored?.name).toContain("renamed");

    const audit = await prisma.auditEvent.findFirst({
      where: { action: "operator.updated", targetId: operatorId },
    });
    expect(audit?.actorId).toBe(actorId);
  });
});

/**
 * Vehicle records — server-side business logic (Phase 3).
 *
 * Vehicles belong to exactly one operator. The operator relationship is the
 * isolation boundary for OPERATOR_STAFF: a vehicle may only be created,
 * updated, listed or archived when its operator is inside the caller's scope.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError, parseSchema } from "./errors";
import {
  auditChange,
  buildPage,
  isUniqueConstraintError,
  skipFor,
  type Page,
} from "./crud";
import { actorRoleOf, canAccessOperator, operatorFilter } from "./scope";
import type { TransportContext } from "./context";
import { requireOperatorInScope } from "./operators";
import { vehicleCreateSchema, type ListQuery } from "./validation";

export const VEHICLE_AUDIT = {
  CREATED: "vehicle.created",
  UPDATED: "vehicle.updated",
  ARCHIVED: "vehicle.archived",
} as const;

export const vehicleListSelect = {
  id: true,
  registrationNumber: true,
  vehicleType: true,
  make: true,
  model: true,
  modelYear: true,
  seatingCapacity: true,
  status: true,
  notes: true,
  updatedAt: true,
  operator: { select: { id: true, name: true, code: true } },
} satisfies Prisma.VehicleSelect;

export type VehicleListRow = Prisma.VehicleGetPayload<{
  select: typeof vehicleListSelect;
}>;

export function vehicleWhere(
  ctx: Pick<TransportContext, "scope">,
  query: ListQuery,
): Prisma.VehicleWhereInput {
  const conditions: Prisma.VehicleWhereInput[] = [
    operatorFilter(ctx.scope) as Prisma.VehicleWhereInput,
    query.status ? { status: query.status } : { status: { not: "ARCHIVED" } },
  ];
  if (query.q) {
    const q = query.q;
    conditions.push({
      OR: [
        { registrationNumber: { contains: q } },
        { make: { contains: q } },
        { model: { contains: q } },
        { operator: { name: { contains: q } } },
      ],
    });
  }
  return { AND: conditions };
}

export async function listVehicles(
  ctx: TransportContext,
  query: ListQuery,
): Promise<Page<VehicleListRow>> {
  const where = vehicleWhere(ctx, query);
  const [total, rows] = await Promise.all([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({
      where,
      select: vehicleListSelect,
      orderBy: [{ registrationNumber: "asc" }],
      skip: skipFor(query.page, query.pageSize),
      take: query.pageSize,
    }),
  ]);
  return buildPage(rows, total, query.page, query.pageSize);
}

/** Load one vehicle inside the caller's scope, or throw NotFound. */
export async function getVehicleOrThrow(
  ctx: TransportContext,
  id: string,
): Promise<VehicleListRow> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: vehicleListSelect,
  });
  if (!vehicle || !canAccessOperator(ctx.scope, vehicle.operator.id)) {
    throw new NotFoundError("Vehicle not found.");
  }
  return vehicle;
}

export async function createVehicle(
  ctx: TransportContext,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  const data = parseSchema(vehicleCreateSchema, input);
  // Cross-operator denial: a vehicle can only be attached to an operator the
  // caller is allowed to manage.
  await requireOperatorInScope(ctx, data.operatorId);
  await assertRegistrationAvailable(data.registrationNumber);

  try {
    const created = await prisma.vehicle.create({
      data,
      select: { id: true },
    });
    await auditChange({
      action: VEHICLE_AUDIT.CREATED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: created.id,
    });
    return created;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError(
        `Vehicle registration ${data.registrationNumber} is already recorded.`,
        "registrationNumber",
      );
    }
    throw error;
  }
}

export async function updateVehicle(
  ctx: TransportContext,
  id: string,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  await getVehicleOrThrow(ctx, id);
  const data = parseSchema(vehicleCreateSchema, input);
  await requireOperatorInScope(ctx, data.operatorId);
  await assertRegistrationAvailable(data.registrationNumber, id);

  try {
    const updated = await prisma.vehicle.update({
      where: { id },
      data,
      select: { id: true },
    });
    await auditChange({
      action: VEHICLE_AUDIT.UPDATED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: updated.id,
    });
    return updated;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError(
        `Vehicle registration ${data.registrationNumber} is already recorded.`,
        "registrationNumber",
      );
    }
    throw error;
  }
}

/** Archive (soft-deactivate) a vehicle. Never deletes. */
export async function archiveVehicle(
  ctx: TransportContext,
  id: string,
): Promise<void> {
  const vehicle = await getVehicleOrThrow(ctx, id);
  if (vehicle.status === "ARCHIVED") return;

  await prisma.vehicle.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
    select: { id: true },
  });
  await auditChange({
    action: VEHICLE_AUDIT.ARCHIVED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: id,
  });
}

async function assertRegistrationAvailable(
  registrationNumber: string,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.vehicle.findFirst({
    where: {
      registrationNumber,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(
      `Vehicle registration ${registrationNumber} is already recorded.`,
      "registrationNumber",
    );
  }
}

/** Vehicles for select inputs, restricted to the caller's scope. */
export async function vehicleOptions(
  ctx: TransportContext,
): Promise<
  Array<{ id: string; registrationNumber: string; operatorId: string }>
> {
  return prisma.vehicle.findMany({
    where: {
      AND: [
        operatorFilter(ctx.scope) as Prisma.VehicleWhereInput,
        { status: { not: "ARCHIVED" } },
      ],
    },
    select: { id: true, registrationNumber: true, operatorId: true },
    orderBy: { registrationNumber: "asc" },
  });
}

/**
 * Verify that a vehicle (when supplied) exists AND belongs to the expected
 * operator. Prevents attaching another operator's vehicle to a record.
 */
export async function assertVehicleMatchesOperator(
  operatorId: string,
  vehicleId: string | null | undefined,
): Promise<void> {
  if (!vehicleId) return;
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { id: true, operatorId: true },
  });
  if (!vehicle) {
    throw new NotFoundError("Vehicle not found.");
  }
  if (vehicle.operatorId !== operatorId) {
    throw new ConflictError(
      "The selected vehicle does not belong to the selected operator.",
      "vehicleId",
    );
  }
}

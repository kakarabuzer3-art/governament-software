/**
 * Trip (journey) records — server-side business logic (Phase 4).
 *
 * A trip belongs to one operator, so it inherits the same isolation rule as
 * vehicles and permits: every read and write is filtered by the caller's
 * operator scope, resolved from trusted database relations.
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
import { assertVehicleMatchesOperator } from "./vehicles";
import { assertRouteExists } from "./routes";
import { tripCreateSchema, type ListQuery } from "./validation";

export const TRIP_AUDIT = {
  CREATED: "trip.created",
  UPDATED: "trip.updated",
  ARCHIVED: "trip.archived",
} as const;

export const tripListSelect = {
  id: true,
  tripRef: true,
  departureAt: true,
  arrivalAt: true,
  status: true,
  notes: true,
  updatedAt: true,
  operator: { select: { id: true, name: true, code: true } },
  vehicle: { select: { id: true, registrationNumber: true } },
  route: { select: { id: true, code: true, name: true } },
  _count: { select: { passengers: true } },
} satisfies Prisma.TripSelect;

export type TripListRow = Prisma.TripGetPayload<{
  select: typeof tripListSelect;
}>;

export function tripWhere(
  ctx: Pick<TransportContext, "scope">,
  query: ListQuery,
): Prisma.TripWhereInput {
  const conditions: Prisma.TripWhereInput[] = [
    operatorFilter(ctx.scope) as Prisma.TripWhereInput,
    query.status ? { status: query.status } : { status: { not: "ARCHIVED" } },
  ];
  if (query.q) {
    const q = query.q;
    conditions.push({
      OR: [
        { tripRef: { contains: q } },
        { operator: { name: { contains: q } } },
        { route: { name: { contains: q } } },
      ],
    });
  }
  return { AND: conditions };
}

export async function listTrips(
  ctx: TransportContext,
  query: ListQuery,
): Promise<Page<TripListRow>> {
  const where = tripWhere(ctx, query);
  const [total, rows] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      select: tripListSelect,
      orderBy: [{ departureAt: "desc" }],
      skip: skipFor(query.page, query.pageSize),
      take: query.pageSize,
    }),
  ]);
  return buildPage(rows, total, query.page, query.pageSize);
}

export async function getTripOrThrow(
  ctx: TransportContext,
  id: string,
): Promise<TripListRow> {
  const trip = await prisma.trip.findUnique({
    where: { id },
    select: tripListSelect,
  });
  if (!trip || !canAccessOperator(ctx.scope, trip.operator.id)) {
    throw new NotFoundError("Journey not found.");
  }
  return trip;
}

export async function createTrip(
  ctx: TransportContext,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  const data = parseSchema(tripCreateSchema, input);
  await requireOperatorInScope(ctx, data.operatorId);
  await assertVehicleMatchesOperator(data.operatorId, data.vehicleId);
  await assertRouteExists(data.routeId);
  await assertTripRefAvailable(data.tripRef);

  try {
    const created = await prisma.trip.create({
      data,
      select: { id: true },
    });
    await auditChange({
      action: TRIP_AUDIT.CREATED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: created.id,
    });
    return created;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError(
        `Trip reference ${data.tripRef} is already recorded.`,
        "tripRef",
      );
    }
    throw error;
  }
}

export async function updateTrip(
  ctx: TransportContext,
  id: string,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  await getTripOrThrow(ctx, id);
  const data = parseSchema(tripCreateSchema, input);
  await requireOperatorInScope(ctx, data.operatorId);
  await assertVehicleMatchesOperator(data.operatorId, data.vehicleId);
  await assertRouteExists(data.routeId);
  await assertTripRefAvailable(data.tripRef, id);

  try {
    const updated = await prisma.trip.update({
      where: { id },
      data,
      select: { id: true },
    });
    await auditChange({
      action: TRIP_AUDIT.UPDATED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: updated.id,
    });
    return updated;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError(
        `Trip reference ${data.tripRef} is already recorded.`,
        "tripRef",
      );
    }
    throw error;
  }
}

export async function archiveTrip(
  ctx: TransportContext,
  id: string,
): Promise<void> {
  const trip = await getTripOrThrow(ctx, id);
  if (trip.status === "ARCHIVED") return;

  await prisma.trip.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
    select: { id: true },
  });
  await auditChange({
    action: TRIP_AUDIT.ARCHIVED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: id,
  });
}

async function assertTripRefAvailable(
  tripRef: string,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.trip.findFirst({
    where: { tripRef, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(
      `Trip reference ${tripRef} is already recorded.`,
      "tripRef",
    );
  }
}

/** Trips for select inputs (e.g. linking an incident), scoped to the caller. */
export async function tripOptions(
  ctx: TransportContext,
): Promise<Array<{ id: string; tripRef: string }>> {
  return prisma.trip.findMany({
    where: {
      AND: [
        operatorFilter(ctx.scope) as Prisma.TripWhereInput,
        { status: { not: "ARCHIVED" } },
      ],
    },
    select: { id: true, tripRef: true },
    orderBy: { departureAt: "desc" },
    take: 200,
  });
}

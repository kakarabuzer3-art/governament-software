/**
 * Route records — server-side business logic (Phase 3).
 *
 * Routes are network-level records (an origin/destination pair), not owned by
 * a single operator; the operator relationship is expressed through permits.
 * They are therefore NOT operator-scoped. Operators are linked to routes
 * through permits, which ARE scoped.
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
import { actorRoleOf } from "./scope";
import type { TransportContext } from "./context";
import { routeCreateSchema, type ListQuery } from "./validation";

export const ROUTE_AUDIT = {
  CREATED: "route.created",
  UPDATED: "route.updated",
  ARCHIVED: "route.archived",
} as const;

export const routeListSelect = {
  id: true,
  code: true,
  name: true,
  originCity: true,
  destinationCity: true,
  distanceKm: true,
  estimatedMinutes: true,
  status: true,
  notes: true,
  updatedAt: true,
  _count: { select: { permits: true } },
} satisfies Prisma.RouteSelect;

export type RouteListRow = Prisma.RouteGetPayload<{
  select: typeof routeListSelect;
}>;

export function routeWhere(query: ListQuery): Prisma.RouteWhereInput {
  const conditions: Prisma.RouteWhereInput[] = [
    query.status ? { status: query.status } : { status: { not: "ARCHIVED" } },
  ];
  if (query.q) {
    const q = query.q;
    conditions.push({
      OR: [
        { name: { contains: q } },
        { code: { contains: q } },
        { originCity: { contains: q } },
        { destinationCity: { contains: q } },
      ],
    });
  }
  return { AND: conditions };
}

export async function listRoutes(
  _ctx: TransportContext,
  query: ListQuery,
): Promise<Page<RouteListRow>> {
  const where = routeWhere(query);
  const [total, rows] = await Promise.all([
    prisma.route.count({ where }),
    prisma.route.findMany({
      where,
      select: routeListSelect,
      orderBy: [{ code: "asc" }],
      skip: skipFor(query.page, query.pageSize),
      take: query.pageSize,
    }),
  ]);
  return buildPage(rows, total, query.page, query.pageSize);
}

export async function getRouteOrThrow(
  _ctx: TransportContext,
  id: string,
): Promise<RouteListRow> {
  const route = await prisma.route.findUnique({
    where: { id },
    select: routeListSelect,
  });
  if (!route) throw new NotFoundError("Route not found.");
  return route;
}

export async function createRoute(
  ctx: TransportContext,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  const data = parseSchema(routeCreateSchema, input);
  await assertCodeAvailable(data.code);

  try {
    const created = await prisma.route.create({ data, select: { id: true } });
    await auditChange({
      action: ROUTE_AUDIT.CREATED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: created.id,
    });
    return created;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError(
        `Route code ${data.code} is already in use.`,
        "code",
      );
    }
    throw error;
  }
}

export async function updateRoute(
  ctx: TransportContext,
  id: string,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  await getRouteOrThrow(ctx, id);
  const data = parseSchema(routeCreateSchema, input);
  await assertCodeAvailable(data.code, id);

  try {
    const updated = await prisma.route.update({
      where: { id },
      data,
      select: { id: true },
    });
    await auditChange({
      action: ROUTE_AUDIT.UPDATED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: updated.id,
    });
    return updated;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError(
        `Route code ${data.code} is already in use.`,
        "code",
      );
    }
    throw error;
  }
}

export async function archiveRoute(
  ctx: TransportContext,
  id: string,
): Promise<void> {
  const route = await getRouteOrThrow(ctx, id);
  if (route.status === "ARCHIVED") return;

  await prisma.route.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
    select: { id: true },
  });
  await auditChange({
    action: ROUTE_AUDIT.ARCHIVED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: id,
  });
}

async function assertCodeAvailable(
  code: string,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.route.findFirst({
    where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(`Route code ${code} is already in use.`, "code");
  }
}

export async function routeOptions(
  _ctx: TransportContext,
): Promise<Array<{ id: string; code: string; name: string }>> {
  return prisma.route.findMany({
    where: { status: { not: "ARCHIVED" } },
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });
}

/** Verify that a route (when supplied) exists. */
export async function assertRouteExists(
  routeId: string | null | undefined,
): Promise<void> {
  if (!routeId) return;
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    select: { id: true },
  });
  if (!route) throw new NotFoundError("Route not found.");
}

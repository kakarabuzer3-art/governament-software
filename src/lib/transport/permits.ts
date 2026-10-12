/**
 * Permit records — server-side business logic (Phase 3).
 *
 * INTEGRITY RULE enforced here: a permit's vehicle must belong to the SAME
 * operator as the permit. The database alone would allow any vehicle/operator
 * pairing, so the relationship is validated on the server before every write.
 *
 * PROVENANCE: `status` is the status RECORDED in this prototype. It is never
 * presented as an authoritative government verification, and every record
 * carries `recordedSource` describing where the value came from.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError, parseSchema } from "./errors";
import {
  auditChange,
  buildPage,
  conflictFromUnique,
  isUniqueConstraintError,
  skipFor,
  type Page,
} from "./crud";
import { actorRoleOf, canAccessOperator, operatorFilter } from "./scope";
import type { TransportContext } from "./context";
import { requireOperatorInScope } from "./operators";
import { assertVehicleMatchesOperator } from "./vehicles";
import { assertRouteExists } from "./routes";
import { permitCreateSchema, type ListQuery } from "./validation";

export const PERMIT_AUDIT = {
  CREATED: "permit.created",
  UPDATED: "permit.updated",
  ARCHIVED: "permit.archived",
} as const;

export const permitListSelect = {
  id: true,
  permitNumber: true,
  permitType: true,
  issuedOn: true,
  expiresOn: true,
  status: true,
  recordedSource: true,
  notes: true,
  updatedAt: true,
  operator: { select: { id: true, name: true, code: true } },
  vehicle: { select: { id: true, registrationNumber: true } },
  route: { select: { id: true, code: true, name: true } },
} satisfies Prisma.PermitSelect;

export type PermitListRow = Prisma.PermitGetPayload<{
  select: typeof permitListSelect;
}>;

export function permitWhere(
  ctx: Pick<TransportContext, "scope">,
  query: ListQuery,
): Prisma.PermitWhereInput {
  const conditions: Prisma.PermitWhereInput[] = [
    operatorFilter(ctx.scope) as Prisma.PermitWhereInput,
    query.status ? { status: query.status } : { status: { not: "ARCHIVED" } },
  ];
  if (query.q) {
    const q = query.q;
    conditions.push({
      OR: [
        { permitNumber: { contains: q } },
        { operator: { name: { contains: q } } },
        { vehicle: { registrationNumber: { contains: q } } },
      ],
    });
  }
  return { AND: conditions };
}

export async function listPermits(
  ctx: TransportContext,
  query: ListQuery,
): Promise<Page<PermitListRow>> {
  const where = permitWhere(ctx, query);
  const [total, rows] = await Promise.all([
    prisma.permit.count({ where }),
    prisma.permit.findMany({
      where,
      select: permitListSelect,
      orderBy: [{ createdAt: "desc" }],
      skip: skipFor(query.page, query.pageSize),
      take: query.pageSize,
    }),
  ]);
  return buildPage(rows, total, query.page, query.pageSize);
}

export async function getPermitOrThrow(
  ctx: TransportContext,
  id: string,
): Promise<PermitListRow> {
  const permit = await prisma.permit.findUnique({
    where: { id },
    select: permitListSelect,
  });
  if (!permit || !canAccessOperator(ctx.scope, permit.operator.id)) {
    throw new NotFoundError("Permit not found.");
  }
  return permit;
}

/**
 * Verify that the vehicle (when supplied) exists and belongs to the permit's
 * operator. Implemented in vehicles.ts and re-exported here so callers of the
 * permit service keep a single import point.
 */
export { assertVehicleMatchesOperator };

export async function createPermit(
  ctx: TransportContext,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  const data = parseSchema(permitCreateSchema, input);
  await requireOperatorInScope(ctx, data.operatorId);
  await assertVehicleMatchesOperator(data.operatorId, data.vehicleId);
  await assertRouteExists(data.routeId);
  await assertPermitNumberAvailable(data.permitNumber);

  try {
    const created = await prisma.permit.create({ data, select: { id: true } });
    await auditChange({
      action: PERMIT_AUDIT.CREATED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: created.id,
    });
    return created;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictFromUnique(error, "That permit is already recorded.", {
        permitNumber: `Permit number ${data.permitNumber} is already recorded.`,
      });
    }
    throw error;
  }
}

export async function updatePermit(
  ctx: TransportContext,
  id: string,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  await getPermitOrThrow(ctx, id);
  const data = parseSchema(permitCreateSchema, input);
  await requireOperatorInScope(ctx, data.operatorId);
  await assertVehicleMatchesOperator(data.operatorId, data.vehicleId);
  await assertRouteExists(data.routeId);
  await assertPermitNumberAvailable(data.permitNumber, id);

  try {
    const updated = await prisma.permit.update({
      where: { id },
      data,
      select: { id: true },
    });
    await auditChange({
      action: PERMIT_AUDIT.UPDATED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: updated.id,
    });
    return updated;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictFromUnique(error, "That permit is already recorded.", {
        permitNumber: `Permit number ${data.permitNumber} is already recorded.`,
      });
    }
    throw error;
  }
}

export async function archivePermit(
  ctx: TransportContext,
  id: string,
): Promise<void> {
  const permit = await getPermitOrThrow(ctx, id);
  if (permit.status === "ARCHIVED") return;

  await prisma.permit.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
    select: { id: true },
  });
  await auditChange({
    action: PERMIT_AUDIT.ARCHIVED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: id,
  });
}

async function assertPermitNumberAvailable(
  permitNumber: string,
  excludeId?: string,
): Promise<void> {
  const existing = await prisma.permit.findFirst({
    where: {
      permitNumber,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(
      `Permit number ${permitNumber} is already recorded.`,
      "permitNumber",
    );
  }
}

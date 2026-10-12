/**
 * CCTV inspection records — server-side business logic (Phase 5).
 *
 * HONESTY RULE: this module records what an inspector observed. It never
 * asserts that a camera is operational without a recorded inspection, and
 * `camerasOperational` may never exceed `cameraCount` (enforced by validation).
 *
 * Inspections may be linked to an operator. When they are, the same operator
 * isolation rule applies. Department-wide inspections (no operator) are only
 * visible to department-wide roles.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, parseSchema } from "./errors";
import { auditChange, buildPage, skipFor, type Page } from "./crud";
import { actorRoleOf, canAccessOperator, operatorFilter } from "./scope";
import type { TransportContext } from "./context";
import { requireOperatorInScope } from "./operators";
import { inspectionCreateSchema, type ListQuery } from "./validation";

export const INSPECTION_AUDIT = {
  CREATED: "inspection.created",
  UPDATED: "inspection.updated",
  ARCHIVED: "inspection.archived",
} as const;

export const inspectionListSelect = {
  id: true,
  siteName: true,
  city: true,
  cameraCount: true,
  camerasOperational: true,
  inspectionDate: true,
  result: true,
  findings: true,
  responsibleParty: true,
  followUpAction: true,
  nextDueOn: true,
  updatedAt: true,
  operator: { select: { id: true, name: true, code: true } },
} satisfies Prisma.InspectionSelect;

export type InspectionListRow = Prisma.InspectionGetPayload<{
  select: typeof inspectionListSelect;
}>;

export function inspectionWhere(
  ctx: Pick<TransportContext, "scope">,
  query: ListQuery,
): Prisma.InspectionWhereInput {
  const conditions: Prisma.InspectionWhereInput[] = [
    operatorFilter(ctx.scope) as Prisma.InspectionWhereInput,
    query.status ? { result: query.status } : {},
  ].filter((clause) => Object.keys(clause).length > 0);
  if (query.q) {
    const q = query.q;
    conditions.push({
      OR: [
        { siteName: { contains: q } },
        { city: { contains: q } },
        { responsibleParty: { contains: q } },
      ],
    });
  }
  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function listInspections(
  ctx: TransportContext,
  query: ListQuery,
): Promise<Page<InspectionListRow>> {
  const where = inspectionWhere(ctx, query);
  const [total, rows] = await Promise.all([
    prisma.inspection.count({ where }),
    prisma.inspection.findMany({
      where,
      select: inspectionListSelect,
      orderBy: [{ inspectionDate: "desc" }, { createdAt: "desc" }],
      skip: skipFor(query.page, query.pageSize),
      take: query.pageSize,
    }),
  ]);
  return buildPage(rows, total, query.page, query.pageSize);
}

export async function getInspectionOrThrow(
  ctx: TransportContext,
  id: string,
): Promise<InspectionListRow> {
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    select: inspectionListSelect,
  });
  if (!inspection) throw new NotFoundError("Inspection not found.");

  const operatorId = inspection.operator?.id;
  // Department-wide records (no operator) are visible to unrestricted scopes;
  // operator-linked records additionally require scope access to that operator.
  if (operatorId && !canAccessOperator(ctx.scope, operatorId)) {
    throw new NotFoundError("Inspection not found.");
  }
  if (!operatorId && !ctx.scope.unrestricted) {
    throw new NotFoundError("Inspection not found.");
  }
  return inspection;
}

export async function createInspection(
  ctx: TransportContext,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  const data = parseSchema(inspectionCreateSchema, input);
  if (data.operatorId) {
    await requireOperatorInScope(ctx, data.operatorId);
  } else if (!ctx.scope.unrestricted) {
    // Scoped staff must always attach their inspection to their operator.
    throw new NotFoundError("Operator not found.");
  }

  const created = await prisma.inspection.create({
    data: { ...data, operatorId: data.operatorId ?? null },
    select: { id: true },
  });
  await auditChange({
    action: INSPECTION_AUDIT.CREATED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: created.id,
  });
  return created;
}

export async function updateInspection(
  ctx: TransportContext,
  id: string,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  await getInspectionOrThrow(ctx, id);
  const data = parseSchema(inspectionCreateSchema, input);
  if (data.operatorId) {
    await requireOperatorInScope(ctx, data.operatorId);
  } else if (!ctx.scope.unrestricted) {
    throw new NotFoundError("Operator not found.");
  }

  const updated = await prisma.inspection.update({
    where: { id },
    data: { ...data, operatorId: data.operatorId ?? null },
    select: { id: true },
  });
  await auditChange({
    action: INSPECTION_AUDIT.UPDATED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: updated.id,
  });
  return updated;
}

export async function archiveInspection(
  ctx: TransportContext,
  id: string,
): Promise<void> {
  await getInspectionOrThrow(ctx, id);
  await prisma.inspection.update({
    where: { id },
    data: { archivedAt: new Date() },
    select: { id: true },
  });
  await auditChange({
    action: INSPECTION_AUDIT.ARCHIVED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: id,
  });
}

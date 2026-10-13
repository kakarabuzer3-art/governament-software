/**
 * Incident records — server-side business logic (Phase 5).
 *
 * SAFETY RULES:
 *  - An incident records FACTUAL observations and an authorised human review
 *    status. Nothing here makes an automated judgement about a person, and the
 *    system never labels anyone as suspicious.
 *  - `reviewNotes` are the free-text record of a human review decision.
 *  - There is no integration with police, immigration or any external
 *    authority, and none is implied.
 *  - Operator isolation applies exactly as elsewhere.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError, parseSchema } from "./errors";
import { auditChange, buildPage, isUniqueConstraintError, skipFor, type Page } from "./crud";
import { actorRoleOf, canAccessOperator, operatorFilter } from "./scope";
import type { TransportContext } from "./context";
import { requireOperatorInScope } from "./operators";
import { incidentCreateSchema, type ListQuery } from "./validation";

export const INCIDENT_AUDIT = {
  CREATED: "incident.created",
  UPDATED: "incident.updated",
  ARCHIVED: "incident.archived",
} as const;

export const incidentListSelect = {
  id: true,
  reference: true,
  occurredOn: true,
  location: true,
  category: true,
  severity: true,
  description: true,
  status: true,
  reportedBy: true,
  reviewNotes: true,
  updatedAt: true,
  operator: { select: { id: true, name: true, code: true } },
  trip: { select: { id: true, tripRef: true } },
} satisfies Prisma.IncidentSelect;

export type IncidentListRow = Prisma.IncidentGetPayload<{
  select: typeof incidentListSelect;
}>;

export function incidentWhere(
  ctx: Pick<TransportContext, "scope">,
  query: ListQuery,
): Prisma.IncidentWhereInput {
  const conditions: Prisma.IncidentWhereInput[] = [
    operatorFilter(ctx.scope) as Prisma.IncidentWhereInput,
    query.status ? { status: query.status } : { status: { not: "ARCHIVED" } },
  ];
  if (query.q) {
    const q = query.q;
    conditions.push({
      OR: [
        { reference: { contains: q } },
        { location: { contains: q } },
        { category: { contains: q } },
      ],
    });
  }
  return { AND: conditions };
}

export async function listIncidents(
  ctx: TransportContext,
  query: ListQuery,
): Promise<Page<IncidentListRow>> {
  const where = incidentWhere(ctx, query);
  const [total, rows] = await Promise.all([
    prisma.incident.count({ where }),
    prisma.incident.findMany({
      where,
      select: incidentListSelect,
      orderBy: [{ occurredOn: "desc" }],
      skip: skipFor(query.page, query.pageSize),
      take: query.pageSize,
    }),
  ]);
  return buildPage(rows, total, query.page, query.pageSize);
}

export async function getIncidentOrThrow(
  ctx: TransportContext,
  id: string,
): Promise<IncidentListRow> {
  const incident = await prisma.incident.findUnique({
    where: { id },
    select: incidentListSelect,
  });
  if (!incident) throw new NotFoundError("Incident not found.");

  const operatorId = incident.operator?.id;
  if (operatorId && !canAccessOperator(ctx.scope, operatorId)) {
    throw new NotFoundError("Incident not found.");
  }
  if (!operatorId && !ctx.scope.unrestricted) {
    throw new NotFoundError("Incident not found.");
  }
  return incident;
}

/** Verify an optional trip reference exists and matches the operator. */
async function assertTripMatchesOperator(
  operatorId: string | null | undefined,
  tripId: string | null | undefined,
): Promise<void> {
  if (!tripId) return;
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, operatorId: true },
  });
  if (!trip) throw new NotFoundError("Journey not found.");
  if (operatorId && trip.operatorId !== operatorId) {
    throw new ConflictError(
      "The selected journey belongs to a different operator.",
      "tripId",
    );
  }
}

export async function createIncident(
  ctx: TransportContext,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  const data = parseSchema(incidentCreateSchema, input);
  if (data.operatorId) {
    await requireOperatorInScope(ctx, data.operatorId);
  } else if (!ctx.scope.unrestricted) {
    throw new NotFoundError("Operator not found.");
  }
  await assertTripMatchesOperator(data.operatorId, data.tripId);

  try {
    const created = await prisma.incident.create({
      data: { ...data, operatorId: data.operatorId ?? null },
      select: { id: true },
    });
    await auditChange({
      action: INCIDENT_AUDIT.CREATED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: created.id,
    });
    return created;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError(
        `Incident reference ${data.reference} is already recorded.`,
        "reference",
      );
    }
    throw error;
  }
}

export async function updateIncident(
  ctx: TransportContext,
  id: string,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  await getIncidentOrThrow(ctx, id);
  const data = parseSchema(incidentCreateSchema, input);
  if (data.operatorId) {
    await requireOperatorInScope(ctx, data.operatorId);
  } else if (!ctx.scope.unrestricted) {
    throw new NotFoundError("Operator not found.");
  }
  await assertTripMatchesOperator(data.operatorId, data.tripId);

  try {
    const updated = await prisma.incident.update({
      where: { id },
      data: { ...data, operatorId: data.operatorId ?? null },
      select: { id: true },
    });
    await auditChange({
      action: INCIDENT_AUDIT.UPDATED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: updated.id,
    });
    return updated;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ConflictError(
        `Incident reference ${data.reference} is already recorded.`,
        "reference",
      );
    }
    throw error;
  }
}

export async function archiveIncident(
  ctx: TransportContext,
  id: string,
): Promise<void> {
  const incident = await getIncidentOrThrow(ctx, id);
  if (incident.status === "ARCHIVED") return;

  await prisma.incident.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
    select: { id: true },
  });
  await auditChange({
    action: INCIDENT_AUDIT.ARCHIVED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: id,
  });
}

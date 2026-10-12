/**
 * Operator records — server-side business logic (Phase 3).
 *
 * Authorization is enforced by the caller (`requireTransportContext`); the
 * operator scope is enforced HERE against trusted database state. Records are
 * archived, never hard-deleted, so history is preserved.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  NotFoundError,
  parseSchema,
} from "./errors";
import { auditChange, buildPage, conflictFromUnique, isUniqueConstraintError, skipFor, type Page } from "./crud";
import { actorRoleOf, canAccessOperator, operatorIdFilter } from "./scope";
import type { TransportContext } from "./context";
import { operatorCreateSchema, type ListQuery } from "./validation";

export const OPERATOR_AUDIT = {
  CREATED: "operator.created",
  UPDATED: "operator.updated",
  ARCHIVED: "operator.archived",
} as const;

export const operatorListSelect = {
  id: true,
  code: true,
  name: true,
  legalName: true,
  registrationNumber: true,
  city: true,
  addressLine: true,
  status: true,
  contactEmail: true,
  contactPhone: true,
  notes: true,
  updatedAt: true,
  _count: { select: { vehicles: true, permits: true } },
} satisfies Prisma.OperatorSelect;

export type OperatorListRow = Prisma.OperatorGetPayload<{
  select: typeof operatorListSelect;
}>;

/** The `where` clause for a scoped, filtered operator list. */
export function operatorWhere(
  ctx: Pick<TransportContext, "scope">,
  query: ListQuery,
): Prisma.OperatorWhereInput {
  const conditions: Prisma.OperatorWhereInput[] = [
    operatorIdFilter(ctx.scope) as Prisma.OperatorWhereInput,
  ];
  conditions.push(
    query.status
      ? { status: query.status }
      : // Archived records are hidden unless explicitly asked for.
        { status: { not: "ARCHIVED" } },
  );
  if (query.q) {
    const q = query.q;
    conditions.push({
      OR: [
        { name: { contains: q } },
        { code: { contains: q } },
        { city: { contains: q } },
        { registrationNumber: { contains: q } },
      ],
    });
  }
  return { AND: conditions };
}

export async function listOperators(
  ctx: TransportContext,
  query: ListQuery,
): Promise<Page<OperatorListRow>> {
  const where = operatorWhere(ctx, query);
  const [total, rows] = await Promise.all([
    prisma.operator.count({ where }),
    prisma.operator.findMany({
      where,
      select: operatorListSelect,
      orderBy: [{ name: "asc" }],
      skip: skipFor(query.page, query.pageSize),
      take: query.pageSize,
    }),
  ]);
  return buildPage(rows, total, query.page, query.pageSize);
}

/** Load one operator the caller is allowed to see, or throw NotFound. */
export async function getOperatorOrThrow(
  ctx: TransportContext,
  id: string,
): Promise<OperatorListRow> {
  const operator = await prisma.operator.findUnique({
    where: { id },
    select: operatorListSelect,
  });
  // A record outside the caller's scope is reported as "not found" so the API
  // never confirms the existence of another operator's data.
  if (!operator || !canAccessOperator(ctx.scope, operator.id)) {
    throw new NotFoundError("Operator not found.");
  }
  return operator;
}

/** Assert an operator id exists AND is inside the caller's scope. */
export async function requireOperatorInScope(
  ctx: TransportContext,
  operatorId: string,
): Promise<{ id: string }> {
  if (!canAccessOperator(ctx.scope, operatorId)) {
    throw new NotFoundError("Operator not found.");
  }
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { id: true },
  });
  if (!operator) throw new NotFoundError("Operator not found.");
  return operator;
}

export async function createOperator(
  ctx: TransportContext,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  const data = parseSchema(operatorCreateSchema, input);

  const existing = await prisma.operator.findFirst({
    where: {
      OR: [
        { code: data.code },
        ...(data.registrationNumber
          ? [{ registrationNumber: data.registrationNumber }]
          : []),
      ],
    },
    select: { code: true, registrationNumber: true },
  });
  if (existing) {
    if (existing.code === data.code) {
      throw new ConflictError(
        `Operator code ${data.code} is already in use.`,
        "code",
      );
    }
    throw new ConflictError(
      "That registration number is already recorded.",
      "registrationNumber",
    );
  }

  try {
    const created = await prisma.operator.create({
      data,
      select: { id: true },
    });
    await auditChange({
      action: OPERATOR_AUDIT.CREATED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: created.id,
    });
    return created;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictFromUnique(error, "That operator already exists.", {
        code: `Operator code ${data.code} is already in use.`,
        registrationNumber: "That registration number is already recorded.",
      });
    }
    throw error;
  }
}

export async function updateOperator(
  ctx: TransportContext,
  id: string,
  input: Record<string, unknown>,
): Promise<{ id: string }> {
  await getOperatorOrThrow(ctx, id);
  const data = parseSchema(operatorCreateSchema, input);

  const clash = await prisma.operator.findFirst({
    where: {
      id: { not: id },
      OR: [
        { code: data.code },
        ...(data.registrationNumber
          ? [{ registrationNumber: data.registrationNumber }]
          : []),
      ],
    },
    select: { code: true },
  });
  if (clash) {
    throw new ConflictError(
      clash.code === data.code
        ? `Operator code ${data.code} is already in use.`
        : "That registration number is already recorded.",
      clash.code === data.code ? "code" : "registrationNumber",
    );
  }

  try {
    const updated = await prisma.operator.update({
      where: { id },
      data,
      select: { id: true },
    });
    await auditChange({
      action: OPERATOR_AUDIT.UPDATED,
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: updated.id,
    });
    return updated;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflictFromUnique(error, "That operator already exists.", {
        code: `Operator code ${data.code} is already in use.`,
        registrationNumber: "That registration number is already recorded.",
      });
    }
    throw error;
  }
}

/** Archive (soft-deactivate) an operator. Never deletes. */
export async function archiveOperator(
  ctx: TransportContext,
  id: string,
): Promise<void> {
  const operator = await getOperatorOrThrow(ctx, id);
  if (operator.status === "ARCHIVED") return;

  await prisma.operator.update({
    where: { id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
    select: { id: true },
  });
  await auditChange({
    action: OPERATOR_AUDIT.ARCHIVED,
    actorId: ctx.user.id,
    actorRole: actorRoleOf(ctx.user),
    targetId: id,
  });
}

/** Active operators for select inputs, restricted to the caller's scope. */
export async function operatorOptions(
  ctx: TransportContext,
): Promise<Array<{ id: string; name: string; code: string }>> {
  return prisma.operator.findMany({
    where: {
      AND: [
        operatorIdFilter(ctx.scope) as Prisma.OperatorWhereInput,
        { status: { not: "ARCHIVED" } },
      ],
    },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
}

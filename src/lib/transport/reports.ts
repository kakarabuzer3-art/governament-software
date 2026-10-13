/**
 * Oversight reporting and audit-trail queries (Phase 6).
 *
 * All reads are scope-filtered and permission-gated by the caller. Exports are
 * deliberately routed through a separate, permission-checked handler that
 * writes an audit event, so "who exported what" is answerable.
 *
 * The audit trail is presented honestly: it is an append-only-by-convention
 * table with no tamper-proofing engineered yet. Nothing in the UI claims it is
 * immutable.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { operatorIdFilter, type OperatorScope } from "./scope";
import { buildPage, skipFor, type Page } from "./crud";

export interface OperatorReportRow {
  operatorId: string;
  operatorCode: string;
  operatorName: string;
  vehicles: number;
  activePermits: number;
  pendingPermits: number;
  tripsInRange: number;
  incidentsInRange: number;
  inspectionsInRange: number;
}

export interface ReportRange {
  from?: Date;
  to?: Date;
}

/**
 * Parse `from`/`to` date parameters (YYYY-MM-DD). `to` is treated as the END
 * of that day, so a single-day report still includes that day's records.
 * Invalid or absent values are ignored rather than throwing.
 */
export function parseReportRange(params: {
  from?: string | string[];
  to?: string | string[];
}): ReportRange {
  const pick = (value?: string | string[]): string | undefined => {
    const raw = Array.isArray(value) ? value[0] : value;
    return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())
      ? raw.trim()
      : undefined;
  };

  const range: ReportRange = {};
  const from = pick(params.from);
  const to = pick(params.to);
  if (from) {
    const parsed = new Date(`${from}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) range.from = parsed;
  }
  if (to) {
    const parsed = new Date(`${to}T23:59:59.999Z`);
    if (!Number.isNaN(parsed.getTime())) range.to = parsed;
  }
  return range;
}

function dateWindow(
  field: string,
  range: ReportRange,
): Record<string, { gte?: Date; lte?: Date }> {
  const window: { gte?: Date; lte?: Date } = {};
  if (range.from) window.gte = range.from;
  if (range.to) window.lte = range.to;
  return Object.keys(window).length > 0 ? { [field]: window } : {};
}

/**
 * Operator-wise summary for the requested date window.
 *
 * Uses grouped aggregate queries rather than one query per operator, so the
 * report stays fast as records grow. Operators are still limited to the
 * caller's scope.
 */
export async function getOperatorReport(
  scope: OperatorScope,
  range: ReportRange = {},
): Promise<OperatorReportRow[]> {
  const operators = await prisma.operator.findMany({
    where: {
      AND: [operatorIdFilter(scope) as Prisma.OperatorWhereInput],
    },
    select: {
      id: true,
      code: true,
      name: true,
      _count: { select: { vehicles: true, permits: true } },
    },
    orderBy: { name: "asc" },
  });
  if (operators.length === 0) return [];

  const ids = operators.map((operator) => operator.id);

  const [activePermits, pendingPermits, trips, incidents, inspections] =
    await Promise.all([
      prisma.permit.groupBy({
        by: ["operatorId"],
        where: { operatorId: { in: ids }, status: "ACTIVE" },
        _count: { _all: true },
      }),
      prisma.permit.groupBy({
        by: ["operatorId"],
        where: { operatorId: { in: ids }, status: "PENDING" },
        _count: { _all: true },
      }),
      prisma.trip.groupBy({
        by: ["operatorId"],
        where: { operatorId: { in: ids }, ...dateWindow("departureAt", range) },
        _count: { _all: true },
      }),
      prisma.incident.groupBy({
        by: ["operatorId"],
        where: {
          operatorId: { in: ids },
          ...dateWindow("occurredOn", range),
        },
        _count: { _all: true },
      }),
      prisma.inspection.groupBy({
        by: ["operatorId"],
        where: {
          operatorId: { in: ids },
          ...dateWindow("inspectionDate", range),
        },
        _count: { _all: true },
      }),
    ]);

  const countMap = (
    rows: Array<{ operatorId: string | null; _count: { _all: number } }>,
  ): Map<string, number> =>
    new Map(
      rows
        .filter((row) => row.operatorId !== null)
        .map((row) => [row.operatorId as string, row._count._all]),
    );

  const activeMap = countMap(activePermits);
  const pendingMap = countMap(pendingPermits);
  const tripMap = countMap(trips);
  const incidentMap = countMap(
    incidents as Array<{ operatorId: string | null; _count: { _all: number } }>,
  );
  const inspectionMap = countMap(
    inspections as Array<{ operatorId: string | null; _count: { _all: number } }>,
  );

  return operators.map((operator) => ({
    operatorId: operator.id,
    operatorCode: operator.code,
    operatorName: operator.name,
    vehicles: operator._count.vehicles,
    activePermits: activeMap.get(operator.id) ?? 0,
    pendingPermits: pendingMap.get(operator.id) ?? 0,
    tripsInRange: tripMap.get(operator.id) ?? 0,
    incidentsInRange: incidentMap.get(operator.id) ?? 0,
    inspectionsInRange: inspectionMap.get(operator.id) ?? 0,
  }));
}

export const auditEventSelect = {
  id: true,
  action: true,
  outcome: true,
  actorId: true,
  actorRole: true,
  targetId: true,
  createdAt: true,
  userAgent: true,
  ipHash: true,
} satisfies Prisma.AuditEventSelect;

export type AuditEventRow = Prisma.AuditEventGetPayload<{
  select: typeof auditEventSelect;
}>;

export interface AuditQuery {
  page: number;
  pageSize: number;
  action?: string;
  outcome?: string;
}

/** Paginated audit trail. Requires AUDIT_VIEW at the call site. */
export async function listAuditEvents(
  query: AuditQuery,
): Promise<Page<AuditEventRow>> {
  const conditions: Prisma.AuditEventWhereInput[] = [];
  if (query.action) conditions.push({ action: { contains: query.action } });
  if (query.outcome) conditions.push({ outcome: query.outcome });
  const where: Prisma.AuditEventWhereInput =
    conditions.length > 0 ? { AND: conditions } : {};

  const [total, rows] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      select: auditEventSelect,
      orderBy: { createdAt: "desc" },
      skip: skipFor(query.page, query.pageSize),
      take: query.pageSize,
    }),
  ]);
  return buildPage(rows, total, query.page, query.pageSize);
}

/** Distinct action keys present in the trail, for the filter control. */
export async function listAuditActions(): Promise<string[]> {
  const rows = await prisma.auditEvent.findMany({
    select: { action: true },
    distinct: ["action"],
    orderBy: { action: "asc" },
    take: 200,
  });
  return rows.map((row) => row.action);
}

/** Escape a CSV cell (quotes, commas, newlines). */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Build a CSV document from a header row and data rows. */
export function toCsv(
  headers: string[],
  rows: Array<Array<unknown>>,
): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // Trailing newline keeps POSIX tools happy; CRLF for Excel on Windows.
  return `${lines.join("\r\n")}\r\n`;
}

export const REPORT_AUDIT = {
  EXPORTED: "report.exported",
  VIEWED: "report.viewed",
} as const;

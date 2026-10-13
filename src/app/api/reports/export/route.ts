/**
 * Authorised CSV export of the operator-wise report.
 *
 * This is a ROUTE HANDLER, not a page, so it is reachable by direct HTTP
 * request. Server-side authorization is therefore enforced here explicitly:
 * the caller must hold `report.export`, and the query is scoped to the
 * operators their account is allowed to see. Every export writes an audit
 * event so "who exported what, and when" is answerable.
 */
import { NextResponse, type NextRequest } from "next/server";
import { recordAuditEvent } from "@/lib/audit";
import { ForbiddenError, UnauthorizedError } from "@/lib/authz-errors";
import { PERMISSIONS } from "@/lib/rbac";
import { requireTransportContext } from "@/lib/transport/context";
import {
  getOperatorReport,
  parseReportRange,
  REPORT_AUDIT,
  toCsv,
} from "@/lib/transport/reports";
import { actorRoleOf } from "@/lib/transport/scope";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const ctx = await requireTransportContext(PERMISSIONS.REPORT_EXPORT);

    const { searchParams } = new URL(request.url);
    const range = parseReportRange({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });

    const rows = await getOperatorReport(ctx.scope, range);

    const csv = toCsv(
      [
        "operator_code",
        "operator_name",
        "vehicles",
        "active_permits",
        "pending_permits",
        "journeys",
        "incidents",
        "inspections",
      ],
      rows.map((row) => [
        row.operatorCode,
        row.operatorName,
        row.vehicles,
        row.activePermits,
        row.pendingPermits,
        row.tripsInRange,
        row.incidentsInRange,
        row.inspectionsInRange,
      ]),
    );

    // Audit the export itself. Contains no report data.
    await recordAuditEvent({
      action: REPORT_AUDIT.EXPORTED,
      outcome: "success",
      actorId: ctx.user.id,
      actorRole: actorRoleOf(ctx.user),
      targetId: null,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="operator-report-${stamp}.csv"`,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
    // Never leak internal error details (or any row data) to the client.
    console.error("[reports] export failed");
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

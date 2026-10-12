import type { Metadata } from "next";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/icons";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";
import {
  getOperatorReport,
  parseReportRange,
  type OperatorReportRow,
} from "@/lib/transport/reports";
import { resolveOperatorScope } from "@/lib/transport/scope";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

function toDateInput(value: Date | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

const columns: ReadonlyArray<Column<OperatorReportRow>> = [
  {
    key: "operatorCode",
    header: "Code",
    cell: (row) => <span className="cell-strong cell-mono">{row.operatorCode}</span>,
  },
  { key: "operatorName", header: "Operator", cell: (row) => row.operatorName },
  { key: "vehicles", header: "Vehicles", cell: (row) => row.vehicles },
  {
    key: "activePermits",
    header: "Active permits",
    cell: (row) => row.activePermits,
  },
  {
    key: "pendingPermits",
    header: "Pending permits",
    cell: (row) => row.pendingPermits,
  },
  { key: "tripsInRange", header: "Journeys", cell: (row) => row.tripsInRange },
  {
    key: "incidentsInRange",
    header: "Incidents",
    cell: (row) => row.incidentsInRange,
  },
  {
    key: "inspectionsInRange",
    header: "Inspections",
    cell: (row) => row.inspectionsInRange,
  },
];

/**
 * Operator-wise report (Phase 6).
 *
 * The date window is applied to journeys, incidents and inspections; vehicle
 * and permit figures are current-state counts. All queries are executed on the
 * server against MariaDB and are limited to the caller's operator scope.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PERMISSIONS.REPORT_VIEW);
  const params = await searchParams;
  const range = parseReportRange(params);
  const scope = resolveOperatorScope(user);

  const rows = await getOperatorReport(scope, range);
  const canExport = user.permissions.has(PERMISSIONS.REPORT_EXPORT);

  const exportQuery = new URLSearchParams();
  if (range.from) exportQuery.set("from", toDateInput(range.from));
  if (range.to) exportQuery.set("to", toDateInput(range.to));
  const exportHref = `/api/reports/export${
    exportQuery.toString() ? `?${exportQuery}` : ""
  }`;

  const totals = rows.reduce(
    (acc, row) => ({
      vehicles: acc.vehicles + row.vehicles,
      activePermits: acc.activePermits + row.activePermits,
      pendingPermits: acc.pendingPermits + row.pendingPermits,
      tripsInRange: acc.tripsInRange + row.tripsInRange,
      incidentsInRange: acc.incidentsInRange + row.incidentsInRange,
      inspectionsInRange: acc.inspectionsInRange + row.inspectionsInRange,
    }),
    {
      vehicles: 0,
      activePermits: 0,
      pendingPermits: 0,
      tripsInRange: 0,
      incidentsInRange: 0,
      inspectionsInRange: 0,
    },
  );

  return (
    <>
      <header className="page-header">
        <div>
          <h2 className="page-title">Reports</h2>
          <p className="page-description">
            Operator-wise counts from the development database. These are
            administrative counts of recorded data — not compliance
            determinations.
          </p>
        </div>
        <div className="page-header-actions">
          {canExport ? (
            <a className="btn btn--sm" href={exportHref} download>
              Export CSV
            </a>
          ) : (
            <span className="chip">Export requires authorisation</span>
          )}
        </div>
      </header>

      <p className="notice page-notice" role="note">
        <Icon name="info" size={16} />
        <span>
          Date filters apply to journeys (departure), incidents (occurrence) and
          inspections (inspection date). Vehicle and permit counts are
          current-state totals.
          {canExport
            ? " Every export is recorded in the audit trail."
            : " Your account cannot export reports; every export is restricted and audited."}
        </span>
      </p>

      <form className="filter-bar glass filter-form" method="get" action="/reports">
        <div className="field">
          <label className="field-label" htmlFor="from">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            className="input"
            defaultValue={toDateInput(range.from)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="to">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            className="input"
            defaultValue={toDateInput(range.to)}
          />
        </div>
        <button type="submit" className="btn">
          Apply
        </button>
        <a className="btn btn--ghost" href="/reports">
          Clear
        </a>
      </form>

      <section className="panel glass" aria-label="Operator-wise report">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Operator-wise summary</h3>
            <p className="panel-subtitle">
              {rows.length} operator(s) in scope
            </p>
          </div>
        </div>
        <DataTable
          caption="Operator-wise report"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.operatorId}
          emptyMessage="No operators are in scope for your account, so there is nothing to report."
        />
        {rows.length > 0 ? (
          <p className="pagination-summary">
            Totals: {totals.vehicles} vehicles · {totals.activePermits} active
            permits · {totals.pendingPermits} pending permits ·{" "}
            {totals.tripsInRange} journeys · {totals.incidentsInRange} incidents
            · {totals.inspectionsInRange} inspections
          </p>
        ) : null}
      </section>
    </>
  );
}

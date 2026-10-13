import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { Icon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/transport/StatusBadge";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS, PERMISSION_DASHBOARD_VIEW } from "@/lib/rbac";
import {
  getDashboardSummary,
  getRecentTrips,
  type DashboardTripRow,
} from "@/lib/transport/dashboard";
import { resolveOperatorScope } from "@/lib/transport/scope";
import type { StatCardData } from "@/types";

export const metadata: Metadata = { title: "Dashboard" };
// Authenticated page: reads the session and the database per request.
export const dynamic = "force-dynamic";

/**
 * Operations dashboard (Phase 6).
 *
 * Every figure is a live COUNT from the development MariaDB database, filtered
 * by the signed-in user's operator scope. Numbers that used to be invented for
 * layout demonstration have been removed: showing fabricated statistics in a
 * government workflow prototype is not acceptable, even when labelled.
 */
export default async function DashboardPage() {
  const user = await requirePermission(PERMISSION_DASHBOARD_VIEW);
  const scope = resolveOperatorScope(user);

  const [summary, recentTrips] = await Promise.all([
    getDashboardSummary(scope),
    getRecentTrips(scope),
  ]);

  const canViewManifest = user.permissions.has(PERMISSIONS.MANIFEST_VIEW);
  const canViewAudit = user.permissions.has(PERMISSIONS.AUDIT_VIEW);
  const canViewReports = user.permissions.has(PERMISSIONS.REPORT_VIEW);

  const stats: StatCardData[] = [
    {
      id: "operators",
      label: "Operators",
      value: String(summary.operators),
      hint: "Active operator records",
      icon: "users",
      tone: "info",
    },
    {
      id: "vehicles",
      label: "Vehicles",
      value: String(summary.vehicles),
      hint: "Active vehicle records",
      icon: "bus",
      tone: "info",
    },
    {
      id: "permits",
      label: "Active permits",
      value: String(summary.activePermits),
      hint: `${summary.permitsPending} awaiting status · ${summary.permitsExpiringSoon} expiring ≤30 days`,
      icon: "clipboardCheck",
      tone: summary.permitsExpiringSoon > 0 ? "warning" : "success",
    },
    {
      id: "trips",
      label: "Journeys",
      value: String(summary.tripsRecorded),
      hint: `${summary.upcomingTrips} scheduled from now`,
      icon: "calendar",
      tone: "neutral",
    },
    {
      id: "manifest",
      label: "Manifest entries",
      value: canViewManifest ? String(summary.manifestEntries) : "Restricted",
      hint: canViewManifest
        ? "Active passenger entries (aggregate only)"
        : "Requires the manifest permission",
      icon: "users",
      tone: canViewManifest ? "neutral" : "warning",
    },
    {
      id: "incidents",
      label: "Open incidents",
      value: String(summary.openIncidents),
      hint: "Reported or under review",
      icon: "alertTriangle",
      tone: summary.openIncidents > 0 ? "danger" : "success",
    },
  ];

  const tripColumns: ReadonlyArray<Column<DashboardTripRow>> = [
    {
      key: "tripRef",
      header: "Reference",
      cell: (row) => (
        <Link className="cell-strong cell-mono" href={`/trips/${row.id}`}>
          {row.tripRef}
        </Link>
      ),
    },
    { key: "operator", header: "Operator", cell: (row) => row.operatorName },
    {
      key: "route",
      header: "Route",
      cell: (row) => row.routeLabel ?? "—",
    },
    {
      key: "departure",
      header: "Departure",
      cell: (row) => (
        <span className="cell-mono">
          {row.departureAt.toISOString().slice(0, 16).replace("T", " ")}
        </span>
      ),
    },
    {
      key: "manifest",
      header: "Manifest",
      cell: (row) =>
        canViewManifest ? (
          `${row.manifestEntries}`
        ) : (
          <span className="cell-muted">Restricted</span>
        ),
    },
    {
      key: "status",
      header: "Recorded status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <>
      <header className="page-header">
        <div>
          <h2 className="page-title">Operations overview</h2>
          <p className="page-description">
            Live counts from the development database for the records you are
            permitted to see.
          </p>
        </div>
        <div className="page-header-actions">
          <span className="chip chip--demo">Development database</span>
          {canViewReports ? (
            <Link className="btn btn--sm" href="/reports">
              Reports
            </Link>
          ) : null}
        </div>
      </header>

      {!scope.unrestricted ? (
        <p className="notice page-notice" role="note">
          <Icon name="shield" size={16} />
          <span>
            These figures cover only your assigned operator(s)
            {scope.operatorIds.length === 0
              ? " — and you currently have no operator assigned, so no records are shown."
              : ""}
            .
          </span>
        </p>
      ) : (
        <p className="notice page-notice" role="note">
          <Icon name="info" size={16} />
          <span>
            Development prototype. Records are synthetic test data, not
            official government information, and status labels are provisional.
          </span>
        </p>
      )}

      <div className="stats-grid">
        {stats.map((stat) => (
          <StatCard key={stat.id} stat={stat} />
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-column">
          <section className="panel glass" aria-labelledby="journeys-heading">
            <div className="panel-header">
              <div>
                <h3 className="panel-title" id="journeys-heading">
                  Recent journeys
                </h3>
                <p className="panel-subtitle">
                  Latest recorded departures within your scope
                </p>
              </div>
              <Link className="btn btn--sm" href="/trips">
                All journeys
              </Link>
            </div>
            <DataTable
              caption="Recent journeys"
              columns={tripColumns}
              rows={recentTrips}
              rowKey={(row) => row.id}
              emptyMessage="No journeys recorded yet. Create one from the Trips module."
            />
          </section>
        </div>

        <div className="dashboard-column">
          <section className="panel glass" aria-labelledby="compliance-heading">
            <div className="panel-header">
              <div>
                <h3 className="panel-title" id="compliance-heading">
                  Compliance snapshot
                </h3>
                <p className="panel-subtitle">
                  Recorded outcomes only — no automated determinations
                </p>
              </div>
            </div>
            <ul className="info-list">
              <li>
                <span className="info-main">
                  <span>Inspections with findings or failures</span>
                  <span className="stat-hint">
                    From recorded CCTV inspection results
                  </span>
                </span>
                <Badge
                  tone={summary.inspectionsNeedingAttention > 0 ? "warning" : "success"}
                >
                  {summary.inspectionsNeedingAttention}
                </Badge>
              </li>
              <li>
                <span className="info-main">
                  <span>Incidents reported or under review</span>
                  <span className="stat-hint">
                    Requires authorised human review to close
                  </span>
                </span>
                <Badge tone={summary.openIncidents > 0 ? "danger" : "success"}>
                  {summary.openIncidents}
                </Badge>
              </li>
              <li>
                <span className="info-main">
                  <span>Active permits expiring within 30 days</span>
                  <span className="stat-hint">
                    Based on recorded expiry dates, not verified externally
                  </span>
                </span>
                <Badge
                  tone={summary.permitsExpiringSoon > 0 ? "warning" : "success"}
                >
                  {summary.permitsExpiringSoon}
                </Badge>
              </li>
            </ul>
          </section>

          <section className="panel glass" aria-labelledby="quick-links">
            <div className="panel-header">
              <div>
                <h3 className="panel-title" id="quick-links">
                  Quick actions
                </h3>
                <p className="panel-subtitle">
                  Only actions your role permits are shown
                </p>
              </div>
            </div>
            <div className="row-actions">
              <Link className="btn btn--sm" href="/operators">
                Operators
              </Link>
              <Link className="btn btn--sm" href="/vehicles">
                Vehicles
              </Link>
              <Link className="btn btn--sm" href="/routes">
                Routes
              </Link>
              <Link className="btn btn--sm" href="/permits">
                Permits
              </Link>
              <Link className="btn btn--sm" href="/inspections">
                Inspections
              </Link>
              <Link className="btn btn--sm" href="/incidents">
                Incidents
              </Link>
              {canViewAudit ? (
                <Link className="btn btn--sm" href="/audit">
                  Audit trail
                </Link>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

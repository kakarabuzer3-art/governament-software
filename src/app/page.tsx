import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { DashboardActions } from "@/components/dashboard/DashboardActions";
import { Icon } from "@/components/ui/icons";
import {
  DEMO_NOTICE,
  demoActivity,
  demoCctvStatus,
  demoJourneys,
  demoStats,
} from "@/lib/demo-data";
import type { JourneyRow, Tone } from "@/types";

const MANIFEST_TONE: Record<JourneyRow["manifest"], Tone> = {
  complete: "success",
  partial: "warning",
};

const STATUS_TONE: Record<JourneyRow["status"], Tone> = {
  arrived: "success",
  boarding: "info",
  scheduled: "neutral",
};

const labelize = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1);

const journeyColumns: ReadonlyArray<Column<JourneyRow>> = [
  {
    key: "tripRef",
    header: "Trip ref",
    cell: (row) => <span className="cell-strong cell-mono">{row.tripRef}</span>,
  },
  {
    key: "route",
    header: "Route",
    cell: (row) => <span className="cell-strong">{row.route}</span>,
  },
  { key: "operator", header: "Operator", cell: (row) => row.operator },
  {
    key: "departTime",
    header: "Depart",
    cell: (row) => <span className="cell-mono">{row.departTime}</span>,
  },
  { key: "passengers", header: "Passengers", cell: (row) => row.passengers },
  {
    key: "manifest",
    header: "Manifest",
    cell: (row) => (
      <Badge tone={MANIFEST_TONE[row.manifest]}>{labelize(row.manifest)}</Badge>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{labelize(row.status)}</Badge>,
  },
];

/**
 * Dashboard (Phase 1): synthetic sample data only. Every figure is
 * fabricated for interface development and clearly labelled as such.
 * Phase 6 replaces this with permission-aware database queries.
 */
export default function DashboardPage() {
  return (
    <>
      <header className="page-header">
        <div>
          <h2 className="page-title">Operations overview</h2>
          <p className="page-description">
            A single screen for journeys, manifest completeness, CCTV
            inspections and recent activity. This preview uses invented
            sample values — no official statistics are shown.
          </p>
        </div>
        <div className="page-header-actions">
          <span className="chip chip--demo">Sample data</span>
          <DashboardActions />
        </div>
      </header>

      <p className="notice page-notice" role="note">
        <Icon name="info" size={16} />
        <span>{DEMO_NOTICE}</span>
      </p>

      <div className="stats-grid">
        {demoStats.map((stat) => (
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
                  Six fabricated journeys for layout demonstration
                </p>
              </div>
            </div>
            <DataTable
              caption="Sample journeys (synthetic data)"
              columns={journeyColumns}
              rows={demoJourneys}
              rowKey={(row) => row.id}
              emptyMessage="No journeys recorded."
            />
          </section>
        </div>

        <div className="dashboard-column">
          <section className="panel glass" aria-labelledby="cctv-heading">
            <div className="panel-header">
              <div>
                <h3 className="panel-title" id="cctv-heading">
                  CCTV inspection status
                </h3>
                <p className="panel-subtitle">Sample depots (fictional)</p>
              </div>
            </div>
            <ul className="info-list">
              {demoCctvStatus.map((row) => (
                <li key={row.id}>
                  <span className="info-main">
                    <span>{row.location}</span>
                    <span className="stat-hint">
                      {row.inspected}/{row.cameras} cameras inspected &middot;
                      last {row.lastInspection}
                    </span>
                  </span>
                  <Badge tone={row.tone}>{row.statusLabel}</Badge>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel glass" aria-labelledby="activity-heading">
            <div className="panel-header">
              <div>
                <h3 className="panel-title" id="activity-heading">
                  Recent activity
                </h3>
                <p className="panel-subtitle">
                  Synthetic events — real audit trail arrives in Phase 6
                </p>
              </div>
            </div>
            <div>
              {demoActivity.map((event) => (
                <div key={event.id} className="activity-item">
                  <span className="activity-time">{event.time}</span>
                  <span className="activity-text">
                    <strong>{event.actor}</strong> {event.action}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

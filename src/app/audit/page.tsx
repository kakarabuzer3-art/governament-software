import type { Metadata } from "next";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/icons";
import { Pagination } from "@/components/transport/Pagination";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";
import {
  listAuditActions,
  listAuditEvents,
  type AuditEventRow,
} from "@/lib/transport/reports";

export const metadata: Metadata = { title: "Audit Trail" };
export const dynamic = "force-dynamic";

const BASE_PATH = "/audit";

function shortId(value: string | null): string {
  if (!value) return "—";
  return value.length > 14 ? `${value.slice(0, 14)}…` : value;
}

const columns: ReadonlyArray<Column<AuditEventRow>> = [
  {
    key: "createdAt",
    header: "When (UTC)",
    cell: (row) => (
      <span className="cell-mono">
        {row.createdAt.toISOString().slice(0, 19).replace("T", " ")}
      </span>
    ),
  },
  {
    key: "action",
    header: "Action",
    cell: (row) => <span className="cell-strong cell-mono">{row.action}</span>,
  },
  {
    key: "outcome",
    header: "Outcome",
    cell: (row) => (
      <span
        className={
          row.outcome === "success" ? "cell-strong" : "field-error"
        }
      >
        {row.outcome}
      </span>
    ),
  },
  { key: "actor", header: "Actor", cell: (row) => shortId(row.actorId) },
  { key: "role", header: "Role", cell: (row) => row.actorRole ?? "—" },
  { key: "target", header: "Target", cell: (row) => shortId(row.targetId) },
  {
    key: "client",
    header: "Client",
    cell: (row) =>
      row.ipHash ? (
        <span className="cell-mono cell-hint">{shortId(row.ipHash)}</span>
      ) : (
        "—"
      ),
  },
];

/**
 * Audit trail (Phase 6).
 *
 * HONEST DESCRIPTION: this table records security-relevant events and the
 * application exposes no editing or deletion of them. It is NOT tamper-proof —
 * no append-only database role, checksum chain or off-host shipping has been
 * engineered, so it must not be described as immutable evidence.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission(PERMISSIONS.AUDIT_VIEW);
  const params = await searchParams;

  const flat = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  const page = Math.max(1, Number.parseInt(flat(params.page) ?? "1", 10) || 1);
  const pageSize = 25;
  const action = flat(params.action)?.trim() || undefined;
  const outcomeRaw = flat(params.outcome)?.trim();
  const outcome =
    outcomeRaw === "success" || outcomeRaw === "failure" ? outcomeRaw : undefined;

  const [result, actions] = await Promise.all([
    listAuditEvents({ page, pageSize, action, outcome }),
    listAuditActions(),
  ]);

  return (
    <>
      <header className="page-header">
        <div>
          <h2 className="page-title">Audit trail</h2>
          <p className="page-description">
            Security-relevant events recorded by the application: authentication
            outcomes, administrative record changes, sensitive-data reveals and
            report exports.
          </p>
        </div>
        <div className="page-header-actions">
          <span className="chip chip--demo">{result.total} event(s)</span>
        </div>
      </header>

      <p className="notice notice--warning page-notice" role="note">
        <Icon name="info" size={16} />
        <span>
          This trail records events and the application offers no way to edit or
          delete them. It is <strong>not</strong> tamper-proof: append-only
          database roles, checksum chaining and off-host shipping have not been
          implemented or verified. Do not treat it as immutable evidence.
        </span>
      </p>

      <form className="filter-bar glass filter-form" method="get" action={BASE_PATH}>
        <div className="field">
          <label className="field-label" htmlFor="action">
            Action contains
          </label>
          <input
            id="action"
            name="action"
            type="search"
            className="input"
            placeholder="e.g. operator, auth.login"
            defaultValue={action ?? ""}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="outcome">
            Outcome
          </label>
          <select
            id="outcome"
            name="outcome"
            className="input filter-status"
            defaultValue={outcome ?? ""}
          >
            <option value="">Any outcome</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>
        <button type="submit" className="btn">
          Filter
        </button>
        <a className="btn btn--ghost" href={BASE_PATH}>
          Clear
        </a>
      </form>

      {actions.length > 0 ? (
        <p className="cell-hint">
          Recorded action types: {actions.join(", ")}
        </p>
      ) : null}

      <section className="panel glass" aria-label="Audit events">
        <DataTable
          caption="Audit events"
          columns={columns}
          rows={result.rows}
          rowKey={(row) => row.id}
          emptyMessage="No audit events match the current filters."
        />
      </section>

      <Pagination
        basePath={BASE_PATH}
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
        extra={{
          action,
          outcome,
        }}
        noun="events"
      />
    </>
  );
}

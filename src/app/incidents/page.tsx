import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/icons";
import { ArchiveButton } from "@/components/transport/ArchiveButton";
import { FilterBar } from "@/components/transport/FilterBar";
import { Pagination } from "@/components/transport/Pagination";
import { ResourceForm } from "@/components/transport/ResourceForm";
import { StatusBadge } from "@/components/transport/StatusBadge";
import { incidentFields, toDateTimeInput } from "@/components/transport/field-specs";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";
import {
  archiveIncidentAction,
  createIncidentAction,
  updateIncidentAction,
} from "@/lib/transport/actions";
import {
  getIncidentOrThrow,
  listIncidents,
  type IncidentListRow,
} from "@/lib/transport/incidents";
import { operatorOptions } from "@/lib/transport/operators";
import { resolveOperatorScope } from "@/lib/transport/scope";
import { tripOptions } from "@/lib/transport/trips";
import { buildListHref } from "@/lib/transport/url";
import { parseListQuery } from "@/lib/transport/validation";
import { INCIDENT_STATUSES, toOptions } from "@/lib/transport/vocabulary";

export const metadata: Metadata = { title: "Incidents" };
export const dynamic = "force-dynamic";

const BASE_PATH = "/incidents";

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PERMISSIONS.INCIDENT_VIEW);
  const params = await searchParams;
  const query = parseListQuery(params);
  const ctx = { user, scope: resolveOperatorScope(user) };

  const [result, operators, trips] = await Promise.all([
    listIncidents(ctx, query),
    operatorOptions(ctx),
    tripOptions(ctx),
  ]);
  const canManage = user.permissions.has(PERMISSIONS.INCIDENT_MANAGE);

  const editId = typeof params.edit === "string" ? params.edit : undefined;
  let editing: IncidentListRow | null = null;
  if (canManage && editId) {
    try {
      editing = await getIncidentOrThrow(ctx, editId);
    } catch {
      editing = null;
    }
  }

  const columns: ReadonlyArray<Column<IncidentListRow>> = [
    {
      key: "reference",
      header: "Reference",
      cell: (row) => (
        <span className="cell-strong cell-mono">{row.reference}</span>
      ),
    },
    {
      key: "occurredOn",
      header: "Occurred",
      cell: (row) => (
        <span className="cell-mono">
          {row.occurredOn.toISOString().slice(0, 16).replace("T", " ")}
        </span>
      ),
    },
    { key: "location", header: "Location", cell: (row) => row.location },
    { key: "category", header: "Category", cell: (row) => row.category },
    {
      key: "severity",
      header: "Recorded severity",
      cell: (row) => <StatusBadge status={row.severity} />,
    },
    {
      key: "status",
      header: "Review status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            cell: (row: IncidentListRow) => (
              <div className="row-actions">
                <Link
                  className="btn btn--sm btn--ghost"
                  href={buildListHref(BASE_PATH, {
                    q: query.q,
                    status: query.status,
                    edit: row.id,
                  })}
                >
                  Review
                </Link>
                <ArchiveButton
                  action={archiveIncidentAction}
                  id={row.id}
                  what={`incident ${row.reference}`}
                  disabled={row.status === "ARCHIVED"}
                />
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <header className="page-header">
        <div>
          <h2 className="page-title">Incidents</h2>
          <p className="page-description">
            Factual incident records with an authorised human review status.
            The system makes no automated judgement about any person.
          </p>
        </div>
        <div className="page-header-actions">
          <span className="chip chip--demo">Human-reviewed records</span>
        </div>
      </header>

      <p className="notice page-notice" role="note">
        <Icon name="alertTriangle" size={16} />
        <span>
          No automated suspicion scoring, no blacklists and no police,
          immigration or NADRA integration exists in this prototype. Severity is
          a recorded triage value entered by a person.
        </span>
      </p>

      <FilterBar
        basePath={BASE_PATH}
        q={query.q}
        status={query.status}
        statusOptions={toOptions(INCIDENT_STATUSES)}
        placeholder="Search reference, location, category…"
        noun="incidents"
      />

      {canManage ? (
        <ResourceForm
          action={editing ? updateIncidentAction : createIncidentAction}
          fields={incidentFields(
            operators.map((o) => ({ id: o.id, label: `${o.code} — ${o.name}` })),
            trips.map((t) => ({ id: t.id, label: t.tripRef })),
          )}
          title={
            editing ? `Review incident ${editing.reference}` : "Record an incident"
          }
          description="Record observations only. Determinations require authorised human review."
          submitLabel={editing ? "Save review" : "Record incident"}
          initial={
            editing
              ? {
                  reference: editing.reference,
                  operatorId: editing.operator?.id ?? "",
                  tripId: editing.trip?.id ?? "",
                  occurredOn: toDateTimeInput(editing.occurredOn),
                  location: editing.location,
                  category: editing.category,
                  severity: editing.severity,
                  status: editing.status,
                  description: editing.description,
                  reportedBy: editing.reportedBy ?? "",
                  reviewNotes: editing.reviewNotes ?? "",
                }
              : undefined
          }
          hidden={editing ? { id: editing.id } : {}}
          formKey={editing?.id ?? "new"}
          cancelHref={editing ? BASE_PATH : undefined}
          cancelLabel="Cancel review"
        />
      ) : null}

      <section className="panel glass" aria-label="Incident records">
        <DataTable
          caption="Incidents"
          columns={columns}
          rows={result.rows}
          rowKey={(row) => row.id}
          emptyMessage={
            query.q || query.status
              ? "No incidents match the current filters."
              : "No incidents recorded."
          }
        />
      </section>

      <Pagination
        basePath={BASE_PATH}
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
        q={query.q}
        status={query.status}
        noun="incidents"
      />
    </>
  );
}

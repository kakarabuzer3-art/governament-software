import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/icons";
import { ArchiveButton } from "@/components/transport/ArchiveButton";
import { FilterBar } from "@/components/transport/FilterBar";
import { Pagination } from "@/components/transport/Pagination";
import { ResourceForm } from "@/components/transport/ResourceForm";
import { StatusBadge } from "@/components/transport/StatusBadge";
import { permitFields, toDateInput } from "@/components/transport/field-specs";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";
import {
  archivePermitAction,
  createPermitAction,
  updatePermitAction,
} from "@/lib/transport/actions";
import { operatorOptions } from "@/lib/transport/operators";
import { getPermitOrThrow, listPermits, type PermitListRow } from "@/lib/transport/permits";
import { routeOptions } from "@/lib/transport/routes";
import { resolveOperatorScope } from "@/lib/transport/scope";
import { vehicleOptions } from "@/lib/transport/vehicles";
import { buildListHref } from "@/lib/transport/url";
import { parseListQuery } from "@/lib/transport/validation";
import { PERMIT_STATUSES, toOptions } from "@/lib/transport/vocabulary";

export const metadata: Metadata = { title: "Permits" };
export const dynamic = "force-dynamic";

const BASE_PATH = "/permits";

export default async function PermitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PERMISSIONS.PERMIT_VIEW);
  const params = await searchParams;
  const query = parseListQuery(params);
  const ctx = { user, scope: resolveOperatorScope(user) };

  const [result, operators, vehicles, routes] = await Promise.all([
    listPermits(ctx, query),
    operatorOptions(ctx),
    vehicleOptions(ctx),
    routeOptions(ctx),
  ]);
  const canManage = user.permissions.has(PERMISSIONS.PERMIT_MANAGE);

  const editId = typeof params.edit === "string" ? params.edit : undefined;
  let editing: PermitListRow | null = null;
  if (canManage && editId) {
    try {
      editing = await getPermitOrThrow(ctx, editId);
    } catch {
      editing = null;
    }
  }

  const columns: ReadonlyArray<Column<PermitListRow>> = [
    {
      key: "permitNumber",
      header: "Permit",
      cell: (row) => (
        <span className="cell-strong cell-mono">{row.permitNumber}</span>
      ),
    },
    {
      key: "operator",
      header: "Operator",
      cell: (row) => row.operator.name,
    },
    {
      key: "vehicle",
      header: "Vehicle",
      cell: (row) => row.vehicle?.registrationNumber ?? "—",
    },
    {
      key: "route",
      header: "Route",
      cell: (row) => (row.route ? `${row.route.code} — ${row.route.name}` : "—"),
    },
    {
      key: "validity",
      header: "Validity",
      cell: (row) =>
        row.expiresOn ? `Expires ${toDateInput(row.expiresOn)}` : "No expiry recorded",
    },
    {
      key: "status",
      header: "Recorded status",
      cell: (row) => (
        <div className="stacked-cell">
          <StatusBadge status={row.status} />
          <span className="cell-hint">
            from {row.recordedSource.toLowerCase().replace(/_/g, " ")}
          </span>
        </div>
      ),
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            cell: (row: PermitListRow) => (
              <div className="row-actions">
                <Link
                  className="btn btn--sm btn--ghost"
                  href={buildListHref(BASE_PATH, {
                    q: query.q,
                    status: query.status,
                    edit: row.id,
                  })}
                >
                  Edit
                </Link>
                <ArchiveButton
                  action={archivePermitAction}
                  id={row.id}
                  what={`permit ${row.permitNumber}`}
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
          <h2 className="page-title">Permits</h2>
          <p className="page-description">
            Permit records exactly as entered. The status shown is the status
            recorded in this prototype — it is not verified against any
            government system.
          </p>
        </div>
        <div className="page-header-actions">
          <span className="chip chip--demo">Unverified records</span>
        </div>
      </header>

      <p className="notice page-notice" role="note">
        <Icon name="info" size={16} />
        <span>
          A permit status here is a recorded administrative value with no
          external verification. Treat it as unconfirmed until the department
          provides an authoritative source.
        </span>
      </p>

      <FilterBar
        basePath={BASE_PATH}
        q={query.q}
        status={query.status}
        statusOptions={toOptions(PERMIT_STATUSES)}
        placeholder="Search permit number, operator, vehicle…"
        noun="permits"
      />

      {canManage ? (
        <ResourceForm
          action={editing ? updatePermitAction : createPermitAction}
          fields={permitFields(
            operators.map((o) => ({ id: o.id, label: `${o.code} — ${o.name}` })),
            vehicles.map((v) => ({
              id: v.id,
              label: v.registrationNumber,
            })),
            routes.map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` })),
          )}
          title={
            editing ? `Edit permit ${editing.permitNumber}` : "Record a permit"
          }
          description={
            editing
              ? "Changes are validated on the server; vehicle/operator consistency is re-checked."
              : "A vehicle can only be attached when it belongs to the selected operator."
          }
          submitLabel={editing ? "Save changes" : "Record permit"}
          initial={
            editing
              ? {
                  permitNumber: editing.permitNumber,
                  operatorId: editing.operator.id,
                  vehicleId: editing.vehicle?.id ?? "",
                  routeId: editing.route?.id ?? "",
                  permitType: editing.permitType,
                  issuedOn: toDateInput(editing.issuedOn),
                  expiresOn: toDateInput(editing.expiresOn),
                  status: editing.status,
                  recordedSource: editing.recordedSource,
                  notes: editing.notes ?? "",
                }
              : undefined
          }
          hidden={editing ? { id: editing.id } : {}}
          formKey={editing?.id ?? "new"}
          cancelHref={editing ? BASE_PATH : undefined}
          cancelLabel="Cancel edit"
        />
      ) : null}

      <section className="panel glass" aria-label="Permit records">
        <DataTable
          caption="Permits"
          columns={columns}
          rows={result.rows}
          rowKey={(row) => row.id}
          emptyMessage={
            query.q || query.status
              ? "No permits match the current filters."
              : "No permits recorded yet."
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
        noun="permits"
      />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/icons";
import { ArchiveButton } from "@/components/transport/ArchiveButton";
import { FilterBar } from "@/components/transport/FilterBar";
import { Pagination } from "@/components/transport/Pagination";
import { ResourceForm } from "@/components/transport/ResourceForm";
import { StatusBadge } from "@/components/transport/StatusBadge";
import { toDateTimeInput, tripFields } from "@/components/transport/field-specs";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";
import {
  archiveTripAction,
  createTripAction,
  updateTripAction,
} from "@/lib/transport/actions";
import { operatorOptions } from "@/lib/transport/operators";
import { routeOptions } from "@/lib/transport/routes";
import { resolveOperatorScope } from "@/lib/transport/scope";
import { getTripOrThrow, listTrips, type TripListRow } from "@/lib/transport/trips";
import { vehicleOptions } from "@/lib/transport/vehicles";
import { buildListHref } from "@/lib/transport/url";
import { parseListQuery } from "@/lib/transport/validation";
import { toOptions, TRIP_STATUSES } from "@/lib/transport/vocabulary";

export const metadata: Metadata = { title: "Trips & Manifests" };
export const dynamic = "force-dynamic";

const BASE_PATH = "/trips";

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PERMISSIONS.TRIP_VIEW);
  const params = await searchParams;
  const query = parseListQuery(params);
  const ctx = { user, scope: resolveOperatorScope(user) };

  const [result, operators, vehicles, routes] = await Promise.all([
    listTrips(ctx, query),
    operatorOptions(ctx),
    vehicleOptions(ctx),
    routeOptions(ctx),
  ]);
  const canManage = user.permissions.has(PERMISSIONS.TRIP_MANAGE);

  const editId = typeof params.edit === "string" ? params.edit : undefined;
  let editing: TripListRow | null = null;
  if (canManage && editId) {
    try {
      editing = await getTripOrThrow(ctx, editId);
    } catch {
      editing = null;
    }
  }

  const columns: ReadonlyArray<Column<TripListRow>> = [
    {
      key: "tripRef",
      header: "Reference",
      cell: (row) => (
        <Link className="cell-strong cell-mono" href={`${BASE_PATH}/${row.id}`}>
          {row.tripRef}
        </Link>
      ),
    },
    { key: "operator", header: "Operator", cell: (row) => row.operator.name },
    {
      key: "route",
      header: "Route",
      cell: (row) => (row.route ? `${row.route.code} — ${row.route.name}` : "—"),
    },
    {
      key: "departure",
      header: "Departure",
      cell: (row) => (
        <span className="cell-mono">{formatDateTime(row.departureAt)}</span>
      ),
    },
    {
      key: "passengers",
      header: "Manifest",
      cell: (row) =>
        user.permissions.has(PERMISSIONS.MANIFEST_VIEW) ? (
          `${row._count.passengers} passenger(s)`
        ) : (
          <span className="cell-muted">Restricted</span>
        ),
    },
    {
      key: "status",
      header: "Recorded status",
      cell: (row) => <StatusBadge status={row.status} />,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            cell: (row: TripListRow) => (
              <div className="row-actions">
                <Link
                  className="btn btn--sm btn--ghost"
                  href={`${BASE_PATH}/${row.id}`}
                >
                  Manifest
                </Link>
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
                  action={archiveTripAction}
                  id={row.id}
                  what={`journey ${row.tripRef}`}
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
          <h2 className="page-title">Trips &amp; manifests</h2>
          <p className="page-description">
            Journeys recorded against an operator, with a passenger manifest
            held behind separate permissions and encrypting identity fields at
            rest.
          </p>
        </div>
        <div className="page-header-actions">
          <span className="chip chip--demo">Synthetic data only</span>
        </div>
      </header>

      {!ctx.scope.unrestricted ? (
        <p className="notice page-notice" role="note">
          <Icon name="shield" size={16} />
          <span>
            Showing only journeys belonging to your assigned operator(s).
          </span>
        </p>
      ) : null}

      <FilterBar
        basePath={BASE_PATH}
        q={query.q}
        status={query.status}
        statusOptions={toOptions(TRIP_STATUSES)}
        placeholder="Search reference, operator, route…"
        noun="journeys"
      />

      {canManage ? (
        <ResourceForm
          action={editing ? updateTripAction : createTripAction}
          fields={tripFields(
            operators.map((o) => ({ id: o.id, label: `${o.code} — ${o.name}` })),
            vehicles.map((v) => ({ id: v.id, label: v.registrationNumber })),
            routes.map((r) => ({ id: r.id, label: `${r.code} — ${r.name}` })),
          )}
          title={
            editing ? `Edit journey ${editing.tripRef}` : "Schedule a journey"
          }
          description={
            editing
              ? "Changes are validated on the server."
              : "A journey must belong to an operator; its vehicle must belong to that same operator."
          }
          submitLabel={editing ? "Save changes" : "Create journey"}
          initial={
            editing
              ? {
                  tripRef: editing.tripRef,
                  operatorId: editing.operator.id,
                  vehicleId: editing.vehicle?.id ?? "",
                  routeId: editing.route?.id ?? "",
                  departureAt: toDateTimeInput(editing.departureAt),
                  arrivalAt: editing.arrivalAt
                    ? editing.arrivalAt.toISOString().slice(0, 10)
                    : "",
                  status: editing.status,
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

      <section className="panel glass" aria-label="Journey records">
        <DataTable
          caption="Journeys"
          columns={columns}
          rows={result.rows}
          rowKey={(row) => row.id}
          emptyMessage={
            query.q || query.status
              ? "No journeys match the current filters."
              : "No journeys recorded yet."
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
        noun="journeys"
      />
    </>
  );
}

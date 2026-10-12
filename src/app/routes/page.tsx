import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ArchiveButton } from "@/components/transport/ArchiveButton";
import { FilterBar } from "@/components/transport/FilterBar";
import { Pagination } from "@/components/transport/Pagination";
import { ResourceForm } from "@/components/transport/ResourceForm";
import { StatusBadge } from "@/components/transport/StatusBadge";
import { routeFields } from "@/components/transport/field-specs";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";
import {
  archiveRouteAction,
  createRouteAction,
  updateRouteAction,
} from "@/lib/transport/actions";
import { getRouteOrThrow, listRoutes, type RouteListRow } from "@/lib/transport/routes";
import { resolveOperatorScope } from "@/lib/transport/scope";
import { buildListHref } from "@/lib/transport/url";
import { parseListQuery } from "@/lib/transport/validation";
import { ROUTE_STATUSES, toOptions } from "@/lib/transport/vocabulary";

export const metadata: Metadata = { title: "Routes" };
export const dynamic = "force-dynamic";

const BASE_PATH = "/routes";

export default async function RoutesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PERMISSIONS.ROUTE_VIEW);
  const params = await searchParams;
  const query = parseListQuery(params);
  const ctx = { user, scope: resolveOperatorScope(user) };

  const result = await listRoutes(ctx, query);
  const canManage = user.permissions.has(PERMISSIONS.ROUTE_MANAGE);

  const editId = typeof params.edit === "string" ? params.edit : undefined;
  let editing: RouteListRow | null = null;
  if (canManage && editId) {
    try {
      editing = await getRouteOrThrow(ctx, editId);
    } catch {
      editing = null;
    }
  }

  const columns: ReadonlyArray<Column<RouteListRow>> = [
    {
      key: "code",
      header: "Code",
      cell: (row) => <span className="cell-strong cell-mono">{row.code}</span>,
    },
    { key: "name", header: "Route", cell: (row) => row.name },
    {
      key: "od",
      header: "Origin → destination",
      cell: (row) => `${row.originCity} → ${row.destinationCity}`,
    },
    {
      key: "distance",
      header: "Distance",
      cell: (row) => (row.distanceKm ? `${row.distanceKm} km` : "—"),
    },
    {
      key: "permits",
      header: "Permits",
      cell: (row) => row._count.permits,
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
            cell: (row: RouteListRow) => (
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
                  action={archiveRouteAction}
                  id={row.id}
                  what={`route ${row.code}`}
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
          <h2 className="page-title">Routes</h2>
          <p className="page-description">
            Network-level origin/destination records. Operators are linked to
            routes through permits, not by ownership.
          </p>
        </div>
        <div className="page-header-actions">
          <span className="chip chip--demo">Provisional data</span>
        </div>
      </header>

      <FilterBar
        basePath={BASE_PATH}
        q={query.q}
        status={query.status}
        statusOptions={toOptions(ROUTE_STATUSES)}
        placeholder="Search code, name, city…"
        noun="routes"
      />

      {canManage ? (
        <ResourceForm
          action={editing ? updateRouteAction : createRouteAction}
          fields={routeFields()}
          title={editing ? `Edit route ${editing.code}` : "Add a route"}
          description={
            editing
              ? "Changes are validated and recorded on the server."
              : "Creates a new route record. The code must be unique."
          }
          submitLabel={editing ? "Save changes" : "Create route"}
          initial={
            editing
              ? {
                  code: editing.code,
                  name: editing.name,
                  originCity: editing.originCity,
                  destinationCity: editing.destinationCity,
                  distanceKm: editing.distanceKm ? String(editing.distanceKm) : "",
                  estimatedMinutes: editing.estimatedMinutes
                    ? String(editing.estimatedMinutes)
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

      <section className="panel glass" aria-label="Route records">
        <DataTable
          caption="Routes"
          columns={columns}
          rows={result.rows}
          rowKey={(row) => row.id}
          emptyMessage={
            query.q || query.status
              ? "No routes match the current filters."
              : "No routes recorded yet."
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
        noun="routes"
      />
    </>
  );
}

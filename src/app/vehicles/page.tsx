import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/icons";
import { ArchiveButton } from "@/components/transport/ArchiveButton";
import { FilterBar } from "@/components/transport/FilterBar";
import { Pagination } from "@/components/transport/Pagination";
import { ResourceForm } from "@/components/transport/ResourceForm";
import { StatusBadge } from "@/components/transport/StatusBadge";
import { vehicleFields } from "@/components/transport/field-specs";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";
import {
  archiveVehicleAction,
  createVehicleAction,
  updateVehicleAction,
} from "@/lib/transport/actions";
import { operatorOptions } from "@/lib/transport/operators";
import { resolveOperatorScope } from "@/lib/transport/scope";
import {
  getVehicleOrThrow,
  listVehicles,
  type VehicleListRow,
} from "@/lib/transport/vehicles";
import { buildListHref } from "@/lib/transport/url";
import { parseListQuery } from "@/lib/transport/validation";
import { toOptions, VEHICLE_STATUSES } from "@/lib/transport/vocabulary";

export const metadata: Metadata = { title: "Vehicles" };
export const dynamic = "force-dynamic";

const BASE_PATH = "/vehicles";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PERMISSIONS.VEHICLE_VIEW);
  const params = await searchParams;
  const query = parseListQuery(params);
  const ctx = { user, scope: resolveOperatorScope(user) };

  const [result, operators] = await Promise.all([
    listVehicles(ctx, query),
    operatorOptions(ctx),
  ]);
  const canManage = user.permissions.has(PERMISSIONS.VEHICLE_MANAGE);

  const editId = typeof params.edit === "string" ? params.edit : undefined;
  let editing: VehicleListRow | null = null;
  if (canManage && editId) {
    try {
      editing = await getVehicleOrThrow(ctx, editId);
    } catch {
      editing = null;
    }
  }

  const operatorChoices = operators.map((operator) => ({
    id: operator.id,
    label: `${operator.code} — ${operator.name}`,
  }));

  const columns: ReadonlyArray<Column<VehicleListRow>> = [
    {
      key: "registrationNumber",
      header: "Registration",
      cell: (row) => (
        <span className="cell-strong cell-mono">{row.registrationNumber}</span>
      ),
    },
    {
      key: "operator",
      header: "Operator",
      cell: (row) => row.operator.name,
    },
    { key: "vehicleType", header: "Type", cell: (row) => row.vehicleType },
    {
      key: "makeModel",
      header: "Make / model",
      cell: (row) =>
        [row.make, row.model].filter(Boolean).join(" ") || "—",
    },
    {
      key: "seatingCapacity",
      header: "Seats",
      cell: (row) => row.seatingCapacity ?? "—",
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
            cell: (row: VehicleListRow) => (
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
                  action={archiveVehicleAction}
                  id={row.id}
                  what={`vehicle ${row.registrationNumber}`}
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
          <h2 className="page-title">Vehicles</h2>
          <p className="page-description">
            Vehicles recorded against an operator. Registration numbers are
            unique and every vehicle is isolated to its operator&apos;s scope.
          </p>
        </div>
        <div className="page-header-actions">
          <span className="chip chip--demo">Provisional data</span>
        </div>
      </header>

      {!ctx.scope.unrestricted ? (
        <p className="notice page-notice" role="note">
          <Icon name="shield" size={16} />
          <span>
            Showing only vehicles belonging to your assigned operator(s).
          </span>
        </p>
      ) : null}

      <FilterBar
        basePath={BASE_PATH}
        q={query.q}
        status={query.status}
        statusOptions={toOptions(VEHICLE_STATUSES)}
        placeholder="Search registration, make, operator…"
        noun="vehicles"
      />

      {canManage ? (
        <ResourceForm
          action={editing ? updateVehicleAction : createVehicleAction}
          fields={vehicleFields(operatorChoices)}
          title={
            editing
              ? `Edit vehicle ${editing.registrationNumber}`
              : "Add a vehicle"
          }
          description={
            editing
              ? "Changing the operator moves the vehicle into that operator's scope."
              : "Attach a vehicle to an operator you are permitted to manage."
          }
          submitLabel={editing ? "Save changes" : "Create vehicle"}
          initial={
            editing
              ? {
                  operatorId: editing.operator.id,
                  registrationNumber: editing.registrationNumber,
                  vehicleType: editing.vehicleType,
                  make: editing.make ?? "",
                  model: editing.model ?? "",
                  modelYear: editing.modelYear ? String(editing.modelYear) : "",
                  seatingCapacity: editing.seatingCapacity
                    ? String(editing.seatingCapacity)
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

      <section className="panel glass" aria-label="Vehicle records">
        <DataTable
          caption="Vehicles"
          columns={columns}
          rows={result.rows}
          rowKey={(row) => row.id}
          emptyMessage={
            operatorChoices.length === 0 && canManage
              ? "Add an operator first — a vehicle must belong to one."
              : "No vehicles match the current filters."
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
        noun="vehicles"
      />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/icons";
import { ArchiveButton } from "@/components/transport/ArchiveButton";
import { FilterBar } from "@/components/transport/FilterBar";
import { Pagination } from "@/components/transport/Pagination";
import { ResourceForm } from "@/components/transport/ResourceForm";
import { StatusBadge } from "@/components/transport/StatusBadge";
import { operatorFields } from "@/components/transport/field-specs";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";
import {
  archiveOperatorAction,
  createOperatorAction,
  updateOperatorAction,
} from "@/lib/transport/actions";
import { getOperatorOrThrow, listOperators, type OperatorListRow } from "@/lib/transport/operators";
import { resolveOperatorScope } from "@/lib/transport/scope";
import { buildListHref } from "@/lib/transport/url";
import { OPERATOR_STATUSES, toOptions } from "@/lib/transport/vocabulary";
import { parseListQuery } from "@/lib/transport/validation";

export const metadata: Metadata = { title: "Operators" };
// Reads the session and the database per request.
export const dynamic = "force-dynamic";

const BASE_PATH = "/operators";

export default async function OperatorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PERMISSIONS.OPERATOR_VIEW);
  const params = await searchParams;
  const query = parseListQuery(params);
  const ctx = { user, scope: resolveOperatorScope(user) };

  const result = await listOperators(ctx, query);
  const canManage = user.permissions.has(PERMISSIONS.OPERATOR_MANAGE);

  const editId = typeof params.edit === "string" ? params.edit : undefined;
  let editing: OperatorListRow | null = null;
  if (canManage && editId) {
    try {
      editing = await getOperatorOrThrow(ctx, editId);
    } catch {
      editing = null; // Out of scope or removed: fall back to create mode.
    }
  }

  const columns: ReadonlyArray<Column<OperatorListRow>> = [
    {
      key: "code",
      header: "Code",
      cell: (row) => <span className="cell-strong cell-mono">{row.code}</span>,
    },
    {
      key: "name",
      header: "Operator",
      cell: (row) => <span className="cell-strong">{row.name}</span>,
    },
    { key: "city", header: "City", cell: (row) => row.city ?? "—" },
    {
      key: "contact",
      header: "Contact",
      cell: (row) => row.contactPhone ?? row.contactEmail ?? "—",
    },
    {
      key: "vehicles",
      header: "Vehicles",
      cell: (row) => row._count.vehicles,
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
            cell: (row: OperatorListRow) => (
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
                  action={archiveOperatorAction}
                  id={row.id}
                  what={`operator ${row.code}`}
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
          <h2 className="page-title">Transport operators</h2>
          <p className="page-description">
            Register of operators recorded in this prototype. Status values are
            provisional administrative labels, not departmental determinations.
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
            Your account is limited to{" "}
            {ctx.scope.operatorIds.length === 0
              ? "no operators"
              : `${ctx.scope.operatorIds.length} assigned operator(s)`}
            . Records outside that scope are not shown.
          </span>
        </p>
      ) : null}

      <FilterBar
        basePath={BASE_PATH}
        q={query.q}
        status={query.status}
        statusOptions={toOptions(OPERATOR_STATUSES)}
        placeholder="Search code, name, city…"
        noun="operators"
      />

      {canManage ? (
        <ResourceForm
          action={editing ? updateOperatorAction : createOperatorAction}
          fields={operatorFields()}
          title={editing ? `Edit operator ${editing.code}` : "Add an operator"}
          description={
            editing
              ? "Changes are validated and recorded on the server."
              : "Creates a new operator record. The code must be unique."
          }
          submitLabel={editing ? "Save changes" : "Create operator"}
          initial={
            editing
              ? {
                  code: editing.code,
                  name: editing.name,
                  legalName: editing.legalName ?? "",
                  registrationNumber: editing.registrationNumber ?? "",
                  contactEmail: editing.contactEmail ?? "",
                  contactPhone: editing.contactPhone ?? "",
                  city: editing.city ?? "",
                  addressLine: editing.addressLine ?? "",
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

      <section className="panel glass" aria-label="Operator records">
        <DataTable
          caption="Transport operators"
          columns={columns}
          rows={result.rows}
          rowKey={(row) => row.id}
          emptyMessage={
            query.q || query.status
              ? "No operators match the current filters."
              : "No operators recorded yet."
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
        noun="operators"
      />
    </>
  );
}

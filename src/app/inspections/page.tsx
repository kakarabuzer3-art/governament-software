import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/icons";
import { ArchiveButton } from "@/components/transport/ArchiveButton";
import { FilterBar } from "@/components/transport/FilterBar";
import { Pagination } from "@/components/transport/Pagination";
import { ResourceForm } from "@/components/transport/ResourceForm";
import { StatusBadge } from "@/components/transport/StatusBadge";
import { inspectionFields, toDateInput } from "@/components/transport/field-specs";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";
import {
  archiveInspectionAction,
  createInspectionAction,
  updateInspectionAction,
} from "@/lib/transport/actions";
import {
  getInspectionOrThrow,
  listInspections,
  type InspectionListRow,
} from "@/lib/transport/inspections";
import { operatorOptions } from "@/lib/transport/operators";
import { resolveOperatorScope } from "@/lib/transport/scope";
import { buildListHref } from "@/lib/transport/url";
import { parseListQuery } from "@/lib/transport/validation";
import { INSPECTION_RESULTS, toOptions } from "@/lib/transport/vocabulary";

export const metadata: Metadata = { title: "CCTV & Inspections" };
export const dynamic = "force-dynamic";

const BASE_PATH = "/inspections";

export default async function InspectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PERMISSIONS.INSPECTION_VIEW);
  const params = await searchParams;
  const query = parseListQuery(params);
  const ctx = { user, scope: resolveOperatorScope(user) };

  const [result, operators] = await Promise.all([
    listInspections(ctx, query),
    operatorOptions(ctx),
  ]);
  const canManage = user.permissions.has(PERMISSIONS.INSPECTION_MANAGE);

  const editId = typeof params.edit === "string" ? params.edit : undefined;
  let editing: InspectionListRow | null = null;
  if (canManage && editId) {
    try {
      editing = await getInspectionOrThrow(ctx, editId);
    } catch {
      editing = null;
    }
  }

  const columns: ReadonlyArray<Column<InspectionListRow>> = [
    {
      key: "siteName",
      header: "Site",
      cell: (row) => <span className="cell-strong">{row.siteName}</span>,
    },
    { key: "city", header: "City", cell: (row) => row.city ?? "—" },
    {
      key: "cameras",
      header: "Cameras (confirmed working)",
      cell: (row) => `${row.camerasOperational ?? 0} / ${row.cameraCount}`,
    },
    {
      key: "date",
      header: "Inspected",
      cell: (row) => (row.inspectionDate ? toDateInput(row.inspectionDate) : "—"),
    },
    {
      key: "result",
      header: "Recorded result",
      cell: (row) => <StatusBadge status={row.result} />,
    },
    {
      key: "followUp",
      header: "Follow-up",
      cell: (row) => row.followUpAction ?? "—",
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "Actions",
            cell: (row: InspectionListRow) => (
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
                  action={archiveInspectionAction}
                  id={row.id}
                  what={`inspection of ${row.siteName}`}
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
          <h2 className="page-title">CCTV &amp; inspections</h2>
          <p className="page-description">
            Inspection records as observed by an inspector. A camera is never
            reported as operational without a recorded inspection.
          </p>
        </div>
        <div className="page-header-actions">
          <span className="chip chip--demo">Recorded observations</span>
        </div>
      </header>

      <p className="notice page-notice" role="note">
        <Icon name="camera" size={16} />
        <span>
          No live video streaming, footage storage or facial recognition exists
          in this prototype, and none is implied. Only inspection observations
          are recorded.
        </span>
      </p>

      <FilterBar
        basePath={BASE_PATH}
        q={query.q}
        status={query.status}
        statusOptions={toOptions(INSPECTION_RESULTS)}
        placeholder="Search site, city, responsible party…"
        noun="inspections"
      />

      {canManage ? (
        <ResourceForm
          action={editing ? updateInspectionAction : createInspectionAction}
          fields={inspectionFields(
            operators.map((o) => ({ id: o.id, label: `${o.code} — ${o.name}` })),
          )}
          title={
            editing ? `Edit inspection — ${editing.siteName}` : "Record an inspection"
          }
          description="The number of operational cameras can never exceed the number of cameras recorded."
          submitLabel={editing ? "Save changes" : "Record inspection"}
          initial={
            editing
              ? {
                  siteName: editing.siteName,
                  city: editing.city ?? "",
                  operatorId: editing.operator?.id ?? "",
                  cameraCount: String(editing.cameraCount),
                  camerasOperational:
                    editing.camerasOperational === null
                      ? ""
                      : String(editing.camerasOperational),
                  inspectionDate: toDateInput(editing.inspectionDate),
                  result: editing.result,
                  responsibleParty: editing.responsibleParty ?? "",
                  nextDueOn: toDateInput(editing.nextDueOn),
                  findings: editing.findings ?? "",
                  followUpAction: editing.followUpAction ?? "",
                }
              : undefined
          }
          hidden={editing ? { id: editing.id } : {}}
          formKey={editing?.id ?? "new"}
          cancelHref={editing ? BASE_PATH : undefined}
          cancelLabel="Cancel edit"
        />
      ) : null}

      <section className="panel glass" aria-label="Inspection records">
        <DataTable
          caption="CCTV inspections"
          columns={columns}
          rows={result.rows}
          rowKey={(row) => row.id}
          emptyMessage={
            query.q || query.status
              ? "No inspections match the current filters."
              : "No inspections recorded yet."
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
        noun="inspections"
      />
    </>
  );
}

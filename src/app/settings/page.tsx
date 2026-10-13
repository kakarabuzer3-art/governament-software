import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/icons";
import { Badge } from "@/components/ui/Badge";
import { FilterBar } from "@/components/transport/FilterBar";
import { Pagination } from "@/components/transport/Pagination";
import { CreateUserForm } from "@/components/users/CreateUserForm";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";
import {
  listOperatorsForScope,
  listRoles,
  listUsers,
  type UserListItem,
} from "@/lib/users/service";
import { parseListQuery } from "@/lib/transport/validation";
import { toOptions, humanize } from "@/lib/transport/vocabulary";
import { USER_STATUSES } from "@/lib/users/validation";

export const metadata: Metadata = { title: "Users & Access" };
export const dynamic = "force-dynamic";

const BASE_PATH = "/settings";

/**
 * User and access administration (Phase B).
 *
 * The page is readable with `user.view`. Every mutation is performed by a
 * server action that re-checks `user.manage` or `role.manage`; a user without
 * those permissions simply does not see the controls, and would be refused by
 * the server if they submitted them anyway.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requirePermission(PERMISSIONS.USER_VIEW);
  const params = await searchParams;
  const query = parseListQuery(params);

  const result = await listUsers(query);

  const canManageUsers = actor.permissions.has(PERMISSIONS.USER_MANAGE);
  const canManageRoles = actor.permissions.has(PERMISSIONS.ROLE_MANAGE);

  const [roles, operators] = canManageUsers
    ? await Promise.all([listRoles(), listOperatorsForScope()])
    : [[], []];

  const columns: ReadonlyArray<Column<UserListItem>> = [
    {
      key: "name",
      header: "Name",
      cell: (row) => (
        <Link className="cell-strong" href={`${BASE_PATH}/${row.id}`}>
          {row.name}
        </Link>
      ),
    },
    {
      key: "email",
      header: "Email",
      cell: (row) => <span className="cell-mono">{row.email}</span>,
    },
    {
      key: "roles",
      header: "Provisional roles",
      cell: (row) =>
        row.roleNames.length > 0 ? (
          <span>{row.roleNames.join(", ")}</span>
        ) : (
          <span className="cell-muted">No role — no access</span>
        ),
    },
    {
      key: "operators",
      header: "Operator scope",
      cell: (row) =>
        row.operators.length > 0 ? (
          <span>
            {row.operators.map((operator) => operator.code).join(", ")}
          </span>
        ) : (
          <span className="cell-muted">None</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <Badge tone={row.status === "ACTIVE" ? "success" : "danger"}>
          {humanize(row.status)}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <Link className="btn btn--sm btn--ghost" href={`${BASE_PATH}/${row.id}`}>
          Manage
        </Link>
      ),
    },
  ];

  return (
    <>
      <header className="page-header">
        <div>
          <h2 className="page-title">Users &amp; access</h2>
          <p className="page-description">
            Create accounts, disable leavers and manage the provisional roles and
            operator scope of each user.
          </p>
        </div>
        <div className="page-header-actions">
          <span className="chip chip--demo">Provisional roles</span>
        </div>
      </header>

      <p className="notice notice--warning page-notice" role="note">
        <Icon name="info" size={16} />
        <span>
          The four roles are <strong>provisional</strong> and require
          departmental confirmation. Disabling an account revokes its sessions.
          Roles cannot be created or edited here — only assigned and revoked.
        </span>
      </p>

      <FilterBar
        basePath={BASE_PATH}
        q={query.q}
        status={query.status}
        statusOptions={toOptions(USER_STATUSES)}
        placeholder="Search by name or email…"
        noun="accounts"
      />

      {canManageUsers ? (
        <CreateUserForm
          roles={roles.map((role) => ({
            key: role.key,
            name: role.name,
            description: role.description,
          }))}
          operators={operators.map((operator) => ({
            id: operator.id,
            code: operator.code,
            name: operator.name,
          }))}
        />
      ) : (
        <p className="notice page-notice" role="note">
          <Icon name="shield" size={16} />
          <span>
            Your account can review users but not change them. Creating,
            disabling and role changes require the user-management permission.
            {canManageRoles ? "" : " Role changes additionally require role management."}
          </span>
        </p>
      )}

      <section className="panel glass" aria-label="User accounts">
        <DataTable
          caption="User accounts"
          columns={columns}
          rows={result.rows}
          rowKey={(row) => row.id}
          emptyMessage={
            query.q || query.status
              ? "No accounts match the current filters."
              : "No accounts found."
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
        noun="accounts"
      />
    </>
  );
}

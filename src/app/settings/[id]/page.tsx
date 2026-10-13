import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/icons";
import { ConfirmActionButton } from "@/components/transport/ConfirmActionButton";
import { UserStatusControls } from "@/components/users/UserStatusControls";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";
import {
  getUserOrThrow,
  listOperatorsForScope,
  listRoles,
  listUserAuditEvents,
} from "@/lib/users/service";
import {
  setUserOperatorScopeAction,
  setUserRoleAction,
} from "@/lib/users/actions";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

function formatDateTime(value: Date): string {
  return value.toISOString().slice(0, 16).replace("T", " ");
}

/**
 * Single-account administration (Phase B).
 *
 * Role and operator-scope changes are submitted through server actions that
 * re-check `role.manage` / `user.manage` and re-validate every id. The buttons
 * below are a convenience; they are not the authorization boundary.
 */
export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requirePermission(PERMISSIONS.USER_VIEW);
  const { id } = await params;

  const account = await getUserOrThrow(id).catch(() => null);
  if (!account) notFound();

  const canManageUsers = actor.permissions.has(PERMISSIONS.USER_MANAGE);
  const canManageRoles = actor.permissions.has(PERMISSIONS.ROLE_MANAGE);
  const canViewAudit = actor.permissions.has(PERMISSIONS.AUDIT_VIEW);

  const [allRoles, allOperators, auditEvents] = await Promise.all([
    canManageRoles ? listRoles() : Promise.resolve([]),
    canManageUsers ? listOperatorsForScope() : Promise.resolve([]),
    canViewAudit ? listUserAuditEvents(account.id) : Promise.resolve([]),
  ]);

  const assignedRoleKeys = new Set(account.roleKeys);
  const assignedOperatorIds = new Set(account.operators.map((o) => o.id));
  const isSelf = account.id === actor.id;

  // Anti-escalation, mirrored from the server so we do not offer an action the
  // server would refuse: a role is assignable only if its permissions are a
  // subset of the acting user's own.
  const assignableRoles = allRoles.filter((role) =>
    role.permissionKeys.every((permission) =>
      actor.permissions.has(permission as never),
    ),
  );

  return (
    <>
      <header className="page-header">
        <div>
          <h2 className="page-title">{account.name}</h2>
          <p className="page-description">
            <span className="cell-mono">{account.email}</span>
            {isSelf ? " · this is your account" : ""}
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn btn--sm" href="/settings">
            Back to users
          </Link>
        </div>
      </header>

      <section className="panel glass" aria-labelledby="account-summary">
        <div className="panel-header">
          <h3 className="panel-title" id="account-summary">
            Account details
          </h3>
          <Badge tone={account.status === "ACTIVE" ? "success" : "danger"}>
            {account.status === "ACTIVE" ? "Active" : "Disabled"}
          </Badge>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Email verified</dt>
            <dd>{account.emailVerified ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDateTime(account.createdAt)}</dd>
          </div>
          <div>
            <dt>Roles</dt>
            <dd>{account.roleNames.join(", ") || "None — no access"}</dd>
          </div>
          <div>
            <dt>Operator scope</dt>
            <dd>
              {account.operators.length > 0
                ? account.operators
                    .map((operator) => `${operator.code} — ${operator.name}`)
                    .join("; ")
                : "None"}
            </dd>
          </div>
        </dl>
      </section>

      {canManageRoles ? (
        <section className="panel glass" aria-labelledby="roles-heading">
          <div className="panel-header">
            <div>
              <h3 className="panel-title" id="roles-heading">
                Provisional roles
              </h3>
              <p className="panel-subtitle">
                Removing a role that reduces this account&apos;s permissions also
                revokes its active sessions.
              </p>
            </div>
          </div>

          {allRoles.length === 0 ? (
            <p className="cell-hint">
              No roles exist. Run <code>npm run db:seed</code> to create the four
              provisional roles.
            </p>
          ) : (
            <ul className="assignment-list">
              {allRoles.map((role) => {
                const assigned = assignedRoleKeys.has(role.key);
                const assignable =
                  assigned ||
                  assignableRoles.some((candidate) => candidate.key === role.key);
                return (
                  <li key={role.key}>
                    <span className="assignment-main">
                      <strong>{role.name}</strong>
                      <span className="cell-hint">
                        {role.permissionCount} permission(s)
                        {assigned ? "" : " — not assigned"}
                      </span>
                    </span>
                    {assigned ? (
                      <ConfirmActionButton
                        action={setUserRoleAction}
                        fields={{
                          userId: account.id,
                          roleKey: role.key,
                          assign: "false",
                        }}
                        label="Remove role"
                        confirmText={`Remove the "${role.name}" role from ${account.name}?\n\nIf this reduces their permissions, their active sessions will be revoked.`}
                      />
                    ) : assignable ? (
                      <ConfirmActionButton
                        action={setUserRoleAction}
                        fields={{
                          userId: account.id,
                          roleKey: role.key,
                          assign: "true",
                        }}
                        label="Assign role"
                        confirmText={`Assign the "${role.name}" role to ${account.name}?`}
                      />
                    ) : (
                      <span className="cell-hint">
                        Not assignable — it includes permissions you do not hold.
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {canManageUsers ? (
        <section className="panel glass" aria-labelledby="scope-heading">
          <div className="panel-header">
            <div>
              <h3 className="panel-title" id="scope-heading">
                Operator scope
              </h3>
              <p className="panel-subtitle">
                Read from the database on every request, so changes apply
                immediately. An account with no operator sees no operator
                records.
              </p>
            </div>
          </div>

          {allOperators.length === 0 ? (
            <p className="cell-hint">
              No operators exist yet. Create one from the Operators module first.
            </p>
          ) : (
            <ul className="assignment-list">
              {allOperators.map((operator) => {
                const assigned = assignedOperatorIds.has(operator.id);
                return (
                  <li key={operator.id}>
                    <span className="assignment-main">
                      <strong className="cell-mono">{operator.code}</strong>
                      <span className="cell-hint">
                        {operator.name}
                        {assigned ? "" : " — not assigned"}
                      </span>
                    </span>
                    <ConfirmActionButton
                      action={setUserOperatorScopeAction}
                      fields={{
                        userId: account.id,
                        operatorId: operator.id,
                        assign: assigned ? "false" : "true",
                      }}
                      label={assigned ? "Remove scope" : "Assign scope"}
                      confirmText={
                        assigned
                          ? `Remove ${account.name}'s access to ${operator.code}?`
                          : `Give ${account.name} access to ${operator.code}?`
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {canManageUsers ? (
        <section className="panel glass" aria-labelledby="status-heading">
          <div className="panel-header">
            <div>
              <h3 className="panel-title" id="status-heading">
                Account status
              </h3>
              <p className="panel-subtitle">
                Accounts are disabled, never deleted, so history is preserved.
              </p>
            </div>
          </div>
          <UserStatusControls
            userId={account.id}
            userName={account.name}
            disabled={account.status === "DISABLED"}
            disabledReason={account.disabledReason}
            isSelf={isSelf}
          />
        </section>
      ) : null}

      {canViewAudit ? (
        <section className="panel glass" aria-labelledby="user-audit-heading">
          <div className="panel-header">
            <div>
              <h3 className="panel-title" id="user-audit-heading">
                Recent access changes
              </h3>
              <p className="panel-subtitle">
                Events where this account is the subject
              </p>
            </div>
            <Link className="btn btn--sm" href="/audit">
              Full audit trail
            </Link>
          </div>
          {auditEvents.length === 0 ? (
            <p className="cell-hint">No audit events recorded for this account.</p>
          ) : (
            <ul className="info-list">
              {auditEvents.map((event) => (
                <li key={event.id}>
                  <span className="info-main">
                    <span className="cell-mono">{event.action}</span>
                    <span className="stat-hint">
                      {formatDateTime(event.createdAt)} · by{" "}
                      {event.actorId ? `${event.actorId.slice(0, 12)}…` : "system"}
                    </span>
                  </span>
                  <Badge tone={event.outcome === "success" ? "success" : "danger"}>
                    {event.outcome}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <p className="notice page-notice" role="note">
        <Icon name="info" size={16} />
        <span>
          Passwords, password hashes and session tokens are never displayed on
          this page. A generated initial password is shown once, at creation
          time, and cannot be retrieved afterwards.
        </span>
      </p>
    </>
  );
}

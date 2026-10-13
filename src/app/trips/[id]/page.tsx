import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/icons";
import { ConfirmActionButton } from "@/components/transport/ConfirmActionButton";
import { ResourceForm } from "@/components/transport/ResourceForm";
import { RevealIdentity } from "@/components/transport/RevealIdentity";
import { passengerFields } from "@/components/transport/field-specs";
import { requirePermission } from "@/lib/authorization";
import { PERMISSIONS } from "@/lib/rbac";
import {
  createPassengerAction,
  setPassengerRemovedAction,
  updatePassengerAction,
} from "@/lib/transport/actions";
import {
  listPassengers,
  type PassengerListRow,
} from "@/lib/transport/passengers";
import { resolveOperatorScope } from "@/lib/transport/scope";
import { getTripOrThrow } from "@/lib/transport/trips";
import { describeRetentionPolicy } from "@/lib/retention";

export const metadata: Metadata = { title: "Journey manifest" };
export const dynamic = "force-dynamic";

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PERMISSIONS.TRIP_VIEW);
  const { id } = await params;
  const search = await searchParams;
  const ctx = { user, scope: resolveOperatorScope(user) };

  const trip = await getTripOrThrow(ctx, id).catch(() => null);
  if (!trip) notFound();

  const canViewManifest = user.permissions.has(PERMISSIONS.MANIFEST_VIEW);
  const canManageManifest = user.permissions.has(PERMISSIONS.MANIFEST_MANAGE);

  const passengers = canViewManifest
    ? await listPassengers(ctx, trip.id, { includeRemoved: canManageManifest })
    : [];

  const editId = typeof search.edit === "string" ? search.edit : undefined;
  const editing =
    canManageManifest && editId
      ? (passengers.find((row) => row.id === editId) ?? null)
      : null;

  const columns: ReadonlyArray<Column<PassengerListRow>> = [
    {
      key: "passengerName",
      header: "Passenger",
      cell: (row) => (
        <span className={row.removedAt ? "cell-muted" : "cell-strong"}>
          {row.passengerName}
          {row.removedAt ? " (withdrawn)" : ""}
        </span>
      ),
    },
    { key: "fatherName", header: "Father's name", cell: (row) => row.fatherName },
    {
      key: "identity",
      header: "Identity (masked)",
      cell: (row) => (
        <span className="masked-value">
          {row.identityType}: {row.identityMasked}
        </span>
      ),
    },
    {
      key: "mobile",
      header: "Mobile (masked)",
      cell: (row) => <span className="masked-value">{row.mobileMasked}</span>,
    },
    {
      key: "reveal",
      header: "Full details",
      cell: (row) =>
        canManageManifest ? (
          <RevealIdentity passengerId={row.id} />
        ) : (
          <span className="cell-muted">Not permitted</span>
        ),
    },
    ...(canManageManifest
      ? [
          {
            key: "actions",
            header: "Actions",
            cell: (row: PassengerListRow) => (
              <div className="row-actions">
                <Link
                  className="btn btn--sm btn--ghost"
                  href={`/trips/${trip.id}?edit=${row.id}`}
                >
                  Update
                </Link>
                <ConfirmActionButton
                  action={setPassengerRemovedAction}
                  fields={{ id: row.id, tripId: trip.id, removed: "false" }}
                  label="Restore"
                  confirmText={`Restore ${row.passengerName} to the active manifest?`}
                />
                <ConfirmActionButton
                  action={setPassengerRemovedAction}
                  fields={{ id: row.id, tripId: trip.id, removed: "true" }}
                  label="Withdraw"
                  confirmText={`Withdraw ${row.passengerName} from the active manifest?\n\nThe record is retained, not deleted.`}
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
          <h2 className="page-title">Journey {trip.tripRef}</h2>
          <p className="page-description">
            {trip.operator.name} &middot;{" "}
            {trip.route ? `${trip.route.code} — ${trip.route.name}` : "No route recorded"}
          </p>
        </div>
        <div className="page-header-actions">
          <Link className="btn btn--sm" href="/trips">
            Back to journeys
          </Link>
        </div>
      </header>

      <section className="panel glass" aria-labelledby="trip-summary">
        <div className="panel-header">
          <h3 className="panel-title" id="trip-summary">
            Journey details
          </h3>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Departure</dt>
            <dd>{formatDateTime(trip.departureAt)}</dd>
          </div>
          <div>
            <dt>Arrival</dt>
            <dd>{trip.arrivalAt ? formatDateTime(trip.arrivalAt) : "—"}</dd>
          </div>
          <div>
            <dt>Vehicle</dt>
            <dd>{trip.vehicle?.registrationNumber ?? "—"}</dd>
          </div>
          <div>
            <dt>Recorded status</dt>
            <dd>{trip.status.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt>Manifest entries</dt>
            <dd>{trip._count.passengers}</dd>
          </div>
        </dl>
      </section>

      {!canViewManifest ? (
        <p className="notice notice--warning page-notice" role="note">
          <Icon name="shield" size={16} />
          <span>
            Your account does not have the passenger-manifest permission, so no
            passenger data is loaded on this page.
          </span>
        </p>
      ) : (
        <>
          <p className="notice page-notice" role="note">
            <Icon name="info" size={16} />
            <span>
              Identity numbers, mobile numbers and addresses are encrypted at
              rest and shown masked. Revealing full details requires
              authorisation and is recorded in the audit trail.
            </span>
          </p>

          {canManageManifest ? (
            <ResourceForm
              action={editing ? updatePassengerAction : createPassengerAction}
              fields={passengerFields()}
              title={
                editing
                  ? `Update ${editing.passengerName}`
                  : "Add a passenger to the manifest"
              }
              description={
                editing
                  ? "Sensitive fields are deliberately NOT pre-filled from storage. Re-enter them to update this record."
                  : "Values are validated on the server and encrypted before storage."
              }
              submitLabel={editing ? "Save passenger" : "Add passenger"}
              initial={
                editing
                  ? {
                      passengerName: editing.passengerName,
                      fatherName: editing.fatherName,
                      identityType: editing.identityType,
                    }
                  : undefined
              }
              hidden={{ tripId: trip.id, ...(editing ? { id: editing.id } : {}) }}
              formKey={editing?.id ?? "new"}
              cancelHref={editing ? `/trips/${trip.id}` : undefined}
              cancelLabel="Cancel update"
            />
          ) : null}

          <section className="panel glass" aria-label="Passenger manifest">
            <div className="panel-header">
              <div>
                <h3 className="panel-title">Passenger manifest</h3>
                <p className="panel-subtitle">
                  Withdrawn entries are retained for history, never deleted.
                </p>
              </div>
            </div>
            <DataTable
              caption="Passenger manifest"
              columns={columns}
              rows={passengers}
              rowKey={(row) => row.id}
              emptyMessage="No passengers recorded on this journey."
            />
          </section>

          <p className="notice page-notice" role="note">
            <Icon name="info" size={16} />
            <span>{describeRetentionPolicy()}</span>
          </p>
        </>
      )}
    </>
  );
}

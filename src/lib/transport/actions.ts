"use server";

/**
 * Server actions for the transport modules.
 *
 * EVERY action follows the same non-negotiable shape:
 *   1. `requireTransportContext(permission)` — verifies the session and the
 *      required permission against the database, and resolves the caller's
 *      operator scope from trusted relations.
 *   2. the service function — re-validates input with Zod and re-checks the
 *      scope before touching the database.
 *   3. a typed `FormState` result — never a raw error, never a stack trace.
 *
 * The browser's copy of a form is not trusted for anything: hidden ids,
 * operator ids and statuses are all re-checked server-side.
 */
import { revalidatePath } from "next/cache";
import { PERMISSIONS, type PermissionKey } from "@/lib/rbac";
import { requireTransportContext, type TransportContext } from "./context";
import { formSuccess, formValuesFrom, toFormState } from "./errors";
import type { FormState } from "./form-types";
import * as operators from "./operators";
import * as vehicles from "./vehicles";
import * as routes from "./routes";
import * as permits from "./permits";
import * as trips from "./trips";
import * as passengers from "./passengers";
import * as inspections from "./inspections";
import * as incidents from "./incidents";

/** Shared execution wrapper: permission -> work -> revalidate -> FormState. */
async function handle(
  permission: PermissionKey,
  revalidatePaths: string[],
  successMessage: string,
  values: Record<string, string>,
  work: (ctx: TransportContext) => Promise<void>,
): Promise<FormState> {
  try {
    const ctx = await requireTransportContext(permission);
    await work(ctx);
    for (const path of revalidatePaths) revalidatePath(path);
    return { ...formSuccess(successMessage), values: {} };
  } catch (error) {
    return { ...toFormState(error), values };
  }
}

const LIST_PATHS = [
  "/operators",
  "/vehicles",
  "/routes",
  "/permits",
  "/trips",
  "/inspections",
  "/incidents",
  "/",
];

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

export async function createOperatorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.OPERATOR_MANAGE,
    LIST_PATHS,
    "Operator created.",
    values,
    async (ctx) => {
      await operators.createOperator(ctx, values);
    },
  );
}

export async function updateOperatorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.OPERATOR_MANAGE,
    LIST_PATHS,
    "Operator updated.",
    values,
    async (ctx) => {
      await operators.updateOperator(ctx, String(values.id ?? ""), values);
    },
  );
}

export async function archiveOperatorAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.OPERATOR_MANAGE,
    LIST_PATHS,
    "Operator archived.",
    values,
    async (ctx) => {
      await operators.archiveOperator(ctx, String(values.id ?? ""));
    },
  );
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export async function createVehicleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.VEHICLE_MANAGE,
    LIST_PATHS,
    "Vehicle created.",
    values,
    async (ctx) => {
      await vehicles.createVehicle(ctx, values);
    },
  );
}

export async function updateVehicleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.VEHICLE_MANAGE,
    LIST_PATHS,
    "Vehicle updated.",
    values,
    async (ctx) => {
      await vehicles.updateVehicle(ctx, String(values.id ?? ""), values);
    },
  );
}

export async function archiveVehicleAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.VEHICLE_MANAGE,
    LIST_PATHS,
    "Vehicle archived.",
    values,
    async (ctx) => {
      await vehicles.archiveVehicle(ctx, String(values.id ?? ""));
    },
  );
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function createRouteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.ROUTE_MANAGE,
    LIST_PATHS,
    "Route created.",
    values,
    async (ctx) => {
      await routes.createRoute(ctx, values);
    },
  );
}

export async function updateRouteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.ROUTE_MANAGE,
    LIST_PATHS,
    "Route updated.",
    values,
    async (ctx) => {
      await routes.updateRoute(ctx, String(values.id ?? ""), values);
    },
  );
}

export async function archiveRouteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.ROUTE_MANAGE,
    LIST_PATHS,
    "Route archived.",
    values,
    async (ctx) => {
      await routes.archiveRoute(ctx, String(values.id ?? ""));
    },
  );
}

// ---------------------------------------------------------------------------
// Permits
// ---------------------------------------------------------------------------

export async function createPermitAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.PERMIT_MANAGE,
    LIST_PATHS,
    "Permit recorded.",
    values,
    async (ctx) => {
      await permits.createPermit(ctx, values);
    },
  );
}

export async function updatePermitAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.PERMIT_MANAGE,
    LIST_PATHS,
    "Permit updated.",
    values,
    async (ctx) => {
      await permits.updatePermit(ctx, String(values.id ?? ""), values);
    },
  );
}

export async function archivePermitAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.PERMIT_MANAGE,
    LIST_PATHS,
    "Permit archived.",
    values,
    async (ctx) => {
      await permits.archivePermit(ctx, String(values.id ?? ""));
    },
  );
}

// ---------------------------------------------------------------------------
// Trips (Phase 4)
// ---------------------------------------------------------------------------

export async function createTripAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.TRIP_MANAGE,
    LIST_PATHS,
    "Journey created.",
    values,
    async (ctx) => {
      await trips.createTrip(ctx, values);
    },
  );
}

export async function updateTripAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.TRIP_MANAGE,
    LIST_PATHS,
    "Journey updated.",
    values,
    async (ctx) => {
      await trips.updateTrip(ctx, String(values.id ?? ""), values);
    },
  );
}

export async function archiveTripAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.TRIP_MANAGE,
    LIST_PATHS,
    "Journey archived.",
    values,
    async (ctx) => {
      await trips.archiveTrip(ctx, String(values.id ?? ""));
    },
  );
}

// ---------------------------------------------------------------------------
// Passenger manifests (Phase 4) — sensitive personal data
// ---------------------------------------------------------------------------

export async function createPassengerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  const tripId = String(values.tripId ?? "");
  return handle(
    PERMISSIONS.MANIFEST_MANAGE,
    [`/trips/${tripId}`, "/trips"],
    "Passenger added to the manifest.",
    values,
    async (ctx) => {
      await passengers.createPassenger(ctx, tripId, values);
    },
  );
}

export async function updatePassengerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  const tripId = String(values.tripId ?? "");
  return handle(
    PERMISSIONS.MANIFEST_MANAGE,
    [`/trips/${tripId}`, "/trips"],
    "Passenger record updated.",
    values,
    async (ctx) => {
      await passengers.updatePassenger(ctx, String(values.id ?? ""), values);
    },
  );
}

export async function setPassengerRemovedAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  const tripId = String(values.tripId ?? "");
  const removed = values.removed === "true";
  return handle(
    PERMISSIONS.MANIFEST_MANAGE,
    [`/trips/${tripId}`, "/trips"],
    removed
      ? "Passenger withdrawn from the active manifest."
      : "Passenger restored to the manifest.",
    values,
    async (ctx) => {
      await passengers.setPassengerRemoved(
        ctx,
        String(values.id ?? ""),
        removed,
      );
    },
  );
}

/** Result shape of an identity reveal (deliberately separate from FormState). */
export interface RevealResult {
  ok: boolean;
  message: string;
  data?: passengers.RevealedPassenger;
}

/**
 * Reveal one passenger's full identity values.
 *
 * Requires MANIFEST_MANAGE and writes a `passenger.revealed` audit event. The
 * values are returned to the authorised client only — never logged.
 */
export async function revealPassengerAction(
  passengerId: string,
): Promise<RevealResult> {
  try {
    const ctx = await requireTransportContext(PERMISSIONS.MANIFEST_MANAGE);
    const data = await passengers.revealPassenger(ctx, passengerId);
    return { ok: true, message: "Identity revealed for this session.", data };
  } catch (error) {
    const state = toFormState(error);
    return { ok: false, message: state.message };
  }
}

// ---------------------------------------------------------------------------
// CCTV inspections (Phase 5)
// ---------------------------------------------------------------------------

export async function createInspectionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.INSPECTION_MANAGE,
    ["/inspections", "/"],
    "Inspection recorded.",
    values,
    async (ctx) => {
      await inspections.createInspection(ctx, values);
    },
  );
}

export async function updateInspectionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.INSPECTION_MANAGE,
    ["/inspections", "/"],
    "Inspection updated.",
    values,
    async (ctx) => {
      await inspections.updateInspection(ctx, String(values.id ?? ""), values);
    },
  );
}

export async function archiveInspectionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.INSPECTION_MANAGE,
    ["/inspections", "/"],
    "Inspection archived.",
    values,
    async (ctx) => {
      await inspections.archiveInspection(ctx, String(values.id ?? ""));
    },
  );
}

// ---------------------------------------------------------------------------
// Incidents (Phase 5)
// ---------------------------------------------------------------------------

export async function createIncidentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.INCIDENT_MANAGE,
    ["/incidents", "/"],
    "Incident recorded.",
    values,
    async (ctx) => {
      await incidents.createIncident(ctx, values);
    },
  );
}

export async function updateIncidentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.INCIDENT_MANAGE,
    ["/incidents", "/"],
    "Incident updated.",
    values,
    async (ctx) => {
      await incidents.updateIncident(ctx, String(values.id ?? ""), values);
    },
  );
}

export async function archiveIncidentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = formValuesFrom(formData);
  return handle(
    PERMISSIONS.INCIDENT_MANAGE,
    ["/incidents", "/"],
    "Incident archived.",
    values,
    async (ctx) => {
      await incidents.archiveIncident(ctx, String(values.id ?? ""));
    },
  );
}

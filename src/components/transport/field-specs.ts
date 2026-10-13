/**
 * Declarative field definitions for the transport forms.
 *
 * Client-safe: imports only the vocabulary and type modules, never Prisma or
 * session code. The same specs drive both the create and the edit form.
 */
import type { FieldSpec } from "@/lib/transport/form-types";
import {
  humanize,
  IDENTITY_TYPES,
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  INSPECTION_RESULTS,
  OPERATOR_STATUSES,
  PERMIT_SOURCES,
  PERMIT_STATUSES,
  PERMIT_TYPES,
  ROUTE_STATUSES,
  TRIP_STATUSES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
} from "@/lib/transport/vocabulary";

/** A selectable record, e.g. an operator. */
export interface Option {
  id: string;
  label: string;
}

function options(values: readonly string[]) {
  return values.map((value) => ({ value, label: humanize(value) }));
}

/** Format a Date (or null) for an `<input type="date">`. */
export function toDateInput(value: Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Format a Date for an `<input type="datetime-local">` (local time). */
export function toDateTimeInput(value: Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

// ---------------------------------------------------------------------------
// Phase 3
// ---------------------------------------------------------------------------

export function operatorFields(): FieldSpec[] {
  return [
    {
      name: "code",
      label: "Operator code",
      type: "text",
      required: true,
      placeholder: "OPR-0001",
      help: "Internal reference used throughout the system.",
    },
    { name: "name", label: "Operator name", type: "text", required: true },
    { name: "legalName", label: "Registered legal name", type: "text" },
    {
      name: "registrationNumber",
      label: "Registration number",
      type: "text",
      help: "Only if the department records one.",
    },
    { name: "contactEmail", label: "Contact email", type: "email" },
    { name: "contactPhone", label: "Contact phone", type: "tel" },
    { name: "city", label: "City", type: "text" },
    { name: "addressLine", label: "Address", type: "text", wide: true },
    {
      name: "status",
      label: "Recorded status",
      type: "select",
      required: true,
      options: options(OPERATOR_STATUSES),
      help: "Administrative status recorded in this prototype.",
    },
    { name: "notes", label: "Notes", type: "textarea", wide: true },
  ];
}

export function vehicleFields(operators: Option[]): FieldSpec[] {
  return [
    {
      name: "operatorId",
      label: "Operator",
      type: "select",
      required: true,
      options: operators.map((o) => ({ value: o.id, label: o.label })),
    },
    {
      name: "registrationNumber",
      label: "Registration number",
      type: "text",
      required: true,
      placeholder: "e.g. BLA-1234",
      help: "Must be unique across all vehicles.",
    },
    {
      name: "vehicleType",
      label: "Vehicle type",
      type: "select",
      required: true,
      options: options(VEHICLE_TYPES),
    },
    { name: "make", label: "Make", type: "text" },
    { name: "model", label: "Model", type: "text" },
    { name: "modelYear", label: "Model year", type: "number", min: 1950, max: 2100 },
    {
      name: "seatingCapacity",
      label: "Seating capacity",
      type: "number",
      min: 1,
      max: 300,
    },
    {
      name: "status",
      label: "Recorded status",
      type: "select",
      required: true,
      options: options(VEHICLE_STATUSES),
    },
    { name: "notes", label: "Notes", type: "textarea", wide: true },
  ];
}

export function routeFields(): FieldSpec[] {
  return [
    {
      name: "code",
      label: "Route code",
      type: "text",
      required: true,
      placeholder: "RTE-001",
    },
    { name: "name", label: "Route name", type: "text", required: true },
    { name: "originCity", label: "Origin", type: "text", required: true },
    {
      name: "destinationCity",
      label: "Destination",
      type: "text",
      required: true,
    },
    { name: "distanceKm", label: "Distance (km)", type: "number", step: "0.1" },
    {
      name: "estimatedMinutes",
      label: "Estimated duration (minutes)",
      type: "number",
      min: 1,
    },
    {
      name: "status",
      label: "Recorded status",
      type: "select",
      required: true,
      options: options(ROUTE_STATUSES),
    },
    { name: "notes", label: "Notes", type: "textarea", wide: true },
  ];
}

export function permitFields(
  operators: Option[],
  vehicles: Option[],
  routes: Option[],
): FieldSpec[] {
  return [
    {
      name: "permitNumber",
      label: "Permit number",
      type: "text",
      required: true,
      help: "Must be unique. Recorded exactly as issued.",
    },
    {
      name: "operatorId",
      label: "Operator",
      type: "select",
      required: true,
      options: operators.map((o) => ({ value: o.id, label: o.label })),
    },
    {
      name: "vehicleId",
      label: "Vehicle",
      type: "select",
      options: vehicles.map((v) => ({ value: v.id, label: v.label })),
      help: "Must belong to the selected operator.",
    },
    {
      name: "routeId",
      label: "Route",
      type: "select",
      options: routes.map((r) => ({ value: r.id, label: r.label })),
    },
    {
      name: "permitType",
      label: "Permit type",
      type: "select",
      required: true,
      options: options(PERMIT_TYPES),
    },
    { name: "issuedOn", label: "Issue date", type: "date" },
    { name: "expiresOn", label: "Expiry date", type: "date" },
    {
      name: "status",
      label: "Recorded status",
      type: "select",
      required: true,
      options: options(PERMIT_STATUSES),
      help: "Recorded administrative value — not verified against any government source.",
    },
    {
      name: "recordedSource",
      label: "Status recorded from",
      type: "select",
      required: true,
      options: options(PERMIT_SOURCES),
    },
    { name: "notes", label: "Notes", type: "textarea", wide: true },
  ];
}

// ---------------------------------------------------------------------------
// Phase 4
// ---------------------------------------------------------------------------

export function tripFields(
  operators: Option[],
  vehicles: Option[],
  routes: Option[],
): FieldSpec[] {
  return [
    {
      name: "tripRef",
      label: "Trip reference",
      type: "text",
      required: true,
      placeholder: "TRP-0001",
    },
    {
      name: "operatorId",
      label: "Operator",
      type: "select",
      required: true,
      options: operators.map((o) => ({ value: o.id, label: o.label })),
    },
    {
      name: "vehicleId",
      label: "Vehicle",
      type: "select",
      options: vehicles.map((v) => ({ value: v.id, label: v.label })),
    },
    {
      name: "routeId",
      label: "Route",
      type: "select",
      options: routes.map((r) => ({ value: r.id, label: r.label })),
    },
    {
      name: "departureAt",
      label: "Departure",
      type: "datetime-local",
      required: true,
    },
    { name: "arrivalAt", label: "Arrival (date)", type: "date" },
    {
      name: "status",
      label: "Recorded status",
      type: "select",
      required: true,
      options: options(TRIP_STATUSES),
    },
    { name: "notes", label: "Notes", type: "textarea", wide: true },
  ];
}

export function passengerFields(): FieldSpec[] {
  return [
    {
      name: "passengerName",
      label: "Passenger name",
      type: "text",
      required: true,
    },
    { name: "fatherName", label: "Father's name", type: "text", required: true },
    {
      name: "identityType",
      label: "Identity document type",
      type: "select",
      required: true,
      options: options(IDENTITY_TYPES),
    },
    {
      name: "identityNumber",
      label: "Identity document number",
      type: "text",
      required: true,
      help: "A CNIC is 13 digits. Stored encrypted at rest.",
    },
    {
      name: "mobileNumber",
      label: "Mobile number",
      type: "tel",
      required: true,
      placeholder: "03XXXXXXXXX",
    },
    {
      name: "permanentAddress",
      label: "Permanent address",
      type: "textarea",
      required: true,
      wide: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Phase 5
// ---------------------------------------------------------------------------

export function inspectionFields(operators: Option[]): FieldSpec[] {
  return [
    { name: "siteName", label: "Site name", type: "text", required: true },
    { name: "city", label: "City", type: "text" },
    {
      name: "operatorId",
      label: "Operator (if applicable)",
      type: "select",
      options: operators.map((o) => ({ value: o.id, label: o.label })),
    },
    {
      name: "cameraCount",
      label: "Cameras recorded",
      type: "number",
      required: true,
      min: 0,
      max: 5000,
    },
    {
      name: "camerasOperational",
      label: "Cameras confirmed operational",
      type: "number",
      min: 0,
      max: 5000,
      help: "Only count cameras actually inspected and working.",
    },
    { name: "inspectionDate", label: "Inspection date", type: "date" },
    {
      name: "result",
      label: "Recorded result",
      type: "select",
      required: true,
      options: options(INSPECTION_RESULTS),
    },
    { name: "responsibleParty", label: "Responsible party", type: "text" },
    { name: "nextDueOn", label: "Next inspection due", type: "date" },
    { name: "findings", label: "Findings", type: "textarea", wide: true },
    {
      name: "followUpAction",
      label: "Follow-up action",
      type: "textarea",
      wide: true,
    },
  ];
}

export function incidentFields(
  operators: Option[],
  trips: Option[],
): FieldSpec[] {
  return [
    {
      name: "reference",
      label: "Incident reference",
      type: "text",
      required: true,
      placeholder: "INC-0001",
    },
    {
      name: "operatorId",
      label: "Operator (if applicable)",
      type: "select",
      options: operators.map((o) => ({ value: o.id, label: o.label })),
    },
    {
      name: "tripId",
      label: "Journey (if applicable)",
      type: "select",
      options: trips.map((t) => ({ value: t.id, label: t.label })),
    },
    {
      name: "occurredOn",
      label: "Date and time of occurrence",
      type: "datetime-local",
      required: true,
    },
    { name: "location", label: "Location", type: "text", required: true },
    { name: "category", label: "Category", type: "text", required: true },
    {
      name: "severity",
      label: "Recorded severity",
      type: "select",
      required: true,
      options: options(INCIDENT_SEVERITIES),
    },
    {
      name: "status",
      label: "Recorded status",
      type: "select",
      required: true,
      options: options(INCIDENT_STATUSES),
    },
    {
      name: "description",
      label: "Factual description",
      type: "textarea",
      required: true,
      wide: true,
      help: "Record observations only. Assessments require authorised human review.",
    },
    { name: "reportedBy", label: "Reported by", type: "text" },
    { name: "reviewNotes", label: "Review notes", type: "textarea", wide: true },
  ];
}

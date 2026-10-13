/**
 * Server-side validation for every transport record (Phases 3–5).
 *
 * EVERY create/update path validates here, on the server, regardless of what
 * the browser sent. The browser-side form hints are convenience only.
 *
 * The controlled value sets below (statuses, types, results) are PROVISIONAL
 * technical vocabulary for this prototype. They are not presented as
 * departmental or legal classifications, and permit status in particular is a
 * *recorded* value, not authoritative government verification.
 */
import { z } from "zod";
import {
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
} from "./vocabulary";

// Controlled value sets live in ./vocabulary so client components can use them
// without importing this server-oriented module. Re-exported here for the
// convenience of server code and tests.
export {
  CAMERA_CONDITIONS,
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
} from "./vocabulary";

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

const text = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} is required.` : `${label} is too short.`)
    .max(max, `${label} must be at most ${max} characters.`);

const optionalText = (max: number, label: string) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z
      .string()
      .trim()
      .max(max, `${label} must be at most ${max} characters.`)
      .optional(),
  );

const optionalEmail = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.email("Enter a valid email address.").max(160).optional(),
);

const optionalInt = (min: number, max: number, label: string) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.coerce
      .number()
      .int(`${label} must be a whole number.`)
      .min(min, `${label} must be at least ${min}.`)
      .max(max, `${label} must be at most ${max}.`)
      .optional(),
  );

const optionalDecimal = (min: number, max: number, label: string) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.coerce
      .number()
      .min(min, `${label} must be at least ${min}.`)
      .max(max, `${label} must be at most ${max}.`)
      .optional(),
  );

const dateField = (label: string) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must use the YYYY-MM-DD format.`)
      .transform((value) => new Date(`${value}T00:00:00.000Z`))
      .optional(),
  );

const dateTimeField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      `${label} must be a valid date and time.`,
    )
    .transform((value) => new Date(value));

/** Uppercase business code, e.g. "OPR-0001". */
const codeField = (label: string, max = 24) =>
  z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9-]{1,23}$/,
      `${label} must be 2–${max} letters, digits or dashes (e.g. OPR-0001).`,
    )
    .transform((value) => value.toUpperCase());

const idField = (label: string) =>
  z.string().trim().min(1, `${label} is required.`).max(191);

const optionalIdField = () =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(191).optional().nullable(),
  ) as z.ZodType<string | null | undefined>;

// ---------------------------------------------------------------------------
// Shared list query
// ---------------------------------------------------------------------------

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(5).max(100).catch(20),
  q: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(120).optional(),
    ),
  status: z
    .preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().trim().max(40).optional(),
    ),
});

export type ListQuery = {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
};

/** Parse list/search params (works for searchParams and FormData objects). */
export function parseListQuery(
  raw: Record<string, string | string[] | undefined>,
): ListQuery {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") flat[key] = value;
    else if (Array.isArray(value) && value.length > 0) flat[key] = value[0];
  }
  const parsed = listQuerySchema.parse(flat);
  return {
    page: parsed.page,
    pageSize: parsed.pageSize,
    ...(parsed.q ? { q: parsed.q } : {}),
    ...(parsed.status ? { status: parsed.status } : {}),
  };
}

// ---------------------------------------------------------------------------
// Phase 3 — operators
// ---------------------------------------------------------------------------

export const operatorCreateSchema = z.object({
  code: codeField("Operator code"),
  name: text(2, 160, "Operator name"),
  legalName: optionalText(200, "Legal name"),
  registrationNumber: optionalText(60, "Registration number"),
  contactEmail: optionalEmail,
  contactPhone: optionalText(40, "Contact phone"),
  addressLine: optionalText(200, "Address"),
  city: optionalText(80, "City"),
  status: z.enum(OPERATOR_STATUSES).default("ACTIVE"),
  notes: optionalText(2000, "Notes"),
});

export const operatorUpdateSchema = operatorCreateSchema;

export type OperatorInput = z.infer<typeof operatorCreateSchema>;

// ---------------------------------------------------------------------------
// Phase 3 — vehicles
// ---------------------------------------------------------------------------

export const vehicleCreateSchema = z.object({
  registrationNumber: text(2, 60, "Registration number").transform((value) =>
    value.toUpperCase(),
  ),
  operatorId: idField("Operator"),
  vehicleType: z.enum(VEHICLE_TYPES).default("BUS"),
  make: optionalText(80, "Make"),
  model: optionalText(80, "Model"),
  modelYear: optionalInt(1950, 2100, "Model year"),
  seatingCapacity: optionalInt(1, 300, "Seating capacity"),
  status: z.enum(VEHICLE_STATUSES).default("ACTIVE"),
  notes: optionalText(2000, "Notes"),
});

export const vehicleUpdateSchema = vehicleCreateSchema;

export type VehicleInput = z.infer<typeof vehicleCreateSchema>;

// ---------------------------------------------------------------------------
// Phase 3 — routes
// ---------------------------------------------------------------------------

export const routeCreateSchema = z.object({
  code: codeField("Route code"),
  name: text(2, 160, "Route name"),
  originCity: text(2, 120, "Origin"),
  destinationCity: text(2, 120, "Destination"),
  distanceKm: optionalDecimal(0.1, 5000, "Distance"),
  estimatedMinutes: optionalInt(1, 10080, "Estimated duration (minutes)"),
  status: z.enum(ROUTE_STATUSES).default("ACTIVE"),
  notes: optionalText(2000, "Notes"),
});

export const routeUpdateSchema = routeCreateSchema;

export type RouteInput = z.infer<typeof routeCreateSchema>;

// ---------------------------------------------------------------------------
// Phase 3 — permits
// ---------------------------------------------------------------------------

export const permitCreateSchema = z
  .object({
    permitNumber: text(2, 80, "Permit number").transform((value) =>
      value.toUpperCase(),
    ),
    operatorId: idField("Operator"),
    vehicleId: optionalIdField(),
    routeId: optionalIdField(),
    permitType: z.enum(PERMIT_TYPES).default("ROUTE"),
    issuedOn: dateField("Issue date"),
    expiresOn: dateField("Expiry date"),
    status: z.enum(PERMIT_STATUSES).default("PENDING"),
    recordedSource: z.enum(PERMIT_SOURCES).default("MANUAL_ENTRY"),
    notes: optionalText(2000, "Notes"),
  })
  .refine(
    (value) =>
      !value.issuedOn ||
      !value.expiresOn ||
      value.expiresOn.getTime() >= value.issuedOn.getTime(),
    {
      message: "The expiry date cannot be earlier than the issue date.",
      path: ["expiresOn"],
    },
  );

export const permitUpdateSchema = permitCreateSchema;

export type PermitInput = z.infer<typeof permitCreateSchema>;

// ---------------------------------------------------------------------------
// Phase 4 — trips
// ---------------------------------------------------------------------------

export const tripCreateSchema = z.object({
  tripRef: codeField("Trip reference", 32),
  operatorId: idField("Operator"),
  vehicleId: optionalIdField(),
  routeId: optionalIdField(),
  departureAt: dateTimeField("Departure date and time"),
  arrivalAt: dateField("Arrival date"),
  status: z.enum(TRIP_STATUSES).default("SCHEDULED"),
  notes: optionalText(2000, "Notes"),
});

export const tripUpdateSchema = tripCreateSchema;

export type TripInput = z.infer<typeof tripCreateSchema>;

// ---------------------------------------------------------------------------
// Phase 4 — passenger manifests (sensitive personal data)
// ---------------------------------------------------------------------------

export const passengerSchema = z
  .object({
    passengerName: text(2, 120, "Passenger name"),
    fatherName: text(2, 120, "Father's name"),
    identityType: z.enum(IDENTITY_TYPES).default("CNIC"),
    identityNumber: text(5, 32, "Identity number"),
    permanentAddress: text(5, 300, "Permanent address"),
    mobileNumber: text(11, 20, "Mobile number"),
  })
  .superRefine((value, ctx) => {
    const digits = value.identityNumber.replace(/\D/g, "");
    if (value.identityType === "CNIC" && digits.length !== 13) {
      ctx.addIssue({
        code: "custom",
        path: ["identityNumber"],
        message: "A CNIC must contain exactly 13 digits.",
      });
    }
    if (value.identityType === "PASSPORT" && digits.length < 6) {
      ctx.addIssue({
        code: "custom",
        path: ["identityNumber"],
        message: "Enter a valid passport number.",
      });
    }
    if (!/^03\d{9}$/.test(value.mobileNumber.replace(/\D/g, ""))) {
      ctx.addIssue({
        code: "custom",
        path: ["mobileNumber"],
        message: "Enter an 11-digit mobile number beginning with 03.",
      });
    }
  });

export type PassengerInput = z.infer<typeof passengerSchema>;

// ---------------------------------------------------------------------------
// Phase 5 — CCTV inspections
// ---------------------------------------------------------------------------

export const inspectionCreateSchema = z
  .object({
    siteName: text(2, 160, "Site name"),
    city: optionalText(80, "City"),
    operatorId: optionalIdField(),
    cameraCount: z.coerce
      .number()
      .int("Camera count must be a whole number.")
      .min(0, "Camera count cannot be negative.")
      .max(5000, "Camera count is not realistic."),
    camerasOperational: optionalInt(0, 5000, "Operational cameras"),
    inspectionDate: dateField("Inspection date"),
    result: z.enum(INSPECTION_RESULTS).default("NOT_INSPECTED"),
    findings: optionalText(2000, "Findings"),
    responsibleParty: optionalText(160, "Responsible party"),
    followUpAction: optionalText(2000, "Follow-up action"),
    nextDueOn: dateField("Next due date"),
  })
  .refine(
    (value) =>
      value.camerasOperational === undefined ||
      value.camerasOperational <= value.cameraCount,
    {
      message: "Operational cameras cannot exceed the total camera count.",
      path: ["camerasOperational"],
    },
  );

export const inspectionUpdateSchema = inspectionCreateSchema;

export type InspectionInput = z.infer<typeof inspectionCreateSchema>;

// ---------------------------------------------------------------------------
// Phase 5 — incidents
// ---------------------------------------------------------------------------

export const incidentCreateSchema = z.object({
  reference: codeField("Incident reference", 32),
  operatorId: optionalIdField(),
  tripId: optionalIdField(),
  occurredOn: dateTimeField("Date and time of occurrence"),
  location: text(2, 200, "Location"),
  category: text(2, 80, "Category"),
  severity: z.enum(INCIDENT_SEVERITIES).default("LOW"),
  description: text(10, 4000, "Description"),
  status: z.enum(INCIDENT_STATUSES).default("REPORTED"),
  reportedBy: optionalText(160, "Reported by"),
  reviewNotes: optionalText(2000, "Review notes"),
});

export const incidentUpdateSchema = incidentCreateSchema;

export type IncidentInput = z.infer<typeof incidentCreateSchema>;

/** A public-facing accessor for the CNIC digit rule (used by tests/UI). */
export const CNIC_DIGIT_COUNT = 13;

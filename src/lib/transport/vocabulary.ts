/**
 * Provisional controlled vocabulary for the transport modules.
 *
 * Kept in its own, dependency-free module so CLIENT components can render
 * select options and status labels without importing server-only code
 * (Zod schemas, Prisma, session helpers).
 *
 * These value sets are PROVISIONAL technical vocabulary for the prototype.
 * They are not presented as departmental or legally mandated classifications.
 */
import type { Tone } from "@/types";

export const OPERATOR_STATUSES = ["ACTIVE", "SUSPENDED", "ARCHIVED"] as const;
export const VEHICLE_TYPES = ["BUS", "COASTER", "HIACE", "VAN", "OTHER"] as const;
export const VEHICLE_STATUSES = [
  "ACTIVE",
  "MAINTENANCE",
  "SUSPENDED",
  "ARCHIVED",
] as const;
export const ROUTE_STATUSES = ["ACTIVE", "SUSPENDED", "ARCHIVED"] as const;
export const PERMIT_TYPES = ["ROUTE", "VEHICLE", "OPERATOR", "OTHER"] as const;
export const PERMIT_STATUSES = [
  "PENDING",
  "ACTIVE",
  "EXPIRED",
  "SUSPENDED",
  "REVOKED",
  "ARCHIVED",
] as const;
export const PERMIT_SOURCES = [
  "MANUAL_ENTRY",
  "DOCUMENT_UPLOAD",
  "DEPARTMENT_NOTICE",
  "UNVERIFIED",
] as const;
export const TRIP_STATUSES = [
  "SCHEDULED",
  "BOARDING",
  "DEPARTED",
  "ARRIVED",
  "CANCELLED",
] as const;
export const IDENTITY_TYPES = ["CNIC", "PASSPORT", "OTHER"] as const;
export const INSPECTION_RESULTS = [
  "PASS",
  "PASS_WITH_FINDINGS",
  "FAIL",
  "NOT_INSPECTED",
] as const;
export const CAMERA_CONDITIONS = [
  "OPERATIONAL",
  "FAULTY",
  "NOT_INSTALLED",
  "UNKNOWN",
] as const;
export const INCIDENT_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const INCIDENT_STATUSES = [
  "REPORTED",
  "UNDER_REVIEW",
  "CLOSED",
  "ARCHIVED",
] as const;

/** Turn a SCREAMING_SNAKE value into a readable label ("ACTIVE" -> "Active"). */
export function humanize(value: string): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Build `{ value, label }` options for a select input. */
export function toOptions(
  values: readonly string[],
): Array<{ value: string; label: string }> {
  return values.map((value) => ({ value, label: humanize(value) }));
}

/** Semantic tone for a status pill. Unknown values stay neutral. */
export function statusTone(status: string): Tone {
  switch (status) {
    case "ACTIVE":
    case "ARRIVED":
    case "PASS":
    case "CLOSED":
    case "OPERATIONAL":
      return "success";
    case "PENDING":
    case "BOARDING":
    case "PASS_WITH_FINDINGS":
    case "UNDER_REVIEW":
    case "MAINTENANCE":
    case "MEDIUM":
    case "FAULTY":
      return "warning";
    case "SUSPENDED":
    case "REVOKED":
    case "CANCELLED":
    case "FAIL":
    case "CRITICAL":
    case "HIGH":
      return "danger";
    case "SCHEDULED":
    case "DEPARTED":
    case "LOW":
    case "ROUTE":
      return "info";
    default:
      return "neutral";
  }
}

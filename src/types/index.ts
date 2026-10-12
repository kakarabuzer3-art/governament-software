/**
 * Domain and UI types for the application shell and dashboard.
 *
 * Phase 1 ships only presentation-layer types backed by synthetic
 * sample data. Database-backed entities arrive in Phase 2+.
 */

/** Tone of a status badge / semantic indicator. */
export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/** Identifier of a navigation module in the application shell. */
export type ModuleId =
  | "dashboard"
  | "operators"
  | "vehicles"
  | "routes"
  | "permits"
  | "trips"
  | "inspections"
  | "incidents"
  | "reports"
  | "audit"
  | "settings";

/** A single sidebar/top navigation entry. */
export interface NavItem {
  id: ModuleId;
  label: string;
  href: string;
  icon: IconName;
  /** Phase in which this module is scheduled to be implemented. */
  phase: number;
  /** Short description used on placeholder pages. */
  description: string;
}

/** Headline statistic shown on the dashboard. */
export interface StatCardData {
  id: string;
  label: string;
  value: string;
  hint: string;
  icon: IconName;
  tone: Tone;
}

/** Status of a journey in the sample journeys table. */
export type JourneyStatus = "scheduled" | "boarding" | "arrived";

/** Completeness of a passenger manifest for a sample journey. */
export type ManifestStatus = "complete" | "partial";

/** One row of the sample journeys table (fully synthetic). */
export interface JourneyRow {
  id: string;
  tripRef: string;
  route: string;
  operator: string;
  departTime: string;
  passengers: number;
  manifest: ManifestStatus;
  status: JourneyStatus;
}

/** One entry of the sample activity feed. */
export interface ActivityEvent {
  id: string;
  time: string;
  actor: string;
  action: string;
}

/** CCTV inspection summary row for a sample depot. */
export interface CctvStatusRow {
  id: string;
  location: string;
  cameras: number;
  inspected: number;
  /** Date of the most recent recorded inspection (sample). */
  lastInspection: string;
  tone: Tone;
  statusLabel: string;
}

// ---------------------------------------------------------------------------
// Icon system
// ---------------------------------------------------------------------------

/** Names of the inline SVG icons available in the icon registry. */
export type IconName =
  | "dashboard"
  | "users"
  | "bus"
  | "route"
  | "clipboardCheck"
  | "camera"
  | "alertTriangle"
  | "chart"
  | "history"
  | "settings"
  | "menu"
  | "close"
  | "panelLeft"
  | "download"
  | "info"
  | "calendar"
  | "search"
  | "shield";

/** Properties accepted by every icon component. */
export interface IconProps {
  className?: string;
  size?: number;
}

import type {
  ActivityEvent,
  CctvStatusRow,
  JourneyRow,
  StatCardData,
} from "@/types";

/**
 * SYNTHETIC SAMPLE DATA — Phase 1 dashboard preview only.
 *
 * Every value below is fabricated for interface development:
 * - No real passengers, CNICs, mobile numbers or addresses exist here.
 * - Operator, depot and route names are invented "(Sample)" entries.
 * - Numbers are illustrative and NOT official statistics.
 *
 * In Phase 6 this module is replaced by real (development-database)
 * queries; seed files must then clearly separate dev-only data.
 */

export const DEMO_NOTICE =
  "Synthetic sample data for interface development. No real passengers, vehicles or official records.";

export const IS_DEVELOPMENT_PREVIEW = true;

export const demoStats: readonly StatCardData[] = [
  {
    id: "journeys-today",
    label: "Journeys recorded today",
    value: "42",
    hint: "Sample value — not official data",
    icon: "route",
    tone: "info",
  },
  {
    id: "active-vehicles",
    label: "Active vehicles",
    value: "118",
    hint: "Sample value — not official data",
    icon: "bus",
    tone: "success",
  },
  {
    id: "manifest-completeness",
    label: "Manifest completeness",
    value: "96%",
    hint: "Sample value — not official data",
    icon: "clipboardCheck",
    tone: "success",
  },
  {
    id: "pending-inspections",
    label: "Pending CCTV inspections",
    value: "7",
    hint: "Sample value — not official data",
    icon: "camera",
    tone: "warning",
  },
] as const;

export const demoJourneys: readonly JourneyRow[] = [
  {
    id: "j1",
    tripRef: "TRP-DEMO-1042",
    route: "Quetta \u2192 Zhob (sample route)",
    operator: "Sample Movers Co. (fictional)",
    departTime: "08:30",
    passengers: 34,
    manifest: "complete",
    status: "arrived",
  },
  {
    id: "j2",
    tripRef: "TRP-DEMO-1043",
    route: "Quetta \u2192 Loralai (sample route)",
    operator: "Rakhshan Lines (fictional)",
    departTime: "09:15",
    passengers: 28,
    manifest: "complete",
    status: "boarding",
  },
  {
    id: "j3",
    tripRef: "TRP-DEMO-1044",
    route: "Turbat \u2192 Panjgur (sample route)",
    operator: "Makran Express (fictional)",
    departTime: "10:00",
    passengers: 41,
    manifest: "partial",
    status: "boarding",
  },
  {
    id: "j4",
    tripRef: "TRP-DEMO-1045",
    route: "Quetta \u2192 Dalbandin (sample route)",
    operator: "Sample Movers Co. (fictional)",
    departTime: "11:45",
    passengers: 19,
    manifest: "complete",
    status: "scheduled",
  },
  {
    id: "j5",
    tripRef: "TRP-DEMO-1046",
    route: "Gwadar \u2192 Ormara (sample route)",
    operator: "Coastal Route Co. (fictional)",
    departTime: "13:20",
    passengers: 25,
    manifest: "partial",
    status: "scheduled",
  },
  {
    id: "j6",
    tripRef: "TRP-DEMO-1047",
    route: "Sibi \u2192 Quetta (sample route)",
    operator: "Rakhshan Lines (fictional)",
    departTime: "14:05",
    passengers: 37,
    manifest: "complete",
    status: "scheduled",
  },
] as const;

export const demoActivity: readonly ActivityEvent[] = [
  {
    id: "a1",
    time: "10:42",
    actor: "Demo Inspector",
    action: "recorded a sample CCTV inspection at Quetta Terminal",
  },
  {
    id: "a2",
    time: "10:15",
    actor: "Demo Operator",
    action: "submitted manifest for TRP-DEMO-1043",
  },
  {
    id: "a3",
    time: "09:58",
    actor: "Demo Administrator",
    action: "created the sample vehicle record VEH-DEMO-0071",
  },
  {
    id: "a4",
    time: "09:30",
    actor: "Demo Inspector",
    action: "flagged manifest TRP-DEMO-1044 as incomplete (sample)",
  },
  {
    id: "a5",
    time: "08:47",
    actor: "Demo Operator",
    action: "opened journey TRP-DEMO-1042 (sample)",
  },
] as const;

export const demoCctvStatus: readonly CctvStatusRow[] = [
  {
    id: "c1",
    location: "Quetta Terminal (sample depot)",
    cameras: 16,
    inspected: 16,
    lastInspection: "2026-10-08",
    tone: "success",
    statusLabel: "All inspected",
  },
  {
    id: "c2",
    location: "Turbat Terminal (sample depot)",
    cameras: 12,
    inspected: 10,
    lastInspection: "2026-10-05",
    tone: "warning",
    statusLabel: "2 pending",
  },
  {
    id: "c3",
    location: "Loralai Stand (sample depot)",
    cameras: 8,
    inspected: 8,
    lastInspection: "2026-10-02",
    tone: "success",
    statusLabel: "All inspected",
  },
  {
    id: "c4",
    location: "Gwadar Terminal (sample depot)",
    cameras: 14,
    inspected: 9,
    lastInspection: "2026-09-28",
    tone: "danger",
    statusLabel: "Overdue review",
  },
] as const;

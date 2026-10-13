import type { NavItem } from "@/types";

/** A labelled group of navigation items in the sidebar. */
export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

/**
 * Single source of truth for navigation. Drives the sidebar, the
 * topbar page titles and the placeholder pages, so labels and routes
 * can never drift apart.
 *
 * `phase` documents when each module is scheduled to be built; the
 * sidebar shows it as a small chip and placeholder pages repeat it.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        href: "/",
        icon: "dashboard",
        phase: 1,
        description:
          "Operational overview: journeys, manifests, CCTV inspections and recent activity.",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        id: "operators",
        label: "Operators",
        href: "/operators",
        icon: "users",
        phase: 3,
        description:
          "Controlled records for transport operators, with status and contact details.",
      },
      {
        id: "vehicles",
        label: "Vehicles",
        href: "/vehicles",
        icon: "bus",
        phase: 3,
        description:
          "Vehicles recorded against an operator, with unique registration numbers.",
      },
      {
        id: "routes",
        label: "Routes",
        href: "/routes",
        icon: "route",
        phase: 3,
        description:
          "Origin and destination records for scheduled passenger transport.",
      },
      {
        id: "permits",
        label: "Permits",
        href: "/permits",
        icon: "clipboardCheck",
        phase: 3,
        description:
          "Recorded permit details and their recorded status and provenance.",
      },
      {
        id: "trips",
        label: "Trips & Manifests",
        href: "/trips",
        icon: "calendar",
        phase: 4,
        description:
          "Journey creation and passenger manifests with validated, masked records.",
      },
    ],
  },
  {
    label: "Compliance",
    items: [
      {
        id: "inspections",
        label: "CCTV & Inspections",
        href: "/inspections",
        icon: "camera",
        phase: 5,
        description:
          "CCTV installation and inspection records, findings and follow-up actions.",
      },
      {
        id: "incidents",
        label: "Incidents",
        href: "/incidents",
        icon: "alertTriangle",
        phase: 5,
        description:
          "Factual incident reports with assigned reviewers, status tracking and follow-up.",
      },
    ],
  },
  {
    label: "Oversight",
    items: [
      {
        id: "reports",
        label: "Reports",
        href: "/reports",
        icon: "chart",
        phase: 6,
        description:
          "Date-wise and operator-wise reports with permission-aware exports.",
      },
      {
        id: "audit",
        label: "Audit Trail",
        href: "/audit",
        icon: "history",
        phase: 6,
        description:
          "Immutable record of who created, viewed, changed or exported sensitive data.",
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        id: "settings",
        label: "Settings",
        href: "/settings",
        icon: "settings",
        phase: 6,
        description:
          "Retention policy, roles and system configuration (pending departmental approval).",
      },
    ],
  },
] as const;

/** Flat list of every navigation item. */
export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap(
  (group) => group.items,
);

/** Resolve the current route to its navigation item (dashboard as default). */
export function findNavItem(pathname: string): NavItem {
  const exact = NAV_ITEMS.find((item) => item.href === pathname);
  if (exact) return exact;
  const nested = NAV_ITEMS.find(
    (item) => item.href !== "/" && pathname.startsWith(`${item.href}/`),
  );
  return nested ?? NAV_ITEMS[0];
}

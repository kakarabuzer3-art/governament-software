import type { IconName, IconProps } from "@/types";
import type { ReactNode } from "react";

/**
 * Lightweight inline SVG icon registry (stroke style, 24×24 grid).
 * No icon library dependency — keeps the bundle small for low-RAM
 * machines. All icons are decorative by default (aria-hidden);
 * meaningful labels are provided by surrounding controls.
 */

const ICON_PATHS: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="4.5" rx="1.5" />
      <rect x="13.5" y="10.5" width="7.5" height="10.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.7-3 2.9-4.6 5.5-4.6s4.8 1.6 5.5 4.6" />
      <path d="M16 5.4a3.2 3.2 0 0 1 0 5.2" />
      <path d="M17.6 15.3c1.7.7 2.7 2.2 3.1 4.2" />
    </>
  ),
  bus: (
    <>
      <rect x="4" y="3.5" width="16" height="13" rx="2.5" />
      <path d="M4 10h16" />
      <circle cx="8" cy="19" r="1.8" />
      <circle cx="16" cy="19" r="1.8" />
      <path d="M6.5 16.5v1.2M17.5 16.5v1.2" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 6h4.5a3.5 3.5 0 0 1 0 7h-2a3.5 3.5 0 0 0 0 7h4.5" />
    </>
  ),
  clipboardCheck: (
    <>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5V3.8A1.3 1.3 0 0 1 10.3 2.5h3.4A1.3 1.3 0 0 1 15 3.8v.7" />
      <path d="M8.8 12.6l2.2 2.2 4.2-4.4" />
    </>
  ),
  camera: (
    <>
      <path d="M3.5 7.5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Z" transform="translate(2 1)" />
      <path d="M18.5 10.5l3.5-2v7l-3.5-2" />
      <circle cx="10.5" cy="12.5" r="2.6" />
    </>
  ),
  alertTriangle: (
    <>
      <path d="M12 3.8 21 19.5H3L12 3.8Z" />
      <path d="M12 9.5v4.2" />
      <circle cx="12" cy="16.4" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8.5 16v-5M13 16V7.5M17.5 16v-3" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4h4" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9M4 12h5M13 12h7" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
      <circle cx="11" cy="12" r="2" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  panelLeft: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M9.5 4.5v15" />
      <path d="M6.5 9h1M6.5 12h1" />
    </>
  ),
  download: (
    <>
      <path d="M12 3.5v10" />
      <path d="M8 10l4 4 4-4" />
      <path d="M4.5 16.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.7" fill="currentColor" stroke="none" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5V6.5M16 3.5V6.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 2.6v5.6c0 4.4-2.9 7.7-7 9.3-4.1-1.6-7-4.9-7-9.3V5.6L12 3Z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </>
  ),
};

/** Render a named icon from the registry. */
export function Icon({ name, className, size = 20 }: { name: IconName } & IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

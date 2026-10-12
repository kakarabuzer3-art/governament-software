"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import { NAV_GROUPS, findNavItem } from "./nav";
import { UserTopBar } from "./UserTopBar";

export interface AppShellProps {
  children: ReactNode;
}

/**
 * Persistent application shell: glass sidebar + top bar + content
 * area, laid out over the fixed geometric background.
 *
 * Behaviour:
 * - Desktop (>=1024px): sidebar can collapse to an icon rail.
 * - Tablet/mobile: sidebar becomes an off-canvas drawer with a
 *   dimmed overlay; Escape and overlay click close it; the page
 *   behind does not scroll while it is open.
 * - Active route is highlighted and exposed via aria-current.
 */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);

  // The public information site (/info) is deliberately NOT wrapped in the
  // administrative chrome: it must be usable by anonymous visitors, must not
  // expose the internal navigation, and must be indexable. The geometric
  // background still applies, because it is rendered by the root layout.
  const isPublicSite = pathname?.startsWith("/info") ?? false;

  const current = findNavItem(pathname);

  // Close the drawer on navigation — adjusted during render (React's
  // recommended pattern) instead of inside an effect.
  const [activePath, setActivePath] = useState(pathname);
  if (activePath !== pathname) {
    setActivePath(pathname);
    if (drawerOpen) setDrawerOpen(false);
  }

  // Escape closes the drawer; lock body scroll while it is open.
  useEffect(() => {
    if (!drawerOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const shellClasses = [
    "app-shell",
    railCollapsed ? "is-collapsed" : "",
    drawerOpen ? "nav-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (isPublicSite) {
    return <>{children}</>;
  }

  return (
    <div className={shellClasses}>
      <aside
        id="app-sidebar"
        className="app-sidebar glass glass--strong"
        aria-label="Main navigation"
      >
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="shield" size={22} />
          </span>
          <span className="brand-text">
            <span className="brand-title">Transport Security</span>
            <span className="brand-subtitle">Compliance System &middot; Preview</span>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label="Modules">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="nav-section-label">{group.label}</p>
              {group.items.map((item) => {
                const isActive = item.href === current.href;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={`nav-link${isActive ? " is-active" : ""}`}
                    aria-current={isActive ? "page" : undefined}
                    title={railCollapsed ? item.label : undefined}
                  >
                    <Icon name={item.icon} className="nav-icon" size={19} />
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-phase-chip" aria-label={`Phase ${item.phase}`}>
                      P{item.phase}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>Unapproved development project</span>
          <span>Synthetic data only</span>
        </div>
      </aside>

      <div
        className="nav-overlay"
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      <div className="app-frame">
        <header className="app-topbar glass">
          <button
            type="button"
            className="btn btn--ghost btn--icon topbar-menu-btn"
            onClick={() => setDrawerOpen((value) => !value)}
            aria-label={drawerOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={drawerOpen}
            aria-controls="app-sidebar"
          >
            <Icon name={drawerOpen ? "close" : "menu"} size={20} />
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--icon topbar-collapse-btn"
            onClick={() => setRailCollapsed((value) => !value)}
            aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={railCollapsed}
          >
            <Icon name="panelLeft" size={20} />
          </button>

          <div className="topbar-title-group">
            <h1 className="topbar-title">{current.label}</h1>
            <span className="topbar-subtitle">
              Development preview &middot; unapproved project
            </span>
          </div>

          <span className="topbar-spacer" />

          <UserTopBar />
        </header>

        <main id="main-content" className="app-content">
          {children}
        </main>

        <footer className="app-footer">
          Balochistan Transport Security &amp; Compliance Management System —
          development preview with synthetic data. Not an approved government
          service.
        </footer>
      </div>
    </div>
  );
}

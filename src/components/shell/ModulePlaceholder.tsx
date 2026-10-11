import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { IconName } from "@/types";

export interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon: IconName;
  /** Phase in which this module will be implemented. */
  phase: number;
  /** Concrete capabilities that this module will provide. */
  bullets: readonly string[];
}

/**
 * Honest placeholder for a module that has not been implemented yet.
 * Shows what will exist and when — never fakes data or functionality.
 */
export function ModulePlaceholder({
  title,
  description,
  icon,
  phase,
  bullets,
}: ModulePlaceholderProps) {
  return (
    <>
      <header className="page-header">
        <div>
          <h2 className="page-title">{title}</h2>
          <p className="page-description">{description}</p>
        </div>
        <div className="page-header-actions">
          <span className="chip">Not implemented yet</span>
        </div>
      </header>

      <section className="panel glass">
        <EmptyState
          icon={icon}
          title={`Scheduled for Phase ${phase}`}
          description="This module is planned but not built yet. It is shown empty on purpose — the system never fabricates records, statistics or integrations."
        >
          <ul className="info-list placeholder-list">
            {bullets.map((bullet) => (
              <li key={bullet}>
                <span>{bullet}</span>
                <Badge tone="neutral">Planned</Badge>
              </li>
            ))}
          </ul>
        </EmptyState>
      </section>
    </>
  );
}

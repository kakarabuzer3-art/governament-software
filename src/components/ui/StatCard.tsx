import { Icon } from "./icons";
import type { StatCardData } from "@/types";

/**
 * Dashboard statistic card: glass panel with label, large value,
 * icon and an explanatory hint (used to mark sample data honestly).
 */
export function StatCard({ stat }: { stat: StatCardData }) {
  return (
    <article className="panel glass panel--interactive stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{stat.label}</span>
        <span className="stat-icon">
          <Icon name={stat.icon} size={18} />
        </span>
      </div>
      <p className="stat-value">{stat.value}</p>
      <p className="stat-hint">{stat.hint}</p>
    </article>
  );
}

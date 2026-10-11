import type { ReactNode } from "react";
import { Icon } from "./icons";
import type { IconName } from "@/types";

export interface EmptyStateProps {
  icon: IconName;
  title: string;
  description: string;
  /** Optional extra content (chips, actions). */
  children?: ReactNode;
}

/**
 * Honest empty/placeholder state: explains what will live here and
 * which phase delivers it, instead of faking functionality.
 */
export function EmptyState({ icon, title, description, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-text">{description}</p>
      {children}
    </div>
  );
}

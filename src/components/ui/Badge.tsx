import type { ReactNode } from "react";
import type { Tone } from "@/types";

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  /** Optional extra class, e.g. layout spacing helpers. */
  className?: string;
}

const TONE_CLASS: Record<Tone, string> = {
  success: "badge--success",
  warning: "badge--warning",
  danger: "badge--danger",
  info: "badge--info",
  neutral: "badge--neutral",
};

/**
 * Status pill with semantic colour + dot indicator.
 * Status meaning always comes from the text label (accessible),
 * colour only reinforces it.
 */
export function Badge({ tone = "neutral", children, className }: BadgeProps) {
  const classes = ["badge", TONE_CLASS[tone], className]
    .filter(Boolean)
    .join(" ");
  return <span className={classes}>{children}</span>;
}

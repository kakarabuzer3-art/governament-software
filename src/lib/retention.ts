/**
 * Retention policy (Phase 4).
 *
 * The requirement supplied states a MINIMUM 10-day retention for passenger
 * manifest data. That is treated here as a floor to be configured, and
 * explicitly NOT as a licence to delete data.
 *
 * IMPORTANT — NO AUTOMATIC DELETION IS IMPLEMENTED.
 * `AUTOMATIC_DELETION_ENABLED` is hard-disabled. The department's approved
 * retention period, legal-hold rules and backup policy are not yet known, so
 * silently destroying records after 10 days would be unsafe and potentially
 * unlawful. This module only *describes* and *computes* retention facts; it
 * never removes anything.
 */

export const RETENTION_POLICY = {
  /** Stated minimum retention for passenger manifest records, in days. */
  MINIMUM_DAYS: 10,
  /** Upper bound accepted from configuration, purely as a sanity check. */
  MAX_DAYS: 3650,
  /**
   * Automatic deletion is deliberately OFF. Enabling it requires an approved
   * departmental retention schedule, legal-hold handling and verified backups.
   */
  AUTOMATIC_DELETION_ENABLED: false,
} as const;

/**
 * Configured retention in days: `MANIFEST_RETENTION_DAYS` when set to a sane
 * value, otherwise the stated minimum. Never below the minimum.
 */
export function configuredRetentionDays(
  raw: string | undefined = process.env.MANIFEST_RETENTION_DAYS,
): number {
  const parsed = Number.parseInt((raw ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) return RETENTION_POLICY.MINIMUM_DAYS;
  if (parsed < RETENTION_POLICY.MINIMUM_DAYS) return RETENTION_POLICY.MINIMUM_DAYS;
  if (parsed > RETENTION_POLICY.MAX_DAYS) return RETENTION_POLICY.MAX_DAYS;
  return parsed;
}

/** The instant at which the minimum retention period has elapsed. */
export function retentionDueAt(
  createdAt: Date,
  days: number = configuredRetentionDays(),
): Date {
  return new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000);
}

/** True while a record is still inside the minimum retention window. */
export function isWithinMinimumRetention(
  createdAt: Date,
  now: Date = new Date(),
): boolean {
  return retentionDueAt(createdAt, RETENTION_POLICY.MINIMUM_DAYS) > now;
}

/** Human-readable summary of the current, honest state of the policy. */
export function describeRetentionPolicy(): string {
  return (
    `Minimum retention: ${RETENTION_POLICY.MINIMUM_DAYS} days. ` +
    `Configured period: ${configuredRetentionDays()} days ` +
    `(MANIFEST_RETENTION_DAYS). Automatic deletion: DISABLED — no record is ` +
    `removed automatically; the approved departmental retention, legal-hold ` +
    `and backup policy is still pending.`
  );
}

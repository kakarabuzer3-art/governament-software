import Link from "next/link";
import { buildListHref } from "@/lib/transport/url";

export interface PaginationProps {
  basePath: string;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  q?: string;
  status?: string;
  /** Module-specific parameters preserved across page links. */
  extra?: Record<string, string | undefined>;
  noun?: string;
}

/**
 * Accessible pagination. Server-rendered links keep the current filters and
 * are crawlable — but every page re-runs the scoped database query, so page
 * numbers can never expose records outside the caller's scope.
 */
export function Pagination({
  basePath,
  page,
  totalPages,
  total,
  pageSize,
  q,
  status,
  extra,
  noun = "records",
}: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  const href = (target: number) =>
    buildListHref(basePath, { page: target, q, status, extra });

  return (
    <nav className="pagination glass" aria-label="Pagination">
      <p className="pagination-summary">
        Showing <strong>{first}</strong>–<strong>{last}</strong> of{" "}
        <strong>{total}</strong> {noun}
      </p>
      <div className="pagination-controls">
        {page > 1 ? (
          <Link className="btn btn--sm" href={href(page - 1)} rel="prev">
            Previous
          </Link>
        ) : (
          <span className="btn btn--sm" aria-disabled="true">
            Previous
          </span>
        )}
        <span className="pagination-page">
          Page {page} of {totalPages}
        </span>
        {page < totalPages ? (
          <Link className="btn btn--sm" href={href(page + 1)} rel="next">
            Next
          </Link>
        ) : (
          <span className="btn btn--sm" aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

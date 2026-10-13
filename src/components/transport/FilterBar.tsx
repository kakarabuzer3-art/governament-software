"use client";

/**
 * Search + status filter for a record list.
 *
 * Navigation is a normal client route change; the LIST ITSELF is always
 * re-queried on the server with the caller's permissions and operator scope,
 * so filtering can never widen what a user is allowed to see.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import { buildListHref } from "@/lib/transport/url";

export interface FilterBarProps {
  basePath: string;
  q?: string;
  status?: string;
  statusOptions: Array<{ value: string; label: string }>;
  placeholder?: string;
  /** Entity label used in the empty-search message. */
  noun?: string;
}

export function FilterBar({
  basePath,
  q,
  status,
  statusOptions,
  placeholder = "Search…",
  noun = "records",
}: FilterBarProps) {
  const router = useRouter();
  const [text, setText] = useState(q ?? "");

  function navigate(nextQ: string, nextStatus: string) {
    router.push(buildListHref(basePath, { q: nextQ, status: nextStatus }));
  }

  const hasFilters = Boolean(q || status);

  return (
    <div className="filter-bar glass">
      <form
        className="filter-form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          navigate(text, status ?? "");
        }}
      >
        <label className="sr-only" htmlFor="filter-q">
          Search {noun}
        </label>
        <span className="filter-input">
          <Icon name="search" size={16} />
          <input
            id="filter-q"
            className="input"
            type="search"
            value={text}
            placeholder={placeholder}
            onChange={(event) => setText(event.target.value)}
          />
        </span>

        <label className="sr-only" htmlFor="filter-status">
          Filter by status
        </label>
        <select
          id="filter-status"
          className="input filter-status"
          value={status ?? ""}
          onChange={(event) => navigate(text, event.target.value)}
        >
          <option value="">All statuses</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button type="submit" className="btn">
          Search
        </button>

        {hasFilters ? (
          <a className="btn btn--ghost" href={basePath}>
            Clear
          </a>
        ) : null}
      </form>
    </div>
  );
}

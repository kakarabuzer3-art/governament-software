/**
 * Query-string helper shared by list pages, filters and pagination.
 * Client-safe (no server imports).
 */

export interface ListHrefParams {
  page?: number;
  q?: string;
  status?: string;
  /** Present when editing an existing record in place. */
  edit?: string;
  /** Additional module-specific parameters (e.g. an audit action filter). */
  extra?: Record<string, string | undefined>;
}

/** Build a list URL, omitting empty/default parameters for clean links. */
export function buildListHref(
  basePath: string,
  params: ListHrefParams = {},
): string {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.status?.trim()) search.set("status", params.status.trim());
  for (const [key, value] of Object.entries(params.extra ?? {})) {
    if (value?.trim()) search.set(key, value.trim());
  }
  if (params.page && params.page > 1) search.set("page", String(params.page));
  if (params.edit?.trim()) search.set("edit", params.edit.trim());
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

import type { ReactNode } from "react";

export interface Column<T> {
  /** Stable key for the column definition. */
  key: string;
  header: string;
  /** Renders the cell content for one row. */
  cell: (row: T) => ReactNode;
  /** Optional CSS class for the <th>/<td> cells. */
  className?: string;
}

export interface DataTableProps<T> {
  /** Visible caption describing the table (screen-reader friendly). */
  caption: string;
  columns: ReadonlyArray<Column<T>>;
  rows: ReadonlyArray<T>;
  /** Stable React key for each row. */
  rowKey: (row: T) => string;
  /** Shown when there are no rows. */
  emptyMessage?: string;
}

/**
 * Generic typed glass data table. Horizontally scrollable in its
 * container so narrow screens never break the layout.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  emptyMessage = "No records to display.",
}: DataTableProps<T>) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.className}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{emptyMessage}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} className={column.className}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

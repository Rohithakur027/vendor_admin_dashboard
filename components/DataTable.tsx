"use client";

import { Fragment, ReactNode, CSSProperties } from "react";

const MockSeparator = () => (
  <div className="flex items-center gap-2.5 px-6 py-1.5 bg-amber-50 border-y border-dashed border-amber-200">
    <div className="flex-1 h-px bg-amber-200" />
    <span className="text-[9.5px] font-bold text-amber-600 tracking-widest uppercase whitespace-nowrap">
      Sample Data
    </span>
    <div className="flex-1 h-px bg-amber-200" />
  </div>
);

export interface DataTableColumn {
  label: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn[];
  /** CSS gridTemplateColumns value, e.g. "100px 2fr 1.3fr 110px" */
  gridCols: string;
  /** Tailwind gap class, default "gap-4" */
  gap?: string;
  /** min-width of the inner scrollable container in px, default 900 */
  minWidth?: number;
  data: T[];
  keyExtractor: (item: T, idx: number) => string;
  /** Return the cell content for each row — wrapped in a Fragment or <> </> */
  renderRow: (item: T, idx: number) => ReactNode;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  /** Index at which to render the "Sample Data" separator */
  splitAt?: number;
}

export function DataTable<T>({
  columns,
  gridCols,
  gap = "gap-4",
  minWidth = 900,
  data,
  keyExtractor,
  renderRow,
  onRowClick,
  emptyMessage = "No data found.",
  splitAt,
}: DataTableProps<T>) {
  const gridStyle: CSSProperties = { gridTemplateColumns: gridCols };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="w-full overflow-x-auto">
        <div style={{ minWidth }}>
          {/* Header */}
          <div
            className={`grid items-center ${gap} px-6 py-3.5 border-b border-slate-100 bg-slate-50/50`}
            style={gridStyle}
          >
            {columns.map((col) => (
              <div
                key={col.label}
                className="text-[11px] font-bold text-slate-400 uppercase tracking-wider"
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="flex flex-col divide-y divide-slate-100">
            {data.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-sm font-medium">{emptyMessage}</p>
              </div>
            ) : (
              data.map((item, idx) => (
                <Fragment key={keyExtractor(item, idx)}>
                  {splitAt !== undefined &&
                    idx === splitAt &&
                    splitAt > 0 &&
                    splitAt < data.length && <MockSeparator />}
                  <div
                    className={`grid items-center ${gap} px-6 py-3.5 transition-colors ${
                      onRowClick ? "hover:bg-slate-50 cursor-pointer" : ""
                    }`}
                    style={gridStyle}
                    onClick={() => onRowClick?.(item)}
                  >
                    {renderRow(item, idx)}
                  </div>
                </Fragment>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

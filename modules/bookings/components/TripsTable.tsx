"use client";

import React, { Fragment, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getTableSpec, type TableKey } from "@/lib/columnConfig";
import type { buildTripRenderers } from "../tripRenderers";
import { EM_DASH } from "../tripRenderers";
import type { Booking } from "../types";

type Renderers = ReturnType<typeof buildTripRenderers>;

interface TripsTableProps {
  items:         Booking[];
  visibleCols:   string[];
  renderers:     Renderers;
  tableKey:      TableKey;
  isLoading?:    boolean;
  prefsLoading?: boolean;
  onRowClick?:   (item: Booking) => void;
  // Insert `separator` at this index (e.g. for mock-data divider). -1 to disable.
  splitAt?:      number;
  separator?:    React.ReactNode;
  emptyMessage?: string;
}

export function TripsTable({
  items,
  visibleCols,
  renderers,
  tableKey,
  isLoading    = false,
  prefsLoading = false,
  onRowClick,
  splitAt      = -1,
  separator,
  emptyMessage = "No trips found.",
}: TripsTableProps) {
  const spec = getTableSpec(tableKey);

  const gridTemplate = useMemo(
    () => visibleCols
      .map((k) => {
        const col = spec.columns.find((c) => c.key === k);
        return col ? `minmax(${col.minWidth}px, 1fr)` : "1fr";
      })
      .join(" "),
    [visibleCols, spec.columns],
  );

  const minTableWidth = useMemo(
    () => visibleCols.reduce((sum, k) => sum + (spec.columns.find((c) => c.key === k)?.minWidth ?? 100), 0) + 48,
    [visibleCols, spec.columns],
  );

  const loading = isLoading || prefsLoading;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="w-full overflow-x-auto">
        <div className="w-fit min-w-full" style={{ minWidth: minTableWidth }}>
          {/* Header — sticky to top of scroll container */}
          <div
            className="grid items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-[2] backdrop-blur"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {prefsLoading
              ? Array.from({ length: visibleCols.length }).map((_, i) => (
                  <Skeleton key={i} className={`h-3 ${i === 0 ? "w-24" : "w-16"}`} />
                ))
              : visibleCols.map((k, i) => {
                  const col = spec.columns.find((c) => c.key === k);
                  if (!col) return null;
                  const stickyStyle = i === 0
                    ? { position: "sticky" as const, left: 0, background: "rgb(248 250 252 / 0.95)", zIndex: 3 }
                    : undefined;
                  return (
                    <div
                      key={k}
                      className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate"
                      style={stickyStyle}
                      title={col.label}
                    >
                      {col.label}
                    </div>
                  );
                })}
          </div>

          {/* Body */}
          <div className="flex flex-col divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="grid items-center gap-4 px-6 py-3.5 bg-white"
                  style={{ gridTemplateColumns: gridTemplate }}
                >
                  {visibleCols.map((k, j) => {
                    const r = (renderers as Record<string, { skeleton: () => React.JSX.Element }>)[k];
                    const stickyStyle = j === 0
                      ? { position: "sticky" as const, left: 0, background: "white", zIndex: 1 }
                      : undefined;
                    return (
                      <div key={k} style={stickyStyle} className="min-w-0">
                        {r?.skeleton() ?? <Skeleton className="h-3.5 w-14" />}
                      </div>
                    );
                  })}
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-slate-500">{emptyMessage}</div>
            ) : (
              items.map((item, idx) => (
                <Fragment key={item.id}>
                  {idx === splitAt && separator}
                  <div
                    className={`grid items-center gap-4 px-6 py-3.5 bg-white transition-colors group ${onRowClick ? "hover:bg-slate-50 cursor-pointer" : ""}`}
                    style={{ gridTemplateColumns: gridTemplate }}
                    onClick={onRowClick ? () => onRowClick(item) : undefined}
                  >
                    {visibleCols.map((k, j) => {
                      const r = (renderers as Record<string, { body: (b: Booking) => React.ReactNode }>)[k];
                      const stickyStyle = j === 0
                        ? { position: "sticky" as const, left: 0, background: "inherit", zIndex: 1 }
                        : undefined;
                      return (
                        <div key={k} style={stickyStyle} className="min-w-0">
                          {r ? r.body(item) : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>}
                        </div>
                      );
                    })}
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

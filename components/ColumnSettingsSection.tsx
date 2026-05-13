"use client";

import { useState } from "react";
import { GripVertical, RotateCcw } from "lucide-react";
import {
  type TableSpec,
  MIN_VISIBLE_COLUMNS,
  defaultColumnsFor,
} from "@/lib/columnConfig";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";

interface Props { spec: TableSpec }

export function ColumnSettingsSection({ spec }: Props) {
  const { columns, loading, isCustom, isVisible, toggle, reset, setColumns, totalCount } =
    useColumnPreferences(spec.key);
  const [toast, setToast] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  function handleToggle(key: string) {
    const isOn = isVisible(key);
    if (isOn && columns.length <= MIN_VISIBLE_COLUMNS) {
      showToast(`At least ${MIN_VISIBLE_COLUMNS} columns must be visible`);
      return;
    }
    toggle(key);
  }

  function onDragStart(key: string) { setDragKey(key); }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  function onDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) { setDragKey(null); return; }
    const next = columns.slice();
    const from = next.indexOf(dragKey);
    const to   = next.indexOf(targetKey);
    if (from < 0 || to < 0) { setDragKey(null); return; }
    next.splice(from, 1);
    next.splice(to, 0, dragKey);
    setColumns(next);
    setDragKey(null);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">{spec.title}</h2>
          <p className="text-[12.5px] text-slate-500 mt-1">{spec.blurb}</p>
        </div>
        <div className="flex items-center gap-2">
          {isCustom && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Customized
            </span>
          )}
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw size={12} /> Reset to default
          </button>
        </div>
      </header>

      {/* Live preview strip */}
      <div className="mb-5">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Preview · header row</div>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
          <div className="flex gap-1.5 min-w-fit">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-7 w-28 rounded-md bg-slate-200 animate-pulse" />
              ))
            ) : columns.length === 0 ? (
              <div className="text-[12px] text-slate-400 italic px-2 py-1.5">No columns selected</div>
            ) : (
              columns.map(k => {
                const col = spec.columns.find(c => c.key === k);
                if (!col) return null;
                return (
                  <span key={k} className="inline-flex items-center px-3 py-1.5 rounded-md bg-white border border-blue-200 text-[11.5px] font-semibold text-blue-700 shadow-sm whitespace-nowrap">
                    {col.label}
                  </span>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 2-column grid of column toggle cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {spec.columns.map(col => {
          const on = isVisible(col.key);
          return (
            <div
              key={col.key}
              draggable={on}
              onDragStart={() => onDragStart(col.key)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(col.key)}
              className={`group relative h-[80px] rounded-xl border-l-4 border transition-colors flex items-center gap-3 px-3 ${
                on
                  ? "bg-blue-50/40 border-l-blue-500 border-slate-200"
                  : "bg-slate-50 border-l-slate-200 border-slate-200"
              }`}
            >
              <div
                className={`opacity-0 group-hover:opacity-100 transition-opacity ${on ? "cursor-grab" : "cursor-not-allowed"}`}
                title={on ? "Drag to reorder" : "Enable to reorder"}
              >
                <GripVertical size={16} className="text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[13.5px] font-bold truncate ${on ? "text-slate-900" : "text-slate-400"}`}>
                  {col.label}
                </div>
                <div className={`text-[11px] truncate mt-0.5 ${on ? "text-slate-500" : "text-slate-400"}`}>
                  {col.dbFields}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => handleToggle(col.key)}
                className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
                  on ? "bg-blue-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    on ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-[11.5px] text-slate-400">
        {columns.length} of {totalCount} visible · Changes save automatically
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white text-[12.5px] font-medium px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </section>
  );
}

// Tiny helper, only used inside settings page summary
export function hasCustomLayout(spec: TableSpec, columns: string[] | null): boolean {
  if (!columns) return false;
  const def = defaultColumnsFor(spec.key);
  if (columns.length !== def.length) return true;
  return columns.some((k, i) => k !== def[i]);
}

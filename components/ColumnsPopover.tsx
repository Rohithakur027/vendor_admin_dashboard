"use client";

import { useEffect, useRef, useState } from "react";
import { Columns3, Check } from "lucide-react";
import { getTableSpec, type TableKey, type ColumnDef, MIN_VISIBLE_COLUMNS } from "@/lib/columnConfig";

interface Props {
  tableKey:   TableKey;
  visible:    string[];
  totalCount: number;
  onToggle:   (key: string) => void;
  onReset:    () => void;
  onSelectAll?: () => void;
  availableColumns?: ColumnDef[];
}

export function ColumnsPopover({ tableKey, visible, totalCount, onToggle, onReset, onSelectAll, availableColumns }: Props) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const spec = getTableSpec(tableKey);
  const columns = availableColumns ?? spec.columns;
  const visibleSet = new Set(visible);
  const allVisible = visible.length === totalCount;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleToggle(key: string) {
    const isOn = visibleSet.has(key);
    if (isOn && visible.length <= MIN_VISIBLE_COLUMNS) {
      setToast(`At least ${MIN_VISIBLE_COLUMNS} columns must be visible`);
      return;
    }
    onToggle(key);
  }

  function handleSelectAll() {
    if (allVisible) return;
    if (onSelectAll) {
      onSelectAll();
      return;
    }

    // Fallback for callers that do not pass a dedicated bulk setter.
    columns
      .map(col => col.key)
      .filter(key => !visibleSet.has(key))
      .forEach(key => onToggle(key));
  }

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-2 h-[42px] px-4 rounded-xl border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <Columns3 size={14} className="text-slate-500" />
        Columns
        <span className="ml-0.5 text-[11px] font-semibold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
          {visible.length}/{totalCount}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <div>
              <div className="text-[13px] font-bold text-slate-900">{spec.title} columns</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Choose which to display</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={allVisible}
                className="text-[11.5px] font-medium text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed whitespace-nowrap"
              >
                Select all
              </button>
              <button type="button" onClick={onReset} className="text-[11.5px] font-medium text-blue-600 hover:underline">
                Reset
              </button>
            </div>
          </div>

          <ul className="py-1">
            {[...columns].sort((a, b) => a.label.localeCompare(b.label)).map(col => {
              const on = visibleSet.has(col.key);
              return (
                <li key={col.key}>
                  <button
                    type="button"
                    onClick={() => handleToggle(col.key)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 text-left"
                  >
                    <span
                      className={`w-4 h-4 rounded-[5px] border flex items-center justify-center transition-colors ${
                        on ? "bg-blue-600 border-blue-600" : "bg-white border-slate-300"
                      }`}
                    >
                      {on && <Check size={11} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className={`text-[13px] ${on ? "text-slate-900 font-medium" : "text-slate-500"}`}>
                      {col.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white text-[12.5px] font-medium px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

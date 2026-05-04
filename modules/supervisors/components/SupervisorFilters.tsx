"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/SearchBar";
import { X } from "lucide-react";
import { TbFilter } from "react-icons/tb";
import { cn } from "@/lib/utils";
import type { SupervisorStatus } from "../types";

interface SupervisorFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: SupervisorStatus | "All";
  onStatusFilterChange: (v: SupervisorStatus | "All") => void;
}

export function SupervisorFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: SupervisorFiltersProps) {
  const [open, setOpen]                   = useState(false);
  const [pendingStatus, setPendingStatus] = useState<SupervisorStatus | "All">(statusFilter);
  const [panelPos, setPanelPos]           = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);

  const hasFilter   = statusFilter !== "All";
  const activeCount = hasFilter ? 1 : 0;

  const handleToggle = useCallback(() => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelPos({
        top:   rect.bottom + window.scrollY + 8,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((v) => !v);
  }, [open]);

  useEffect(() => {
    if (open) {
      setPendingStatus(statusFilter);
    }
  }, [open]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function handleApply() {
    onStatusFilterChange(pendingStatus);
    setOpen(false);
  }

  function handleClear() {
    setPendingStatus("All");
    onStatusFilterChange("All");
    setOpen(false);
  }

  const STATUS_OPTIONS: (SupervisorStatus | "All")[] = ["All", "Active", "Inactive"];

  return (
    <div className="flex gap-3 items-center">
      {/* Search */}
      <SearchBar
        value={search}
        onChange={onSearchChange}
        placeholder="Search by name or email…"
      />

      {/* Filter button */}
      <div className="relative">
        <Button
          ref={buttonRef}
          variant="outline"
          className={cn(
            "h-[42px] rounded-xl border-slate-200 gap-2 px-4 font-medium text-sm transition-colors",
            hasFilter
              ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
              : "bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          )}
          onClick={handleToggle}
        >
          <TbFilter className="h-[15px] w-[15px] shrink-0" />
          <span>Filter</span>
          {activeCount > 0 && (
            <span className="flex items-center justify-center h-4.5 min-w-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold leading-none">
              {activeCount}
            </span>
          )}
          {hasFilter && (
            <span
              className="ml-0.5 flex items-center"
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
            >
              <X className="h-3.5 w-3.5 text-blue-500 hover:text-blue-700" />
            </span>
          )}
        </Button>
      </div>

      {/* Portal-rendered dropdown – escapes overflow-hidden ancestors */}
      {open && typeof window !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top:   panelPos.top,
            right: panelPos.right,
            zIndex: 9999,
            width: 288,
          }}
          className="bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-4"
        >
          {/* Status */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Status
            </p>
            <div className="flex gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setPendingStatus(s)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[12px] font-medium border transition-colors",
                    pendingStatus === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                  )}
                >
                  {s === "All" ? "All" : s}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              className="w-full h-9 text-[13px] font-bold bg-blue-600 hover:bg-blue-700 rounded-xl"
              onClick={handleApply}
            >
              Apply
            </Button>
            {(hasFilter || pendingStatus !== "All") && (
              <button
                onClick={handleClear}
                className="w-full text-[12px] text-slate-400 hover:text-slate-600 text-center"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

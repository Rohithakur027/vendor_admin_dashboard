"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";
import { TbFilter } from "react-icons/tb";
import { cn } from "@/lib/utils";
import type { SupervisorStatus } from "../types";

// ── helpers ──────────────────────────────────────────────────────────────────

function toYMD(d: Date) {
  return d.toISOString().split("T")[0];
}

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const WEEKDAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function formatLabel(from: string, to: string) {
  if (!from && !to) return "";
  const fmt = (s: string) =>
    new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

// ── Calendar ─────────────────────────────────────────────────────────────────

interface CalendarProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

function Calendar({ from, to, onChange }: CalendarProps) {
  const today = toYMD(new Date());

  const [viewYear, setViewYear] = useState(() => {
    if (from) return parseInt(from.split("-")[0]);
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (from) return parseInt(from.split("-")[1]) - 1;
    return new Date().getMonth();
  });
  const [hover, setHover] = useState<string | null>(null);
  const [stage, setStage] = useState<"start" | "end">(from && !to ? "end" : "start");

  useEffect(() => {
    if (!from && !to) setStage("start");
  }, [from, to]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function handleClick(d: string) {
    if (stage === "start") {
      onChange(d, "");
      setStage("end");
    } else {
      if (d < from) {
        onChange(d, from);
      } else {
        onChange(from, d);
      }
      setStage("start");
    }
  }

  function effectiveRange(): [string, string] {
    if (stage === "end" && from && hover) {
      const lo = hover < from ? hover : from;
      const hi = hover < from ? from : hover;
      return [lo, hi];
    }
    return [from, to];
  }

  const [rangeFrom, rangeTo] = effectiveRange();

  function isStart(d: string) { return d === rangeFrom && !!rangeFrom; }
  function isEnd(d: string)   { return d === rangeTo   && !!rangeTo;   }
  function inRange(d: string) {
    return !!rangeFrom && !!rangeTo && d > rangeFrom && d < rangeTo;
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();

  const cells: (string | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const m  = String(viewMonth + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push(`${viewYear}-${m}-${dd}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="select-none w-full">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[13px] font-bold text-slate-800">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] font-bold text-slate-400 py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((dateStr, idx) => {
          if (!dateStr) return <div key={idx} className="h-8" />;

          const start   = isStart(dateStr);
          const end     = isEnd(dateStr);
          const between = inRange(dateStr);
          const isToday = dateStr === today;
          const singleDay = rangeFrom === rangeTo && rangeFrom === dateStr;

          const hasRangeBar = (start || end || between) && rangeFrom && rangeTo && rangeFrom !== rangeTo;
          const barClasses = cn(
            "absolute inset-y-[6px] bg-blue-50",
            start   && !end   && "left-1/2 right-0",
            end     && !start && "left-0 right-1/2",
            between           && "left-0 right-0",
          );

          return (
            <div
              key={dateStr}
              className="relative flex items-center justify-center h-8"
              onMouseEnter={() => setHover(dateStr)}
              onMouseLeave={() => setHover(null)}
            >
              {hasRangeBar && <div className={barClasses} />}
              <button
                onClick={() => handleClick(dateStr)}
                className={cn(
                  "relative z-10 h-7 w-7 rounded-full text-[12px] flex items-center justify-center transition-colors font-medium",
                  (start || end || singleDay) && "bg-blue-600 text-white font-bold",
                  between && !start && !end   && "text-blue-700",
                  isToday && !start && !end && !between && "ring-1 ring-blue-400 text-blue-600 font-bold",
                  !start && !end && !between && !isToday && "text-slate-700 hover:bg-slate-100",
                )}
              >
                {parseInt(dateStr.split("-")[2])}
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400 text-center mt-2">
        {stage === "start"
          ? from && to ? `${formatLabel(from, to)} · Click to reset` : "Click to select start date"
          : "Click to select end date"
        }
      </p>
    </div>
  );
}

// ── Presets ───────────────────────────────────────────────────────────────────

type Preset = "today" | "yesterday" | "7days" | "all";

function presetRange(preset: Preset): [string, string] {
  const now = new Date();
  if (preset === "today") {
    const d = toYMD(now); return [d, d];
  }
  if (preset === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const d = toYMD(y); return [d, d];
  }
  if (preset === "7days") {
    const from = new Date(now); from.setDate(from.getDate() - 6);
    return [toYMD(from), toYMD(now)];
  }
  return ["", ""];
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today",     label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7days",     label: "Past 7 days" },
  { key: "all",       label: "All time" },
];

// ── Main component ────────────────────────────────────────────────────────────

interface SupervisorFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: SupervisorStatus | "All";
  onStatusFilterChange: (v: SupervisorStatus | "All") => void;
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
}

export function SupervisorFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  dateFrom,
  dateTo,
  onDateChange,
}: SupervisorFiltersProps) {
  const [open, setOpen]                 = useState(false);
  const [activePreset, setActivePreset]   = useState<Preset | null>(null);
  const [pendingFrom,   setPendingFrom]   = useState(dateFrom);
  const [pendingTo,     setPendingTo]     = useState(dateTo);
  const [pendingStatus, setPendingStatus] = useState<SupervisorStatus | "All">(statusFilter);
  const [panelPos, setPanelPos]           = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);

  const hasDate    = !!(dateFrom || dateTo);
  const hasFilter  = hasDate || statusFilter !== "All";
  const activeCount = (statusFilter !== "All" ? 1 : 0) + (hasDate ? 1 : 0);

  // Compute position when opening
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
      setPendingFrom(dateFrom);
      setPendingTo(dateTo);
      setPendingStatus(statusFilter);
      setActivePreset(null);
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

  function handlePreset(p: Preset) {
    const [from, to] = presetRange(p);
    setActivePreset(p);
    setPendingFrom(from);
    setPendingTo(to);
  }

  function handleCalendarChange(from: string, to: string) {
    setActivePreset(null);
    setPendingFrom(from);
    setPendingTo(to);
  }

  function handleApply() {
    onStatusFilterChange(pendingStatus);
    onDateChange(pendingFrom, pendingTo);
    setOpen(false);
  }

  function handleClear() {
    setPendingFrom("");
    setPendingTo("");
    setPendingStatus("All");
    setActivePreset(null);
    onStatusFilterChange("All");
    onDateChange("", "");
    setOpen(false);
  }

  const STATUS_OPTIONS: (SupervisorStatus | "All")[] = ["All", "Active", "Inactive"];

  return (
    <div className="flex gap-3 items-center">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email…"
          className="pl-9 h-[42px] rounded-xl border-slate-200"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

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

          <div className="border-t border-slate-100" />

          {/* Quick date presets */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Date Range
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePreset(p.key)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[12px] font-medium border transition-colors",
                    activePreset === p.key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              Custom Range
            </p>
            <Calendar
              from={pendingFrom}
              to={pendingTo}
              onChange={handleCalendarChange}
            />
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              className="w-full h-9 text-[13px] font-bold bg-blue-600 hover:bg-blue-700 rounded-xl"
              onClick={handleApply}
            >
              Apply
            </Button>
            {(hasFilter || pendingFrom || pendingStatus !== "All") && (
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

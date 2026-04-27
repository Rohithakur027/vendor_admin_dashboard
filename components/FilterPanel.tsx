"use client";

import { X } from "lucide-react";
import { TbFilter } from "react-icons/tb";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState, useCallback } from "react";

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  activeCount?: number;
  onClearAll?: () => void;
  children: React.ReactNode;
}

export function FilterPanel({
  open,
  onClose,
  activeCount = 0,
  onClearAll,
  children,
}: FilterPanelProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);

  const computePos = useCallback(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPanelPos({ top: r.top + 8, right: window.innerWidth - r.right });
    }
  }, []);

  useEffect(() => {
    if (open) {
      computePos();
      window.addEventListener("scroll", computePos, true);
      window.addEventListener("resize", computePos);
      return () => {
        window.removeEventListener("scroll", computePos, true);
        window.removeEventListener("resize", computePos);
      };
    } else {
      setPanelPos(null);
    }
  }, [open, computePos]);

  return (
    <>
      {/* Invisible anchor pinned to bottom-right of the parent relative container */}
      <span
        ref={anchorRef}
        aria-hidden
        style={{
          position: "absolute",
          right: 0,
          top: "100%",
          display: "block",
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
      />

      {open && panelPos && (
        <>
          {/* Click-away backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
            onClick={onClose}
          />
          {/* Panel — fixed so it is never clipped by overflow containers */}
          <div
            className="w-72 bg-white rounded-2xl shadow-xl border p-5 space-y-4"
            style={{
              position: "fixed",
              top: panelPos.top,
              right: panelPos.right,
              zIndex: 9999,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TbFilter className="h-4 w-4 text-foreground" />
                <span className="font-semibold text-sm">Filter</span>
                {activeCount > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
                    {activeCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeCount > 0 && onClearAll && (
                  <button
                    onClick={onClearAll}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Clear all
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="h-7 w-7 flex items-center justify-center rounded-full border hover:bg-gray-50 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {children}
          </div>
        </>
      )}
    </>
  );
}

export function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-gray-50/60 p-3 space-y-2.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

interface FilterPillProps {
  label: string;
  active: boolean;
  onClick: () => void;
  activeClass?: string;
}

export function FilterPill({
  label,
  active,
  onClick,
  activeClass = "bg-blue-600 text-white border-blue-600",
}: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
        active
          ? activeClass
          : "bg-white text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

interface FilterTriggerProps {
  onClick: () => void;
  activeCount?: number;
}

export function FilterTrigger({ onClick, activeCount = 0 }: FilterTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium transition-colors",
        activeCount > 0
          ? "border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100"
          : "border-border bg-white text-muted-foreground hover:text-foreground hover:border-foreground/30"
      )}
    >
      <TbFilter className="h-4 w-4" />
      Filter
      {activeCount > 0 && (
        <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none">
          {activeCount}
        </span>
      )}
    </button>
  );
}

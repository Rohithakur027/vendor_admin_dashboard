"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, GripVertical } from "lucide-react";
import { TbFilter } from "react-icons/tb";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  activeCount?: number;
  onClearAll?: () => void;
  onApply?: () => void;
  onCancel?: () => void;
  children: React.ReactNode;
  panelClassName?: string;
}

export function FilterPanel({
  open,
  onClose,
  activeCount = 0,
  onClearAll,
  onApply,
  onCancel,
  children,
  panelClassName,
}: FilterPanelProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);

  // Initial anchor-relative position (top + right)
  const [anchorPos, setAnchorPos] = useState<{ top: number; right: number } | null>(null);
  // Drag-override position (top + left, takes over once user drags)
  const [dragPos, setDragPos]     = useState<{ top: number; left: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);

  const computeAnchorPos = useCallback(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setAnchorPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
  }, []);

  useEffect(() => {
    if (open) {
      setDragPos(null); // reset drag position on each open
      computeAnchorPos();
      window.addEventListener("scroll", computeAnchorPos, true);
      window.addEventListener("resize",  computeAnchorPos);
      return () => {
        window.removeEventListener("scroll", computeAnchorPos, true);
        window.removeEventListener("resize",  computeAnchorPos);
      };
    } else {
      setAnchorPos(null);
      setDragPos(null);
    }
  }, [open, computeAnchorPos]);

  // Pointer events + setPointerCapture are far more reliable than mouse
  // events: they continue firing even if the pointer leaves the header,
  // and they work uniformly for mouse, touch, and pen.
  function handleHeaderPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if ((e.target as HTMLElement).closest("button")) return;
    if (!panelRef.current) return;

    const rect = panelRef.current.getBoundingClientRect();
    dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
    // Route every subsequent pointer event to this element — drag survives
    // fast cursor movement, leaving the header, hovering over iframes, etc.
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function handleHeaderPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragOffsetRef.current || !panelRef.current) return;
    const panelW = panelRef.current.offsetWidth;
    const panelH = panelRef.current.offsetHeight;
    const left = Math.max(0, Math.min(window.innerWidth  - panelW, e.clientX - dragOffsetRef.current.x));
    const top  = Math.max(0, Math.min(window.innerHeight - panelH, e.clientY - dragOffsetRef.current.y));
    setDragPos({ top, left });
  }

  function handleHeaderPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    dragOffsetRef.current = null;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  const portalContent = open && anchorPos
    ? createPortal(
        <>
          {/* Click-away backdrop — only when NOT dragging */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9998 }}
            onClick={onClose}
          />

          {/* Panel */}
          <div
            ref={panelRef}
            className={cn("bg-white rounded-2xl shadow-xl border flex flex-col", panelClassName ?? "w-72")}
            style={{
              position: "fixed",
              zIndex: 9999,
              maxHeight: "85vh",
              ...(dragPos
                ? { top: dragPos.top, left: dragPos.left }
                : { top: anchorPos.top, right: anchorPos.right }),
            }}
            // Stop backdrop click when interacting inside the panel
            onClick={e => e.stopPropagation()}
          >
            {/* ── Drag handle / header ── */}
            <div
              className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0"
              onPointerDown={handleHeaderPointerDown}
              onPointerMove={handleHeaderPointerMove}
              onPointerUp={handleHeaderPointerUp}
              onPointerCancel={handleHeaderPointerUp}
              style={{
                cursor: isDragging ? "grabbing" : "grab",
                touchAction: "none",  // stop the browser from scroll-stealing the gesture on touch
                userSelect: "none",
              }}
            >
              <div className="flex items-center gap-2 select-none">
                <GripVertical className="h-3.5 w-3.5 text-slate-300" />
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
                  onClick={onCancel ?? onClose}
                  className="h-7 w-7 flex items-center justify-center rounded-full border hover:bg-gray-50 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* ── Scrollable content ── */}
            <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-4">
              {children}
            </div>

            {/* ── Sticky footer ── */}
            {onApply && (
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t shrink-0">
                <button
                  onClick={onCancel ?? onClose}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold border bg-white text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onApply}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </>,
        document.body
      )
    : null;

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
      {portalContent}
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

export const FilterTrigger = React.forwardRef<HTMLButtonElement, FilterTriggerProps>(
  function FilterTrigger({ onClick, activeCount = 0 }, ref) {
    return (
      <button
        ref={ref}
        onClick={onClick}
        className={cn(
          "relative flex items-center gap-2 h-[42px] px-4 rounded-xl border font-semibold text-[13px] shadow-sm transition-colors",
          activeCount > 0
            ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        )}
      >
        <TbFilter className="h-[15px] w-[15px] shrink-0" />
        Filter
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-blue-600 text-[10px] font-bold text-white flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>
    );
  }
);

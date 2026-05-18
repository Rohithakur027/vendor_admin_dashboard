"use client";

import React, { Fragment } from "react";
import { useRouter } from "next/navigation";
import type { Supervisor } from "../types";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

const EM_DASH = "—";

function formatPhone(raw: string): string {
  if (!raw) return raw;
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length > 10 ? digits.slice(2) : digits;
  return `+91 ${local}`;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return EM_DASH;
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return EM_DASH; }
}

const MockSeparator = () => (
  <div className="flex items-center gap-2.5 px-6 py-1.5 bg-amber-50 border-y border-dashed border-amber-200">
    <div className="flex-1 h-px bg-amber-200" />
    <span className="text-[9.5px] font-bold text-amber-600 tracking-widest uppercase whitespace-nowrap">Sample Data</span>
    <div className="flex-1 h-px bg-amber-200" />
  </div>
);

const RENDERERS: Record<string, {
  body:     (s: Supervisor) => React.ReactNode;
  skeleton: () => React.ReactNode;
}> = {
  ref: {
    body:     (s) => s.ref
      ? <span className="text-[13px] font-mono text-slate-500 truncate block">{s.ref}</span>
      : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>,
    skeleton: () => <Skeleton className="h-3.5 w-20" />,
  },
  name: {
    body:     (s) => (
      <div className="flex flex-col min-w-0">
        <span className="font-extrabold text-[#111827] text-[13px] truncate">{s.name}</span>
        {s.ref && <span className="text-[11px] text-slate-400 font-medium truncate">{s.ref}</span>}
      </div>
    ),
    skeleton: () => (<div className="space-y-1.5 min-w-0"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-20" /></div>),
  },
  email: {
    body:     (s) => <span className="text-[13px] text-slate-600 font-medium truncate block">{s.email}</span>,
    skeleton: () => <Skeleton className="h-3.5 w-40" />,
  },
  phone: {
    body:     (s) => <span className="text-[13px] text-slate-600 font-medium">{formatPhone(s.phone)}</span>,
    skeleton: () => <Skeleton className="h-3.5 w-28" />,
  },
  zone: {
    body:     (s) => s.zone
      ? <span className="text-[13px] text-slate-600 truncate block">{s.zone}</span>
      : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>,
    skeleton: () => <Skeleton className="h-3.5 w-20" />,
  },
  status: {
    body:     (s) => <StatusBadge status={s.status === "Active" ? "Active" : "Inactive"} size="sm" />,
    skeleton: () => <Skeleton className="h-6 w-16 rounded-full" />,
  },
  lastSeen: {
    body:     (_s) => <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>,
    skeleton: () => <Skeleton className="h-3.5 w-20" />,
  },
  walletUsed: {
    body:     (s) => s.walletUsed != null
      ? <span className="text-[13px] font-semibold text-slate-700 tabular-nums">₹{Number(s.walletUsed).toLocaleString("en-IN")}</span>
      : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>,
    skeleton: () => <Skeleton className="h-3.5 w-20" />,
  },
  createdAt: {
    body:     (s) => <span className="text-[13px] text-slate-600">{formatDate(s.createdAt)}</span>,
    skeleton: () => <Skeleton className="h-3.5 w-24" />,
  },
};

interface Props {
  supervisors:    Supervisor[];
  onEdit:         (supervisor: Supervisor) => void;
  onDelete:       (id: string) => void;
  splitAt?:       number;
  loading?:       boolean;
  visibleCols:    string[];
  gridTemplate:   string;
  minTableWidth:  number;
  prefsLoading?:  boolean;
}

export function SupervisorTable({
  supervisors, onEdit: _onEdit, onDelete: _onDelete,
  splitAt, loading, visibleCols, gridTemplate, minTableWidth, prefsLoading,
}: Props) {
  const router = useRouter();

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="w-full overflow-x-auto">
        <div className="w-fit min-w-full" style={{ minWidth: minTableWidth }}>
          {/* Header */}
          <div
            className="grid items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-[2] backdrop-blur"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {prefsLoading
              ? Array.from({ length: visibleCols.length }).map((_, i) => (
                  <Skeleton key={i} className={`h-3 ${i === 0 ? "w-24" : "w-16"}`} />
                ))
              : visibleCols.map((k, i) => {
                  const stickyStyle = i === 0
                    ? { position: "sticky" as const, left: 0, background: "rgb(248 250 252 / 0.95)", zIndex: 3 }
                    : undefined;
                  const label = ({
                    ref: "Ref", name: "Supervisor", email: "Email", phone: "Phone",
                    zone: "Zone", status: "Status", lastSeen: "Last Active",
                    walletUsed: "Wallet Used", createdAt: "Joined On",
                  } as Record<string, string>)[k] ?? k;
                  return (
                    <div key={k} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate" style={stickyStyle}>
                      {label}
                    </div>
                  );
                })}
          </div>

          {/* Body */}
          <div className="flex flex-col divide-y divide-slate-100">
            {(loading || prefsLoading) ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid items-center gap-4 px-6 py-3.5" style={{ gridTemplateColumns: gridTemplate }}>
                  {visibleCols.map((k, j) => {
                    const r = RENDERERS[k];
                    const stickyStyle = j === 0 ? { position: "sticky" as const, left: 0, background: "white", zIndex: 1 } : undefined;
                    return <div key={k} style={stickyStyle} className="min-w-0">{r?.skeleton() ?? <Skeleton className="h-3.5 w-20" />}</div>;
                  })}
                </div>
              ))
            ) : supervisors.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-sm font-medium">No supervisors found.</p>
              </div>
            ) : (
              supervisors.map((sup, idx) => (
                <Fragment key={sup.id}>
                  {splitAt !== undefined && idx === splitAt && splitAt > 0 && splitAt < supervisors.length && <MockSeparator />}
                  <div
                    onClick={() => router.push(`/dashboard/supervisors/${sup.id}`)}
                    className="grid items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {visibleCols.map((k, j) => {
                      const r = RENDERERS[k];
                      const stickyStyle = j === 0 ? { position: "sticky" as const, left: 0, background: "white", zIndex: 1 } : undefined;
                      return (
                        <div key={k} style={stickyStyle} className="min-w-0">
                          {r ? r.body(sup) : <span className="text-[13px] text-slate-300 italic">—</span>}
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

"use client";

import React, { Fragment } from "react";
import { useRouter } from "next/navigation";
import type { Driver } from "../types";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

const EM_DASH = "—";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const MockSeparator = () => (
  <div className="flex items-center gap-2.5 px-6 py-1.5 bg-amber-50 border-y border-dashed border-amber-200">
    <div className="flex-1 h-px bg-amber-200" />
    <span className="text-[9.5px] font-bold text-amber-600 tracking-widest uppercase whitespace-nowrap">Sample Data</span>
    <div className="flex-1 h-px bg-amber-200" />
  </div>
);

const RENDERERS: Record<string, {
  body:     (d: Driver) => React.ReactNode;
  skeleton: () => React.ReactNode;
}> = {
  name: {
    body:     (d) => (
      <div className="flex flex-col min-w-0">
        <span className="font-extrabold text-[#111827] text-[13px] truncate">{d.name}</span>
        <span className="text-[11px] text-slate-400 font-medium truncate">{d.driverRef ?? d.id.slice(0, 8)}</span>
      </div>
    ),
    skeleton: () => (<div className="space-y-1.5 min-w-0"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-20" /></div>),
  },
  phone: {
    body:     (d) => <span className="text-[13px] text-slate-600 font-medium">{d.phone}</span>,
    skeleton: () => <Skeleton className="h-3.5 w-24" />,
  },
  status: {
    body:     (d) => <StatusBadge status={d.status} size="sm" />,
    skeleton: () => <Skeleton className="h-6 w-20 rounded-full" />,
  },
  supervisor: {
    body:     (d) => d.assignedSupervisorName
      ? <span className="text-[13px] font-medium text-slate-600 truncate block">{d.assignedSupervisorName}</span>
      : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>,
    skeleton: () => <Skeleton className="h-3.5 w-32" />,
  },
  totalTrips: {
    body:     (d) => (
      <span className={`text-[14px] font-bold ${d.totalTrips === 0 ? "text-slate-300" : "text-slate-800"}`}>
        {d.totalTrips}
      </span>
    ),
    skeleton: () => <Skeleton className="h-3.5 w-8" />,
  },
  lastSeen: {
    body:     (d) => <span className="text-[13px] text-slate-500 font-medium">{timeAgo(d.lastActive)}</span>,
    skeleton: () => <Skeleton className="h-3.5 w-16" />,
  },
  vehicle: {
    body:     (d) => {
      if (!d.vehicleReg && !d.vehicle) return <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      return (
        <div className="flex flex-col gap-px min-w-0">
          <span className="text-[13px] font-medium text-slate-600 truncate">{d.vehicleReg || d.vehicle}</span>
          {d.vehicleReg && d.vehicle && <span className="text-[11px] text-slate-500 truncate">{d.vehicle}</span>}
        </div>
      );
    },
    skeleton: () => (<div className="space-y-1.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3 w-16" /></div>),
  },
  ref: {
    body:     (d) => d.driverRef
      ? <span className="text-[13px] font-mono text-slate-500 truncate block">{d.driverRef}</span>
      : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>,
    skeleton: () => <Skeleton className="h-3.5 w-20" />,
  },
};

interface DriverTableProps {
  drivers:       Driver[];
  splitAt?:      number;
  loading?:      boolean;
  visibleCols:   string[];
  gridTemplate:  string;
  minTableWidth: number;
  prefsLoading?: boolean;
}

export function DriverTable({ drivers, splitAt, loading, visibleCols, gridTemplate, minTableWidth, prefsLoading }: DriverTableProps) {
  const router = useRouter();

  const COL_LABELS: Record<string, string> = {
    name: "Driver", phone: "Phone", status: "Status", supervisor: "Supervisor",
    totalTrips: "Trips", lastSeen: "Last Active", vehicle: "Vehicle", ref: "Driver Ref",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="w-full overflow-x-auto">
        <div style={{ minWidth: minTableWidth }}>
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
                  return (
                    <div key={k} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate" style={stickyStyle}>
                      {COL_LABELS[k] ?? k}
                    </div>
                  );
                })}
          </div>

          {/* Body */}
          <div className="flex flex-col divide-y divide-slate-100">
            {(loading || prefsLoading) ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid items-center gap-4 px-6 py-3.5" style={{ gridTemplateColumns: gridTemplate }}>
                  {visibleCols.map((k, j) => {
                    const r = RENDERERS[k];
                    const stickyStyle = j === 0 ? { position: "sticky" as const, left: 0, background: "white", zIndex: 1 } : undefined;
                    return <div key={k} style={stickyStyle} className="min-w-0">{r?.skeleton() ?? <Skeleton className="h-3.5 w-20" />}</div>;
                  })}
                </div>
              ))
            ) : drivers.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-sm font-medium">No drivers found.</p>
              </div>
            ) : (
              drivers.map((driver, idx) => (
                <Fragment key={driver.id}>
                  {splitAt !== undefined && idx === splitAt && splitAt > 0 && splitAt < drivers.length && <MockSeparator />}
                  <div
                    onClick={() => router.push(`/dashboard/drivers/${driver.id}`)}
                    className="grid items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {visibleCols.map((k, j) => {
                      const r = RENDERERS[k];
                      const stickyStyle = j === 0 ? { position: "sticky" as const, left: 0, background: "white", zIndex: 1 } : undefined;
                      return (
                        <div key={k} style={stickyStyle} className="min-w-0">
                          {r ? r.body(driver) : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>}
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

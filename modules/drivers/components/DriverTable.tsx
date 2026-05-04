"use client";

import { Fragment } from "react";
import { useRouter } from "next/navigation";
import type { Driver } from "../types";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

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

interface DriverTableProps {
  drivers: Driver[];
  splitAt?: number;
  loading?: boolean;
}

export function DriverTable({ drivers, splitAt, loading }: DriverTableProps) {
  const router = useRouter();

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="w-full overflow-x-auto">
        <div className="min-w-[860px]">

          {/* Header */}
          <div className="grid grid-cols-[minmax(0,2fr)_130px_130px_minmax(0,1.6fr)_100px_120px] items-center gap-6 px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DRIVER</div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PHONE</div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">STATUS</div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SUPERVISOR</div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TRIPS</div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">LAST ACTIVE</div>
          </div>

          {/* Rows */}
          <div className="flex flex-col divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,2fr)_130px_130px_minmax(0,1.6fr)_100px_120px] items-center gap-6 px-6 py-3.5">
                  <div className="space-y-1.5 min-w-0">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3.5 w-8" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
              ))
            ) : drivers.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-sm font-medium">No drivers found.</p>
              </div>
            ) : (
              drivers.map((driver, idx) => {
                return (
                  <Fragment key={driver.id}>
                    {splitAt !== undefined && idx === splitAt && splitAt > 0 && splitAt < drivers.length && (
                      <MockSeparator />
                    )}
                  <div
                    onClick={() => router.push(`/dashboard/drivers/${driver.id}`)}
                    className="grid grid-cols-[minmax(0,2fr)_130px_130px_minmax(0,1.6fr)_100px_120px] items-center gap-6 px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {/* Driver name + id */}
                    <div className="flex flex-col min-w-0">
                      <span className="font-extrabold text-[#111827] text-[13px] truncate">{driver.name}</span>
                      <span className="text-[11px] text-slate-400 font-medium truncate">{driver.id}</span>
                    </div>

                    {/* Phone */}
                    <div>
                      <span className="text-[13px] text-slate-600 font-medium">{driver.phone}</span>
                    </div>

                    {/* Status */}
                    <div>
                      <StatusBadge status={driver.status} size="sm" />
                    </div>

                    {/* Supervisor */}
                    <div className="min-w-0">
                      <span className={`text-[13px] font-medium truncate ${driver.assignedSupervisorName ? "text-slate-600" : "text-slate-300"}`}>
                        {driver.assignedSupervisorName ?? "—"}
                      </span>
                    </div>

                    {/* Trips */}
                    <div>
                      <span className={`text-[14px] font-bold ${driver.totalTrips === 0 ? "text-slate-300" : "text-slate-800"}`}>
                        {driver.totalTrips}
                      </span>
                    </div>

                    {/* Last Active */}
                    <div>
                      <span className="text-[13px] text-slate-500 font-medium">{timeAgo(driver.lastActive)}</span>
                    </div>
                  </div>
                  </Fragment>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

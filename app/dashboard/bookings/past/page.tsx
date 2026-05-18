"use client";

import React, { useMemo, useState, Fragment } from "react";
import { useVendor } from "@/context/VendorContext";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";
import { StatusBadge } from "@/components/StatusBadge";
import { SearchBar } from "@/components/SearchBar";
import { TripDateFilter, type TripPeriod } from "@/components/TripDateFilter";
import { toIsoDate } from "@/modules/reports/primitives";
import { Skeleton, SkeletonInline } from "@/components/ui/skeleton";
import type { Booking } from "@/modules/bookings/types";
import { ExportButton } from "@/components/ExportButton";
import { exportToCsv } from "@/lib/exportCsv";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";
import { buildTripRenderers, EM_DASH } from "@/modules/bookings/tripRenderers";

const TABLE_KEY = "pastTrips" as const;

function MockSeparator() {
  return (
    <div className="flex items-center gap-2.5 px-6 py-1.5 bg-amber-50 border-y border-dashed border-amber-200">
      <div className="flex-1 h-px bg-amber-200" />
      <span className="text-[9.5px] font-bold text-amber-600 tracking-widest uppercase whitespace-nowrap">Sample Data</span>
      <div className="flex-1 h-px bg-amber-200" />
    </div>
  );
}

export default function PastBookingsPage() {
  const { bookings, supervisors, drivers, isLoading, apiCounts } = useVendor();
  const { columns: visibleCols, toggle, reset, totalCount, loading: prefsLoading } = useColumnPreferences(TABLE_KEY);
  const spec = getTableSpec(TABLE_KEY);

  const [search,           setSearch]           = useState("");
  const [selectedBooking,  setSelectedBooking]  = useState<Booking | null>(null);
  const [period,   setPeriod]   = useState<TripPeriod>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");

  const pastBookings = bookings.filter(b => b.status === "Completed");

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const filtered = pastBookings
    .filter(b => {
      if (period === "custom") {
        const d = b.createdAt ? toIsoDate(new Date(b.createdAt)) : "";
        if (!d || d < dateFrom || d > dateTo) return false;
      } else if (period !== "all") {
        const d = new Date(b.createdAt);
        if (period === "today"  && d < startOfToday) return false;
        if (period === "7days"  && d < new Date(now.getTime() - 7  * 86400_000)) return false;
        if (period === "30days" && d < new Date(now.getTime() - 30 * 86400_000)) return false;
      }

      const q = search.toLowerCase();
      if (!q) return true;
      const driver = b.driverId ? drivers.find(d => d.id === b.driverId) : null;
      const driverName  = driver?.name || "";
      const driverPhone = (b.driverPhone ?? driver?.phone ?? "").toLowerCase();
      const vehicleModel = driver?.vehicle || "";
      const vehicleReg   = driver?.vehicleReg || "";
      const companyName  = b.bookingSource || "";
      const supervisorName = supervisors.find(s => s.id === b.supervisorId)?.name || "";

      return (
        b.id.toLowerCase().includes(q) ||
        (b.bookingRef?.toLowerCase().includes(q) ?? false) ||
        b.pickupLocation.toLowerCase().includes(q) ||
        b.dropLocation.toLowerCase().includes(q) ||
        driverName.toLowerCase().includes(q) ||
        driverPhone.includes(q) ||
        vehicleModel.toLowerCase().includes(q) ||
        vehicleReg.toLowerCase().replace(/\s+/g, "").includes(q.replace(/\s+/g, "")) ||
        companyName.toLowerCase().includes(q) ||
        supervisorName.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const apiInFiltered = filtered.filter((b) => {
    const idx = bookings.findIndex((x) => x.id === b.id);
    return idx < apiCounts.bookings;
  }).length;
  const splitAt = apiInFiltered > 0 && apiInFiltered < filtered.length ? apiInFiltered : -1;

  const supervisorName = (id: string | null | undefined) =>
    supervisors.find(s => s.id === id)?.name || "Unknown";

  const driverFor = (b: Booking) => {
    const driver = b.driverId ? drivers.find(d => d.id === b.driverId) : null;
    return {
      name:        driver?.name ?? null,
      vehicle:     driver?.vehicle ?? null,
      vehicleReg:  driver?.vehicleReg ?? null,
      vehicleType: driver?.vehicleType ?? null,
      phone:       b.driverPhone ?? driver?.phone ?? null,
    };
  };

  const renderers = useMemo(
    () => buildTripRenderers(supervisorName, driverFor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supervisors, drivers],
  );

  // Compute the grid-template-columns string from visible columns + their minWidths.
  const gridTemplate = useMemo(() => {
    return visibleCols
      .map(key => {
        const col = spec.columns.find(c => c.key === key);
        return col ? `minmax(${col.minWidth}px, 1fr)` : "1fr";
      })
      .join(" ");
  }, [visibleCols, spec.columns]);

  const minTableWidth = useMemo(
    () => visibleCols.reduce((sum, k) => sum + (spec.columns.find(c => c.key === k)?.minWidth ?? 100), 0) + 48,
    [visibleCols, spec.columns],
  );

  function handleExport() {
    const rows = filtered.map(b => {
      const out: Record<string, string | number> = {};
      for (const k of visibleCols) {
        const col = spec.columns.find(c => c.key === k);
        if (!col) continue;

        if (k === "tripId") {
          out["Trip ID"]   = b.bookingRef ?? "";
          out["Trip Type"] = b.type ?? "";
          continue;
        }
        if (k === "route") {
          out["Pickup Address"]      = b.pickupLocation;
          out["Destination Address"] = b.dropLocation;
          continue;
        }
        if (k === "supervisorCompany") {
          out["Supervisor"] = supervisorName(b.supervisorId);
          out["Company"]    = b.bookingSource ?? "";
          continue;
        }
        if (k === "vehicle") {
          const d = driverFor(b);
          out["Vehicle Reg"]   = d.vehicleReg ?? "";
          out["Vehicle Model"] = d.vehicle    ?? "";
          continue;
        }

        const r = (renderers as Record<string, { csv: (b: Booking) => string | number }>)[k];
        out[col.label] = r ? r.csv(b) : "";
      }
      return out;
    });
    exportToCsv("past-trips", rows);
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-slate-800">Past Trips</h2>
          <p className="text-[13px] text-slate-400 font-medium mt-0.5">
            {isLoading ? <SkeletonInline className="h-3 w-28" /> : <>{filtered.length} of {pastBookings.length} trips</>}
          </p>
        </div>
        {!isLoading && <StatusBadge status="Completed" label={`${pastBookings.length} completed`} />}
      </div>

      <div className="space-y-5">
        {/* Toolbar: search, date, columns popover, export */}
        <div className="flex gap-3 items-center flex-wrap">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by ID, route, name, vehicle, company..." />

          <TripDateFilter
            period={period}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onChangePeriod={setPeriod}
            onApplyCustom={(f, t) => { setDateFrom(f); setDateTo(t); }}
            direction="past"
          />

          <ColumnsPopover
            tableKey={TABLE_KEY}
            visible={visibleCols}
            totalCount={totalCount}
            onToggle={toggle}
            onReset={reset}
          />

          <ExportButton onClick={handleExport} disabled={isLoading || filtered.length === 0} className="ml-auto" />
        </div>

        {/* TABLE */}
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
                      const col = spec.columns.find(c => c.key === k);
                      if (!col) return null;
                      const headerClass = "text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate";
                      // Sticky first column
                      const stickyStyle = i === 0
                        ? { position: "sticky" as const, left: 0, background: "rgb(248 250 252 / 0.95)", zIndex: 3 }
                        : undefined;
                      return (
                        <div key={k} className={headerClass} style={stickyStyle} title={col.label}>
                          {col.label}
                        </div>
                      );
                    })}
              </div>

              {/* Body */}
              <div className="flex flex-col divide-y divide-slate-100">
                {(isLoading || prefsLoading) ? (
                  Array.from({ length: 7 }).map((_, i) => (
                    <div key={i}
                      className="grid items-center gap-4 px-6 py-3.5 bg-white"
                      style={{ gridTemplateColumns: gridTemplate }}
                    >
                      {visibleCols.map((k, j) => {
                        const r = (renderers as Record<string, { skeleton: () => React.JSX.Element }>)[k];
                        const stickyStyle = j === 0
                          ? { position: "sticky" as const, left: 0, background: "white", zIndex: 1 }
                          : undefined;
                        return <div key={k} style={stickyStyle} className="min-w-0">{r?.skeleton() ?? <Skeleton className="h-3.5 w-14" />}</div>;
                      })}
                    </div>
                  ))
                ) : filtered.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">No past trips found.</div>
                ) : (
                  filtered.map((booking, idx) => (
                    <Fragment key={booking.id}>
                      {idx === splitAt && <MockSeparator />}
                      <div
                        className="grid items-center gap-4 px-6 py-3.5 bg-white hover:bg-slate-50 transition-colors cursor-pointer group"
                        style={{ gridTemplateColumns: gridTemplate }}
                        onClick={() => setSelectedBooking(booking)}
                      >
                        {visibleCols.map((k, j) => {
                          const r = (renderers as Record<string, { body: (b: Booking) => React.ReactNode }>)[k];
                          const stickyStyle = j === 0
                            ? { position: "sticky" as const, left: 0, background: "inherit", zIndex: 1 }
                            : undefined;
                          return (
                            <div key={k} style={stickyStyle} className="min-w-0">
                              {r ? r.body(booking) : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>}
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
      </div>

      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
    </div>
  );
}

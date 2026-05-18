"use client";

import React, { useMemo, useState } from "react";
import { useVendor } from "@/context/VendorContext";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";
import { StatusBadge } from "@/components/StatusBadge";
import { SearchBar } from "@/components/SearchBar";
import { TripDateFilter, type TripPeriod } from "@/components/TripDateFilter";
import { toIsoDate } from "@/modules/reports/primitives";
import { SkeletonInline } from "@/components/ui/skeleton";
import type { Booking } from "@/modules/bookings/types";
import { ExportButton } from "@/components/ExportButton";
import { exportToCsv } from "@/lib/exportCsv";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";
import { buildTripRenderers } from "@/modules/bookings/tripRenderers";
import { TripsTable } from "@/modules/bookings/components/TripsTable";

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

        <TripsTable
          items={filtered}
          visibleCols={visibleCols}
          renderers={renderers}
          tableKey={TABLE_KEY}
          isLoading={isLoading}
          prefsLoading={prefsLoading}
          onRowClick={setSelectedBooking}
          splitAt={splitAt}
          separator={<MockSeparator />}
          emptyMessage="No past trips found."
        />
      </div>

      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
    </div>
  );
}

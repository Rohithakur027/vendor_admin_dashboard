"use client";

import { useState, Fragment } from "react";
import { useVendor } from "@/context/VendorContext";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowRight } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { Skeleton, SkeletonInline } from "@/components/ui/skeleton";
import type { Booking } from "@/modules/bookings/types";
import { DateRangePicker } from "@/modules/reports/DateRangePicker";
import { toIsoDate } from "@/modules/reports/primitives";

function formatDateStrings(iso: string) {
  try {
    const d = new Date(iso);
    const day  = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toLowerCase();
    return { day, time };
  } catch {
    return { day: "Unknown", time: "00:00 am" };
  }
}

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

  const [search,           setSearch]           = useState("");
  const [selectedBooking,  setSelectedBooking]  = useState<Booking | null>(null);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return toIsoDate(d); });
  const [dateTo,   setDateTo]   = useState(() => toIsoDate(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const pastBookings = bookings.filter(b => b.status === "Completed");

  // Preserve the pre-sort order to track split. We sort after filtering.
  const filtered = pastBookings
    .filter(b => {
      // Filter by booking creation time falling in [dateFrom, dateTo] inclusive.
      const created = b.createdAt ? toIsoDate(new Date(b.createdAt)) : "";
      const matchDate = !created || (created >= dateFrom && created <= dateTo);
      if (!matchDate) return false;

      const q = search.toLowerCase();
      if (!q) return true;
      const driver = b.driverId ? drivers.find(d => d.id === b.driverId) : null;
      const driverName = driver?.name || "";
      const driverPhone = (b.driverPhone ?? driver?.phone ?? "").toLowerCase();
      const vehicleModel = driver?.vehicle || "";
      const vehicleReg   = driver?.vehicleReg || "";
      const companyName = b.bookingSource || "";
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

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-slate-800">Past Trips</h2>
          <p className="text-[13px] text-slate-400 font-medium mt-0.5">
            {isLoading ? (
              <SkeletonInline className="h-3 w-28" />
            ) : (
              <>{filtered.length} of {pastBookings.length} trips</>
            )}
          </p>
        </div>
        {!isLoading && <StatusBadge status="Completed" label={`${pastBookings.length} completed`} />}
      </div>

      {/* SEARCH AND FILTER */}
      <div className="flex flex-wrap gap-3 items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by ID, route, name, vehicle, company..."
        />

        <div className="relative shrink-0">
          <button
            onClick={() => setShowDatePicker((v) => !v)}
            className="inline-flex items-center gap-2 h-[42px] px-4 bg-white border-[1.5px] border-slate-200 rounded-xl text-[13px] text-slate-600 font-medium hover:border-slate-300 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 3v4M16 3v4" />
            </svg>
            {`${new Date(dateFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} — ${new Date(dateTo).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 4l3 3 3-3" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          {showDatePicker && (
            <DateRangePicker
              from={dateFrom}
              to={dateTo}
              onApply={(f, t) => { setDateFrom(f); setDateTo(t); }}
              onClose={() => setShowDatePicker(false)}
            />
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[100px_2fr_150px_1.3fr_1.3fr_110px_90px] items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
              {["TRIP ID & TYPE", "ROUTE", "SUPERVISOR", "VEHICLE", "DRIVER", "STATUS", "CREATED AT"].map(h => (
                <div key={h} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</div>
              ))}
            </div>

            <div className="flex flex-col divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[100px_2fr_150px_1.3fr_1.3fr_110px_90px] items-center gap-4 px-6 py-3.5">
                    <div className="space-y-2">
                      <Skeleton className="h-3.5 w-16" />
                      <Skeleton className="h-4 w-12 rounded" />
                    </div>
                    <div className="space-y-1.5 pr-4">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-2 w-16" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3.5 w-14" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No past trips found.</div>
              ) : (
                filtered.map((booking, idx) => {
                  const { day, time }    = formatDateStrings(booking.createdAt);
                  const supervisorName   = supervisors.find(s => s.id === booking.supervisorId)?.name || "Unknown";
                  const driver           = booking.driverId ? drivers.find(d => d.id === booking.driverId) : null;
                  const driverName       = driver ? (driver.name || "Unknown") : null;
                  const vehicle          = driver?.vehicle ?? null;
                  const vehicleReg       = driver?.vehicleReg ?? null;

                  return (
                    <Fragment key={booking.id}>
                      {idx === splitAt && <MockSeparator />}
                    <div
                      className="grid grid-cols-[100px_2fr_150px_1.3fr_1.3fr_110px_90px] items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-extrabold text-[#111827] text-[13px]">{booking.bookingRef ?? "—"}</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#eef2ff] text-blue-600 text-[10px] font-bold ring-1 ring-inset ring-blue-100/50">
                          {booking.type}
                        </span>
                      </div>

                      <div className="flex flex-col min-w-0 pr-4 gap-px">
                        <span className="font-semibold text-[13px] text-slate-800 leading-tight truncate">
                          {booking.pickupLocation.split(",")[0]}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="w-14 h-[2px] rounded-full" style={{ background: "linear-gradient(to right, #A5B4FC, #2563EB)" }} />
                          <ArrowRight className="h-3 w-3 text-blue-600 shrink-0" />
                        </div>
                        <span className="text-[12px] text-gray-500 truncate">
                          {booking.dropLocation.split(",")[0]}
                        </span>
                      </div>

                      {/* SUPERVISOR */}
                      <div className="flex flex-col items-start gap-1">
                        <span className="text-[13px] font-medium text-slate-600 truncate">{supervisorName}</span>
                        {booking.bookingSource && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-semibold truncate max-w-[110px]">
                            {booking.bookingSource}
                          </span>
                        )}
                      </div>

                      {/* VEHICLE */}
                      <div className="flex flex-col gap-px min-w-0">
                        {driverName ? (
                          <>
                            <span className="text-[13px] font-medium text-slate-600 truncate">{vehicleReg || vehicle || "Unknown"}</span>
                            {vehicleReg && vehicle && (
                              <span className="text-[11px] font-semibold text-slate-500 truncate">{vehicle}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-[13px] text-slate-300 font-medium italic">—</span>
                        )}
                      </div>

                      {/* DRIVER */}
                      <div className="flex flex-col gap-px min-w-0">
                        {driverName ? (
                          <span className="text-[13px] font-medium text-slate-600 truncate">{driverName}</span>
                        ) : (
                          <span className="text-[13px] text-slate-300 font-medium italic">—</span>
                        )}
                      </div>

                      <div>
                        <StatusBadge status="Completed" size="sm" />
                      </div>

                      <div className="flex flex-col text-left">
                        <span className="text-[13px] font-medium text-slate-700">{day}</span>
                        <span className="text-[11px] text-slate-400 font-medium mt-0.5">{time}</span>
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

      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
    </div>
  );
}

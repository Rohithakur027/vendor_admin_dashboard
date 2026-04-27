"use client";

import { useState, Fragment } from "react";
import { useVendor } from "@/context/VendorContext";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  FilterPanel,
  FilterSection,
  FilterPill,
} from "@/components/FilterPanel";
import { Search, Car, ArrowRight } from "lucide-react";
import { TbFilter } from "react-icons/tb";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";
import { Skeleton } from "@/components/ui/skeleton";
import type { Booking } from "@/modules/bookings/types";

function BookingTableSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-8 w-36 rounded-full" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-[42px] flex-1 rounded-xl" />
        <Skeleton className="h-[42px] w-24 rounded-xl" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="grid grid-cols-[100px_2fr_1.5fr_1.5fr_120px_100px] gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-16" />
            ))}
          </div>
        </div>
        <div className="flex flex-col divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[100px_2fr_1.5fr_1.5fr_120px_100px] items-center gap-4 px-6 py-4">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-4 w-14 rounded" />
              </div>
              <div className="space-y-1.5 pr-4">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-2 w-16" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-14" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function formatDateStrings(iso: string) {
  try {
    const d = new Date(iso);
    const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).toLowerCase();
    return { day, time };
  } catch (e) {
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

export default function ActiveBookingsPage() {
  const { bookings, supervisors, drivers, isLoading, apiCounts } = useVendor();

  if (isLoading) return <BookingTableSkeleton />;

  const [search, setSearch]             = useState("");
  const [supervisorFilter, setSupervisorFilter] = useState("all");
  const [filterOpen, setFilterOpen]   = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const ongoingBookings = bookings.filter((b) => b.status === "Ongoing");

  const filtered = ongoingBookings.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      b.id.toLowerCase().includes(q) ||
      b.pickupLocation.toLowerCase().includes(q) ||
      b.dropLocation.toLowerCase().includes(q);
    const matchSupervisor =
      supervisorFilter === "all" || b.supervisorId === supervisorFilter;
    return matchSearch && matchSupervisor;
  });

  const activeFilterCount = supervisorFilter !== "all" ? 1 : 0;

  const apiInFiltered = filtered.filter((b) => {
    const idx = bookings.findIndex((x) => x.id === b.id);
    return idx < apiCounts.bookings;
  }).length;
  const splitAt = apiInFiltered > 0 && apiInFiltered < filtered.length ? apiInFiltered : -1;

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-slate-800">Active Bookings</h2>
          <p className="text-[13px] text-slate-400 font-medium mt-0.5">
            {filtered.length} of {ongoingBookings.length} rides currently in progress
          </p>
        </div>
        
        {/* Count Pills */}
        {ongoingBookings.length > 0 && (
          <div className="flex items-center gap-2 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-full font-semibold w-fit shadow-none tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            {ongoingBookings.length} live right now
          </div>
        )}
      </div>

      {/* SEARCH AND FILTER BUTTONS */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by ID, pickup or drop location..."
            className="pl-10 h-[42px] border-slate-200 bg-white rounded-xl shadow-sm text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 shrink-0 relative">
          <Button 
            variant="outline" 
            className="h-[42px] rounded-xl border-slate-200 text-slate-700 font-medium bg-white shadow-sm gap-2 px-4 hover:bg-slate-50 hover:text-slate-900 transition-colors relative"
            onClick={() => setFilterOpen((v) => !v)}
          >
            <TbFilter className="h-[15px] w-[15px]" /> FILTER
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-blue-600 text-[10px] font-bold text-white flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
          <FilterPanel
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            activeCount={activeFilterCount}
            onClearAll={() => setSupervisorFilter("all")}
          >
            <FilterSection label="Filter by Supervisor">
              <FilterPill
                label="All Supervisors"
                active={supervisorFilter === "all"}
                onClick={() => setSupervisorFilter("all")}
              />
              {supervisors.map((s) => (
                <FilterPill
                  key={s.id}
                  label={s.name}
                  active={supervisorFilter === s.id}
                  onClick={() => setSupervisorFilter(s.id)}
                />
              ))}
            </FilterSection>
          </FilterPanel>


        </div>
      </div>

      {/* UNIFIED TABLE CONTAINER */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[900px]">
            {/* TH */}
            <div className="grid grid-cols-[100px_2fr_120px_1.3fr_1.3fr_110px_90px] items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ID & TYPE</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ROUTE</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">COMPANY</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SUPERVISOR</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">DRIVER</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">STATUS</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">CREATED AT</div>
            </div>

            {/* TBODY */}
            <div className="flex flex-col divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                  <Car className="h-10 w-10 text-slate-200" />
                  <p className="text-sm font-medium">No rides currently in progress.</p>
                </div>
              ) : (
                filtered.map((booking, idx) => {
                  const { day, time } = formatDateStrings(booking.createdAt);
                  const supervisorName = supervisors.find(s => s.id === booking.supervisorId)?.name || 'Unknown';
                  const driverName = booking.driverId ? (drivers.find(d => d.id === booking.driverId)?.name || 'Unknown') : null;
                  const vehicle = booking.driverId ? (drivers.find(d => d.id === booking.driverId)?.vehicle ?? null) : null;

                  return (
                    <Fragment key={booking.id}>
                      {idx === splitAt && <MockSeparator />}
                    <div
                      className="grid grid-cols-[100px_2fr_120px_1.3fr_1.3fr_110px_90px] items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      {/* ID & TYPE */}
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-extrabold text-[#111827] text-[13px]">{booking.id}</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#eef2ff] text-blue-600 text-[10px] font-bold ring-1 ring-inset ring-blue-100/50">
                          {booking.type}
                        </span>
                      </div>

                      {/* ROUTE */}
                      <div className="flex flex-col min-w-0 pr-4 gap-px">
                        <span className="font-semibold text-[13px] text-slate-800 leading-tight truncate">
                          {booking.pickupLocation.split(",")[0]}
                        </span>
                        <div className="flex items-center gap-1">
                          <div
                            className="w-14 h-[2px] rounded-full"
                            style={{ background: "linear-gradient(to right, #A5B4FC, #2563EB)" }}
                          />
                          <ArrowRight className="h-3 w-3 text-blue-600 shrink-0" />
                        </div>
                        <span className="text-[12px] text-gray-500 truncate">
                          {booking.dropLocation.split(",")[0]}
                        </span>
                      </div>

                      {/* COMPANY */}
                      <div>
                        {booking.bookingSource ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-semibold truncate max-w-[110px]">
                            {booking.bookingSource}
                          </span>
                        ) : (
                          <span className="text-[12px] text-slate-300 italic">—</span>
                        )}
                      </div>

                      {/* SUPERVISOR */}
                      <div className="flex items-center">
                        <span className="text-[13px] font-medium text-slate-600 truncate">{supervisorName}</span>
                      </div>

                      {/* DRIVER */}
                      <div className="flex flex-col gap-px">
                        {driverName ? (
                          <>
                            <span className="text-[13px] font-medium text-slate-600 truncate">{driverName}</span>
                            {vehicle && (
                              <span className="text-[11px] text-slate-400 truncate">{vehicle}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-[13px] text-slate-300 font-medium italic">Awaiting</span>
                        )}
                      </div>

                      {/* STATUS */}
                      <div>
                        <StatusBadge status="Ongoing" size="sm" />
                      </div>

                      {/* DATE */}
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

      <BookingDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
      />
    </div>
  );
}

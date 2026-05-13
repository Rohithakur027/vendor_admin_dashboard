"use client";

import React, { useMemo, useState, Fragment } from "react";
import { useVendor } from "@/context/VendorContext";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowRight } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { Skeleton, SkeletonInline } from "@/components/ui/skeleton";
import type { Booking } from "@/modules/bookings/types";
import { DateRangePicker } from "@/modules/reports/DateRangePicker";
import { toIsoDate } from "@/modules/reports/primitives";
import { ExportButton } from "@/components/ExportButton";
import { exportToCsv } from "@/lib/exportCsv";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";

const TABLE_KEY = "pastTrips" as const;
const EM_DASH = "—";

function formatDateStrings(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return {
      day:  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }),
      time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toLowerCase(),
    };
  } catch { return { day: "Unknown", time: "" }; }
}
function formatIST(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
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

// Per-column header/body/skeleton renderers — used by both the table and CSV export.
function buildRenderers(
  supervisorName: (id: string | null | undefined) => string,
  driverFor:      (b: Booking) => { name: string | null; vehicle: string | null; vehicleReg: string | null; phone: string | null },
) {
  return {
    tripId: {
      header:   () => "TRIP ID & TYPE",
      body:     (b: Booking) => (
        <div className="flex flex-col items-start gap-1 min-w-0">
          <span className="font-extrabold text-[#111827] text-[13px] truncate" title={b.bookingRef ?? ""}>
            {b.bookingRef ?? EM_DASH}
          </span>
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#eef2ff] text-blue-600 text-[10px] font-bold ring-1 ring-inset ring-blue-100/50">
            {b.type ?? EM_DASH}
          </span>
        </div>
      ),
      skeleton: () => (<div className="space-y-2"><Skeleton className="h-3.5 w-16" /><Skeleton className="h-4 w-12 rounded" /></div>),
      csv:      (b: Booking) => `${b.bookingRef ?? ""}${b.type ? ` · ${b.type}` : ""}`,
    },
    route: {
      header:   () => "ROUTE",
      body:     (b: Booking) => (
        <div className="flex flex-col min-w-0 pr-4 gap-px">
          <span className="font-semibold text-[13px] text-slate-800 leading-tight truncate" title={b.pickupLocation}>
            {b.pickupLocation.split(",")[0]}
          </span>
          <div className="flex items-center gap-1">
            <div className="w-14 h-[2px] rounded-full" style={{ background: "linear-gradient(to right, #A5B4FC, #2563EB)" }} />
            <ArrowRight className="h-3 w-3 text-blue-600 shrink-0" />
          </div>
          <span className="text-[12px] text-gray-500 truncate" title={b.dropLocation}>
            {b.dropLocation.split(",")[0]}
          </span>
        </div>
      ),
      skeleton: () => (<div className="space-y-1.5 pr-4"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-2/3" /></div>),
      csv:      (b: Booking) => `${b.pickupLocation} → ${b.dropLocation}`,
    },
    supervisorCompany: {
      header:   () => "SUPERVISOR & COMPANY",
      body:     (b: Booking) => {
        const sup = supervisorName(b.supervisorId);
        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="text-[13px] font-medium text-slate-600 truncate" title={sup}>{sup || EM_DASH}</span>
            {b.bookingSource ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-semibold truncate max-w-[110px]" title={b.bookingSource}>
                {b.bookingSource}
              </span>
            ) : <span className="text-[11px] text-slate-300 italic">{EM_DASH}</span>}
          </div>
        );
      },
      skeleton: () => (<div className="space-y-1.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3 w-20" /></div>),
      csv:      (b: Booking) => `${supervisorName(b.supervisorId)}${b.bookingSource ? ` · ${b.bookingSource}` : ""}`,
    },
    vehicle: {
      header:   () => "VEHICLE",
      body:     (b: Booking) => {
        const d = driverFor(b);
        if (!d.vehicleReg && !d.vehicle) return <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
        return (
          <div className="flex flex-col gap-px min-w-0">
            <span className="text-[13px] font-medium text-slate-600 truncate" title={d.vehicleReg ?? d.vehicle ?? ""}>
              {d.vehicleReg || d.vehicle}
            </span>
            {d.vehicleReg && d.vehicle && (
              <span className="text-[11px] font-semibold text-slate-500 truncate">{d.vehicle}</span>
            )}
          </div>
        );
      },
      skeleton: () => (<div className="space-y-1.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3 w-16" /></div>),
      csv:      (b: Booking) => {
        const d = driverFor(b);
        return [d.vehicleReg, d.vehicle].filter(Boolean).join(" · ");
      },
    },
    driver: {
      header:   () => "DRIVER",
      body:     (b: Booking) => {
        const d = driverFor(b);
        return d.name
          ? <span className="text-[13px] font-medium text-slate-600 truncate block" title={d.name}>{d.name}</span>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => (<div className="space-y-1.5"><Skeleton className="h-3.5 w-24" /></div>),
      csv:      (b: Booking) => driverFor(b).name ?? "",
    },
    status: {
      header:   () => "STATUS",
      body:     (b: Booking) => <StatusBadge status={b.status} size="sm" />,
      skeleton: () => <Skeleton className="h-6 w-20 rounded-full" />,
      csv:      (b: Booking) => b.status,
    },
    pickupTime: {
      header:   () => "PICKUP TIME",
      body:     (b: Booking) => {
        const f = formatDateStrings(b.pickupTime);
        return f
          ? <div className="flex flex-col"><span className="text-[13px] font-medium text-slate-700">{f.day}</span><span className="text-[11px] text-slate-400 mt-0.5">{f.time}</span></div>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
      csv:      (b: Booking) => formatIST(b.pickupTime) ?? "",
    },
    scheduledAt: {
      header:   () => "SCHEDULED AT",
      body:     (b: Booking) => {
        const f = formatDateStrings(b.scheduledTime);
        return f
          ? <div className="flex flex-col"><span className="text-[13px] font-medium text-slate-700">{f.day}</span><span className="text-[11px] text-slate-400 mt-0.5">{f.time}</span></div>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
      csv:      (b: Booking) => formatIST(b.scheduledTime) ?? "",
    },
    createdAt: {
      header:   () => "CREATED AT",
      body:     (b: Booking) => {
        const f = formatDateStrings(b.createdAt);
        return f
          ? <div className="flex flex-col"><span className="text-[13px] font-medium text-slate-700">{f.day}</span><span className="text-[11px] text-slate-400 mt-0.5">{f.time}</span></div>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
      csv:      (b: Booking) => formatIST(b.createdAt) ?? "",
    },
    completedAt: {
      header:   () => "COMPLETED AT",
      body:     (b: Booking) => {
        const f = formatDateStrings(b.completedAt);
        return f
          ? <div className="flex flex-col"><span className="text-[13px] font-medium text-slate-700">{f.day}</span><span className="text-[11px] text-slate-400 mt-0.5">{f.time}</span></div>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
      csv:      (b: Booking) => formatIST(b.completedAt) ?? "",
    },
    startedAt: {
      header:   () => "STARTED AT",
      body:     (b: Booking) => {
        const startedAt = (b as Booking & { startedAt?: string | null }).startedAt;
        const f = formatDateStrings(startedAt);
        return f
          ? <div className="flex flex-col"><span className="text-[13px] font-medium text-slate-700">{f.day}</span><span className="text-[11px] text-slate-400 mt-0.5">{f.time}</span></div>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
      csv:      (b: Booking) => formatIST((b as Booking & { startedAt?: string | null }).startedAt) ?? "",
    },
    fare: {
      header:   () => "FARE",
      body:     (b: Booking) => b.fare != null
        ? <span className="text-[13px] font-bold text-slate-800 tabular-nums">₹{Number(b.fare).toLocaleString("en-IN")}</span>
        : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>,
      skeleton: () => <Skeleton className="h-3.5 w-16" />,
      csv:      (b: Booking) => b.fare ?? "",
    },
    passengers: {
      header:   () => "PASSENGERS",
      body:     (b: Booking) => b.passengers != null
        ? <span className="text-[13px] text-slate-700 tabular-nums">{b.passengers}</span>
        : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>,
      skeleton: () => <Skeleton className="h-3.5 w-8" />,
      csv:      (b: Booking) => b.passengers ?? "",
    },
    distance: {
      header:   () => "DISTANCE",
      body:     (b: Booking) => {
        const dist = (b as Booking & { distanceKm?: number | null }).distanceKm;
        return dist != null
          ? <span className="text-[13px] text-slate-700 tabular-nums">{Number(dist).toFixed(1)} km</span>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => <Skeleton className="h-3.5 w-14" />,
      csv:      (b: Booking) => (b as Booking & { distanceKm?: number | null }).distanceKm ?? "",
    },
    escort: {
      header:   () => "ESCORT",
      body:     (b: Booking) => {
        const escort = (b as Booking & { escortRequired?: boolean; escortPickup?: string | null });
        if (!escort.escortRequired) return <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
        return (
          <div className="flex flex-col gap-px min-w-0">
            <span className="text-[12px] font-semibold text-amber-700">Required</span>
            {escort.escortPickup && (
              <span className="text-[11px] text-slate-500 truncate" title={escort.escortPickup}>{escort.escortPickup}</span>
            )}
          </div>
        );
      },
      skeleton: () => <Skeleton className="h-3.5 w-16" />,
      csv:      (b: Booking) => {
        const escort = (b as Booking & { escortRequired?: boolean; escortPickup?: string | null });
        return escort.escortRequired ? `Required${escort.escortPickup ? ` · ${escort.escortPickup}` : ""}` : "";
      },
    },
    notes: {
      header:   () => "NOTES",
      body:     (b: Booking) => {
        const notes = (b as Booking & { notes?: string | null }).notes;
        return notes
          ? <span className="text-[12px] text-slate-600 truncate block" title={notes}>{notes}</span>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => <Skeleton className="h-3.5 w-24" />,
      csv:      (b: Booking) => (b as Booking & { notes?: string | null }).notes ?? "",
    },
    invoice: {
      header:   () => "INVOICE",
      body:     (b: Booking) => {
        const inv = (b as Booking & { invoiceId?: string | null }).invoiceId;
        return inv
          ? <span className="text-[12px] font-mono text-slate-600 truncate block" title={inv}>{inv.slice(0, 8)}</span>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => <Skeleton className="h-3.5 w-16" />,
      csv:      (b: Booking) => (b as Booking & { invoiceId?: string | null }).invoiceId ?? "",
    },
  } as const;
}

export default function PastBookingsPage() {
  const { bookings, supervisors, drivers, isLoading, apiCounts } = useVendor();
  const { columns: visibleCols, isVisible, toggle, reset, totalCount, loading: prefsLoading } = useColumnPreferences(TABLE_KEY);
  const spec = getTableSpec(TABLE_KEY);

  const [search,           setSearch]           = useState("");
  const [selectedBooking,  setSelectedBooking]  = useState<Booking | null>(null);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return toIsoDate(d); });
  const [dateTo,   setDateTo]   = useState(() => toIsoDate(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const pastBookings = bookings.filter(b => b.status === "Completed");

  const filtered = pastBookings
    .filter(b => {
      const created = b.createdAt ? toIsoDate(new Date(b.createdAt)) : "";
      const matchDate = !created || (created >= dateFrom && created <= dateTo);
      if (!matchDate) return false;

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

  const renderers = useMemo(
    () => buildRenderers(
      id => supervisors.find(s => s.id === id)?.name || "Unknown",
      b  => {
        const driver = b.driverId ? drivers.find(d => d.id === b.driverId) : null;
        return {
          name:       driver?.name ?? null,
          vehicle:    driver?.vehicle ?? null,
          vehicleReg: driver?.vehicleReg ?? null,
          phone:      b.driverPhone ?? driver?.phone ?? null,
        };
      },
    ),
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

          <div className="relative shrink-0">
            <button
              onClick={() => setShowDatePicker(v => !v)}
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
              <DateRangePicker from={dateFrom} to={dateTo}
                onApply={(f, t) => { setDateFrom(f); setDateTo(t); }}
                onClose={() => setShowDatePicker(false)} />
            )}
          </div>

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
            <div style={{ minWidth: minTableWidth }}>
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
                      className="grid items-center gap-4 px-6 py-3.5"
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
                        className="grid items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                        style={{ gridTemplateColumns: gridTemplate }}
                        onClick={() => setSelectedBooking(booking)}
                      >
                        {visibleCols.map((k, j) => {
                          const r = (renderers as Record<string, { body: (b: Booking) => React.ReactNode }>)[k];
                          const stickyStyle = j === 0
                            ? { position: "sticky" as const, left: 0, background: "white", zIndex: 1 }
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

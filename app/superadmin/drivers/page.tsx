"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { superadminApi, type DriverApiItem } from "@/lib/api";
import { Users, Navigation, CircleCheck, WifiOff } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FilterPanel,
  FilterSection,
  FilterPill,
  FilterTrigger,
} from "@/components/FilterPanel";

const FONT = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

type StatusFilter = "All" | "Available" | "On Trip" | "Offline";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
  );
}

function fmtPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return phone;
}

export default function SuperAdminDriversPage() {
  const router = useRouter();

  const [drivers,      setDrivers]      = useState<DriverApiItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [filterOpen,   setFilterOpen]   = useState(false);

  const activeFilterCount = statusFilter !== "All" ? 1 : 0;

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await superadminApi.drivers.list({
        limit:  200,
        status: statusFilter !== "All" ? statusFilter : undefined,
        search: search.trim() || undefined,
      });
      setDrivers(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    const t = setTimeout(fetchDrivers, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchDrivers, search]);

  const totalCt     = drivers.length;
  const onTripCt    = drivers.filter(d => d.status === "On Trip").length;
  const availableCt = drivers.filter(d => d.status === "Available").length;
  const offlineCt   = drivers.filter(d => d.status === "Offline").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT }}>

      {/* ── Stat cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Drivers", value: loading ? "—" : totalCt,     icon: Users },
          { label: "On Trip",       value: loading ? "—" : onTripCt,    icon: Navigation },
          { label: "Available",     value: loading ? "—" : availableCt, icon: CircleCheck },
          { label: "Offline",       value: loading ? "—" : offlineCt,   icon: WifiOff },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} style={{
            background: "#fff", borderRadius: 14, border: "1.5px solid #E8EEF4",
            padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: "#F1F5F9",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon className="h-5 w-5" style={{ color: "#64748B" }} />
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-[22px] w-12 mb-1.5" />
              ) : (
                <p style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{value}</p>
              )}
              <p style={{ fontSize: 11.5, color: "#64748B", marginTop: 3 }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name or phone…"
        />

        <div className="relative shrink-0">
          <FilterTrigger onClick={() => setFilterOpen(v => !v)} activeCount={activeFilterCount} />

          <FilterPanel
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            activeCount={activeFilterCount}
            onClearAll={() => setStatusFilter("All")}
          >
            <FilterSection label="Status">
              {(["All", "Available", "On Trip", "Offline"] as StatusFilter[]).map(s => (
                <FilterPill key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
              ))}
            </FilterSection>
          </FilterPanel>
        </div>
      </div>

      {/* ── Table ── */}
      {(() => {
        const COLS = "grid-cols-[minmax(0,2.5fr)_minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1.4fr)]";
        const ROW  = `grid ${COLS} items-center gap-8 px-7 py-4`;
        return (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

            {/* Header */}
            <div className={`grid ${COLS} items-center gap-8 px-7 py-3.5 border-b border-slate-100 bg-slate-50/50`}>
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">DRIVER</div>
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">PHONE</div>
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider text-center">STATUS</div>
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider text-center">TRIPS</div>
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider text-right">LAST ACTIVE</div>
            </div>

            {/* Body */}
            <div className="flex flex-col divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className={ROW}>
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-3/5" />
                      <Skeleton className="h-3 w-2/5" />
                    </div>
                    <Skeleton className="h-3.5 w-32" />
                    <div className="flex justify-center"><Skeleton className="h-6 w-20 rounded-full" /></div>
                    <div className="flex justify-center"><Skeleton className="h-3.5 w-5" /></div>
                    <div className="flex justify-end"><Skeleton className="h-3 w-36" /></div>
                  </div>
                ))
              ) : error ? (
                <div className="py-12 text-center text-sm text-red-500">{error}</div>
              ) : drivers.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-slate-500">No drivers found.</p>
                </div>
              ) : (
                drivers.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => router.push(`/superadmin/drivers/${d.id}`)}
                    className={`${ROW} hover:bg-slate-50 transition-colors cursor-pointer`}
                  >
                    {/* Driver — widest, left */}
                    <div className="flex flex-col min-w-0">
                      <span className="font-extrabold text-[#111827] text-[13.5px] truncate leading-snug">{d.name}</span>
                      <span className="text-[11px] text-slate-400 font-medium mt-0.5">{d.driverRef ?? d.id}</span>
                    </div>

                    {/* Phone — left */}
                    <span className="text-[13px] text-slate-600 font-medium">{fmtPhone(d.phone)}</span>

                    {/* Status — centered */}
                    <div className="flex justify-center">
                      <StatusBadge status={d.status} size="sm" />
                    </div>

                    {/* Trips — centered anchor */}
                    <div className="flex justify-center">
                      <span className={`text-[14px] font-bold ${d.totalTrips === 0 ? "text-slate-300" : "text-slate-800"}`}>
                        {d.totalTrips}
                      </span>
                    </div>

                    {/* Last Active — right-flush */}
                    <span className="text-[12.5px] text-slate-500 font-medium whitespace-nowrap text-right">
                      {fmtDateTime(d.lastActiveAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

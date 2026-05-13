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

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "1.5px solid #E8EEF4",
  borderRadius: 16,
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
  fontFamily: FONT,
};

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div style={{ ...CARD, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>
          {label}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "#F1F5F9", border: "1.5px solid #E8EEF4", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} color="#64748B" />
        </div>
      </div>
      {loading ? (
        <div style={{ height: 34, width: 60, borderRadius: 8, background: "#F1F5F9", animation: "pulse 1.5s ease-in-out infinite" }} />
      ) : (
        <div style={{ fontSize: 34, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{value}</div>
      )}
      {sub && (
        loading
          ? <div style={{ height: 10, width: 110, borderRadius: 6, background: "#F1F5F9", marginTop: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
          : <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 8, fontWeight: 500 }}>{sub}</div>
      )}
    </div>
  );
}

type StatusFilter = "All" | "Available" | "On Trip" | "Offline";

function formatDateStrings(iso: string) {
  try {
    const d = new Date(iso);
    const day  = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toLowerCase();
    return { day, time };
  } catch {
    return { day: "Unknown", time: "00:00 am" };
  }
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
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <StatCard loading={loading} label="Total Drivers" value={totalCt} icon={Users} />
        <StatCard loading={loading} label="On Trip" value={onTripCt} icon={Navigation} />
        <StatCard loading={loading} label="Available" value={availableCt} icon={CircleCheck} />
        <StatCard loading={loading} label="Offline" value={offlineCt} icon={WifiOff} />
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
        const COLS = "grid-cols-[minmax(0,2.5fr)_minmax(0,1.5fr)_minmax(0,1.8fr)_minmax(0,1.3fr)_minmax(0,1.4fr)]";
        const ROW  = `grid ${COLS} items-center gap-8 px-7 py-4`;
        return (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

            {/* Header */}
            <div className={`grid ${COLS} items-center gap-8 px-7 py-3.5 border-b border-slate-100 bg-slate-50/50`}>
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">DRIVER</div>
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">PHONE</div>
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">VEHICLE</div>
              <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider text-center">STATUS</div>
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
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <div className="flex justify-center"><Skeleton className="h-6 w-20 rounded-full" /></div>
                    <div className="flex justify-end"><Skeleton className="h-8 w-24" /></div>
                  </div>
                ))
              ) : error ? (
                <div className="py-12 text-center text-sm text-red-500">{error}</div>
              ) : drivers.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-slate-500">No drivers found.</p>
                </div>
              ) : (
                drivers.map((d) => {
                  const vehicles = (d as any).vehicles || (d.vehicle ? [d.vehicle] : []);
                  const mainVehicle = vehicles[0];

                  return (
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

                      {/* Vehicle */}
                      <div className="flex flex-col gap-px min-w-0">
                        {mainVehicle ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-medium text-slate-600 truncate">
                                {mainVehicle.plateNumber ?? mainVehicle.plate ?? "N/A"}
                              </span>
                              {vehicles.length > 1 && (
                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-bold ring-1 ring-inset ring-blue-100/50 whitespace-nowrap">
                                  +{vehicles.length - 1}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500 truncate">
                              {mainVehicle.model || "Unknown Model"}
                            </span>
                          </>
                        ) : (
                          <span className="text-[13px] text-slate-300 font-medium italic">—</span>
                        )}
                      </div>

                      {/* Status — centered */}
                      <div className="flex justify-center">
                        <StatusBadge status={d.status} size="sm" />
                      </div>

                      {/* Last Active — right-flush */}
                      <div className="flex flex-col text-right items-end justify-center gap-0.5 whitespace-nowrap">
                        <span className="text-[13px] font-medium text-slate-700">{formatDateStrings(d.lastActiveAt).day}</span>
                        <span className="text-[11px] text-slate-400 font-medium">{formatDateStrings(d.lastActiveAt).time}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

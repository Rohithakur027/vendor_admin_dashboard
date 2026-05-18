"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { superadminApi, type DriverApiItem } from "@/lib/api";
import { useDriverStatusFeed, type DriverStatusEvent } from "@/lib/useDriverStatusFeed";
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
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { ExportButton } from "@/components/ExportButton";
import { exportToCsv } from "@/lib/exportCsv";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";

const FONT = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "1.5px solid #E8EEF4",
  borderRadius: 16,
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
  fontFamily: FONT,
};

function StatCard({
  label, value, icon: Icon, sub, loading,
}: {
  label: string; value: number | string; icon: React.ElementType; sub?: string; loading?: boolean;
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

function fmtJoined(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function renderCell(key: string, d: DriverApiItem) {
  switch (key) {
    case "name":
      return (
        <div className="flex flex-col min-w-0">
          <span className="font-extrabold text-[#111827] text-[13.5px] truncate leading-snug">{d.name}</span>
          <span className="text-[11px] text-slate-400 font-medium mt-0.5">{d.driverRef ?? d.id.slice(0, 8)}</span>
        </div>
      );
    case "phone":
      return <span className="text-[13px] text-slate-600 font-medium">{fmtPhone(d.phone)}</span>;
    case "email":
      return <span className="text-[13px] text-slate-600 font-medium truncate">{d.email ?? "—"}</span>;
    case "status":
      return (
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={d.status} size="sm" />
          {d.isVerified && (
            <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
              ✓ Verified
            </span>
          )}
        </div>
      );
    case "zone":
      return <span className="text-[13px] text-slate-600 font-medium">{d.zone ?? "—"}</span>;
    case "vehicle": {
      const v = d.vehicle;
      return v ? (
        <div className="flex flex-col gap-px min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium text-slate-600 truncate">{v.plateNumber}</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 truncate">{v.model ?? "Unknown Model"}</span>
          {v.type && <span className="text-[10px] text-slate-400">{v.type}</span>}
        </div>
      ) : <span className="text-[13px] text-slate-300 italic">—</span>;
    }
    case "lastSeen":
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-slate-700">{formatDateStrings(d.lastActiveAt).day}</span>
          <span className="text-[11px] text-slate-400 font-medium">{formatDateStrings(d.lastActiveAt).time}</span>
        </div>
      );
    case "totalTrips":
      return <span className="text-[13px] font-semibold text-slate-700">{d.totalTrips}</span>;
    case "documents":
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-semibold text-slate-700">
            {d.documents.verified}<span className="text-slate-400 font-normal">/{d.documents.total}</span>
          </span>
          <span className="text-[10.5px] text-slate-400">verified</span>
        </div>
      );
    case "createdAt":
      return <span className="text-[13px] text-slate-600 font-medium">{fmtJoined(d.createdAt)}</span>;
    default:
      return <span className="text-[13px] text-slate-400">—</span>;
  }
}

export default function SuperAdminDriversPage() {
  const router = useRouter();

  const TABLE_KEY = "allDrivers" as const;
  const { columns: visibleCols, toggle: toggleCol, reset: resetCols, totalCount: colTotal } = useColumnPreferences(TABLE_KEY);
  const spec = getTableSpec(TABLE_KEY);

  const gridTemplate = useMemo(
    () => visibleCols.map(k => { const c = spec.columns.find(x => x.key === k); return c ? `minmax(${c.minWidth}px,1fr)` : "1fr"; }).join(" "),
    [visibleCols, spec.columns],
  );
  const minTableWidth = useMemo(
    () => visibleCols.reduce((s, k) => s + (spec.columns.find(x => x.key === k)?.minWidth ?? 100), 0) + 56,
    [visibleCols, spec.columns],
  );

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
      });
      setDrivers(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const onDriverStatus = useCallback((ev: DriverStatusEvent) => {
    setDrivers((prev) => {
      const idx = prev.findIndex((d) => d.id === ev.driver_id);
      if (idx === -1) {
        if (statusFilter !== "All" && ev.status === statusFilter) fetchDrivers();
        return prev;
      }
      if (statusFilter !== "All" && ev.status !== statusFilter) {
        return prev.filter((_, i) => i !== idx);
      }
      const next = prev.slice();
      next[idx] = { ...next[idx], isOnline: ev.is_online, status: ev.status, lastSeenAt: ev.last_seen_at };
      return next;
    });
  }, [statusFilter, fetchDrivers]);
  useDriverStatusFeed(onDriverStatus);

  const totalCt     = drivers.length;
  const onTripCt    = drivers.filter(d => d.status === "On Trip").length;
  const availableCt = drivers.filter(d => d.status === "Available").length;
  const offlineCt   = drivers.filter(d => d.status === "Offline").length;

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.phone.includes(q) ||
      (d.driverRef ?? "").toLowerCase().includes(q) ||
      (d.email ?? "").toLowerCase().includes(q) ||
      (d.zone ?? "").toLowerCase().includes(q) ||
      (d.vehicle?.plateNumber ?? "").toLowerCase().includes(q) ||
      (d.vehicle?.model ?? "").toLowerCase().includes(q)
    );
  }, [drivers, search]);

  function handleExport() {
    const rows = filteredDrivers.map(d => ({
      "Driver Name":   d.name,
      "Driver ID":     d.driverRef ?? "",
      "Phone":         d.phone,
      "Email":         d.email ?? "",
      "Zone":          d.zone ?? "",
      "Vehicle Plate": d.vehicle?.plateNumber ?? "",
      "Vehicle Model": d.vehicle?.model ?? "",
      "Vehicle Type":  d.vehicle?.type ?? "",
      "Status":        d.status,
      "Verified":      d.isVerified ? "Yes" : "No",
      "Total Trips":   d.totalTrips,
      "Docs Verified": `${d.documents.verified}/${d.documents.total}`,
      "Last Active":   d.lastActiveAt ? `${formatDateStrings(d.lastActiveAt).day} ${formatDateStrings(d.lastActiveAt).time}` : "",
      "Joined On":     fmtJoined(d.createdAt),
    }));
    exportToCsv("drivers.csv", rows);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <StatCard loading={loading} label="Total Drivers"  value={totalCt}     icon={Users}       />
        <StatCard loading={loading} label="On Trip"        value={onTripCt}    icon={Navigation}  />
        <StatCard loading={loading} label="Available"      value={availableCt} icon={CircleCheck} />
        <StatCard loading={loading} label="Offline"        value={offlineCt}   icon={WifiOff}     />
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name, phone, email, vehicle…"
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

        <ColumnsPopover
          tableKey={TABLE_KEY}
          visible={visibleCols}
          totalCount={colTotal}
          onToggle={toggleCol}
          onReset={resetCols}
        />

        <div className="ml-auto">
          <ExportButton onClick={handleExport} disabled={filteredDrivers.length === 0} />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <div className="w-fit min-w-full" style={{ minWidth: minTableWidth }}>

            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 16, padding: "10px 28px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {visibleCols.map(key => {
                const col = spec.columns.find(c => c.key === key);
                return (
                  <div key={key} style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    {col?.label ?? key}
                  </div>
                );
              })}
            </div>

            {/* Body */}
            <div className="flex flex-col divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 16, padding: "14px 28px" }}>
                    {visibleCols.map(k => <Skeleton key={k} className="h-3.5 w-3/4" />)}
                  </div>
                ))
              ) : error ? (
                <div className="py-12 text-center text-sm text-red-500">{error}</div>
              ) : filteredDrivers.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-slate-500">No drivers found.</p>
                </div>
              ) : (
                filteredDrivers.map(d => (
                  <div
                    key={d.id}
                    onClick={() => router.push(`/superadmin/drivers/${d.id}`)}
                    style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 16, padding: "13px 28px", alignItems: "center", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {visibleCols.map(key => (
                      <div key={key}>{renderCell(key, d)}</div>
                    ))}
                  </div>
                ))
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

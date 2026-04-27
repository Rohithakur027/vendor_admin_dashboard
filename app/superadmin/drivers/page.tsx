"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { superadminApi, type DriverApiItem } from "@/lib/api";
import { Search, Users, Navigation, CircleCheck, WifiOff } from "lucide-react";
import { TbFilter } from "react-icons/tb";
import { StatusBadge } from "@/components/StatusBadge";
import {
  FilterPanel,
  FilterSection,
  FilterPill,
} from "@/components/FilterPanel";

const ACCENT = "#2563EB";
const FONT   = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";
const GRID   = "2fr 1.2fr 120px 80px 170px";

type StatusFilter = "All" | "Available" | "On Trip" | "Offline";

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
  );
}

function SkeletonRow() {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: GRID, columnGap: 16,
      padding: "15px 24px", alignItems: "center",
      borderBottom: "1px solid #F8FAFC",
    }}>
      <div>
        <div style={{ height: 13, width: "55%", borderRadius: 6, background: "#F1F5F9", marginBottom: 6 }} />
        <div style={{ height: 10, width: "40%", borderRadius: 5, background: "#F1F5F9" }} />
      </div>
      <div style={{ height: 12, width: "60%", borderRadius: 6, background: "#F1F5F9" }} />
      <div style={{ height: 24, width: 76, borderRadius: 99, background: "#F1F5F9" }} />
      <div style={{ height: 12, width: 24, borderRadius: 6, background: "#F1F5F9" }} />
      <div style={{ height: 11, width: "70%", borderRadius: 5, background: "#F1F5F9" }} />
    </div>
  );
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
        @keyframes shimmer {
          0%   { opacity: 1; }
          50%  { opacity: 0.4; }
          100% { opacity: 1; }
        }
        .sk-pulse { animation: shimmer 1.4s ease-in-out infinite; }
      `}</style>

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
                <div className="sk-pulse" style={{ height: 22, width: 32, borderRadius: 6, background: "#F1F5F9", marginBottom: 6 }} />
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
        <div style={{ position: "relative", flex: "0 1 380px" }}>
          <Search
            className="h-4 w-4"
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }}
          />
          <input
            placeholder="Search drivers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9,
              border: "1.5px solid #E8EEF4", borderRadius: 10, fontSize: 13.5, fontFamily: FONT,
              color: "#0F172A", background: "#fff", outline: "none", boxSizing: "border-box" as const,
            }}
          />
        </div>

        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setFilterOpen(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 14px",
              border:      activeFilterCount > 0 ? "1.5px solid #93C5FD" : "1.5px solid #E8EEF4",
              borderRadius: 10,
              background:  activeFilterCount > 0 ? "#EFF6FF" : "#fff",
              color:       activeFilterCount > 0 ? "#1D4ED8"  : "#334155",
              fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
              letterSpacing: "0.04em", transition: "all 0.15s",
            }}
          >
            <TbFilter style={{ width: 15, height: 15 }} />
            FILTER
            {activeFilterCount > 0 && (
              <span style={{
                background: ACCENT, color: "#fff", fontSize: 9, fontWeight: 800,
                borderRadius: "50%", width: 15, height: 15,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>

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
      <div style={{ background: "#fff", border: "1.5px solid #E8EEF4", borderRadius: 16, overflow: "hidden" }}>

        {/* Header row */}
        <div style={{
          display: "grid", gridTemplateColumns: GRID,
          padding: "12px 24px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9",
          columnGap: 16,
        }}>
          {["DRIVER", "PHONE", "STATUS", "TRIPS", "LAST ACTIVE"].map(h => (
            <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
              {h}
            </span>
          ))}
        </div>

        {/* Body */}
        {loading ? (
          <div className="sk-pulse">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : error ? (
          <div style={{ padding: "48px 0", textAlign: "center" as const, color: "#EF4444", fontSize: 13 }}>
            {error}
          </div>
        ) : drivers.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center" as const, color: "#94A3B8", fontSize: 13 }}>
            No drivers found.
          </div>
        ) : (
          drivers.map((d, idx) => (
            <div
              key={d.id}
              onClick={() => router.push(`/superadmin/drivers/${d.id}`)}
              style={{
                display: "grid", gridTemplateColumns: GRID, columnGap: 16,
                padding: "15px 24px", alignItems: "center", cursor: "pointer",
                borderBottom: idx < drivers.length - 1 ? "1px solid #F8FAFC" : "none",
                transition: "background 0.12s",
              }}
              onMouseEnter={e  => { (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{d.name}</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2, fontWeight: 500 }}>{d.id}</div>
              </div>
              <span style={{ fontSize: 13, color: "#334155" }}>{d.phone}</span>
              <StatusBadge status={d.status} size="sm" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{d.totalTrips}</span>
              <span style={{ fontSize: 11.5, color: "#94A3B8" }}>{fmtDateTime(d.lastActiveAt)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

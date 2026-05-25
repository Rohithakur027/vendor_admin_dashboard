"use client";

import { useState, useMemo, useEffect } from "react";
import { useVendor } from "@/context/VendorContext";
import { reportsApi, type SupervisorSummaryData } from "@/lib/api";
import { exportToXlsx } from "@/lib/exportXlsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  A, fmt, fmtINRk, toIsoDate,
  Card, StatCard, Badge, EmptyState, ReportSkeleton,
} from "./primitives";
import { SvgBarChart, SvgDonut } from "./charts";
import { DateRangePicker } from "./DateRangePicker";
import { Route } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";
import { SearchBar } from "@/components/SearchBar";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";
import { buildTripRenderers, EM_DASH } from "@/modules/bookings/tripRenderers";
import { Skeleton } from "@/components/ui/skeleton";
import type { Booking } from "@/modules/bookings/types";

const TRIPS_TABLE_KEY = "pastTrips" as const;

type TabKey = "overview" | "trips";

export function PanelSupervisorReport({
  supervisorId,
  hideHeader = false,
  hideSupervisorPicker = false,
}: {
  supervisorId: string;
  hideHeader?: boolean;
  hideSupervisorPicker?: boolean;
}) {
  const { supervisors, bookings, drivers, apiCounts } = useVendor();
  const { columns: visibleCols, toggle, reset, totalCount, loading: prefsLoading } = useColumnPreferences(TRIPS_TABLE_KEY);
  const tripsSpec = getTableSpec(TRIPS_TABLE_KEY);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [search, setSearch] = useState("");
  const [showPicker,  setShowPicker]  = useState(false);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return toIsoDate(d); });
  const [dateTo,   setDateTo]   = useState(() => toIsoDate(new Date()));
  const [supFilter,  setSupFilter]  = useState<string>(supervisorId);
  // Start loading=true when we already have an ID to fetch — otherwise the
  // panel briefly renders empty zeros before the effect kicks in and shows the skeleton.
  const [loading,    setLoading]    = useState<boolean>(supervisorId !== "all");
  const [summary,    setSummary]    = useState<SupervisorSummaryData | null>(null);
  const [hourlyExpand,    setHourlyExpand]    = useState(false);
  const [dailyExpand,     setDailyExpand]     = useState(false);
  const [companyVisualize, setCompanyVisualize] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const supervisor = supervisorId === "all" ? null : supervisors.find((s) => s.id === supervisorId) ?? null;

  const effectiveSupId =
    supervisorId !== "all" ? supervisorId :
    supFilter   !== "all" ? supFilter   : null;

  useEffect(() => {
    if (!effectiveSupId) { setSummary(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    reportsApi.getSupervisorSummary(effectiveSupId, dateFrom, dateTo)
      .then((res)  => { if (!cancelled) setSummary(res.data); })
      .catch(()    => { if (!cancelled) setSummary(null); })
      .finally(()  => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [effectiveSupId, dateFrom, dateTo]);

  const totalBookings = summary?.kpis.totalBookings    ?? 0;
  const totalSpend    = summary?.kpis.totalMoneySpent  ?? 0;
  const avgFare       = totalBookings > 0 ? Math.round(totalSpend / totalBookings) : 0;

  // Full daily data — every day in the selected range, used by the expanded modal.
  // Each row carries both spend + bookings so the spend and trips charts share one source.
  const dailyDataFull = useMemo(() => {
    const raw = summary?.dailyStats ?? [];
    return raw.map((s) => ({
      d:        new Date(s.date + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      spend:    s.amount,
      bookings: s.bookings,
    }));
  }, [summary]);

  // Inline daily chart — sample down to ~14 ticks for legibility on long ranges.
  const dailyData = useMemo(() => {
    if (dailyDataFull.length === 0) return [];
    const step = Math.max(1, Math.floor(dailyDataFull.length / 14));
    return dailyDataFull.filter((_, i) => i % step === 0 || i === dailyDataFull.length - 1);
  }, [dailyDataFull]);

  // Modal: chunk full series into rows so long ranges stay readable.
  const dailyRows = useMemo(() => {
    const len = dailyDataFull.length;
    if (len === 0) return [];
    const rowCount = len > 45 ? 3 : len > 14 ? 2 : 1;
    const perRow = Math.ceil(len / rowCount);
    const rows: typeof dailyDataFull[] = [];
    for (let i = 0; i < len; i += perRow) rows.push(dailyDataFull.slice(i, i + perRow));
    return rows;
  }, [dailyDataFull]);

  const dailyYMax = useMemo(
    () => (dailyDataFull.length > 0 ? Math.max(...dailyDataFull.map((d) => d.spend)) : 0),
    [dailyDataFull],
  );
  const dailyTripsYMax = useMemo(
    () => (dailyDataFull.length > 0 ? Math.max(...dailyDataFull.map((d) => d.bookings)) : 0),
    [dailyDataFull],
  );

  const instantCount   = summary?.bookingTypeSplit.instant   ?? 0;
  const scheduledCount = summary?.bookingTypeSplit.scheduled ?? 0;
  const typeTotal      = instantCount + scheduledCount;
  const bookingTypeData = [
    { name: "Instant",   value: instantCount,   pct: typeTotal > 0 ? Math.round(instantCount   / typeTotal * 100) : 0 },
    { name: "Scheduled", value: scheduledCount, pct: typeTotal > 0 ? Math.round(scheduledCount / typeTotal * 100) : 0 },
  ];

  const byCompany         = summary?.companies ?? [];
  const companiesCount    = summary?.companiesCount ?? byCompany.length;
  const totalCompanySpend = byCompany.reduce((s, c) => s + c.totalFare, 0) || 1;
  const totalCompanyTrips = byCompany.reduce((s, c) => s + c.totalTrips, 0) || 1;

  const title    = supervisor ? supervisor.name : "All Supervisors";
  const subtitle = supervisor
    ? [supervisor.zone, supervisor.phone].filter(Boolean).join(" · ")
    : `${supervisors.length} supervisors`;
  const dateLabel = `${new Date(dateFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} — ${new Date(dateTo).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;

  // Only real API bookings (slice to apiCounts.bookings excludes any mock rows)
  const apiBookings = useMemo(() => bookings.slice(0, apiCounts.bookings), [bookings, apiCounts.bookings]);

  const filteredTrips = useMemo(() => {
    return apiBookings
      .filter((b) => {
        if (b.status !== "Completed") return false;
        if (effectiveSupId && b.supervisorId !== effectiveSupId) return false;
        // Use scheduledTime (actual trip date) to match the API summary's date filtering,
        // falling back to createdAt for instant trips where scheduledTime may be null.
        const tripDateRaw = b.scheduledTime ?? b.createdAt;
        if (!tripDateRaw) return false;
        const tripDate = toIsoDate(new Date(tripDateRaw));
        if (tripDate < dateFrom || tripDate > dateTo) return false;

        const q = search.toLowerCase();
        if (q) {
          const driver = b.driverId ? drivers.find((d) => d.id === b.driverId) : null;
          const driverName = driver?.name || "";
          const driverPhone = (b.driverPhone ?? driver?.phone ?? "").toLowerCase();
          const vehicleModel = driver?.vehicle || "";
          const vehicleReg = driver?.vehicleReg || "";
          const companyName = b.bookingSource || "";
          const supName = supervisors.find(s => s.id === b.supervisorId)?.name || "";

          if (
            !b.id.toLowerCase().includes(q) &&
            !(b.bookingRef?.toLowerCase().includes(q)) &&
            !b.pickupLocation.toLowerCase().includes(q) &&
            !b.dropLocation.toLowerCase().includes(q) &&
            !driverName.toLowerCase().includes(q) &&
            !driverPhone.includes(q) &&
            !vehicleModel.toLowerCase().includes(q) &&
            !vehicleReg.toLowerCase().replace(/\s+/g, "").includes(q.replace(/\s+/g, "")) &&
            !companyName.toLowerCase().includes(q) &&
            !supName.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [apiBookings, effectiveSupId, dateFrom, dateTo, search, drivers, supervisors]);

  // Column-system: renderers + grid template (mirrors Past Trips page)
  const supervisorLookup = (id: string | null | undefined) =>
    supervisors.find((s) => s.id === id)?.name || "Unknown";

  const driverFor = (b: Booking) => {
    const driver = b.driverId ? drivers.find((d) => d.id === b.driverId) : null;
    return {
      name:        driver?.name ?? null,
      vehicle:     driver?.vehicle ?? null,
      vehicleReg:  driver?.vehicleReg ?? null,
      vehicleType: driver?.vehicleType ?? null,
      phone:       b.driverPhone ?? driver?.phone ?? null,
    };
  };

  const renderers = useMemo(
    () => buildTripRenderers(supervisorLookup, driverFor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [supervisors, drivers],
  );

  const gridTemplate = useMemo(() =>
    visibleCols.map(key => {
      const col = tripsSpec.columns.find(c => c.key === key);
      return col ? `minmax(${col.minWidth}px, 1fr)` : "1fr";
    }).join(" "),
    [visibleCols, tripsSpec.columns],
  );

  const minTableWidth = useMemo(
    () => visibleCols.reduce((sum, k) => sum + (tripsSpec.columns.find(c => c.key === k)?.minWidth ?? 100), 0) + 48,
    [visibleCols, tripsSpec.columns],
  );

  function handleExportTrips() {
    const rows = filteredTrips.map((b) => {
      const out: Record<string, string | number> = {};
      for (const k of visibleCols) {
        const col = tripsSpec.columns.find(c => c.key === k);
        if (!col) continue;

        const r = (renderers as Record<string, { csv: (b: Booking) => string | number }>)[k];
        out[col.label] = r ? r.csv(b) : "";
      }
      return out;
    });
    exportToXlsx(`trips-${title.replace(/\s+/g, "-").toLowerCase()}-${dateFrom}-to-${dateTo}`, rows, "Trips");
  }

  if (loading) return <ReportSkeleton hideHeader={hideHeader} statCount={3} />;

  const TABS: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "trips",    label: "Trips"    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {!hideHeader && (
        <Card style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 20, color: A, flexShrink: 0 }}>
              {title.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{title}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>{subtitle}</div>
            </div>
          </div>
          {supervisor && (
            <Badge label={supervisor.status}
              color={supervisor.status === "Active" ? "#15803D" : "#64748B"}
              bg={supervisor.status === "Active" ? "#DCFCE7" : "#F1F5F9"}
              dot={supervisor.status === "Active" ? "#22C55E" : "#94A3B8"} />
          )}
        </Card>
      )}

      {/* DATE PICKER + SUPERVISOR FILTER + EXPORT — shared across all tabs */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowPicker((v) => !v)}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 9, fontSize: 12.5, color: "#475569", fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 3v4M16 3v4" />
            </svg>
            {dateLabel}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 4l3 3 3-3" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          {showPicker && (
            <DateRangePicker from={dateFrom} to={dateTo}
              onApply={(f, t) => { setDateFrom(f); setDateTo(t); }}
              onClose={() => setShowPicker(false)} />
          )}
        </div>
        {supervisorId === "all" && !hideSupervisorPicker && (
          <Select value={supFilter} onValueChange={(v) => setSupFilter(v ?? "all")}>
            <SelectTrigger className="h-[34px] min-w-[200px] bg-white border-[1.5px] border-slate-200 rounded-[9px] text-[12.5px] text-slate-900 font-medium">
              <SelectValue placeholder="All supervisors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All supervisors</SelectItem>
              {supervisors.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {activeTab === "trips" && (
          <>
            <SearchBar value={search} onChange={setSearch} placeholder="Search by ID, route, name, vehicle, company..." className="ml-2" />
            <ColumnsPopover
              tableKey={TRIPS_TABLE_KEY}
              visible={visibleCols}
              totalCount={totalCount}
              onToggle={toggle}
              onReset={reset}
            />
            <ExportButton
              onClick={handleExportTrips}
              disabled={filteredTrips.length === 0}
              className="ml-auto"
              label="Export XLSX"
            />
          </>
        )}
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1.5px solid #E2E8F0", marginBottom: -8 }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              padding: "8px 16px",
              fontSize: 13.5,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: "pointer",
              background: "none",
              border: "none",
              borderBottom: activeTab === key ? `2px solid ${A}` : "2px solid transparent",
              color: activeTab === key ? A : "#94A3B8",
              marginBottom: -1.5,
              transition: "color 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && <>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        <StatCard label="Total Trips" value={String(totalBookings)} sub="In selected period" iconBg="#F1F5F9"
          icon={<Route size={17} color="#64748B" strokeWidth={1.4} />} />
        <StatCard label="Total Wallet Consumed" value={totalSpend > 0 ? fmt(totalSpend) : "—"} sub="Wallet deductions" iconBg="#F1F5F9"
          icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="2" stroke="#64748B" strokeWidth="1.4" /><path d="M1 7h14" stroke="#64748B" strokeWidth="1.4" /><circle cx="12.5" cy="10" r="1" fill="#64748B" /></svg>} />
        <StatCard label="Avg Fare" value={avgFare > 0 ? fmt(avgFare) : "—"} sub="Per completed trip" iconBg="#F1F5F9"
          icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2 12L6 8l3 3 5-7" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
      </div>

      {effectiveSupId && summary && totalBookings === 0 && (
        <Card style={{ padding: "40px 22px" }}>
          <EmptyState msg="No activity found for this supervisor in the selected period" />
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card style={{ padding: "20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>Trips over time</div>
              <div style={{ fontSize: 11.5, color: "#94A3B8" }}>Daily trip volume</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ fontSize: 11, color: "#94A3B8", textAlign: "right" }}>
                <strong style={{ display: "block", fontSize: 18, color: "#0F172A", fontWeight: 600, fontVariantNumeric: "tabular-nums", marginBottom: 2 }}>{totalBookings}</strong>
                trips
              </div>
              {dailyDataFull.length > 0 && (
                <button onClick={() => setHourlyExpand(true)} title="Expand"
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M9 2h5v5M14 2l-5 5M7 14H2v-5M2 14l5-5" stroke="#64748B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          {dailyData.length > 0
            ? <div style={{ height: 220 }}><SvgBarChart data={dailyData as Record<string, unknown>[]} xKey="d" yKey="bookings" color={A} maxBarWidth={80} yLabel="Trips" /></div>
            : <EmptyState msg="No trips in this period" />}
        </Card>
        <Card style={{ padding: "20px 22px" }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>Instant vs Scheduled</div>
            <div style={{ fontSize: 11.5, color: "#94A3B8" }}>Trip type split</div>
          </div>
          <div style={{ position: "relative" }}>
            <SvgDonut data={bookingTypeData} colors={[A, "#93C5FD"]} size={190} thickness={26} valueFormat={(v) => `${v} trip${v === 1 ? "" : "s"}`} />
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
              <div style={{ fontSize: 26, fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{totalBookings}</div>
              <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>Total</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
            {bookingTypeData.map((b, i) => (
              <div key={b.name} style={{ display: "grid", gridTemplateColumns: "14px 1fr auto auto", gap: 10, alignItems: "center", fontSize: 12.5 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: i === 0 ? A : "#93C5FD" }} />
                <span style={{ color: "#475569", fontWeight: 500 }}>{b.name}</span>
                <span style={{ color: "#94A3B8", fontVariantNumeric: "tabular-nums", fontSize: 11.5 }}>{b.pct}%</span>
                <span style={{ color: "#0F172A", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{b.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card style={{ padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>Daily spend breakdown</div>
            <div style={{ fontSize: 11.5, color: "#94A3B8" }}>Daily fare deductions</div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ fontSize: 11, color: "#94A3B8", textAlign: "right" }}>
              <strong style={{ display: "block", fontSize: 18, color: "#0F172A", fontWeight: 600, fontVariantNumeric: "tabular-nums", marginBottom: 2 }}>{totalSpend > 0 ? fmtINRk(totalSpend) : "—"}</strong>
              total
            </div>
            {dailyDataFull.length > 0 && (
              <button onClick={() => setDailyExpand(true)} title="Expand"
                style={{ width: 30, height: 30, borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M9 2h5v5M14 2l-5 5M7 14H2v-5M2 14l5-5" stroke="#64748B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {dailyData.length > 0
          ? <div style={{ height: 220 }}><SvgBarChart data={dailyData as Record<string, unknown>[]} xKey="d" yKey="spend" color={A} yFormat={fmtINRk} maxBarWidth={80} yLabel="Spend" /></div>
          : <EmptyState msg="No spend data for this period" />}
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 22px 0" }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>
              Company-wise breakdown
              <span style={{ marginLeft: 8, color: "#94A3B8", fontWeight: 500, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                · {companiesCount} {companiesCount === 1 ? "company" : "companies"}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "#94A3B8" }}>Spend distributed across booked companies</div>
          </div>
          {byCompany.length > 0 && (
            <button onClick={() => setCompanyVisualize(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 9, fontSize: 12.5, color: "#475569", fontFamily: "inherit", fontWeight: 600, cursor: "pointer" }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="#64748B" strokeWidth="1.4" />
                <path d="M8 2v6l4 3" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Visualize
            </button>
          )}
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "10px 22px", background: "rgba(248,250,252,0.8)", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" }}>
            {["Company", "Total Trips", "% of Total Trips", "Total Fare", "% of Total Spend"].map((h) => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>
          {byCompany.length === 0
            ? <div style={{ padding: "32px 22px" }}><EmptyState msg="No company data for this period" /></div>
            : byCompany.map((c, i) => {
              const spendPct = c.percentageOfTotalSpend > 0 ? c.percentageOfTotalSpend : (c.totalFare  / totalCompanySpend) * 100;
              const tripsPct = (c.totalTrips / totalCompanyTrips) * 100;
              return (
                <div key={c.companyId} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", padding: "13px 22px", borderBottom: i < byCompany.length - 1 ? "1px solid #F1F5F9" : "none", alignItems: "center" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>{c.companyName}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{c.totalTrips}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{tripsPct.toFixed(1)}%</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{fmt(c.totalFare)}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{spendPct.toFixed(1)}%</div>
                </div>
              );
            })}
        </div>
      </Card>

      {hourlyExpand && (() => {
        const rowH = dailyRows.length === 3 ? 200 : dailyRows.length === 2 ? 260 : 380;
        return (
          <div onClick={(e) => { if (e.target === e.currentTarget) setHourlyExpand(false); }}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 }}>
            <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 1400, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.22)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 26px", borderBottom: "1.5px solid #F1F5F9" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Trips over time</div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>{title} · {dateLabel}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ fontSize: 11, color: "#94A3B8", textAlign: "right" }}>
                    <strong style={{ display: "block", fontSize: 20, color: "#0F172A", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{totalBookings}</strong>
                    trips
                  </div>
                  <button onClick={() => setHourlyExpand(false)}
                    style={{ width: 34, height: 34, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, padding: "24px 26px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 22 }}>
                {dailyRows.length === 0
                  ? <EmptyState msg="No trips in this period" />
                  : dailyRows.map((row, i) => (
                    <div key={i} style={{ height: rowH }}>
                      <SvgBarChart data={row as Record<string, unknown>[]} xKey="d" yKey="bookings" color={A} yMax={dailyTripsYMax} maxBarWidth={80} height={rowH} yLabel="Trips" />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        );
      })()}

      {dailyExpand && (() => {
        const rowH = dailyRows.length === 3 ? 200 : dailyRows.length === 2 ? 260 : 380;
        return (
          <div onClick={(e) => { if (e.target === e.currentTarget) setDailyExpand(false); }}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 }}>
            <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 1400, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.22)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 26px", borderBottom: "1.5px solid #F1F5F9" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Daily spend breakdown</div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>{title} · {dateLabel}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ fontSize: 11, color: "#94A3B8", textAlign: "right" }}>
                    <strong style={{ display: "block", fontSize: 20, color: "#0F172A", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{totalSpend > 0 ? fmtINRk(totalSpend) : "—"}</strong>
                    total
                  </div>
                  <button onClick={() => setDailyExpand(false)}
                    style={{ width: 34, height: 34, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" /></svg>
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, padding: "24px 26px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 22 }}>
                {dailyRows.length === 0
                  ? <EmptyState msg="No spend data for this period" />
                  : dailyRows.map((row, i) => (
                    <div key={i} style={{ height: rowH }}>
                      <SvgBarChart data={row as Record<string, unknown>[]} xKey="d" yKey="spend" color={A} yFormat={fmtINRk} yMax={dailyYMax} maxBarWidth={80} height={rowH} yLabel="Spend" />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        );
      })()}

      </>}

      {/* ── TRIPS TAB ── */}
      {activeTab === "trips" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748B" }}>
          <span style={{ fontWeight: 600, color: "#94A3B8", fontSize: 14 }}>{filteredTrips.length}</span>
          <span>{filteredTrips.length === 1 ? "trip" : "trips"} on this page</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="w-full overflow-x-auto">
            <div className="w-fit min-w-full" style={{ minWidth: minTableWidth }}>
              {/* Header */}
              <div
                className="grid items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-[2] backdrop-blur"
                style={{ gridTemplateColumns: gridTemplate }}
              >
                {prefsLoading
                  ? Array.from({ length: visibleCols.length }).map((_, i) => (
                      <Skeleton key={i} className={`h-3 ${i === 0 ? "w-24" : "w-16"}`} />
                    ))
                  : visibleCols.map((k, i) => {
                      const col = tripsSpec.columns.find(c => c.key === k);
                      if (!col) return null;
                      const headerClass = "text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate";
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
                {prefsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
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
                ) : filteredTrips.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">No trips found for this period.</div>
                ) : (
                  filteredTrips.map((booking) => (
                    <div
                      key={booking.id}
                      className="grid items-center gap-4 px-6 py-3.5 bg-white hover:bg-slate-50 transition-colors group cursor-pointer"
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
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        </div>
      )}

      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />

      {companyVisualize && (() => {
        const palette = [A, "#93C5FD", "#FB923C", "#10B981", "#A78BFA", "#F472B6", "#FBBF24", "#22D3EE", "#34D399", "#F87171"];
        const colors  = byCompany.map((_, i) => palette[i % palette.length]);
        const tripsData = byCompany.map((c) => ({
          name:  c.companyName,
          value: c.totalTrips,
          pct:   Math.round((c.totalTrips / totalCompanyTrips) * 100),
        }));
        const spendData = byCompany.map((c) => ({
          name:  c.companyName,
          value: c.totalFare,
          pct:   Math.round((c.totalFare  / totalCompanySpend) * 100),
        }));
        const totalTrips = byCompany.reduce((s, c) => s + c.totalTrips, 0);
        const totalSpendVal = byCompany.reduce((s, c) => s + c.totalFare, 0);

        const renderDonut = (
          heading: string,
          subheading: string,
          data: { name: string; value: number; pct: number }[],
          centerValue: string,
          centerLabel: string,
          format: (v: number) => string,
        ) => (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 8px" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginBottom: 2 }}>{heading}</div>
            <div style={{ fontSize: 11.5, color: "#94A3B8", marginBottom: 18 }}>{subheading}</div>
            <div style={{ position: "relative" }}>
              <SvgDonut data={data} colors={colors} size={240} thickness={32} valueFormat={format} />
              <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", textAlign: "center", pointerEvents: "none" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{centerValue}</div>
                <div style={{ fontSize: 10.5, color: "#94A3B8", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500 }}>{centerLabel}</div>
              </div>
            </div>
            <div style={{ width: "100%", maxWidth: 320, marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              {data.map((d, i) => (
                <div key={d.name} style={{ display: "grid", gridTemplateColumns: "12px 1fr auto auto", gap: 10, alignItems: "center", fontSize: 12.5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: colors[i] }} />
                  <span style={{ color: "#475569", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                  <span style={{ color: "#94A3B8", fontVariantNumeric: "tabular-nums", fontSize: 11.5 }}>{d.pct}%</span>
                  <span style={{ color: "#0F172A", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{format(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        );

        return (
          <div onClick={(e) => { if (e.target === e.currentTarget) setCompanyVisualize(false); }}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 }}>
            <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 1000, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.22)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 26px", borderBottom: "1.5px solid #F1F5F9" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Company breakdown</div>
                  <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>{title} · {dateLabel}</div>
                </div>
                <button onClick={() => setCompanyVisualize(false)}
                  style={{ width: 34, height: 34, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </button>
              </div>
              <div style={{ flex: 1, padding: "20px 26px", overflowY: "auto", display: "flex", gap: 24 }}>
                {renderDonut("By total bookings", "Trips per company", tripsData, String(totalTrips), "Trips", (v) => String(v))}
                <div style={{ width: 1, background: "#F1F5F9" }} />
                {renderDonut("By total spend",    "Fare per company",  spendData, fmtINRk(totalSpendVal), "Spend", (v) => fmt(v))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

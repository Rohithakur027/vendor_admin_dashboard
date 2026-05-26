"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useVendor } from "@/context/VendorContext";
import { reportsApi, companiesApi, type CompanyReportData, type CompanyApiItem } from "@/lib/api";
import { exportToXlsx } from "@/lib/exportXlsx";
import { SearchBar } from "@/components/SearchBar";
import { ExportButton } from "@/components/ExportButton";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";
import {
  A, FONT, fmt, fmtINRk, toIsoDate, inRange,
  Card, StatCard, Badge, EmptyState, ReportSkeleton,
} from "@/modules/reports/primitives";
import { SvgBarChart, SvgDonut } from "@/modules/reports/charts";
import { DateRangePicker } from "@/modules/reports/DateRangePicker";
import { PanelSupervisorReport } from "@/modules/reports/PanelSupervisorReport";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";
import { Route } from "lucide-react";
import { TripsTable } from "@/modules/bookings/components/TripsTable";
import { buildTripRenderers } from "@/modules/bookings/tripRenderers";
import type { Booking } from "@/modules/bookings/types";

/* ══════════════════════════════════════════════════════════════
   COMPANY REPORT PANEL
══════════════════════════════════════════════════════════════ */
const COMPANY_TABS = ["Overview", "Trips"] as const;
type CompanyTab = typeof COMPANY_TABS[number];

function PanelCompanyReport({ companyName }: { companyName: string }) {
  const { bookings, supervisors, drivers } = useVendor();
  const [tab,         setTab]         = useState<CompanyTab>("Overview");
  const [showPicker,  setShowPicker]  = useState(false);
  const [search,      setSearch]      = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return toIsoDate(d); });
  const [dateTo,   setDateTo]   = useState(() => toIsoDate(new Date()));
  const [loading,    setLoading]    = useState<boolean>(companyName !== "all");
  const [reportData, setReportData] = useState<CompanyReportData | null>(null);
  const activeReportData = companyName === "all" ? null : reportData;
  const isReportLoading = companyName !== "all" && loading;

  useEffect(() => {
    if (companyName === "all") return;
    let cancelled = false;
    // The report needs to flip into a loading state when the selected company/date changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    reportsApi.getCompany(companyName, dateFrom, dateTo)
      .then((res)  => { if (!cancelled) setReportData(res.data); })
      .catch(()    => { if (!cancelled) setReportData(null); })
      .finally(()  => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyName, dateFrom, dateTo]);

  const filteredBookings = useMemo(() =>
    bookings.filter((b) => {
      if (!inRange(new Date(b.createdAt), dateFrom, dateTo)) return false;
      if (companyName === "all") return !!b.bookingSource && b.bookingSource !== "Individual";
      return b.bookingSource === companyName;
    }),
  [bookings, companyName, dateFrom, dateTo]);

  const completedBookings = useMemo(
    // Keep the trips tab restricted to completed trips only.
    // Backend payloads sometimes vary in status casing, so normalize before filtering.
    () => filteredBookings.filter((b) => String(b.status).trim().toLowerCase() === "completed"),
    [filteredBookings],
  );

  const tripsTableKey = "pastTrips" as const;
  const { columns: visibleCols, toggle, reset, totalCount, loading: prefsLoading } = useColumnPreferences(tripsTableKey);
  const tripsSpec = getTableSpec(tripsTableKey);

  const totalBookings  = activeReportData?.kpis.totalBookings     ?? completedBookings.length;
  const completedCount = activeReportData?.kpis.completedBookings ?? completedBookings.length;
  const totalSpend     = activeReportData?.kpis.totalMoneySpent   ?? completedBookings.reduce((s, b) => s + (b.fare || 0), 0);
  const avgFare        = activeReportData?.kpis.avgBookingFare    ?? (completedCount > 0 ? Math.round(totalSpend / completedCount) : 0);

  const dailyData = useMemo(() => {
    if (activeReportData && activeReportData.dailyStats.length > 0) {
      const raw  = activeReportData.dailyStats;
      const step = Math.max(1, Math.floor(raw.length / 14));
      return raw
        .filter((_, i) => i % step === 0 || i === raw.length - 1)
        .map((s) => ({
          d:        new Date(s.date + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          bookings: s.bookings,
          spend:    s.amount,
        }));
    }
    const dates: string[] = [];
    const cur = new Date(dateFrom + "T00:00:00");
    const end = new Date(dateTo   + "T00:00:00");
    while (cur <= end) { dates.push(toIsoDate(cur)); cur.setDate(cur.getDate() + 1); }
    const step = Math.max(1, Math.floor(dates.length / 14));
    return dates
      .filter((_, i) => i % step === 0 || i === dates.length - 1)
      .map((d) => {
        const dayBkgs = completedBookings.filter((b) => b.createdAt.split("T")[0] === d);
        return {
          d:        new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          bookings: dayBkgs.length,
          spend:    dayBkgs.reduce((s, b) => s + (b.fare || 0), 0),
        };
      });
  }, [activeReportData, completedBookings, dateFrom, dateTo]);

  const instantCount   = activeReportData?.bookingTypeSplit.instant   ?? completedBookings.filter((b) => b.type === "Instant").length;
  const scheduledCount = activeReportData?.bookingTypeSplit.scheduled ?? completedBookings.filter((b) => b.type === "Scheduled").length;
  const bookingTypeData = [
    { name: "Instant",   value: instantCount,   pct: totalBookings > 0 ? Math.round(instantCount   / totalBookings * 100) : 0 },
    { name: "Scheduled", value: scheduledCount, pct: totalBookings > 0 ? Math.round(scheduledCount / totalBookings * 100) : 0 },
  ];

  const title    = companyName === "all" ? "All Companies" : companyName;
  const initials = companyName === "all" ? "ALL" : companyName.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const dateLabel = `${new Date(dateFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} — ${new Date(dateTo).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;

  const supervisorName = useMemo(
    () => (id: string | null | undefined) => supervisors.find((s) => s.id === id)?.name || "Unknown",
    [supervisors],
  );

  const driverFor = useMemo(
    () => (b: Booking) => {
      const driver = b.driverId ? drivers.find((d) => d.id === b.driverId) : null;
      return {
        name:        driver?.name ?? null,
        vehicle:     driver?.vehicle ?? null,
        vehicleReg:  driver?.vehicleReg ?? null,
        vehicleType: driver?.vehicleType ?? null,
        phone:       b.driverPhone ?? driver?.phone ?? null,
      };
    },
    [drivers],
  );

  const renderers = useMemo(
    () => buildTripRenderers(supervisorName, driverFor),
    [supervisorName, driverFor],
  );

  const filteredTrips = useMemo(() => {
    const q = search.toLowerCase();
    return completedBookings
      .filter((b) => {
        if (!q) return true;
        const driver = b.driverId ? drivers.find((d) => d.id === b.driverId) : null;
        const driverName = driver?.name || "";
        const driverPhone = (b.driverPhone ?? driver?.phone ?? "").toLowerCase();
        const vehicleModel = driver?.vehicle || "";
        const vehicleReg = driver?.vehicleReg || "";
        const company = b.bookingSource || "";
        const supervisor = supervisorName(b.supervisorId);
        return (
          b.id.toLowerCase().includes(q) ||
          (b.bookingRef?.toLowerCase().includes(q) ?? false) ||
          b.pickupLocation.toLowerCase().includes(q) ||
          b.dropLocation.toLowerCase().includes(q) ||
          driverName.toLowerCase().includes(q) ||
          driverPhone.includes(q) ||
          vehicleModel.toLowerCase().includes(q) ||
          vehicleReg.toLowerCase().replace(/\s+/g, "").includes(q.replace(/\s+/g, "")) ||
          company.toLowerCase().includes(q) ||
          supervisor.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [completedBookings, search, supervisorName, drivers]);

  function handleExportTrips() {
    const rows = filteredTrips.map((b) => {
      const out: Record<string, string | number | null> = {};
      for (const k of visibleCols) {
        const col = tripsSpec.columns.find((c) => c.key === k);
        if (!col) continue;

        const r = (renderers as Record<string, { csv: (b: Booking) => string | number }>)[k];
        out[col.label] = r ? r.csv(b) : null;
      }
      return out;
    });
    exportToXlsx(`company-${companyName.replace(/\s+/g, "-").toLowerCase()}-trips-${dateFrom}-to-${dateTo}`, rows, "Trips");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Company identity card */}
      <Card style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 50, height: 50, borderRadius: 12, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, color: A, flexShrink: 0, letterSpacing: 0.5 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{title}</div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>Corporate account</div>
          </div>
        </div>
        <Badge label="Corporate" color="#1D4ED8" bg="#EFF6FF" dot="#3B82F6" />
      </Card>

      {/* Filters row */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
        {tab === "Trips" && (
          <>
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search by ID, route, name, vehicle, company..."
              className="ml-2"
            />
            <ColumnsPopover
              tableKey={tripsTableKey}
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

      {/* Tab bar */}
      <div style={{ display: "flex", borderBottom: "1.5px solid #E8EEF4" }}>
        {COMPANY_TABS.map((t) => (
          <button key={t} onClick={() => {
            setTab(t);
          }}
            style={{
              padding: "10px 20px", border: "none",
              borderBottom: tab === t ? `2.5px solid ${A}` : "2.5px solid transparent",
              marginBottom: -1.5, cursor: "pointer", fontFamily: "inherit", fontSize: 14,
              fontWeight: tab === t ? 700 : 500, background: "transparent",
              color: tab === t ? A : "#64748B", transition: "color 0.15s",
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === "Overview" && (
        isReportLoading ? <ReportSkeleton statCount={3} /> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              <StatCard label="Total Trips" value={String(totalBookings)} sub="In selected period" iconBg="#F1F5F9"
                icon={<Route size={17} color="#64748B" strokeWidth={1.4} />} />
              <StatCard label="Total Fare" value={totalSpend > 0 ? fmt(totalSpend) : "—"} sub="Across all trips" iconBg="#F1F5F9"
                icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="2" stroke="#64748B" strokeWidth="1.4" /><path d="M1 7h14" stroke="#64748B" strokeWidth="1.4" /><circle cx="12.5" cy="10" r="1" fill="#64748B" /></svg>} />
              <StatCard label="Avg Fare" value={avgFare > 0 ? fmt(avgFare) : "—"} sub="Per completed trip" iconBg="#F1F5F9"
                icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2 12L6 8l3 3 5-7" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
              <Card style={{ padding: "20px 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>Trips over time</div>
                    <div style={{ fontSize: 11.5, color: "#94A3B8" }}>Daily trip volume</div>
                  </div>
                  <div style={{ fontSize: 11, color: "#94A3B8", textAlign: "right" }}>
                    <strong style={{ display: "block", fontSize: 18, color: "#0F172A", fontWeight: 600, fontVariantNumeric: "tabular-nums", marginBottom: 2 }}>{totalBookings}</strong>
                    trips
                  </div>
                </div>
                {dailyData.length > 0
                  ? <div style={{ height: 220 }}><SvgBarChart data={dailyData as Record<string, unknown>[]} xKey="d" yKey="bookings" color={A} yLabel="Trips" /></div>
                  : <EmptyState msg="No daily data for this period" />}
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
                  <div style={{ fontSize: 11.5, color: "#94A3B8" }}>Daily fare totals</div>
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8", textAlign: "right" }}>
                  <strong style={{ display: "block", fontSize: 18, color: "#0F172A", fontWeight: 600, fontVariantNumeric: "tabular-nums", marginBottom: 2 }}>{totalSpend > 0 ? fmtINRk(totalSpend) : "—"}</strong>
                  total
                </div>
              </div>
              {dailyData.length > 0
                ? <div style={{ height: 220 }}><SvgBarChart data={dailyData as Record<string, unknown>[]} xKey="d" yKey="spend" color={A} yFormat={fmtINRk} yLabel="Spend" /></div>
                : <EmptyState msg="No spend data for this period" />}
            </Card>
          </div>
        )
      )}

      {/* ── Trips tab ── */}
      {tab === "Trips" && (
          <TripsTable
            items={filteredTrips}
            visibleCols={visibleCols}
            renderers={renderers}
            tableKey={tripsTableKey}
            isLoading={false}
            prefsLoading={prefsLoading}
            emptyMessage="No completed trips in this date range"
            onRowClick={setSelectedBooking}
          />
      )}
      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE — tab-switch modal (mirrors superadmin pattern)
══════════════════════════════════════════════════════════════ */
type ReportType = "supervisor" | "company";

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const requestedReportType: ReportType = searchParams.get("type") === "company" ? "company" : "supervisor";
  const { supervisors } = useVendor();

  const [companies, setCompanies] = useState<CompanyApiItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    companiesApi.list()
      .then((res) => { if (!cancelled) setCompanies(res.data); })
      .catch(()   => { if (!cancelled) setCompanies([]); });
    return () => { cancelled = true; };
  }, []);

  const [modalOpen,  setModalOpen]  = useState(true);
  const [supQ,       setSupQ]       = useState("");
  const [compQ,      setCompQ]      = useState("");
  const [reportType, setReportType] = useState<ReportType>("supervisor");
  const [selId,      setSelId]      = useState<string | null>(null);

  const hasReport = selId !== null;

  useEffect(() => {
    queueMicrotask(() => {
      setSupQ("");
      setCompQ("");
      setReportType(requestedReportType);
      setSelId(null);
      setModalOpen(true);
    });
  }, [requestedReportType]);

  function openModal(type: ReportType = reportType) {
    setSupQ("");
    setCompQ("");
    setReportType(type);
    setModalOpen(true);
  }
  function pickEntity(type: ReportType, id: string) {
    setReportType(type);
    setSelId(id);
    setModalOpen(false);
  }

  const filteredSupervisors = useMemo(() => {
    const q = supQ.toLowerCase();
    return !q ? supervisors : supervisors.filter((s) =>
      s.name.toLowerCase().includes(q) || (s.zone ?? "").toLowerCase().includes(q),
    );
  }, [supervisors, supQ]);

  const filteredCompanies = useMemo(() => {
    const q = compQ.toLowerCase();
    return !q ? companies : companies.filter((c) => c.name.toLowerCase().includes(q));
  }, [companies, compQ]);

  const reportLabel = selId === null ? "" :
    reportType === "supervisor"
      ? (selId === "all" ? "All Supervisors" : supervisors.find((s) => s.id === selId)?.name ?? selId)
      : (selId === "all" ? "All Companies"   : selId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: FONT }}>

      {!hasReport ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", maxWidth: 380 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="4" width="20" height="20" rx="4" stroke={A} strokeWidth="1.8" />
                <path d="M9 10h10M9 14h7M9 18h5" stroke={A} strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>No report selected</div>
            <div style={{ fontSize: 13.5, color: "#94A3B8", lineHeight: 1.7, marginBottom: 24 }}>
              Choose a supervisor or company to view trips, spend breakdown and analytics
            </div>
            <button onClick={() => openModal()} style={{ padding: "11px 28px", background: A, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Generate Report
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "#64748B" }}>
              Showing report for{" "}
              <span style={{ fontWeight: 700, color: "#0F172A" }}>{reportLabel}</span>
              <span style={{ marginLeft: 6, fontSize: 12, color: "#94A3B8" }}>
                ({reportType === "supervisor" ? "Supervisor" : "Company"})
              </span>
            </div>
            <button onClick={() => openModal()}
              style={{ padding: "7px 16px", background: "#fff", color: "#475569", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Change Report
            </button>
          </div>
          {reportType === "supervisor"
            ? <PanelSupervisorReport supervisorId={selId!} />
            : <PanelCompanyReport    companyName={selId!} />}
        </div>
      )}

      {/* ── MODAL ── */}
      {modalOpen && (
        <div onClick={(e) => { if (e.target === e.currentTarget && hasReport) setModalOpen(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: 480, maxWidth: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.20)", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", padding: "18px 22px 0", flexShrink: 0 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Generate Report</div>
                <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 1 }}>
                  {reportType === "supervisor" ? "Select a supervisor to view their report" : "Select a company to view their report"}
                </div>
              </div>
              {hasReport && (
                <button onClick={() => setModalOpen(false)}
                  style={{ width: 34, height: 34, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </button>
              )}
            </div>

            {/* Supervisor panel */}
            {reportType === "supervisor" && (
              <>
                <div style={{ padding: "14px 22px 8px", flexShrink: 0 }}>
                  <div style={{ position: "relative" }}>
                    <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 15 15" fill="none">
                      <circle cx="6.5" cy="6.5" r="4.5" stroke="#94A3B8" strokeWidth="1.4" />
                      <path d="M10.5 10.5L13 13" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <input value={supQ} onChange={(e) => setSupQ(e.target.value)}
                      placeholder="Search supervisor or zone…" autoFocus
                      style={{ width: "100%", padding: "9px 14px 9px 32px", border: "1.5px solid #E2E8F0", borderRadius: 10, fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", color: "#374151", outline: "none", boxSizing: "border-box" }} />
                    {supQ && (
                      <button onClick={() => setSupQ("")}
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 0, lineHeight: 1 }}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" /></svg>
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ overflowY: "auto", flex: 1 }}>
                  <div onClick={() => pickEntity("supervisor", "all")}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                    style={{ padding: "13px 22px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", transition: "background 0.12s" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>All Supervisors</div>
                    <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 1 }}>Aggregated report across all supervisors</div>
                  </div>
                  {filteredSupervisors.length === 0
                    ? <EmptyState msg="No supervisors found" />
                    : filteredSupervisors.map((s, i) => (
                      <div key={i} onClick={() => pickEntity("supervisor", s.id)}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                        style={{ padding: "13px 22px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 12, transition: "background 0.12s" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{s.name}</div>
                          <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 1 }}>{s.zone}</div>
                        </div>
                        <Badge label={s.status}
                          color={s.status === "Active" ? "#15803D" : "#64748B"}
                          bg={s.status === "Active" ? "#DCFCE7" : "#F1F5F9"}
                          dot={s.status === "Active" ? "#22C55E" : "#94A3B8"} />
                      </div>
                    ))}
                </div>
              </>
            )}

            {/* Company panel */}
            {reportType === "company" && (
              <>
                <div style={{ padding: "14px 22px 8px", flexShrink: 0 }}>
                  <div style={{ position: "relative" }}>
                    <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 15 15" fill="none">
                      <circle cx="6.5" cy="6.5" r="4.5" stroke="#94A3B8" strokeWidth="1.4" />
                      <path d="M10.5 10.5L13 13" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <input value={compQ} onChange={(e) => setCompQ(e.target.value)}
                      placeholder="Search company…" autoFocus
                      style={{ width: "100%", padding: "9px 14px 9px 32px", border: "1.5px solid #E2E8F0", borderRadius: 10, fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", color: "#374151", outline: "none", boxSizing: "border-box" }} />
                    {compQ && (
                      <button onClick={() => setCompQ("")}
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 0, lineHeight: 1 }}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" /></svg>
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ overflowY: "auto", flex: 1 }}>
                  <div onClick={() => pickEntity("company", "all")}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                    style={{ padding: "13px 22px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", transition: "background 0.12s" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>All Companies</div>
                    <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 1 }}>Aggregated report across all corporate accounts</div>
                  </div>
                  {filteredCompanies.length === 0
                    ? <EmptyState msg="No companies found for this vendor" />
                    : filteredCompanies.map((c) => (
                      <div key={c.id} onClick={() => pickEntity("company", c.name)}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                        style={{ padding: "13px 22px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 12, transition: "background 0.12s" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{c.name}</div>
                        </div>
                        <Badge label={c.status === "Active" ? "Corporate" : c.status} color="#1D4ED8" bg="#EFF6FF" dot="#3B82F6" />
                      </div>
                    ))}
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

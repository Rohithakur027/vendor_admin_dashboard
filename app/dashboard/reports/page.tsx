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
    <div className="flex flex-col gap-4">
      {/* Company identity card */}
      <Card style={{ padding: "20px 24px" }} className="flex items-center gap-4 flex-wrap justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-[50px] h-[50px] rounded-xl bg-[#EFF6FF] flex items-center justify-center font-extrabold text-[15px] shrink-0 tracking-[0.5px]" style={{ color: A }}>
            {initials}
          </div>
          <div>
            <div className="text-[18px] font-extrabold text-slate-900">{title}</div>
            <div className="text-[12px] text-slate-500 mt-[3px]">Corporate account</div>
          </div>
        </div>
        <Badge label="Corporate" color="#1D4ED8" bg="#EFF6FF" dot="#3B82F6" />
      </Card>

      {/* Filters row */}
      <div className="flex gap-[10px] items-center">
        <div className="relative">
          <button onClick={() => setShowPicker((v) => !v)}
            className="inline-flex items-center gap-[7px] px-3 py-[7px] bg-white border-[1.5px] border-[#E2E8F0] rounded-[9px] text-[12.5px] text-slate-600 font-[inherit] cursor-pointer outline-none">
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
      <div className="flex border-b-[1.5px] border-[#E8EEF4]">
        {COMPANY_TABS.map((t) => (
          <button key={t} onClick={() => {
            setTab(t);
          }}
            className="px-5 py-[10px] border-none font-[inherit] text-[14px] bg-transparent transition-colors duration-[150ms] cursor-pointer"
            style={{
              borderBottom: tab === t ? `2.5px solid ${A}` : "2.5px solid transparent",
              marginBottom: -1.5,
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? A : "#64748B",
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {tab === "Overview" && (
        isReportLoading ? <ReportSkeleton statCount={3} /> : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Total Trips" value={String(totalBookings)} sub="In selected period" iconBg="#F1F5F9"
                icon={<Route size={17} color="#64748B" strokeWidth={1.4} />} />
              <StatCard label="Total Fare" value={totalSpend > 0 ? fmt(totalSpend) : "—"} sub="Across all trips" iconBg="#F1F5F9"
                icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="2" stroke="#64748B" strokeWidth="1.4" /><path d="M1 7h14" stroke="#64748B" strokeWidth="1.4" /><circle cx="12.5" cy="10" r="1" fill="#64748B" /></svg>} />
              <StatCard label="Avg Fare" value={avgFare > 0 ? fmt(avgFare) : "—"} sub="Per completed trip" iconBg="#F1F5F9"
                icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2 12L6 8l3 3 5-7" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
            </div>

            <div className="grid grid-cols-[2fr_1fr] gap-4">
              <Card style={{ padding: "20px 22px" }}>
                <div className="flex justify-between items-start mb-[18px]">
                  <div>
                    <div className="text-[13.5px] font-semibold text-slate-900 mb-1">Trips over time</div>
                    <div className="text-[11.5px] text-slate-400">Daily trip volume</div>
                  </div>
                  <div className="text-[11px] text-slate-400 text-right">
                    <strong className="block text-[18px] text-slate-900 font-semibold tabular-nums mb-0.5">{totalBookings}</strong>
                    trips
                  </div>
                </div>
                {dailyData.length > 0
                  ? <div className="h-[220px]"><SvgBarChart data={dailyData as Record<string, unknown>[]} xKey="d" yKey="bookings" color={A} yLabel="Trips" /></div>
                  : <EmptyState msg="No daily data for this period" />}
              </Card>
              <Card style={{ padding: "20px 22px" }}>
                <div className="mb-2">
                  <div className="text-[13.5px] font-semibold text-slate-900 mb-1">Instant vs Scheduled</div>
                  <div className="text-[11.5px] text-slate-400">Trip type split</div>
                </div>
                <div className="relative">
                  <SvgDonut data={bookingTypeData} colors={[A, "#93C5FD"]} size={190} thickness={26} valueFormat={(v) => `${v} trip${v === 1 ? "" : "s"}`} />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <div className="text-[26px] font-semibold text-slate-900 tabular-nums">{totalBookings}</div>
                    <div className="text-[10.5px] text-slate-400 mt-0.5 uppercase tracking-[0.06em] font-medium">Total</div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 mt-3.5">
                  {bookingTypeData.map((b, i) => (
                    <div key={b.name} className="grid grid-cols-[14px_1fr_auto_auto] items-center gap-[10px] text-[12.5px]">
                      <div className="w-[10px] h-[10px] rounded-[3px]" style={{ background: i === 0 ? A : "#93C5FD" }} />
                      <span className="text-slate-600 font-medium">{b.name}</span>
                      <span className="text-slate-400 tabular-nums text-[11.5px]">{b.pct}%</span>
                      <span className="text-slate-900 font-semibold tabular-nums">{b.value}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card style={{ padding: "20px 22px" }}>
              <div className="flex justify-between items-start mb-[18px]">
                <div>
                  <div className="text-[13.5px] font-semibold text-slate-900 mb-1">Daily spend breakdown</div>
                  <div className="text-[11.5px] text-slate-400">Daily fare totals</div>
                </div>
                <div className="text-[11px] text-slate-400 text-right">
                  <strong className="block text-[18px] text-slate-900 font-semibold tabular-nums mb-0.5">{totalSpend > 0 ? fmtINRk(totalSpend) : "—"}</strong>
                  total
                </div>
              </div>
              {dailyData.length > 0
                ? <div className="h-[220px]"><SvgBarChart data={dailyData as Record<string, unknown>[]} xKey="d" yKey="spend" color={A} yFormat={fmtINRk} yLabel="Spend" /></div>
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
    <div className="flex flex-col h-full" style={{ fontFamily: FONT }}>

      {!hasReport ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-[380px]">
            <div className="w-16 h-16 rounded-[20px] bg-[#EFF6FF] flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="4" width="20" height="20" rx="4" stroke={A} strokeWidth="1.8" />
                <path d="M9 10h10M9 14h7M9 18h5" stroke={A} strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-[20px] font-extrabold text-slate-900 mb-2">No report selected</div>
            <div className="text-[13.5px] text-slate-400 leading-[1.7] mb-6">
              Choose a supervisor or company to view trips, spend breakdown and analytics
            </div>
            <button onClick={() => openModal()} className="px-7 py-[11px] text-white border-none rounded-[10px] text-[14px] font-bold cursor-pointer font-[inherit]" style={{ background: A }}>
              Generate Report
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-5">
            <div className="text-[13px] text-slate-600">
              Showing report for{" "}
              <span className="font-bold text-slate-900">{reportLabel}</span>
              <span className="ml-1.5 text-[12px] text-slate-400">
                ({reportType === "supervisor" ? "Supervisor" : "Company"})
              </span>
            </div>
            <button onClick={() => openModal()}
              className="px-4 py-[7px] bg-white text-slate-600 border-[1.5px] border-[#E2E8F0] rounded-lg text-[13px] font-semibold cursor-pointer font-[inherit]">
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
          className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-slate-900/45">
          <div className="bg-white rounded-[20px] w-[480px] max-w-full max-h-[88vh] flex flex-col overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.20)]">

            {/* Header */}
            <div className="flex items-center px-[22px] pt-[18px] shrink-0">
              <div className="flex-1">
                <div className="text-[15px] font-extrabold text-slate-900">Generate Report</div>
                <div className="text-[11.5px] text-slate-400 mt-px">
                  {reportType === "supervisor" ? "Select a supervisor to view their report" : "Select a company to view their report"}
                </div>
              </div>
              {hasReport && (
                <button onClick={() => setModalOpen(false)}
                  className="w-[34px] h-[34px] rounded-[9px] border-[1.5px] border-[#E2E8F0] bg-slate-50 cursor-pointer flex items-center justify-center shrink-0">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </button>
              )}
            </div>

            {/* Supervisor panel */}
            {reportType === "supervisor" && (
              <>
                <div className="px-[22px] pt-[14px] pb-2 shrink-0">
                  <div className="relative">
                    <svg className="absolute left-[10px] top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 15 15" fill="none">
                      <circle cx="6.5" cy="6.5" r="4.5" stroke="#94A3B8" strokeWidth="1.4" />
                      <path d="M10.5 10.5L13 13" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <input value={supQ} onChange={(e) => setSupQ(e.target.value)}
                      placeholder="Search supervisor or zone…" autoFocus
                      className="w-full py-[9px] pr-[14px] pl-8 border-[1.5px] border-[#E2E8F0] rounded-[10px] text-[13px] font-[inherit] bg-[#FAFBFC] text-[#374151] outline-none box-border" />
                    {supQ && (
                      <button onClick={() => setSupQ("")}
                        className="absolute right-[10px] top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-slate-400 p-0 leading-none">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" /></svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">
                  <div onClick={() => pickEntity("supervisor", "all")}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                    className="px-[22px] py-[13px] cursor-pointer border-b border-[#F1F5F9] transition-[background] duration-[120ms]">
                    <div className="text-[14px] font-bold text-slate-900">All Supervisors</div>
                    <div className="text-[11.5px] text-slate-400 mt-px">Aggregated report across all supervisors</div>
                  </div>
                  {filteredSupervisors.length === 0
                    ? <EmptyState msg="No supervisors found" />
                    : filteredSupervisors.map((s, i) => (
                      <div key={i} onClick={() => pickEntity("supervisor", s.id)}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                        className="px-[22px] py-[13px] cursor-pointer border-b border-[#F1F5F9] flex items-center gap-3 transition-[background] duration-[120ms]">
                        <div className="flex-1">
                          <div className="text-[14px] font-bold text-slate-900">{s.name}</div>
                          <div className="text-[11.5px] text-slate-400 mt-px">{s.zone}</div>
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
                <div className="px-[22px] pt-[14px] pb-2 shrink-0">
                  <div className="relative">
                    <svg className="absolute left-[10px] top-1/2 -translate-y-1/2 pointer-events-none" width="14" height="14" viewBox="0 0 15 15" fill="none">
                      <circle cx="6.5" cy="6.5" r="4.5" stroke="#94A3B8" strokeWidth="1.4" />
                      <path d="M10.5 10.5L13 13" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <input value={compQ} onChange={(e) => setCompQ(e.target.value)}
                      placeholder="Search company…" autoFocus
                      className="w-full py-[9px] pr-[14px] pl-8 border-[1.5px] border-[#E2E8F0] rounded-[10px] text-[13px] font-[inherit] bg-[#FAFBFC] text-[#374151] outline-none box-border" />
                    {compQ && (
                      <button onClick={() => setCompQ("")}
                        className="absolute right-[10px] top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-slate-400 p-0 leading-none">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" /></svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">
                  <div onClick={() => pickEntity("company", "all")}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                    className="px-[22px] py-[13px] cursor-pointer border-b border-[#F1F5F9] transition-[background] duration-[120ms]">
                    <div className="text-[14px] font-bold text-slate-900">All Companies</div>
                    <div className="text-[11.5px] text-slate-400 mt-px">Aggregated report across all corporate accounts</div>
                  </div>
                  {filteredCompanies.length === 0
                    ? <EmptyState msg="No companies found for this vendor" />
                    : filteredCompanies.map((c) => (
                      <div key={c.id} onClick={() => pickEntity("company", c.name)}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                        className="px-[22px] py-[13px] cursor-pointer border-b border-[#F1F5F9] flex items-center gap-3 transition-[background] duration-[120ms]">
                        <div className="flex-1">
                          <div className="text-[14px] font-bold text-slate-900">{c.name}</div>
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

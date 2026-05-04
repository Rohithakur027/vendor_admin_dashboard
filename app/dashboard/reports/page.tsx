"use client";

import { useState, useMemo, useEffect } from "react";
import { useVendor } from "@/context/VendorContext";
import { reportsApi, companiesApi, type CompanyReportData, type CompanyApiItem } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  A, FONT, fmt, fmtINRk, toIsoDate, inRange,
  Card, StatCard, Badge, EmptyState, ReportSkeleton,
} from "@/modules/reports/primitives";
import { SvgBarChart, SvgDonut } from "@/modules/reports/charts";
import { DateRangePicker } from "@/modules/reports/DateRangePicker";
import { PanelSupervisorReport } from "@/modules/reports/PanelSupervisorReport";
import { Route } from "lucide-react";

/* ══════════════════════════════════════════════════════════════
   COMPANY REPORT PANEL
══════════════════════════════════════════════════════════════ */
function PanelCompanyReport({ companyName }: { companyName: string }) {
  const { bookings } = useVendor();
  const [showPicker,  setShowPicker]  = useState(false);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return toIsoDate(d); });
  const [dateTo,   setDateTo]   = useState(() => toIsoDate(new Date()));
  const [companyFilter, setCompanyFilter] = useState<string>(companyName);
  const [companies,  setCompanies]  = useState<CompanyApiItem[]>([]);
  const [loading,    setLoading]    = useState<boolean>(companyName !== "all");
  const [reportData, setReportData] = useState<CompanyReportData | null>(null);

  useEffect(() => { setCompanyFilter(companyName); }, [companyName]);

  // Load real companies for this vendor (replaces bookingSource derivation).
  useEffect(() => {
    let cancelled = false;
    companiesApi.list()
      .then((res) => { if (!cancelled) setCompanies(res.data); })
      .catch(()   => { if (!cancelled) setCompanies([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (companyFilter === "all") { setReportData(null); return; }
    let cancelled = false;
    setLoading(true);
    reportsApi.getCompany(companyFilter, dateFrom, dateTo)
      .then((res)  => { if (!cancelled) setReportData(res.data); })
      .catch(()    => { if (!cancelled) setReportData(null); })
      .finally(()  => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyFilter, dateFrom, dateTo]);

  const filteredBookings = useMemo(() =>
    bookings.filter((b) => {
      if (!inRange(new Date(b.createdAt), dateFrom, dateTo)) return false;
      if (companyFilter === "all") return !!b.bookingSource && b.bookingSource !== "Individual";
      return b.bookingSource === companyFilter;
    }),
  [bookings, companyFilter, dateFrom, dateTo]);

  const totalBookings  = reportData?.kpis.totalBookings     ?? filteredBookings.length;
  const completedCount = reportData?.kpis.completedBookings ?? filteredBookings.filter((b) => b.status === "Completed").length;
  const totalSpend     = reportData?.kpis.totalMoneySpent   ?? filteredBookings.reduce((s, b) => s + (b.fare || 0), 0);
  const avgFare        = reportData?.kpis.avgBookingFare    ?? (completedCount > 0 ? Math.round(totalSpend / completedCount) : 0);

  const dailyData = useMemo(() => {
    if (reportData && reportData.dailyStats.length > 0) {
      const raw  = reportData.dailyStats;
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
        const dayBkgs = filteredBookings.filter((b) => b.createdAt.split("T")[0] === d);
        return {
          d:        new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
          bookings: dayBkgs.length,
          spend:    dayBkgs.reduce((s, b) => s + (b.fare || 0), 0),
        };
      });
  }, [reportData, filteredBookings, dateFrom, dateTo]);

  const instantCount   = reportData?.bookingTypeSplit.instant   ?? filteredBookings.filter((b) => b.type === "Instant").length;
  const scheduledCount = reportData?.bookingTypeSplit.scheduled ?? filteredBookings.filter((b) => b.type === "Scheduled").length;
  const bookingTypeData = [
    { name: "Instant",   value: instantCount,   pct: totalBookings > 0 ? Math.round(instantCount   / totalBookings * 100) : 0 },
    { name: "Scheduled", value: scheduledCount, pct: totalBookings > 0 ? Math.round(scheduledCount / totalBookings * 100) : 0 },
  ];

  const title    = companyFilter === "all" ? "All Companies" : companyFilter;
  const initials = companyFilter === "all" ? "ALL" : companyFilter.split(" ").map((w) => w[0]).slice(0, 2).join("");
  const dateLabel = `${new Date(dateFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} — ${new Date(dateTo).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;

  if (loading) return <ReportSkeleton statCount={4} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Select value={companyFilter} onValueChange={(v) => setCompanyFilter(v ?? "all")}>
          <SelectTrigger className="h-[34px] min-w-[200px] bg-white border-[1.5px] border-slate-200 rounded-[9px] text-[12.5px] text-slate-900 font-medium">
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      </div>

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
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE — type + entity picker
══════════════════════════════════════════════════════════════ */
type ReportType = "supervisor" | "company";

export default function ReportsPage() {
  const { supervisors } = useVendor();

  // Real companies from the vendor's companies table.
  const [companies, setCompanies] = useState<CompanyApiItem[]>([]);
  useEffect(() => {
    let cancelled = false;
    companiesApi.list()
      .then((res) => { if (!cancelled) setCompanies(res.data); })
      .catch(()   => { if (!cancelled) setCompanies([]); });
    return () => { cancelled = true; };
  }, []);

  const [modalOpen,  setModalOpen]  = useState(true);
  const [modalStep,  setModalStep]  = useState<1 | 2>(1);
  const [reportType, setReportType] = useState<ReportType>("supervisor");
  const [search,     setSearch]     = useState("");
  const [selId,      setSelId]      = useState<string | null>(null); // supervisor id OR company name

  const hasReport = selId !== null;

  function openModal()         { setSearch(""); setModalStep(1); setModalOpen(true); }
  function pickType(t: ReportType) { setReportType(t); setSearch(""); setModalStep(2); }
  function pickEntity(id: string)  { setSelId(id); setModalOpen(false); }
  function closeModal()        { if (hasReport) setModalOpen(false); }

  const filteredSupervisors = supervisors.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.zone.toLowerCase().includes(q);
  });
  const filteredCompanies = companies.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const reportLabel = selId === null ? "" :
    reportType === "supervisor"
      ? (selId === "all" ? "All Supervisors" : supervisors.find((s) => s.id === selId)?.name ?? selId)
      : (selId === "all" ? "All Companies" : selId);

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
            <button onClick={openModal} style={{ padding: "11px 28px", background: A, color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
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
            <button onClick={openModal}
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
        <div onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: 480, maxWidth: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.20)", overflow: "hidden" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 22px", borderBottom: "1.5px solid #F1F5F9", flexShrink: 0 }}>
              {modalStep === 2 && (
                <button onClick={() => setModalStep(1)}
                  style={{ width: 30, height: 30, borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>
                  {modalStep === 1 ? "Generate Report" : reportType === "supervisor" ? "Select Supervisor" : "Select Company"}
                </div>
                <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 1 }}>
                  {modalStep === 1 ? "Choose the report type" : "Pick one to view their report"}
                </div>
              </div>
              {hasReport && (
                <button onClick={closeModal}
                  style={{ width: 34, height: 34, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" /></svg>
                </button>
              )}
            </div>

            {/* Step 1 — type selector */}
            {modalStep === 1 && (
              <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
                {([
                  {
                    type: "supervisor" as ReportType,
                    title: "Supervisor Report",
                    desc:  "View trips, spend and company breakdown per supervisor",
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <circle cx="11" cy="8" r="4" stroke="#94A3B8" strokeWidth="1.6" />
                        <path d="M4 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    ),
                    bg: "#F8FAFC", border: "#E2E8F0",
                  },
                  {
                    type: "company" as ReportType,
                    title: "Company Report",
                    desc:  "View trips, spend and supervisor breakdown per company",
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <rect x="3" y="6" width="16" height="13" rx="2" stroke="#94A3B8" strokeWidth="1.6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="#94A3B8" strokeWidth="1.6" />
                        <path d="M7 11h8M7 14.5h5" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    ),
                    bg: "#F8FAFC", border: "#E2E8F0",
                  },
                ] as const).map((opt) => (
                  <div key={opt.type} onClick={() => pickType(opt.type)}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = opt.bg}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "#FAFBFC"}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", border: `1.5px solid ${opt.border}`, borderRadius: 14, cursor: "pointer", background: "#FAFBFC", transition: "background 0.12s" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: opt.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {opt.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{opt.title}</div>
                      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{opt.desc}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#CBD5E1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                ))}
              </div>
            )}

            {/* Step 2 — entity list */}
            {modalStep === 2 && (
              <>
                <div style={{ padding: "12px 22px 8px", flexShrink: 0 }}>
                  <div style={{ position: "relative" }}>
                    <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} width="14" height="14" viewBox="0 0 15 15" fill="none">
                      <circle cx="6.5" cy="6.5" r="4.5" stroke="#94A3B8" strokeWidth="1.4" />
                      <path d="M10.5 10.5L13 13" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                      placeholder={reportType === "supervisor" ? "Search supervisor or zone…" : "Search company…"}
                      autoFocus
                      style={{ width: "100%", padding: "8px 14px 8px 30px", border: "1.5px solid #E2E8F0", borderRadius: 9, fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", color: "#374151", outline: "none", boxSizing: "border-box" }} />
                  </div>
                </div>

                <div style={{ overflowY: "auto", flex: 1 }}>
                  {reportType === "supervisor" ? (
                    <>
                      <div onClick={() => pickEntity("all")}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                        style={{ padding: "13px 22px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 12, transition: "background 0.12s" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>All Supervisors</div>
                          <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 1 }}>Aggregated report across all supervisors</div>
                        </div>
                      </div>
                      {filteredSupervisors.length === 0
                        ? <EmptyState msg="No supervisors found" />
                        : filteredSupervisors.map((s, i) => (
                          <div key={i} onClick={() => pickEntity(s.id)}
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
                    </>
                  ) : (
                    <>
                      <div onClick={() => pickEntity("all")}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                        style={{ padding: "13px 22px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 12, transition: "background 0.12s" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>All Companies</div>
                          <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 1 }}>Aggregated report across all corporate accounts</div>
                        </div>
                      </div>
                      {filteredCompanies.length === 0
                        ? <EmptyState msg="No companies found for this vendor" />
                        : filteredCompanies.map((c) => (
                          <div key={c.id} onClick={() => pickEntity(c.name)}
                            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                            style={{ padding: "13px 22px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 12, transition: "background 0.12s" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{c.name}</div>
                            </div>
                            <Badge label={c.status === "Active" ? "Corporate" : c.status} color="#1D4ED8" bg="#EFF6FF" dot="#3B82F6" />
                          </div>
                        ))}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

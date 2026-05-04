"use client";

import { useState, useMemo, useEffect } from "react";
import { useVendor } from "@/context/VendorContext";
import { reportsApi, type SupervisorSummaryData } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  A, fmt, fmtINRk, toIsoDate,
  Card, StatCard, Badge, EmptyState, ReportSkeleton,
} from "./primitives";
import { SvgBarChart, SvgDonut } from "./charts";
import { DateRangePicker } from "./DateRangePicker";
import { Route } from "lucide-react";

export function PanelSupervisorReport({
  supervisorId,
  hideHeader = false,
  hideSupervisorPicker = false,
}: {
  supervisorId: string;
  hideHeader?: boolean;
  hideSupervisorPicker?: boolean;
}) {
  const { supervisors } = useVendor();
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

  if (loading) return <ReportSkeleton hideHeader={hideHeader} statCount={3} />;

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
      </div>

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

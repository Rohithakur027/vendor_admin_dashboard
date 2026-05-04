"use client";

import { useState, useMemo, useEffect } from "react";
import { useVendor } from "@/context/VendorContext";
import type { Driver } from "@/modules/drivers/types";
import {
  vendorReportApi,
  superadminApi,
  type VendorListItem,
  type VendorReportData,
  type VendorWalletTx,
  type VendorBookingItem,
  type DriverApiItem,
} from "@/lib/api";
import { Route } from "lucide-react";
import { SvgBarChart as SharedSvgBarChart, SvgDonut as SharedSvgDonut } from "@/modules/reports/charts";
import { DateRangePicker as SharedDateRangePicker } from "@/modules/reports/DateRangePicker";
import { ReportSkeleton as SharedReportSkeleton } from "@/modules/reports/primitives";

const A    = "#2563EB";
const FONT = "var(--font-plus-jakarta-sans),'Plus Jakarta Sans',sans-serif";
const fmt  = (n: number) => "₹" + Number(n).toLocaleString("en-IN");

/* ══════════════════════════════════════════════════════════════
   SHARED UI
══════════════════════════════════════════════════════════════ */
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:"#fff", border:"1.5px solid #E8EEF4", borderRadius:14, boxShadow:"0 1px 6px rgba(0,0,0,0.04)", ...style }}>
      {children}
    </div>
  );
}
function StatCard({ label, value, sub, icon, iconBg }: {
  label:string; value:string|number; sub?:string; icon:React.ReactNode; iconBg?:string;
}) {
  return (
    <Card style={{ padding:"18px 20px", flex:1, display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:0.7 }}>{label}</div>
        <div style={{ width:34, height:34, borderRadius:10, background:iconBg||"#F8FAFC", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{icon}</div>
      </div>
      <div style={{ fontSize:28, fontWeight:800, color:"#0F172A", lineHeight:1, letterSpacing:-0.5 }}>{value}</div>
      {sub && <div style={{ fontSize:11.5, color:"#94A3B8" }}>{sub}</div>}
    </Card>
  );
}
function Badge({ label, color, bg, dot }: { label:string; color:string; bg:string; dot?:string }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:bg, color, padding:"3px 10px", borderRadius:20, fontSize:11.5, fontWeight:700, whiteSpace:"nowrap" }}>
      {dot && <span style={{ width:5, height:5, borderRadius:"50%", background:dot, flexShrink:0 }}/>}
      {label}
    </span>
  );
}
function TxTypeBadge({ type }:{ type:string }) {
  const m:Record<string,{bg:string;color:string;dot:string}> = {
    "Money Added":{bg:"#DCFCE7",color:"#15803D",dot:"#22C55E"},
    "Trip Payment":{bg:"#FEE2E2",color:"#B91C1C",dot:"#EF4444"},
    "Refund":{bg:"#DBEAFE",color:"#1D4ED8",dot:"#3B82F6"},
    "Adjustment":{bg:"#F1F5F9",color:"#475569",dot:"#94A3B8"},
  };
  const s = m[type]||m["Adjustment"];
  return <Badge label={type} color={s.color} bg={s.bg} dot={s.dot}/>;
}
function BookingBadge({ status }:{ status:string }) {
  const m:Record<string,{bg:string;color:string;dot:string}> = {
    Completed:{bg:"#DCFCE7",color:"#15803D",dot:"#22C55E"},
    Ongoing:{bg:"#DBEAFE",color:"#1D4ED8",dot:"#3B82F6"},
    Pending:{bg:"#FEF3C7",color:"#B45309",dot:"#F59E0B"},
    Cancelled:{bg:"#FEE2E2",color:"#B91C1C",dot:"#EF4444"},
  };
  const s = m[status]||m.Pending;
  return <Badge label={status} color={s.color} bg={s.bg} dot={s.dot}/>;
}
function TypeBadge({ type }:{ type:string }) {
  return <Badge label={type} color={type==="Instant"?"#1D4ED8":"#B45309"} bg={type==="Instant"?"#DBEAFE":"#FEF3C7"}/>;
}
function EmptyState({ msg }:{ msg:string }) {
  return (
    <div style={{ textAlign:"center", padding:"40px 0" }}>
      <div style={{ width:44, height:44, borderRadius:"50%", background:"#F1F5F9", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="16" height="16" rx="3" stroke="#CBD5E1" strokeWidth="1.5"/><path d="M7 11h8M7 7.5h8M7 14.5h4" stroke="#CBD5E1" strokeWidth="1.4" strokeLinecap="round"/></svg>
      </div>
      <div style={{ fontSize:13.5, fontWeight:600, color:"#94A3B8" }}>{msg}</div>
    </div>
  );
}
function THead({ headers }:{ headers:string[] }) {
  return (
    <thead>
      <tr style={{ background:"rgba(248,250,252,0.8)", borderBottom:"1px solid #F1F5F9" }}>
        {headers.map((h,i) => <th key={i} style={{ padding:"12px 20px", textAlign:"left", fontSize:11, fontWeight:700, color:"#94A3B8", letterSpacing:"0.06em", textTransform:"uppercase", whiteSpace:"nowrap" }}>{h}</th>)}
      </tr>
    </thead>
  );
}
function TR({ cells, hovered, onEnter, onLeave, onClick }: { cells:React.ReactNode[]; hovered:boolean; onEnter:()=>void; onLeave:()=>void; onClick?:()=>void }) {
  return (
    <tr onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick}
      style={{ borderBottom:"1px solid #F1F5F9", background:hovered?"#F8FAFC":"#fff", transition:"background 0.12s", cursor:onClick?"pointer":"default" }}>
      {cells.map((c,i) => <td key={i} style={{ padding:"13px 20px", verticalAlign:"middle" }}>{c}</td>)}
    </tr>
  );
}

/* SvgBarChart, SvgDonut, ReportSkeleton, and the calendar/range picker now
   live in @/modules/reports/* — imported above as Shared* aliases so the
   superadmin report uses the exact same charts and date picker as the
   supervisor report in the vendor dashboard. */

const fmtINRk = (n: number) => n >= 1000 ? "₹" + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : "₹" + n;

/* ══════════════════════════════════════════════════════════════
   VENDOR REPORT PANEL
══════════════════════════════════════════════════════════════ */
const VENDOR_TABS = ["Overview", "Wallet Passbook", "Trips"] as const;
type VendorTab = typeof VENDOR_TABS[number];

function txDisplayType(apiType: string): string {
  if (apiType === "CREDIT") return "Money Added";
  if (apiType === "DEBIT")  return "Trip Payment";
  if (apiType === "REFUND") return "Refund";
  return "Adjustment";
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function PanelVendorReport({ vendor }: { vendor: VendorListItem }) {
  const [tab, setTab]         = useState<VendorTab>("Overview");
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split("T")[0]; });
  const [dateTo,   setDateTo]   = useState(() => new Date().toISOString().split("T")[0]);
  const [calOpen,  setCalOpen]  = useState(false);
  const [hovered,  setHovered]  = useState<number|null>(null);

  const [reportData,    setReportData]    = useState<VendorReportData | null>(null);
  // Initialize true: the Overview useEffect fires on mount, so the very first
  // render must show the skeleton instead of flashing an empty state for one tick.
  const [reportLoading, setReportLoading] = useState(true);

  const [walletData,    setWalletData]    = useState<VendorWalletTx[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);

  const [bookingsData,    setBookingsData]    = useState<VendorBookingItem[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // Expand-to-fullscreen state for the two daily charts. Same UX as the
  // supervisor report in the vendor dashboard: click expand, modal opens
  // with the full series chunked into 1–3 rows so long ranges don't squash.
  const [tripsExpand, setTripsExpand] = useState(false);
  const [spendExpand, setSpendExpand] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReportLoading(true);
    vendorReportApi.getReport(vendor.id, dateFrom, dateTo)
      .then(res  => { if (!cancelled) setReportData(res.data); })
      .catch(()  => { if (!cancelled) setReportData(null); })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; };
  }, [vendor.id, dateFrom, dateTo]);

  useEffect(() => {
    if (tab !== "Wallet Passbook") return;
    let cancelled = false;
    setWalletLoading(true);
    vendorReportApi.getWallet(vendor.id, dateFrom, dateTo)
      .then(res  => { if (!cancelled) setWalletData(res.data); })
      .catch(()  => { if (!cancelled) setWalletData([]); })
      .finally(() => { if (!cancelled) setWalletLoading(false); });
    return () => { cancelled = true; };
  }, [tab, vendor.id, dateFrom, dateTo]);

  useEffect(() => {
    if (tab !== "Trips") return;
    let cancelled = false;
    setBookingsLoading(true);
    vendorReportApi.getBookings(vendor.id, dateFrom, dateTo)
      .then(res  => { if (!cancelled) setBookingsData(res.data); })
      .catch(()  => { if (!cancelled) setBookingsData([]); })
      .finally(() => { if (!cancelled) setBookingsLoading(false); });
    return () => { cancelled = true; };
  }, [tab, vendor.id, dateFrom, dateTo]);

  const vendorMeta  = reportData?.vendor;
  const kpis        = reportData?.kpis;
  const dailyStats  = reportData?.dailyStats ?? [];
  const typeSplit   = reportData?.bookingTypeSplit ?? { instant: 0, scheduled: 0 };

  const totalBookings   = kpis?.totalBookings   ?? 0;
  const totalMoneySpent = kpis?.totalMoneySpent ?? 0;
  const avgBookingFare  = kpis?.avgBookingFare  ?? 0;
  const days            = dailyStats.length;

  // Full daily series — every day in the selected range. Used by the
  // expanded modals so they render the complete data even on long ranges.
  const dailyDataFull = useMemo(() =>
    dailyStats.map(r => ({
      d:        new Date(r.date + "T00:00:00").toLocaleDateString("en-IN", { day:"2-digit", month:"short" }),
      bookings: r.bookings,
      spend:    r.amount,
    })),
    [dailyStats],
  );

  // Inline chart sample — cap at ~14 visible bars to keep the small chart legible.
  const chartData = useMemo(() => {
    if (dailyDataFull.length === 0) return [];
    const step = Math.max(1, Math.floor(dailyDataFull.length / 14));
    return dailyDataFull.filter((_, i) => i % step === 0 || i === dailyDataFull.length - 1);
  }, [dailyDataFull]);

  // Modal: split the full series into 1–3 rows so a 90-day range stays readable.
  const dailyRows = useMemo(() => {
    const len = dailyDataFull.length;
    if (len === 0) return [];
    const rowCount = len > 45 ? 3 : len > 14 ? 2 : 1;
    const perRow = Math.ceil(len / rowCount);
    const rows: typeof dailyDataFull[] = [];
    for (let i = 0; i < len; i += perRow) rows.push(dailyDataFull.slice(i, i + perRow));
    return rows;
  }, [dailyDataFull]);

  // Shared y-axis max across all rows so the bars stay comparable across chunks.
  const dailyTripsYMax = useMemo(
    () => (dailyDataFull.length > 0 ? Math.max(...dailyDataFull.map(d => d.bookings)) : 0),
    [dailyDataFull],
  );
  const dailySpendYMax = useMemo(
    () => (dailyDataFull.length > 0 ? Math.max(...dailyDataFull.map(d => d.spend)) : 0),
    [dailyDataFull],
  );

  const bookingTypeData = [
    { name:"Instant",   value:typeSplit.instant,   pct: totalBookings > 0 ? Math.round(typeSplit.instant   / totalBookings * 100) : 0 },
    { name:"Scheduled", value:typeSplit.scheduled, pct: totalBookings > 0 ? Math.round(typeSplit.scheduled / totalBookings * 100) : 0 },
  ];

  const dateLabel = `${new Date(dateFrom+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short"})} — ${new Date(dateTo+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}`;
  const joinedDate = vendorMeta ? new Date(vendorMeta.createdAt).toLocaleDateString("en-IN",{month:"short",year:"numeric"}) : "—";
  const currentStatus = vendorMeta?.status ?? vendor.status;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Meta bar */}
      <Card style={{ padding:"16px 22px", display:"flex", alignItems:"center", gap:0, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, flex:1, minWidth:200 }}>
          <div style={{ width:44, height:44, borderRadius:"50%", background:"#EFF6FF", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:18, color:A, flexShrink:0 }}>
            {vendor.name.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:"#0F172A", lineHeight:1.2 }}>{vendor.name}</div>
            <div style={{ fontSize:12, color:"#64748B", marginTop:3 }}>{vendor.city} · Joined {joinedDate}</div>
          </div>
        </div>
        <div style={{ padding:"0 24px", borderLeft:"1px solid #F1F5F9", display:"flex", alignItems:"center" }}>
          <Badge label={currentStatus} color={currentStatus==="Active"?"#15803D":"#64748B"} bg={currentStatus==="Active"?"#DCFCE7":"#F1F5F9"} dot={currentStatus==="Active"?"#22C55E":"#94A3B8"}/>
        </div>
        <div style={{ padding:"0 24px", borderLeft:"1px solid #F1F5F9", textAlign:"center" }}>
          <div style={{ fontSize:20, fontWeight:800, color:"#0F172A" }}>{vendorMeta?.supervisorCount ?? "—"}</div>
          <div style={{ fontSize:10.5, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600, marginTop:2 }}>Supervisors</div>
        </div>
        <div style={{ padding:"0 0 0 24px", borderLeft:"1px solid #F1F5F9", textAlign:"right" }}>
          <div style={{ fontSize:20, fontWeight:800, color:"#0F172A" }}>{fmt(vendorMeta?.walletBalance ?? vendor.walletBalance)}</div>
          <div style={{ fontSize:10.5, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600, marginTop:2 }}>Wallet Balance</div>
        </div>
      </Card>

      {/* Tab bar */}
      <div style={{ display:"flex", borderBottom:"1.5px solid #E8EEF4" }}>
        {VENDOR_TABS.map(t => (
          <button key={t} onClick={() => {
            // Pre-set the per-tab loading flag synchronously so the skeleton
            // shows on the very next render instead of flashing an empty
            // table for one tick before the effect fires.
            if (t === "Wallet Passbook" && t !== tab) setWalletLoading(true);
            if (t === "Trips"           && t !== tab) setBookingsLoading(true);
            setTab(t);
            setCalOpen(false);
          }}
            style={{ padding:"10px 20px", border:"none", borderBottom: tab===t ? `2.5px solid ${A}` : "2.5px solid transparent",
              marginBottom:-1.5, cursor:"pointer", fontFamily:"inherit", fontSize:14,
              fontWeight:tab===t?700:500, background:"transparent",
              color:tab===t?A:"#64748B", transition:"color 0.15s" }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────── */}
      {tab === "Overview" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ position:"relative", display:"inline-block" }}>
            <button onClick={() => setCalOpen(v => !v)}
              style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"7px 14px", background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:9, cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"#475569", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
              <span style={{ fontFamily:"monospace", fontWeight:500 }}>{dateLabel}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {calOpen && (
              <SharedDateRangePicker from={dateFrom} to={dateTo}
                onApply={(f,t) => { setDateFrom(f); setDateTo(t); }}
                onClose={() => setCalOpen(false)}/>
            )}
          </div>

          {reportLoading ? <SharedReportSkeleton hideHeader statCount={3}/> : (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
                {[
                  { label:"Total Trips",    value:String(totalBookings),                       sub:"In period",        iconBg:"#F1F5F9", icon:<Route size={16} color="#64748B" strokeWidth={1.4}/> },
                  { label:"Total Money Spent", value:totalMoneySpent>0?fmtINRk(totalMoneySpent):"—", sub:"Wallet deductions", iconBg:"#F1F5F9", icon:<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="2" stroke="#64748B" strokeWidth="1.4"/><path d="M1 7h14" stroke="#64748B" strokeWidth="1.4"/><circle cx="12.5" cy="10" r="1" fill="#64748B"/></svg> },
                  { label:"Avg Trip Fare",  value:avgBookingFare>0?fmt(avgBookingFare):"—",    sub:"Per trip",      iconBg:"#F1F5F9", icon:<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12L6 8l3 3 5-7" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg> },
                ].map(c => (
                  <Card key={c.label} style={{ padding:"16px 18px", display:"flex", flexDirection:"column", gap:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div style={{ fontSize:10.5, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:0.7, lineHeight:1.3 }}>{c.label}</div>
                      <div style={{ width:30, height:30, borderRadius:8, background:c.iconBg, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{c.icon}</div>
                    </div>
                    <div style={{ fontSize:22, fontWeight:800, color:"#0F172A", lineHeight:1, letterSpacing:-0.3, fontVariantNumeric:"tabular-nums" }}>{c.value}</div>
                    <div style={{ fontSize:11, color:"#94A3B8" }}>{c.sub}</div>
                  </Card>
                ))}
              </div>

              {chartData.length > 0 ? (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
                    <Card style={{ padding:"20px 22px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
                        <div>
                          <div style={{ fontSize:13.5, fontWeight:600, color:"#0F172A", marginBottom:4 }}>Trips over time</div>
                          <div style={{ fontSize:11.5, color:"#94A3B8" }}>Daily trip volume</div>
                        </div>
                        <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                          <div style={{ fontSize:11, color:"#94A3B8", textAlign:"right" }}>
                            <strong style={{ display:"block", fontSize:18, color:"#0F172A", fontWeight:600, fontVariantNumeric:"tabular-nums", marginBottom:2 }}>{totalBookings}</strong>
                            trips · {days}d
                          </div>
                          {dailyDataFull.length > 0 && (
                            <button onClick={() => setTripsExpand(true)} title="Expand"
                              style={{ width:30, height:30, borderRadius:8, border:"1.5px solid #E2E8F0", background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.05)", flexShrink:0 }}>
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                                <path d="M9 2h5v5M14 2l-5 5M7 14H2v-5M2 14l5-5" stroke="#64748B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{ height:220 }}><SharedSvgBarChart data={chartData as Record<string,unknown>[]} xKey="d" yKey="bookings" color={A} maxBarWidth={80} yLabel="Trips"/></div>
                    </Card>
                    <Card style={{ padding:"20px 22px" }}>
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontSize:13.5, fontWeight:600, color:"#0F172A", marginBottom:4 }}>Instant vs Scheduled</div>
                        <div style={{ fontSize:11.5, color:"#94A3B8" }}>Trip type split</div>
                      </div>
                      <div style={{ position:"relative" }}>
                        <SharedSvgDonut data={bookingTypeData} colors={[A, "#93C5FD"]} size={190} thickness={26} valueFormat={(v)=>`${v} trip${v===1?"":"s"}`}/>
                        <div style={{ position:"absolute", left:"50%", top:"50%", transform:"translate(-50%,-50%)", textAlign:"center", pointerEvents:"none" }}>
                          <div style={{ fontSize:26, fontWeight:600, color:"#0F172A", fontVariantNumeric:"tabular-nums" }}>{totalBookings}</div>
                          <div style={{ fontSize:10.5, color:"#94A3B8", marginTop:2, textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:500 }}>Total</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:14 }}>
                        {bookingTypeData.map((b, i) => (
                          <div key={b.name} style={{ display:"grid", gridTemplateColumns:"14px 1fr auto auto", gap:10, alignItems:"center", fontSize:12.5 }}>
                            <div style={{ width:10, height:10, borderRadius:3, background:i===0?A:"#93C5FD" }}/>
                            <span style={{ color:"#475569", fontWeight:500 }}>{b.name}</span>
                            <span style={{ color:"#94A3B8", fontVariantNumeric:"tabular-nums", fontSize:11.5 }}>{b.pct}%</span>
                            <span style={{ color:"#0F172A", fontWeight:600, fontVariantNumeric:"tabular-nums" }}>{b.value}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  <Card style={{ padding:"20px 22px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
                      <div>
                        <div style={{ fontSize:13.5, fontWeight:600, color:"#0F172A", marginBottom:4 }}>Daily spend breakdown</div>
                        <div style={{ fontSize:11.5, color:"#94A3B8" }}>Fare processed per day</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                        <div style={{ fontSize:11, color:"#94A3B8", textAlign:"right" }}>
                          <strong style={{ display:"block", fontSize:18, color:"#0F172A", fontWeight:600, fontVariantNumeric:"tabular-nums", marginBottom:2 }}>{totalMoneySpent>0?fmtINRk(totalMoneySpent):"—"}</strong>
                          total · {days}d
                        </div>
                        {dailyDataFull.length > 0 && (
                          <button onClick={() => setSpendExpand(true)} title="Expand"
                            style={{ width:30, height:30, borderRadius:8, border:"1.5px solid #E2E8F0", background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.05)", flexShrink:0 }}>
                            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                              <path d="M9 2h5v5M14 2l-5 5M7 14H2v-5M2 14l5-5" stroke="#64748B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ height:220 }}><SharedSvgBarChart data={chartData as Record<string,unknown>[]} xKey="d" yKey="spend" color={A} yFormat={fmtINRk} maxBarWidth={80} yLabel="Spend"/></div>
                  </Card>
                </>
              ) : (
                <Card><EmptyState msg="No activity data for selected period"/></Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Wallet Passbook ─────────────────────────────────────── */}
      {tab === "Wallet Passbook" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <div style={{ fontSize:13.5, fontWeight:700, color:"#0F172A" }}>
              Wallet Passbook
              {!walletLoading && <span style={{ fontSize:12, fontWeight:500, color:"#94A3B8", marginLeft:8 }}>{walletData.length} transactions</span>}
            </div>
            <div style={{ position:"relative", display:"inline-block" }}>
              <button onClick={() => setCalOpen(v => !v)}
                style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"7px 14px", background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:9, cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"#475569", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
                <span style={{ fontFamily:"monospace", fontWeight:500 }}>{dateLabel}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {calOpen && (
                <div style={{ position:"absolute", top:"100%", right:0, width:290, height:0, zIndex:200 }}>
                  <div style={{ position:"relative", width:"100%", height:"100%" }}>
                    <SharedDateRangePicker from={dateFrom} to={dateTo}
                      onApply={(f,t) => { setDateFrom(f); setDateTo(t); }}
                      onClose={() => setCalOpen(false)}/>
                  </div>
                </div>
              )}
            </div>
          </div>
          {walletLoading ? <SharedReportSkeleton hideHeader statCount={3}/> : (
            <Card>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <THead headers={["Date & Time","Type","Supervisor","Amount","Balance After","Note"]}/>
                  <tbody>
                    {walletData.length===0
                      ? <tr><td colSpan={6}><EmptyState msg="No transactions in this date range"/></td></tr>
                      : walletData.map((t, i) => {
                        const displayType = txDisplayType(t.type);
                        const isCredit = t.type === "CREDIT";
                        return (
                          <TR key={i} hovered={hovered===i} onEnter={()=>setHovered(i)} onLeave={()=>setHovered(null)} cells={[
                            <span style={{ fontSize:13, color:"#475569" }}>{fmtDateTime(t.createdAt)}</span>,
                            <TxTypeBadge type={displayType}/>,
                            <span style={{ fontSize:13, color:"#475569" }}>{t.supervisorName ?? "—"}</span>,
                            <span style={{ fontSize:15, fontWeight:700, color:isCredit?"#15803D":"#B91C1C" }}>{isCredit?"+":"-"}{fmt(Math.abs(t.amount))}</span>,
                            <span style={{ fontSize:13, color:"#475569" }}>{t.balanceAfter != null ? fmt(t.balanceAfter) : "—"}</span>,
                            <span style={{ fontSize:13, color:"#475569" }}>{t.note ?? "—"}</span>,
                          ]}/>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Bookings ─────────────────────────────────────────────── */}
      {tab === "Trips" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
            <div style={{ fontSize:13.5, fontWeight:700, color:"#0F172A" }}>
              Trips
              {!bookingsLoading && <span style={{ fontSize:12, fontWeight:500, color:"#94A3B8", marginLeft:8 }}>{bookingsData.length} trips</span>}
            </div>
            <div style={{ position:"relative", display:"inline-block" }}>
              <button onClick={() => setCalOpen(v => !v)}
                style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"7px 14px", background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:9, cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"#475569", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
                <span style={{ fontFamily:"monospace", fontWeight:500 }}>{dateLabel}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {calOpen && (
                <div style={{ position:"absolute", top:"100%", right:0, width:290, height:0, zIndex:200 }}>
                  <div style={{ position:"relative", width:"100%", height:"100%" }}>
                    <SharedDateRangePicker from={dateFrom} to={dateTo}
                      onApply={(f,t) => { setDateFrom(f); setDateTo(t); }}
                      onClose={() => setCalOpen(false)}/>
                  </div>
                </div>
              )}
            </div>
          </div>
          {bookingsLoading ? <SharedReportSkeleton hideHeader statCount={3}/> : (
            <Card>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <THead headers={["Trip Ref","Supervisor","Route","Type","Status","Fare","Date"]}/>
                  <tbody>
                    {bookingsData.length===0
                      ? <tr><td colSpan={7}><EmptyState msg="No trips in this date range"/></td></tr>
                      : bookingsData.map((b, i) => {
                        const date = new Date(b.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
                        return (
                          <TR key={i} hovered={hovered===i} onEnter={()=>setHovered(i)} onLeave={()=>setHovered(null)} cells={[
                            <span style={{ fontFamily:"monospace", fontSize:12, background:"#F1F5F9", padding:"2px 8px", borderRadius:5, color:"#111827", fontWeight:700 }}>{b.bookingRef ?? "—"}</span>,
                            <span style={{ fontSize:13, color:"#475569" }}>{b.supervisorName ?? "—"}</span>,
                            <span style={{ fontSize:13, color:"#475569" }}>{b.pickupLocation.split(",")[0]} → {b.dropLocation.split(",")[0]}</span>,
                            <TypeBadge type={b.type}/>,
                            <BookingBadge status={b.status}/>,
                            <span style={{ fontSize:14, fontWeight:700, color:b.fare?"#1E293B":"#CBD5E1" }}>{b.fare?fmt(b.fare):"—"}</span>,
                            <span style={{ fontSize:13, color:"#475569" }}>{date}</span>,
                          ]}/>
                        );
                      })
                    }
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Expand modal: Trips over time ── */}
      {tripsExpand && (() => {
        const rowH = dailyRows.length === 3 ? 200 : dailyRows.length === 2 ? 260 : 380;
        return (
          <div onClick={(e) => { if (e.target === e.currentTarget) setTripsExpand(false); }}
            style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:60, padding:24 }}>
            <div style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:1400, maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px rgba(0,0,0,0.22)", overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 26px", borderBottom:"1.5px solid #F1F5F9" }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:"#0F172A" }}>Trips over time</div>
                  <div style={{ fontSize:12, color:"#94A3B8", marginTop:3 }}>{vendor.name} · {dateLabel}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ fontSize:11, color:"#94A3B8", textAlign:"right" }}>
                    <strong style={{ display:"block", fontSize:20, color:"#0F172A", fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{totalBookings}</strong>
                    trips
                  </div>
                  <button onClick={() => setTripsExpand(false)}
                    style={{ width:34, height:34, borderRadius:9, border:"1.5px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </button>
                </div>
              </div>
              <div style={{ flex:1, padding:"24px 26px", overflowY:"auto", display:"flex", flexDirection:"column", gap:22 }}>
                {dailyRows.length === 0
                  ? <EmptyState msg="No trips in this period"/>
                  : dailyRows.map((row, i) => (
                    <div key={i} style={{ height:rowH }}>
                      <SharedSvgBarChart data={row as Record<string,unknown>[]} xKey="d" yKey="bookings" color={A} yMax={dailyTripsYMax} maxBarWidth={80} height={rowH} yLabel="Trips"/>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Expand modal: Daily spend breakdown ── */}
      {spendExpand && (() => {
        const rowH = dailyRows.length === 3 ? 200 : dailyRows.length === 2 ? 260 : 380;
        return (
          <div onClick={(e) => { if (e.target === e.currentTarget) setSpendExpand(false); }}
            style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:60, padding:24 }}>
            <div style={{ background:"#fff", borderRadius:18, width:"100%", maxWidth:1400, maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px rgba(0,0,0,0.22)", overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 26px", borderBottom:"1.5px solid #F1F5F9" }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:"#0F172A" }}>Daily spend breakdown</div>
                  <div style={{ fontSize:12, color:"#94A3B8", marginTop:3 }}>{vendor.name} · {dateLabel}</div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ fontSize:11, color:"#94A3B8", textAlign:"right" }}>
                    <strong style={{ display:"block", fontSize:20, color:"#0F172A", fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{totalMoneySpent>0?fmtINRk(totalMoneySpent):"—"}</strong>
                    total
                  </div>
                  <button onClick={() => setSpendExpand(false)}
                    style={{ width:34, height:34, borderRadius:9, border:"1.5px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </button>
                </div>
              </div>
              <div style={{ flex:1, padding:"24px 26px", overflowY:"auto", display:"flex", flexDirection:"column", gap:22 }}>
                {dailyRows.length === 0
                  ? <EmptyState msg="No spend data for this period"/>
                  : dailyRows.map((row, i) => (
                    <div key={i} style={{ height:rowH }}>
                      <SharedSvgBarChart data={row as Record<string,unknown>[]} xKey="d" yKey="spend" color={A} yFormat={fmtINRk} yMax={dailySpendYMax} maxBarWidth={80} height={rowH} yLabel="Spend"/>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DRIVER REPORT PANEL
══════════════════════════════════════════════════════════════ */
function toIsoDate(d:Date){ return d.toISOString().split("T")[0]; }
function inRangeFn(d:Date, from:string, to:string){ return d>=new Date(from+"T00:00:00")&&d<=new Date(to+"T23:59:59"); }
function getPreset(id:string):{from:string;to:string} {
  const t=new Date();
  if(id==="today") return {from:toIsoDate(t),to:toIsoDate(t)};
  if(id==="7d")  { const d=new Date(t); d.setDate(d.getDate()-6);  return {from:toIsoDate(d),to:toIsoDate(t)}; }
  if(id==="30d") { const d=new Date(t); d.setDate(d.getDate()-29); return {from:toIsoDate(d),to:toIsoDate(t)}; }
  const d=new Date(t.getFullYear(),t.getMonth(),1);
  return {from:toIsoDate(d),to:toIsoDate(t)};
}
const PRESETS=[{id:"today",label:"Today"},{id:"7d",label:"Last 7 days"},{id:"30d",label:"Last 30 days"},{id:"month",label:"This month"}];

function DateRangePicker({ from, to, onChange }:{ from:string; to:string; onChange:(f:string,t:string)=>void }) {
  const active=PRESETS.find(p=>{ const r=getPreset(p.id); return r.from===from&&r.to===to; })?.id??"custom";
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
      <div style={{ display:"flex", gap:5 }}>
        {PRESETS.map(p=>(
          <button key={p.id} onClick={()=>{ const r=getPreset(p.id); onChange(r.from,r.to); }}
            style={{ padding:"6px 11px", borderRadius:8, border:"1.5px solid", borderColor:active===p.id?A:"#E2E8F0", background:active===p.id?"#EFF6FF":"#fff", color:active===p.id?A:"#64748B", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}
          >{p.label}</button>
        ))}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:5, background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:9, padding:"5px 10px" }}>
        <input type="date" value={from} max={to} onChange={e=>onChange(e.target.value,to)} style={{ border:"none", background:"transparent", fontSize:13, color:"#374151", fontFamily:"inherit", outline:"none", cursor:"pointer" }}/>
        <span style={{ color:"#CBD5E1" }}>→</span>
        <input type="date" value={to} min={from} onChange={e=>onChange(from,e.target.value)} style={{ border:"none", background:"transparent", fontSize:13, color:"#374151", fontFamily:"inherit", outline:"none", cursor:"pointer" }}/>
      </div>
    </div>
  );
}

function PanelDriverReport({ driver }: { driver: Driver }) {
  const { bookings, supervisors } = useVendor();
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [dateTo,   setDateTo]   = useState(toIsoDate(today));
  const [hovered,  setHovered]  = useState<number|null>(null);

  const driverBookings = useMemo(() =>
    bookings.filter(b => b.driverId===driver.id && inRangeFn(new Date(b.createdAt), dateFrom, dateTo)),
    [bookings, driver, dateFrom, dateTo]
  );
  const completed = driverBookings.filter(b=>b.status==="Completed").length;
  const totalFare = driverBookings.reduce((s,b)=>s+(b.fare||0),0);
  const avgFare   = completed>0 ? Math.round(totalFare/completed) : 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <Card style={{ padding:"20px 24px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:50, height:50, borderRadius:"50%", background:"#F0FDF4", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:20, color:"#16A34A", flexShrink:0 }}>
            {driver.name.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:"#0F172A" }}>{driver.name}</div>
            <div style={{ fontSize:12, color:"#64748B", marginTop:3 }}>
              {[driver.phone, driver.vehicle?`${driver.vehicle}${driver.vehicleReg?" · "+driver.vehicleReg:""}`:null].filter(Boolean).join(" · ")||driver.id}
            </div>
          </div>
        </div>
        <DateRangePicker from={dateFrom} to={dateTo} onChange={(f,t)=>{ setDateFrom(f); setDateTo(t); }}/>
      </Card>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <StatCard label="Total Trips" value={driverBookings.length} sub="In selected period" iconBg="#EFF6FF"
          icon={<Route size={17} color="#64748B" strokeWidth={1.4}/>}/>
        <StatCard label="Completed" value={completed} sub="Successfully done" iconBg="#DCFCE7"
          icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="#64748B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}/>
        <StatCard label="Total Fare" value={totalFare>0?fmt(totalFare):"—"} sub="All trips in period" iconBg="#FEF3C7"
          icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="2" stroke="#64748B" strokeWidth="1.4"/><path d="M1 7h14" stroke="#64748B" strokeWidth="1.4"/><circle cx="12.5" cy="10" r="1" fill="#64748B"/></svg>}/>
        <StatCard label="Avg Fare" value={avgFare>0?fmt(avgFare):"—"} sub="Per completed trip" iconBg="#F8FAFC"
          icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2 12L6 8l3 3 5-7" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}/>
      </div>

      <div>
        <div style={{ fontSize:13.5, fontWeight:700, color:"#0F172A", marginBottom:10 }}>
          Trip History <span style={{ fontSize:12, fontWeight:500, color:"#94A3B8", marginLeft:8 }}>{driverBookings.length} trips in period</span>
        </div>
        <Card>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <THead headers={["Trip Ref","Supervisor","Route","Type","Status","Fare","Date"]}/>
              <tbody>
                {driverBookings.length===0
                  ? <tr><td colSpan={7}><EmptyState msg="No trips in selected period"/></td></tr>
                  : driverBookings.map((b,i)=>{
                    const sup  = supervisors.find(s=>s.id===b.supervisorId);
                    const date = new Date(b.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
                    return (
                      <TR key={i} hovered={hovered===i} onEnter={()=>setHovered(i)} onLeave={()=>setHovered(null)} cells={[
                        <span style={{ fontFamily:"monospace", fontSize:12, background:"#F1F5F9", padding:"2px 8px", borderRadius:5, color:"#111827", fontWeight:700 }}>{b.id}</span>,
                        <span style={{ fontSize:13, color:"#475569" }}>{sup?.name??b.supervisorName??"—"}</span>,
                        <span style={{ fontSize:13, color:"#475569" }}>{b.pickupLocation.split(",")[0]} → {b.dropLocation.split(",")[0]}</span>,
                        <TypeBadge type={b.type}/>,
                        <BookingBadge status={b.status}/>,
                        <span style={{ fontSize:14, fontWeight:700, color:b.fare?"#1E293B":"#CBD5E1" }}>{b.fare?fmt(b.fare):"—"}</span>,
                        <span style={{ fontSize:13, color:"#475569" }}>{date}</span>,
                      ]}/>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */
type ReportType = "vendor" | "driver";

function driverApiItemToDriver(d: DriverApiItem): Driver {
  const status: Driver["status"] =
    d.status === "Available" || d.status === "On Trip" || d.status === "Offline"
      ? d.status
      : (d.isOnline ? "Available" : "Offline");
  return {
    id: d.id,
    name: d.name,
    phone: d.phone,
    vehicle: d.vehicle?.model ?? undefined,
    vehicleReg: d.vehicle?.plateNumber ?? undefined,
    vehicleColor: d.vehicle?.color ?? undefined,
    vehicleType: d.vehicle?.type ?? undefined,
    status,
    assignedSupervisorId: null,
    assignedSupervisorName: null,
    totalTrips: d.totalTrips,
    lastActive: d.lastActiveAt ?? d.lastSeenAt ?? d.createdAt,
    recentTrips: [],
  };
}

export default function SuperAdminReportsPage() {
  const [modalOpen, setModalOpen] = useState(true);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [reportType, setReportType] = useState<ReportType>("vendor");
  const [search,    setSearch]    = useState("");

  const [selVendor, setSelVendor] = useState<VendorListItem|null>(null);
  const [selDriver, setSelDriver] = useState<DriverApiItem|null>(null);
  const hasReport = selVendor !== null || selDriver !== null;

  const [vendorList,        setVendorList]        = useState<VendorListItem[]>([]);
  const [vendorListLoading, setVendorListLoading] = useState(false);

  const [driverList,        setDriverList]        = useState<DriverApiItem[]>([]);
  const [driverListLoading, setDriverListLoading] = useState(false);

  useEffect(() => {
    setVendorListLoading(true);
    vendorReportApi.listVendors()
      .then(res  => setVendorList(res.data))
      .catch(()  => setVendorList([]))
      .finally(() => setVendorListLoading(false));
  }, []);

  useEffect(() => {
    if (reportType !== "driver" || driverList.length > 0 || driverListLoading) return;
    setDriverListLoading(true);
    superadminApi.drivers.list({ limit: 200 })
      .then(res  => setDriverList(res.data))
      .catch(()  => setDriverList([]))
      .finally(() => setDriverListLoading(false));
  }, [reportType, driverList.length, driverListLoading]);

  function openModal() { setSearch(""); setModalStep(1); setModalOpen(true); }
  function pickType(t: ReportType) { setReportType(t); setSearch(""); setModalStep(2); }
  function pickVendor(v: VendorListItem) { setSelVendor(v); setSelDriver(null); setModalOpen(false); }
  function pickDriver(d: DriverApiItem) { setSelDriver(d); setSelVendor(null); setModalOpen(false); }

  const filteredVendors = vendorList.filter(v => {
    const q = search.toLowerCase();
    return !q || v.name.toLowerCase().includes(q) || v.city.toLowerCase().includes(q);
  });
  const filteredDrivers = driverList.filter(d => {
    const q = search.toLowerCase();
    return !q || d.name.toLowerCase().includes(q) || (d.phone ?? "").toLowerCase().includes(q) || (d.zone ?? "").toLowerCase().includes(q);
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", fontFamily:FONT }}>

      {!hasReport ? (
        <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ textAlign:"center", maxWidth:360 }}>
            <div style={{ width:64, height:64, borderRadius:20, background:"#F1F5F9", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 20h20M4 14h20M4 8h12" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </div>
            <div style={{ fontSize:20, fontWeight:800, color:"#0F172A", marginBottom:8 }}>No report selected</div>
            <div style={{ fontSize:13.5, color:"#94A3B8", lineHeight:1.7, marginBottom:24 }}>Choose a vendor or driver to view their detailed report</div>
            <button onClick={openModal} style={{ padding:"11px 28px", background:A, color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              Generate Report
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex:1, overflowY:"auto" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
            <div style={{ fontSize:13, color:"#64748B" }}>
              Showing report for{" "}
              <span style={{ fontWeight:700, color:"#0F172A" }}>{selVendor?.name ?? selDriver?.name}</span>
              <span style={{ marginLeft:6, fontSize:12, color:"#94A3B8" }}>({selVendor ? "Vendor" : "Driver"})</span>
            </div>
            <button onClick={openModal} style={{ padding:"7px 16px", background:"#fff", color:"#475569", border:"1.5px solid #E2E8F0", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              Change Report
            </button>
          </div>
          {selVendor && <PanelVendorReport vendor={selVendor}/>}
          {selDriver && <PanelDriverReport driver={driverApiItemToDriver(selDriver)}/>}
        </div>
      )}

      {/* ── MODAL ── */}
      {modalOpen && (
        <div onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }}>
          <div style={{ background:"#fff", borderRadius:20, width:480, maxWidth:"100%", maxHeight:"88vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px rgba(0,0,0,0.20)", overflow:"hidden" }}>

            <div style={{ display:"flex", alignItems:"center", gap:10, padding:"18px 22px", borderBottom:"1.5px solid #F1F5F9", flexShrink:0 }}>
              {modalStep === 2 && (
                <button onClick={() => setModalStep(1)}
                  style={{ width:30, height:30, borderRadius:8, border:"1.5px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2L4 6l4 4" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              )}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:"#0F172A" }}>
                  {modalStep === 1 ? "Generate Report" : reportType === "vendor" ? "Select Vendor" : "Select Driver"}
                </div>
                <div style={{ fontSize:11.5, color:"#94A3B8", marginTop:1 }}>
                  {modalStep === 1 ? "Choose the report type" : "Pick one to view their report"}
                </div>
              </div>
              <button onClick={()=>setModalOpen(false)}
                style={{ width:34, height:34, borderRadius:9, border:"1.5px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Step 1 — type selector */}
            {modalStep === 1 && (
              <div style={{ padding:"20px 22px", display:"flex", flexDirection:"column", gap:12 }}>
                {([
                  {
                    type: "vendor" as ReportType,
                    title: "Vendor Report",
                    desc:  "View trips and wallet breakdown per vendor",
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <rect x="3" y="6" width="16" height="13" rx="2" stroke="#94A3B8" strokeWidth="1.6"/>
                        <path d="M8 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="#94A3B8" strokeWidth="1.6"/>
                        <path d="M7 11h8M7 14.5h5" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                  {
                    type: "driver" as ReportType,
                    title: "Driver Report",
                    desc:  "View trips, fare, and performance breakdown per driver",
                    icon: (
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <circle cx="11" cy="8" r="4" stroke="#94A3B8" strokeWidth="1.6"/>
                        <path d="M4 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                    ),
                  },
                ] as const).map((opt) => (
                  <div key={opt.type} onClick={() => pickType(opt.type)}
                    onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "#FAFBFC"}
                    style={{ display:"flex", alignItems:"center", gap:14, padding:"16px 18px", border:"1.5px solid #E2E8F0", borderRadius:14, cursor:"pointer", background:"#FAFBFC", transition:"background 0.12s" }}>
                    <div style={{ width:44, height:44, borderRadius:12, background:"#F8FAFC", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {opt.icon}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>{opt.title}</div>
                      <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>{opt.desc}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="#CBD5E1" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                ))}
              </div>
            )}

            {/* Step 2 — entity list */}
            {modalStep === 2 && (
              <>
                <div style={{ padding:"12px 22px 8px", flexShrink:0 }}>
                  <div style={{ position:"relative" }}>
                    <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }} width="14" height="14" viewBox="0 0 15 15" fill="none">
                      <circle cx="6.5" cy="6.5" r="4.5" stroke="#94A3B8" strokeWidth="1.4"/>
                      <path d="M10.5 10.5L13 13" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <input value={search} onChange={e=>setSearch(e.target.value)}
                      placeholder={reportType === "vendor" ? "Search vendor or city…" : "Search driver, phone or zone…"}
                      autoFocus
                      style={{ width:"100%", padding:"8px 14px 8px 30px", border:"1.5px solid #E2E8F0", borderRadius:9, fontSize:13, fontFamily:"inherit", background:"#FAFBFC", color:"#374151", outline:"none", boxSizing:"border-box" }}/>
                  </div>
                </div>

                <div style={{ overflowY:"auto", flex:1 }}>
                  {reportType === "vendor" ? (
                    vendorListLoading
                      ? <div style={{ padding:"24px", textAlign:"center", color:"#94A3B8", fontSize:13 }}>Loading vendors…</div>
                      : filteredVendors.length === 0
                        ? <EmptyState msg="No vendors found"/>
                        : filteredVendors.map((v, i) => (
                          <div key={i} onClick={() => pickVendor(v)}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                            style={{ padding:"13px 22px", cursor:"pointer", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"center", gap:12, transition:"background 0.12s" }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>{v.name}</div>
                              <div style={{ fontSize:11.5, color:"#94A3B8", marginTop:1 }}>{v.city}</div>
                            </div>
                            <Badge label={v.status}
                              color={v.status === "Active" ? "#15803D" : "#64748B"}
                              bg={v.status === "Active" ? "#DCFCE7" : "#F1F5F9"}
                              dot={v.status === "Active" ? "#22C55E" : "#94A3B8"}/>
                          </div>
                        ))
                  ) : (
                    driverListLoading
                      ? <div style={{ padding:"24px", textAlign:"center", color:"#94A3B8", fontSize:13 }}>Loading drivers…</div>
                      : filteredDrivers.length === 0
                        ? <EmptyState msg="No drivers found"/>
                        : filteredDrivers.map((d, i) => {
                          const isOnline = d.isOnline;
                          return (
                            <div key={i} onClick={() => pickDriver(d)}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                              style={{ padding:"13px 22px", cursor:"pointer", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"center", gap:12, transition:"background 0.12s" }}>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>{d.name}</div>
                                <div style={{ fontSize:11.5, color:"#94A3B8", marginTop:1 }}>
                                  {[d.zone, d.vehicle?.plateNumber].filter(Boolean).join(" · ") || "—"}
                                </div>
                              </div>
                              <Badge label={isOnline ? "Online" : "Offline"}
                                color={isOnline ? "#15803D" : "#64748B"}
                                bg={isOnline ? "#DCFCE7" : "#F1F5F9"}
                                dot={isOnline ? "#22C55E" : "#94A3B8"}/>
                            </div>
                          );
                        })
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

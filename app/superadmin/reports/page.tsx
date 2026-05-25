"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  vendorReportApi,
  superadminApi,
  type VendorListItem,
  type VendorReportData,
  type VendorWalletTx,
  type VendorBookingItem,
  type DriverApiItem,
  type DriverTripsResponse,
} from "@/lib/api";
import { CalendarDays, Route, ArrowRight } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { ExportButton } from "@/components/ExportButton";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { FilterPanel, FilterSection, FilterPill, FilterTrigger } from "@/components/FilterPanel";
import { SvgBarChart as SharedSvgBarChart, SvgDonut as SharedSvgDonut } from "@/modules/reports/charts";
import { DateRangePicker as SharedDateRangePicker } from "@/modules/reports/DateRangePicker";
import { ReportSkeleton as SharedReportSkeleton } from "@/modules/reports/primitives";
import { TripsTable } from "@/modules/bookings/components/TripsTable";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";
import { buildTripRenderers } from "@/modules/bookings/tripRenderers";
import type { Booking } from "@/modules/bookings/types";
import type { DriverTripItem } from "@/lib/api";
import { exportToCsv } from "@/lib/exportCsv";
import { exportToXlsx } from "@/lib/exportXlsx";
import { getTableSpec } from "@/lib/columnConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_STYLES } from "@/components/StatusBadge";

const A    = "#2563EB";
const FONT = "var(--font-plus-jakarta-sans),'Plus Jakarta Sans',sans-serif";
const fmt  = (n: number) => "₹" + Number(n).toLocaleString("en-IN");
const VENDOR_REPORT_TRIPS_TABLE_KEY = "superadminVendorReportTrips" as const;
const DRIVER_TRIPS_TABLE_KEY = "driverTrips" as const;

function TripStatusBadge({ status }: { status: string }) {
  const c = STATUS_STYLES[status] ?? STATUS_STYLES["Pending"];
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" as const }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

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

async function loadAllVendorBookings(
  vendorId: string,
  startDate: string,
  endDate: string,
  pageSize = 1000,
) {
  const firstPage = await vendorReportApi.getBookings(vendorId, startDate, endDate, 1, pageSize);
  const seen = new Set(firstPage.data.map((b) => b.id));
  const all = [...firstPage.data];

  let page = 2;
  while (all.length < firstPage.pagination.total && page <= 50) {
    const res = await vendorReportApi.getBookings(vendorId, startDate, endDate, page, pageSize);
    let added = 0;
    for (const booking of res.data) {
      if (seen.has(booking.id)) continue;
      seen.add(booking.id);
      all.push(booking);
      added += 1;
    }
    if (added === 0) break;
    page += 1;
  }

  return all;
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

function vendorBookingToBooking(t: VendorBookingItem): Booking & { vehicleReg?: string | null; vehicleModel?: string | null } {
  return {
    id: t.id,
    bookingRef: t.tripRef ?? t.bookingRef ?? null,
    type: (t.type || "Instant") as Booking["type"],
    status: t.status as Booking["status"],
    pickupLocation: t.pickupLocation,
    dropLocation: t.dropLocation,
    scheduledTime: t.scheduledTime,
    createdAt: t.createdAt,
    fare: t.fare ?? undefined,
    passengers: t.passengers ?? undefined,
    bookingSource: t.bookingSource ?? undefined,
    supervisorId: t.supervisorName ?? "",
    supervisorName: t.supervisorName ?? "",
    driverId: null,
    driverName: t.driverName ?? null,
    driverPhone: t.driverPhone ?? null,
    pickupTime: null,
    stops: [],
    vehicleReg: t.vehicleReg,
    vehicleModel: t.vehicleModel,
  };
}

function PanelVendorReport({ vendor }: { vendor: VendorListItem }) {
  const [tab, setTab]         = useState<VendorTab>("Overview");
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split("T")[0]; });
  const [dateTo,   setDateTo]   = useState(() => new Date().toISOString().split("T")[0]);
  const [calOpen,  setCalOpen]  = useState(false);
  const [hovered,  setHovered]  = useState<number|null>(null);
  const [tripSearch, setTripSearch] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const [reportData,    setReportData]    = useState<VendorReportData | null>(null);
  // Initialize true: the Overview useEffect fires on mount, so the very first
  // render must show the skeleton instead of flashing an empty state for one tick.
  const [reportLoading, setReportLoading] = useState(true);

  const [walletData,    setWalletData]    = useState<VendorWalletTx[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);

  const [bookingsData,    setBookingsData]    = useState<VendorBookingItem[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const {
    columns: tripsVisibleCols,
    toggle: toggleTripsCol,
    reset: resetTripsCols,
    totalCount: tripsTotalCols,
    loading: tripsPrefsLoading,
  } = useColumnPreferences(VENDOR_REPORT_TRIPS_TABLE_KEY);

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
    loadAllVendorBookings(vendor.id, dateFrom, dateTo)
      .then(rows => { if (!cancelled) setBookingsData(rows); })
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

  const allTrips = useMemo(
    () => bookingsData,
    [bookingsData],
  );

  const filteredTrips = useMemo(() => {
    const q = tripSearch.trim().toLowerCase();
    if (!q) return allTrips;
    const compactQ = q.replace(/\s+/g, "");
    return allTrips.filter((b) => {
      const matchQ =
        (b.tripRef ?? b.bookingRef ?? b.id).toLowerCase().includes(q) ||
        b.pickupLocation.toLowerCase().includes(q) ||
        b.dropLocation.toLowerCase().includes(q) ||
        (b.supervisorName ?? "").toLowerCase().includes(q) ||
        (b.bookingSource ?? "").toLowerCase().includes(q) ||
        (b.driverName ?? "").toLowerCase().includes(q) ||
        (b.driverPhone ?? "").toLowerCase().includes(q) ||
        (b.vehicleReg ?? "").toLowerCase().replace(/\s+/g, "").includes(compactQ) ||
        (b.vehicleModel ?? "").toLowerCase().includes(q) ||
        (b.type ?? "").toLowerCase().includes(q) ||
        (b.status ?? "").toLowerCase().includes(q);
      return matchQ;
    });
  }, [allTrips, tripSearch]);

  const filteredTripRows = useMemo(
    () => filteredTrips.map((b) => ({
      ...vendorBookingToBooking(b),
      vendorName: vendor.name,
    })),
    [filteredTrips, vendor.name],
  );

  const tripsRenderers = useMemo(
    () => buildTripRenderers(
      (id) => id ?? "",
      (b) => {
        const row = b as Booking & { vehicleReg?: string | null; vehicleModel?: string | null };
        return {
          name:        (b.driverName ?? null),
          vehicle:     row.vehicleModel ?? null,
          vehicleReg:  row.vehicleReg ?? null,
          vehicleType: null,
          phone:       b.driverPhone ?? null,
        };
      },
    ),
    [],
  );

  function handleTripsExport() {
    const tripsSpec = getTableSpec(VENDOR_REPORT_TRIPS_TABLE_KEY);
    const rows = filteredTripRows.map((b) => {
      const out: Record<string, string | number> = {};
      for (const key of tripsVisibleCols) {
        const renderer = (tripsRenderers as Record<string, { csv: (b: Booking) => string | number }>)[key];
        const value = renderer ? renderer.csv(b) : "";
        const col = tripsSpec.columns.find((c) => c.key === key);
        if (col) out[col.label] = value;
      }
      return out;
    });
    exportToXlsx(`vendor-${vendor.id}-trips`, rows, "Trips");
  }

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
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            {/* Calendar — left */}
            <div style={{ position:"relative", display:"inline-block" }}>
              <button onClick={() => setCalOpen(v => !v)}
                style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"7px 14px", background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:9, cursor:"pointer", fontFamily:"inherit", fontSize:13, color:"#475569", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
                <span style={{ fontFamily:"monospace", fontWeight:500 }}>{dateLabel}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {calOpen && (
                <div style={{ position:"absolute", top:"100%", left:0, width:290, height:0, zIndex:200 }}>
                  <div style={{ position:"relative", width:"100%", height:"100%" }}>
                    <SharedDateRangePicker from={dateFrom} to={dateTo}
                      onApply={(f,t) => { setDateFrom(f); setDateTo(t); }}
                      onClose={() => setCalOpen(false)}/>
                  </div>
                </div>
              )}
            </div>
            {/* Title */}
            <div style={{ fontSize:13.5, fontWeight:700, color:"#0F172A" }}>
              {!walletLoading && <span style={{ fontSize:12, fontWeight:500, color:"#94A3B8" }}>{walletData.length} transactions</span>}
            </div>
            {/* Export — right */}
            <div style={{ marginLeft:"auto" }}>
              <ExportButton
                disabled={walletData.length === 0}
                onClick={() => exportToCsv("wallet-passbook.csv", walletData.map(t => ({
                  "Date & Time":   fmtDateTime(t.createdAt),
                  "Type":          txDisplayType(t.type),
                  "Supervisor":    t.supervisorName ?? "",
                  "Amount":        (t.type === "CREDIT" ? "+" : "-") + Math.abs(t.amount),
                  "Balance After": t.balanceAfter ?? "",
                  "Note":          t.note ?? "",
                })))}
              />
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

      {/* ── Trips ────────────────────────────────────────────────── */}
      {tab === "Trips" && (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            <SearchBar
              value={tripSearch}
              onChange={setTripSearch}
              placeholder="Search by ID, route, supervisor, company, driver, vehicle..."
            />

            <div style={{ position:"relative", flexShrink:0 }}>
              <button
                type="button"
                onClick={() => setCalOpen(v => !v)}
                title={dateLabel}
                className="inline-flex items-center gap-2 h-[42px] px-4 rounded-xl border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <CalendarDays size={14} className="text-slate-500" strokeWidth={1.8} />
                Date Range
              </button>
              {calOpen && (
                <SharedDateRangePicker
                  from={dateFrom}
                  to={dateTo}
                  onApply={(f,t) => { setDateFrom(f); setDateTo(t); }}
                  onClose={() => setCalOpen(false)}
                />
              )}
            </div>

            <ColumnsPopover
              tableKey={VENDOR_REPORT_TRIPS_TABLE_KEY}
              visible={tripsVisibleCols}
              totalCount={tripsTotalCols}
              onToggle={toggleTripsCol}
              onReset={resetTripsCols}
            />

            <ExportButton
              onClick={handleTripsExport}
              disabled={bookingsLoading || filteredTripRows.length === 0}
              className="ml-auto"
              label="Export XLSX"
            />
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8, color:"#64748B", fontSize:13 }}>
            <span style={{ fontWeight:700, color:"#94A3B8", fontSize:14 }}>{filteredTripRows.length}</span>
            <span>{filteredTripRows.length === 1 ? "trip" : "trips"}</span>
          </div>

          <TripsTable
            items={filteredTripRows}
            visibleCols={tripsVisibleCols}
            renderers={tripsRenderers}
            tableKey={VENDOR_REPORT_TRIPS_TABLE_KEY}
            isLoading={bookingsLoading}
            prefsLoading={tripsPrefsLoading}
            emptyMessage={bookingsData.length === 0 ? "No trips in this date range." : "No trips match your search."}
            onRowClick={setSelectedBooking}
          />
        </div>
      )}
      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />

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

type DriverReportTab = "overview" | "trips" | "earnings";

function PanelDriverReport({ driver }: { driver: DriverApiItem }) {
  const today = new Date();
  const [activeTab, setActiveTab] = useState<DriverReportTab>("overview");
  const [dateFrom, setDateFrom] = useState(toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [dateTo,   setDateTo]   = useState(toIsoDate(today));
  const [driverCalOpen, setDriverCalOpen] = useState(false);
  const [hovered,  setHovered]  = useState<number|null>(null);
  const [tripsLoading, setTripsLoading] = useState(true);
  const [tripsData, setTripsData] = useState<DriverTripsResponse | null>(null);

  // Trips tab: search / filter / columns
  const [tripsSearch,      setTripsSearch]      = useState("");
  const [filterOpen,       setFilterOpen]       = useState(false);
  const [tripStatus,       setTripStatus]       = useState("");
  const [tripType,         setTripType]         = useState("");
  const [draftTripStatus,  setDraftTripStatus]  = useState("");
  const [draftTripType,    setDraftTripType]    = useState("");
  const { columns: visibleCols, toggle: toggleCol, reset: resetCols, totalCount: totalColCount, loading: prefsLoading } = useColumnPreferences(DRIVER_TRIPS_TABLE_KEY);
  const tripsSpec = getTableSpec(DRIVER_TRIPS_TABLE_KEY);

  useEffect(() => {
    let cancelled = false;
    setTripsLoading(true);
    superadminApi.drivers.trips(driver.id, { startDate: dateFrom, endDate: dateTo, limit: 500 })
      .then(res => { if (!cancelled) setTripsData(res.data); })
      .catch(() => { if (!cancelled) setTripsData(null); })
      .finally(() => { if (!cancelled) setTripsLoading(false); });
    return () => { cancelled = true; };
  }, [driver.id, dateFrom, dateTo]);

  const driverBookings = tripsData?.trips ?? [];
  const stats = tripsData?.stats;

  const completed   = stats?.completedTrips ?? driverBookings.filter(b=>b.status==="Completed").length;
  const ongoing     = driverBookings.filter(b=>b.status==="Ongoing").length;
  const cancelled   = driverBookings.filter(b=>b.status==="Cancelled").length;
  const pending     = Math.max(0, driverBookings.length - completed - ongoing - cancelled);
  const totalFare   = stats?.totalFare ?? driverBookings.reduce((s,b)=>s+(b.fare||0),0);
  const completedFare = stats?.completedFare ?? driverBookings.filter(b=>b.status==="Completed").reduce((s,b)=>s+(b.fare||0),0);
  const avgFare     = stats?.avgFare ?? (completed>0 ? Math.round(completedFare/completed) : 0);
  const completionRate = driverBookings.length>0 ? Math.round((completed/driverBookings.length)*100) : 0;
  const initials = driver.name.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase() || "DR";

  const dailyData = useMemo(() => {
    const raw = tripsData?.weekDays ?? [];
    const days = raw.map(d => ({
      d: new Date(d.date+"T12:00:00").toLocaleDateString("en-IN", { day:"2-digit", month:"short" }),
      trips: d.bookings,
      fare: d.total,
    }));
    if (days.length > 0) return days;
    const start = new Date(dateFrom+"T00:00:00+05:30");
    const end = new Date(dateTo+"T00:00:00+05:30");
    const fallback: { d:string; trips:number; fare:number }[] = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      const key = toIsoDate(d);
      const rows = driverBookings.filter(b => toIsoDate(new Date(b.createdAt)) === key);
      fallback.push({
        d: d.toLocaleDateString("en-IN", { day:"2-digit", month:"short" }),
        trips: rows.length,
        fare: rows.reduce((s,b)=>s+(b.fare||0),0),
      });
    }
    if (fallback.length <= 14) return fallback;
    const step = Math.max(1, Math.floor(fallback.length / 14));
    return fallback.filter((_, i) => i % step === 0 || i === fallback.length - 1);
  }, [tripsData, driverBookings, dateFrom, dateTo]);

  const typeSplit = [
    { name:"Instant", value:driverBookings.filter(b=>b.type==="Instant").length, pct:0 },
    { name:"Scheduled", value:driverBookings.filter(b=>b.type==="Scheduled").length, pct:0 },
  ].map((x,_,arr) => {
    const total = arr.reduce((s,d)=>s+d.value,0);
    return { ...x, pct: total>0 ? Math.round((x.value/total)*100) : 0 };
  });

  const statusRows = [
    { label:"Completed", value:completed, color:"#16A34A", bg:"#DCFCE7" },
    { label:"Ongoing",   value:ongoing,   color:"#2563EB", bg:"#DBEAFE" },
    { label:"Pending",   value:pending,   color:"#B45309", bg:"#FEF3C7" },
    { label:"Cancelled", value:cancelled, color:"#B91C1C", bg:"#FEE2E2" },
  ];

  const supervisorRows = useMemo(() => {
    const m = new Map<string, { name:string; trips:number; fare:number }>();
    for (const b of driverBookings) {
      const name = b.supervisorName ?? "Unassigned";
      const row = m.get(name) ?? { name, trips:0, fare:0 };
      row.trips += 1;
      row.fare += b.fare || 0;
      m.set(name, row);
    }
    return [...m.values()].sort((a,b)=>b.trips-a.trips).slice(0,4);
  }, [driverBookings]);

  const activeFilterCount = (tripStatus ? 1 : 0) + (tripType ? 1 : 0);

  const filteredTrips = useMemo(() => {
    const allTrips = driverBookings;
    const q = tripsSearch.trim().toLowerCase();
    return allTrips.filter(b => {
      if (tripStatus && b.status !== tripStatus) return false;
      if (tripType   && b.type   !== tripType)   return false;
      if (!q) return true;
      const ref = (b.tripRef ?? b.id).toLowerCase();
      return (
        ref.includes(q) ||
        b.pickupLocation.toLowerCase().includes(q) ||
        b.dropLocation.toLowerCase().includes(q) ||
        (b.supervisorName ?? "").toLowerCase().includes(q) ||
        (b.type           ?? "").toLowerCase().includes(q) ||
        (b.status         ?? "").toLowerCase().includes(q)
      );
    });
  }, [driverBookings, tripsSearch, tripStatus, tripType]);

  const tripRenderers = useMemo(() => {
    function fmtDate(iso: string | null | undefined) {
      if (!iso) return null;
      const d = new Date(iso);
      return {
        day:  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }),
        time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toLowerCase(),
      };
    }
    function fmtDateCSV(iso: string | null | undefined) {
      if (!iso) return "";
      return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true });
    }
    function renderDate(iso: string | null | undefined) {
      const f = fmtDate(iso);
      return f
        ? <div className="flex flex-col"><span className="text-[13px] font-medium text-slate-700">{f.day}</span><span className="text-[11px] text-slate-400 mt-0.5">{f.time}</span></div>
        : <span className="text-[13px] text-slate-300 italic">—</span>;
    }
    return {
      tripId: {
        header:   () => "TRIP ID & TYPE",
        body:     (b: DriverTripItem) => (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="font-extrabold text-[#111827] text-[13px] truncate">{b.tripRef ?? b.id}</span>
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#eef2ff] text-blue-600 text-[10px] font-bold ring-1 ring-inset ring-blue-100/50">{b.type ?? "—"}</span>
          </div>
        ),
        skeleton: () => (<div className="space-y-2"><Skeleton className="h-3.5 w-16" /><Skeleton className="h-4 w-12 rounded" /></div>),
        csv:      (b: DriverTripItem) => `${b.tripRef ?? b.id}${b.type ? ` · ${b.type}` : ""}`,
      },
      route: {
        header:   () => "ROUTE",
        body:     (b: DriverTripItem) => (
          <div className="flex flex-col min-w-0 pr-4 gap-px">
            <span className="font-semibold text-[13px] text-slate-800 leading-tight truncate">{b.pickupLocation.split(",")[0]}</span>
            <div className="flex items-center gap-1">
              <div className="w-14 h-[2px] rounded-full" style={{ background: "linear-gradient(to right, #A5B4FC, #2563EB)" }} />
              <ArrowRight className="h-3 w-3 text-blue-600 shrink-0" />
            </div>
            <span className="text-[12px] text-gray-500 truncate">{b.dropLocation.split(",")[0]}</span>
          </div>
        ),
        skeleton: () => (<div className="space-y-1.5 pr-4"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-2/3" /></div>),
        csv:      (b: DriverTripItem) => `${b.pickupLocation} → ${b.dropLocation}`,
      },
      supervisorCompany: {
        header:   () => "SUPERVISOR & COMPANY",
        body:     (b: DriverTripItem) => (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="text-[13px] font-medium text-slate-600 truncate">{b.supervisorName ?? "—"}</span>
            {b.companyName
              ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-semibold truncate max-w-[130px]">{b.companyName}</span>
              : <span className="text-[11px] text-slate-300 italic">—</span>}
          </div>
        ),
        skeleton: () => (<div className="space-y-1.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3 w-20" /></div>),
        csv:      (b: DriverTripItem) => `${b.supervisorName ?? ""}${b.companyName ? ` · ${b.companyName}` : ""}`,
      },
      vehicle:   { header: () => "VEHICLE",   body: (b: DriverTripItem) => b.vehicleType ? <span className="text-[13px] font-medium text-slate-600 truncate block">{b.vehicleType}</span> : <span className="text-[13px] text-slate-300 italic">—</span>, skeleton: () => <Skeleton className="h-3.5 w-24" />, csv: (b: DriverTripItem) => b.vehicleType ?? "" },
      driver:    { header: () => "DRIVER",    body: (b: DriverTripItem) => b.driverName  ? <span className="text-[13px] font-medium text-slate-600 truncate block">{b.driverName}</span>  : <span className="text-[13px] text-slate-300 italic">—</span>, skeleton: () => <Skeleton className="h-3.5 w-24" />, csv: (b: DriverTripItem) => b.driverName ?? "" },
      fare:      { header: () => "FARE",      body: (b: DriverTripItem) => b.fare != null ? <span className="text-[13px] font-bold text-slate-800 tabular-nums">₹{Number(b.fare).toLocaleString("en-IN")}</span> : <span className="text-[13px] text-slate-300 italic">—</span>, skeleton: () => <Skeleton className="h-3.5 w-16" />, csv: (b: DriverTripItem) => b.fare ?? "" },
      status:    { header: () => "STATUS",    body: (b: DriverTripItem) => <TripStatusBadge status={b.status ?? "Pending"} />, skeleton: () => <Skeleton className="h-6 w-20 rounded-full" />, csv: (b: DriverTripItem) => b.status ?? "" },
      pickupTime:  { header: () => "PICKUP TIME",  body: (b: DriverTripItem) => renderDate(b.pickupTime),  skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>), csv: (b: DriverTripItem) => fmtDateCSV(b.pickupTime) },
      scheduledAt: { header: () => "SCHEDULED AT", body: (b: DriverTripItem) => renderDate(b.scheduledAt), skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>), csv: (b: DriverTripItem) => fmtDateCSV(b.scheduledAt) },
      createdAt:   { header: () => "CREATED AT",   body: (b: DriverTripItem) => renderDate(b.createdAt),   skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>), csv: (b: DriverTripItem) => fmtDateCSV(b.createdAt) },
      completedAt: { header: () => "COMPLETED AT", body: (b: DriverTripItem) => renderDate(b.completedAt), skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>), csv: (b: DriverTripItem) => fmtDateCSV(b.completedAt) },
      startedAt:   { header: () => "STARTED AT",   body: (b: DriverTripItem) => renderDate(b.startedAt),   skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>), csv: (b: DriverTripItem) => fmtDateCSV(b.startedAt) },
      passengers:  { header: () => "PASSENGERS",   body: (b: DriverTripItem) => <span className="text-[13px] text-slate-700 tabular-nums">{b.passengers}</span>, skeleton: () => <Skeleton className="h-3.5 w-8" />, csv: (b: DriverTripItem) => b.passengers },
      distance:    { header: () => "DISTANCE",      body: (b: DriverTripItem) => b.distanceKm != null ? <span className="text-[13px] text-slate-700 tabular-nums">{Number(b.distanceKm).toFixed(1)} km</span> : <span className="text-[13px] text-slate-300 italic">—</span>, skeleton: () => <Skeleton className="h-3.5 w-14" />, csv: (b: DriverTripItem) => b.distanceKm ?? "" },
      notes:       { header: () => "NOTES",         body: (b: DriverTripItem) => b.notes ? <span className="text-[12px] text-slate-600 truncate block" title={b.notes}>{b.notes}</span> : <span className="text-[13px] text-slate-300 italic">—</span>, skeleton: () => <Skeleton className="h-3.5 w-24" />, csv: (b: DriverTripItem) => b.notes ?? "" },
      invoice:     { header: () => "INVOICE",       body: (b: DriverTripItem) => b.invoiceId ? <span className="text-[12px] font-mono text-slate-600 truncate block">{b.invoiceId.slice(0, 8)}</span> : <span className="text-[13px] text-slate-300 italic">—</span>, skeleton: () => <Skeleton className="h-3.5 w-16" />, csv: (b: DriverTripItem) => b.invoiceId ?? "" },
      vendor:      { header: () => "VENDOR",        body: (b: DriverTripItem) => b.vendorName ? <span className="text-[13px] font-medium text-slate-600 truncate block" title={b.vendorName}>{b.vendorName}</span> : <span className="text-[13px] text-slate-300 italic">—</span>, skeleton: () => <Skeleton className="h-3.5 w-24" />, csv: (b: DriverTripItem) => b.vendorName ?? "" },
    };
  }, []);

  const tripsGridTemplate = useMemo(
    () => visibleCols.map(k => { const c = tripsSpec.columns.find(x => x.key === k); return c ? `minmax(${c.minWidth}px, 1fr)` : "1fr"; }).join(" "),
    [visibleCols, tripsSpec.columns],
  );
  const tripsMinWidth = useMemo(
    () => visibleCols.reduce((s, k) => s + (tripsSpec.columns.find(x => x.key === k)?.minWidth ?? 100), 0) + 48,
    [visibleCols, tripsSpec.columns],
  );

  function handleTripsExport() {
    const fmtDateParts = (iso: string | null | undefined) => {
      if (!iso) return { date: "", time: "" };
      const d = new Date(iso);
      return {
        date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }),
        time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
      };
    };
    const rows = filteredTrips.map(b => {
      const out: Record<string, string | number> = {};
      for (const k of visibleCols) {
        const col = tripsSpec.columns.find(c => c.key === k);
        if (!col) continue;
        if (k === "tripId") { out["Trip ID"] = b.tripRef ?? b.id; out["Trip Type"] = b.type ?? ""; continue; }
        if (k === "route") { out["Pickup Address"] = b.pickupLocation; out["Destination Address"] = b.dropLocation; continue; }
        if (k === "supervisorCompany") { out["Supervisor"] = b.supervisorName ?? ""; out["Company"] = b.companyName ?? ""; continue; }
        if (["pickupTime","scheduledAt","createdAt","completedAt","startedAt"].includes(k)) {
          const label = col.label.replace(/\s+At$/, "");
          const parts = fmtDateParts(b[k as "pickupTime"|"scheduledAt"|"createdAt"|"completedAt"|"startedAt"]);
          out[`${label} Date`] = parts.date; out[`${label} Time`] = parts.time; continue;
        }
        const r = (tripRenderers as Record<string, { csv: (b: DriverTripItem) => string | number }>)[k];
        out[col.label] = r ? r.csv(b) : "";
      }
      return out;
    });
    exportToCsv(`driver-trips-${driver.name.replace(/\s+/g, "-").toLowerCase()}`, rows);
  }

  const TABS: { key: DriverReportTab; label: string }[] = [
    { key:"overview", label:"Overview" },
    { key:"trips", label:"Trips" },
    { key:"earnings", label:"Earnings" },
  ];
  const driverDateLabel = `${new Date(dateFrom+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short"})} — ${new Date(dateTo+"T00:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}`;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <Card style={{ padding:"18px 22px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14, flex:1, minWidth:260 }}>
          <div style={{ width:52, height:52, borderRadius:"50%", background:"#EFF6FF", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:19, color:A, flexShrink:0 }}>
            {initials}
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap" }}>
              <div style={{ fontSize:18, fontWeight:800, color:"#0F172A", lineHeight:1.2 }}>{driver.name}</div>
              <Badge label={driver.status} color={driver.status==="Offline"?"#64748B":"#15803D"} bg={driver.status==="Offline"?"#F1F5F9":"#DCFCE7"} dot={driver.status==="Offline"?"#94A3B8":"#22C55E"}/>
            </div>
            <div style={{ fontSize:12, color:"#64748B", marginTop:4 }}>
              {[driver.driverRef, driver.phone, driver.vehicle?.plateNumber].filter(Boolean).join(" · ") || "Driver report"}
            </div>
          </div>
        </div>
      </Card>

      {tripsLoading && <SharedReportSkeleton hideHeader statCount={4}/>}

      {!tripsLoading && (
      <>
      <div style={{ display:"flex", borderBottom:"1.5px solid #E8EEF4" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={()=>setActiveTab(t.key)}
            style={{ padding:"10px 20px", border:"none", borderBottom: activeTab===t.key ? `2.5px solid ${A}` : "2.5px solid transparent",
              marginBottom:-1.5, cursor:"pointer", fontFamily:"inherit", fontSize:14, fontWeight:activeTab===t.key?700:500,
              background:"transparent", color:activeTab===t.key?A:"#64748B" }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab !== "trips" && <div style={{ position:"relative", display:"inline-block", width:"fit-content" }}>
        <button onClick={() => setDriverCalOpen(v => !v)}
          className="inline-flex items-center gap-2 h-[42px] px-4 rounded-xl border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors">
          <CalendarDays size={14} className="text-slate-500" strokeWidth={1.8} />
          <span className="max-w-[190px] truncate">{driverDateLabel}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        {driverCalOpen && (
          <SharedDateRangePicker
            from={dateFrom}
            to={dateTo}
            onApply={(f,t) => { setDateFrom(f); setDateTo(t); }}
            onClose={() => setDriverCalOpen(false)}
          />
        )}
      </div>}

      {activeTab === "overview" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
            <StatCard label="Total Trips" value={driverBookings.length} sub="In selected period" iconBg="#EFF6FF"
              icon={<Route size={17} color="#64748B" strokeWidth={1.4}/>}/>
            <StatCard label="Completed" value={completed} sub={`${completionRate}% completion`} iconBg="#DCFCE7"
              icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="#64748B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}/>
            <StatCard label="Total Fare" value={totalFare>0?fmt(totalFare):"—"} sub="All trips in period" iconBg="#FEF3C7"
              icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="2" stroke="#64748B" strokeWidth="1.4"/><path d="M1 7h14" stroke="#64748B" strokeWidth="1.4"/><circle cx="12.5" cy="10" r="1" fill="#64748B"/></svg>}/>
            <StatCard label="Avg Completed Fare" value={avgFare>0?fmt(avgFare):"—"} sub="Per completed trip" iconBg="#F8FAFC"
              icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2 12L6 8l3 3 5-7" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}/>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16, alignItems:"stretch" }}>
            <Card style={{ padding:"20px 22px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:"#0F172A" }}>Daily Trip Volume</div>
                  <div style={{ fontSize:12, color:"#94A3B8", marginTop:3 }}>Trips handled by this driver across the selected range</div>
                </div>
                <Badge label={`${driverBookings.length} trips`} color="#1D4ED8" bg="#DBEAFE"/>
              </div>
              {dailyData.some(d=>d.trips>0)
                ? <SharedSvgBarChart data={dailyData} xKey="d" yKey="trips" color={A} height={230} yLabel="Trips"/>
                : <EmptyState msg="No trip volume to visualize"/>}
            </Card>

            <Card style={{ padding:"20px 22px", display:"flex", flexDirection:"column" }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#0F172A" }}>Booking Type Split</div>
              <div style={{ fontSize:12, color:"#94A3B8", marginTop:3, marginBottom:16 }}>Instant vs scheduled workload</div>
              {typeSplit.some(d=>d.value>0) ? (
                <>
                  <SharedSvgDonut data={typeSplit} colors={["#2563EB","#F59E0B"]} size={170} thickness={24}/>
                  <div style={{ marginTop:18, display:"flex", flexDirection:"column", gap:9 }}>
                    {typeSplit.map((d,i)=>(
                      <div key={d.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:12.5 }}>
                        <span style={{ display:"flex", alignItems:"center", gap:8, color:"#64748B" }}><span style={{ width:8, height:8, borderRadius:2, background:i===0?"#2563EB":"#F59E0B" }}/>{d.name}</span>
                        <span style={{ fontWeight:800, color:"#0F172A" }}>{d.value} · {d.pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <EmptyState msg="No booking type data"/>}
            </Card>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <Card style={{ padding:"18px 20px" }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#0F172A", marginBottom:14 }}>Status Breakdown</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
                {statusRows.map(s=>(
                  <div key={s.label} style={{ background:s.bg, borderRadius:10, padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:12.5, fontWeight:700, color:s.color }}>{s.label}</span>
                    <span style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card style={{ padding:"18px 20px" }}>
              <div style={{ fontSize:14, fontWeight:800, color:"#0F172A", marginBottom:12 }}>Top Supervisors</div>
              {supervisorRows.length===0 ? <EmptyState msg="No supervisor activity"/> : supervisorRows.map(row=>(
                <div key={row.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid #F1F5F9" }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>{row.name}</div>
                    <div style={{ fontSize:11.5, color:"#94A3B8", marginTop:2 }}>{row.trips} trips</div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#0F172A" }}>{row.fare>0?fmt(row.fare):"—"}</div>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {activeTab === "trips" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex gap-3 items-center flex-wrap">
            <SearchBar
              value={tripsSearch}
              onChange={setTripsSearch}
              placeholder="Search by trip ID, route, supervisor, company, type, status..."
            />

            <div className="relative">
              <FilterTrigger
                onClick={() => {
                  if (!filterOpen) { setDraftTripStatus(tripStatus); setDraftTripType(tripType); }
                  setFilterOpen(v => !v);
                }}
                activeCount={activeFilterCount}
              />
              <FilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                activeCount={activeFilterCount}
                onClearAll={() => { setDraftTripStatus(""); setDraftTripType(""); }}
                onApply={() => { setTripStatus(draftTripStatus); setTripType(draftTripType); setFilterOpen(false); }}
                onCancel={() => setFilterOpen(false)}
              >
                <FilterSection label="Status">
                  {["Completed", "Ongoing", "Cancelled", "Pending"].map(s => (
                    <FilterPill key={s} label={s} active={draftTripStatus === s} onClick={() => setDraftTripStatus(p => p === s ? "" : s)} />
                  ))}
                </FilterSection>
                <FilterSection label="Trip Type">
                  {["Instant", "Scheduled"].map(t => (
                    <FilterPill key={t} label={t} active={draftTripType === t} onClick={() => setDraftTripType(p => p === t ? "" : t)} />
                  ))}
                </FilterSection>
              </FilterPanel>
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setDriverCalOpen(v => !v)}
                title={driverDateLabel}
                className="inline-flex items-center gap-2 h-[42px] px-4 rounded-xl border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <CalendarDays size={14} className="text-slate-500" strokeWidth={1.8} />
                <span className="max-w-[190px] truncate">{driverDateLabel}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {driverCalOpen && (
                <SharedDateRangePicker
                  from={dateFrom}
                  to={dateTo}
                  onApply={(f,t) => { setDateFrom(f); setDateTo(t); }}
                  onClose={() => setDriverCalOpen(false)}
                />
              )}
            </div>

            <ColumnsPopover
              tableKey={DRIVER_TRIPS_TABLE_KEY}
              visible={visibleCols}
              totalCount={totalColCount}
              onToggle={toggleCol}
              onReset={resetCols}
            />

            <ExportButton
              onClick={handleTripsExport}
              disabled={tripsLoading || filteredTrips.length === 0}
              className="ml-auto"
            />
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="w-full overflow-x-auto">
              <div style={{ minWidth: tripsMinWidth }}>
                {/* Header */}
                <div
                  className="grid items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-[2] backdrop-blur"
                  style={{ gridTemplateColumns: tripsGridTemplate }}
                >
                  {prefsLoading
                    ? Array.from({ length: visibleCols.length }).map((_, i) => (
                        <Skeleton key={i} className={`h-3 ${i === 0 ? "w-24" : "w-16"}`} />
                      ))
                    : visibleCols.map((k, i) => {
                        const col = tripsSpec.columns.find(c => c.key === k);
                        if (!col) return null;
                        return (
                          <div
                            key={k}
                            className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate"
                            style={i === 0 ? { position: "sticky" as const, left: 0, background: "rgb(248 250 252 / 0.95)", zIndex: 3 } : undefined}
                          >
                            {col.label}
                          </div>
                        );
                      })}
                </div>

                {/* Body */}
                <div className="flex flex-col divide-y divide-slate-100">
                  {(tripsLoading || prefsLoading) ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="grid items-center gap-4 px-6 py-3.5" style={{ gridTemplateColumns: tripsGridTemplate }}>
                        {visibleCols.map((k, j) => {
                          const r = (tripRenderers as Record<string, { skeleton: () => React.JSX.Element }>)[k];
                          return (
                            <div key={k} className="min-w-0" style={j === 0 ? { position: "sticky" as const, left: 0, background: "white", zIndex: 1 } : undefined}>
                              {r?.skeleton() ?? <Skeleton className="h-3.5 w-14" />}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  ) : filteredTrips.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-[13px]">
                      {tripsSearch.trim() || tripStatus || tripType ? "No trips match your filters." : "No trips yet."}
                    </div>
                  ) : (
                    filteredTrips.map(b => (
                      <div
                        key={b.tripRef ?? b.id}
                        className="grid items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors"
                        style={{ gridTemplateColumns: tripsGridTemplate }}
                      >
                        {visibleCols.map((k, j) => {
                          const r = (tripRenderers as Record<string, { body: (b: DriverTripItem) => React.ReactNode }>)[k];
                          return (
                            <div key={k} className="min-w-0" style={j === 0 ? { position: "sticky" as const, left: 0, background: "white", zIndex: 1 } : undefined}>
                              {r ? r.body(b) : <span className="text-[13px] text-slate-300 italic">—</span>}
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

      {activeTab === "earnings" && (
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            <StatCard label="Gross Fare" value={totalFare>0?fmt(totalFare):"—"} sub="All trips" iconBg="#FEF3C7"
              icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="14" height="9" rx="2" stroke="#64748B" strokeWidth="1.4"/><path d="M1 7h14" stroke="#64748B" strokeWidth="1.4"/></svg>}/>
            <StatCard label="Completed Fare" value={completedFare>0?fmt(completedFare):"—"} sub="Completed trips only" iconBg="#DCFCE7"
              icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4" stroke="#64748B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}/>
            <StatCard label="Avg Fare" value={avgFare>0?fmt(avgFare):"—"} sub="Per completed trip" iconBg="#F1F5F9"
              icon={<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2 12L6 8l3 3 5-7" stroke="#64748B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}/>
          </div>
          <Card style={{ padding:"20px 22px" }}>
            <div style={{ fontSize:14, fontWeight:800, color:"#0F172A" }}>Daily Fare Trend</div>
            <div style={{ fontSize:12, color:"#94A3B8", marginTop:3, marginBottom:18 }}>Fare generated by day in the selected range</div>
            {dailyData.some(d=>d.fare>0)
              ? <SharedSvgBarChart data={dailyData} xKey="d" yKey="fare" color="#16A34A" height={260} yFormat={fmtINRk} yLabel="Fare"/>
              : <EmptyState msg="No fare data to visualize"/>}
          </Card>
        </div>
      )}

      </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */
type ReportType = "vendor" | "driver";

export default function SuperAdminReportsPage() {
  const searchParams = useSearchParams();
  const requestedReportType: ReportType = searchParams.get("type") === "driver" ? "driver" : "vendor";
  const [modalOpen,  setModalOpen]  = useState(true);
  const [modalTab,   setModalTab]   = useState<ReportType>("vendor");
  const [vendorQ,    setVendorQ]    = useState("");
  const [driverQ,    setDriverQ]    = useState("");

  const [selVendor, setSelVendor] = useState<VendorListItem|null>(null);
  const [selDriver, setSelDriver] = useState<DriverApiItem|null>(null);
  const hasReport = selVendor !== null || selDriver !== null;

  const [vendorList,        setVendorList]        = useState<VendorListItem[]>([]);
  const [vendorListLoading, setVendorListLoading] = useState(false);

  const [driverList,        setDriverList]        = useState<DriverApiItem[]>([]);
  const [driverListLoading, setDriverListLoading] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setModalTab(requestedReportType);
      setVendorQ("");
      setDriverQ("");
      setSelVendor(null);
      setSelDriver(null);
      setModalOpen(true);
    });
  }, [requestedReportType]);

  useEffect(() => {
    setVendorListLoading(true);
    vendorReportApi.listVendors()
      .then(res  => setVendorList(res.data))
      .catch(()  => setVendorList([]))
      .finally(() => setVendorListLoading(false));
  }, []);

  useEffect(() => {
    if (modalTab !== "driver" || driverList.length > 0 || driverListLoading) return;
    setDriverListLoading(true);
    superadminApi.drivers.list({ limit: 200 })
      .then(res  => setDriverList(res.data))
      .catch(()  => setDriverList([]))
      .finally(() => setDriverListLoading(false));
  }, [modalTab, driverList.length, driverListLoading]);

  function openModal(type: ReportType = selDriver ? "driver" : selVendor ? "vendor" : requestedReportType) {
    setVendorQ("");
    setDriverQ("");
    setModalTab(type);
    setModalOpen(true);
  }
  function pickVendor(v: VendorListItem) { setSelVendor(v); setSelDriver(null); setModalOpen(false); }
  function pickDriver(d: DriverApiItem)  { setSelDriver(d); setSelVendor(null); setModalOpen(false); }

  const filteredVendors = useMemo(() => {
    const q = vendorQ.trim().toLowerCase();
    if (!q) return vendorList.slice(0, 6);
    return vendorList.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.city.toLowerCase().includes(q) ||
      (v.contactName  ?? "").toLowerCase().includes(q) ||
      (v.contactPhone ?? "").toLowerCase().includes(q)
    );
  }, [vendorList, vendorQ]);

  const filteredDrivers = useMemo(() => {
    const q = driverQ.trim().toLowerCase();
    if (!q) return driverList.slice(0, 6);
    return driverList.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.phone.toLowerCase().includes(q) ||
      (d.vehicle?.plateNumber ?? "").toLowerCase().includes(q) ||
      (d.vehicle?.model       ?? "").toLowerCase().includes(q)
    );
  }, [driverList, driverQ]);

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
            <button onClick={() => openModal()} style={{ padding:"11px 28px", background:A, color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
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
            <button onClick={() => openModal()} style={{ padding:"7px 16px", background:"#fff", color:"#475569", border:"1.5px solid #E2E8F0", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              Change Report
            </button>
          </div>
          {selVendor && <PanelVendorReport vendor={selVendor}/>}
          {selDriver && <PanelDriverReport driver={selDriver}/>}
        </div>
      )}

      {/* ── MODAL ── */}
      {modalOpen && (
        <div onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}
          style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50, padding:16 }}>
          <div style={{ background:"#fff", borderRadius:20, width:500, maxWidth:"100%", maxHeight:"88vh", display:"flex", flexDirection:"column", boxShadow:"0 32px 80px rgba(0,0,0,0.20)", overflow:"hidden" }}>

            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", padding:"18px 22px 0", flexShrink:0 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:800, color:"#0F172A" }}>Generate Report</div>
                <div style={{ fontSize:11.5, color:"#94A3B8", marginTop:1 }}>
                  {modalTab === "vendor" ? "Select a vendor to view their report" : "Select a driver to view their report"}
                </div>
              </div>
              <button onClick={() => setModalOpen(false)}
                style={{ width:34, height:34, borderRadius:9, border:"1.5px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Vendor panel */}
            {modalTab === "vendor" && (
              <>
                <div style={{ padding:"14px 22px 8px", flexShrink:0 }}>
                  <div style={{ position:"relative" }}>
                    <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} width="14" height="14" viewBox="0 0 15 15" fill="none">
                      <circle cx="6.5" cy="6.5" r="4.5" stroke="#94A3B8" strokeWidth="1.4"/>
                      <path d="M10.5 10.5L13 13" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <input value={vendorQ} onChange={e => setVendorQ(e.target.value)}
                      placeholder="Search by name, city, contact person, or mobile…"
                      autoFocus
                      style={{ width:"100%", padding:"9px 14px 9px 32px", border:"1.5px solid #E2E8F0", borderRadius:10, fontSize:13, fontFamily:"inherit", background:"#FAFBFC", color:"#374151", outline:"none", boxSizing:"border-box" }}/>
                    {vendorQ && (
                      <button onClick={() => setVendorQ("")}
                        style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#94A3B8", padding:0, lineHeight:1 }}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round"/></svg>
                      </button>
                    )}
                  </div>
                  {!vendorQ && vendorList.length > 0 && (
                    <div style={{ fontSize:11, color:"#CBD5E1", marginTop:6, paddingLeft:2 }}>
                      Showing {Math.min(6, vendorList.length)} of {vendorList.length} vendors
                    </div>
                  )}
                </div>
                <div style={{ overflowY:"auto", flex:1 }}>
                  {vendorListLoading
                    ? <div style={{ padding:"28px", textAlign:"center", color:"#94A3B8", fontSize:13 }}>Loading vendors…</div>
                    : filteredVendors.length === 0
                      ? <EmptyState msg={vendorQ ? "No vendors match your search" : "No vendors found"}/>
                      : filteredVendors.map((v, i) => (
                        <div key={i} onClick={() => pickVendor(v)}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                          style={{ padding:"13px 22px", cursor:"pointer", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"center", gap:12, transition:"background 0.12s" }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>{v.name}</div>
                            <div style={{ fontSize:11.5, color:"#94A3B8", marginTop:1 }}>
                              {v.city}{v.contactName ? ` · ${v.contactName}` : ""}{v.contactPhone ? ` · ${v.contactPhone}` : ""}
                            </div>
                          </div>
                          <Badge label={v.status}
                            color={v.status === "Active" ? "#15803D" : "#64748B"}
                            bg={v.status === "Active" ? "#DCFCE7" : "#F1F5F9"}
                            dot={v.status === "Active" ? "#22C55E" : "#94A3B8"}/>
                        </div>
                      ))
                  }
                </div>
              </>
            )}

            {/* Driver panel */}
            {modalTab === "driver" && (
              <>
                <div style={{ padding:"14px 22px 8px", flexShrink:0 }}>
                  <div style={{ position:"relative" }}>
                    <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} width="14" height="14" viewBox="0 0 15 15" fill="none">
                      <circle cx="6.5" cy="6.5" r="4.5" stroke="#94A3B8" strokeWidth="1.4"/>
                      <path d="M10.5 10.5L13 13" stroke="#94A3B8" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <input value={driverQ} onChange={e => setDriverQ(e.target.value)}
                      placeholder="Search by name, mobile, vehicle no., or model…"
                      autoFocus
                      style={{ width:"100%", padding:"9px 14px 9px 32px", border:"1.5px solid #E2E8F0", borderRadius:10, fontSize:13, fontFamily:"inherit", background:"#FAFBFC", color:"#374151", outline:"none", boxSizing:"border-box" }}/>
                    {driverQ && (
                      <button onClick={() => setDriverQ("")}
                        style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#94A3B8", padding:0, lineHeight:1 }}>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 1.5l10 10M11.5 1.5l-10 10" stroke="#94A3B8" strokeWidth="1.6" strokeLinecap="round"/></svg>
                      </button>
                    )}
                  </div>
                  {!driverQ && driverList.length > 0 && (
                    <div style={{ fontSize:11, color:"#CBD5E1", marginTop:6, paddingLeft:2 }}>
                      Showing {Math.min(6, driverList.length)} of {driverList.length} drivers
                    </div>
                  )}
                </div>
                <div style={{ overflowY:"auto", flex:1 }}>
                  {driverListLoading
                    ? <div style={{ padding:"28px", textAlign:"center", color:"#94A3B8", fontSize:13 }}>Loading drivers…</div>
                    : filteredDrivers.length === 0
                      ? <EmptyState msg={driverQ ? "No drivers match your search" : "No drivers found"}/>
                      : filteredDrivers.map((d, i) => {
                        const isOnline = d.isOnline;
                        return (
                          <div key={i} onClick={() => pickDriver(d)}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                            style={{ padding:"13px 22px", cursor:"pointer", borderBottom:"1px solid #F1F5F9", display:"flex", alignItems:"center", gap:12, transition:"background 0.12s" }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:14, fontWeight:700, color:"#0F172A", fontFamily:"monospace" }}>{d.vehicle?.plateNumber || d.name}</div>
                              <div style={{ fontSize:11.5, color:"#94A3B8", marginTop:1 }}>{d.name} · {d.phone}{d.vehicle?.model ? ` · ${d.vehicle.model}` : ""}</div>
                            </div>
                            <Badge label={isOnline ? "Online" : "Offline"}
                              color={isOnline ? "#15803D" : "#64748B"}
                              bg={isOnline ? "#DCFCE7" : "#F1F5F9"}
                              dot={isOnline ? "#22C55E" : "#94A3B8"}/>
                          </div>
                        );
                      })
                  }
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

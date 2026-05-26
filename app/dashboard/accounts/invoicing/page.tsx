"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import TripInvoiceView from "./TripInvoiceView";
import { Plus, Download, IndianRupee, CheckCircle2, Clock, X, ChevronLeft, FileText, Loader2, Ban, ChevronDown, CalendarDays } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { formatInvoiceNumber } from "@/lib/invoice-format";
import {
  invoicesApi,
  companiesApi,
  type InvoiceListItem,
  type InvoiceDetail,
  type InvoiceSummary,
  type InvoiceTripItem,
  type CompanyApiItem,
} from "@/lib/api";
import { DateRangePicker } from "@/modules/reports/DateRangePicker";
import { toIsoDate } from "@/modules/reports/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";
import { ExportButton } from "@/components/ExportButton";

const A    = "#2563EB";
const FONT = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";
const CARD: React.CSSProperties = {
  background: "#fff", border: "1.5px solid #E8EEF4",
  borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};

type InvStatus = InvoiceListItem["status"];

const SC: Record<InvStatus, { bg:string; text:string; border:string; dot:string }> = {
  Paid:    { bg:"#DCFCE7", text:"#15803D", border:"#BBF7D0", dot:"#16A34A" },
  Pending: { bg:"#FEF3C7", text:"#B45309", border:"#FDE68A", dot:"#F59E0B" },
  Overdue: { bg:"#FEE2E2", text:"#B91C1C", border:"#FECACA", dot:"#DC2626" },
  Voided:  { bg:"#F1F5F9", text:"#64748B", border:"#E2E8F0", dot:"#94A3B8" },
};

function fmt(n: number) { return "₹" + n.toLocaleString("en-IN"); }
function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtPeriod(from: string, to: string) {
  const fd = new Date(from + "T12:00:00");
  const td = new Date(to   + "T12:00:00");
  if (from === to) {
    return fd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  return `${fd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — ${td.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
}

function effectiveStatus(inv: { status: InvStatus; dueDate: string }): InvStatus {
  if (inv.status === "Pending" && new Date(inv.dueDate) < new Date(new Date().toDateString())) {
    return "Overdue";
  }
  return inv.status;
}


function DrawerPanel({ open, onClose, children }: { open:boolean; onClose:()=>void; children:React.ReactNode }) {
  return (
    <>
      {open && <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.35)", zIndex:40 }}/>}
      <div style={{
        position:"fixed", top:0, right:0, bottom:0, width:520, maxWidth:"100vw",
        background:"#fff", boxShadow:"-8px 0 32px rgba(0,0,0,0.12)", zIndex:50,
        display:"flex", flexDirection:"column", fontFamily:FONT,
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition:"transform 0.28s cubic-bezier(0.4,0,0.2,1)",
      }}>
        {children}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: InvStatus }) {
  const s = SC[status];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:s.bg, color:s.text,
      border:`1px solid ${s.border}`, borderRadius:20, fontSize:11, fontWeight:700,
      padding:"3px 8px 3px 7px", whiteSpace:"nowrap" }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:s.dot, flexShrink:0 }}/>
      {status}
    </span>
  );
}

function TripsMiniTable({ rows, total }: { rows: InvoiceTripItem[]; total: number }) {
  return (
    <div style={{ border:"1.5px solid #E8EEF4", borderRadius:12, overflow:"hidden" }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px", gap:8, padding:"9px 14px", background:"#F8FAFC", borderBottom:"1px solid #E8EEF4" }}>
        {["Trip / Route","Date","Fare"].map(h => (
          <div key={h} style={{ fontSize:10.5, fontWeight:700, color:"#CBD5E1", textTransform:"uppercase", letterSpacing:"0.05em" }}>{h}</div>
        ))}
      </div>
      {rows.map((t, i) => (
        <div key={t.tripId} style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px", gap:8, padding:"11px 14px",
          borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:12.5, fontWeight:600, color:"#0F172A", fontFamily:"monospace" }}>{t.tripRef || "—"}</div>
            <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>{(t.pickupAddress || "").split(",")[0]} → {(t.dropAddress || "").split(",")[0]}</div>
          </div>
          <div style={{ fontSize:12, color:"#475569" }}>
            {t.pickupTime ? new Date(t.pickupTime).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
          </div>
          <div style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>{fmt(t.fare)}</div>
        </div>
      ))}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px", gap:8, padding:"11px 14px",
        background:"#F8FAFC", borderTop:"2px solid #E8EEF4", alignItems:"center" }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#0F172A", gridColumn:"1/3" }}>Subtotal</div>
        <div style={{ fontSize:15, fontWeight:800, color:A }}>{fmt(total)}</div>
      </div>
    </div>
  );
}

function TripsMiniTableSkeleton() {
  const bar = (w: string, h = 10) => (
    <div className="animate-pulse" style={{ height:h, borderRadius:5, background:"#E2E8F0", width:w }}/>
  );
  return (
    <div style={{ border:"1.5px solid #E8EEF4", borderRadius:12, overflow:"hidden" }}>
      {/* header */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px", gap:8, padding:"9px 14px", background:"#F8FAFC", borderBottom:"1px solid #E8EEF4" }}>
        {bar("55%")} {bar("60%")} {bar("50%")}
      </div>
      {/* rows */}
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px", gap:8, padding:"13px 14px", borderBottom:"1px solid #F1F5F9", alignItems:"center" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {bar("40%", 9)} {bar("70%", 8)}
          </div>
          {bar("65%", 9)} {bar("55%", 11)}
        </div>
      ))}
      {/* footer */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px", gap:8, padding:"11px 14px", background:"#F8FAFC", borderTop:"2px solid #E8EEF4", alignItems:"center" }}>
        <div style={{ gridColumn:"1/3" }}>{bar("30%", 10)}</div>
        {bar("60%", 12)}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   PAGE
══════════════════════════════════════ */
export default function InvoicingPage() {
  const todayStr = toIsoDate(new Date());

  const { columns: visibleCols, toggle, reset, totalCount, loading: prefsLoading } = useColumnPreferences("invoices");
  const spec = getTableSpec("invoices");

  const gridTemplate = useMemo(() => {
    // Always append a fixed 110px column for the Download action
    const dataCols = visibleCols.map(key => {
      const col = spec.columns.find(c => c.key === key);
      return col ? `${col.minWidth}px` : "100px";
    }).join(" ");
    return `${dataCols} 110px`;
  }, [visibleCols, spec.columns]);

  const minTableWidth = useMemo(
    () => visibleCols.reduce((sum, k) => sum + (spec.columns.find(c => c.key === k)?.minWidth ?? 100), 0) + 110 + 40,
    [visibleCols, spec.columns],
  );

  const [invoices,    setInvoices]    = useState<InvoiceListItem[]>([]);
  const [summary,     setSummary]     = useState<InvoiceSummary>({ totalBilled: 0, collected: 0, outstanding: 0, totalCount: 0, paidCount: 0, unpaidCount: 0 });
  const [companies,   setCompanies]   = useState<CompanyApiItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const [drawerMode,  setDrawerMode]  = useState<"new"|"view"|null>(null);
  const [step,        setStep]        = useState<1|2>(1);

  // Company selector
  const [selCompany,  setSelCompany]  = useState("");
  const [companyOpen, setCompanyOpen] = useState(false);

  // Period — now a single date range
  const [periodFrom,  setPeriodFrom]  = useState(todayStr);
  const [periodTo,    setPeriodTo]    = useState(todayStr);
  const [pickerOpen,  setPickerOpen]  = useState(false);

  const [notes,       setNotes]       = useState("");
  const [generating,  setGenerating]  = useState(false);
  const [generateErr, setGenerateErr] = useState<string | null>(null);
  const [generatedInv, setGeneratedInv] = useState<InvoiceDetail | null>(null);
  const [previewTrips,   setPreviewTrips]   = useState<InvoiceTripItem[]>([]);
  const [previewTotal,   setPreviewTotal]   = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr,     setPreviewErr]     = useState<string | null>(null);

  const [viewInv,     setViewInv]     = useState<InvoiceDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError,   setViewError]   = useState<string | null>(null);
  const [marking,     setMarking]     = useState(false);
  const [voiding,     setVoiding]     = useState(false);
  const [hovRow,      setHovRow]      = useState<number|null>(null);
  const [exportMenu,    setExportMenu]    = useState<string|null>(null);
  const [statusMenu,    setStatusMenu]    = useState<string|null>(null);
  const [changingStatus, setChangingStatus] = useState<string|null>(null);
  const [previewInv,     setPreviewInv]     = useState<InvoiceDetail | null>(null);
  const [previewMode,    setPreviewMode]    = useState<"summary"|"detailed"|"auto">("auto");

  const step1Valid = !!selCompany && !!periodFrom && !!periodTo;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, coRes] = await Promise.all([
        invoicesApi.list({ page: 1, limit: 50 }),
        companiesApi.list(),
      ]);
      setInvoices(invRes.data.invoices);
      setSummary(invRes.data.summary);
      setCompanies(coRes.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [reload]);

  function openNew() {
    setSelCompany(""); setCompanyOpen(false);
    setPeriodFrom(todayStr); setPeriodTo(todayStr); setPickerOpen(false);
    setNotes("");
    setStep(1); setGenerateErr(null); setGeneratedInv(null);
    setPreviewTrips([]); setPreviewTotal(0); setPreviewErr(null);
    setDrawerMode("new");
  }
  function closeDrawer() {
    setDrawerMode(null);
    setCompanyOpen(false); setPickerOpen(false);
    setViewInv(null); setViewError(null); setGeneratedInv(null); setGenerateErr(null);
  }

  async function goToStep2() {
    if (!step1Valid) return;
    setPreviewLoading(true); setPreviewErr(null); setPreviewTrips([]); setPreviewTotal(0);
    setStep(2);
    try {
      const res = await invoicesApi.preview({ companyId: selCompany, periodFrom, periodTo });
      setPreviewTrips(res.data.trips);
      setPreviewTotal(res.data.total);
    } catch (err) {
      setPreviewErr(err instanceof Error ? err.message : "Failed to load trips");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmGenerate() {
    if (!step1Valid || generating) return;
    setGenerating(true); setGenerateErr(null);
    try {
      const res = await invoicesApi.create({
        companyId:  selCompany,
        periodFrom,
        periodTo,
        notes:      notes.trim() || undefined,
      });
      setGeneratedInv(res.data);
      void reload();
    } catch (err) {
      setGenerateErr(err instanceof Error ? err.message : "Failed to generate invoice");
    } finally {
      setGenerating(false);
    }
  }

  async function openView(id: string) {
    setDrawerMode("view"); setViewInv(null); setViewError(null);
    setViewLoading(true);
    try {
      const res = await invoicesApi.get(id);
      setViewInv(res.data);
    } catch (err) {
      setViewError(err instanceof Error ? err.message : "Failed to load invoice");
    } finally {
      setViewLoading(false);
    }
  }

  async function handleMarkPaid() {
    if (!viewInv || marking) return;
    setMarking(true);
    try {
      await invoicesApi.markPaid(viewInv.id);
      const refreshed = await invoicesApi.get(viewInv.id);
      setViewInv(refreshed.data);
      void reload();
    } catch (err) {
      setViewError(err instanceof Error ? err.message : "Failed to mark as paid");
    } finally {
      setMarking(false);
    }
  }

  async function handleVoid() {
    if (!viewInv || voiding) return;
    if (!window.confirm(`Void invoice ${viewInv.invoiceNumber}? Its trips will become available for re-invoicing.`)) return;
    setVoiding(true);
    try {
      await invoicesApi.void(viewInv.id);
      const refreshed = await invoicesApi.get(viewInv.id);
      setViewInv(refreshed.data);
      void reload();
    } catch (err) {
      setViewError(err instanceof Error ? err.message : "Failed to void invoice");
    } finally {
      setVoiding(false);
    }
  }

  async function quickChangeStatus(invId: string, action: "paid" | "void") {
    if (changingStatus) return;
    setChangingStatus(invId);
    setStatusMenu(null);
    try {
      if (action === "paid") await invoicesApi.markPaid(invId);
      else await invoicesApi.void(invId);
      void reload();
    } catch { /* best-effort */ } finally {
      setChangingStatus(null);
    }
  }

  async function viewInvoicePdf(id: string, mode: "summary"|"detailed") {
    try {
      const res = await invoicesApi.get(id);
      setPreviewMode(mode);
      setPreviewInv(res.data);
    } catch { /* best-effort */ }
  }

  function handleExportCsv() {
    const rows = invoices.map((inv) => ({
      "Invoice Number": formatInvoiceNumber(inv.invoiceNumber),
      "Company":        inv.companyName,
      "Period From":    inv.periodFrom,
      "Period To":      inv.periodTo,
      "Amount":         inv.amount,
      "Status":         effectiveStatus(inv),
      "Issued At":      fmtDate(inv.issuedAt),
      "Due Date":       fmtDate(inv.dueDate),
      "Trip Count":     inv.tripCount,
    }));
    exportToCsv("invoices", rows);
  }

  const selCompanyName = companies.find(c => c.id === selCompany)?.name ?? "";
  const periodLabel    = periodFrom === periodTo
    ? new Date(periodFrom + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : fmtPeriod(periodFrom, periodTo);

  /* ── RENDER ── */
  return (
    <div style={{ fontFamily:FONT, color:"#0F172A", display:"flex", flexDirection:"column", gap:20 }}
         onClick={() => { setExportMenu(null); setStatusMenu(null); }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <p style={{ fontSize:20, fontWeight:800 }}>Invoicing</p>
          <p style={{ fontSize:12.5, color:"#94A3B8", marginTop:2 }}>Generate and manage company invoices</p>
        </div>
        <button onClick={openNew}
          style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 18px", border:"none", borderRadius:10, background:A, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:FONT }}>
          <Plus className="h-4 w-4"/> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {[
          { label:"Total Billed", value:fmt(summary.totalBilled),  sub:`${summary.totalCount} invoice${summary.totalCount===1?"":"s"}`, Icon:IndianRupee },
          { label:"Collected",    value:fmt(summary.collected),    sub:`${summary.paidCount} paid`,    Icon:CheckCircle2 },
          { label:"Outstanding",  value:fmt(summary.outstanding),  sub:`${summary.unpaidCount} unpaid`, Icon:Clock },
        ].map(({ label, value, sub, Icon }) => (
          <div key={label} style={{ ...CARD, padding:20, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:11, color:"#64748B", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</p>
              {loading ? (
                <>
                  <Skeleton className="h-7 w-24 mt-2" />
                  <Skeleton className="h-3 w-16 mt-2" />
                </>
              ) : (
                <>
                  <p style={{ fontSize:28, fontWeight:800, color:"#0F172A", lineHeight:1.1, marginTop:4 }}>{value}</p>
                  <p style={{ fontSize:12, color:"#94A3B8", marginTop:4 }}>{sub}</p>
                </>
              )}
            </div>
            <div style={{ background:"#F1F5F9", borderRadius:11, width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Icon style={{ color:"#94A3B8" }} className="h-5 w-5"/>
            </div>
          </div>
        ))}
      </div>

      {/* Invoice table */}
      <div style={CARD}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
          <p style={{ fontSize:15, fontWeight:800 }}>All Invoices</p>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {loading
              ? <Skeleton className="h-3 w-20" />
              : <span style={{ fontSize:12, color:"#94A3B8" }}>{invoices.length} invoice{invoices.length===1?"":"s"}</span>}
            <ColumnsPopover tableKey="invoices" visible={visibleCols} totalCount={totalCount} onToggle={toggle} onReset={reset} />
            {!loading && invoices.length > 0 && (
              <ExportButton onClick={handleExportCsv} />
            )}
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <div className="w-fit min-w-full" style={{ minWidth: minTableWidth }}>
            <div style={{ display:"grid", gridTemplateColumns: gridTemplate, gap:12,
              padding:"10px 20px", borderBottom:"1px solid #F1F5F9", background:"#FAFBFC" }}>
              {prefsLoading
                ? Array.from({ length: visibleCols.length + 1 }).map((_, i) => (
                    <Skeleton key={i} className="h-3 w-16" />
                  ))
                : [...visibleCols.map(k => {
                    const col = spec.columns.find(c => c.key === k);
                    return col?.label.toUpperCase() ?? k.toUpperCase();
                  }), "DOWNLOAD"].map(h => (
                    <div key={h} style={{ fontSize:10.5, fontWeight:700, color:"#CBD5E1", textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</div>
                  ))}
            </div>
            {loading ? (
              <div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns: gridTemplate, gap:12,
                    padding:"13px 20px", borderBottom: i < 4 ? "1px solid #F1F5F9" : "none", alignItems:"center" }}>
                    {visibleCols.map(k => (
                      <Skeleton key={k} className="h-3.5 w-20" />
                    ))}
                    <Skeleton className="h-7 w-14 rounded-md" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div style={{ padding:"40px 24px", textAlign:"center" }}>
                <div style={{ fontSize:13, color:"#B91C1C", marginBottom:12 }}>{error}</div>
                <button onClick={reload}
                  style={{ padding:"7px 16px", border:"1.5px solid #E2E8F0", borderRadius:9, background:"#fff", color:"#475569", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:FONT }}>
                  Retry
                </button>
              </div>
            ) : invoices.length === 0 ? (
              <div style={{ padding:"48px 0", textAlign:"center", color:"#94A3B8", fontSize:13 }}>
                No invoices yet. Click <strong style={{ color:"#475569" }}>New Invoice</strong> to generate one.
              </div>
            ) : invoices.map((inv, i) => {
              const status = effectiveStatus(inv);
              const cellFor = (k: string): React.ReactNode => {
                switch (k) {
                  case "invoiceNo":  return <span style={{ fontWeight:800, fontSize:13, color:"#1E293B", fontFamily:"monospace" }}>{formatInvoiceNumber(inv.invoiceNumber)}</span>;
                  case "company":    return (
                    <div>
                      <p style={{ fontSize:13, fontWeight:600, color:"#0F172A" }}>{inv.companyName}</p>
                      <p style={{ fontSize:11.5, color:"#94A3B8", marginTop:1 }}>Issued {fmtDate(inv.issuedAt)} · {inv.tripCount} trip{inv.tripCount===1?"":"s"}</p>
                    </div>
                  );
                  case "period":     return <span style={{ fontSize:13, color:"#475569" }}>{fmtPeriod(inv.periodFrom, inv.periodTo)}</span>;
                  case "amount":     return <span style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>{fmt(inv.amount)}</span>;
                  case "issuedAt":   return <span style={{ fontSize:13, color:"#475569" }}>{fmtDate(inv.issuedAt)}</span>;
                  case "dueDate":    return <span style={{ fontSize:13, color:"#475569" }}>{fmtDate(inv.dueDate)}</span>;
                  case "paidAt":     return inv.paidAt ? <span style={{ fontSize:13, color:"#475569" }}>{fmtDate(inv.paidAt)}</span> : <span style={{ fontSize:13, color:"#CBD5E1" }}>—</span>;
                  case "paymentRef": return <span style={{ fontSize:13, color:"#475569" }}>—</span>;
                  case "notes":      return <span style={{ fontSize:13, color:"#475569" }}>—</span>;
                  case "createdAt":  return <span style={{ fontSize:13, color:"#475569" }}>{fmtDate(inv.issuedAt)}</span>;
                  case "status":     return null; // rendered separately below
                  default:           return null;
                }
              };
              return (
                <div key={inv.id}
                  onClick={() => openView(inv.id)}
                  onMouseEnter={() => setHovRow(i)} onMouseLeave={() => setHovRow(null)}
                  style={{ display:"grid", gridTemplateColumns: gridTemplate, gap:12,
                    padding:"13px 20px", borderBottom:"1px solid #F1F5F9",
                    background:hovRow===i?"#F8FAFC":"#fff", cursor:"pointer",
                    transition:"background 0.12s", alignItems:"center" }}>
                  {visibleCols.map(k => {
                    if (k === "status") return (
                      <div key={k} style={{ position:"relative" }} onClick={e => e.stopPropagation()}>
                        {changingStatus === inv.id ? (
                          <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"#94A3B8" }}>
                            <Loader2 className="h-3 w-3 animate-spin"/> Saving…
                          </span>
                        ) : (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (status === "Paid" || status === "Voided") return;
                              setStatusMenu(statusMenu === inv.id ? null : inv.id);
                              setExportMenu(null);
                            }}
                            title={status === "Paid" || status === "Voided" ? undefined : "Click to change status"}
                            style={{ background:"none", border:"none", padding:0, cursor: status==="Paid"||status==="Voided" ? "default" : "pointer",
                              display:"inline-flex", alignItems:"center", gap:3 }}>
                            <StatusBadge status={status}/>
                            {status !== "Paid" && status !== "Voided" && (
                              <ChevronDown style={{ width:10, height:10, color:"#94A3B8", flexShrink:0 }}/>
                            )}
                          </button>
                        )}
                        {statusMenu === inv.id && (
                          <>
                            <div style={{ position:"fixed", inset:0, zIndex:98 }} onClick={() => setStatusMenu(null)}/>
                            <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, zIndex:99,
                              background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:10,
                              boxShadow:"0 8px 24px rgba(0,0,0,0.12)", overflow:"hidden", minWidth:155 }}>
                              <button
                                onClick={() => quickChangeStatus(inv.id, "paid")}
                                style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"10px 14px",
                                  textAlign:"left", border:"none", borderBottom:"1px solid #F1F5F9",
                                  cursor:"pointer", fontFamily:FONT, fontSize:13, background:"#fff", color:"#15803D", fontWeight:600 }}
                                onMouseEnter={e=>(e.currentTarget.style.background="#F0FDF4")}
                                onMouseLeave={e=>(e.currentTarget.style.background="#fff")}>
                                <CheckCircle2 className="h-3.5 w-3.5"/> Mark as Paid
                              </button>
                              <button
                                onClick={() => quickChangeStatus(inv.id, "void")}
                                style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"10px 14px",
                                  textAlign:"left", border:"none", cursor:"pointer", fontFamily:FONT, fontSize:13,
                                  background:"#fff", color:"#B91C1C", fontWeight:600 }}
                                onMouseEnter={e=>(e.currentTarget.style.background="#FEF2F2")}
                                onMouseLeave={e=>(e.currentTarget.style.background="#fff")}>
                                <Ban className="h-3.5 w-3.5"/> Void Invoice
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                    return <div key={k}>{cellFor(k)}</div>;
                  })}

                  {/* Download dropdown — always last, fixed 110px */}
                  <div style={{ position:"relative" }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={e => { e.stopPropagation(); setExportMenu(exportMenu === inv.id ? null : inv.id); }}
                      style={{ display:"flex", alignItems:"center", gap:4, fontSize:12, fontWeight:600, color:"#64748B",
                        background:"none", border:"1px solid #E8EEF4", borderRadius:7, padding:"5px 10px",
                        cursor:"pointer", fontFamily:FONT }}>
                      <Download className="h-3 w-3"/> Export <ChevronDown className="h-3 w-3"/>
                    </button>
                    {exportMenu === inv.id && (
                      <>
                        <div style={{ position:"fixed", inset:0, zIndex:98 }} onClick={() => setExportMenu(null)}/>
                        <div style={{ position:"absolute", top:"calc(100% + 4px)", right:0, zIndex:99,
                          background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:10,
                          boxShadow:"0 8px 24px rgba(0,0,0,0.12)", overflow:"hidden", minWidth:140 }}>
                          {(["summary","detailed"] as const).map((mode, i) => (
                            <button key={mode}
                              onClick={() => { void viewInvoicePdf(inv.id, mode); setExportMenu(null); }}
                              style={{ display:"block", width:"100%", padding:"10px 14px", textAlign:"left",
                                border:"none", borderBottom: i === 0 ? "1px solid #F1F5F9" : "none",
                                cursor:"pointer", fontFamily:FONT, fontSize:13, background:"#fff", color:"#0F172A" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                              {mode === "summary" ? "Summary" : "Detailed"}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          DRAWER
      ══════════════════════════════════════ */}
      <DrawerPanel open={drawerMode !== null} onClose={closeDrawer}>

        {/* ── NEW INVOICE ── */}
        {drawerMode === "new" && (<>
          <div style={{ padding:"20px 24px 16px", borderBottom:"1.5px solid #F1F5F9", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:17, fontWeight:800, color:"#0F172A" }}>New Invoice</div>
                <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>
                  Step {step} of 2 — {step===1 ? "Select company & period" : "Review & confirm"}
                </div>
              </div>
              <button onClick={closeDrawer} style={{ width:32, height:32, borderRadius:8, border:"1.5px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <X className="h-4 w-4" style={{ color:"#64748B" }}/>
              </button>
            </div>
            <div style={{ display:"flex", gap:6, marginTop:14 }}>
              {[1,2].map(s => (
                <div key={s} style={{ height:3, flex:1, borderRadius:4, background:s<=step?A:"#E2E8F0", transition:"background .2s" }}/>
              ))}
            </div>
          </div>

          {/* Step 1 — Company & Period */}
          {step === 1 && (
            <div style={{ flex:1, overflowY:"auto", padding:"24px" }}>

              {/* ── Company custom dropdown ── */}
              <div style={{ marginBottom:22 }}>
                <label style={{ fontSize:11.5, fontWeight:700, color:"#64748B", display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Company</label>
                <div style={{ position:"relative" }}>
                  <button
                    onClick={() => { setCompanyOpen(o => !o); setPickerOpen(false); }}
                    style={{
                      width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
                      height:42, padding:"0 14px", border:"1.5px solid #E2E8F0", borderRadius:10,
                      background:"#fff", cursor:"pointer", fontFamily:FONT, fontSize:14,
                      color: selCompany ? "#0F172A" : "#94A3B8", textAlign:"left",
                    }}
                  >
                    <span>{selCompanyName || "Select company…"}</span>
                    <ChevronDown style={{ width:16, height:16, color:"#94A3B8", flexShrink:0, transform: companyOpen ? "rotate(180deg)" : "none", transition:"transform .15s" }}/>
                  </button>
                  {companyOpen && (
                    <>
                      <div style={{ position:"fixed", inset:0, zIndex:98 }} onClick={() => setCompanyOpen(false)}/>
                      <div style={{
                        position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:99,
                        background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:10,
                        boxShadow:"0 8px 24px rgba(0,0,0,0.12)", overflow:"hidden",
                        maxHeight:220, overflowY:"auto",
                      }}>
                        {companies.length === 0 ? (
                          <div style={{ padding:"12px 14px", fontSize:13, color:"#94A3B8" }}>No companies found</div>
                        ) : companies.map((c) => (
                          <button key={c.id}
                            onClick={() => { setSelCompany(c.id); setCompanyOpen(false); }}
                            style={{
                              display:"block", width:"100%", padding:"10px 14px", textAlign:"left",
                              border:"none", cursor:"pointer", fontFamily:FONT, fontSize:14,
                              background: selCompany === c.id ? "#EFF6FF" : "#fff",
                              color: selCompany === c.id ? A : "#0F172A",
                              fontWeight: selCompany === c.id ? 700 : 400,
                            }}
                            onMouseEnter={e => { if (selCompany !== c.id) (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = selCompany === c.id ? "#EFF6FF" : "#fff"; }}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ── Billing Period — DateRangePicker ── */}
              <div style={{ marginBottom:22 }}>
                <label style={{ fontSize:11.5, fontWeight:700, color:"#64748B", display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Billing Period</label>
                <div style={{ position:"relative" }}>
                  <button
                    onClick={() => { setPickerOpen(o => !o); setCompanyOpen(false); }}
                    style={{
                      width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between",
                      height:42, padding:"0 14px", border:"1.5px solid #E2E8F0", borderRadius:10,
                      background:"#fff", cursor:"pointer", fontFamily:FONT, fontSize:14,
                      color: "#0F172A", textAlign:"left",
                    }}
                  >
                    <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <CalendarDays style={{ width:15, height:15, color:"#94A3B8", flexShrink:0 }}/>
                      {periodLabel}
                    </span>
                    <ChevronDown style={{ width:16, height:16, color:"#94A3B8", flexShrink:0, transform: pickerOpen ? "rotate(180deg)" : "none", transition:"transform .15s" }}/>
                  </button>
                  {pickerOpen && (
                    <DateRangePicker
                      from={periodFrom}
                      to={periodTo}
                      onApply={(f, t) => { setPeriodFrom(f); setPeriodTo(t); }}
                      onClose={() => setPickerOpen(false)}
                      direction="past"
                    />
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize:11.5, fontWeight:700, color:"#64748B", display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal note shown only on the PDF…"
                  style={{ width:"100%", minHeight:72, padding:"10px 12px", border:"1.5px solid #E2E8F0", borderRadius:9, fontSize:13, fontFamily:FONT, color:"#374151", outline:"none", resize:"vertical", boxSizing:"border-box" }}
                />
              </div>
            </div>
          )}

          {/* Step 2 — Confirm + result */}
          {step === 2 && (
            <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
              {generatedInv ? (
                <>
                  <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:"#DCFCE7", border:"1px solid #BBF7D0", borderRadius:10, marginBottom:16 }}>
                    <CheckCircle2 className="h-5 w-5" style={{ color:"#15803D", flexShrink:0 }}/>
                    <div style={{ fontSize:13, fontWeight:700, color:"#15803D" }}>
                      Invoice {formatInvoiceNumber(generatedInv.invoiceNumber)} created · {generatedInv.tripCount} trip{generatedInv.tripCount===1?"":"s"} · {fmt(generatedInv.amount)}
                    </div>
                  </div>
                  <TripsMiniTable rows={generatedInv.trips} total={generatedInv.amount}/>
                </>
              ) : (
                <>
                  <div style={{ background:"#F8FAFC", borderRadius:12, padding:"14px 18px", marginBottom:16, border:"1px solid #E8EEF4" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                      {[
                        { lbl:"Company", val:selCompanyName || "—" },
                        { lbl:"Period",  val:periodLabel },
                      ].map(({ lbl, val }) => (
                        <div key={lbl}>
                          <div style={{ fontSize:10.5, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.06em" }}>{lbl}</div>
                          <div style={{ fontSize:14, fontWeight:700, color:"#0F172A", marginTop:3 }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {previewLoading ? (
                    <TripsMiniTableSkeleton />
                  ) : previewErr ? (
                    <div style={{ padding:"10px 14px", background:"#FEE2E2", border:"1px solid #FECACA", borderRadius:9, color:"#B91C1C", fontSize:12.5 }}>
                      {previewErr}
                    </div>
                  ) : previewTrips.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"30px 0" }}>
                      <div style={{ width:48, height:48, borderRadius:14, background:"#F1F5F9", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
                        <FileText style={{ color:"#94A3B8" }} className="h-5 w-5"/>
                      </div>
                      <div style={{ fontSize:13, fontWeight:700, color:"#0F172A", marginBottom:6 }}>No eligible trips</div>
                      <div style={{ fontSize:12.5, color:"#94A3B8", lineHeight:1.6, maxWidth:300, margin:"0 auto" }}>
                        No completed, uninvoiced trips found for this company in the selected period.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize:12, fontWeight:700, color:"#64748B", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.05em" }}>
                        {previewTrips.length} trip{previewTrips.length !== 1 ? "s" : ""} to invoice
                      </div>
                      <TripsMiniTable rows={previewTrips} total={previewTotal}/>
                    </>
                  )}

                  {generateErr && (
                    <div style={{ marginTop:16, padding:"10px 14px", background:"#FEE2E2", border:"1px solid #FECACA", borderRadius:9, color:"#B91C1C", fontSize:12.5 }}>
                      {generateErr}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div style={{ padding:"16px 24px", borderTop:"1.5px solid #F1F5F9", display:"flex", gap:10, flexShrink:0 }}>
            {step === 2 && !generatedInv && (
              <button onClick={() => { setStep(1); setGenerateErr(null); setPreviewTrips([]); setPreviewTotal(0); setPreviewErr(null); }} disabled={generating}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 18px", border:"1.5px solid #E2E8F0", borderRadius:10, background:"#fff", color:"#475569", fontSize:14, fontWeight:600, cursor: generating ? "default" : "pointer", fontFamily:FONT, opacity: generating ? 0.6 : 1 }}>
                <ChevronLeft className="h-4 w-4"/> Back
              </button>
            )}
            {step === 1 ? (
              <button disabled={!step1Valid} onClick={() => { void goToStep2(); }}
                style={{ flex:1, padding:"10px 18px", border:"none", borderRadius:10,
                  background:step1Valid?A:"#E2E8F0", color:step1Valid?"#fff":"#94A3B8",
                  fontSize:14, fontWeight:700, cursor:step1Valid?"pointer":"default", fontFamily:FONT }}>
                Next →
              </button>
            ) : generatedInv ? (
              <button onClick={closeDrawer}
                style={{ flex:1, padding:"10px 18px", border:"none", borderRadius:10, background:A, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:FONT }}>
                Done
              </button>
            ) : (
              <button disabled={generating || previewLoading || previewTrips.length === 0} onClick={confirmGenerate}
                style={{ flex:1, padding:"10px 18px", border:"none", borderRadius:10,
                  background: (generating || previewLoading || previewTrips.length === 0) ? "#93C5FD" : A,
                  color:"#fff", fontSize:14, fontWeight:700,
                  cursor: (generating || previewLoading || previewTrips.length === 0) ? "default" : "pointer", fontFamily:FONT,
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {generating && <Loader2 className="h-4 w-4 animate-spin"/>}
                {generating ? "Generating…" : "Generate Invoice"}
              </button>
            )}
          </div>
        </>)}

        {/* ── VIEW INVOICE ── */}
        {drawerMode === "view" && (
          <>
            <div style={{ padding:"20px 24px 16px", borderBottom:"1.5px solid #F1F5F9", flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:17, fontWeight:800, color:"#0F172A", fontFamily:"monospace" }}>
                    {viewInv ? formatInvoiceNumber(viewInv.invoiceNumber) : "Loading…"}
                  </div>
                  <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>
                    {viewInv ? `Issued ${fmtDate(viewInv.issuedAt)}` : ""}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  {viewInv && (<>
                    <button onClick={() => { setPreviewMode("summary"); setPreviewInv(viewInv); }}
                      style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 12px", border:"1.5px solid #C5CBF0", borderRadius:9, background:"#EEF0FB", color:"#1B2B7E", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:FONT, whiteSpace:"nowrap" }}>
                      <FileText className="h-3 w-3"/> Summary
                    </button>
                    <button onClick={() => { setPreviewMode("detailed"); setPreviewInv(viewInv); }}
                      style={{ display:"flex", alignItems:"center", gap:5, padding:"7px 12px", border:"1.5px solid #E2E8F0", borderRadius:9, background:"#fff", color:"#475569", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:FONT, whiteSpace:"nowrap" }}>
                      <FileText className="h-3 w-3"/> Detailed
                    </button>
                  </>)}
                  <button onClick={closeDrawer} style={{ width:32, height:32, borderRadius:8, border:"1.5px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <X className="h-4 w-4" style={{ color:"#64748B" }}/>
                  </button>
                </div>
              </div>
            </div>

            <div style={{ flex:1, overflowY:"auto", padding:"20px 24px" }}>
              {viewLoading ? (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"60px 0", color:"#94A3B8" }}>
                  <Loader2 className="h-4 w-4 animate-spin"/>
                  <span style={{ fontSize:13 }}>Loading invoice…</span>
                </div>
              ) : viewError ? (
                <div style={{ padding:"40px 0", textAlign:"center" }}>
                  <div style={{ fontSize:13, color:"#B91C1C", marginBottom:12 }}>{viewError}</div>
                  <button onClick={() => viewInv && openView(viewInv.id)}
                    style={{ padding:"7px 16px", border:"1.5px solid #E2E8F0", borderRadius:9, background:"#fff", color:"#475569", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:FONT }}>
                    Retry
                  </button>
                </div>
              ) : viewInv ? (
                <div style={{ background:"#F8FAFC", borderRadius:12, padding:"16px 18px", border:"1px solid #E8EEF4" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                    {[
                      { lbl:"Company", val:viewInv.companyName },
                      { lbl:"Period",  val:fmtPeriod(viewInv.periodFrom, viewInv.periodTo) },
                      { lbl:"Amount",  val:fmt(viewInv.amount) },
                      { lbl:"Trips",   val:`${viewInv.trips.length} trip${viewInv.trips.length===1?"":"s"}` },
                      { lbl:"Due",     val:fmtDate(viewInv.dueDate) },
                      { lbl:"Issued",  val:fmtDate(viewInv.issuedAt) },
                    ].map(({ lbl, val }) => (
                      <div key={lbl}>
                        <div style={{ fontSize:10.5, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.06em" }}>{lbl}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:"#0F172A", marginTop:4 }}>{val}</div>
                      </div>
                    ))}
                    <div>
                      <div style={{ fontSize:10.5, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Status</div>
                      <StatusBadge status={viewInv.status}/>
                    </div>
                    {viewInv.paidAt && (
                      <div>
                        <div style={{ fontSize:10.5, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.06em" }}>Paid</div>
                        <div style={{ fontSize:14, fontWeight:700, color:"#0F172A", marginTop:4 }}>{fmtDate(viewInv.paidAt)}</div>
                      </div>
                    )}
                  </div>
                  {viewInv.notes && (
                    <div style={{ marginTop:14, paddingTop:12, borderTop:"1px dashed #E2E8F0" }}>
                      <div style={{ fontSize:10.5, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>Notes</div>
                      <div style={{ fontSize:12.5, color:"#475569", lineHeight:1.5 }}>{viewInv.notes}</div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {viewInv && (viewInv.status === "Pending" || viewInv.status === "Overdue") && (
              <div style={{ padding:"16px 24px", borderTop:"1.5px solid #F1F5F9", display:"flex", gap:10, flexShrink:0 }}>
                <button onClick={handleVoid} disabled={voiding || marking}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 14px", border:"1.5px solid #FECACA", borderRadius:10, background:"#fff", color:"#B91C1C", fontSize:13, fontWeight:600, cursor:(voiding||marking)?"default":"pointer", fontFamily:FONT, opacity:(voiding||marking)?0.6:1 }}>
                  {voiding ? <Loader2 className="h-4 w-4 animate-spin"/> : <Ban className="h-4 w-4"/>}
                  Void
                </button>
                <button onClick={handleMarkPaid} disabled={marking || voiding}
                  style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"10px 18px", border:"none", borderRadius:10,
                    background:(marking||voiding)?"#93C5FD":A, color:"#fff", fontSize:14, fontWeight:700,
                    cursor:(marking||voiding)?"default":"pointer", fontFamily:FONT }}>
                  {marking ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>}
                  {marking ? "Marking…" : "Mark as Paid"}
                </button>
              </div>
            )}
          </>
        )}
      </DrawerPanel>

      {/* ── Invoice preview overlay ── */}
      {previewInv && (
        <TripInvoiceView inv={previewInv} mode={previewMode} onClose={() => setPreviewInv(null)} />
      )}
    </div>
  );
}

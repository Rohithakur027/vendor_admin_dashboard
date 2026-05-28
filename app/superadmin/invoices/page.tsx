"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Download, IndianRupee, CheckCircle2, Clock, X, ChevronLeft, FileText,
  Loader2, Ban, ChevronDown, CalendarDays,
} from "lucide-react";
import TripInvoiceView from "../../dashboard/accounts/invoicing/TripInvoiceView";
import { formatInvoiceNumber } from "@/lib/invoice-format";
import {
  superadminInvoicesApi,
  vendorsApi,
  type SuperadminInvoiceListItem,
  type SuperadminInvoiceDetail,
  type InvoiceDetail,
  type InvoiceSummary,
  type InvoiceTripItem,
  type InvoiceStatus,
} from "@/lib/api";
import type { Vendor } from "@/lib/mock-data";
import { DateRangePicker } from "@/modules/reports/DateRangePicker";
import { toIsoDate } from "@/modules/reports/primitives";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";

const A    = "#2563EB";
const FONT = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

const SC: Record<InvoiceStatus, { bg:string; text:string; border:string; dot:string }> = {
  Paid:    { bg:"#DCFCE7", text:"#15803D", border:"#BBF7D0", dot:"#16A34A" },
  Pending: { bg:"#FEF3C7", text:"#B45309", border:"#FDE68A", dot:"#F59E0B" },
  Overdue: { bg:"#FEE2E2", text:"#B91C1C", border:"#FECACA", dot:"#DC2626" },
  Voided:  { bg:"#F1F5F9", text:"#64748B", border:"#E2E8F0", dot:"#94A3B8" },
};

function fmt(n: number) { return "₹" + n.toLocaleString("en-IN"); }
function ordinal(day: number) {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1: return `${day}st`;
    case 2: return `${day}nd`;
    case 3: return `${day}rd`;
    default: return `${day}th`;
  }
}
function fmtLongDate(d: string) {
  const dt = new Date(d + "T12:00:00");
  return `${ordinal(dt.getDate())} ${dt.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`;
}
function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtPeriod(from: string, to: string) {
  if (from === to) return fmtLongDate(from);
  return `${fmtLongDate(from)} to ${fmtLongDate(to)}`;
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const s = SC[status];
  return (
    <span style={{ background:s.bg, color:s.text, border:`1px solid ${s.border}` }}
      className="inline-flex items-center gap-[5px] rounded-[20px] text-[11px] font-bold py-[3px] pr-2 pl-[7px] whitespace-nowrap">
      <span style={{ background:s.dot }} className="w-[5px] h-[5px] rounded-full shrink-0"/>
      {status}
    </span>
  );
}

function DrawerPanel({ open, onClose, children }: { open:boolean; onClose:()=>void; children:React.ReactNode }) {
  return (
    <>
      {open && <div onClick={onClose} className="fixed inset-0 bg-slate-900/35 z-40"/>}
      <div
        className="fixed top-0 right-0 bottom-0 w-[520px] max-w-full bg-white z-50 flex flex-col"
        style={{
          boxShadow:"-8px 0 32px rgba(0,0,0,0.12)",
          fontFamily:FONT,
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition:"transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        }}>
        {children}
      </div>
    </>
  );
}

function TripsMiniTable({ rows, total }: { rows: InvoiceTripItem[]; total: number }) {
  return (
    <div className="border-[1.5px] border-[#E8EEF4] rounded-xl overflow-hidden">
      <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px" }}
        className="gap-2 px-[14px] py-[9px] bg-slate-50 border-b border-[#E8EEF4]">
        {["Trip / Route","Date","Fare"].map(h => (
          <div key={h} className="text-[10.5px] font-bold text-[#CBD5E1] uppercase tracking-[0.05em]">{h}</div>
        ))}
      </div>
      {rows.map((t, i) => (
        <div key={t.tripId} style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px" }}
          className={`gap-2 px-[14px] py-[11px] items-center${i < rows.length - 1 ? " border-b border-slate-100" : ""}`}>
          <div>
            <div className="text-[12.5px] font-semibold text-slate-900 font-mono">{t.tripRef || "—"}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{(t.pickupAddress || "").split(",")[0]} → {(t.dropAddress || "").split(",")[0]}</div>
          </div>
          <div className="text-xs text-slate-600">
            {t.pickupTime ? new Date(t.pickupTime).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
          </div>
          <div className="text-[13px] font-bold text-slate-900">{fmt(t.fare)}</div>
        </div>
      ))}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px" }}
        className="gap-2 px-[14px] py-[11px] bg-slate-50 border-t-2 border-[#E8EEF4] items-center">
        <div className="text-[13px] font-bold text-slate-900 col-span-2">Subtotal</div>
        <div className="text-[15px] font-extrabold text-blue-600">{fmt(total)}</div>
      </div>
    </div>
  );
}

function TripsMiniTableSkeleton() {
  const bar = (w: string, h = 10) => (
    <div className="animate-pulse" style={{ height:h, borderRadius:5, background:"#E2E8F0", width:w }}/>
  );
  return (
    <div className="border-[1.5px] border-[#E8EEF4] rounded-xl overflow-hidden">
      <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px" }}
        className="gap-2 px-[14px] py-[9px] bg-slate-50 border-b border-[#E8EEF4]">
        {bar("55%")} {bar("60%")} {bar("50%")}
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px" }}
          className="gap-2 px-[14px] py-[13px] border-b border-slate-100 items-center">
          <div className="flex flex-col gap-[5px]">
            {bar("40%", 9)} {bar("70%", 8)}
          </div>
          {bar("65%", 9)} {bar("55%", 11)}
        </div>
      ))}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px" }}
        className="gap-2 px-[14px] py-[11px] bg-slate-50 border-t-2 border-[#E8EEF4] items-center">
        <div className="col-span-2">{bar("30%", 10)}</div>
        {bar("60%", 12)}
      </div>
    </div>
  );
}

export default function SuperadminInvoicingPage() {
  const todayStr = toIsoDate(new Date());

  const { columns: visibleCols, toggle, reset, totalCount, loading: prefsLoading } = useColumnPreferences("superadminInvoices");
  const spec = getTableSpec("superadminInvoices");

  const gridTemplate = useMemo(() => {
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

  const [invoices,    setInvoices]    = useState<SuperadminInvoiceListItem[]>([]);
  const [summary,     setSummary]     = useState<InvoiceSummary>({ totalBilled: 0, collected: 0, outstanding: 0, totalCount: 0, paidCount: 0, unpaidCount: 0 });
  const [vendors,     setVendors]     = useState<Vendor[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const [drawerMode,  setDrawerMode]  = useState<"new"|"view"|null>(null);
  const [step,        setStep]        = useState<1|2>(1);

  const [selVendor,   setSelVendor]   = useState("");
  const [vendorOpen,  setVendorOpen]  = useState(false);
  const [vendorQuery, setVendorQuery] = useState("");

  const [periodFrom,  setPeriodFrom]  = useState("");
  const [periodTo,    setPeriodTo]    = useState("");
  const [pickerOpen,  setPickerOpen]  = useState(false);

  const [notes,         setNotes]         = useState("");
  const [generating,    setGenerating]    = useState(false);
  const [generateErr,   setGenerateErr]   = useState<string | null>(null);
  const [generatedInv,  setGeneratedInv]  = useState<SuperadminInvoiceDetail | null>(null);
  const [previewTrips,   setPreviewTrips]   = useState<InvoiceTripItem[]>([]);
  const [previewTotal,   setPreviewTotal]   = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErr,     setPreviewErr]     = useState<string | null>(null);

  const [viewInv,     setViewInv]     = useState<SuperadminInvoiceDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError,   setViewError]   = useState<string | null>(null);
  const [marking,     setMarking]     = useState(false);
  const [voiding,     setVoiding]     = useState(false);
  const [hovRow,      setHovRow]      = useState<number|null>(null);
  const [statusMenu,    setStatusMenu]    = useState<string|null>(null);
  const [exportMenu,    setExportMenu]    = useState<string|null>(null);
  const [changingStatus, setChangingStatus] = useState<string|null>(null);
  const [previewInv,    setPreviewInv]    = useState<InvoiceDetail | null>(null);
  const [previewMode,   setPreviewMode]   = useState<"summary" | "detailed" | "auto">("auto");

  const step1Valid = !!selVendor && !!periodFrom && !!periodTo;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [invRes, vRes] = await Promise.all([
        superadminInvoicesApi.list({ page: 1, limit: 50 }),
        vendorsApi.list(),
      ]);
      setInvoices(invRes.data.invoices);
      setSummary(invRes.data.summary);
      setVendors(vRes.data);
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
    setSelVendor(""); setVendorOpen(false); setVendorQuery("");
    setPeriodFrom(""); setPeriodTo(""); setPickerOpen(false);
    setNotes("");
    setStep(1); setGenerateErr(null); setGeneratedInv(null);
    setPreviewTrips([]); setPreviewTotal(0); setPreviewErr(null);
    setDrawerMode("new");
  }
  function closeDrawer() {
    setDrawerMode(null);
    setVendorOpen(false); setVendorQuery(""); setPickerOpen(false);
    setViewInv(null); setViewError(null); setGeneratedInv(null); setGenerateErr(null);
    setPreviewInv(null);
    setPreviewMode("auto");
  }

  async function goToStep2() {
    if (!step1Valid) return;
    setPreviewLoading(true); setPreviewErr(null); setPreviewTrips([]); setPreviewTotal(0);
    setStep(2);
    try {
      const res = await superadminInvoicesApi.preview({ vendorId: selVendor, periodFrom, periodTo });
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
      const res = await superadminInvoicesApi.create({
        vendorId:  selVendor,
        periodFrom,
        periodTo,
        notes: notes.trim() || undefined,
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
      const res = await superadminInvoicesApi.get(id);
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
      await superadminInvoicesApi.markPaid(viewInv.id);
      const refreshed = await superadminInvoicesApi.get(viewInv.id);
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
    if (!window.confirm(`Void invoice ${formatInvoiceNumber(viewInv.invoiceNumber)}? Its trips will become available for re-invoicing.`)) return;
    setVoiding(true);
    try {
      await superadminInvoicesApi.void(viewInv.id);
      const refreshed = await superadminInvoicesApi.get(viewInv.id);
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
      if (action === "paid") await superadminInvoicesApi.markPaid(invId);
      else await superadminInvoicesApi.void(invId);
      void reload();
    } catch { /* best-effort */ } finally {
      setChangingStatus(null);
    }
  }

  async function viewInvoicePdf(id: string, mode: "summary" | "detailed") {
    try {
      const res = await superadminInvoicesApi.get(id);
      setPreviewMode(mode);
      setPreviewInv({
        ...res.data,
        companyName: res.data.vendorName,
        companyAddress: res.data.vendorAddress,
      });
    } catch {
      /* best-effort */
    }
  }

  const selVendorName = vendors.find(v => v.id === selVendor)?.name ?? "";
  const filteredVendors = useMemo(() => {
    const q = vendorQuery.toLowerCase().trim();
    return !q ? vendors : vendors.filter(v => v.name.toLowerCase().includes(q));
  }, [vendors, vendorQuery]);
  const viewInvoicePreview = useMemo<InvoiceDetail | null>(() => {
    if (!viewInv) return null;
    return {
      ...viewInv,
      companyName: viewInv.vendorName,
      companyAddress: viewInv.vendorAddress,
    };
  }, [viewInv]);
  const periodLabel = periodFrom && periodTo
    ? periodFrom === periodTo
      ? fmtLongDate(periodFrom)
      : fmtPeriod(periodFrom, periodTo)
    : "Select billing period";

  return (
    <div className="flex flex-col gap-5 text-slate-900" style={{ fontFamily:FONT }}
         onClick={() => { setStatusMenu(null); }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xl font-extrabold">Vendor Invoicing</p>
          <p className="text-[12.5px] text-slate-400 mt-0.5">Generate and manage invoices for vendors</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-[7px] px-[18px] py-2 border-none rounded-[10px] bg-blue-600 text-white font-bold text-[13px] cursor-pointer"
          style={{ fontFamily:FONT }}>
          <Plus className="h-4 w-4"/> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"Total Billed", value:fmt(summary.totalBilled),  sub:`${summary.totalCount} invoice${summary.totalCount===1?"":"s"}`, Icon:IndianRupee },
          { label:"Collected",    value:fmt(summary.collected),    sub:`${summary.paidCount} paid`,    Icon:CheckCircle2 },
          { label:"Outstanding",  value:fmt(summary.outstanding),  sub:`${summary.unpaidCount} unpaid`, Icon:Clock },
        ].map(({ label, value, sub, Icon }) => (
          <div key={label} className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-[0.06em]">{label}</p>
              {loading ? (
                <>
                  <Skeleton className="h-7 w-24 mt-2" />
                  <Skeleton className="h-3 w-16 mt-2" />
                </>
              ) : (
                <>
                  <p className="text-[28px] font-extrabold text-slate-900 leading-[1.1] mt-1">{value}</p>
                  <p className="text-xs text-slate-400 mt-1">{sub}</p>
                </>
              )}
            </div>
            <div className="bg-slate-100 rounded-[11px] w-10 h-10 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-slate-400"/>
            </div>
          </div>
        ))}
      </div>

      {/* Invoice table */}
      <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center flex-wrap gap-[10px]">
          <p className="text-[15px] font-extrabold">All Vendor Invoices</p>
          <div className="flex items-center gap-[10px]">
            {loading
              ? <Skeleton className="h-3 w-20" />
              : <span className="text-xs text-slate-400">{invoices.length} invoice{invoices.length===1?"":"s"}</span>}
            <ColumnsPopover tableKey="superadminInvoices" visible={visibleCols} totalCount={totalCount} onToggle={toggle} onReset={reset} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="w-fit min-w-full" style={{ minWidth: minTableWidth }}>
            <div style={{ display:"grid", gridTemplateColumns: gridTemplate }}
              className="gap-3 px-5 py-[10px] border-b border-slate-100 bg-[#FAFBFC]">
              {prefsLoading
                ? Array.from({ length: visibleCols.length + 1 }).map((_, i) => (
                    <Skeleton key={i} className="h-3 w-16" />
                  ))
                : [...visibleCols.map(k => {
                    const col = spec.columns.find(c => c.key === k);
                    return col?.label.toUpperCase() ?? k.toUpperCase();
                  }), ""].map((h, i) => (
                    <div key={i} className="text-[10.5px] font-bold text-[#CBD5E1] uppercase tracking-[0.06em]">{h}</div>
                  ))}
            </div>

            {loading ? (
              <div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns: gridTemplate }}
                    className={`gap-3 px-5 py-[13px] items-center${i < 4 ? " border-b border-slate-100" : ""}`}>
                    {visibleCols.map(k => <Skeleton key={k} className="h-3.5 w-20" />)}
                    <Skeleton className="h-6 w-10 rounded-md" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="px-6 py-10 text-center">
                <div className="text-[13px] text-red-700 mb-3">{error}</div>
                <button onClick={reload}
                  className="px-4 py-[7px] border-[1.5px] border-slate-200 rounded-[9px] bg-white text-slate-600 text-[12.5px] font-semibold cursor-pointer"
                  style={{ fontFamily:FONT }}>
                  Retry
                </button>
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-[13px]">
                No vendor invoices yet. Click <strong className="text-slate-600">New Invoice</strong> to generate one.
              </div>
            ) : invoices.map((inv, i) => {
              const cellFor = (k: string): React.ReactNode => {
                switch (k) {
                  case "invoiceNo":  return <span className="font-black text-[13px] text-[#1E293B] font-mono">{formatInvoiceNumber(inv.invoiceNumber)}</span>;
                  case "vendor":     return (
                    <div>
                      <p className="text-[13px] font-semibold text-slate-900">{inv.vendorName}</p>
                      <p className="text-[11.5px] text-slate-400 mt-px">Issued {fmtDate(inv.issuedAt)} · {inv.tripCount} trip{inv.tripCount===1?"":"s"}</p>
                    </div>
                  );
                  case "period":     return <span className="text-[13px] text-slate-600">{fmtPeriod(inv.periodFrom, inv.periodTo)}</span>;
                  case "amount":     return <span className="text-sm font-bold text-slate-900">{fmt(inv.amount)}</span>;
                  case "issuedAt":   return <span className="text-[13px] text-slate-600">{fmtDate(inv.issuedAt)}</span>;
                  case "dueDate":    return <span className="text-[13px] text-slate-600">{fmtDate(inv.dueDate)}</span>;
                  case "paidAt":     return inv.paidAt ? <span className="text-[13px] text-slate-600">{fmtDate(inv.paidAt)}</span> : <span className="text-[13px] text-[#CBD5E1]">—</span>;
                  case "paymentRef": return <span className="text-[13px] text-slate-400">—</span>;
                  case "notes":      return <span className="text-[13px] text-slate-400">—</span>;
                  case "status": return (
                    <div className="relative" onClick={e => e.stopPropagation()}>
                      {changingStatus === inv.id ? (
                        <span className="inline-flex items-center gap-[5px] text-[11px] text-slate-400">
                          <Loader2 className="h-3 w-3 animate-spin"/> Saving…
                        </span>
                      ) : (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (inv.status === "Paid" || inv.status === "Voided") return;
                            setStatusMenu(statusMenu === inv.id ? null : inv.id);
                          }}
                          title={inv.status === "Paid" || inv.status === "Voided" ? undefined : "Click to change status"}
                          className="bg-transparent border-none p-0 inline-flex items-center gap-[3px]"
                          style={{ cursor: inv.status==="Paid"||inv.status==="Voided" ? "default" : "pointer" }}>
                          <StatusBadge status={inv.status}/>
                          {inv.status !== "Paid" && inv.status !== "Voided" && (
                            <ChevronDown className="text-slate-400 shrink-0" style={{ width:10, height:10 }}/>
                          )}
                        </button>
                      )}
                      {statusMenu === inv.id && (
                        <>
                          <div className="fixed inset-0 z-[98]" onClick={() => setStatusMenu(null)}/>
                          <div className="absolute top-[calc(100%+4px)] left-0 z-[99] bg-white border-[1.5px] border-slate-200 rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden min-w-[155px]">
                            <button
                              onClick={() => quickChangeStatus(inv.id, "paid")}
                              className="flex items-center gap-2 w-full px-[14px] py-[10px] text-left border-none border-b border-slate-100 cursor-pointer text-[13px] bg-white text-green-700 font-semibold"
                              style={{ fontFamily:FONT }}
                              onMouseEnter={e=>(e.currentTarget.style.background="#F0FDF4")}
                              onMouseLeave={e=>(e.currentTarget.style.background="#fff")}>
                              <CheckCircle2 className="h-3.5 w-3.5"/> Mark as Paid
                            </button>
                            <button
                              onClick={() => quickChangeStatus(inv.id, "void")}
                              className="flex items-center gap-2 w-full px-[14px] py-[10px] text-left border-none cursor-pointer text-[13px] bg-white text-red-700 font-semibold"
                              style={{ fontFamily:FONT }}
                              onMouseEnter={e=>(e.currentTarget.style.background="#FEF2F2")}
                              onMouseLeave={e=>(e.currentTarget.style.background="#fff")}>
                              <Ban className="h-3.5 w-3.5"/> Void Invoice
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                  default: return null;
                }
              };
              return (
                <div key={inv.id}
                  onClick={() => openView(inv.id)}
                  onMouseEnter={() => setHovRow(i)} onMouseLeave={() => setHovRow(null)}
                  style={{ display:"grid", gridTemplateColumns: gridTemplate, background:hovRow===i?"#F8FAFC":"#fff", transition:"background 0.12s" }}
                  className="gap-3 px-5 py-[13px] border-b border-slate-100 cursor-pointer items-center">
                  {visibleCols.map(k => (
                    <div key={k}>{cellFor(k)}</div>
                  ))}
                  {/* Export dropdown — always last, fixed 110px */}
                  <div className="relative" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={e => { e.stopPropagation(); setExportMenu(exportMenu === inv.id ? null : inv.id); }}
                      className="flex items-center gap-1 text-xs font-semibold text-slate-500 bg-transparent border border-[#E8EEF4] rounded-[7px] px-[10px] py-[5px] cursor-pointer"
                      style={{ fontFamily:FONT }}>
                      <Download className="h-3 w-3"/> Export <ChevronDown className="h-3 w-3"/>
                    </button>
                    {exportMenu === inv.id && (
                      <>
                        <div className="fixed inset-0 z-[98]" onClick={() => setExportMenu(null)}/>
                        <div className="absolute top-[calc(100%+4px)] right-0 z-[99] bg-white border-[1.5px] border-slate-200 rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden min-w-[140px]">
                          {(["summary","detailed"] as const).map((mode, idx) => (
                            <button
                              key={mode}
                              onClick={() => { void viewInvoicePdf(inv.id, mode); setExportMenu(null); }}
                              className={`block w-full px-[14px] py-[10px] text-left border-none cursor-pointer text-[13px] bg-white text-slate-900${idx === 0 ? " border-b border-slate-100" : ""}`}
                              style={{ fontFamily:FONT }}
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

      {/* DRAWER */}
      <DrawerPanel open={drawerMode !== null} onClose={closeDrawer}>

        {/* NEW INVOICE */}
        {drawerMode === "new" && (<>
          <div className="px-6 pt-5 pb-4 border-b-[1.5px] border-slate-100 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[17px] font-extrabold text-slate-900">Vendor Invoice</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Step {step} of 2 — {step===1 ? "Select vendor & period" : "Review & confirm"}
                </div>
              </div>
              <button onClick={closeDrawer} className="w-8 h-8 rounded-lg border-[1.5px] border-slate-200 bg-slate-50 cursor-pointer flex items-center justify-center">
                <X className="h-4 w-4 text-slate-500"/>
              </button>
            </div>
            <div className="flex gap-[6px] mt-[14px]">
              {[1,2].map(s => (
                <div key={s} className="h-[3px] flex-1 rounded-[4px]" style={{ background:s<=step?A:"#E2E8F0", transition:"background .2s" }}/>
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="flex-1 overflow-y-auto p-6">

              {/* Vendor search */}
              <div className="mb-[22px]">
                <label className="text-[11.5px] font-bold text-slate-500 block mb-2 uppercase tracking-[0.06em]">Vendor</label>
                <div className="relative">
                  <input
                    type="text"
                    autoComplete="off"
                    value={vendorQuery}
                    placeholder="Search vendor…"
                    onFocus={() => { setVendorOpen(true); setPickerOpen(false); }}
                    onChange={(e) => {
                      setVendorQuery(e.target.value);
                      setSelVendor("");
                      setVendorOpen(true);
                    }}
                    className="w-full h-[42px] pr-9 pl-[14px] rounded-[10px] bg-white text-sm text-slate-900 outline-none box-border"
                    style={{
                      border:`1.5px solid ${vendorOpen ? A : "#E2E8F0"}`,
                      fontFamily:FONT,
                      transition:"border-color .15s",
                    }}
                  />
                  <ChevronDown className="absolute right-3 top-1/2 text-slate-400 pointer-events-none" style={{ width:16, height:16, transform:`translateY(-50%) ${vendorOpen?"rotate(180deg)":""}`, transition:"transform .15s" }}/>
                  {vendorOpen && (
                    <>
                      <div className="fixed inset-0 z-[98]" onClick={() => setVendorOpen(false)}/>
                      <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-[99] bg-white border-[1.5px] border-slate-200 rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.12)] overflow-hidden max-h-[220px] overflow-y-auto">
                        {filteredVendors.length === 0 ? (
                          <div className="px-[14px] py-3 text-[13px] text-slate-400">
                            {vendorQuery ? `No vendors matching "${vendorQuery}"` : "No vendors found"}
                          </div>
                        ) : filteredVendors.map((v) => (
                          <button key={v.id}
                            onClick={() => { setSelVendor(v.id); setVendorQuery(v.name); setVendorOpen(false); }}
                            className="block w-full px-[14px] py-[10px] text-left border-none cursor-pointer text-sm"
                            style={{
                              fontFamily:FONT,
                              background: selVendor === v.id ? "#EFF6FF" : "#fff",
                              color: selVendor === v.id ? A : "#0F172A",
                              fontWeight: selVendor === v.id ? 700 : 400,
                            }}
                            onMouseEnter={e => { if (selVendor !== v.id) (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = selVendor === v.id ? "#EFF6FF" : "#fff"; }}>
                            {v.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Billing Period */}
              <div className="mb-[22px]">
                <label className="text-[11.5px] font-bold text-slate-500 block mb-2 uppercase tracking-[0.06em]">Billing Period</label>
                <div className="relative">
                  <button
                    onClick={() => { setPickerOpen(o => !o); setVendorOpen(false); }}
                    className="w-full flex items-center justify-between h-[42px] px-[14px] border-[1.5px] border-slate-200 rounded-[10px] bg-white cursor-pointer text-sm text-slate-900 text-left"
                    style={{ fontFamily:FONT }}>
                    <span className="flex items-center gap-2">
                      <CalendarDays className="text-slate-400 shrink-0" style={{ width:15, height:15 }}/>
                      {periodLabel}
                    </span>
                    <ChevronDown className="text-slate-400 shrink-0" style={{ width:16, height:16, transform: pickerOpen ? "rotate(180deg)" : "none", transition:"transform .15s" }}/>
                  </button>
                  {pickerOpen && (
                    <DateRangePicker
                      from={periodFrom || todayStr}
                      to={periodTo || todayStr}
                      onApply={(f, t) => { setPeriodFrom(f); setPeriodTo(t); }}
                      onClose={() => setPickerOpen(false)}
                      direction="past"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-[11.5px] font-bold text-slate-500 block mb-2 uppercase tracking-[0.06em]">Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal note shown on the invoice…"
                  className="w-full min-h-[72px] px-3 py-[10px] border-[1.5px] border-slate-200 rounded-[9px] text-[13px] text-[#374151] outline-none resize-y box-border"
                  style={{ fontFamily:FONT }}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {generatedInv ? (
                <>
                  <div className="flex items-center gap-[10px] px-[14px] py-3 bg-green-100 border border-green-200 rounded-[10px] mb-4">
                    <CheckCircle2 className="h-5 w-5 text-green-700 shrink-0"/>
                    <div className="text-[13px] font-bold text-green-700">
                      Invoice {formatInvoiceNumber(generatedInv.invoiceNumber)} created · {generatedInv.tripCount} trip{generatedInv.tripCount===1?"":"s"} · {fmt(generatedInv.amount)}
                    </div>
                  </div>
                  <TripsMiniTable rows={generatedInv.trips} total={generatedInv.amount}/>
                </>
              ) : (
                <>
                  <div className="bg-slate-50 rounded-xl px-[18px] py-[14px] mb-4 border border-[#E8EEF4]">
                    <div className="grid grid-cols-2 gap-[14px]">
                      {[
                        { lbl:"Vendor", val:selVendorName || "—" },
                        { lbl:"Period", val:periodLabel },
                      ].map(({ lbl, val }) => (
                        <div key={lbl}>
                          <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.06em]">{lbl}</div>
                          <div className="text-sm font-bold text-slate-900 mt-[3px]">{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {previewLoading ? (
                    <TripsMiniTableSkeleton />
                  ) : previewErr ? (
                    <div className="px-[14px] py-[10px] bg-red-100 border border-red-200 rounded-[9px] text-red-700 text-[12.5px]">
                      {previewErr}
                    </div>
                  ) : previewTrips.length === 0 ? (
                    <div className="text-center py-[30px]">
                      <div className="w-12 h-12 rounded-[14px] bg-slate-100 flex items-center justify-center mx-auto mb-[14px]">
                        <FileText className="h-5 w-5 text-slate-400"/>
                      </div>
                      <div className="text-[13px] font-bold text-slate-900 mb-[6px]">No eligible trips</div>
                      <div className="text-[12.5px] text-slate-400 leading-[1.6] max-w-[300px] mx-auto">
                        No completed, uninvoiced trips found for this vendor in the selected period.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs font-bold text-slate-500 mb-[10px] uppercase tracking-[0.05em]">
                        {previewTrips.length} trip{previewTrips.length !== 1 ? "s" : ""} to invoice
                      </div>
                      <TripsMiniTable rows={previewTrips} total={previewTotal}/>
                    </>
                  )}

                  {generateErr && (
                    <div className="mt-4 px-[14px] py-[10px] bg-red-100 border border-red-200 rounded-[9px] text-red-700 text-[12.5px]">
                      {generateErr}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="px-6 py-4 border-t-[1.5px] border-slate-100 flex gap-[10px] shrink-0">
            {step === 2 && !generatedInv && (
              <button onClick={() => { setStep(1); setGenerateErr(null); setPreviewTrips([]); setPreviewTotal(0); setPreviewErr(null); }} disabled={generating}
                className="flex items-center gap-[6px] px-[18px] py-[10px] border-[1.5px] border-slate-200 rounded-[10px] bg-white text-slate-600 text-sm font-semibold"
                style={{ fontFamily:FONT, cursor: generating ? "default" : "pointer", opacity: generating ? 0.6 : 1 }}>
                <ChevronLeft className="h-4 w-4"/> Back
              </button>
            )}
            {step === 1 ? (
              <button disabled={!step1Valid} onClick={() => { void goToStep2(); }}
                className="flex-1 px-[18px] py-[10px] border-none rounded-[10px] text-sm font-bold"
                style={{ fontFamily:FONT, background:step1Valid?A:"#E2E8F0", color:step1Valid?"#fff":"#94A3B8", cursor:step1Valid?"pointer":"default" }}>
                Next →
              </button>
            ) : generatedInv ? (
              <button onClick={closeDrawer}
                className="flex-1 px-[18px] py-[10px] border-none rounded-[10px] bg-blue-600 text-white text-sm font-bold cursor-pointer"
                style={{ fontFamily:FONT }}>
                Done
              </button>
            ) : (
              <button disabled={generating || previewLoading || previewTrips.length === 0} onClick={confirmGenerate}
                className="flex-1 flex items-center justify-center gap-2 px-[18px] py-[10px] border-none rounded-[10px] text-white text-sm font-bold"
                style={{ fontFamily:FONT, background: (generating || previewLoading || previewTrips.length === 0) ? "#93C5FD" : A, cursor: (generating || previewLoading || previewTrips.length === 0) ? "default" : "pointer" }}>
                {generating && <Loader2 className="h-4 w-4 animate-spin"/>}
                {generating ? "Generating…" : "Generate Invoice"}
              </button>
            )}
          </div>
        </>)}

        {/* VIEW INVOICE */}
        {drawerMode === "view" && (
          <>
            <div className="px-6 pt-5 pb-4 border-b-[1.5px] border-slate-100 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[17px] font-extrabold text-slate-900 font-mono">
                    {viewInv ? formatInvoiceNumber(viewInv.invoiceNumber) : "Loading…"}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {viewInv ? `Issued ${fmtDate(viewInv.issuedAt)}` : ""}
                  </div>
                </div>
                <button onClick={closeDrawer} className="w-8 h-8 rounded-lg border-[1.5px] border-slate-200 bg-slate-50 cursor-pointer flex items-center justify-center">
                  <X className="h-4 w-4 text-slate-500"/>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {viewLoading ? (
                <div className="flex items-center justify-center gap-2 py-[60px] text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin"/>
                  <span className="text-[13px]">Loading invoice…</span>
                </div>
              ) : viewError ? (
                <div className="py-10 text-center">
                  <div className="text-[13px] text-red-700 mb-3">{viewError}</div>
                  <button onClick={() => viewInv && openView(viewInv.id)}
                    className="px-4 py-[7px] border-[1.5px] border-slate-200 rounded-[9px] bg-white text-slate-600 text-[12.5px] font-semibold cursor-pointer"
                    style={{ fontFamily:FONT }}>
                    Retry
                  </button>
                </div>
              ) : viewInv ? (
                <div className="flex flex-col gap-[14px]">
                  <div className="bg-slate-50 rounded-xl px-[18px] py-4 border border-[#E8EEF4]">
                    <div className="grid grid-cols-2 gap-[14px]">
                      {[
                        { lbl:"Vendor",  val:viewInv.vendorName },
                        { lbl:"Period",  val:fmtPeriod(viewInv.periodFrom, viewInv.periodTo) },
                        { lbl:"Amount",  val:fmt(viewInv.amount) },
                        { lbl:"Trips",   val:`${viewInv.trips.length} trip${viewInv.trips.length===1?"":"s"}` },
                        { lbl:"Due",     val:fmtDate(viewInv.dueDate) },
                        { lbl:"Issued",  val:fmtDate(viewInv.issuedAt) },
                      ].map(({ lbl, val }) => (
                        <div key={lbl}>
                          <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.06em]">{lbl}</div>
                          <div className="text-sm font-bold text-slate-900 mt-1">{val}</div>
                        </div>
                      ))}
                      <div>
                        <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.06em] mb-1">Status</div>
                        <StatusBadge status={viewInv.status}/>
                      </div>
                      {viewInv.paidAt && (
                        <div>
                          <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.06em]">Paid</div>
                          <div className="text-sm font-bold text-slate-900 mt-1">{fmtDate(viewInv.paidAt)}</div>
                        </div>
                      )}
                      {viewInv.paymentRef && (
                        <div>
                          <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.06em]">Payment Ref</div>
                          <div className="text-[13px] text-slate-900 mt-1">{viewInv.paymentRef}</div>
                        </div>
                      )}
                    </div>
                    {viewInv.notes && (
                      <div className="mt-[14px] pt-3 border-t border-dashed border-slate-200">
                        <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.06em] mb-1">Notes</div>
                        <div className="text-[12.5px] text-slate-600 leading-[1.5]">{viewInv.notes}</div>
                      </div>
                    )}
                  </div>

                  <div className="border-[1.5px] border-[#E8EEF4] rounded-xl p-4 bg-white">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-[0.05em] mb-3">
                      Invoice preview
                    </div>
                    <div className="grid gap-[10px]">
                      <button
                        type="button"
                        onClick={() => { if (viewInvoicePreview) { setPreviewMode("summary"); setPreviewInv(viewInvoicePreview); } }}
                        className="flex items-center justify-center gap-2 px-[14px] py-[10px] border-[1.5px] border-[#C5CBF0] rounded-[10px] bg-[#EEF0FB] text-[#1B2B7E] text-[13px] font-bold cursor-pointer"
                        style={{ fontFamily:FONT }}
                      >
                        <FileText className="h-4 w-4" />
                        Open Summary
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (viewInvoicePreview) { setPreviewMode("detailed"); setPreviewInv(viewInvoicePreview); } }}
                        className="flex items-center justify-center gap-2 px-[14px] py-[10px] border-[1.5px] border-slate-200 rounded-[10px] bg-white text-slate-600 text-[13px] font-bold cursor-pointer"
                        style={{ fontFamily:FONT }}
                      >
                        <FileText className="h-4 w-4" />
                        Open Detailed
                      </button>
                    </div>
                    <div className="text-xs text-slate-400 mt-[10px] leading-[1.5]">
                      The shared invoice viewer provides the same summary and detailed PDF export used in the vendor dashboard.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {viewInv && (viewInv.status === "Pending" || viewInv.status === "Overdue") && (
              <div className="px-6 py-4 border-t-[1.5px] border-slate-100 flex gap-[10px] shrink-0">
                <button onClick={handleVoid} disabled={voiding || marking}
                  className="flex items-center gap-[6px] px-[14px] py-[10px] border-[1.5px] border-red-200 rounded-[10px] bg-white text-red-700 text-[13px] font-semibold"
                  style={{ fontFamily:FONT, cursor:(voiding||marking)?"default":"pointer", opacity:(voiding||marking)?0.6:1 }}>
                  {voiding ? <Loader2 className="h-4 w-4 animate-spin"/> : <Ban className="h-4 w-4"/>}
                  Void
                </button>
                <button onClick={handleMarkPaid} disabled={marking || voiding}
                  className="flex-1 flex items-center justify-center gap-2 px-[18px] py-[10px] border-none rounded-[10px] text-white text-sm font-bold"
                  style={{ fontFamily:FONT, background:(marking||voiding)?"#93C5FD":A, cursor:(marking||voiding)?"default":"pointer" }}>
                  {marking ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>}
                  {marking ? "Marking…" : "Mark as Paid"}
                </button>
              </div>
            )}
          </>
        )}
      </DrawerPanel>

      {previewInv && (
        <TripInvoiceView inv={previewInv} mode={previewMode} onClose={() => setPreviewInv(null)} />
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus, Download, IndianRupee, CheckCircle2, Clock, X, ChevronLeft, FileText,
  Loader2, Ban, ChevronDown, CalendarDays, GripVertical,
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
const CARD: React.CSSProperties = {
  background: "#fff", border: "1.5px solid #E8EEF4",
  borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};

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
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:s.bg, color:s.text,
      border:`1px solid ${s.border}`, borderRadius:20, fontSize:11, fontWeight:700,
      padding:"3px 8px 3px 7px", whiteSpace:"nowrap" }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:s.dot, flexShrink:0 }}/>
      {status}
    </span>
  );
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
      <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px", gap:8, padding:"9px 14px", background:"#F8FAFC", borderBottom:"1px solid #E8EEF4" }}>
        {bar("55%")} {bar("60%")} {bar("50%")}
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px", gap:8, padding:"13px 14px", borderBottom:"1px solid #F1F5F9", alignItems:"center" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {bar("40%", 9)} {bar("70%", 8)}
          </div>
          {bar("65%", 9)} {bar("55%", 11)}
        </div>
      ))}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 90px 80px", gap:8, padding:"11px 14px", background:"#F8FAFC", borderTop:"2px solid #E8EEF4", alignItems:"center" }}>
        <div style={{ gridColumn:"1/3" }}>{bar("30%", 10)}</div>
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
    return `24px ${dataCols} 110px`;
  }, [visibleCols, spec.columns]);

  const minTableWidth = useMemo(
    () => visibleCols.reduce((sum, k) => sum + (spec.columns.find(c => c.key === k)?.minWidth ?? 100), 0) + 110 + 40 + 24,
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

  // Custom ordering lists of IDs saved in localStorage
  const [invoicesOrder, setInvoicesOrder] = useState<(string | number)[]>([]);

  // Drag and drop local states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load order from localStorage on client-side mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("superadmin_invoices_order");
      if (saved) {
        setInvoicesOrder(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load table orders from localStorage", e);
    }
  }, []);

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

  // Sort helper to apply saved custom order lists
  const applyCustomOrder = useCallback(
    <T extends { id: string | number }>(itemsList: T[], orderIds: (string | number)[]): T[] => {
      if (!orderIds || orderIds.length === 0) return itemsList;
      const orderMap = new Map<string | number, number>();
      orderIds.forEach((id, idx) => orderMap.set(id, idx));

      return [...itemsList].sort((a, b) => {
        const aHas = orderMap.has(a.id);
        const bHas = orderMap.has(b.id);
        if (aHas && bHas) {
          return orderMap.get(a.id)! - orderMap.get(b.id)!;
        }
        if (aHas) return -1;
        if (bHas) return 1;
        return 0;
      });
    },
    []
  );

  const sortedInvoices = useMemo(() => {
    return applyCustomOrder(invoices, invoicesOrder);
  }, [invoices, invoicesOrder, applyCustomOrder]);

  // Drag-and-drop event handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      handleDragEnd();
      return;
    }

    const updatedInvoices = [...sortedInvoices];
    const [movedItem] = updatedInvoices.splice(draggedIndex, 1);
    updatedInvoices.splice(targetIndex, 0, movedItem);

    const reorderedIds = updatedInvoices.map((item) => item.id);
    const remainingIds = invoices
      .map((item) => item.id)
      .filter((id) => !reorderedIds.includes(id));
    const newOrder = [...reorderedIds, ...remainingIds];

    setInvoicesOrder(newOrder);
    localStorage.setItem("superadmin_invoices_order", JSON.stringify(newOrder));

    handleDragEnd();
  };

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
      if (res.data && res.data.id) {
        setInvoicesOrder(prev => [res.data.id, ...prev]);
        try {
          const saved = localStorage.getItem("superadmin_invoices_order");
          const parsed = saved ? JSON.parse(saved) : [];
          localStorage.setItem("superadmin_invoices_order", JSON.stringify([res.data.id, ...parsed]));
        } catch (e) {
          console.error(e);
        }
      }
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
    <div style={{ fontFamily:FONT, color:"#0F172A", display:"flex", flexDirection:"column", gap:20 }}
         onClick={() => { setStatusMenu(null); }}>
      <style>{`
        .drag-row {
          transition: background-color 0.2s ease, transform 0.2s ease, border 0.2s ease;
        }
        .drag-row:hover {
          background-color: #f8fafc !important;
        }
        .drag-row:hover .drag-handle {
          opacity: 1;
        }
        .drag-handle {
          opacity: 0.4;
          transition: opacity 0.2s ease;
        }
        .drag-handle:hover {
          opacity: 1;
          color: #2563EB;
        }
      `}</style>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <p style={{ fontSize:20, fontWeight:800 }}>Vendor Invoicing</p>
          <p style={{ fontSize:12.5, color:"#94A3B8", marginTop:2 }}>Generate and manage invoices for vendors</p>
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
          <p style={{ fontSize:15, fontWeight:800 }}>All Vendor Invoices</p>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {loading
              ? <Skeleton className="h-3 w-20" />
              : <span style={{ fontSize:12, color:"#94A3B8" }}>{invoices.length} invoice{invoices.length===1?"":"s"}</span>}
            <ColumnsPopover tableKey="superadminInvoices" visible={visibleCols} totalCount={totalCount} onToggle={toggle} onReset={reset} />
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <div className="w-fit min-w-full" style={{ minWidth: minTableWidth }}>
            <div style={{ display:"grid", gridTemplateColumns: gridTemplate, gap:12,
              padding:"10px 20px", borderBottom:"1px solid #F1F5F9", background:"#FAFBFC" }}>
              <div />
              {prefsLoading
                ? Array.from({ length: visibleCols.length + 1 }).map((_, i) => (
                    <Skeleton key={i} className="h-3 w-16" />
                  ))
                : [...visibleCols.map(k => {
                    const col = spec.columns.find(c => c.key === k);
                    return col?.label.toUpperCase() ?? k.toUpperCase();
                  }), ""].map((h, i) => (
                    <div key={i} style={{ fontSize:10.5, fontWeight:700, color:"#CBD5E1", textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</div>
                  ))}
            </div>

            {loading ? (
              <div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns: gridTemplate, gap:12,
                    padding:"13px 20px", borderBottom: i < 4 ? "1px solid #F1F5F9" : "none", alignItems:"center" }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#F1F5F9" }} />
                    {visibleCols.map(k => <Skeleton key={k} className="h-3.5 w-20" />)}
                    <Skeleton className="h-6 w-10 rounded-md" />
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
                No vendor invoices yet. Click <strong style={{ color:"#475569" }}>New Invoice</strong> to generate one.
              </div>
            ) : sortedInvoices.map((inv, i) => {
              const isDragged = draggedIndex === i;
              const isDragOver = dragOverIndex === i;
              const cellFor = (k: string): React.ReactNode => {
                switch (k) {
                  case "invoiceNo":  return <span style={{ fontWeight:800, fontSize:13, color:"#1E293B", fontFamily:"monospace" }}>{formatInvoiceNumber(inv.invoiceNumber)}</span>;
                  case "vendor":     return (
                    <div>
                      <p style={{ fontSize:13, fontWeight:600, color:"#0F172A" }}>{inv.vendorName}</p>
                      <p style={{ fontSize:11.5, color:"#94A3B8", marginTop:1 }}>Issued {fmtDate(inv.issuedAt)} · {inv.tripCount} trip{inv.tripCount===1?"":"s"}</p>
                    </div>
                  );
                  case "period":     return <span style={{ fontSize:13, color:"#475569" }}>{fmtPeriod(inv.periodFrom, inv.periodTo)}</span>;
                  case "amount":     return <span style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>{fmt(inv.amount)}</span>;
                  case "issuedAt":   return <span style={{ fontSize:13, color:"#475569" }}>{fmtDate(inv.issuedAt)}</span>;
                  case "dueDate":    return <span style={{ fontSize:13, color:"#475569" }}>{fmtDate(inv.dueDate)}</span>;
                  case "paidAt":     return inv.paidAt ? <span style={{ fontSize:13, color:"#475569" }}>{fmtDate(inv.paidAt)}</span> : <span style={{ fontSize:13, color:"#CBD5E1" }}>—</span>;
                  case "paymentRef": return <span style={{ fontSize:13, color:"#94A3B8" }}>—</span>;
                  case "notes":      return <span style={{ fontSize:13, color:"#94A3B8" }}>—</span>;
                  case "status": return (
                    <div style={{ position:"relative" }} onClick={e => e.stopPropagation()}>
                      {changingStatus === inv.id ? (
                        <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, color:"#94A3B8" }}>
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
                          style={{ background:"none", border:"none", padding:0, cursor: inv.status==="Paid"||inv.status==="Voided" ? "default" : "pointer",
                            display:"inline-flex", alignItems:"center", gap:3 }}>
                          <StatusBadge status={inv.status}/>
                          {inv.status !== "Paid" && inv.status !== "Voided" && (
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
                  default: return null;
                }
              };
              return (
                <div key={inv.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, i)}
                  onClick={() => openView(inv.id)}
                  onMouseEnter={() => setHovRow(i)} onMouseLeave={() => setHovRow(null)}
                  className="drag-row"
                  style={{ display:"grid", gridTemplateColumns: gridTemplate, gap:12,
                    padding:"13px 20px", borderBottom:"1px solid #F1F5F9",
                    backgroundColor: isDragOver
                      ? "rgba(37, 99, 235, 0.06)"
                      : isDragged
                      ? "rgba(241, 245, 249, 0.5)"
                      : hovRow===i?"#F8FAFC":"#fff",
                    cursor:"pointer",
                    transition:"background-color 0.2s ease, transform 0.2s ease, border 0.2s ease",
                    alignItems:"center",
                    opacity: isDragged ? 0.45 : 1,
                    outline: isDragOver ? "1.5px dashed #3B82F6" : "none",
                    outlineOffset: "-2px",
                    transform: isDragOver ? "scale(1.005)" : "none",
                    boxShadow: isDragged ? "0 4px 12px rgba(0,0,0,0.04)" : "none",
                  }}>
                  <div className="drag-handle" style={{ display: "flex", alignItems: "center", color: "#94A3B8" }}>
                    <GripVertical size={13} style={{ cursor: "grab" }} />
                  </div>
                  {visibleCols.map(k => (
                    <div key={k}>{cellFor(k)}</div>
                  ))}
                  {/* Export dropdown — always last, fixed 110px */}
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
                          {(["summary","detailed"] as const).map((mode, idx) => (
                            <button
                              key={mode}
                              onClick={() => { void viewInvoicePdf(inv.id, mode); setExportMenu(null); }}
                              style={{ display:"block", width:"100%", padding:"10px 14px", textAlign:"left",
                                border:"none", borderBottom: idx === 0 ? "1px solid #F1F5F9" : "none",
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

      {/* DRAWER */}
      <DrawerPanel open={drawerMode !== null} onClose={closeDrawer}>

        {/* NEW INVOICE */}
        {drawerMode === "new" && (<>
          <div style={{ padding:"20px 24px 16px", borderBottom:"1.5px solid #F1F5F9", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:17, fontWeight:800, color:"#0F172A" }}>Vendor Invoice</div>
                <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>
                  Step {step} of 2 — {step===1 ? "Select vendor & period" : "Review & confirm"}
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

          {step === 1 && (
            <div style={{ flex:1, overflowY:"auto", padding:"24px" }}>

              {/* Vendor search */}
              <div style={{ marginBottom:22 }}>
                <label style={{ fontSize:11.5, fontWeight:700, color:"#64748B", display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Vendor</label>
                <div style={{ position:"relative" }}>
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
                    style={{
                      width:"100%", height:42, padding:"0 36px 0 14px",
                      border:`1.5px solid ${vendorOpen ? A : "#E2E8F0"}`,
                      borderRadius:10, background:"#fff", fontFamily:FONT, fontSize:14,
                      color:"#0F172A", outline:"none", boxSizing:"border-box",
                      transition:"border-color .15s",
                    }}
                  />
                  <ChevronDown style={{ position:"absolute", right:12, top:"50%", transform:`translateY(-50%) ${vendorOpen?"rotate(180deg)":""}`, width:16, height:16, color:"#94A3B8", pointerEvents:"none", transition:"transform .15s" }}/>
                  {vendorOpen && (
                    <>
                      <div style={{ position:"fixed", inset:0, zIndex:98 }} onClick={() => setVendorOpen(false)}/>
                      <div style={{
                        position:"absolute", top:"calc(100% + 4px)", left:0, right:0, zIndex:99,
                        background:"#fff", border:"1.5px solid #E2E8F0", borderRadius:10,
                        boxShadow:"0 8px 24px rgba(0,0,0,0.12)", overflow:"hidden",
                        maxHeight:220, overflowY:"auto",
                      }}>
                        {filteredVendors.length === 0 ? (
                          <div style={{ padding:"12px 14px", fontSize:13, color:"#94A3B8" }}>
                            {vendorQuery ? `No vendors matching "${vendorQuery}"` : "No vendors found"}
                          </div>
                        ) : filteredVendors.map((v) => (
                          <button key={v.id}
                            onClick={() => { setSelVendor(v.id); setVendorQuery(v.name); setVendorOpen(false); }}
                            style={{
                              display:"block", width:"100%", padding:"10px 14px", textAlign:"left",
                              border:"none", cursor:"pointer", fontFamily:FONT, fontSize:14,
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
              <div style={{ marginBottom:22 }}>
                <label style={{ fontSize:11.5, fontWeight:700, color:"#64748B", display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Billing Period</label>
                <div style={{ position:"relative" }}>
                  <button
                    onClick={() => { setPickerOpen(o => !o); setVendorOpen(false); }}
                    style={{
                      width:"100%", display:"flex", alignItems:"center", justifyContent: "space-between",
                      height:42, padding:"0 14px", border:"1.5px solid #E2E8F0", borderRadius:10,
                      background:"#fff", cursor:"pointer", fontFamily:FONT, fontSize:14,
                      color: "#0F172A", textAlign:"left",
                    }}>
                    <span style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <CalendarDays style={{ width:15, height:15, color:"#94A3B8", flexShrink:0 }}/>
                      {periodLabel}
                    </span>
                    <ChevronDown style={{ width:16, height:16, color:"#94A3B8", flexShrink:0, transform: pickerOpen ? "rotate(180deg)" : "none", transition:"transform .15s" }}/>
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
                <label style={{ fontSize:11.5, fontWeight:700, color:"#64748B", display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal note shown on the invoice…"
                  style={{ width:"100%", minHeight:72, padding:"10px 12px", border:"1.5px solid #E2E8F0", borderRadius:9, fontSize:13, fontFamily:FONT, color:"#374151", outline:"none", resize:"vertical", boxSizing:"border-box" }}
                />
              </div>
            </div>
          )}

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
                        { lbl:"Vendor", val:selVendorName || "—" },
                        { lbl:"Period", val:periodLabel },
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
                        No completed, uninvoiced trips found for this vendor in the selected period.
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

        {/* VIEW INVOICE */}
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
                <button onClick={closeDrawer} style={{ width:32, height:32, borderRadius:8, border:"1.5px solid #E2E8F0", background:"#F8FAFC", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <X className="h-4 w-4" style={{ color:"#64748B" }}/>
                </button>
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
                <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                  <div style={{ background:"#F8FAFC", borderRadius:12, padding:"16px 18px", border:"1px solid #E8EEF4" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                      {[
                        { lbl:"Vendor",  val:viewInv.vendorName },
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
                      {viewInv.paymentRef && (
                        <div>
                          <div style={{ fontSize:10.5, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.06em" }}>Payment Ref</div>
                          <div style={{ fontSize:13, color:"#0F172A", marginTop:4 }}>{viewInv.paymentRef}</div>
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

                  <div style={{ border:"1.5px solid #E8EEF4", borderRadius:12, padding:16, background:"#fff" }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:12 }}>
                      Invoice preview
                    </div>
                    <div style={{ display:"grid", gap:10 }}>
                      <button
                        type="button"
                        onClick={() => { if (viewInvoicePreview) { setPreviewMode("summary"); setPreviewInv(viewInvoicePreview); } }}
                        style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"10px 14px", border:"1.5px solid #C5CBF0", borderRadius:10, background:"#EEF0FB", color:"#1B2B7E", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:FONT }}
                      >
                        <FileText className="h-4 w-4" />
                        Open Summary
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (viewInvoicePreview) { setPreviewMode("detailed"); setPreviewInv(viewInvoicePreview); } }}
                        style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"10px 14px", border:"1.5px solid #E2E8F0", borderRadius:10, background:"#fff", color:"#475569", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:FONT }}
                      >
                        <FileText className="h-4 w-4" />
                        Open Detailed
                      </button>
                    </div>
                    <div style={{ fontSize:12, color:"#94A3B8", marginTop:10, lineHeight:1.5 }}>
                      The shared invoice viewer provides the same summary and detailed PDF export used in the vendor dashboard.
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {viewInv && (viewInv.status === "Pending" || viewInv.status === "Overdue") && (
              <div style={{ padding:"16px 24px", borderTop:"1.5px solid #F1F5F9", display:"flex", gap:10, flexShrink:0 }}>
                <button onClick={handleVoid} disabled={voiding || marking}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 14px", border:"1.5px solid #FECACA", borderRadius:10, background:"#fff", color:"B91C1C", fontSize:13, fontWeight:600, cursor:(voiding||marking)?"default":"pointer", fontFamily:FONT, opacity:(voiding||marking)?0.6:1 }}>
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

      {previewInv && (
        <TripInvoiceView inv={previewInv} mode={previewMode} onClose={() => setPreviewInv(null)} />
      )}
    </div>
  );
}

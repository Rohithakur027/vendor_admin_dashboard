"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Download, IndianRupee, CheckCircle2, Clock, X, ChevronLeft, FileText, Loader2, Ban } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  invoicesApi,
  companiesApi,
  type InvoiceListItem,
  type InvoiceDetail,
  type InvoiceSummary,
  type InvoiceTripItem,
  type CompanyApiItem,
} from "@/lib/api";

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
  // Same calendar month → "Apr 2026". Otherwise show explicit range.
  if (fd.getMonth() === td.getMonth() && fd.getFullYear() === td.getFullYear()) {
    return fd.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  }
  return `${fd.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — ${td.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
}

// Backend already projects Pending+past-due → Overdue, but a stale list row
// could still display the wrong badge between actions. Recompute defensively.
function effectiveStatus(inv: { status: InvStatus; dueDate: string }): InvStatus {
  if (inv.status === "Pending" && new Date(inv.dueDate) < new Date(new Date().toDateString())) {
    return "Overdue";
  }
  return inv.status;
}

function monthOptions() {
  const opts: { label: string; from: string; to: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const from = `${y}-${String(m+1).padStart(2,"0")}-01`;
    const last = new Date(y, m+1, 0).getDate();
    const to   = `${y}-${String(m+1).padStart(2,"0")}-${String(last).padStart(2,"0")}`;
    opts.push({ label: d.toLocaleDateString("en-IN",{month:"short",year:"numeric"}), from, to });
  }
  return opts;
}

function generatePDF(inv: InvoiceDetail, vendorName: string) {
  const sc = SC[inv.status];
  const rowsHtml = inv.trips.map((t, i) => `
    <tr>
      <td>${i+1}</td>
      <td style="font-family:monospace">${t.tripRef || "—"}</td>
      <td>${t.supervisorName || "—"}</td>
      <td>${t.pickupTime ? new Date(t.pickupTime).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : "—"}</td>
      <td>${(t.pickupAddress || "").split(",")[0]} → ${(t.dropAddress || "").split(",")[0]}</td>
      <td style="text-align:right;font-weight:700">₹${(t.fare||0).toLocaleString("en-IN")}</td>
    </tr>`).join("");
  const total = inv.trips.reduce((s,t)=>s+(t.fare||0),0);
  const html = `<!DOCTYPE html><html><head><title>${inv.invoiceNumber}</title><style>
    *{box-sizing:border-box}body{font-family:sans-serif;padding:40px;color:#0f172a;max-width:820px;margin:0 auto}
    .hdr{display:flex;justify-content:space-between;margin-bottom:32px}
    .logo{font-size:22px;font-weight:800}.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${sc.bg};color:${sc.text}}
    .meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px;background:#f8fafc;border-radius:10px;margin-bottom:24px}
    .lbl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:3px}.val{font-size:15px;font-weight:700}
    table{width:100%;border-collapse:collapse;margin-top:4px}
    th{background:#f8fafc;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;border-bottom:1px solid #e8eef4}
    td{padding:9px 12px;font-size:12px;border-bottom:1px solid #f1f5f9}
    .tot td{font-weight:700;font-size:14px;border-top:2px solid #e8eef4;padding-top:12px}
    @media print{body{padding:20px}}
  </style></head><body>
  <div class="hdr">
    <div><div class="logo">${vendorName}</div><div style="font-size:12px;color:#64748b;margin-top:3px">Tax Invoice</div></div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:800">${inv.invoiceNumber}</div>
      <div style="font-size:12px;color:#64748b;margin-top:4px">Issued: ${fmtDate(inv.issuedAt)}</div>
      <div style="margin-top:6px"><span class="badge">${inv.status}</span></div>
    </div>
  </div>
  <div class="meta">
    <div><div class="lbl">Bill To</div><div class="val">${inv.companyName}</div></div>
    <div><div class="lbl">Billing Period</div><div class="val">${fmtPeriod(inv.periodFrom, inv.periodTo)}</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Trip ID</th><th>Supervisor</th><th>Date</th><th>Route</th><th style="text-align:right">Fare</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr class="tot"><td colspan="5" style="text-align:right">Total Amount</td><td style="text-align:right;font-size:16px">₹${total.toLocaleString("en-IN")}</td></tr></tfoot>
  </table>
  </body></html>`;
  const w = window.open("","_blank");
  if (!w) return;
  w.document.write(html); w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
}

function Drawer({ open, onClose, children }: { open:boolean; onClose:()=>void; children:React.ReactNode }) {
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
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:s.bg, color:s.text,
      border:`1px solid ${s.border}`, borderRadius:20, fontSize:11, fontWeight:700,
      padding:"3px 10px", whiteSpace:"nowrap" }}>
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
            <div style={{ fontSize:12.5, fontWeight:600, color:"#0F172A", fontFamily:"monospace" }}>{t.tripRef || t.tripId.slice(0, 8)}</div>
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

/* ══════════════════════════════════════
   PAGE
══════════════════════════════════════ */
export default function InvoicingPage() {
  const vendorName = "SK Travels";
  const MONTHS = useMemo(() => monthOptions(), []);

  const [invoices,    setInvoices]    = useState<InvoiceListItem[]>([]);
  const [summary,     setSummary]     = useState<InvoiceSummary>({ totalBilled: 0, collected: 0, outstanding: 0, totalCount: 0, paidCount: 0, unpaidCount: 0 });
  const [companies,   setCompanies]   = useState<CompanyApiItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  const [drawerMode,  setDrawerMode]  = useState<"new"|"view"|null>(null);
  const [step,        setStep]        = useState<1|2>(1);
  const [selCompany,  setSelCompany]  = useState("");
  const [periodMode,  setPeriodMode]  = useState<"month"|"custom">("month");
  const [selMonthIdx, setSelMonthIdx] = useState(0);
  const [customFrom,  setCustomFrom]  = useState("");
  const [customTo,    setCustomTo]    = useState("");
  const [notes,       setNotes]       = useState("");
  const [generating,  setGenerating]  = useState(false);
  const [generateErr, setGenerateErr] = useState<string | null>(null);
  const [generatedInv, setGeneratedInv] = useState<InvoiceDetail | null>(null);

  const [viewInv,     setViewInv]     = useState<InvoiceDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError,   setViewError]   = useState<string | null>(null);
  const [marking,     setMarking]     = useState(false);
  const [voiding,     setVoiding]     = useState(false);
  const [hovRow,      setHovRow]      = useState<number|null>(null);

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

  useEffect(() => { reload(); }, [reload]);

  const periodFrom = periodMode==="month" ? MONTHS[selMonthIdx]?.from ?? "" : customFrom;
  const periodTo   = periodMode==="month" ? MONTHS[selMonthIdx]?.to   ?? "" : customTo;
  const step1Valid = !!selCompany && !!periodFrom && !!periodTo;

  function openNew() {
    setSelCompany(""); setPeriodMode("month"); setSelMonthIdx(0);
    setCustomFrom(""); setCustomTo(""); setNotes("");
    setStep(1); setGenerateErr(null); setGeneratedInv(null); setDrawerMode("new");
  }
  function closeDrawer() {
    setDrawerMode(null);
    setViewInv(null); setViewError(null); setGeneratedInv(null); setGenerateErr(null);
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

  // List rows don't include line-item trips. Fetch full detail before printing.
  async function downloadPdfFromList(id: string) {
    try {
      const res = await invoicesApi.get(id);
      generatePDF(res.data, vendorName);
    } catch {
      // best-effort; ignore
    }
  }

  /* ── RENDER ── */
  return (
    <div style={{ fontFamily:FONT, color:"#0F172A", display:"flex", flexDirection:"column", gap:20 }}>

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
          { label:"Total Billed", value:fmt(summary.totalBilled),  sub:`${summary.totalCount} invoice${summary.totalCount===1?"":"s"}`, Icon:IndianRupee, ib:"#F1F5F9", ic:"#94A3B8" },
          { label:"Collected",    value:fmt(summary.collected),    sub:`${summary.paidCount} paid`, Icon:CheckCircle2, ib:"#F1F5F9", ic:"#94A3B8" },
          { label:"Outstanding",  value:fmt(summary.outstanding),  sub:`${summary.unpaidCount} unpaid`, Icon:Clock, ib:"#F1F5F9", ic:"#94A3B8" },
        ].map(({ label, value, sub, Icon, ib, ic }) => (
          <div key={label} style={{ ...CARD, padding:20, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
            <div>
              <p style={{ fontSize:11, color:"#64748B", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</p>
              <p style={{ fontSize:28, fontWeight:800, color:"#0F172A", lineHeight:1.1, marginTop:4 }}>
                {loading ? "—" : value}
              </p>
              <p style={{ fontSize:12, color:"#94A3B8", marginTop:4 }}>{loading ? "Loading…" : sub}</p>
            </div>
            <div style={{ background:ib, borderRadius:11, width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Icon style={{ color:ic }} className="h-5 w-5"/>
            </div>
          </div>
        ))}
      </div>

      {/* Invoice table */}
      <div style={CARD}>
        <div style={{ padding:"16px 20px", borderBottom:"1px solid #F1F5F9", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <p style={{ fontSize:15, fontWeight:800 }}>All Invoices</p>
          <span style={{ fontSize:12, color:"#94A3B8" }}>{invoices.length} invoice{invoices.length===1?"":"s"}</span>
        </div>
        <div style={{ overflowX:"auto" }}>
          <div style={{ minWidth:700 }}>
            <div style={{ display:"grid", gridTemplateColumns:"110px 1fr 130px 120px 110px 90px", gap:12,
              padding:"10px 20px", borderBottom:"1px solid #F1F5F9", background:"#FAFBFC" }}>
              {["INVOICE ID","COMPANY","PERIOD","AMOUNT","STATUS",""].map(h => (
                <div key={h} style={{ fontSize:10.5, fontWeight:700, color:"#CBD5E1", textTransform:"uppercase", letterSpacing:"0.06em" }}>{h}</div>
              ))}
            </div>
            {loading ? (
              <div style={{ padding:"48px 0", textAlign:"center", color:"#94A3B8", fontSize:13, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <Loader2 className="h-4 w-4 animate-spin"/> Loading invoices…
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
              return (
                <div key={inv.id}
                  onClick={() => openView(inv.id)}
                  onMouseEnter={() => setHovRow(i)} onMouseLeave={() => setHovRow(null)}
                  style={{ display:"grid", gridTemplateColumns:"110px 1fr 130px 120px 110px 90px", gap:12,
                    padding:"13px 20px", borderBottom:"1px solid #F1F5F9",
                    background:hovRow===i?"#F8FAFC":"#fff", cursor:"pointer",
                    transition:"background 0.12s", alignItems:"center" }}>
                  <span style={{ fontWeight:800, fontSize:13, color:"#1E293B", fontFamily:"monospace" }}>{inv.invoiceNumber}</span>
                  <div>
                    <p style={{ fontSize:13, fontWeight:600, color:"#0F172A" }}>{inv.companyName}</p>
                    <p style={{ fontSize:11.5, color:"#94A3B8", marginTop:1 }}>Issued {fmtDate(inv.issuedAt)} · {inv.tripCount} trip{inv.tripCount===1?"":"s"}</p>
                  </div>
                  <span style={{ fontSize:13, color:"#475569" }}>{fmtPeriod(inv.periodFrom, inv.periodTo)}</span>
                  <span style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>{fmt(inv.amount)}</span>
                  <StatusBadge status={status}/>
                  <button onClick={e => { e.stopPropagation(); void downloadPdfFromList(inv.id); }}
                    style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600, color:"#64748B",
                      background:"none", border:"1px solid #E8EEF4", borderRadius:7, padding:"5px 10px",
                      cursor:"pointer", fontFamily:FONT }}>
                    <Download className="h-3 w-3"/> PDF
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          DRAWER
      ══════════════════════════════════════ */}
      <Drawer open={drawerMode !== null} onClose={closeDrawer}>

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
              <div style={{ marginBottom:22 }}>
                <label style={{ fontSize:11.5, fontWeight:700, color:"#64748B", display:"block", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.06em" }}>Company</label>
                <Select value={selCompany} onValueChange={(v) => setSelCompany(v ?? "")}>
                  <SelectTrigger className="w-full h-[42px] rounded-[10px] border-[1.5px] border-slate-200 bg-white px-3.5 text-sm text-slate-900 data-placeholder:text-slate-400 font-[var(--font-plus-jakarta-sans),'Plus_Jakarta_Sans',sans-serif]">
                    <SelectValue placeholder="Select company…" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.length > 0 ? (
                      companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__none__" disabled>No companies found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div style={{ marginBottom:22 }}>
                <label style={{ fontSize:11.5, fontWeight:700, color:"#64748B", display:"block", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>Billing Period</label>
                <div style={{ display:"inline-flex", background:"#F1F5F9", borderRadius:9, padding:3, marginBottom:14 }}>
                  {(["month","custom"] as const).map(m => (
                    <button key={m} onClick={() => setPeriodMode(m)}
                      style={{ padding:"6px 16px", borderRadius:7, border:"none",
                        background:periodMode===m?"#fff":"transparent",
                        fontSize:13, fontWeight:periodMode===m?700:500,
                        color:periodMode===m?"#0F172A":"#64748B",
                        cursor:"pointer", fontFamily:FONT,
                        boxShadow:periodMode===m?"0 1px 4px rgba(0,0,0,0.07)":"none",
                        transition:"all .15s" }}>
                      {m === "month" ? "Month" : "Custom Range"}
                    </button>
                  ))}
                </div>

                {periodMode === "month" ? (
                  <Select value={String(selMonthIdx)} onValueChange={(v) => setSelMonthIdx(Number(v ?? 0))}>
                    <SelectTrigger className="w-full h-[42px] rounded-[10px] border-[1.5px] border-slate-200 bg-white px-3.5 text-sm text-slate-900 font-[var(--font-plus-jakarta-sans),'Plus_Jakarta_Sans',sans-serif]">
                      <SelectValue placeholder="Select month…" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((mo, i) => (
                        <SelectItem key={i} value={String(i)}>{mo.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    {[
                      { label:"From", val:customFrom, max:customTo||undefined, onChange:(v:string)=>setCustomFrom(v) },
                      { label:"To",   val:customTo,   min:customFrom||undefined, onChange:(v:string)=>setCustomTo(v) },
                    ].map(f => (
                      <div key={f.label}>
                        <div style={{ fontSize:11.5, color:"#94A3B8", marginBottom:6, fontWeight:600 }}>{f.label}</div>
                        <input type="date" value={f.val} min={f.min} max={f.max}
                          onChange={e => f.onChange(e.target.value)}
                          style={{ width:"100%", padding:"9px 12px", border:"1.5px solid #E2E8F0", borderRadius:9, fontSize:13, fontFamily:FONT, color:"#374151", outline:"none", boxSizing:"border-box" }}/>
                      </div>
                    ))}
                  </div>
                )}
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
                      Invoice {generatedInv.invoiceNumber} created · {generatedInv.tripCount} trip{generatedInv.tripCount===1?"":"s"} · {fmt(generatedInv.amount)}
                    </div>
                  </div>
                  <TripsMiniTable rows={generatedInv.trips} total={generatedInv.amount}/>
                </>
              ) : (
                <>
                  <div style={{ background:"#F8FAFC", borderRadius:12, padding:"16px 18px", marginBottom:20, border:"1px solid #E8EEF4" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                      {[
                        { lbl:"Company", val:companies.find(c=>c.id===selCompany)?.name ?? "—" },
                        { lbl:"Period",  val:periodMode==="month" ? MONTHS[selMonthIdx].label : `${customFrom} — ${customTo}` },
                      ].map(({ lbl, val }) => (
                        <div key={lbl}>
                          <div style={{ fontSize:10.5, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.06em" }}>{lbl}</div>
                          <div style={{ fontSize:14, fontWeight:700, color:"#0F172A", marginTop:3 }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign:"center", padding:"20px 0" }}>
                    <div style={{ width:48, height:48, borderRadius:14, background:"#F1F5F9", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
                      <FileText style={{ color:"#94A3B8" }} className="h-5 w-5"/>
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#0F172A", marginBottom:6 }}>Ready to generate</div>
                    <div style={{ fontSize:12.5, color:"#94A3B8", lineHeight:1.6, maxWidth:340, margin:"0 auto" }}>
                      Eligible completed trips for this company in the selected period will be bundled into a new invoice. Trips already on another invoice are skipped.
                    </div>
                  </div>
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
              <button onClick={() => { setStep(1); setGenerateErr(null); }} disabled={generating}
                style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 18px", border:"1.5px solid #E2E8F0", borderRadius:10, background:"#fff", color:"#475569", fontSize:14, fontWeight:600, cursor: generating ? "default" : "pointer", fontFamily:FONT, opacity: generating ? 0.6 : 1 }}>
                <ChevronLeft className="h-4 w-4"/> Back
              </button>
            )}
            {step === 1 ? (
              <button disabled={!step1Valid} onClick={() => setStep(2)}
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
              <button disabled={generating} onClick={confirmGenerate}
                style={{ flex:1, padding:"10px 18px", border:"none", borderRadius:10,
                  background: generating ? "#93C5FD" : A,
                  color:"#fff",
                  fontSize:14, fontWeight:700,
                  cursor: generating ? "default" : "pointer", fontFamily:FONT,
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
                    {viewInv?.invoiceNumber ?? "Loading…"}
                  </div>
                  <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>
                    {viewInv ? `Issued ${fmtDate(viewInv.issuedAt)}` : ""}
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  {viewInv && (
                    <button onClick={() => generatePDF(viewInv, vendorName)}
                      style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", border:"1.5px solid #E2E8F0", borderRadius:9, background:"#fff", color:"#475569", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:FONT }}>
                      <Download className="h-3.5 w-3.5"/> PDF
                    </button>
                  )}
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
                <>
                  <div style={{ background:"#F8FAFC", borderRadius:12, padding:"16px 18px", marginBottom:20, border:"1px solid #E8EEF4" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                      {[
                        { lbl:"Company", val:viewInv.companyName },
                        { lbl:"Period",  val:fmtPeriod(viewInv.periodFrom, viewInv.periodTo) },
                        { lbl:"Amount",  val:fmt(viewInv.amount) },
                        { lbl:"Due",     val:fmtDate(viewInv.dueDate) },
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

                  {viewInv.trips.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"32px 0", color:"#94A3B8", fontSize:13 }}>No trip details available.</div>
                  ) : (
                    <>
                      <div style={{ fontSize:12, fontWeight:700, color:"#64748B", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                        {viewInv.trips.length} Trip{viewInv.trips.length===1?"":"s"}
                      </div>
                      <TripsMiniTable rows={viewInv.trips} total={viewInv.amount}/>
                    </>
                  )}
                </>
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
      </Drawer>
    </div>
  );
}

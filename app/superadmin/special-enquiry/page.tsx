"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { superadminApi, type WebsiteGeneralEnquiry } from "@/lib/api";
import { MessageSquare } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/ExportButton";
import { exportToXlsx } from "@/lib/exportXlsx";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";
import { WebsiteGeneralEnquiryDetailSidebar } from "../booking-enquiries/BookingEnquirySidebar";

const STATUS_PILL: Record<string, { bg: string; color: string; dot: string; border: string }> = {
  new:         { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6", border: "#bfdbfe" },
  "in review": { bg: "#fefce8", color: "#854d0e", dot: "#eab308", border: "#fef08a" },
  resolved:    { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e", border: "#bbf7d0" },
  closed:      { bg: "#f8fafc", color: "#475569", dot: "#94a3b8", border: "#e2e8f0" },
};

function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? "new").toString().toLowerCase();
  const t = STATUS_PILL[s] ?? { bg: "#f8fafc", color: "#475569", dot: "#94a3b8", border: "#e2e8f0" };
  return (
    <span
      className="inline-flex items-center gap-1.5 w-fit rounded-full text-[11px] font-bold px-2.5 py-0.5 whitespace-nowrap"
      style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.dot }} />
      {s.replace(/_/g, " ")}
    </span>
  );
}

function fmtDate(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "—", time: "" };
  try {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }),
      time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
    };
  } catch { return { date: "—", time: "" }; }
}

function fmtPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return phone;
}

function phoneExportValue(phone: string): string | number {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : digits;
}

const COL_CFG: Record<string, { grid: string; minPx: number }> = {
  enqRef:      { grid: "130px",           minPx: 130 },
  name:        { grid: "minmax(0,1.6fr)", minPx: 180 },
  companyName: { grid: "minmax(0,1.4fr)", minPx: 160 },
  message:     { grid: "minmax(0,2.2fr)", minPx: 220 },
  createdAt:   { grid: "150px",           minPx: 150 },
  email:       { grid: "minmax(0,1.6fr)", minPx: 180 },
  mobile:      { grid: "130px",           minPx: 130 },
  status:      { grid: "130px",           minPx: 130 },
};

function EnquiryCell({ row, colKey }: { row: WebsiteGeneralEnquiry; colKey: string }) {
  switch (colKey) {
    case "enqRef":
      return <span className="text-[13px] font-extrabold text-slate-900">{row.enqRef ?? "—"}</span>;
    case "name":
      return (
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-bold text-slate-900 truncate">{row.name}</span>
          <span className="text-[11.5px] text-slate-500 truncate">{row.email ?? "—"}</span>
          <span className="text-[11px] text-slate-400">{fmtPhone(row.mobile)}</span>
        </div>
      );
    case "companyName":
      return <span className="block text-[13px] font-semibold text-slate-900 truncate">{row.companyName ?? "—"}</span>;
    case "message":
      return (
        <span
          className="text-[12.5px] text-slate-500 overflow-hidden"
          style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}
        >
          {row.message}
        </span>
      );
    case "createdAt": {
      const { date, time } = fmtDate(row.createdAt);
      return (
        <div className="flex flex-col gap-px">
          <span className="text-[13px] font-semibold text-slate-900">{date}</span>
          <span className="text-[11.5px] text-slate-500">{time}</span>
        </div>
      );
    }
    case "email":
      return <span className="block text-[12px] text-slate-500 truncate">{row.email ?? "—"}</span>;
    case "mobile":
      return <span className="text-[12px] text-slate-500">{fmtPhone(row.mobile)}</span>;
    case "status":
      return <StatusPill status={row.status} />;
    default:
      return <span className="text-[13px] text-slate-400">—</span>;
  }
}

export default function SpecialEnquiryPage() {
  const [enquiries, setEnquiries] = useState<WebsiteGeneralEnquiry[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState<WebsiteGeneralEnquiry | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const colPrefs   = useColumnPreferences("specialBookingEnquiries");
  const tableSpec  = getTableSpec("specialBookingEnquiries");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = { limit: 100, ...(search.trim() && { search: search.trim() }) };
    superadminApi.bookingEnquiries.listWebsiteEnquiries(params)
      .then(res => {
        if (cancelled) return;
        setEnquiries(res.data);
        setTotal(res.pagination.total);
      })
      .catch(err => {
        if (cancelled) return;
        setEnquiries([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : "Failed to load special enquiries.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search, refreshTick]);

  const cols = colPrefs.columns;
  const gridTemplate = cols.map(k => COL_CFG[k]?.grid ?? "minmax(0,1fr)").join(" ");
  const minWidth = Math.max(700, cols.reduce((acc, k) => acc + (COL_CFG[k]?.minPx ?? 120), 0) + (cols.length - 1) * 16);

  const filtered = useMemo(() => {
    if (!search.trim()) return enquiries;
    const q = search.toLowerCase();
    return enquiries.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.email ?? "").toLowerCase().includes(q) ||
      e.mobile.includes(q) ||
      (e.companyName ?? "").toLowerCase().includes(q) ||
      e.message.toLowerCase().includes(q)
    );
  }, [enquiries, search]);

  function handleExport() {
    exportToXlsx("special-enquiries.xlsx", filtered.map(e => {
      const row: Record<string, string | number | null> = {};
      cols.forEach(key => {
        switch (key) {
          case "enqRef":      row["Enquiry ID"]  = e.enqRef ?? null; break;
          case "name":        row["Name"]        = e.name; break;
          case "email":       row["Email"]       = e.email ?? null; break;
          case "mobile":      row["Mobile"]      = phoneExportValue(e.mobile); break;
          case "companyName": row["Company"]     = e.companyName ?? null; break;
          case "message":     row["Message"]     = e.message; break;
          case "createdAt":   row["Created At"]  = `${fmtDate(e.createdAt).date} ${fmtDate(e.createdAt).time}`.trim(); break;
          case "status":      row["Status"]      = e.status ?? null; break;
        }
      });
      return row;
    }));
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Special Enquiry</h2>
        <p className="text-[13px] text-slate-500 mt-0.5">All special enquiries submitted via the website</p>
      </div>

      {/* Stat card */}
      <div className="inline-flex">
        <div className="bg-white rounded-2xl border border-slate-200 px-[18px] py-4 flex items-center gap-3.5">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-slate-100 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            {loading
              ? <Skeleton className="h-[22px] w-10 mb-1.5" />
              : <p className="text-[22px] font-extrabold text-slate-900 leading-none">{total}</p>
            }
            <p className="text-[11.5px] text-slate-500 mt-0.5">Total Enquiries</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-3.5 py-3 flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold">{error}</span>
          <button
            onClick={() => setRefreshTick(v => v + 1)}
            className="border border-red-300 bg-white text-red-700 rounded-[10px] px-3 py-1.5 text-[12.5px] font-bold cursor-pointer hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2.5">
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by name, email, phone, or company…"
        />
        <ColumnsPopover
          tableKey="specialBookingEnquiries"
          visible={colPrefs.columns}
          totalCount={colPrefs.totalCount}
          onToggle={colPrefs.toggle}
          onReset={colPrefs.reset}
          onSelectAll={() => colPrefs.setColumns(tableSpec.columns.map(c => c.key))}
        />
        <div className="ml-auto">
          <ExportButton onClick={handleExport} disabled={filtered.length === 0} label="Export XLSX" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">
          <div style={{ minWidth }}>
            <div
              className="grid items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-[2] backdrop-blur"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {cols.map(k => {
                const col = tableSpec.columns.find(c => c.key === k);
                return (
                  <div key={k} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                    {col?.label ?? k}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="grid items-center gap-4 px-6 py-3.5 bg-white" style={{ gridTemplateColumns: gridTemplate }}>
                    {cols.map(k => <Skeleton key={k} className="h-3.5 w-24" />)}
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-[13px]">
                  {search.trim() ? "No enquiries match your search." : "No special enquiries found."}
                </div>
              ) : (
                filtered.map(row => (
                  <div
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className="grid items-center gap-4 px-6 py-3.5 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                    style={{ gridTemplateColumns: gridTemplate }}
                  >
                    {cols.map(k => (
                      <div key={k} className="min-w-0">
                        <EnquiryCell row={row} colKey={k} />
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <WebsiteGeneralEnquiryDetailSidebar
        key={selected?.id ?? "special-enquiry-closed"}
        enquiry={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

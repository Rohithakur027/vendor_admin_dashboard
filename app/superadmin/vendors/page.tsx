"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { vendorsApi, type CreateVendorPayload } from "@/lib/api";
import type { Vendor } from "@/lib/mock-data";
import {
  Plus, X, RefreshCw,
  Eye, EyeOff, Wallet, Check, Loader2, AlertCircle, CheckCircle2,
  ChevronRight, ChevronLeft, Upload, FileText,
} from "lucide-react";
import { FilterPanel, FilterSection, FilterPill, FilterTrigger } from "@/components/FilterPanel";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/SearchBar";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Skeleton, SkeletonInline } from "@/components/ui/skeleton";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { ExportButton } from "@/components/ExportButton";
import { exportToCsv } from "@/lib/exportCsv";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";

type StatusFilter = "All" | "Active" | "Inactive";
type VendorTab = "verified" | "unverified";

function fmtJoined(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return phone;
}

// ── Field helper ──────────────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-semibold text-slate-600">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-red-500 font-medium">{error}</p>}
    </div>
  );
}

export default function SuperAdminVendorsPage() {
  const router = useRouter();
  const TABLE_KEY = "vendors" as const;
  const { columns: visibleCols, toggle: toggleCol, reset: resetCols, totalCount: colTotal } = useColumnPreferences(TABLE_KEY);
  const spec = getTableSpec(TABLE_KEY);

  const gridTemplate = useMemo(
    () => visibleCols.map(k => { const c = spec.columns.find(x => x.key === k); return c ? `minmax(${c.minWidth}px,1fr)` : "1fr"; }).join(" "),
    [visibleCols, spec.columns],
  );
  const minTableWidth = useMemo(
    () => visibleCols.reduce((s, k) => s + (spec.columns.find(x => x.key === k)?.minWidth ?? 100), 0) + 48,
    [visibleCols, spec.columns],
  );

  const [vendors,     setVendors]     = useState<Vendor[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError,   setListError]   = useState("");
  const [search,      setSearch]      = useState("");
  const [statusFilter,setStatusFilter]= useState<StatusFilter>("All");
  const [vendorTab,   setVendorTab]   = useState<VendorTab>("verified");
  const [drawerOpen,   setDrawerOpen]  = useState(false);
  const [step,         setStep]        = useState<1 | 2 | 3>(1);
  const [filterOpen,   setFilterOpen]  = useState(false);

  // Step 1 fields
  const [form, setForm] = useState({ name: "", contactPerson: "", email: "", phone: "", city: "", address: "" });
  const [pocs, setPocs] = useState<{ name: string; email: string; phone: string }[]>([]);
  const [errors, setErrors] = useState<Partial<typeof form>>({});

  // Step 2 fields
  const [password,       setPassword]       = useState("");
  const [showPassword,   setShowPassword]   = useState(false);
  const [copied,         setCopied]         = useState(false);
  const [sendEmail,      setSendEmail]      = useState(true);
  const [walletEnabled,  setWalletEnabled]  = useState(false);
  const [walletAmount,   setWalletAmount]   = useState("");
  const [passError,      setPassError]      = useState("");

  // Step 3 fields
  const [panNum,  setPanNum]  = useState("");
  const [panFile, setPanFile] = useState<File | null>(null);
  const [gstNum,  setGstNum]  = useState("");
  const [gstFile, setGstFile] = useState<File | null>(null);
  const [docErrors, setDocErrors] = useState<{ panNum?: string; gstNum?: string }>({});

  // Submit state
  const [submitting,   setSubmitting]   = useState(false);
  const [submitPhase,  setSubmitPhase]  = useState<"vendor" | "docs" | null>(null);
  const [submitError,  setSubmitError]  = useState("");
  const [submitSuccess,setSubmitSuccess]= useState(false);

  useEffect(() => {
    vendorsApi.list()
      .then((res) => {
        setVendors(res.data);
      })
      .catch((err) => {
        setListError(err instanceof Error ? err.message : "Failed to load vendors");
      })
      .finally(() => setLoadingList(false));
  }, []);

  const activeVendorFilterCount = statusFilter !== "All" ? 1 : 0;

  function handleExport() {
    const colLabelMap: Record<string, string> = Object.fromEntries(spec.columns.map(c => [c.key, c.label]));
    const rows = filtered.map(v => {
      const row: Record<string, string | number> = {};
      visibleCols.forEach(key => {
        const label = colLabelMap[key] ?? key;
        switch (key) {
          case "name":          row[label] = v.name; break;
          case "city":          row[label] = v.city ?? ""; break;
          case "email":         row[label] = v.email; break;
          case "phone":         row[label] = v.phone; break;
          case "contactPerson": row[label] = v.contactPerson; break;
          case "status":        row[label] = v.status; break;
          case "wallet":        row[label] = v.wallet_balance != null ? `₹${v.wallet_balance}` : "—"; break;
          case "pan":           row[label] = ""; break;
          case "gst":           row[label] = ""; break;
          case "address":       row[label] = (v as Vendor & { address?: string }).address ?? ""; break;
          case "createdAt":     row[label] = fmtJoined(v.joinedAt); break;
        }
      });
      return row;
    });
    exportToCsv("vendors.csv", rows);
  }

  const verifiedVendors   = vendors.filter(v => v.is_verified !== false);
  const unverifiedVendors = vendors.filter(v => v.is_verified === false);

  const sourceList = vendorTab === "verified" ? verifiedVendors : unverifiedVendors;

  const filtered = sourceList.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch = !q || v.name.toLowerCase().includes(q) || v.contactPerson.toLowerCase().includes(q) || v.city.toLowerCase().includes(q);
    return matchSearch && (statusFilter === "All" || v.status === statusFilter);
  });

  function field(key: keyof typeof form, val: string) {
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  }

  function generatePassword() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#";
    setPassword(Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""));
    setShowPassword(true);
    setCopied(false);
  }

  function handleCopy() {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function validateStep1(): boolean {
    const e: Partial<typeof form> = {};
    if (!form.name.trim())          e.name          = "Company name is required";
    if (!form.contactPerson.trim()) e.contactPerson = "Contact person is required";
    if (!form.email.trim())         e.email         = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Invalid email format";
    if (!form.phone.trim())         e.phone         = "Phone is required";
    else if (!/^\d{10}$/.test(form.phone.replace(/\s/g, ""))) e.phone = "Phone must be exactly 10 digits";
    if (!form.city.trim())          e.city          = "City is required";
    if (!form.address.trim())       e.address       = "Address is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep3(): boolean {
    const e: { panNum?: string; gstNum?: string } = {};
    if (panNum.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(panNum.trim())) {
      e.panNum = "Invalid PAN format (e.g. ABCDE1234F)";
    }
    if (gstNum.trim() && gstNum.trim().length < 10) {
      e.gstNum = "GST number seems too short";
    }
    setDocErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      if (!validateStep3()) return;
      if (!password) generatePassword();
      setStep(3);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1 || step === 2) { handleNext(); return; }

    // Step 3: validate credentials then create vendor + upload docs
    if (!password || password.length < 8) { setPassError("Password must be at least 8 characters"); return; }

    setSubmitting(true);
    setSubmitError("");
    setSubmitPhase("vendor");

    try {
      const payload: CreateVendorPayload = {
        name: form.name,
        contactPerson: form.contactPerson,
        email: form.email, phone: form.phone, city: form.city,
        ...(form.address.trim() ? { address: form.address.trim() } : {}),
        password,
        secondaryPOCs: pocs.filter((p) => p.name || p.email || p.phone),
        ...(walletEnabled && walletAmount ? { walletAmount: parseFloat(walletAmount) } : {}),
        sendCredentials: sendEmail,
      };

      const res = await vendorsApi.create(payload);
      const vendorId = res.data.id;

      // Upload documents
      setSubmitPhase("docs");
      const panN = panNum.trim().toUpperCase() || undefined;
      if (panN || panFile) {
        await vendorsApi.uploadDocument(vendorId, "PAN_CARD", panN, panFile ?? undefined);
      }
      const gstN = gstNum.trim().toUpperCase() || undefined;
      if (gstN || gstFile) {
        await vendorsApi.uploadDocument(vendorId, "GST_CERTIFICATE", gstN, gstFile ?? undefined);
      }

      setVendors((prev) => [res.data, ...prev]);
      setSubmitSuccess(true);
      setTimeout(closeModal, 1400);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to onboard vendor");
    } finally {
      setSubmitting(false);
      setSubmitPhase(null);
    }
  }

  function closeModal() {
    setDrawerOpen(false);
    setStep(1);
    setForm({ name: "", contactPerson: "", email: "", phone: "", city: "", address: "" });
    setPocs([]);
    setErrors({});
    setPassword("");
    setWalletAmount("");
    setWalletEnabled(false);
    setSendEmail(true);
    setPassError("");
    setSubmitError("");
    setSubmitSuccess(false);
    setPanNum(""); setPanFile(null);
    setGstNum(""); setGstFile(null);
    setDocErrors({});
    setSubmitPhase(null);
  }

  return (
    <div className="space-y-4">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Vendors</h2>
          <p className="text-sm text-slate-500">
            {loadingList ? (
              <SkeletonInline className="h-3 w-8" />
            ) : (
              vendors.length
            )} total vendors
          </p>
        </div>
        <Button
          disabled={loadingList}
          className="bg-blue-600 hover:bg-blue-700 gap-2 rounded-xl px-5 h-10 text-[13px] font-semibold"
          onClick={() => setDrawerOpen(true)}
        >
          <span className="flex items-center justify-center h-5 w-5 rounded-full border border-white/50 shrink-0">
            <Plus className="h-3 w-3" />
          </span>
          Onboard Vendor
        </Button>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #E2E8F0" }}>
        {([
          { key: "verified",   label: "Verified",   count: verifiedVendors.length },
          { key: "unverified", label: "Unverified", count: unverifiedVendors.length },
        ] as { key: VendorTab; label: string; count: number }[]).map(t => {
          const active = vendorTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => { setVendorTab(t.key); setSearch(""); setStatusFilter("All"); }}
              style={{
                padding: "9px 16px", fontSize: 13, fontWeight: 700,
                fontFamily: "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif",
                background: "transparent", border: "none", cursor: "pointer",
                color: active ? "#2563EB" : "#64748B",
                borderBottom: active ? "2px solid #2563EB" : "2px solid transparent",
                marginBottom: -1, display: "flex", alignItems: "center", gap: 7,
              }}
            >
              {t.label}
              {!loadingList && (
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 20,
                  background: active ? "#DBEAFE" : "#F1F5F9",
                  color: active ? "#1D4ED8" : "#94A3B8",
                }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search + Filter + Columns + Export ── */}
      <div className="flex gap-3 items-center">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name or city…"
        />

        {/* Filter button */}
        <div className="relative shrink-0">
          <FilterTrigger onClick={() => setFilterOpen(v => !v)} activeCount={activeVendorFilterCount} />
          <FilterPanel
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            activeCount={activeVendorFilterCount}
            onClearAll={() => { setStatusFilter("All"); }}
          >
            <FilterSection label="Status">
              {(["All", "Active", "Inactive"] as StatusFilter[]).map(s => (
                <FilterPill key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
              ))}
            </FilterSection>
          </FilterPanel>
        </div>

        {vendorTab === "verified" && (
          <>
            <ColumnsPopover
              tableKey={TABLE_KEY}
              visible={visibleCols}
              totalCount={colTotal}
              onToggle={toggleCol}
              onReset={resetCols}
            />
            <div className="ml-auto">
              <ExportButton onClick={handleExport} disabled={filtered.length === 0} />
            </div>
          </>
        )}
      </div>

      {listError && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />{listError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">

          {/* ── UNVERIFIED TAB — fixed layout ── */}
          {vendorTab === "unverified" && (
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_150px_minmax(0,1.4fr)_140px_110px] items-center gap-6 px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
                {["VENDOR", "EMAIL", "PHONE", "CONTACT PERSON", "REVIEW STATUS", "ACTION"].map(h => (
                  <div key={h} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</div>
                ))}
              </div>
              <div className="flex flex-col divide-y divide-slate-100">
                {loadingList ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_150px_minmax(0,1.4fr)_140px_110px] items-center gap-6 px-6 py-3.5">
                      <Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3.5 w-1/2" /><Skeleton className="h-6 w-20 rounded-full" /><Skeleton className="h-7 w-20 rounded-lg" />
                    </div>
                  ))
                ) : filtered.length === 0 ? (
                  <div className="text-center py-14 text-slate-500"><p className="text-sm font-medium">No unverified vendors.</p></div>
                ) : filtered.map(v => (
                  <div key={v.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_150px_minmax(0,1.4fr)_140px_110px] items-center gap-6 px-6 py-3.5 hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col min-w-0">
                      <span className="font-extrabold text-[#111827] text-[13px] truncate">{v.name}</span>
                    </div>
                    <span className="text-[13px] text-slate-600 font-medium truncate">{v.email}</span>
                    <span className="text-[13px] text-slate-600 font-medium">{fmtPhone(v.phone)}</span>
                    <span className="text-[13px] text-slate-600 font-medium truncate">{v.contactPerson}</span>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:"#FEF3C7", color:"#92400E", border:"1px solid #FDE68A", borderRadius:20, fontSize:11, fontWeight:700, padding:"3px 10px", whiteSpace:"nowrap", width:"fit-content" }}>
                      <span style={{ width:6, height:6, borderRadius:"50%", background:"#F59E0B", flexShrink:0 }} /> Pending
                    </span>
                    <div>
                      <button onClick={() => router.push(`/superadmin/vendors/review/${v.id}`)} style={{ fontSize:12, fontWeight:700, color:"#2563EB", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, padding:"5px 12px", cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                        Review →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── VERIFIED TAB — dynamic columns ── */}
          {vendorTab === "verified" && (
            <div className="w-fit min-w-full" style={{ minWidth: minTableWidth }}>
              {/* Header */}
              <div style={{ display:"grid", gridTemplateColumns: gridTemplate, gap:16, padding:"10px 24px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
                {visibleCols.map(key => {
                  const col = spec.columns.find(c => c.key === key);
                  return (
                    <div key={key} style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase", letterSpacing:"0.07em" }}>
                      {col?.label ?? key}
                    </div>
                  );
                })}
              </div>
              {/* Body */}
              <div className="flex flex-col divide-y divide-slate-100">
                {loadingList ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns: gridTemplate, gap:16, padding:"14px 24px" }}>
                      {visibleCols.map(k => <Skeleton key={k} className="h-3.5 w-3/4" />)}
                    </div>
                  ))
                ) : filtered.length === 0 ? (
                  <div className="text-center py-14 text-slate-500"><p className="text-sm font-medium">No vendors found.</p></div>
                ) : (
                  filtered.map(v => (
                    <div
                      key={v.id}
                      onClick={() => router.push(`/superadmin/vendors/${v.id}`)}
                      style={{ display:"grid", gridTemplateColumns: gridTemplate, gap:16, padding:"12px 24px", alignItems:"center", cursor:"pointer", transition:"background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      {visibleCols.map(key => {
                        switch (key) {
                          case "name": return (
                            <div key={key} className="flex flex-col min-w-0">
                              <span className="font-extrabold text-[#111827] text-[13px] truncate">{v.name}</span>
                            </div>
                          );
                          case "city":          return <span key={key} className="text-[13px] text-slate-600 font-medium truncate">{v.city ?? "—"}</span>;
                          case "email":         return <span key={key} className="text-[13px] text-slate-600 font-medium truncate">{v.email}</span>;
                          case "phone":         return <span key={key} className="text-[13px] text-slate-600 font-medium">{fmtPhone(v.phone)}</span>;
                          case "contactPerson": return <span key={key} className="text-[13px] text-slate-600 font-medium truncate">{v.contactPerson}</span>;
                          case "status":        return <div key={key}><StatusBadge status={v.status} size="sm" /></div>;
                          case "wallet":        return <span key={key} className="text-[13px] text-slate-700 font-semibold">{v.wallet_balance != null ? `₹${Number(v.wallet_balance).toLocaleString("en-IN")}` : "—"}</span>;
                          case "pan":           return <span key={key} className="text-[12px] text-slate-500 font-mono">—</span>;
                          case "gst":           return <span key={key} className="text-[12px] text-slate-500 font-mono">—</span>;
                          case "address":       return <span key={key} className="text-[12.5px] text-slate-500 truncate">{(v as Vendor & { address?: string }).address ?? "—"}</span>;
                          case "createdAt":     return <span key={key} className="text-[13px] text-slate-600 font-medium">{fmtJoined(v.joinedAt)}</span>;
                          default:              return <span key={key} className="text-[13px] text-slate-400">—</span>;
                        }
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Onboard Vendor Modal ── */}
      <Dialog open={drawerOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">

          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
            <DialogTitle className="text-[16px] font-bold text-slate-800">
              Onboard New Vendor
            </DialogTitle>
            <p className="text-[13px] text-slate-400 mt-0.5">
              {step === 1 ? "Fill in the company details below." : step === 2 ? "Upload KYC documents." : "Set login credentials and wallet."}
            </p>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mt-3">
              {([
                { s: 1, label: "Company Info" },
                { s: 2, label: "Documents" },
                { s: 3, label: "Credentials" },
              ] as const).map(({ s, label }, idx) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold transition-all ${
                    s < step ? "bg-blue-600 text-white" : s === step ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                  }`}>
                    {s < step ? <Check className="h-3 w-3" /> : s}
                  </div>
                  <span className={`text-[12px] font-semibold ${s === step ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
                  {idx < 2 && <div className={`h-px w-6 ${step > s ? "bg-blue-600" : "bg-slate-200"}`} />}
                </div>
              ))}
            </div>
          </DialogHeader>

          <style>{`
            .vendor-modal-scroll::-webkit-scrollbar { width: 5px; }
            .vendor-modal-scroll::-webkit-scrollbar-track { background: transparent; }
            .vendor-modal-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
            .vendor-modal-scroll::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
            .vendor-modal-scroll::-webkit-scrollbar-button { display: none; }
          `}</style>
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 vendor-modal-scroll">

              {/* ── Step 1: Company Info ── */}
              {step === 1 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Company Name" error={errors.name}>
                      <Input placeholder="e.g. Rapid Rides Pvt Ltd" value={form.name} onChange={(e) => field("name", e.target.value)} className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
                    </Field>
                    <Field label="City" error={errors.city}>
                      <Input placeholder="e.g. Bangalore" value={form.city} onChange={(e) => field("city", e.target.value)} className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Contact Person" error={errors.contactPerson}>
                      <Input placeholder="Full name" value={form.contactPerson} onChange={(e) => field("contactPerson", e.target.value)} className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
                    </Field>
                    <Field label="Phone" error={errors.phone}>
                      <Input placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={(e) => field("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
                    </Field>
                  </div>

                  <Field label="Business Email" error={errors.email}>
                    <Input type="email" placeholder="contact@company.com" value={form.email} onChange={(e) => field("email", e.target.value)} className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
                  </Field>

                  <Field label="Address" error={errors.address}>
                    <Input placeholder="e.g. 12, MG Road, Bengaluru, Karnataka 560001" value={form.address} onChange={(e) => field("address", e.target.value)} className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
                  </Field>

                  {/* Secondary POCs */}
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Secondary POCs</p>
                    {pocs.map((poc, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 relative">
                        <button type="button" onClick={() => setPocs((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute top-3 right-3 h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <p className="text-[11px] font-semibold text-slate-400">POC {i + 1}</p>
                        <Input placeholder="Full name" value={poc.name} onChange={(e) => setPocs((prev) => prev.map((p, j) => j === i ? { ...p, name: e.target.value } : p))} className="h-[34px] rounded-xl border-slate-200 text-[12px] bg-white" />
                        <Input type="email" placeholder="Email address" value={poc.email} onChange={(e) => setPocs((prev) => prev.map((p, j) => j === i ? { ...p, email: e.target.value } : p))} className="h-[34px] rounded-xl border-slate-200 text-[12px] bg-white" />
                        <Input placeholder="Phone number" value={poc.phone} onChange={(e) => setPocs((prev) => prev.map((p, j) => j === i ? { ...p, phone: e.target.value } : p))} className="h-[34px] rounded-xl border-slate-200 text-[12px] bg-white" />
                      </div>
                    ))}
                    <button type="button" onClick={() => setPocs((prev) => [...prev, { name: "", email: "", phone: "" }])}
                      className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-2.5 text-[12px] font-semibold text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/40 transition-colors">
                      <Plus className="h-3.5 w-3.5" /> Add Secondary POC
                    </button>
                  </div>
                </>
              )}

              {/* ── Step 2: Documents ── */}
              {step === 2 && (
                <div className="space-y-5">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">KYC Documents</p>

                  {/* PAN Card */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-[13px] font-semibold text-slate-700">PAN Card</span>
                      <span className="text-[11px] text-slate-400">(optional)</span>
                    </div>
                    <Field label="PAN Number" error={docErrors.panNum}>
                      <Input
                        placeholder="e.g. ABCDE1234F"
                        value={panNum}
                        onChange={(e) => { setPanNum(e.target.value.toUpperCase().slice(0, 10)); setDocErrors(p => ({ ...p, panNum: undefined })); }}
                        maxLength={10}
                        className="h-[38px] rounded-xl border-slate-200 bg-white text-[13px] font-mono tracking-widest uppercase"
                      />
                    </Field>
                    <div>
                      <Label className="text-[12px] font-semibold text-slate-600 mb-1.5 block">Upload PAN Card</Label>
                      {panFile ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <span className="text-[12px] text-blue-700 font-medium truncate flex-1">{panFile.name}</span>
                          <button type="button" onClick={() => setPanFile(null)} className="text-blue-400 hover:text-red-500 transition-colors shrink-0">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 rounded-xl py-4 px-3 cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-colors group">
                          <Upload className="h-5 w-5 text-slate-300 group-hover:text-blue-400 transition-colors" />
                          <span className="text-[12px] text-slate-400 group-hover:text-blue-500 font-medium">Click to upload PDF or image</span>
                          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPanFile(f); e.target.value = ""; }} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* GST Certificate */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span className="text-[13px] font-semibold text-slate-700">GST Registration Certificate</span>
                      <span className="text-[11px] text-slate-400">(optional)</span>
                    </div>
                    <Field label="GST Number" error={docErrors.gstNum}>
                      <Input
                        placeholder="e.g. 29ABCDE1234F1Z5"
                        value={gstNum}
                        onChange={(e) => { setGstNum(e.target.value.toUpperCase().slice(0, 15)); setDocErrors(p => ({ ...p, gstNum: undefined })); }}
                        maxLength={15}
                        className="h-[38px] rounded-xl border-slate-200 bg-white text-[13px] font-mono tracking-widest uppercase"
                      />
                    </Field>
                    <div>
                      <Label className="text-[12px] font-semibold text-slate-600 mb-1.5 block">Upload GST Certificate</Label>
                      {gstFile ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
                          <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                          <span className="text-[12px] text-blue-700 font-medium truncate flex-1">{gstFile.name}</span>
                          <button type="button" onClick={() => setGstFile(null)} className="text-blue-400 hover:text-red-500 transition-colors shrink-0">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 rounded-xl py-4 px-3 cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-colors group">
                          <Upload className="h-5 w-5 text-slate-300 group-hover:text-blue-400 transition-colors" />
                          <span className="text-[12px] text-slate-400 group-hover:text-blue-500 font-medium">Click to upload PDF or image</span>
                          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setGstFile(f); e.target.value = ""; }} />
                        </label>
                      )}
                    </div>
                  </div>

                  <p className="text-[11.5px] text-slate-400 text-center">You can skip and upload documents later from the vendor profile.</p>
                </div>
              )}

              {/* ── Step 3: Credentials & Wallet ── */}
              {step === 3 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Login Credentials</p>
                    <button type="button" onClick={generatePassword} className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                      <RefreshCw className="h-3 w-3" /> Generate
                    </button>
                  </div>

                  <Field label="Login Email">
                    <Input value={form.email} readOnly className="h-[38px] rounded-xl border-slate-200 bg-white text-[13px] text-slate-500" />
                  </Field>

                  <Field label="Password" error={passError}>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 8 characters"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setPassError(""); }}
                        className="h-[38px] rounded-xl border-slate-200 bg-white text-[13px] pr-20 font-mono tracking-wider"
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                        {password && (
                          <button type="button" onClick={handleCopy} className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-700 transition-colors">
                            {copied ? "Copied!" : "Copy"}
                          </button>
                        )}
                        <button type="button" onClick={() => setShowPassword((v) => !v)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                          {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  </Field>

                  {/* Send credentials row */}
                  <div className="flex items-center gap-2.5 pt-1">
                    <button type="button" onClick={() => setSendEmail((v) => !v)}
                      className={`h-[18px] w-[18px] shrink-0 rounded-[4px] flex items-center justify-center transition-all border ${
                        sendEmail ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-400"
                      }`}>
                      {sendEmail && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
                    </button>
                    <span className="text-[13px] text-slate-500 font-medium">Send credentials to email</span>
                  </div>

                  {/* Wallet setup */}
                  <div className="pt-1 border-t border-slate-200">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-slate-400" />
                        <span className="text-[13px] text-slate-500 font-medium">Opening wallet balance</span>
                      </div>
                      <button type="button" onClick={() => setWalletEnabled((v) => !v)}
                        className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center transition-all border ${
                          walletEnabled ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600"
                        }`}>
                        {walletEnabled ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      </button>
                    </div>
                    {walletEnabled && (
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-[13px]">₹</span>
                        <Input type="number" placeholder="0" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)}
                          className="h-[38px] rounded-xl border-slate-200 bg-white text-[13px] pl-7" min="0" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-4 border-t border-slate-100 shrink-0">
              {submitError && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[12.5px] text-red-700 font-medium">{submitError}</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  {step > 1 && (
                    <button type="button" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} disabled={submitting}
                      className="flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-800 font-medium transition-colors disabled:opacity-40">
                      <ChevronLeft className="h-4 w-4" /> Back
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={closeModal} disabled={submitting} className="rounded-xl h-9 px-5 text-[13px]">
                    Cancel
                  </Button>
                  {step < 3 ? (
                    <Button type="button" onClick={handleNext} className="rounded-xl h-9 px-5 text-[13px] bg-blue-600 hover:bg-blue-700 gap-1.5">
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <button type="submit" disabled={submitting || submitSuccess}
                      className={`inline-flex items-center gap-2 rounded-xl h-9 px-5 text-[13px] font-semibold transition-all duration-300 border-0 outline-none select-none shadow-sm
                        ${submitSuccess ? "bg-emerald-500 text-white scale-[1.02] shadow-md shadow-emerald-200 cursor-not-allowed"
                          : submitting ? "bg-blue-500 text-white cursor-not-allowed scale-[0.98]"
                          : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md hover:scale-[1.01] active:scale-[0.98]"}`}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {submitSuccess && <CheckCircle2 className="h-4 w-4" />}
                      {submitSuccess ? "Vendor Onboarded!" : submitting ? (submitPhase === "docs" ? "Uploading docs…" : "Creating…") : "Onboard Vendor"}
                    </button>
                  )}
                </div>
              </div>

              {submitting && (
                <p className="text-[11px] text-blue-500 font-medium text-right mt-2 animate-pulse">
                  {submitPhase === "docs" ? "Uploading documents to Cloudinary…" : "Creating account & sending credentials…"}
                </p>
              )}
              {submitSuccess && (
                <p className="text-[11px] text-emerald-600 font-semibold text-right mt-2">
                  ✓ Vendor onboarded successfully!
                </p>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

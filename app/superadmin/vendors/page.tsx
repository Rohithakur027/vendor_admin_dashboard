"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { vendorsApi, type CreateVendorPayload } from "@/lib/api";
import type { Vendor } from "@/lib/mock-data";
import {
  Building2, Plus, Search, CheckCircle2, XCircle, X, RefreshCw,
  Eye, EyeOff, Wallet, Check, Loader2, AlertCircle,
  ChevronRight, ChevronLeft, Info,
} from "lucide-react";
import { TbFilter } from "react-icons/tb";
import { FilterPanel, FilterSection, FilterPill } from "@/components/FilterPanel";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type StatusFilter = "All" | "Active" | "Inactive";

function VendorsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-4 flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Skeleton className="h-9 flex-1 max-w-sm rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-xl ml-auto" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.8fr)_90px_100px] items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
          {["VENDOR","CONTACT","EMAIL","STATUS","JOINED"].map((h) => (
            <Skeleton key={h} className="h-3 w-16" />
          ))}
        </div>
        <div className="flex flex-col divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_110px_90px_100px] items-center gap-4 px-6 py-4">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
  const [vendors,     setVendors]     = useState<Vendor[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError,   setListError]   = useState("");
  const [search,      setSearch]      = useState("");
  const [statusFilter,setStatusFilter]= useState<StatusFilter>("All");
  const [drawerOpen,   setDrawerOpen]  = useState(false);
  const [step,         setStep]        = useState<1 | 2>(1);
  const [filterOpen,   setFilterOpen]  = useState(false);
  const [cityFilter,   setCityFilter]  = useState("All");
  const [mockInfoVendor, setMockInfoVendor] = useState<Vendor | null>(null);

  // Step 1 fields
  const [form, setForm] = useState({ name: "", contactPerson: "", email: "", phone: "", city: "" });
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

  // Submit state
  const [submitting,   setSubmitting]   = useState(false);
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

  const uniqueCities = [...new Set(vendors.map(v => v.city).filter(Boolean))].sort();
  const activeVendorFilterCount = (statusFilter !== "All" ? 1 : 0) + (cityFilter !== "All" ? 1 : 0);

  const filtered = vendors.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch = !q || v.name.toLowerCase().includes(q) || v.contactPerson.toLowerCase().includes(q) || v.city.toLowerCase().includes(q);
    const matchCity   = cityFilter === "All" || v.city === cityFilter;
    return matchSearch && (statusFilter === "All" || v.status === statusFilter) && matchCity;
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
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (!validateStep1()) return;
    if (!password) generatePassword();
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) { handleNext(); return; }

    if (!password || password.length < 8) { setPassError("Password must be at least 8 characters"); return; }

    setSubmitting(true);
    setSubmitError("");

    const payload: CreateVendorPayload = {
      name: form.name, contactPerson: form.contactPerson,
      email: form.email, phone: form.phone, city: form.city,
      password,
      secondaryPOCs: pocs.filter((p) => p.name || p.email || p.phone),
      ...(walletEnabled && walletAmount ? { walletAmount: parseFloat(walletAmount) } : {}),
    };

    try {
      const res = await vendorsApi.create(payload);
      setVendors((prev) => [res.data, ...prev]);
      setSubmitSuccess(true);
      setTimeout(closeModal, 1200);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create vendor");
    } finally {
      setSubmitting(false);
    }
  }

  function closeModal() {
    setDrawerOpen(false);
    setStep(1);
    setForm({ name: "", contactPerson: "", email: "", phone: "", city: "" });
    setPocs([]);
    setErrors({});
    setPassword("");
    setWalletAmount("");
    setWalletEnabled(false);
    setSendEmail(true);
    setPassError("");
    setSubmitError("");
    setSubmitSuccess(false);
  }

  const totalActive   = vendors.filter((v) => v.status === "Active").length;
  const totalInactive = vendors.filter((v) => v.status === "Inactive").length;

  if (loadingList) return <VendorsSkeleton />;

  return (
    <div className="space-y-5">

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Vendors",    value: vendors.length, icon: Building2,    bg: "bg-slate-100" },
          { label: "Active Vendors",   value: totalActive,    icon: CheckCircle2, bg: "bg-slate-100" },
          { label: "Inactive Vendors", value: totalInactive,  icon: XCircle,      bg: "bg-slate-100" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.bg}`}>
              <s.icon className="h-4 w-4 text-slate-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>

        {/* Search */}
        <div style={{ position: "relative", flex: "0 1 380px" }}>
          <Search className="h-4 w-4" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
          <input
            placeholder="Search vendors…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9,
              border: "1.5px solid #E8EEF4", borderRadius: 10, fontSize: 13.5,
              color: "#0F172A", background: "#fff", outline: "none", boxSizing: "border-box" as const,
            }}
          />
        </div>

        {/* Filter button */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setFilterOpen(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 14px",
              border: activeVendorFilterCount > 0 ? "1.5px solid #93C5FD" : "1.5px solid #E8EEF4",
              borderRadius: 10,
              background: activeVendorFilterCount > 0 ? "#EFF6FF" : "#fff",
              color: activeVendorFilterCount > 0 ? "#1D4ED8" : "#334155",
              fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              letterSpacing: "0.04em", transition: "all 0.15s",
            }}
          >
            <TbFilter style={{ width: 15, height: 15 }} />
            FILTER
            {activeVendorFilterCount > 0 && (
              <span style={{
                background: "#2563EB", color: "#fff", fontSize: 9, fontWeight: 800,
                borderRadius: "50%", width: 15, height: 15,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                {activeVendorFilterCount}
              </span>
            )}
          </button>
          <FilterPanel
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            activeCount={activeVendorFilterCount}
            onClearAll={() => { setStatusFilter("All"); setCityFilter("All"); }}
          >
            <FilterSection label="Status">
              {(["All", "Active", "Inactive"] as StatusFilter[]).map(s => (
                <FilterPill key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
              ))}
            </FilterSection>
            {uniqueCities.length > 0 && (
              <FilterSection label="City">
                <FilterPill label="All Cities" active={cityFilter === "All"} onClick={() => setCityFilter("All")} />
                {uniqueCities.map(c => (
                  <FilterPill key={c} label={c} active={cityFilter === c} onClick={() => setCityFilter(c)} />
                ))}
              </FilterSection>
            )}
          </FilterPanel>
        </div>

        {/* Onboard Vendor — pushed to right */}
        <div style={{ marginLeft: "auto" }}>
          <Button className="bg-blue-600 hover:bg-blue-700 gap-1.5 rounded-xl h-10 text-[13px] font-semibold px-5"
            onClick={() => setDrawerOpen(true)}>
            <span className="flex items-center justify-center h-5 w-5 rounded-full border border-white/50 shrink-0">
              <Plus className="h-3 w-3" />
            </span>
            Onboard Vendor
          </Button>
        </div>
      </div>

      {listError && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />{listError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.8fr)_90px_100px] items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
              {["VENDOR","CONTACT","EMAIL","STATUS","JOINED"].map((h) => (
                <div key={h} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</div>
              ))}
            </div>
            <div className="flex flex-col divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <div className="text-center py-14 text-slate-400 text-sm">No vendors found.</div>
              ) : (
                filtered.map((v) => (
                  <div key={v.id} onClick={() => setMockInfoVendor(v)} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.8fr)_90px_100px] items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className="min-w-0">
                      <p className="font-extrabold text-[13px] text-[#111827] truncate">{v.name}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-700 truncate">{v.contactPerson}</p>
                      <p className="text-[11px] text-slate-400">{v.phone}</p>
                    </div>
                    <div className="text-[12px] text-slate-500 truncate min-w-0">{v.email}</div>
                    <div>
                      <StatusBadge status={v.status} size="sm" />
                    </div>
                    <div className="text-[12px] text-slate-400 font-medium">{v.joinedAt}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Mock Data Info Dialog ── */}
      <Dialog open={!!mockInfoVendor} onOpenChange={(o) => !o && setMockInfoVendor(null)}>
        <DialogContent className="sm:max-w-[400px] p-0 gap-0 rounded-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <Info className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <DialogTitle className="text-[15px] font-bold text-slate-800 leading-tight">
                  {mockInfoVendor?.name}
                </DialogTitle>
                <p className="text-[12px] text-slate-400 mt-0.5">Vendor preview</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
              <p className="text-[13px] text-amber-800 font-semibold leading-snug">
                This is a placeholder setup.
              </p>
              <p className="text-[12.5px] text-amber-700 mt-1.5 leading-relaxed">
                Full vendor details — bookings, assigned drivers, supervisors, and analytics — will be available automatically once this vendor is properly onboarded and starts using the platform.
              </p>
            </div>

            <div className="flex justify-end mt-5">
              <Button
                onClick={() => setMockInfoVendor(null)}
                className="rounded-xl h-9 px-5 text-[13px] bg-slate-900 hover:bg-slate-700"
              >
                Got it
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Onboard Vendor Modal ── */}
      <Dialog open={drawerOpen} onOpenChange={(o) => !o && closeModal()}>
        <DialogContent className="sm:max-w-[480px] p-0 gap-0 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">

          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
            <DialogTitle className="text-[16px] font-bold text-slate-800">
              Onboard New Vendor
            </DialogTitle>
            <p className="text-[13px] text-slate-400 mt-0.5">
              {step === 1 ? "Fill in the company details below." : "Set login credentials and wallet."}
            </p>

            {/* Step indicator */}
            <div className="flex items-center gap-2 mt-3">
              {[1, 2].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold transition-all ${
                    s < step ? "bg-blue-600 text-white" : s === step ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                  }`}>
                    {s < step ? <Check className="h-3 w-3" /> : s}
                  </div>
                  <span className={`text-[12px] font-semibold ${s === step ? "text-slate-700" : "text-slate-400"}`}>
                    {s === 1 ? "Company Info" : "Credentials"}
                  </span>
                  {s < 2 && <div className={`h-px w-6 ${step > s ? "bg-blue-600" : "bg-slate-200"}`} />}
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

              {/* ── Step 2: Credentials & Wallet ── */}
              {step === 2 && (
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
                      className={`h-4 w-4 shrink-0 rounded-[3px] flex items-center justify-center transition-all border ${
                        sendEmail ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-400"
                      }`}>
                      {sendEmail && <Check className="h-2.5 w-2.5" />}
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
                  {step === 2 && (
                    <button type="button" onClick={() => setStep(1)} disabled={submitting}
                      className="flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-800 font-medium transition-colors disabled:opacity-40">
                      <ChevronLeft className="h-4 w-4" /> Back
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={closeModal} disabled={submitting} className="rounded-xl h-9 px-5 text-[13px]">
                    Cancel
                  </Button>
                  {step === 1 ? (
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
                      {submitSuccess ? "Vendor Onboarded!" : submitting ? "Creating…" : "Onboard Vendor"}
                    </button>
                  )}
                </div>
              </div>

              {submitting && (
                <p className="text-[11px] text-blue-500 font-medium text-right mt-2 animate-pulse">
                  Creating account &amp; sending credentials…
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

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Clock, ScanEye, AlertCircle, Plus } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { driverOnboardingApi, type OnboardingListItem } from "@/lib/api";
import { FilterPanel, FilterSection, FilterPill, FilterTrigger } from "@/components/FilterPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

const ACCENT = "#2563EB";
const FONT   = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

type StatusFilter = "All" | "Pending" | "In Review" | "Rejected" | "Approved";

function DriverOnboardingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT }}>
      {/* Page header */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton className="h-6 w-52" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #E8EEF4", padding: "16px 18px", display: "flex", alignItems: "center", gap: 14 }}>
            <Skeleton className="h-[38px] w-[38px] shrink-0 rounded-[10px]" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Skeleton className="h-[38px] rounded-[10px]" style={{ flex: 1, maxWidth: 380 }} />
        <Skeleton className="h-[38px] w-24 rounded-[10px]" />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2.5fr)_160px_140px_150px_120px] items-center gap-6 px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
          {[160, 100, 80, 80, 60].map((w, i) => (
            <Skeleton key={i} className="h-3" style={{ width: w }} />
          ))}
        </div>
        <div className="flex flex-col divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,2.5fr)_160px_140px_150px_120px] items-center gap-6 px-6 py-3.5">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-[70px] rounded-[9px]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return phone;
}

export default function DriverOnboardingPage() {
  const router = useRouter();

  const [items,        setItems]        = useState<OnboardingListItem[]>([]);
  const [counts,       setCounts]       = useState({ pending: 0, in_review: 0, rejected: 0 });
  const [loading,      setLoading]      = useState(true);
  const [searchInput,  setSearchInput]  = useState("");
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [filterOpen,   setFilterOpen]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  // fetch list
  useEffect(() => {
    setLoading(true);
    driverOnboardingApi.list({
      limit: 100,
      ...(statusFilter !== "All" && { status: statusFilter }),
      ...(search.trim() && { search: search.trim() }),
    })
      .then(res => {
        setItems(res.data);
        setCounts({ pending: res.pending_count, in_review: res.in_review_count, rejected: res.rejected_count });
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [statusFilter, search]);

  const activeFilterCount = statusFilter !== "All" ? 1 : 0;

  if (loading) return <DriverOnboardingSkeleton />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT }}>

      {/* Page header */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>Driver Onboarding</h2>
          <button
            style={{
              display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
              padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: FONT,
              whiteSpace: "nowrap" as const,
            }}
          >
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 18, height: 18, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.5)",
            }}>
              <Plus style={{ width: 10, height: 10 }} />
            </span>
            Onboard Driver
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>Review and verify pending driver registrations</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {[
          { label: "Pending Verification", value: counts.pending,   icon: Clock },
          { label: "In Review",            value: counts.in_review, icon: ScanEye },
          { label: "Has Rejections",       value: counts.rejected,  icon: AlertCircle },
        ].map(s => (
          <div key={s.label} style={{
            background: "#fff", borderRadius: 14, border: "1.5px solid #E8EEF4",
            padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: "#F1F5F9",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <s.icon className="h-5 w-5" style={{ color: "#64748B" }} />
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 11.5, color: "#64748B", marginTop: 3 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filter + Onboard */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by name or phone…"
        />

        <div className="relative shrink-0">
          <FilterTrigger onClick={() => setFilterOpen(v => !v)} activeCount={activeFilterCount} />

          <FilterPanel
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            activeCount={activeFilterCount}
            onClearAll={() => setStatusFilter("All")}
          >
            <FilterSection label="Verification Status">
              {(["All", "Pending", "In Review", "Rejected", "Approved"] as StatusFilter[]).map(s => (
                <FilterPill key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
              ))}
            </FilterSection>
          </FilterPanel>
        </div>

      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[900px]">

            {/* Header */}
            <div className="grid grid-cols-[minmax(0,2.5fr)_160px_140px_150px_120px] items-center gap-6 px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
              {["DRIVER", "PHONE", "REGISTERED", "STATUS", "ACTION"].map(h => (
                <div key={h} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</div>
              ))}
            </div>

            {/* Body */}
            <div className="flex flex-col divide-y divide-slate-100">
              {items.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm font-medium text-slate-500">
                    {search || statusFilter !== "All" ? "No drivers match your search." : "No driver onboarding records found."}
                  </p>
                </div>
              ) : (
                items.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => router.push(`/superadmin/driver-onboarding/${d.id}`)}
                    className="grid grid-cols-[minmax(0,2.5fr)_160px_140px_150px_120px] items-center gap-6 px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {/* Driver name + doc progress */}
                    <div className="flex flex-col min-w-0">
                      <span className="font-extrabold text-[#111827] text-[13px] truncate">{d.full_name}</span>
                      <span className="text-[11px] text-slate-400 font-medium">{d.approved_docs}/{d.total_docs} docs approved</span>
                    </div>

                    {/* Phone */}
                    <span className="text-[13px] text-slate-600 font-medium">{fmtPhone(d.phone)}</span>

                    {/* Registered date */}
                    <span className="text-[13px] text-slate-600 font-medium">{fmtDate(d.created_at)}</span>

                    {/* Status */}
                    <div>
                      <StatusBadge status={d.status} size="sm" />
                    </div>

                    {/* Action */}
                    <div>
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/superadmin/driver-onboarding/${d.id}`); }}
                        className="px-4 py-2 rounded-[9px] bg-blue-600 text-white text-[12.5px] font-bold shadow-[0_2px_10px_#2563EB40] hover:opacity-85 transition-opacity"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Clock, ScanEye, AlertCircle } from "lucide-react";
import { TbFilter } from "react-icons/tb";
import { driverOnboardingApi, type OnboardingListItem } from "@/lib/api";
import { FilterPanel, FilterSection, FilterPill } from "@/components/FilterPanel";
import { getStatusStyle } from "@/components/StatusBadge";

const ACCENT = "#2563EB";
const FONT   = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

type StatusFilter = "All" | "Pending" | "In Review" | "Rejected" | "Approved";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT }}>

      {/* Page header */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>Driver Onboarding</h2>
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

      {/* Search + Filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", maxWidth: 380, flex: 1 }}>
          <Search className="h-4 w-4" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
          <input
            placeholder="Search by name or phone…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            style={{
              width: "100%", paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9,
              border: "1.5px solid #E8EEF4", borderRadius: 10, fontSize: 13.5, fontFamily: FONT,
              color: "#0F172A", background: "#fff", outline: "none",
            }}
          />
        </div>

        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setFilterOpen(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 13px",
              border: activeFilterCount > 0 ? "1.5px solid #93C5FD" : "1.5px solid #E8EEF4",
              borderRadius: 10,
              background: activeFilterCount > 0 ? "#EFF6FF" : "#fff",
              color:      activeFilterCount > 0 ? "#1D4ED8" : "#334155",
              fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
              letterSpacing: "0.04em", transition: "all 0.15s",
            }}
          >
            <TbFilter style={{ width: 15, height: 15 }} />
            FILTER
            {activeFilterCount > 0 && (
              <span style={{
                background: "#2563EB", color: "#fff", fontSize: 9, fontWeight: 800,
                borderRadius: "50%", width: 15, height: 15,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>{activeFilterCount}</span>
            )}
          </button>

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
      <div style={{ background: "#fff", border: "1.5px solid #E8EEF4", borderRadius: 16, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: "2.5fr 1.4fr 160px 150px 130px",
          gap: 0, padding: "12px 24px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9",
        }}>
          {["DRIVER", "PHONE", "REGISTERED", "STATUS", "ACTION"].map(h => (
            <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: "60px 0", textAlign: "center" as const, color: "#94A3B8", fontSize: 13 }}>
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center" as const, color: "#94A3B8", fontSize: 13 }}>
            {search || statusFilter !== "All" ? "No drivers match your search." : "No driver onboarding records found."}
          </div>
        ) : (
          items.map((d, idx) => {
            const vstyle = getStatusStyle(d.status);
            return (
              <div
                key={d.id}
                onClick={() => router.push(`/superadmin/driver-onboarding/${d.id}`)}
                style={{
                  display: "grid", gridTemplateColumns: "2.5fr 1.4fr 160px 150px 130px",
                  gap: 0, padding: "16px 24px", alignItems: "center",
                  borderBottom: idx < items.length - 1 ? "1px solid #F8FAFC" : "none",
                  transition: "background 0.12s", cursor: "pointer",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{d.full_name}</p>
                  <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{d.approved_docs}/{d.total_docs} docs approved</p>
                </div>
                <span style={{ fontSize: 13, color: "#334155" }}>{d.phone}</span>
                <span style={{ fontSize: 12.5, color: "#64748B" }}>{fmtDate(d.created_at)}</span>
                <div>
                  <span style={{
                    background: vstyle.bg, color: vstyle.text, border: `1px solid ${vstyle.border}`,
                    fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 20,
                    display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" as const,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: vstyle.dot, flexShrink: 0 }} />
                    {vstyle.label ?? d.status}
                  </span>
                </div>
                <div>
                  <button
                    onClick={e => { e.stopPropagation(); router.push(`/superadmin/driver-onboarding/${d.id}`); }}
                    style={{
                      padding: "8px 18px", borderRadius: 9, background: ACCENT, border: "none",
                      color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                      boxShadow: `0 2px 10px ${ACCENT}40`, transition: "opacity 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                  >Review</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

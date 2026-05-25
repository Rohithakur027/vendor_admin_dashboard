"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  superadminApi,
  type WebsiteBookingEnquiry,
  type WebsiteGeneralEnquiry,
} from "@/lib/api";
import { MessageSquare, Inbox, ArrowRight } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/ExportButton";
import { exportToXlsx } from "@/lib/exportXlsx";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";
import { FilterPanel, FilterPill, FilterSection, FilterTrigger } from "@/components/FilterPanel";
import {
  WebsiteBookingDetailSidebar,
  WebsiteGeneralEnquiryDetailSidebar,
} from "./BookingEnquirySidebar";

const FONT = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";
const BLUE = "#2563eb";

type Tab = "general" | "special";
type TimingFilter = "" | "instant" | "scheduled";
type CategoryFilter = "" | "airport_taxis" | "within_city" | "other";

function fmtDate(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "—", time: "" };
  try {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }),
      time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
    };
  } catch {
    return { date: "—", time: "" };
  }
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
  const value = Number(digits);
  return Number.isSafeInteger(value) ? value : digits;
}

const STATUS_PILL: Record<string, { bg: string; color: string; dot: string; border: string }> = {
  pending:         { bg: "#fefce8", color: "#854d0e", dot: "#eab308",  border: "#fef08a" },
  driver_assigned: { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6",  border: "#bfdbfe" },
  completed:       { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e",  border: "#bbf7d0" },
  cancelled:       { bg: "#fef2f2", color: "#b91c1c", dot: "#ef4444",  border: "#fecaca" },
  new:             { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6",  border: "#bfdbfe" },
  "in review":     { bg: "#fefce8", color: "#854d0e", dot: "#eab308",  border: "#fef08a" },
  resolved:        { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e",  border: "#bbf7d0" },
  closed:          { bg: "#f8fafc", color: "#475569", dot: "#94a3b8",  border: "#e2e8f0" },
};

function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? "—").toString();
  const t = STATUS_PILL[s.toLowerCase()] ?? { bg: "#f8fafc", color: "#475569", dot: "#94a3b8", border: "#e2e8f0" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, width: "fit-content",
      background: t.bg, color: t.color, border: `1px solid ${t.border}`,
      borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "3px 10px", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.dot, flexShrink: 0 }} />
      {s.replace(/_/g, " ")}
    </span>
  );
}

function RouteCell({ from, to }: { from: string; to: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {from.split(",")[0]}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 4, margin: "3px 0" }}>
        <div style={{ width: 40, height: 2, background: "linear-gradient(to right,#a5b4fc,#2563eb)", borderRadius: 2 }} />
        <ArrowRight style={{ width: 10, height: 10, color: BLUE }} />
      </div>
      <p style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {to.split(",")[0]}
      </p>
    </div>
  );
}

function PersonCell({ name, email, phone }: { name: string; email: string; phone: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{fmtPhone(phone)}</span>
    </div>
  );
}

// ── Column grid config ────────────────────────────────────────────────────────

const GENERAL_COL_CFG: Record<string, { grid: string; label: string; minPx: number }> = {
  enqRef:          { grid: "130px",           label: "BOOKING ID",       minPx: 130 },
  customer:        { grid: "minmax(0,1.6fr)", label: "CUSTOMER",         minPx: 180 },
  route:           { grid: "minmax(0,2.2fr)", label: "ROUTE",            minPx: 220 },
  type:            { grid: "150px",           label: "VEHICLE TYPE",     minPx: 150 },
  bookingCategory: { grid: "150px",           label: "BOOKING CATEGORY", minPx: 150 },
  passengers:      { grid: "110px",           label: "PASSENGERS",       minPx: 110 },
  createdAt:       { grid: "150px",           label: "CREATED AT",       minPx: 150 },
  distance:        { grid: "110px",           label: "DISTANCE",         minPx: 110 },
  scheduledAt:     { grid: "150px",           label: "SCHEDULED AT",     minPx: 150 },
  isReturnTrip:    { grid: "120px",           label: "RETURN TRIP",      minPx: 120 },
  returnAt:        { grid: "150px",           label: "RETURN DATE",      minPx: 150 },
};

const SPECIAL_COL_CFG: Record<string, { grid: string; label: string; minPx: number }> = {
  enqRef:      { grid: "130px",           label: "ENQUIRY ID", minPx: 130 },
  name:        { grid: "minmax(0,1.6fr)", label: "CUSTOMER",   minPx: 180 },
  companyName: { grid: "minmax(0,1.4fr)", label: "COMPANY",    minPx: 160 },
  message:     { grid: "minmax(0,2.2fr)", label: "MESSAGE",    minPx: 220 },
  createdAt:   { grid: "150px",           label: "CREATED AT", minPx: 150 },
  email:       { grid: "minmax(0,1.6fr)", label: "EMAIL",      minPx: 180 },
  mobile:      { grid: "130px",           label: "MOBILE",     minPx: 130 },
};

function GeneralCell({ b, colKey }: { b: WebsiteBookingEnquiry; colKey: string }) {
  switch (colKey) {
    case "enqRef":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", fontFamily: FONT }}>{b.enqRef ?? "—"}</span>
          <span style={{ fontSize: 10, fontWeight: 700, background: "#eef2ff", color: "#2563eb", padding: "2px 7px", borderRadius: 6, display: "inline-block", width: "fit-content", boxShadow: "inset 0 0 0 1px #e0e7ff" }}>
            {b.isScheduled ? "Scheduled" : "Instant"}
          </span>
        </div>
      );
    case "customer":
      return <PersonCell name={b.customerName} email={b.customerEmail ?? "—"} phone={b.customerMobile} />;
    case "route":
      return <RouteCell from={b.pickupLocation} to={b.destination} />;
    case "type":
      return <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{b.vehicleType ?? "—"}</span>;
    case "bookingCategory":
      return b.bookingCategory
        ? <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 6, background: "#e2e8f0", color: "#334155", border: "1px solid #cbd5e1", fontSize: 11, fontWeight: 700, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={b.bookingCategory}>{b.bookingCategory}</span>
        : <span style={{ fontSize: 12, color: "#94a3b8" }}>—</span>;
    case "passengers":
      return <span style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>{b.passengers}</span>;
    case "createdAt": {
      const { date, time } = fmtDate(b.createdAt);
      return <div style={{ display: "flex", flexDirection: "column", gap: 1 }}><span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>{date}</span><span style={{ fontSize: 11.5, color: "#64748b" }}>{time}</span></div>;
    }
    case "status":
      return <StatusPill status={b.status} />;
    case "distance":
      return <span style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>{b.distanceKm != null ? `${b.distanceKm} km` : "—"}</span>;
    case "scheduledAt": {
      const { date, time } = fmtDate(b.scheduledAt);
      return <div style={{ display: "flex", flexDirection: "column", gap: 1 }}><span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>{date}</span><span style={{ fontSize: 11.5, color: "#64748b" }}>{time}</span></div>;
    }
    case "returnAt": {
      const { date, time } = fmtDate(b.returnAt);
      return <div style={{ display: "flex", flexDirection: "column", gap: 1 }}><span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>{date}</span><span style={{ fontSize: 11.5, color: "#64748b" }}>{time}</span></div>;
    }
    case "isReturnTrip":
      return b.isReturnTrip
        ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "3px 10px" }}>Yes</span>
        : <span style={{ fontSize: 12, color: "#94A3B8" }}>—</span>;
    default:
      return <span>—</span>;
  }
}

function SpecialCell({ s, colKey }: { s: WebsiteGeneralEnquiry; colKey: string }) {
  switch (colKey) {
    case "enqRef":
      return <span style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", fontFamily: FONT }}>{s.enqRef ?? "—"}</span>;
    case "name":
      return <PersonCell name={s.name} email={s.email ?? "—"} phone={s.mobile} />;
    case "companyName":
      return <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={s.companyName ?? ""}>{s.companyName ?? "—"}</span>;
    case "message":
      return <span style={{ fontSize: 12.5, color: "#64748b", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }} title={s.message}>{s.message}</span>;
    case "createdAt": {
      const { date, time } = fmtDate(s.createdAt);
      return <div style={{ display: "flex", flexDirection: "column", gap: 1 }}><span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600 }}>{date}</span><span style={{ fontSize: 11.5, color: "#64748b" }}>{time}</span></div>;
    }
    case "status":
      return <StatusPill status={s.status} />;
    case "email":
      return <span style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{s.email ?? "—"}</span>;
    case "mobile":
      return <span style={{ fontSize: 12, color: "#64748b" }}>{fmtPhone(s.mobile)}</span>;
    default:
      return <span>—</span>;
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BookingEnquiriesPage() {
  const [tab, setTab] = useState<Tab>("general");

  const [general, setGeneral] = useState<WebsiteBookingEnquiry[]>([]);
  const [special, setSpecial] = useState<WebsiteGeneralEnquiry[]>([]);

  const [generalTotal, setGeneralTotal] = useState(0);
  const [specialTotal, setSpecialTotal] = useState(0);

  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [timingFilter, setTimingFilter] = useState<TimingFilter>("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("");
  const [draftTimingFilter, setDraftTimingFilter] = useState<TimingFilter>("");
  const [draftCategoryFilter, setDraftCategoryFilter] = useState<CategoryFilter>("");

  const [selectedGeneral, setSelectedGeneral] = useState<WebsiteBookingEnquiry | null>(null);
  const [selectedSpecial, setSelectedSpecial] = useState<WebsiteGeneralEnquiry | null>(null);

  const genColPrefs  = useColumnPreferences("generalBookingEnquiries");
  const specColPrefs = useColumnPreferences("specialBookingEnquiries");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const params = { limit: 100, ...(search.trim() && { search: search.trim() }) };
      try {
        if (tab === "general") {
          const res = await superadminApi.bookingEnquiries.listWebsiteBookings(params);
          if (cancelled) return;
          setGeneral(res.data);
          setGeneralTotal(res.pagination.total);
        } else {
          const res = await superadminApi.bookingEnquiries.listWebsiteEnquiries(params);
          if (cancelled) return;
          setSpecial(res.data);
          setSpecialTotal(res.pagination.total);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        if (tab === "general") {
          setGeneral([]);
          setGeneralTotal(0);
          setError(err instanceof Error ? err.message : "Failed to load website bookings.");
        } else {
          setSpecial([]);
          setSpecialTotal(0);
          setError(err instanceof Error ? err.message : "Failed to load website enquiries.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [tab, search, refreshTick]);

  const filteredGeneral = useMemo(() => {
    return general.filter((b) => {
      if (timingFilter === "instant" && b.isScheduled) return false;
      if (timingFilter === "scheduled" && !b.isScheduled) return false;

      if (categoryFilter) {
        const category = (b.bookingCategory ?? "").toLowerCase();
        if (categoryFilter === "other") {
          if (category === "airport_taxis" || category === "within_city") return false;
        } else if (category !== categoryFilter) {
          return false;
        }
      }

      return true;
    });
  }, [general, timingFilter, categoryFilter]);

  const activeFilterCount = (timingFilter ? 1 : 0) + (categoryFilter ? 1 : 0);
  const draftFilterCount = (draftTimingFilter ? 1 : 0) + (draftCategoryFilter ? 1 : 0);

  function handleExportGeneral() {
    exportToXlsx("website-bookings.xlsx", filteredGeneral.map(b => {
      const row: Record<string, string | number> = {};

      genCols.forEach((key) => {
        switch (key) {
          case "enqRef":
            row["Booking ID"] = b.enqRef ?? "";
            break;
          case "customer":
            row["Customer Name"] = b.customerName;
            row["Email"] = b.customerEmail ?? "";
            row["Phone"] = phoneExportValue(b.customerMobile);
            break;
          case "route":
            row["Pickup Address"] = b.pickupLocation;
            row["Destination Address"] = b.destination;
            break;
          case "type":
            row["Vehicle Type"] = b.vehicleType ?? "";
            break;
          case "bookingCategory":
            row["Booking Category"] = b.bookingCategory ?? "";
            break;
          case "passengers":
            row["Passengers"] = b.passengers;
            break;
          case "createdAt":
            row["Created At"] = `${fmtDate(b.createdAt).date} ${fmtDate(b.createdAt).time}`.trim();
            break;
          case "distance":
            row["Distance"] = b.distanceKm ?? "";
            break;
          case "scheduledAt":
            row["Scheduled At"] = `${fmtDate(b.scheduledAt).date} ${fmtDate(b.scheduledAt).time}`.trim();
            break;
          case "isReturnTrip":
            row["Return Trip"] = b.isReturnTrip ? "Yes" : "No";
            break;
          case "returnAt":
            row["Return Date"] = `${fmtDate(b.returnAt).date} ${fmtDate(b.returnAt).time}`.trim();
            break;
        }
      });

      return row;
    }));
  }

  function handleExportSpecial() {
    exportToXlsx("website-enquiries.xlsx", special.map(s => {
      const row: Record<string, string | number> = {};

      specCols.forEach((key) => {
        switch (key) {
          case "enqRef":
            row["Enquiry ID"] = s.enqRef ?? "";
            break;
          case "name":
            row["Customer Name"] = s.name;
            row["Email"] = s.email ?? "";
            row["Mobile"] = phoneExportValue(s.mobile);
            break;
          case "companyName":
            row["Company"] = s.companyName ?? "";
            break;
          case "message":
            row["Message"] = s.message;
            break;
          case "createdAt":
            row["Created At"] = `${fmtDate(s.createdAt).date} ${fmtDate(s.createdAt).time}`.trim();
            break;
          case "email":
            row["Email"] = s.email ?? "";
            break;
          case "mobile":
            row["Mobile"] = phoneExportValue(s.mobile);
            break;
        }
      });

      return row;
    }));
  }

  const genCols  = genColPrefs.columns;
  const specCols = specColPrefs.columns;

  const generalGridTemplate = genCols.map(k => GENERAL_COL_CFG[k]?.grid ?? "minmax(0,1fr)").join(" ");
  const specialGridTemplate = specCols.map(k => SPECIAL_COL_CFG[k]?.grid ?? "minmax(0,1fr)").join(" ");

  const generalMinWidth = Math.max(800, genCols.reduce((acc, k) => acc + (GENERAL_COL_CFG[k]?.minPx ?? 120), 0) + (genCols.length - 1) * 16);
  const specialMinWidth = Math.max(700, specCols.reduce((acc, k) => acc + (SPECIAL_COL_CFG[k]?.minPx ?? 120), 0) + (specCols.length - 1) * 16);

  const activeColPrefs = tab === "general" ? genColPrefs : specColPrefs;
  const activeTableKey = tab === "general" ? "generalBookingEnquiries" as const : "specialBookingEnquiries" as const;
  const activeSpec = getTableSpec(activeTableKey);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>Booking Enquiries</h2>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>
          Customer booking requests and general enquiries from the website
        </p>
      </div>

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1.5px solid #FECACA",
            color: "#991B1B",
            borderRadius: 12,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {error}
          </div>
          <button
            type="button"
            onClick={() => setRefreshTick(v => v + 1)}
            style={{
              border: "1px solid #FCA5A5",
              background: "#fff",
              color: "#B91C1C",
              borderRadius: 10,
              padding: "7px 12px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {[
          { label: "Website Bookings",   value: generalTotal, icon: Inbox },
          { label: "Website Enquiries",  value: specialTotal, icon: MessageSquare },
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
              {loading ? (
                <Skeleton className="h-[22px] w-10 mb-1.5" />
              ) : (
                <p style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{s.value}</p>
              )}
              <p style={{ fontSize: 11.5, color: "#64748B", marginTop: 3 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #E2E8F0" }}>
        {([
          { key: "general", label: "Booking Enquiries" },
          { key: "special", label: "Special Enquiry" },
        ] as { key: Tab; label: string }[]).map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "9px 16px", fontSize: 13, fontWeight: 700, fontFamily: FONT,
                background: "transparent", border: "none", cursor: "pointer",
                color: active ? BLUE : "#64748B",
                borderBottom: active ? `2px solid ${BLUE}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Search + Columns + Export */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder={tab === "general"
            ? "Search by customer name, email, phone, or location…"
            : "Search by name, email, or mobile…"}
        />
        {tab === "general" && (
          <div className="relative">
            <FilterTrigger
              activeCount={activeFilterCount}
              onClick={() => {
                if (!filterOpen) {
                  setDraftTimingFilter(timingFilter);
                  setDraftCategoryFilter(categoryFilter);
                }
                setFilterOpen(v => !v);
              }}
            />
            <FilterPanel
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              activeCount={draftFilterCount}
              onClearAll={() => {
                setDraftTimingFilter("");
                setDraftCategoryFilter("");
              }}
              onCancel={() => setFilterOpen(false)}
              onApply={() => {
                setTimingFilter(draftTimingFilter);
                setCategoryFilter(draftCategoryFilter);
                setFilterOpen(false);
              }}
            >
              <FilterSection label="Trip Type">
                {([
                  { value: "instant", label: "Instant" },
                  { value: "scheduled", label: "Scheduled" },
                ] as const).map(opt => (
                  <FilterPill
                    key={opt.value}
                    label={opt.label}
                    active={draftTimingFilter === opt.value}
                    onClick={() => setDraftTimingFilter(v => v === opt.value ? "" : opt.value)}
                  />
                ))}
              </FilterSection>
              <FilterSection label="Booking Category">
                {([
                  { value: "airport_taxis", label: "Airport Taxis" },
                  { value: "within_city", label: "Within City" },
                  { value: "other", label: "Other" },
                ] as const).map(opt => (
                  <FilterPill
                    key={opt.value}
                    label={opt.label}
                    active={draftCategoryFilter === opt.value}
                    onClick={() => setDraftCategoryFilter(v => v === opt.value ? "" : opt.value)}
                  />
                ))}
              </FilterSection>
            </FilterPanel>
          </div>
        )}
        <ColumnsPopover
          tableKey={activeTableKey}
          visible={activeColPrefs.columns}
          totalCount={activeColPrefs.totalCount}
          onToggle={activeColPrefs.toggle}
          onReset={activeColPrefs.reset}
          onSelectAll={() => activeColPrefs.setColumns(activeSpec.columns.map(c => c.key))}
        />
        <div style={{ marginLeft: "auto" }}>
          {tab === "general"
            ? <ExportButton onClick={handleExportGeneral} disabled={filteredGeneral.length === 0} label="Export XLSX" />
            : <ExportButton onClick={handleExportSpecial} disabled={special.length === 0} label="Export XLSX" />
          }
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">

          {/* ── WEBSITE BOOKINGS ── */}
          {tab === "general" && (
            <div style={{ minWidth: generalMinWidth }}>
              <div
                className="grid items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-[2] backdrop-blur"
                style={{ gridTemplateColumns: generalGridTemplate }}
              >
                {genCols.map(k => (
                  <div key={k} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                    {GENERAL_COL_CFG[k]?.label ?? k}
                  </div>
                ))}
              </div>
              <div className="flex flex-col divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="grid items-center gap-4 px-6 py-3.5 bg-white" style={{ gridTemplateColumns: generalGridTemplate }}>
                      {genCols.map(k => <Skeleton key={k} className="h-3.5 w-24" />)}
                    </div>
                  ))
                ) : filteredGeneral.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-[13px]">
                    {search || activeFilterCount ? "No bookings match your search or filters." : "No website booking enquiries found."}
                  </div>
                ) : (
                  filteredGeneral.map(b => (
                    <div
                      key={b.id}
                      onClick={() => setSelectedGeneral(b)}
                      className="grid items-center gap-4 px-6 py-3.5 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                      style={{ gridTemplateColumns: generalGridTemplate }}
                    >
                      {genCols.map(k => (
                        <div key={k} className="min-w-0">
                          <GeneralCell b={b} colKey={k} />
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── SPECIAL ENQUIRIES ── */}
          {tab === "special" && (
            <div style={{ minWidth: specialMinWidth }}>
              <div
                className="grid items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-[2] backdrop-blur"
                style={{ gridTemplateColumns: specialGridTemplate }}
              >
                {specCols.map(k => (
                  <div key={k} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">
                    {SPECIAL_COL_CFG[k]?.label ?? k}
                  </div>
                ))}
              </div>
              <div className="flex flex-col divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="grid items-center gap-4 px-6 py-3.5 bg-white" style={{ gridTemplateColumns: specialGridTemplate }}>
                      {specCols.map(k => <Skeleton key={k} className="h-3.5 w-24" />)}
                    </div>
                  ))
                ) : special.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-[13px]">
                    {search ? "No enquiries match your search." : "No special enquiries found."}
                  </div>
                ) : (
                  special.map(s => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSpecial(s)}
                      className="grid items-center gap-4 px-6 py-3.5 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                      style={{ gridTemplateColumns: specialGridTemplate }}
                    >
                      {specCols.map(k => (
                        <div key={k} className="min-w-0">
                          <SpecialCell s={s} colKey={k} />
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Detail sidebars */}
      <WebsiteBookingDetailSidebar
        booking={selectedGeneral}
        onClose={() => setSelectedGeneral(null)}
      />
      <WebsiteGeneralEnquiryDetailSidebar
        enquiry={selectedSpecial}
        onClose={() => setSelectedSpecial(null)}
      />
    </div>
  );
}

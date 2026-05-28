"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  superadminApi,
  type WebsiteBookingEnquiry,
  type WebsiteGeneralEnquiry,
} from "@/lib/api";
import { Inbox, ArrowRight } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/ExportButton";
import { exportToXlsx } from "@/lib/exportXlsx";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";
import { FilterPanel, FilterPill, FilterSection, FilterTrigger } from "@/components/FilterPanel";
import { WebsiteBookingDetailSidebar, NewTripSidebar } from "./BookingEnquirySidebar";

type Section = "booking" | "published" | "driver_assigned" | "active" | "completed";
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

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  try {
    return new Date(iso).toDateString() === new Date().toDateString();
  } catch {
    return false;
  }
}

const STATUS_PILL: Record<string, { bg: string; color: string; dot: string; border: string }> = {
  pending:         { bg: "#fefce8", color: "#854d0e", dot: "#eab308",  border: "#fef08a" },
  published:       { bg: "#f0f9ff", color: "#0369a1", dot: "#0ea5e9",  border: "#bae6fd" },
  driver_assigned: { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6",  border: "#bfdbfe" },
  active:          { bg: "#fefce8", color: "#92400e", dot: "#f59e0b",  border: "#fde68a" },
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
    <span
      className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-bold px-2.5 py-0.5 whitespace-nowrap"
      style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.dot, flexShrink: 0 }} />
      {s.replace(/_/g, " ")}
    </span>
  );
}

function EmptySection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white border-[1.5px] border-slate-200 rounded-[18px] px-6 py-7 min-h-[260px] flex flex-col justify-center items-center text-center gap-2">
      <div className="w-[54px] h-[54px] rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg">
        W
      </div>
      <div className="text-lg font-extrabold text-slate-900">{title}</div>
      <div className="text-[13px] text-slate-500 max-w-[360px] leading-relaxed">{description}</div>
    </div>
  );
}

function RouteCell({ from, to }: { from: string; to: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-semibold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">
        {from.split(",")[0]}
      </p>
      <div className="flex items-center gap-1 my-[3px]">
        <div style={{ width: 40, height: 2, background: "linear-gradient(to right,#a5b4fc,#2563eb)", borderRadius: 2 }} />
        <ArrowRight className="w-2.5 h-2.5 text-blue-600" />
      </div>
      <p className="text-[12px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">
        {to.split(",")[0]}
      </p>
    </div>
  );
}

function PersonCell({ name, email, phone }: { name: string; email: string; phone: string }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[13px] font-bold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">{name}</span>
      <span className="text-[11.5px] text-slate-500 font-medium overflow-hidden text-ellipsis whitespace-nowrap">{email}</span>
      <span className="text-[11px] text-slate-400 font-medium">{fmtPhone(phone)}</span>
    </div>
  );
}

// ── Column grid config ────────────────────────────────────────────────────────

const GENERAL_COL_CFG: Record<string, { grid: string; label: string; minPx: number }> = {
  enqRef:          { grid: "130px",           label: "BOOKING ID",       minPx: 130 },
  status:          { grid: "120px",           label: "STATUS",           minPx: 120 },
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
  const isNewQuery = isToday(b.createdAt) && ["new", "pending"].includes((b.status ?? "").toLowerCase());

  switch (colKey) {
    case "enqRef":
      return (
        <div className="flex flex-col gap-[3px]">
          <div className="flex items-center gap-2 min-w-0">
            {isNewQuery && (
              <span
                title="New today"
                className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"
                style={{ boxShadow: "0 0 0 4px rgba(239,68,68,0.14)" }}
              />
            )}
            <span className="text-[13px] font-extrabold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">
              {b.enqRef ?? "—"}
            </span>
          </div>
          <span className="text-[10px] font-bold bg-[#eef2ff] text-blue-600 px-[7px] py-[2px] rounded-[6px] inline-block w-fit" style={{ boxShadow: "inset 0 0 0 1px #e0e7ff" }}>
            {b.isScheduled ? "Scheduled" : "Instant"}
          </span>
        </div>
      );
    case "customer":
      return <PersonCell name={b.customerName} email={b.customerEmail ?? "—"} phone={b.customerMobile} />;
    case "route":
      return <RouteCell from={b.pickupLocation} to={b.destination} />;
    case "type":
      return <span className="text-[13px] font-semibold text-slate-900">{b.vehicleType ?? "—"}</span>;
    case "bookingCategory":
      return b.bookingCategory
        ? <span className="inline-flex items-center px-2 py-[2px] rounded-[6px] bg-slate-200 text-slate-700 border border-[#cbd5e1] text-[11px] font-bold max-w-[130px] overflow-hidden text-ellipsis whitespace-nowrap" title={b.bookingCategory}>{b.bookingCategory}</span>
        : <span className="text-[12px] text-slate-400">—</span>;
    case "passengers":
      return <span className="text-[13px] text-slate-700 font-semibold">{b.passengers}</span>;
    case "createdAt": {
      const { date, time } = fmtDate(b.createdAt);
      return <div className="flex flex-col gap-[1px]"><span className="text-[13px] text-slate-900 font-semibold">{date}</span><span className="text-[11.5px] text-slate-500">{time}</span></div>;
    }
    case "status":
      return <StatusPill status={b.websiteBookingStatus ?? "pending"} />;
    case "distance":
      return <span className="text-[13px] text-slate-700 font-semibold">{b.distanceKm != null ? `${b.distanceKm} km` : "—"}</span>;
    case "scheduledAt": {
      const { date, time } = fmtDate(b.scheduledAt);
      return <div className="flex flex-col gap-[1px]"><span className="text-[13px] text-slate-900 font-semibold">{date}</span><span className="text-[11.5px] text-slate-500">{time}</span></div>;
    }
    case "returnAt": {
      const { date, time } = fmtDate(b.returnAt);
      return <div className="flex flex-col gap-[1px]"><span className="text-[13px] text-slate-900 font-semibold">{date}</span><span className="text-[11.5px] text-slate-500">{time}</span></div>;
    }
    case "isReturnTrip":
      return b.isReturnTrip
        ? <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-[#BFDBFE] rounded-full text-[11px] font-bold px-2.5 py-[3px]">Yes</span>
        : <span className="text-[12px] text-slate-400">—</span>;
    default:
      return <span>—</span>;
  }
}

function SpecialCell({ s, colKey }: { s: WebsiteGeneralEnquiry; colKey: string }) {
  switch (colKey) {
    case "enqRef":
      return <span className="text-[13px] font-extrabold text-slate-900">{s.enqRef ?? "—"}</span>;
    case "name":
      return <PersonCell name={s.name} email={s.email ?? "—"} phone={s.mobile} />;
    case "companyName":
      return <span className="text-[13px] text-slate-900 font-semibold overflow-hidden text-ellipsis whitespace-nowrap block" title={s.companyName ?? ""}>{s.companyName ?? "—"}</span>;
    case "message":
      return <span className="text-[12.5px] text-slate-500 overflow-hidden" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }} title={s.message}>{s.message}</span>;
    case "createdAt": {
      const { date, time } = fmtDate(s.createdAt);
      return <div className="flex flex-col gap-[1px]"><span className="text-[13px] text-slate-900 font-semibold">{date}</span><span className="text-[11.5px] text-slate-500">{time}</span></div>;
    }
    case "status":
      return <StatusPill status={s.status} />;
    case "email":
      return <span className="text-[12px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap block">{s.email ?? "—"}</span>;
    case "mobile":
      return <span className="text-[12px] text-slate-500">{fmtPhone(s.mobile)}</span>;
    default:
      return <span>—</span>;
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BookingEnquiriesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get("section");
  const VALID_SECTIONS: Section[] = ["booking", "published", "driver_assigned", "active", "completed"];
  const section: Section = VALID_SECTIONS.includes(sectionParam as Section) ? (sectionParam as Section) : "booking";

  const [general, setGeneral] = useState<WebsiteBookingEnquiry[]>([]);
  const [generalTotal, setGeneralTotal] = useState(0);

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
  const [newTripOpen, setNewTripOpen] = useState(false);

  const genColPrefs = useColumnPreferences("generalBookingEnquiries");

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
        const res = section === "booking"
          ? await superadminApi.bookingEnquiries.listEnquiries(params)
          : await superadminApi.bookingEnquiries.listWebsiteBookings(params);
        if (cancelled) return;
        setGeneral(res.data);
        setGeneralTotal(res.pagination.total);
      } catch (err: unknown) {
        if (cancelled) return;
        setGeneral([]);
        setGeneralTotal(0);
        setError(err instanceof Error ? err.message : "Failed to load bookings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [section, search, refreshTick]);

  const filteredGeneral = useMemo(() => {
    return general.filter((b) => {
      // "booking" tab comes from website_booking_enquiries — no status gating needed
      if (section !== "booking") {
        const wbStatus = (b.websiteBookingStatus ?? "").toLowerCase();
        if (section === "published"       && wbStatus !== "published")       return false;
        if (section === "driver_assigned" && wbStatus !== "driver_assigned") return false;
        if (section === "active"          && wbStatus !== "active")          return false;
        if (section === "completed"       && wbStatus !== "completed")       return false;
      }

      if (timingFilter === "instant"   && b.isScheduled)  return false;
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
  }, [general, section, timingFilter, categoryFilter]);

  const activeFilterCount = (timingFilter ? 1 : 0) + (categoryFilter ? 1 : 0);
  const draftFilterCount = (draftTimingFilter ? 1 : 0) + (draftCategoryFilter ? 1 : 0);

  function handleExportGeneral() {
    exportToXlsx("website-bookings.xlsx", filteredGeneral.map(b => {
      const row: Record<string, string | number | null> = {};

      genCols.forEach((key) => {
        switch (key) {
          case "enqRef":
            row["Booking ID"] = b.enqRef ?? null;
            break;
          case "customer":
            row["Customer Name"] = b.customerName;
            row["Email"] = b.customerEmail ?? null;
            row["Phone"] = phoneExportValue(b.customerMobile);
            break;
          case "route":
            row["Pickup Address"] = b.pickupLocation;
            row["Destination Address"] = b.destination;
            break;
          case "type":
            row["Vehicle Type"] = b.vehicleType ?? null;
            break;
          case "bookingCategory":
            row["Booking Category"] = b.bookingCategory ?? null;
            break;
          case "passengers":
            row["Passengers"] = b.passengers;
            break;
          case "createdAt":
            row["Created At"] = `${fmtDate(b.createdAt).date} ${fmtDate(b.createdAt).time}`.trim();
            break;
          case "distance":
            row["Distance"] = b.distanceKm ?? null;
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

  const genCols = genColPrefs.columns;

  const generalGridTemplate = genCols.map(k => GENERAL_COL_CFG[k]?.grid ?? "minmax(0,1fr)").join(" ");
  const generalMinWidth = Math.max(800, genCols.reduce((acc, k) => acc + (GENERAL_COL_CFG[k]?.minPx ?? 120), 0) + (genCols.length - 1) * 16);

  const activeColPrefs = genColPrefs;
  const activeTableKey = "generalBookingEnquiries" as const;
  const activeSpec = getTableSpec(activeTableKey);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Booking Enquiry</h2>
          <p className="text-[13px] text-slate-500 mt-[3px]">
            Manage and track all website booking enquiries by status
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNewTripOpen(true)}
          className="inline-flex items-center gap-[7px] bg-blue-600 text-white border-none rounded-[10px] px-[18px] py-[9px] text-[13.5px] font-bold cursor-pointer shadow-[0_1px_4px_rgba(37,99,235,0.18)] flex-shrink-0"
        >
          <span className="text-lg leading-none -mt-px">+</span>
          New Trip
        </button>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border-[1.5px] border-[#FECACA] text-[#991B1B] rounded-xl px-[14px] py-3 flex items-center justify-between gap-3">
          <div className="text-[13px] font-semibold">
            {error}
          </div>
          <button
            type="button"
            onClick={() => setRefreshTick(v => v + 1)}
            className="border border-[#FCA5A5] bg-white text-[#B91C1C] rounded-[10px] px-3 py-[7px] text-[12.5px] font-bold cursor-pointer flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      <div className="inline-flex">
        <div className="bg-white rounded-[14px] border-[1.5px] border-[#E8EEF4] px-[18px] py-4 flex items-center gap-[14px]">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Inbox className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            {loading ? <Skeleton className="h-[22px] w-10 mb-1.5" /> : (
              <p className="text-[22px] font-extrabold text-slate-900 leading-none">{generalTotal}</p>
            )}
            <p className="text-[11.5px] text-slate-500 mt-[3px]">Total Bookings</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {([
          { key: "booking",         label: "Booking Enquiry" },
          { key: "published",       label: "Published Trip" },
          { key: "driver_assigned", label: "Driver Assigned" },
          { key: "active",          label: "Active Trip" },
          { key: "completed",       label: "Completed Trips" },
        ] as { key: Section; label: string }[]).map(t => {
          const active = section === t.key;
          return (
            <button
              key={t.key}
              onClick={() => router.push(`/superadmin/booking-enquiries?section=${t.key}`)}
              className={[
                "px-4 py-[9px] text-[13px] font-bold bg-transparent border-none cursor-pointer -mb-px border-b-2",
                active
                  ? "text-blue-600 border-blue-600"
                  : "text-slate-500 border-transparent",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <>
      {/* Search + Columns + Export */}
      <div className="flex items-center gap-[10px]">
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by customer name, email, phone, or location…"
        />
        {section === "booking" && (
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
        <div className="ml-auto">
          <ExportButton onClick={handleExportGeneral} disabled={filteredGeneral.length === 0} label="Export XLSX" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">

          {/* ── WEBSITE BOOKINGS ── */}
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
                  {search || activeFilterCount
                    ? "No bookings match your search or filters."
                    : section === "booking"
                      ? "No website booking enquiries found."
                      : `No ${section.replace(/_/g, " ")} trips found.`}
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

        </div>
      </div>

      </>

      {/* New Trip sidebar */}
      <NewTripSidebar open={newTripOpen} onClose={() => setNewTripOpen(false)} />

      {/* Detail sidebar */}
      <WebsiteBookingDetailSidebar
        key={selectedGeneral?.id ?? "booking-detail-closed"}
        booking={selectedGeneral}
        onClose={() => setSelectedGeneral(null)}
        onAssigned={() => setRefreshTick(v => v + 1)}
      />
    </div>
  );
}

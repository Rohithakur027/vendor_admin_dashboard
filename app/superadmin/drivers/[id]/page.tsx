"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { superadminApi, driverOnboardingApi, type DriverApiItem, type DriverTripItem, type DriverTripsResponse, type OnboardingDoc, type OnboardingDetail } from "@/lib/api";
import { DriverHistoryMap } from "@/components/DriverHistoryMap";
import type { Driver, DriverStatus } from "@/modules/drivers/types";
import dynamic from "next/dynamic";
import { detectFileType } from "@/components/document-viewer/useDocumentViewer";
import {
  ArrowLeft, Phone, Car, TrendingUp, IndianRupee, User,
  ArrowRight, Clock, CheckCircle2, Calendar,
  AlertCircle, Circle, ShieldBan, Trash2, TriangleAlert,
  ChevronDown, ChevronLeft, ChevronRight, Route,
} from "lucide-react";
import { STATUS_STYLES } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchBar } from "@/components/SearchBar";
import { FilterPanel, FilterSection, FilterPill, FilterTrigger } from "@/components/FilterPanel";
import { TripDateFilter, type TripPeriod } from "@/components/TripDateFilter";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";
import { ExportButton } from "@/components/ExportButton";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";
import { exportToXlsx } from "@/lib/exportXlsx";
import { CustomDatePicker, CustomTimePicker, format12h } from "@/components/HistoryPickers";
import { DateRangePicker as SharedDateRangePicker } from "@/modules/reports/DateRangePicker";
import type { Booking } from "@/modules/bookings/types";

const TRIPS_TABLE_KEY = "driverTrips" as const;

const DocumentViewer = dynamic(
  () => import("@/components/document-viewer/DocumentViewer").then(m => ({ default: m.DocumentViewer })),
  { ssr: false }
);

// ── constants ────────────────────────────────────────────────────────────────
const ACCENT = "#2563EB";
const CARD_STYLE: React.CSSProperties = {
  background: "#fff",
  border: "1.5px solid #E8EEF4",
  borderRadius: 16,
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};


// ── helpers ──────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
  );
}

function shortAddr(addr: string): string {
  const parts = addr.split(",").map(p => p.trim()).filter(Boolean);
  return parts.slice(0, 2).join(", ");
}

function fmtNullableDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function buildBasicSections(r: OnboardingDetail) {
  type Field = { label: string; value: string; raw: string; key: string };
  const fmt = (v: string | null | undefined) => v || "—";
  const sections: { title: string; fields: Field[] }[] = [
    {
      title: "PERSONAL INFORMATION",
      fields: [
        { label: "FULL NAME",       value: fmt(r.full_name),         raw: r.full_name ?? "",         key: "full_name" },
        { label: "DATE OF BIRTH",   value: fmtNullableDate(r.date_of_birth), raw: r.date_of_birth ?? "",     key: "date_of_birth" },
        { label: "GENDER",          value: fmt(r.gender),            raw: r.gender ?? "",            key: "gender" },
        { label: "PHONE NUMBER",    value: fmt(r.phone),             raw: r.phone ?? "",             key: "phone" },
        { label: "ALTERNATE PHONE", value: fmt(r.alternate_phone),   raw: r.alternate_phone ?? "",   key: "alternate_phone" },
        { label: "EMAIL ADDRESS",   value: fmt(r.email),             raw: r.email ?? "",             key: "email" },
      ],
    },
    {
      title: "CURRENT ADDRESS",
      fields: [
        { label: "ADDRESS", value: fmt(r.current_address), raw: r.current_address ?? "", key: "current_address" },
        { label: "CITY",    value: fmt(r.city),            raw: r.city ?? "",            key: "city" },
        { label: "STATE",   value: fmt(r.state),           raw: r.state ?? "",           key: "state" },
        { label: "PINCODE", value: fmt(r.pincode),         raw: r.pincode ?? "",         key: "pincode" },
      ],
    },
    {
      title: "PERMANENT ADDRESS",
      fields: [
        { label: "ADDRESS",     value: fmt(r.permanent_address), raw: r.permanent_address ?? "", key: "permanent_address" },
        { label: "CITY",        value: fmt(r.permanent_city),    raw: r.permanent_city ?? "",    key: "permanent_city" },
        { label: "STATE",       value: fmt(r.permanent_state),   raw: r.permanent_state ?? "",   key: "permanent_state" },
        { label: "PINCODE",     value: fmt(r.permanent_pincode), raw: r.permanent_pincode ?? "", key: "permanent_pincode" },
        { label: "NATIONALITY", value: fmt(r.nationality),       raw: r.nationality ?? "",       key: "nationality" },
      ],
    },
    {
      title: "LICENSE & EMPLOYMENT",
      fields: [
        { label: "LICENSE NUMBER",      value: fmt(r.license_number),  raw: r.license_number ?? "",  key: "license_number" },
        { label: "LICENSE CLASS",       value: fmt(r.license_class),   raw: r.license_class ?? "",   key: "license_class" },
        { label: "LICENSE EXPIRY",      value: fmtNullableDate(r.license_expiry), raw: r.license_expiry ?? "", key: "license_expiry" },
        { label: "YEARS OF EXPERIENCE", value: r.years_of_experience != null ? `${r.years_of_experience} Years` : "—", raw: r.years_of_experience != null ? String(r.years_of_experience) : "", key: "years_of_experience" },
        { label: "JOINING DATE",        value: fmtNullableDate(r.joining_date), raw: r.joining_date ?? "", key: "joining_date" },
      ],
    },
    {
      title: "EMERGENCY CONTACT",
      fields: [
        { label: "CONTACT NAME",  value: fmt(r.emergency_contact_name),         raw: r.emergency_contact_name ?? "",         key: "emergency_contact_name" },
        { label: "RELATIONSHIP",  value: fmt(r.emergency_contact_relationship), raw: r.emergency_contact_relationship ?? "", key: "emergency_contact_relationship" },
        { label: "CONTACT PHONE", value: fmt(r.emergency_contact_phone),        raw: r.emergency_contact_phone ?? "",        key: "emergency_contact_phone" },
      ],
    },
  ];
  if (r.vehicle) {
    sections.push({
      title: "VEHICLE INFORMATION",
      fields: [
        { label: "REGISTRATION NUMBER", value: fmt(r.vehicle.plate_number),  raw: r.vehicle.plate_number ?? "", key: "vehicle.plate_number" },
        { label: "MODEL",               value: fmt(r.vehicle.model),         raw: r.vehicle.model ?? "",        key: "vehicle.model" },
        { label: "COLOR",               value: fmt(r.vehicle.color),         raw: r.vehicle.color ?? "",        key: "vehicle.color" },
        { label: "MAKE",                value: fmt(r.vehicle.make),          raw: r.vehicle.make ?? "",         key: "vehicle.make" },
        { label: "YEAR",                value: r.vehicle.year != null ? String(r.vehicle.year) : "—", raw: r.vehicle.year != null ? String(r.vehicle.year) : "", key: "vehicle.year" },
      ],
    });
  }
  return sections;
}

// ── API → Driver shape ────────────────────────────────────────────────────────

function apiToDriver(d: DriverApiItem): Driver {
  const rawVehicles = (d as unknown as { vehicles?: Array<{
    id?: string;
    plateNumber?: string | null;
    model?: string | null;
    color?: string | null;
    type?: string | null;
    makeYear?: number | null;
    isCurrent?: boolean | null;
    isActive?: boolean | null;
  }> }).vehicles;

  const vehicles = (rawVehicles && rawVehicles.length > 0 ? rawVehicles : (d.vehicle ? [d.vehicle] : []))
    .map((v, idx) => ({
      id: v.id ?? `v-${idx}`,
      plateNumber: v.plateNumber ?? "—",
      model: v.model ?? undefined,
      color: v.color ?? undefined,
      type: v.type ?? undefined,
      makeYear: v.makeYear ?? undefined,
      isActive: Boolean(
        (v as { isCurrent?: boolean | null }).isCurrent ??
        (v as { isActive?: boolean | null }).isActive ??
        idx === 0
      ),
    }));

  return {
    id:                     d.id,
    driverRef:              d.driverRef ?? null,
    name:                   d.name,
    phone:                  d.phone,
    email:                  d.email ?? undefined,
    dob:                    (d as unknown as { dateOfBirth?: string | null; date_of_birth?: string | null }).dateOfBirth
                              ?? (d as unknown as { date_of_birth?: string | null }).date_of_birth
                              ?? undefined,
    gender:                 (d as unknown as { gender?: string | null }).gender ?? undefined,
    vehicle:                d.vehicle?.model        ?? undefined,
    vehicleReg:             d.vehicle?.plateNumber  ?? undefined,
    vehicleColor:           d.vehicle?.color        ?? undefined,
    vehicleType:            d.vehicle?.type         ?? undefined,
    vehicleYear:            d.vehicle?.year         ?? undefined,
    vehicleMakeYear:        d.vehicle?.makeYear     ?? undefined,
    vehicleChassisNumber:   d.vehicle?.chassisNumber ?? undefined,
    vehicleEngineNumber:    d.vehicle?.engineNumber  ?? undefined,
    vehicleOwnerName:       d.vehicle?.ownerName     ?? undefined,
    vehicleAssignedAt:      d.vehicle?.assignedAt    ?? undefined,
    vehicleUpdatedAt:       d.vehicle?.updatedAt     ?? undefined,
    vehicles,
    status:                 (d.status as DriverStatus) || "Offline",
    assignedSupervisorId:   null,
    assignedSupervisorName: null,
    totalTrips:             d.totalTrips,
    lastActive:             d.lastActiveAt,
    recentTrips:            [],
  };
}


// ── calendar date picker ──────────────────────────────────────────────────────
const CAL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CAL_DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function DocDatePicker({ value, onChange, hasExpiry }: { value: string; onChange: (v: string) => void; hasExpiry: boolean }) {
  const [open, setOpen]           = useState(false);
  const [viewYear, setViewYear]   = useState(() => value ? parseInt(value.split("-")[0]) : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.split("-")[1]) - 1 : new Date().getMonth());
  const wrapRef  = useRef<HTMLDivElement>(null);
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!open) return;
    function onOut(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, [open]);

  if (!hasExpiry) return <span style={{ fontSize: 12, color: "#CBD5E1", fontStyle: "italic" }}>No expiry</span>;

  function prev() { viewMonth === 0 ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1); }
  function next() { viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0)) : setViewMonth(m => m + 1); }

  const daysInMo = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (string | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMo; d++) cells.push(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const display = value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not set";

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 7, border: open ? `1.5px solid ${ACCENT}` : "1px solid #E2E8F0", background: open ? "#EFF6FF" : "#F8FAFC", cursor: "pointer", color: value ? "#334155" : "#94A3B8", fontSize: 12.5, fontWeight: value ? 600 : 400 }}
      >
        {display}
        <ChevronRight style={{ width: 12, height: 12, transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 999, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", padding: 14, width: 240 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={prev} style={{ padding: 4, border: "none", background: "none", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", color: "#64748B" }}>
              <ChevronLeft style={{ width: 15, height: 15 }} />
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{CAL_MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={next} style={{ padding: 4, border: "none", background: "none", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", color: "#64748B" }}>
              <ChevronRight style={{ width: 15, height: 15 }} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
            {CAL_DAYS.map(d => <div key={d} style={{ textAlign: "center" as const, fontSize: 10, fontWeight: 700, color: "#94A3B8", paddingBottom: 4 }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {cells.map((dt, i) => {
              if (!dt) return <div key={i} style={{ height: 30 }} />;
              const sel = dt === value, tdy = dt === todayStr;
              return (
                <button key={dt} onClick={() => { onChange(dt); setOpen(false); }}
                  style={{ height: 30, borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: sel ? 800 : tdy ? 700 : 400, background: sel ? ACCENT : "transparent", color: sel ? "#fff" : tdy ? ACCENT : "#334155", outline: tdy && !sel ? `1.5px solid ${ACCENT}` : "none", transition: "background 0.1s" }}
                  onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "#F1F5F9"; }}
                  onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >{parseInt(dt.split("-")[2])}</button>
              );
            })}
          </div>
          {value && (
            <button onClick={() => { onChange(""); setOpen(false); }} style={{ marginTop: 10, width: "100%", padding: "6px 0", border: "1px solid #E2E8F0", borderRadius: 8, background: "#fff", color: "#94A3B8", fontSize: 11.5, cursor: "pointer" }}>Clear date</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, iconBg, iconColor }: {
  label: string; value: string | number;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div style={CARD_STYLE} className="p-5 flex items-center justify-between gap-3">
      <div>
        <p style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{label}</p>
        <p style={{ fontSize: 36, fontWeight: 800, color: "#0F172A", lineHeight: 1.1, marginTop: 4 }}>{value}</p>
      </div>
      <div style={{ background: iconBg, borderRadius: 11, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon style={{ color: iconColor }} className="h-5 w-5" />
      </div>
    </div>
  );
}

function TripStatusBadge({ status }: { status: string }) {
  const c = STATUS_STYLES[status] ?? STATUS_STYLES["Pending"];
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" as const }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

function BarChart({ days }: { days: { label: string; date: string; total: number }[] }) {
  const [mounted, setMounted] = useState(false);
  const today = new Date().toLocaleDateString("en-CA");
  const max   = Math.max(...days.map(d => d.total), 1);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ position: "relative", height: 160 }}>
        {[0, 33, 66, 100].map(pct => (
          <div key={pct} style={{ position: "absolute", bottom: `${pct}%`, left: 0, right: 0, borderTop: "1px dashed #F1F5F9" }} />
        ))}
        <div style={{ display: "flex", alignItems: "flex-end", height: "100%", gap: 8 }}>
          {days.map((day, i) => {
            const isToday = day.date === today;
            const pct     = day.total > 0 ? (day.total / max) * 100 : 0;
            return (
              <div key={day.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                {day.total > 0 && (
                  <span style={{ fontSize: 10, color: isToday ? ACCENT : "#94A3B8", fontWeight: 700, marginBottom: 4, whiteSpace: "nowrap" as const }}>
                    ₹{day.total}
                  </span>
                )}
                <div style={{
                  width: "70%", borderRadius: "6px 6px 0 0",
                  background: isToday ? ACCENT : "#BFDBFE",
                  boxShadow: isToday ? `0 4px 14px ${ACCENT}50` : "none",
                  height: mounted ? `${Math.max(pct, day.total > 0 ? 4 : 0)}%` : "0%",
                  transition: `height 0.7s cubic-bezier(0.34,1.56,0.64,1) ${i * 60}ms`,
                }} />
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {days.map(day => (
          <div key={day.date} style={{ flex: 1, textAlign: "center" as const }}>
            <span style={{ fontSize: 11, fontWeight: day.date === today ? 800 : 500, color: day.date === today ? ACCENT : "#94A3B8" }}>
              {day.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Earnings Split (donut, blue shades, hoverable) ──────────────────────────
function EarningsSplitCard({ instantTotal, scheduledTotal }: { instantTotal: number; scheduledTotal: number }) {
  const total    = instantTotal + scheduledTotal;
  const segments = [
    { label: "Instant",   value: instantTotal,   color: "#2563EB" },
    { label: "Scheduled", value: scheduledTotal, color: "#93C5FD" },
  ];
  const [hover, setHover] = useState<number | null>(null);

  const size = 168, thickness = 26;
  const r    = size / 2 - thickness / 2;
  const cx   = size / 2, cy = size / 2;
  const C    = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments.map((s, i) => {
    if (total === 0) return null;
    const dash = (s.value / total) * C;
    const arc = (
      <circle
        key={i}
        cx={cx} cy={cy} r={r}
        stroke={s.color} strokeWidth={thickness} fill="none"
        strokeDasharray={`${dash - 2} ${C - dash + 2}`}
        strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        opacity={hover !== null && hover !== i ? 0.4 : 1}
        style={{ transition: "opacity 120ms", cursor: "pointer" }}
        onMouseEnter={() => setHover(i)}
        onMouseLeave={() => setHover(null)}
      />
    );
    offset += dash;
    return arc;
  });

  const active = hover !== null ? segments[hover] : null;
  const activePct = active && total > 0 ? Math.round((active.value / total) * 100) : 0;

  return (
    <div style={{ ...CARD_STYLE, padding: "18px 22px", display: "flex", flexDirection: "column" }}>
      <div>
        <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Earnings Split</p>
        <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>Instant vs Scheduled</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 0", flex: 1 }}>
        <div style={{ position: "relative", width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
            <circle cx={cx} cy={cy} r={r} stroke="#F1F5F9" strokeWidth={thickness} fill="none" />
            {arcs}
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", pointerEvents: "none" }}>
            {active ? (
              <>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6 }}>{active.label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>₹{active.value.toLocaleString("en-IN")}</span>
                <span style={{ fontSize: 11, color: "#64748B", marginTop: 1 }}>{activePct}% of total</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6 }}>Total</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>₹{total.toLocaleString("en-IN")}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4, borderTop: "1px solid #F1F5F9", marginTop: 8 }}>
        {segments.map((s, i) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#334155" }}>{s.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>₹{s.value.toLocaleString("en-IN")}</span>
                <span style={{ fontSize: 11, color: "#94A3B8" }}>{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────
export default function SuperAdminDriverProfilePage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [driver,       setDriver]       = useState<Driver | null>(null);
  const [driverLoading,setDriverLoading]= useState(true);
  const [tripsData,    setTripsData]    = useState<DriverTripsResponse | null>(null);
  const [tripsLoading, setTripsLoading] = useState(false);
  const tripsLoadedRef = useRef(false);
  const docsLoadedRef  = useRef(false);
  const [activeTab,    setActiveTab]    = useState("overview");
  const [isBlocked,    setIsBlocked]    = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [deleteConfirm,setDeleteConfirm]= useState(false);
  const [deleteInput,  setDeleteInput]  = useState("");
  const [actionDone,   setActionDone]   = useState<"blocked" | "unblocked" | "deleted" | null>(null);
  const [expiryEdits,  setExpiryEdits]  = useState<Record<string, string>>({});
  const [docSubTab,    setDocSubTab]    = useState<"driver" | "vehicle" | "basic">("driver");
  const [onboardingRecord, setOnboardingRecord] = useState<OnboardingDetail | null>(null);
  const [basicLoading,     setBasicLoading]     = useState(false);
  const [editingSection,   setEditingSection]   = useState<string | null>(null);
  const [sectionDraft,     setSectionDraft]     = useState<Record<string, string>>({});
  const [tripsSearch,  setTripsSearch]  = useState("");
  const [hoveredTripId, setHoveredTripId] = useState<string | null>(null);
  const [filterOpen,      setFilterOpen]      = useState(false);
  const [tripStatus,      setTripStatus]      = useState("");
  const [tripType,        setTripType]        = useState("");
  const [draftTripStatus, setDraftTripStatus] = useState("");
  const [draftTripType,   setDraftTripType]   = useState("");
  const [tripPeriod,      setTripPeriod]      = useState<TripPeriod>("all");
  const [tripDateFrom,    setTripDateFrom]    = useState("");
  const [tripDateTo,      setTripDateTo]      = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [vehicleDetailsOpen, setVehicleDetailsOpen] = useState<string | false>(false);
  const { columns: visibleCols, toggle: toggleCol, reset: resetCols, totalCount: totalColCount, loading: prefsLoading } = useColumnPreferences(TRIPS_TABLE_KEY);
  const tripsSpec = getTableSpec(TRIPS_TABLE_KEY);
  const tripsColumns = useMemo(
    () => tripsSpec.columns.map((col) =>
      col.key === "vehicle" ? { ...col, label: "VEHICLE DETAILS", minWidth: Math.max(col.minWidth, 190) } : col,
    ),
    [tripsSpec.columns],
  );
  const [onboardingId, setOnboardingId] = useState<string | null>(null);
  const [onboardingDocs, setOnboardingDocs] = useState<{ driver: OnboardingDoc[]; vehicle: OnboardingDoc[] } | null>(null);
  const [docsLoading,  setDocsLoading]  = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [docError,     setDocError]     = useState<string | null>(null);
  const [viewingDoc,   setViewingDoc]   = useState<{ file_url: string; name: string; doc_type: string } | null>(null);

  // Location History date/time range
  const toDateStr = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, "0");
    const dd   = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayStr     = toDateStr(new Date());
  const yesterdayStr = toDateStr(new Date(Date.now() - 86400000));
  const last7StartStr = toDateStr(new Date(Date.now() - 6 * 86400000));
  const [earningsDateFrom, setEarningsDateFrom] = useState<string>(last7StartStr);
  const [earningsDateTo,   setEarningsDateTo]   = useState<string>(todayStr);
  const [earningsCalOpen,  setEarningsCalOpen]  = useState(false);
  const [histDate,      setHistDate]      = useState<string>(todayStr);
  const [histStartTime, setHistStartTime] = useState<string>("00:00");
  const [histEndTime,   setHistEndTime]   = useState<string>("23:59");
  const [histApplied,   setHistApplied]   = useState<{ from: string; to: string }>(() => ({
    from: `${toDateStr(new Date())}T00:00:00`,
    to:   `${toDateStr(new Date())}T23:59:59`,
  }));
  const histRange = histApplied;
  const fileInputRefs  = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!id) return;
    setDriverLoading(true);
    superadminApi.drivers.get(id)
      .then(res => setDriver(apiToDriver(res.data)))
      .catch(() => setDriver(null))
      .finally(() => setDriverLoading(false));
  }, [id]);

  useEffect(() => {
    const needsTrips = activeTab === "trips" || activeTab === "earnings";
    if (!id || !needsTrips || tripsLoadedRef.current) return;
    tripsLoadedRef.current = true;
    setTripsLoading(true);
    superadminApi.drivers.trips(id, { limit: 200 })
      .then(res => setTripsData(res.data))
      .catch(() => setTripsData(null))
      .finally(() => setTripsLoading(false));
  }, [id, activeTab]);

  useEffect(() => {
    if (!id || activeTab !== "documents" || docsLoadedRef.current) return;
    docsLoadedRef.current = true;
    setDocsLoading(true);
    superadminApi.drivers.onboardingDocs(id)
      .then(res => {
        setOnboardingId(res.data.onboardingId);
        setOnboardingDocs(res.data.documents);
      })
      .catch(() => { setOnboardingId(null); setOnboardingDocs(null); })
      .finally(() => setDocsLoading(false));
  }, [id, activeTab]);

  useEffect(() => {
    if (!onboardingId || docSubTab !== "basic" || onboardingRecord) return;
    setBasicLoading(true);
    driverOnboardingApi.get(onboardingId)
      .then(res => setOnboardingRecord(res.data))
      .catch(() => setOnboardingRecord(null))
      .finally(() => setBasicLoading(false));
  }, [onboardingId, docSubTab, onboardingRecord]);

  // ── All useMemo hooks must come before early returns (Rules of Hooks) ────────
  const activeFilterCount = (tripStatus ? 1 : 0) + (tripType ? 1 : 0);

  const filteredTrips = useMemo(() => {
    const allTrips = tripsData?.trips ?? [];
    const q = tripsSearch.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return allTrips.filter(b => {
      if (tripStatus && b.status !== tripStatus) return false;
      if (tripType   && b.type   !== tripType)   return false;
      if (tripPeriod === "custom") {
        const d = b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-CA") : "";
        if (!d || d < tripDateFrom || d > tripDateTo) return false;
      } else if (tripPeriod !== "all") {
        const d = new Date(b.createdAt);
        if (tripPeriod === "today"  && d < startOfToday) return false;
        if (tripPeriod === "7days"  && d < new Date(now.getTime() - 7  * 86400_000)) return false;
        if (tripPeriod === "30days" && d < new Date(now.getTime() - 30 * 86400_000)) return false;
      }
      if (!q) return true;
      const ref = (b.tripRef ?? b.id).toLowerCase();
      return (
        ref.includes(q) ||
        b.pickupLocation.toLowerCase().includes(q) ||
        b.dropLocation.toLowerCase().includes(q) ||
        (b.supervisorName ?? "").toLowerCase().includes(q) ||
        (b.vendorName     ?? "").toLowerCase().includes(q) ||
        (b.type           ?? "").toLowerCase().includes(q) ||
        (b.status         ?? "").toLowerCase().includes(q)
      );
    });
  }, [tripsData, tripsSearch, tripStatus, tripType, tripPeriod, tripDateFrom, tripDateTo]);

  function tripToBooking(b: DriverTripItem): Booking {
    const status = ((b.status ?? "Pending").trim() || "Pending") as Booking["status"];
    const type = ((b.type ?? "Instant").trim() || "Instant") as Booking["type"];
    return {
      id: b.id,
      type,
      supervisorId: "",
      supervisorName: b.supervisorName ?? "",
      driverId: driver?.id ?? null,
      driverName: driver?.name ?? b.driverName ?? null,
      pickupLocation: b.pickupLocation,
      dropLocation: b.dropLocation,
      scheduledTime: b.scheduledAt ?? b.pickupTime,
      status,
      createdAt: b.createdAt,
      completedAt: b.completedAt,
      fare: b.fare ?? undefined,
      passengers: b.passengers ?? undefined,
      bookingSource: b.companyName ?? b.vendorName ?? undefined,
      bookingRef: b.tripRef,
      driverPhone: driver?.phone ?? null,
      pickupTime: b.pickupTime,
      pickupLat: b.pickupLat,
      pickupLng: b.pickupLng,
      dropLat: b.dropLat,
      dropLng: b.dropLng,
      stops: [],
    };
  }

  const tripRenderers = useMemo(() => {
    function fmtDate(iso: string | null | undefined) {
      if (!iso) return null;
      const d = new Date(iso);
      return {
        day:  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }),
        time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toLowerCase(),
      };
    }
    function fmtDateCSV(iso: string | null | undefined) {
      if (!iso) return "";
      return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true });
    }
    function renderDate(iso: string | null | undefined) {
      const f = fmtDate(iso);
      return f
        ? <div className="flex flex-col"><span className="text-[13px] font-medium text-slate-700">{f.day}</span><span className="text-[11px] text-slate-400 mt-0.5">{f.time}</span></div>
        : <span className="text-[13px] text-slate-300 italic">—</span>;
    }
    return {
      tripId: {
        header:   () => "TRIP ID & TYPE",
        body:     (b: DriverTripItem) => (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="font-extrabold text-[#111827] text-[13px] truncate">{b.tripRef ?? b.id}</span>
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#eef2ff] text-blue-600 text-[10px] font-bold ring-1 ring-inset ring-blue-100/50">
              {b.type ?? "—"}
            </span>
          </div>
        ),
        skeleton: () => (<div className="space-y-2"><Skeleton className="h-3.5 w-16" /><Skeleton className="h-4 w-12 rounded" /></div>),
        csv:      (b: DriverTripItem) => `${b.tripRef ?? b.id}${b.type ? ` · ${b.type}` : ""}`,
      },
      route: {
        header:   () => "ROUTE",
        body:     (b: DriverTripItem) => (
          <div className="flex flex-col min-w-0 pr-4 gap-px">
            <span className="font-semibold text-[13px] text-slate-800 leading-tight truncate">{b.pickupLocation.split(",")[0]}</span>
            <div className="flex items-center gap-1">
              <div className="w-14 h-[2px] rounded-full" style={{ background: "linear-gradient(to right, #A5B4FC, #2563EB)" }} />
              <ArrowRight className="h-3 w-3 text-blue-600 shrink-0" />
            </div>
            <span className="text-[12px] text-gray-500 truncate">{b.dropLocation.split(",")[0]}</span>
          </div>
        ),
        skeleton: () => (<div className="space-y-1.5 pr-4"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-2/3" /></div>),
        csv:      (b: DriverTripItem) => `${b.pickupLocation} → ${b.dropLocation}`,
      },
      supervisorCompany: {
        header:   () => "SUPERVISOR & COMPANY",
        body:     (b: DriverTripItem) => (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="text-[13px] font-medium text-slate-600 truncate">{b.supervisorName ?? "—"}</span>
            {b.companyName
              ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-semibold truncate max-w-[130px]">{b.companyName}</span>
              : <span className="text-[11px] text-slate-300 italic">—</span>}
          </div>
        ),
        skeleton: () => (<div className="space-y-1.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3 w-20" /></div>),
        csv:      (b: DriverTripItem) => `${b.supervisorName ?? ""}${b.companyName ? ` · ${b.companyName}` : ""}`,
      },
      vehicle: {
        header:   () => "VEHICLE DETAILS",
        body:     () => (
          <div className="flex flex-col min-w-0 gap-0.5">
            <span className="text-[13px] font-semibold text-slate-800 leading-tight truncate">
              {driver?.vehicleReg ?? "—"}
            </span>
            <span className="text-[12px] font-medium text-slate-600 leading-tight truncate">
              {driver?.vehicle ?? "—"}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide leading-tight truncate">
              {driver?.vehicleType ?? "—"}
            </span>
          </div>
        ),
        skeleton: () => (
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-12" />
          </div>
        ),
        csv:      () => "",
      },
      driver: {
        header:   () => "DRIVER",
        body:     (b: DriverTripItem) => b.driverName
          ? <span className="text-[13px] font-medium text-slate-600 truncate block">{b.driverName}</span>
          : <span className="text-[13px] text-slate-300 italic">—</span>,
        skeleton: () => <Skeleton className="h-3.5 w-24" />,
        csv:      (b: DriverTripItem) => b.driverName ?? "",
      },
      fare: {
        header:   () => "FARE",
        body:     (b: DriverTripItem) => b.fare != null
          ? <span className="text-[13px] font-bold text-slate-800 tabular-nums">₹{Number(b.fare).toLocaleString("en-IN")}</span>
          : <span className="text-[13px] text-slate-300 italic">—</span>,
        skeleton: () => <Skeleton className="h-3.5 w-16" />,
        csv:      (b: DriverTripItem) => b.fare ?? "",
      },
      status: {
        header:   () => "STATUS",
        body:     (b: DriverTripItem) => <TripStatusBadge status={b.status ?? "Pending"} />,
        skeleton: () => <Skeleton className="h-6 w-20 rounded-full" />,
        csv:      (b: DriverTripItem) => b.status ?? "",
      },
      pickupTime: {
        header:   () => "PICKUP TIME",
        body:     (b: DriverTripItem) => renderDate(b.pickupTime),
        skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
        csv:      (b: DriverTripItem) => fmtDateCSV(b.pickupTime),
      },
      scheduledAt: {
        header:   () => "SCHEDULED AT",
        body:     (b: DriverTripItem) => renderDate(b.scheduledAt),
        skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
        csv:      (b: DriverTripItem) => fmtDateCSV(b.scheduledAt),
      },
      createdAt: {
        header:   () => "CREATED AT",
        body:     (b: DriverTripItem) => renderDate(b.createdAt),
        skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
        csv:      (b: DriverTripItem) => fmtDateCSV(b.createdAt),
      },
      completedAt: {
        header:   () => "COMPLETED AT",
        body:     (b: DriverTripItem) => renderDate(b.completedAt),
        skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
        csv:      (b: DriverTripItem) => fmtDateCSV(b.completedAt),
      },
      startedAt: {
        header:   () => "STARTED AT",
        body:     (b: DriverTripItem) => renderDate(b.startedAt),
        skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
        csv:      (b: DriverTripItem) => fmtDateCSV(b.startedAt),
      },
      passengers: {
        header:   () => "PASSENGERS",
        body:     (b: DriverTripItem) => <span className="text-[13px] text-slate-700 tabular-nums">{b.passengers}</span>,
        skeleton: () => <Skeleton className="h-3.5 w-8" />,
        csv:      (b: DriverTripItem) => b.passengers,
      },
      distance: {
        header:   () => "DISTANCE",
        body:     (b: DriverTripItem) => b.distanceKm != null
          ? <span className="text-[13px] text-slate-700 tabular-nums">{Number(b.distanceKm).toFixed(1)} km</span>
          : <span className="text-[13px] text-slate-300 italic">—</span>,
        skeleton: () => <Skeleton className="h-3.5 w-14" />,
        csv:      (b: DriverTripItem) => b.distanceKm ?? "",
      },
      escort: {
        header:   () => "ESCORT",
        body:     (b: DriverTripItem) => {
          if (!b.escortRequired) return <span className="text-[13px] text-slate-300 italic">—</span>;
          return (
            <div className="flex flex-col gap-px min-w-0">
              <span className="text-[12px] font-semibold text-amber-700">Required</span>
              {b.escortPickup && <span className="text-[11px] text-slate-500 truncate">{b.escortPickup}</span>}
            </div>
          );
        },
        skeleton: () => <Skeleton className="h-3.5 w-16" />,
        csv:      (b: DriverTripItem) => b.escortRequired ? `Required${b.escortPickup ? ` · ${b.escortPickup}` : ""}` : "",
      },
      notes: {
        header:   () => "NOTES",
        body:     (b: DriverTripItem) => b.notes
          ? <span className="text-[12px] text-slate-600 truncate block" title={b.notes}>{b.notes}</span>
          : <span className="text-[13px] text-slate-300 italic">—</span>,
        skeleton: () => <Skeleton className="h-3.5 w-24" />,
        csv:      (b: DriverTripItem) => b.notes ?? "",
      },
      invoice: {
        header:   () => "INVOICE",
        body:     (b: DriverTripItem) => b.invoiceId
          ? <span className="text-[12px] font-mono text-slate-600 truncate block">{b.invoiceId.slice(0, 8)}</span>
          : <span className="text-[13px] text-slate-300 italic">—</span>,
        skeleton: () => <Skeleton className="h-3.5 w-16" />,
        csv:      (b: DriverTripItem) => b.invoiceId ?? "",
      },
      pickupLatLng: {
        header:   () => "PICKUP LAT/LNG",
        body:     (b: DriverTripItem) => b.pickupLat != null && b.pickupLng != null
          ? (
            <div className="flex flex-col gap-px font-mono tabular-nums">
              <span className="text-[12px] text-slate-700">{b.pickupLat.toFixed(6)}</span>
              <span className="text-[11px] text-slate-400">{b.pickupLng.toFixed(6)}</span>
            </div>
          )
          : <span className="text-[13px] text-slate-300 italic">—</span>,
        skeleton: () => (<div className="space-y-1"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /></div>),
        csv:      (b: DriverTripItem) => b.pickupLat != null && b.pickupLng != null ? `${b.pickupLat},${b.pickupLng}` : "",
      },
      dropLatLng: {
        header:   () => "DROP LAT/LNG",
        body:     (b: DriverTripItem) => b.dropLat != null && b.dropLng != null
          ? (
            <div className="flex flex-col gap-px font-mono tabular-nums">
              <span className="text-[12px] text-slate-700">{b.dropLat.toFixed(6)}</span>
              <span className="text-[11px] text-slate-400">{b.dropLng.toFixed(6)}</span>
            </div>
          )
          : <span className="text-[13px] text-slate-300 italic">—</span>,
        skeleton: () => (<div className="space-y-1"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /></div>),
        csv:      (b: DriverTripItem) => b.dropLat != null && b.dropLng != null ? `${b.dropLat},${b.dropLng}` : "",
      },
      vendor: {
        header:   () => "VENDOR",
        body:     (b: DriverTripItem) => b.vendorName
          ? <span className="text-[13px] font-medium text-slate-600 truncate block" title={b.vendorName}>{b.vendorName}</span>
          : <span className="text-[13px] text-slate-300 italic">—</span>,
        skeleton: () => <Skeleton className="h-3.5 w-24" />,
        csv:      (b: DriverTripItem) => b.vendorName ?? "",
      },
    };
  }, [driver?.vehicle, driver?.vehicleReg, driver?.vehicleType]);

  const tripsGridTemplate = useMemo(
    () => visibleCols.map(k => { const c = tripsColumns.find(x => x.key === k); return c ? `minmax(${c.minWidth}px, 1fr)` : "1fr"; }).join(" "),
    [visibleCols, tripsColumns],
  );
  const tripsMinWidth = useMemo(
    () => visibleCols.reduce((s, k) => s + (tripsColumns.find(x => x.key === k)?.minWidth ?? 100), 0) + 48,
    [visibleCols, tripsColumns],
  );
  // ─────────────────────────────────────────────────────────────────────────────

  if (driverLoading) {
    const font = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";
    return (
      <div style={{ fontFamily: font, color: "#0F172A" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <button
            onClick={() => router.back()}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1.5px solid #E8EEF4", borderRadius: 10, background: "#fff", color: "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: font }}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div style={{ width: 1, height: 28, background: "#E8EEF4" }} />
          <div>
            <p style={{ fontSize: 17, fontWeight: 800, color: "#0F172A" }}>Driver Profile</p>
            <Skeleton className="h-3 w-40 mt-1.5" />
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ borderBottom: "1.5px solid #E8EEF4", marginBottom: 20, display: "flex", gap: 6 }}>
          {["Overview", "Recent Trips", "Earnings", "Documents", "Settings"].map((label, i) => (
            <div key={label} style={{ padding: "10px 18px", fontSize: 14, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? ACCENT : "#94A3B8", borderBottom: i === 0 ? `2.5px solid ${ACCENT}` : "2.5px solid transparent", marginBottom: -1.5 }}>
              {label}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Profile card */}
          <div style={{ ...CARD_STYLE, padding: "20px 24px", display: "flex", alignItems: "center", gap: 18 }}>
            <Skeleton className="h-[60px] w-[60px] rounded-full shrink-0" />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton className="h-5 w-48" />
              <div style={{ display: "flex", gap: 16 }}>
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3.5 w-28" />
              </div>
            </div>
            <Skeleton className="h-3 w-36 shrink-0" />
          </div>

          {/* 4 stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ ...CARD_STYLE, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.7 }}>
                    {["Total Trips", "Completed", "Total Earned", "Avg per Trip"][i]}
                  </p>
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>

          {/* Earnings + side column */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ ...CARD_STYLE, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-3 w-48" />
            </div>
            <div style={{ ...CARD_STYLE, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-3.5 w-12 ml-4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p style={{ color: "#64748B" }}>Driver not found.</p>
        <button onClick={() => router.back()} style={{ fontSize: 13, color: ACCENT, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Go Back</button>
      </div>
    );
  }

  const font           = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";
  const drvInitials    = initials(driver.name);
  const statusCfg      = STATUS_STYLES[driver.status] ?? STATUS_STYLES["Offline"];
  const isOnline       = driver.status === "Available" || driver.status === "On Trip";

  const driverBookings = tripsData?.trips ?? [];
  const completedTrips = driverBookings.filter(b => b.status === "Completed");
  // "Earned" reflects fare across all trips with a fare set, not just Completed,
  // so the headline isn't ₹0 while trips are still in Pending/Ongoing states.
  const totalEarned    = tripsData?.stats.totalFare ?? 0;
  const avgEarning     = tripsData?.stats.avgFare   ?? 0;

  const localDate      = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
  const todayBookings  = driverBookings.filter(b => b.createdAt && localDate(b.createdAt) === todayStr);
  const todayEarned    = todayBookings.reduce((s, b) => s + (b.fare ?? 0), 0);
  const todayAvg       = todayBookings.length > 0 ? Math.round(todayEarned / todayBookings.length) : 0;

  const dateInRange = (iso: string | null | undefined, from: string, to: string) => {
    if (!iso) return false;
    const ds = localDate(iso);
    return ds >= from && ds <= to;
  };
  const tripEarningDate = (b: DriverTripItem) => b.completedAt ?? b.createdAt;
  const earningsTrips = driverBookings.filter(b => dateInRange(tripEarningDate(b), earningsDateFrom, earningsDateTo));
  const earningsCompletedTrips = earningsTrips.filter(b => b.status === "Completed");
  const earningsTotalEarned = earningsTrips.reduce((s, b) => s + (b.fare ?? 0), 0);
  const earningsFareTrips = earningsTrips.filter(b => b.fare != null);
  const earningsAvg = earningsFareTrips.length > 0 ? Math.round(earningsTotalEarned / earningsFareTrips.length) : 0;
  const earningsInstantTotal = earningsTrips
    .filter(b => b.type === "Instant")
    .reduce((s, b) => s + (b.fare ?? 0), 0);
  const earningsScheduledTotal = earningsTrips
    .filter(b => b.type === "Scheduled")
    .reduce((s, b) => s + (b.fare ?? 0), 0);
  const dateRangeDays = (() => {
    const days: { date: string; label: string; total: number }[] = [];
    const from = new Date(`${earningsDateFrom}T00:00:00`);
    const to   = new Date(`${earningsDateTo}T00:00:00`);
    const rangeMs = Math.max(0, to.getTime() - from.getTime());
    const dayCount = Math.floor(rangeMs / 86400000) + 1;
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const date = toDateStr(d);
      const total = earningsTrips
        .filter(b => {
          const earningDate = tripEarningDate(b);
          return !!earningDate && localDate(earningDate) === date;
        })
        .reduce((s, b) => s + (b.fare ?? 0), 0);
      days.push({
        date,
        label: dayCount <= 7
          ? d.toLocaleDateString("en-IN", { weekday: "short" })
          : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
        total,
      });
    }
    return days;
  })();
  const earningsDateLabel = `${new Date(`${earningsDateFrom}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${new Date(`${earningsDateTo}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;

  function handleTripsExport() {
    const fmtDateParts = (iso: string | null | undefined) => {
      if (!iso) return { date: "", time: "" };
      const d = new Date(iso);
      return {
        date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }),
        time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
      };
    };

    const rows = filteredTrips.map(b => {
      const out: Record<string, string | number> = {};
      for (const k of visibleCols) {
        const col = tripsColumns.find(c => c.key === k);
        if (!col) continue;
        if (k === "tripId") {
          out["Trip ID"]   = b.tripRef ?? b.id;
          out["Trip Type"] = b.type ?? "";
          continue;
        }
        if (k === "route") {
          out["Pickup Address"]      = b.pickupLocation;
          out["Destination Address"] = b.dropLocation;
          continue;
        }
        if (k === "supervisorCompany") {
          out["Supervisor"] = b.supervisorName ?? "";
          out["Company"]    = b.companyName ?? "";
          continue;
        }
        if (k === "vehicle") {
          out["Vehicle Number"] = driver?.vehicleReg ?? "";
          out["Vehicle Model"]  = driver?.vehicle ?? "";
          out["Vehicle Type"]   = driver?.vehicleType ?? "";
          continue;
        }
        if (k === "escort") {
          out["Escort Required"] = b.escortRequired ? "Yes" : "No";
          out["Escort Pickup"]   = b.escortPickup ?? "";
          continue;
        }
        if (k === "pickupLatLng") {
          out["Pickup Latitude"]  = b.pickupLat ?? "";
          out["Pickup Longitude"] = b.pickupLng ?? "";
          continue;
        }
        if (k === "dropLatLng") {
          out["Drop Latitude"]  = b.dropLat ?? "";
          out["Drop Longitude"] = b.dropLng ?? "";
          continue;
        }
        if (["pickupTime", "scheduledAt", "createdAt", "completedAt", "startedAt"].includes(k)) {
          const label = col.label.replace(/\s+At$/, "");
          const parts = fmtDateParts(b[k as "pickupTime" | "scheduledAt" | "createdAt" | "completedAt" | "startedAt"]);
          out[`${label} Date`] = parts.date;
          out[`${label} Time`] = parts.time;
          continue;
        }
        const r = (tripRenderers as Record<string, { csv: (b: DriverTripItem) => string | number }>)[k];
        out[col.label] = r ? r.csv(b) : "";
      }
      return out;
    });
    exportToXlsx(`driver-trips-${driver?.name.replace(/\s+/g, "-").toLowerCase() ?? "export"}`, rows, "Driver Trips");
  }

  const TABS = [
    { value: "overview",  label: "Overview" },
    { value: "trips",     label: "Trips" },
    { value: "earnings",  label: "Earnings" },
    { value: "history",   label: "Location History" },
    { value: "documents", label: "Documents" },
    { value: "settings",  label: "Settings" },
  ];

  return (
    <div style={{ fontFamily: font, color: "#0F172A" }}>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <button
          onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1.5px solid #E8EEF4", borderRadius: 10, background: "#fff", color: "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: font }}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div style={{ width: 1, height: 28, background: "#E8EEF4" }} />
        <div>
          <p style={{ fontSize: 17, fontWeight: 800, color: "#0F172A" }}>Driver Profile</p>
          <p style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>Full details for {driver.name}</p>
        </div>
      </div>

      {/* ── Tab Bar — left-aligned underline style, matching Supervisor Profile ── */}
      <div style={{ borderBottom: "1.5px solid #E8EEF4", marginBottom: 20 }}>
        <div style={{ display: "flex" }}>
          {TABS.map(tab => {
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                style={{
                  padding: "10px 18px",
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  color: active ? ACCENT : "#64748B",
                  background: "none",
                  outline: "none",
                  border: "none",
                  borderBottom: active ? `2.5px solid ${ACCENT}` : "2.5px solid transparent",
                  marginBottom: -1.5,
                  cursor: "pointer",
                  whiteSpace: "nowrap" as const,
                  transition: "color 0.15s",
                  fontFamily: font,
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ TAB: OVERVIEW ══ */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Profile card */}
          <div style={{ ...CARD_STYLE, padding: "20px 24px", display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 800 }}>
                {drvInitials}
              </div>
              <span style={{ position: "absolute", bottom: 2, right: 2, width: 13, height: 13, borderRadius: "50%", background: isOnline ? "#22C55E" : "#94A3B8", border: "2px solid #fff" }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{driver.name}</span>
                <span style={{ background: statusCfg.bg, color: statusCfg.text, border: `1px solid ${statusCfg.border}`, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
                  {driver.status}
                </span>
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap" as const }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#334155" }}>
                  <Phone className="h-3.5 w-3.5" style={{ color: "#94A3B8" }} />+91 {driver.phone}
                </span>
                {driver.assignedSupervisorName && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#334155" }}>
                    <User className="h-3.5 w-3.5" style={{ color: "#94A3B8" }} />{driver.assignedSupervisorName}
                  </span>
                )}
              </div>
            </div>

            <p style={{ fontSize: 12, color: "#94A3B8", flexShrink: 0 }}>
              Last active {fmtDateTime(driver.lastActive)}
            </p>
          </div>

          {/* 4 stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            <StatCard label="Total Trips"   value={driver.totalTrips}                              icon={Route}        iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Today's Trips" value={todayBookings.length}                           icon={CheckCircle2} iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Total Earned"  value={`₹${totalEarned.toLocaleString("en-IN")}`}     icon={IndianRupee}  iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Today's Avg"   value={`₹${todayAvg.toLocaleString("en-IN")}`}        icon={TrendingUp}   iconBg="#F1F5F9" iconColor="#64748B" />
          </div>

          {/* Two-column layout: left = today's earnings + vehicle, right = driver info */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, alignItems: "start" }}>

            {/* Left column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Blue today's earnings card */}
              <div style={{
                background: "linear-gradient(135deg, #1e40af 0%, #2563EB 60%, #3b82f6 100%)",
                borderRadius: 18, padding: "20px 22px 18px",
                display: "flex", flexDirection: "column", gap: 10,
                position: "relative", overflow: "hidden",
              }}>
                <div style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
                <div style={{ position: "absolute", bottom: -28, right: 24, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>
                  Today&apos;s Earnings
                </p>
                <p style={{ fontSize: 34, fontWeight: 800, color: "#fff", lineHeight: 1, letterSpacing: -1 }}>
                  ₹{todayEarned.toLocaleString("en-IN")}
                </p>
              </div>

              {/* Vehicle card */}
              <div style={CARD_STYLE}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 12px" }}>
                  <div style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 9, padding: 7 }}>
                    <Car className="h-4 w-4" style={{ color: "#0F172A" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Vehicle</p>
                    <p style={{ fontSize: 11, color: "#94A3B8" }}>Assigned vehicle details</p>
                  </div>
                </div>
                {(driver.vehicles?.length || driver.vehicle || driver.vehicleReg || driver.vehicleType || driver.vehicleColor) ? (
                  <div style={{ padding: "0 18px 16px" }}>
                    {(driver.vehicles && driver.vehicles.length > 0 ? driver.vehicles : [{
                      id: "fallback",
                      plateNumber: driver.vehicleReg ?? "—",
                      model: driver.vehicle,
                      type: driver.vehicleType,
                      color: driver.vehicleColor,
                      makeYear: driver.vehicleMakeYear,
                      isActive: true,
                    }]).map((v) => {
                      const open = vehicleDetailsOpen === (v.id ?? v.plateNumber);
                      const key = v.id ?? v.plateNumber;
                      return (
                        <div key={key} style={{ marginBottom: 8 }}>
                          <button
                            type="button"
                            onClick={() => setVehicleDetailsOpen(curr => curr === key ? false : key)}
                            aria-expanded={open}
                            style={{
                              width: "100%",
                              border: "1px solid #E2E8F0",
                              borderRadius: 10,
                              background: "#F8FAFC",
                              padding: "10px 12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" as const }}>
                                Registration Number
                              </span>
                              <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", lineHeight: 1.25 }}>
                                {v.plateNumber ?? "—"}
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {v.isActive && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#166534", background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: 999, padding: "3px 8px" }}>
                                  Active
                                </span>
                              )}
                              <ChevronDown
                                className="h-4 w-4"
                                style={{
                                  color: "#64748B",
                                  transform: open ? "rotate(180deg)" : "rotate(0deg)",
                                  transition: "transform 160ms ease",
                                  flexShrink: 0,
                                }}
                              />
                            </div>
                          </button>

                          {open && (
                            <div style={{ marginTop: 8, padding: "0 6px", display: "flex", flexDirection: "column", gap: 8 }}>
                              {[
                                { label: "Type", value: v.type ?? "—" },
                                { label: "Model", value: v.model ?? "—" },
                                { label: "Make Year", value: v.makeYear != null ? String(v.makeYear) : "—" },
                                { label: "Vehicle Registration Number", value: v.plateNumber ?? "—" },
                                { label: "Color", value: v.color ?? "—" },
                              ].map(({ label, value }) => (
                                <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                  <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>{label}</span>
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A", textAlign: "right" }}>{value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: "#94A3B8", fontStyle: "italic", padding: "0 18px 16px" }}>No vehicle assigned.</p>
                )}
              </div>
            </div>

            {/* Right column: Driver Info */}
            <div style={CARD_STYLE}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 12px" }}>
                <div style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 9, padding: 7 }}>
                  <User className="h-4 w-4" style={{ color: "#0F172A" }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Driver Information</p>
                  <p style={{ fontSize: 11, color: "#94A3B8" }}>Full profile details</p>
                </div>
              </div>
              <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "Name", value: driver.name ?? "—" },
                  { label: "DOB", value: driver.dob ? fmtDate(driver.dob) : "—" },
                  { label: "Phone Number", value: driver.phone ? `+91 ${driver.phone}` : "—" },
                  { label: "Gender", value: driver.gender ?? "—" },
                  { label: "Email Address", value: driver.email ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: RECENT TRIPS ══ */}
      {activeTab === "trips" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex gap-3 items-center flex-wrap">
            <SearchBar
              value={tripsSearch}
              onChange={setTripsSearch}
              placeholder="Search by trip ID, route, supervisor, company, type, status..."
            />

            <div className="relative">
              <FilterTrigger
                onClick={() => {
                  if (!filterOpen) { setDraftTripStatus(tripStatus); setDraftTripType(tripType); }
                  setFilterOpen(v => !v);
                }}
                activeCount={activeFilterCount}
              />
              <FilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                activeCount={activeFilterCount}
                onClearAll={() => { setDraftTripStatus(""); setDraftTripType(""); }}
                onApply={() => { setTripStatus(draftTripStatus); setTripType(draftTripType); setFilterOpen(false); }}
                onCancel={() => setFilterOpen(false)}
              >
                <FilterSection label="Status">
                  {["Completed", "Ongoing", "Cancelled", "Pending"].map(s => (
                    <FilterPill key={s} label={s} active={draftTripStatus === s} onClick={() => setDraftTripStatus(p => p === s ? "" : s)} />
                  ))}
                </FilterSection>
                <FilterSection label="Trip Type">
                  {["Instant", "Scheduled"].map(t => (
                    <FilterPill key={t} label={t} active={draftTripType === t} onClick={() => setDraftTripType(p => p === t ? "" : t)} />
                  ))}
                </FilterSection>
              </FilterPanel>
            </div>

            <TripDateFilter
              period={tripPeriod}
              dateFrom={tripDateFrom}
              dateTo={tripDateTo}
              onChangePeriod={setTripPeriod}
              onApplyCustom={(from, to) => { setTripDateFrom(from); setTripDateTo(to); }}
              direction="past"
            />

            <ColumnsPopover
              tableKey={TRIPS_TABLE_KEY}
              visible={visibleCols}
              totalCount={totalColCount}
              onToggle={toggleCol}
              onReset={resetCols}
            />

            <ExportButton
              onClick={handleTripsExport}
              disabled={tripsLoading || filteredTrips.length === 0}
              label="Export XLSX"
              className="ml-auto"
            />
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="w-full overflow-x-auto">
              <div style={{ minWidth: tripsMinWidth }}>
                {/* Header */}
                <div
                  className="grid items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-[2] backdrop-blur"
                  style={{ gridTemplateColumns: tripsGridTemplate }}
                >
                  {prefsLoading
                    ? Array.from({ length: visibleCols.length }).map((_, i) => (
                        <Skeleton key={i} className={`h-3 ${i === 0 ? "w-24" : "w-16"}`} />
                      ))
                    : visibleCols.map((k, i) => {
                        const col = tripsColumns.find(c => c.key === k);
                        if (!col) return null;
                        return (
                          <div
                            key={k}
                            className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate"
                            style={i === 0 ? { position: "sticky" as const, left: 0, background: "rgb(248 250 252 / 0.95)", zIndex: 3 } : undefined}
                          >
                            {col.label}
                          </div>
                        );
                      })}
                </div>

                {/* Body */}
                <div className="flex flex-col divide-y divide-slate-100">
                  {(tripsLoading || prefsLoading) ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="grid items-center gap-4 px-6 py-3.5" style={{ gridTemplateColumns: tripsGridTemplate }}>
                        {visibleCols.map((k, j) => {
                          const r = (tripRenderers as Record<string, { skeleton: () => React.JSX.Element }>)[k];
                          return (
                            <div key={k} className="min-w-0" style={j === 0 ? { position: "sticky" as const, left: 0, background: "white", zIndex: 1 } : undefined}>
                              {r?.skeleton() ?? <Skeleton className="h-3.5 w-14" />}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  ) : filteredTrips.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-[13px]">
                      {tripsSearch.trim() || tripStatus || tripType ? "No trips match your filters." : "No trips yet."}
                    </div>
                  ) : (
                    filteredTrips.map(b => (
                      <div
                        key={b.tripRef ?? b.id}
                        className="grid items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer"
                        style={{ gridTemplateColumns: tripsGridTemplate }}
                        onClick={() => setSelectedBooking(tripToBooking(b))}
                      >
                        {visibleCols.map((k, j) => {
                          const r = (tripRenderers as Record<string, { body: (b: DriverTripItem) => React.ReactNode }>)[k];
                          return (
                            <div key={k} className="min-w-0" style={j === 0 ? { position: "sticky" as const, left: 0, background: "white", zIndex: 1 } : undefined}>
                              {r ? r.body(b) : <span className="text-[13px] text-slate-300 italic">—</span>}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />

      {/* ══ TAB: EARNINGS ══ */}
      {activeTab === "earnings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ position: "relative", display: "inline-block", width: "fit-content" }}>
            <button
              onClick={() => setEarningsCalOpen(v => !v)}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px", background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "#475569", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
            >
              <Calendar className="h-3.5 w-3.5" style={{ color: "#94A3B8" }} />
              <span style={{ fontFamily: "monospace", fontWeight: 500 }}>{earningsDateLabel}</span>
              <ChevronDown className="h-3.5 w-3.5" style={{ color: "#94A3B8" }} />
            </button>
            {earningsCalOpen && (
              <SharedDateRangePicker
                from={earningsDateFrom}
                to={earningsDateTo}
                onApply={(from, to) => {
                  setEarningsDateFrom(from);
                  setEarningsDateTo(to);
                }}
                onClose={() => setEarningsCalOpen(false)}
              />
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            <StatCard label="Total Earned"    value={`₹${earningsTotalEarned.toLocaleString("en-IN")}`} icon={IndianRupee}  iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Completed Trips" value={earningsCompletedTrips.length}                       icon={CheckCircle2} iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Avg per Trip"    value={`₹${earningsAvg.toLocaleString("en-IN")}`}           icon={TrendingUp}   iconBg="#F1F5F9" iconColor="#64748B" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14, alignItems: "stretch" }}>
            <div style={CARD_STYLE}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 22px 8px" }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Daily Earnings</p>
                  <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>
                    Period total: <span style={{ fontWeight: 700, color: "#334155" }}>₹{dateRangeDays.reduce((s, d) => s + d.total, 0).toLocaleString("en-IN")}</span>
                  </p>
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#64748B" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: ACCENT, display: "inline-block" }} /> Today
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: "#BFDBFE", display: "inline-block" }} /> Past days
                  </span>
                </div>
              </div>
              <div style={{ padding: "4px 22px 18px" }}>
                <BarChart days={dateRangeDays} />
              </div>
            </div>

            <EarningsSplitCard
              instantTotal={earningsInstantTotal}
              scheduledTotal={earningsScheduledTotal}
            />
          </div>
        </div>
      )}

      {/* ══ TAB: LOCATION HISTORY ══ */}
      {activeTab === "history" && (() => {
        const isDirty =
          histApplied.from !== `${histDate}T${histStartTime}:00` ||
          histApplied.to   !== `${histDate}T${histEndTime}:59`;
        const rangeInvalid = histStartTime >= histEndTime;
        const formatDateLong = (s: string) => {
          if (!s) return "";
          const [y, m, d] = s.split("-").map(Number);
          return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
        };
        const applyRange = () => {
          setHistApplied({
            from: `${histDate}T${histStartTime}:00`,
            to:   `${histDate}T${histEndTime}:59`,
          });
        };

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={CARD_STYLE}>
              {/* ── Header ── */}
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" as const }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Location History</p>
                  <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>GPS route replay for {driver.name}</p>
                </div>

                {/* Preset quick-picks */}
                <div style={{ display: "flex", gap: 6 }}>
                  {[{ label: "Today", date: todayStr }, { label: "Yesterday", date: yesterdayStr }].map((p) => {
                    const active = histDate === p.date;
                    return (
                      <button key={p.label} type="button" onClick={() => setHistDate(p.date)}
                        style={{ fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${active ? ACCENT : "#E2E8F0"}`, background: active ? "#EFF6FF" : "#fff", color: active ? ACCENT : "#64748B", cursor: "pointer", transition: "all 0.12s" }}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Controls toolbar ── */}
              <div style={{ padding: "14px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>

                {/* Date picker */}
                <CustomDatePicker value={histDate} onChange={setHistDate}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, height: 50, padding: "0 14px", borderRadius: 11, background: "#F8FAFC", border: "1.5px solid #E2E8F0", transition: "all 0.15s", whiteSpace: "nowrap" as const }}>
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Calendar className="h-4 w-4" style={{ color: "#475569" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Date</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginTop: 1 }}>{formatDateLong(histDate)}</div>
                    </div>
                    <ChevronRight className="h-4 w-4" style={{ color: "#94A3B8", flexShrink: 0 }} />
                  </div>
                </CustomDatePicker>

                <div style={{ width: 1, height: 24, background: "#E8EEF4", flexShrink: 0 }} />

                {/* From time */}
                <CustomTimePicker value={histStartTime} onChange={setHistStartTime}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, height: 50, padding: "0 10px", borderRadius: 11, background: "#F8FAFC", border: "1.5px solid #E2E8F0", transition: "all 0.15s" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Clock className="h-4 w-4" style={{ color: "#475569" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>From</div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A", marginTop: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{format12h(histStartTime)}</div>
                    </div>
                  </div>
                </CustomTimePicker>

                <div style={{ display: "flex", alignItems: "center", color: "#CBD5E1", flexShrink: 0 }}>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>

                {/* To time */}
                <CustomTimePicker value={histEndTime} onChange={setHistEndTime} align="right">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, height: 50, padding: "0 10px", borderRadius: 11, background: "#F8FAFC", border: "1.5px solid #E2E8F0", transition: "all 0.15s" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Clock className="h-4 w-4" style={{ color: "#475569" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>To</div>
                      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A", marginTop: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{format12h(histEndTime)}</div>
                    </div>
                  </div>
                </CustomTimePicker>

                {/* Apply button */}
                <button type="button" disabled={!isDirty || rangeInvalid} onClick={applyRange}
                  style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 13, cursor: (!isDirty || rangeInvalid) ? "not-allowed" : "pointer", transition: "all 0.15s", whiteSpace: "nowrap" as const,
                    background: rangeInvalid ? "#FEE2E2" : (!isDirty ? "#F1F5F9" : ACCENT),
                    color:      rangeInvalid ? "#991B1B" : (!isDirty ? "#94A3B8" : "#fff"),
                    boxShadow:  (!isDirty || rangeInvalid) ? "none" : "0 2px 8px rgba(37,99,235,0.25)",
                  }}>
                  {rangeInvalid ? "Invalid range" : (isDirty ? "Apply" : "✓ Applied")}
                </button>
              </div>

              {/* ── Map ── */}
              <div style={{ padding: "20px 24px" }}>
                <DriverHistoryMap
                  driverId={id}
                  driverName={driver.name}
                  range={histRange}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ TAB: DOCUMENTS ══ */}
      {activeTab === "documents" && (() => {
        if (docsLoading) {
          const SKEL_GRID = "2fr 1.3fr 1.4fr 1.6fr";
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Sub-tabs + status badges */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
                <Skeleton className="h-10 w-44 rounded-[9px]" />
                <Skeleton className="h-10 w-44 rounded-[9px]" />
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <Skeleton className="h-7 w-24 rounded-full" />
                  <Skeleton className="h-7 w-24 rounded-full" />
                  <Skeleton className="h-7 w-24 rounded-full" />
                </div>
              </div>
              {/* Document table */}
              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: SKEL_GRID, columnGap: 16, padding: "11px 24px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                  {["DOCUMENT", "STATUS", "EXPIRY DATE", "ACTION"].map(h => (
                    <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.07em", paddingLeft: h === "ACTION" ? 48 : 0 }}>{h}</span>
                  ))}
                </div>
                {[...Array(7)].map((_, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: SKEL_GRID, columnGap: 16, padding: "15px 24px", alignItems: "center", borderBottom: i < 6 ? "1px solid #F1F5F9" : "none" }}>
                    <Skeleton className="h-3.5 w-36" />
                    <Skeleton className="h-6 w-28 rounded-full" />
                    <Skeleton className="h-8 w-28 rounded-lg" />
                    <div style={{ paddingLeft: 48 }}><Skeleton className="h-8 w-20 rounded-lg" /></div>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const driverDocs  = (onboardingDocs?.driver  ?? []).filter(d => d.doc_type !== "undertaking_letter");
        const vehicleDocs = onboardingDocs?.vehicle ?? [];
        const activeDocs  = docSubTab === "driver" ? driverDocs : vehicleDocs;
        const dApproved   = driverDocs.filter(d => d.status === "Approved").length;
        const vApproved   = vehicleDocs.filter(d => d.status === "Approved").length;
        const approvedCt  = activeDocs.filter(d => d.status === "Approved").length;
        const rejectedCt  = activeDocs.filter(d => d.status === "Rejected").length;
        const pendingCt   = activeDocs.filter(d => d.status === "Pending").length;
        const GRID = "2fr 1.3fr 1.4fr 1.6fr";

        async function handleUpload(docType: string, file: File) {
          if (!onboardingId) return;
          setUploadingDoc(docType);
          setDocError(null);
          try {
            const updated = await driverOnboardingApi.uploadDocumentFile(onboardingId, docType, "front", file);
            setOnboardingDocs(prev => {
              if (!prev) return prev;
              const update = (arr: OnboardingDoc[]) =>
                arr.map(d => d.doc_type === docType ? updated : d);
              return { driver: update(prev.driver), vehicle: update(prev.vehicle) };
            });
          } catch (e: any) {
            setDocError(e?.message ?? "Upload failed");
          } finally {
            setUploadingDoc(null);
          }
        }

        async function handlePatch(docType: string, action: "approve" | "reject") {
          if (!onboardingId) return;
          try {
            const res = await driverOnboardingApi.patchDocument(onboardingId, docType, { action });
            setOnboardingDocs(prev => {
              if (!prev) return prev;
              const update = (arr: OnboardingDoc[]) =>
                arr.map(d => d.doc_type === docType ? res.data : d);
              return { driver: update(prev.driver), vehicle: update(prev.vehicle) };
            });
          } catch (e: any) {
            setDocError(e?.message ?? "Action failed");
          }
        }

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {docError && (
              <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, padding: "10px 16px", fontSize: 13, color: "#B91C1C", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {docError}
                <button onClick={() => setDocError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#B91C1C", fontSize: 16 }}>✕</button>
              </div>
            )}

            {!onboardingId && (
              <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#92400E" }}>
                No onboarding record found for this driver. Documents can only be uploaded via the onboarding workflow.
              </div>
            )}

            {/* Sub-tabs + status badges */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
              {/* Basic Details sub-tab */}
              <button
                onClick={() => setDocSubTab("basic")}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: font, fontSize: 13.5, fontWeight: docSubTab === "basic" ? 700 : 500, color: docSubTab === "basic" ? ACCENT : "#475569", background: docSubTab === "basic" ? "#EFF6FF" : "#fff", border: docSubTab === "basic" ? `2px solid ${ACCENT}` : "1.5px solid #E2E8F0", transition: "all 0.12s" }}
              >
                Basic Details
              </button>

              {([
                { value: "driver",  label: "Driver Documents",  approved: dApproved, total: driverDocs.length },
                { value: "vehicle", label: "Vehicle Documents", approved: vApproved, total: vehicleDocs.length },
              ] as const).map(tab => {
                const active = docSubTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setDocSubTab(tab.value)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: font, fontSize: 13.5, fontWeight: active ? 700 : 500, color: active ? ACCENT : "#475569", background: active ? "#EFF6FF" : "#fff", border: active ? `2px solid ${ACCENT}` : "1.5px solid #E2E8F0", transition: "all 0.12s" }}
                  >
                    {tab.label}
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: active ? ACCENT : "#E2E8F0", color: active ? "#fff" : "#64748B" }}>
                      {tab.approved}/{tab.total}
                    </span>
                  </button>
                );
              })}

              {docSubTab !== "basic" && (
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  {[
                    { label: `${approvedCt} Approved`, color: ACCENT,    bg: "#EFF6FF", border: "#BFDBFE" },
                    { label: `${rejectedCt} Rejected`, color: "#B91C1C", bg: "#FEE2E2", border: "#FECACA" },
                    { label: `${pendingCt} Pending`,   color: "#B45309", bg: "#FEF3C7", border: "#FDE68A" },
                  ].map(p => (
                    <span key={p.label} style={{ fontSize: 12.5, fontWeight: 600, color: p.color, background: p.bg, border: `1px solid ${p.border}`, borderRadius: 20, padding: "4px 12px", whiteSpace: "nowrap" as const }}>{p.label}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Basic Details form */}
            {docSubTab === "basic" && (() => {
              if (!onboardingId) {
                return (
                  <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#92400E" }}>
                    No onboarding record found for this driver. Basic details are only available after the driver completes onboarding.
                  </div>
                );
              }
              if (basicLoading) {
                return (
                  <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
                    {[{ rows: 2 }, { rows: 2 }, { rows: 2 }].map((section, si) => (
                      <div key={si} style={{ borderBottom: si < 2 ? "1px solid #F1F5F9" : "none" }}>
                        <div style={{ padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
                          <Skeleton className="h-3 w-40" />
                        </div>
                        {Array.from({ length: section.rows }).map((_, ri) => (
                          <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: ri < section.rows - 1 ? "1px solid #F1F5F9" : "none" }}>
                            {[0, 1, 2].map(ci => (
                              <div key={ci} style={{ padding: "16px 20px", borderRight: ci < 2 ? "1px solid #F1F5F9" : "none", display: "flex", flexDirection: "column", gap: 8 }}>
                                <Skeleton className="h-2.5 w-20" />
                                <Skeleton className="h-3.5 w-32" />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              }
              if (!onboardingRecord) {
                return (
                  <div style={{ padding: "32px 24px", textAlign: "center" as const, color: "#94A3B8", fontSize: 13 }}>
                    Failed to load basic details.
                  </div>
                );
              }

              const sections = buildBasicSections(onboardingRecord);

              function startEdit(section: ReturnType<typeof buildBasicSections>[0]) {
                setEditingSection(section.title);
                const draft: Record<string, string> = {};
                for (const f of section.fields) draft[f.key] = f.raw;
                setSectionDraft(draft);
              }

              function saveEdit() {
                setOnboardingRecord(prev => {
                  if (!prev) return prev;
                  const next = { ...prev } as OnboardingDetail & { vehicle: OnboardingDetail["vehicle"] };
                  for (const [key, val] of Object.entries(sectionDraft)) {
                    if (key.startsWith("vehicle.")) {
                      const vKey = key.split(".")[1] as keyof NonNullable<OnboardingDetail["vehicle"]>;
                      if (next.vehicle) {
                        const v = val || null;
                        const cast = vKey === "year" ? (v ? Number(v) : null) : v;
                        next.vehicle = { ...next.vehicle, [vKey]: cast };
                      }
                    } else {
                      (next as unknown as Record<string, unknown>)[key] = val || null;
                    }
                  }
                  return next;
                });
                setEditingSection(null);
                setSectionDraft({});
              }

              const COLS = 3;

              return (
                <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
                  {sections.map((section, si) => {
                    const isEditing = editingSection === section.title;
                    return (
                      <div key={section.title} style={{ borderBottom: si < sections.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                        <div style={{ padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{section.title}</span>
                          {isEditing ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                onClick={saveEdit}
                                style={{ padding: "4px 14px", borderRadius: 6, border: "none", background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font }}
                              >Save</button>
                              <button
                                onClick={() => { setEditingSection(null); setSectionDraft({}); }}
                                style={{ padding: "4px 10px", borderRadius: 6, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}
                              >Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEdit(section)}
                              style={{ padding: "4px 12px", borderRadius: 6, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}
                            >Edit</button>
                          )}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                          {section.fields.map((field, fi) => {
                            const total   = section.fields.length;
                            const lastRow = Math.floor((total - 1) / COLS);
                            const row     = Math.floor(fi / COLS);
                            return (
                              <div
                                key={field.label}
                                style={{
                                  padding: "14px 20px",
                                  borderRight:  fi % COLS !== COLS - 1 ? "1px solid #F1F5F9" : "none",
                                  borderBottom: row < lastRow ? "1px solid #F1F5F9" : "none",
                                  background: isEditing ? "#FAFBFC" : "transparent",
                                }}
                              >
                                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>{field.label}</p>
                                {isEditing ? (
                                  <input
                                    value={sectionDraft[field.key] ?? ""}
                                    onChange={e => setSectionDraft(prev => ({ ...prev, [field.key]: e.target.value }))}
                                    style={{ width: "100%", padding: "7px 10px", border: "1.5px solid #E2E8F0", borderRadius: 7, fontSize: 13, fontFamily: font, color: "#0F172A", background: "#fff", outline: "none", boxSizing: "border-box" as const }}
                                    onFocus={e  => { (e.target as HTMLInputElement).style.borderColor = ACCENT; }}
                                    onBlur={e   => { (e.target as HTMLInputElement).style.borderColor = "#E2E8F0"; }}
                                  />
                                ) : (
                                  <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>{field.value}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Document table */}
            {docSubTab !== "basic" && (
            <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: 16, padding: "11px 24px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["DOCUMENT", "STATUS", "EXPIRY DATE", "ACTION"].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.07em", paddingLeft: h === "ACTION" ? 48 : 0 }}>{h}</span>
                ))}
              </div>

              {activeDocs.length === 0 && (
                <div style={{ padding: "32px 24px", textAlign: "center" as const, color: "#94A3B8", fontSize: 13 }}>
                  No document records found.
                </div>
              )}

              {activeDocs.map((doc, idx) => {
                const sc        = STATUS_STYLES[doc.status] ?? STATUS_STYLES["Offline"];
                const docKey    = `${doc.category}-${doc.doc_type}`;
                const expiry    = expiryEdits[docKey] ?? doc.expiry_date ?? "";
                const submitted = doc.status !== "Not Submitted";
                const isUploading = uploadingDoc === doc.doc_type;

                return (
                  <div
                    key={doc.doc_type}
                    style={{ display: "grid", gridTemplateColumns: GRID, columnGap: 16, padding: "15px 24px", alignItems: "center", borderBottom: idx < activeDocs.length - 1 ? "1px solid #F1F5F9" : "none", transition: "background 0.12s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: submitted ? 700 : 500, color: submitted ? "#0F172A" : "#94A3B8" }}>{doc.name}</span>

                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, whiteSpace: "nowrap" as const, width: "fit-content" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                      {doc.status}
                    </span>

                    <div onClick={e => e.stopPropagation()}>
                      <DocDatePicker value={expiry} onChange={v => setExpiryEdits(p => ({ ...p, [docKey]: v }))} hasExpiry={doc.has_expiry} />
                    </div>

                    <div style={{ paddingLeft: 48, display: "flex", alignItems: "center", gap: 6 }}>
                      {/* Hidden file input */}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        style={{ display: "none" }}
                        ref={el => { fileInputRefs.current[doc.doc_type] = el; }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(doc.doc_type, file);
                          e.target.value = "";
                        }}
                      />

                      {isUploading ? (
                        <span style={{ fontSize: 12.5, color: "#64748B", fontStyle: "italic" }}>Uploading…</span>
                      ) : !submitted ? (
                        onboardingId ? (
                          <button
                            onClick={() => fileInputRefs.current[doc.doc_type]?.click()}
                            style={{ padding: "5px 13px", borderRadius: 7, border: `1.5px solid ${ACCENT}`, background: "#EFF6FF", color: ACCENT, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font }}
                          >
                            Upload
                          </button>
                        ) : (
                          <span style={{ fontSize: 12.5, color: "#94A3B8", fontStyle: "italic" }}>Awaiting upload</span>
                        )
                      ) : doc.status === "Approved" ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          {doc.file_url && (
                            <button onClick={() => setViewingDoc({ file_url: doc.file_url!, name: doc.name, doc_type: doc.doc_type })} style={{ padding: "5px 11px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}>View</button>
                          )}
                          <button onClick={() => handlePatch(doc.doc_type, "reject")} style={{ padding: "5px 11px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Reject</button>
                          <button onClick={() => fileInputRefs.current[doc.doc_type]?.click()} style={{ padding: "5px 11px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Re-upload</button>
                        </div>
                      ) : doc.status === "Rejected" ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => handlePatch(doc.doc_type, "approve")} style={{ padding: "5px 13px", borderRadius: 7, border: "none", background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font }}>Approve</button>
                          <button onClick={() => fileInputRefs.current[doc.doc_type]?.click()} style={{ padding: "5px 11px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Re-upload</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          {doc.file_url && (
                            <button onClick={() => setViewingDoc({ file_url: doc.file_url!, name: doc.name, doc_type: doc.doc_type })} style={{ padding: "5px 11px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}>View</button>
                          )}
                          <button onClick={() => handlePatch(doc.doc_type, "approve")} style={{ padding: "5px 13px", borderRadius: 7, border: "none", background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font }}>Approve</button>
                          <button onClick={() => handlePatch(doc.doc_type, "reject")} style={{ padding: "5px 11px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Reject</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        );
      })()}

      {/* ══ TAB: SETTINGS ══ */}
      {activeTab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>

          {/* Success toast */}
          {actionDone && (
            <div style={{
              background: actionDone === "deleted" ? "#FEE2E2" : "#DCFCE7",
              border: `1.5px solid ${actionDone === "deleted" ? "#FECACA" : "#BBF7D0"}`,
              borderRadius: 12, padding: "12px 18px",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <CheckCircle2 className="h-4 w-4" style={{ color: actionDone === "deleted" ? "#B91C1C" : "#15803D", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: actionDone === "deleted" ? "#B91C1C" : "#15803D" }}>
                {actionDone === "blocked" && "Driver has been blocked successfully."}
                {actionDone === "unblocked" && "Driver has been unblocked successfully."}
                {actionDone === "deleted" && "Driver account has been permanently deleted."}
              </span>
              <button onClick={() => setActionDone(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", lineHeight: 1 }}>✕</button>
            </div>
          )}

          {/* Block / Unblock card */}
          <div style={{ ...CARD_STYLE, padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ background: isBlocked ? "#FEF3C7" : "#F1F5F9", border: `1px solid ${isBlocked ? "#FDE68A" : "#E2E8F0"}`, borderRadius: 10, padding: 9, flexShrink: 0 }}>
                <ShieldBan className="h-5 w-5" style={{ color: isBlocked ? "#B45309" : "#64748B" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                  {isBlocked ? "Unblock Driver" : "Block Driver"}
                </p>
                <p style={{ fontSize: 12.5, color: "#64748B", marginTop: 4, lineHeight: 1.5 }}>
                  {isBlocked
                    ? "This driver is currently blocked. Unblocking will restore their ability to receive trips."
                    : "Blocking this driver will immediately prevent them from receiving any new trip assignments."}
                </p>

                {!blockConfirm ? (
                  <button
                    onClick={() => setBlockConfirm(true)}
                    style={{
                      marginTop: 14, padding: "8px 18px",
                      borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font,
                      border: isBlocked ? "1.5px solid #FDE68A" : "1.5px solid #E2E8F0",
                      background: isBlocked ? "#FEF3C7" : "#F1F5F9",
                      color: isBlocked ? "#B45309" : "#334155",
                    }}
                  >
                    {isBlocked ? "Unblock Driver" : "Block Driver"}
                  </button>
                ) : (
                  <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: "#64748B" }}>Are you sure?</span>
                    <button
                      onClick={() => {
                        setIsBlocked(v => !v);
                        setActionDone(isBlocked ? "unblocked" : "blocked");
                        setBlockConfirm(false);
                      }}
                      style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: font, border: "none", background: isBlocked ? "#F59E0B" : "#0F172A", color: "#fff" }}
                    >
                      Yes, {isBlocked ? "unblock" : "block"}
                    </button>
                    <button
                      onClick={() => setBlockConfirm(false)}
                      style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: font, border: "1.5px solid #E2E8F0", background: "#fff", color: "#64748B" }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delete Account card */}
          <div style={{ ...CARD_STYLE, padding: "22px 24px", borderColor: "#FECACA" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, padding: 9, flexShrink: 0 }}>
                <Trash2 className="h-5 w-5" style={{ color: "#B91C1C" }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#B91C1C" }}>Delete Account Permanently</p>
                <p style={{ fontSize: 12.5, color: "#64748B", marginTop: 4, lineHeight: 1.5 }}>
                  This action is <strong>irreversible</strong>. All driver data, trip history, earnings records, and documents will be permanently erased.
                </p>

                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    style={{ marginTop: 14, padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font, border: "1.5px solid #FECACA", background: "#FEE2E2", color: "#B91C1C" }}
                  >
                    Delete Account
                  </button>
                ) : (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ background: "#FFF7F7", border: "1px solid #FECACA", borderRadius: 9, padding: "12px 14px", display: "flex", gap: 8 }}>
                      <TriangleAlert className="h-4 w-4" style={{ color: "#B91C1C", flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 12, color: "#B91C1C", lineHeight: 1.5 }}>
                        Type the driver ID <strong>{driver.id}</strong> below to confirm deletion.
                      </p>
                    </div>
                    <input
                      placeholder={`Type "${driver.id}" to confirm`}
                      value={deleteInput}
                      onChange={e => setDeleteInput(e.target.value)}
                      style={{
                        padding: "9px 12px", borderRadius: 9, fontSize: 13, fontFamily: font,
                        border: "1.5px solid #FECACA", outline: "none", color: "#0F172A",
                        background: "#fff", boxSizing: "border-box" as const, width: "100%",
                      }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        disabled={deleteInput !== driver.id}
                        onClick={() => { setActionDone("deleted"); setDeleteConfirm(false); setDeleteInput(""); }}
                        style={{
                          padding: "8px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: deleteInput === driver.id ? "pointer" : "not-allowed", fontFamily: font,
                          border: "none", background: deleteInput === driver.id ? "#B91C1C" : "#E2E8F0",
                          color: deleteInput === driver.id ? "#fff" : "#94A3B8", transition: "all 0.15s",
                        }}
                      >
                        Delete Permanently
                      </button>
                      <button
                        onClick={() => { setDeleteConfirm(false); setDeleteInput(""); }}
                        style={{ padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font, border: "1.5px solid #E2E8F0", background: "#fff", color: "#64748B" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Document Viewer Modal ── */}
      {viewingDoc && (() => {
        const storedType = detectFileType(viewingDoc.file_url);
        const apiBase    = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
        const viewerUrl  = storedType === "pdf"
          ? `${apiBase}/api/superadmin/driver-onboarding/${onboardingId}/document/${viewingDoc.doc_type}/download`
          : viewingDoc.file_url;
        const previewLinkResolver = storedType === "pdf" && onboardingId
          ? () => driverOnboardingApi
              .documentPreviewLink(onboardingId, viewingDoc.doc_type)
              .then(r => r.data.url)
          : undefined;
        return (
          <DocumentViewer
            url={viewerUrl}
            fileTypeHint={storedType}
            fileName={viewingDoc.name}
            onClose={() => setViewingDoc(null)}
            previewLinkResolver={previewLinkResolver}
          />
        );
      })()}

    </div>
  );
}

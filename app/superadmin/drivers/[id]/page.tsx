"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { superadminApi, type DriverApiItem, type DriverTripsResponse } from "@/lib/api";
import type { Driver, DriverStatus } from "@/modules/drivers/types";
import {
  ArrowLeft, Phone, Car, TrendingUp, IndianRupee, User,
  ArrowRight, Clock, CheckCircle2,
  AlertCircle, Circle, ShieldBan, Trash2, TriangleAlert,
  ChevronLeft, ChevronRight, Route,
} from "lucide-react";
import { STATUS_STYLES } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchBar } from "@/components/SearchBar";

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

// ── API → Driver shape ────────────────────────────────────────────────────────

function apiToDriver(d: DriverApiItem): Driver {
  return {
    id:                     d.id,
    driverRef:              d.driverRef ?? null,
    name:                   d.name,
    phone:                  d.phone,
    vehicle:                d.vehicle?.model        ?? undefined,
    vehicleReg:             d.vehicle?.plateNumber  ?? undefined,
    vehicleColor:           d.vehicle?.color        ?? undefined,
    vehicleType:            d.vehicle?.type         ?? undefined,
    status:                 (d.status as DriverStatus) || "Offline",
    assignedSupervisorId:   null,
    assignedSupervisorName: null,
    totalTrips:             d.totalTrips,
    lastActive:             d.lastActiveAt,
    recentTrips:            [],
  };
}

// ── documents mock ────────────────────────────────────────────────────────────
type DocStatus = "Verified" | "Pending" | "Not Uploaded";
interface DocItem { id: string; name: string; number: string; status: DocStatus; uploadedAt: string | null; expiryDate: string | null; }

const DOC_SETS: Record<string, DocItem[]> = {
  "drv-001": [
    { id: "dl",      name: "Driving License",          number: "KA-01-20180042", status: "Verified",     uploadedAt: "2024-01-12", expiryDate: "2028-01-11" },
    { id: "rc",      name: "Vehicle Registration (RC)", number: "KA 05 MH 1234", status: "Verified",     uploadedAt: "2024-01-12", expiryDate: "2034-03-20" },
    { id: "aadhaar", name: "Aadhaar Card",              number: "XXXX XXXX 3421", status: "Verified",     uploadedAt: "2024-01-10", expiryDate: null },
    { id: "pan",     name: "PAN Card",                  number: "ABCDE1234F",     status: "Verified",     uploadedAt: "2024-01-10", expiryDate: null },
  ],
  "drv-002": [
    { id: "dl",      name: "Driving License",          number: "KA-02-20190088", status: "Verified",     uploadedAt: "2024-02-05", expiryDate: "2029-02-04" },
    { id: "rc",      name: "Vehicle Registration (RC)", number: "KA 03 AB 5678", status: "Verified",     uploadedAt: "2024-02-05", expiryDate: "2033-07-15" },
    { id: "aadhaar", name: "Aadhaar Card",              number: "XXXX XXXX 7812", status: "Pending",      uploadedAt: "2024-02-06", expiryDate: null },
    { id: "pan",     name: "PAN Card",                  number: "—",             status: "Not Uploaded", uploadedAt: null,         expiryDate: null },
  ],
};

function getDocuments(driverId: string): DocItem[] {
  return DOC_SETS[driverId] ?? [
    { id: "dl",      name: "Driving License",          number: "—", status: "Not Uploaded", uploadedAt: null, expiryDate: null },
    { id: "rc",      name: "Vehicle Registration (RC)", number: "—", status: "Not Uploaded", uploadedAt: null, expiryDate: null },
    { id: "aadhaar", name: "Aadhaar Card",              number: "—", status: "Pending",      uploadedAt: null, expiryDate: null },
    { id: "pan",     name: "PAN Card",                  number: "—", status: "Not Uploaded", uploadedAt: null, expiryDate: null },
  ];
}

const DOC_STATUS_CFG: Record<DocStatus, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  "Verified":     { icon: CheckCircle2, color: "#15803D", bg: "#DCFCE7", border: "#BBF7D0", label: "Verified" },
  "Pending":      { icon: Clock,        color: "#B45309", bg: "#FEF3C7", border: "#FDE68A", label: "Under Review" },
  "Not Uploaded": { icon: AlertCircle,  color: "#94A3B8", bg: "#F1F5F9", border: "#E2E8F0", label: "Not Uploaded" },
};

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
                  style={{ height: 30, borderRadius: "50%", border: "none", cursor: "pointer", fontSize: 12, fontWeight: sel ? 800 : tdy ? 700 : 400, background: sel ? ACCENT : "transparent", color: sel ? "#fff" : tdy ? ACCENT : "#334155", outline: tdy && !sel ? `1.5px solid ${ACCENT}` : "none", transition: "background 0.1s" }}
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
  const [activeTab,    setActiveTab]    = useState("overview");
  const [isBlocked,    setIsBlocked]    = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [deleteConfirm,setDeleteConfirm]= useState(false);
  const [deleteInput,  setDeleteInput]  = useState("");
  const [actionDone,   setActionDone]   = useState<"blocked" | "unblocked" | "deleted" | null>(null);
  const [expiryEdits,  setExpiryEdits]  = useState<Record<string, string>>({});
  const [docSubTab,    setDocSubTab]    = useState<"driver" | "vehicle">("driver");
  const [tripsSearch,  setTripsSearch]  = useState("");

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

  // en-CA → YYYY-MM-DD in the browser's local timezone (IST for the user).
  const today          = new Date().toLocaleDateString("en-CA");
  const localDate      = (iso: string) => new Date(iso).toLocaleDateString("en-CA");
  const todayBookings  = driverBookings.filter(b => b.createdAt && localDate(b.createdAt) === today);
  const todayEarned    = todayBookings.reduce((s, b) => s + (b.fare ?? 0), 0);
  const todayAvg       = todayBookings.length > 0 ? Math.round(todayEarned / todayBookings.length) : 0;

  const weekDays   = tripsData?.weekDays.map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" }),
  })) ?? [];

  const TABS = [
    { value: "overview",  label: "Overview" },
    { value: "trips",     label: "Recent Trips" },
    { value: "earnings",  label: "Earnings" },
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
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: isOnline ? "#22C55E" : "#94A3B8" }}>
                  <Circle className="h-2 w-2 fill-current" />{isOnline ? "Online" : "Offline"}
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
            <StatCard label="Total Trips"    value={driver.totalTrips}                                 icon={Route}        iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Today's Trips"  value={todayBookings.length}                              icon={CheckCircle2} iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Today's Earned" value={`₹${todayEarned.toLocaleString("en-IN")}`}        icon={IndianRupee}  iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Today's Avg"    value={`₹${todayAvg.toLocaleString("en-IN")}`}           icon={TrendingUp}   iconBg="#F1F5F9" iconColor="#64748B" />
          </div>

          {/* Earnings card (blue) + right column */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, alignItems: "start" }}>

            {/* Blue earnings card — compact, left side stays white below it */}
            <div style={{
              background: "linear-gradient(135deg, #1e40af 0%, #2563EB 60%, #3b82f6 100%)",
              borderRadius: 18, padding: "20px 22px 18px",
              display: "flex", flexDirection: "column", gap: 10,
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
              <div style={{ position: "absolute", bottom: -28, right: 24, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>
                Trip Earnings
              </p>
              <p style={{ fontSize: 34, fontWeight: 800, color: "#fff", lineHeight: 1, letterSpacing: -1 }}>
                ₹{totalEarned.toLocaleString("en-IN")}
              </p>
              <div style={{ display: "flex", gap: 14, fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                <span>{driverBookings.length} trips · {completedTrips.length} completed</span>
                <span>·</span>
                <span>Avg ₹{avgEarning.toLocaleString("en-IN")} / trip</span>
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Driver Info card */}
              <div style={CARD_STYLE}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 9, padding: 7 }}>
                      <User className="h-4 w-4" style={{ color: "#0F172A" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Driver Information</p>
                      <p style={{ fontSize: 11, color: "#94A3B8" }}>Full profile details</p>
                    </div>
                  </div>
                </div>
                <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Vehicle",        value: driver.vehicle ?? "—" },
                    { label: "Vehicle Number", value: driver.vehicleReg ?? "—" },
                    { label: "Phone",          value: `+91 ${driver.phone}` },
                    { label: "Driver ID",      value: driver.driverRef ?? "—" },
                    { label: "Last Active",    value: fmtDate(driver.lastActive) },
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
        </div>
      )}

      {/* ══ TAB: RECENT TRIPS ══ */}
      {activeTab === "trips" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SearchBar
            value={tripsSearch}
            onChange={setTripsSearch}
            placeholder="Search by trip ID, route, supervisor, company, type, status..."
          />
          <div style={CARD_STYLE}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr 0.6fr 0.5fr 0.7fr", columnGap: 20, padding: "12px 24px", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC", borderRadius: "14px 14px 0 0" }}>
            {["ROUTE", "SUPERVISOR", "TYPE", "FARE", "STATUS"].map(h => (
              <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>{h}</span>
            ))}
          </div>
          {(() => {
            if (tripsLoading) {
              return (
                <div>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr 0.6fr 0.5fr 0.7fr", columnGap: 20, padding: "14px 24px", borderBottom: i < 3 ? "1px solid #F8FAFC" : "none", alignItems: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-5 w-16 rounded" />
                      <Skeleton className="h-3.5 w-12" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  ))}
                </div>
              );
            }
            const q = tripsSearch.trim().toLowerCase();
            const trips = q
              ? driverBookings.filter(b => {
                  const ref = (b.tripRef ?? b.id).toLowerCase();
                  return (
                    ref.includes(q) ||
                    b.pickupLocation.toLowerCase().includes(q) ||
                    b.dropLocation.toLowerCase().includes(q) ||
                    (b.supervisorName ?? "").toLowerCase().includes(q) ||
                    (b.companyName    ?? "").toLowerCase().includes(q) ||
                    (b.type           ?? "").toLowerCase().includes(q) ||
                    (b.status         ?? "").toLowerCase().includes(q)
                  );
                })
              : driverBookings;
            return trips.length === 0 ? (
              <p style={{ textAlign: "center" as const, padding: "40px 0", color: "#94A3B8", fontSize: 13 }}>
                {q ? "No trips match your search." : "No trips yet."}
              </p>
            ) : (
            <div>
              {trips.map((b, idx) => (
                <div
                  key={b.tripRef ?? b.id}
                  style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr 0.6fr 0.5fr 0.7fr", columnGap: 20, padding: "14px 24px", borderBottom: idx < trips.length - 1 ? "1px solid #F8FAFC" : "none", alignItems: "center" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{b.pickupLocation}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 3, margin: "3px 0" }}>
                      <div style={{ width: 42, height: 2, borderRadius: 2, background: `linear-gradient(to right,#A5B4FC,${ACCENT})` }} />
                      <ArrowRight className="h-3 w-3" style={{ color: ACCENT }} />
                    </div>
                    <p style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{b.dropLocation}</p>
                    <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 3 }}>{fmtDate(b.createdAt)}</p>
                  </div>
                  <span style={{ fontSize: 13, color: "#334155", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{b.supervisorName ?? "—"}</span>
                  <span style={{ background: b.type === "Instant" ? "#DBEAFE" : "#FEF3C7", color: b.type === "Instant" ? "#1D4ED8" : "#B45309", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5, display: "inline-block" }}>
                    {b.type ?? "—"}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                    {b.fare ? `₹${b.fare.toLocaleString()}` : <span style={{ color: "#CBD5E1" }}>—</span>}
                  </span>
                  <TripStatusBadge status={b.status ?? "Pending"} />
                </div>
              ))}
            </div>
          );
          })()}
          </div>
        </div>
      )}

      {/* ══ TAB: EARNINGS ══ */}
      {activeTab === "earnings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            <StatCard label="Total Earned"    value={`₹${totalEarned.toLocaleString("en-IN")}`} icon={IndianRupee}  iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Completed Trips" value={completedTrips.length}                     icon={CheckCircle2} iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Avg per Trip"    value={`₹${avgEarning.toLocaleString("en-IN")}`}  icon={TrendingUp}   iconBg="#F1F5F9" iconColor="#64748B" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14, alignItems: "stretch" }}>
            <div style={CARD_STYLE}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 22px 8px" }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Daily Earnings — Last 7 Days</p>
                  <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>
                    Week total: <span style={{ fontWeight: 700, color: "#334155" }}>₹{weekDays.reduce((s, d) => s + d.total, 0).toLocaleString()}</span>
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
                <BarChart days={weekDays} />
              </div>
            </div>

            <EarningsSplitCard
              instantTotal={tripsData?.stats.instantFare ?? 0}
              scheduledTotal={tripsData?.stats.scheduledFare ?? 0}
            />
          </div>
        </div>
      )}

      {/* ══ TAB: DOCUMENTS ══ */}
      {activeTab === "documents" && (() => {
        const DRIVER_DOCS = [
          { id: "dl",      name: "Driving License",         status: "Not Submitted", hasExpiry: true,  expiryDate: null, prefix: "drv" },
          { id: "aadhaar", name: "Aadhaar Card",             status: "Not Submitted", hasExpiry: false, expiryDate: null, prefix: "drv" },
          { id: "photo",   name: "Profile Photo",            status: "Not Submitted", hasExpiry: false, expiryDate: null, prefix: "drv" },
          { id: "address", name: "Current Address Proof",    status: "Not Submitted", hasExpiry: false, expiryDate: null, prefix: "drv" },
          { id: "medical", name: "Medical Certificate",      status: "Not Submitted", hasExpiry: true,  expiryDate: null, prefix: "drv" },
          { id: "police",  name: "Police Verification",      status: "Not Submitted", hasExpiry: false, expiryDate: null, prefix: "drv" },
          { id: "letter",  name: "Undertaking Letter",       status: "Not Submitted", hasExpiry: false, expiryDate: null, prefix: "drv" },
          { id: "badge",   name: "Badge",                    status: "Not Submitted", hasExpiry: true,  expiryDate: null, prefix: "drv" },
        ];
        const VEHICLE_DOCS = [
          { id: "rc",      name: "Registration Certificate", status: "Not Submitted", hasExpiry: true,  expiryDate: null, prefix: "veh" },
          { id: "tax",     name: "Tax Certificate",           status: "Not Submitted", hasExpiry: true,  expiryDate: null, prefix: "veh" },
          { id: "permit",  name: "Permit",                    status: "Not Submitted", hasExpiry: true,  expiryDate: null, prefix: "veh" },
          { id: "ins",     name: "Insurance",                 status: "Not Submitted", hasExpiry: true,  expiryDate: null, prefix: "veh" },
          { id: "fitness", name: "Fitness Certificate",       status: "Not Submitted", hasExpiry: true,  expiryDate: null, prefix: "veh" },
          { id: "form42",  name: "Form 42",                   status: "Not Submitted", hasExpiry: false, expiryDate: null, prefix: "veh" },
          { id: "puc",     name: "PUC",                       status: "Not Submitted", hasExpiry: true,  expiryDate: null, prefix: "veh" },
        ];

        const activeDocs = docSubTab === "driver" ? DRIVER_DOCS : VEHICLE_DOCS;
        const dApproved  = DRIVER_DOCS.filter(d => d.status === "Approved").length;
        const vApproved  = VEHICLE_DOCS.filter(d => d.status === "Approved").length;
        const approvedCt = activeDocs.filter(d => d.status === "Approved").length;
        const rejectedCt = activeDocs.filter(d => d.status === "Rejected").length;
        const pendingCt  = activeDocs.filter(d => d.status === "Pending").length;
        const GRID = "2fr 1.3fr 1.4fr 1.6fr";

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Sub-tabs + status badges */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
              {([
                { value: "driver",  label: "Driver Documents",  approved: dApproved, total: DRIVER_DOCS.length },
                { value: "vehicle", label: "Vehicle Documents", approved: vApproved, total: VEHICLE_DOCS.length },
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

              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {[
                  { label: `${approvedCt} Approved`, color: ACCENT,    bg: "#EFF6FF", border: "#BFDBFE" },
                  { label: `${rejectedCt} Rejected`, color: "#B91C1C", bg: "#FEE2E2", border: "#FECACA" },
                  { label: `${pendingCt} Pending`,   color: "#B45309", bg: "#FEF3C7", border: "#FDE68A" },
                ].map(p => (
                  <span key={p.label} style={{ fontSize: 12.5, fontWeight: 600, color: p.color, background: p.bg, border: `1px solid ${p.border}`, borderRadius: 20, padding: "4px 12px", whiteSpace: "nowrap" as const }}>{p.label}</span>
                ))}
              </div>
            </div>

            {/* Document table */}
            <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: 16, padding: "11px 24px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["DOCUMENT", "STATUS", "EXPIRY DATE", "ACTION"].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.07em", paddingLeft: h === "ACTION" ? 48 : 0 }}>{h}</span>
                ))}
              </div>

              {activeDocs.map((doc, idx) => {
                const sc        = STATUS_STYLES[doc.status] ?? STATUS_STYLES["Offline"];
                const docKey    = `${doc.prefix}-${doc.id}`;
                const expiry    = expiryEdits[docKey] ?? doc.expiryDate ?? "";
                const submitted = doc.status !== "Not Submitted" && doc.status !== "Not Uploaded";
                return (
                  <div
                    key={doc.id}
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
                      <DocDatePicker value={expiry} onChange={v => setExpiryEdits(p => ({ ...p, [docKey]: v }))} hasExpiry={doc.hasExpiry} />
                    </div>

                    <div style={{ paddingLeft: 48 }}>
                      {!submitted ? (
                        <span style={{ fontSize: 12.5, color: "#94A3B8", fontStyle: "italic" }}>Awaiting upload</span>
                      ) : doc.status === "Approved" ? (
                        <button style={{ padding: "5px 11px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Reject instead</button>
                      ) : doc.status === "Rejected" ? (
                        <button style={{ padding: "5px 13px", borderRadius: 7, border: "none", background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font }}>Approve instead</button>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={{ padding: "5px 11px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}>View</button>
                          <button style={{ padding: "5px 13px", borderRadius: 7, border: "none", background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font }}>Approve</button>
                          <button style={{ padding: "5px 11px", borderRadius: 7, border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font }}>Reject</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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

    </div>
  );
}

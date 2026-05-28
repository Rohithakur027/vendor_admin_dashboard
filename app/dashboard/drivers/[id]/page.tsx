"use client";

import { useParams, useRouter } from "next/navigation";
import { useVendor } from "@/context/VendorContext";
import { DriverHistoryMap } from "@/components/DriverHistoryMap";
import { vendorDriversApi, type DriverDocument } from "@/lib/api";
import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft, Route, TrendingUp, Circle,
  IndianRupee, ArrowRight, User, Phone, Car,
  CheckCircle2, Building2,
} from "lucide-react";
import { Skeleton, SkeletonInline } from "@/components/ui/skeleton";
import { STATUS_STYLES } from "@/components/StatusBadge";
import { detectFileType, type FileType } from "@/components/document-viewer/useDocumentViewer";

const DocumentViewer = dynamic(
  () => import("@/components/document-viewer/DocumentViewer").then(m => ({ default: m.DocumentViewer })),
  { ssr: false },
);

// ── constants ────────────────────────────────────────────────────────────────
const ACCENT = "#2563EB";

const DUMMY_WEEKLY = [320, 0, 480, 750, 210, 680, 540];
const DRIVER_DOCS: { doc_type: string; name: string }[] = [
  { doc_type: "driving_license", name: "Driving License" },
  { doc_type: "insurance", name: "Vehicle Insurance" },
  { doc_type: "tax_certificate", name: "Tax Certificate" },
  { doc_type: "vehicle_rc", name: "Vehicle RC" },
];

// ── helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  try {
    const d = new Date(iso);
    const day  = d.toLocaleDateString("en-GB",  { day: "2-digit", month: "short" });
    const time = d.toLocaleTimeString("en-US",  { hour: "2-digit", minute: "2-digit" }).toLowerCase();
    return { day, time };
  } catch {
    return { day: "—", time: "" };
  }
}

function weeklyEarnings(bookings: { createdAt: string; fare?: number }[]) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0];
    const label   = d.toLocaleDateString("en-IN", { weekday: "short" });
    const real    = bookings.filter(b => b.createdAt.startsWith(dateStr) && (b.fare ?? 0) > 0)
                            .reduce((s, b) => s + (b.fare ?? 0), 0);
    return { label, date: dateStr, total: real > 0 ? real : DUMMY_WEEKLY[i] };
  });
}

// ── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, iconBg, iconColor }: {
  label: string; value: string | number;
  icon: React.ElementType; iconBg: string; iconColor: string;
}) {
  return (
    <div className="p-5 flex items-center justify-between gap-3 bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div>
        <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-[0.06em]">{label}</p>
        <p className="text-[36px] font-extrabold text-slate-900 leading-[1.1] mt-1">{value}</p>
      </div>
      <div
        style={{ background: iconBg, borderRadius: 11 }}
        className="w-[38px] h-[38px] flex items-center justify-center shrink-0"
      >
        <Icon style={{ color: iconColor }} className="h-5 w-5" />
      </div>
    </div>
  );
}

function TripStatusBadge({ status }: { status: string }) {
  const c = STATUS_STYLES[status] ?? STATUS_STYLES["Pending"];
  return (
    <span
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
      className="rounded-[20px] text-[11px] font-bold py-[3px] px-[10px] inline-flex items-center gap-[5px] whitespace-nowrap"
    >
      <span style={{ background: c.dot }} className="w-[6px] h-[6px] rounded-full shrink-0" />
      {status}
    </span>
  );
}

function BarChart({ days }: { days: { label: string; date: string; total: number }[] }) {
  const [mounted, setMounted] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const max   = Math.max(...days.map(d => d.total), 1);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  return (
    <div className="px-1">
      <div className="relative h-40">
        {[0, 33, 66, 100].map(pct => (
          <div key={pct} style={{ bottom: `${pct}%` }} className="absolute left-0 right-0 border-t border-dashed border-slate-100" />
        ))}
        <div className="flex items-end h-full gap-2">
          {days.map((day, i) => {
            const isToday = day.date === today;
            const pct     = day.total > 0 ? (day.total / max) * 100 : 0;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center h-full justify-end">
                {day.total > 0 && (
                  <span
                    style={{ color: isToday ? ACCENT : undefined }}
                    className={`text-[10px] font-bold mb-1 whitespace-nowrap ${isToday ? "" : "text-slate-400"}`}
                  >
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
      <div className="flex gap-2 mt-2">
        {days.map(day => (
          <div key={day.date} className="flex-1 text-center">
            <span
              style={{ color: day.date === today ? ACCENT : undefined, fontWeight: day.date === today ? 800 : 500 }}
              className={`text-[11px] ${day.date === today ? "" : "text-slate-400"}`}
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EarningsBar({ pct, color }: { pct: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), 120); return () => clearTimeout(t); }, [pct]);
  return <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 20, transition: "width 0.7s ease" }} />;
}

function docBadge(doc?: DriverDocument) {
  if (!doc?.submitted) {
    return { label: "Not Submitted", bg: "#F1F5F9", text: "#64748B", border: "#E2E8F0", dot: "#CBD5E1" };
  }
  if (doc.is_verified) {
    return { label: "Verified", bg: "#DCFCE7", text: "#15803D", border: "#BBF7D0", dot: "#22C55E" };
  }
  return { label: "Uploaded", bg: "#DBEAFE", text: "#2563EB", border: "#BFDBFE", dot: "#60A5FA" };
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function DriverProfilePage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { drivers, bookings, isLoading } = useVendor();
  const [activeTab, setActiveTab] = useState("overview");
  const [driverDocuments, setDriverDocuments] = useState<DriverDocument[] | null>(null);
  const [docsLoadedForId, setDocsLoadedForId] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<{ url: string; fileName: string; fileTypeHint?: FileType } | null>(null);
  const docsLoadedRef = useRef(false);

  const driver = drivers.find(d => d.id === id);

  const font        = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";
  const drvInitials = driver ? driver.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "";
  const statusCfg   = driver ? (STATUS_STYLES[driver.status] ?? STATUS_STYLES["Offline"]) : STATUS_STYLES["Offline"];
  const isOnline    = driver ? (driver.status === "Available" || driver.status === "On Trip") : false;

  // bookings filtered to this driver
  const drvBookings    = bookings.filter(b => b.driverId === id);
  const today          = new Date().toISOString().split("T")[0];
  const todayBookings  = drvBookings.filter(b => b.createdAt?.startsWith(today));
  const completedToday = todayBookings.filter(b => b.status === "Completed").length;
  const ongoingCt      = drvBookings.filter(b => b.status === "Ongoing").length;

  // earnings
  const completedTrips = drvBookings.filter(b => b.status === "Completed").length;
  const totalEarned    = drvBookings.reduce((s, b) => s + (b.fare ?? 0), 0);
  const avgPerTrip     = completedTrips > 0 ? Math.round(totalEarned / completedTrips) : 0;
  const displayEarned  = totalEarned > 0 ? totalEarned : 3800;
  const displayAvg     = avgPerTrip > 0 ? avgPerTrip : 760;

  // source breakdown
  const sourceMap: Record<string, number> = {};
  drvBookings.forEach(b => {
    if (!b.fare) return;
    const src = b.bookingSource ?? "Individual";
    sourceMap[src] = (sourceMap[src] ?? 0) + b.fare;
  });
  const DUMMY_SOURCES = { Individual: 1840, Infosys: 890, Wipro: 430 };
  const finalSource   = Object.values(sourceMap).reduce((s, v) => s + v, 0) > 0 ? sourceMap : DUMMY_SOURCES;
  const totalSource   = Object.values(finalSource).reduce((s, v) => s + v, 0);
  const sourceEntries = Object.entries(finalSource).sort((a, b) => b[1] - a[1]);
  const SOURCE_CFG = [
    { name: "Individual", color: "#2563EB", bg: "#DBEAFE", initial: "P" },
    { name: "Infosys",    color: "#6D28D9", bg: "#EDE9FE", initial: "I" },
    { name: "Wipro",      color: "#0891B2", bg: "#CFFAFE", initial: "W" },
  ];
  function srcCfg(name: string) {
    return SOURCE_CFG.find(c => c.name === name) ?? { color: "#64748B", bg: "#F1F5F9", initial: name[0]?.toUpperCase() ?? "?" };
  }

  const weekDays = weeklyEarnings(drvBookings);

  const TABS = [
    { value: "overview", label: "Overview" },
    { value: "trips",    label: "Recent Trips" },
    { value: "earnings", label: "Earnings" },
    { value: "history",  label: "Location History" },
    { value: "settings", label: "Settings" },
  ];

  useEffect(() => {
    docsLoadedRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!id || activeTab !== "settings" || docsLoadedRef.current) return;
    docsLoadedRef.current = true;
    (async () => {
      try {
        const res = await vendorDriversApi.documents(id);
        setDriverDocuments(res.data);
        setDocsLoadedForId(id);
      } catch {
        setDriverDocuments([]);
        setDocsLoadedForId(id);
      }
    })();
  }, [id, activeTab]);

  if (!isLoading && !driver) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-500">Driver not found.</p>
        <button
          onClick={() => router.back()}
          className="text-[13px] text-blue-600 bg-transparent border-none cursor-pointer underline"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: font }} className="text-slate-900">

      {/* ── Page Header ── */}
      <div className="flex items-center gap-[14px] mb-5">
        <button
          onClick={() => router.back()}
          style={{ fontFamily: font }}
          className="flex items-center gap-[6px] py-[7px] px-[14px] border-[1.5px] border-[#E8EEF4] rounded-[10px] bg-white text-[#334155] font-semibold text-[13px] cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="w-px h-7 bg-[#E8EEF4]" />
        <div>
          <p className="text-[17px] font-extrabold text-slate-900">Driver Profile</p>
          <p className="text-[12px] text-slate-500 mt-[1px]">
            {isLoading || !driver ? (
              <SkeletonInline className="h-3 w-32" />
            ) : (
              <>{driver.name} · Full details</>
            )}
          </p>
        </div>
      </div>

      {/* ── Tab Bar — left-aligned underline style matching Supervisor Profile ── */}
      <div className="border-b-[1.5px] border-[#E8EEF4] mb-5">
        <div className="flex">
          {TABS.map(tab => {
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                style={{
                  fontFamily: font,
                  color: active ? ACCENT : undefined,
                  borderBottom: active ? `2.5px solid ${ACCENT}` : "2.5px solid transparent",
                  marginBottom: -1.5,
                }}
                className={`px-[18px] py-[10px] text-[14px] bg-transparent outline-none border-none cursor-pointer whitespace-nowrap transition-colors duration-150 ${active ? "font-bold" : "font-medium text-slate-500"}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ TAB: OVERVIEW ══ */}
      {activeTab === "overview" && (isLoading || !driver ? (
        <div className="flex flex-col gap-4">
          <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-6 py-5 flex items-center gap-[18px]">
            <Skeleton className="h-[60px] w-[60px] rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-3 w-32 shrink-0" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 flex items-center justify-between gap-3 bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-[38px] w-[38px] rounded-xl shrink-0" />
              </div>
            ))}
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "1.1fr 1fr" }}>
            <Skeleton className="h-[120px] rounded-2xl" />
            <div className="space-y-3.5">
              <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-4 space-y-2.5">
                <Skeleton className="h-4 w-32" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* ── Profile card — identical layout to Supervisor Profile ── */}
          <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-6 py-5 flex items-center gap-[18px]">
            {/* Avatar + online dot */}
            <div className="relative shrink-0">
              <div className="w-[60px] h-[60px] rounded-full bg-blue-600 flex items-center justify-center text-white text-[22px] font-extrabold">
                {drvInitials}
              </div>
              <span
                style={{ background: isOnline ? "#22C55E" : "#94A3B8" }}
                className="absolute bottom-[2px] right-[2px] w-[13px] h-[13px] rounded-full border-2 border-white"
              />
            </div>

            {/* Name + badges + contact row */}
            <div className="flex-1 min-w-0">
              {/* Row 1: name + status badge + online text */}
              <div className="flex items-center gap-[10px] flex-wrap">
                <span className="text-[18px] font-extrabold text-slate-900">{driver.name}</span>
                <span
                  style={{ background: statusCfg.bg, color: statusCfg.text, border: `1px solid ${statusCfg.border}` }}
                  className="text-[11px] font-bold py-[2px] px-[10px] rounded-[20px]"
                >
                  {driver.status}
                </span>
                <span
                  style={{ color: isOnline ? "#22C55E" : undefined }}
                  className={`flex items-center gap-1 text-[11px] font-semibold ${isOnline ? "" : "text-slate-400"}`}
                >
                  <Circle className="h-2 w-2 fill-current" />{isOnline ? "Online" : "Offline"}
                </span>
              </div>

              {/* Row 2: contact details with icons */}
              <div className="flex gap-5 mt-2 flex-wrap">
                <span className="flex items-center gap-[5px] text-[12.5px] text-[#334155]">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />{driver.phone}
                </span>
                {driver.vehicle && (
                  <span className="flex items-center gap-[5px] text-[12.5px] text-[#334155]">
                    <Car className="h-3.5 w-3.5 text-slate-400" />{driver.vehicle}
                  </span>
                )}
                {driver.assignedSupervisorName && (
                  <span className="flex items-center gap-[5px] text-[12.5px] text-[#334155]">
                    <User className="h-3.5 w-3.5 text-slate-400" />{driver.assignedSupervisorName}
                  </span>
                )}
              </div>
            </div>

            {/* Last active — far right */}
            <p className="text-[12px] text-slate-400 shrink-0">
              Last active {new Date(driver.lastActive).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* ── 4 stat cards ── */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Total Trips"       value={driver.totalTrips}    icon={Route}        iconBg="#F1F5F9" iconColor="#0F172A" />
            <StatCard label="Today's Trips"  value={todayBookings.length} icon={Route}        iconBg="#F1F5F9" iconColor="#0F172A" />
            <StatCard label="Today's Completed" value={completedToday}       icon={CheckCircle2} iconBg="#F1F5F9" iconColor="#0F172A" />
            <StatCard label="Ongoing"           value={ongoingCt}            icon={Circle}       iconBg="#F1F5F9" iconColor="#0F172A" />
          </div>

          {/* ── Earnings card (left) + right column — same split as Supervisor's Wallet section ── */}
          <div className="grid gap-4" style={{ gridTemplateColumns: "1.1fr 1fr" }}>

            {/* Solid blue earnings card — matches Supervisor "Wallet Balance" card exactly */}
            <div className="rounded-[18px] px-5 pt-4 pb-[14px] flex flex-col justify-between relative overflow-hidden min-h-[120px]"
              style={{ background: "linear-gradient(135deg, #1e40af 0%, #2563EB 60%, #3b82f6 100%)" }}
            >
              <div className="absolute -top-6 -right-6 w-[120px] h-[120px] rounded-full bg-white/[0.07]" />
              <div className="absolute -bottom-[30px] right-[30px] w-[90px] h-[90px] rounded-full bg-white/[0.05]" />

              <p className="text-[10.5px] font-bold text-white/75 uppercase tracking-[0.8px]">
                Trip Earnings
              </p>
              <p className="text-[32px] font-extrabold text-white leading-none tracking-[-1px] my-2">
                ₹{displayEarned.toLocaleString("en-IN")}
              </p>
              <div className="flex gap-4 text-[12px] text-white/70 font-medium">
                <span>{completedTrips || driver.totalTrips} trips completed</span>
                <span>·</span>
                <span>Avg ₹{displayAvg} / trip</span>
              </div>
            </div>

            {/* Right column: Assigned Supervisor card + Recent Activity card */}
            <div className="flex flex-col gap-[14px]">

              {/* Assigned Supervisor — same structure as Supervisor's "Assigned Companies" card */}
              <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between px-[18px] pt-4 pb-3">
                  <div className="flex items-center gap-[10px]">
                    <div className="bg-slate-100 border border-slate-200 rounded-[9px] p-[7px]">
                      <Building2 className="h-4 w-4 text-slate-900" />
                    </div>
                    <div>
                      <p className="text-[14px] font-extrabold text-slate-900">Assigned Supervisor</p>
                      <p className="text-[11px] text-slate-400">Current assignment</p>
                    </div>
                  </div>
                  <span className="bg-slate-100 text-slate-500 text-[11px] font-bold py-[2px] px-[10px] rounded-[20px]">
                    {driver.assignedSupervisorName ? "1 assigned" : "None"}
                  </span>
                </div>
                <div className="px-4 pb-4 flex flex-wrap gap-2">
                  {driver.assignedSupervisorName ? (
                    <span className="inline-flex items-center bg-blue-600 text-white text-[12px] font-bold py-[6px] px-[14px] rounded-lg">
                      {driver.assignedSupervisorName}
                    </span>
                  ) : (
                    <p className="text-slate-400 text-[12.5px] py-[6px]">No supervisor assigned.</p>
                  )}
                  {driver.vehicle && (
                    <span className="inline-flex items-center gap-[5px] bg-slate-50 border border-[#E8EEF4] text-[#334155] text-[12px] font-semibold py-[6px] px-3 rounded-lg">
                      <Car className="h-3 w-3 text-slate-400" /> {driver.vehicle}
                    </span>
                  )}
                </div>
              </div>

              {/* Recent Activity — same structure as Supervisor's "Recent Activity" card */}
              <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] flex-1">
                <div className="flex items-center justify-between px-[18px] pt-4 pb-3">
                  <p className="text-[14px] font-extrabold text-slate-900">Recent Activity</p>
                  <button
                    onClick={() => setActiveTab("trips")}
                    style={{ fontFamily: font }}
                    className="text-[12px] font-bold text-blue-600 bg-transparent border-none cursor-pointer"
                  >
                    View all →
                  </button>
                </div>
                <div>
                  {(drvBookings.length > 0 ? drvBookings : []).slice(0, 4).map(booking => {
                    const sc = STATUS_STYLES[booking.status] ?? STATUS_STYLES["Pending"];
                    return (
                      <div key={booking.id} className="flex items-center justify-between px-[18px] py-[10px] border-t border-slate-50">
                        <div className="flex items-start gap-[10px] flex-1 min-w-0">
                          <span style={{ background: sc.dot }} className="mt-[5px] w-2 h-2 rounded-full shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">
                              {booking.pickupLocation} → {booking.dropLocation}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-[2px]">{fmtDate(booking.createdAt)}</p>
                          </div>
                        </div>
                        <span className="text-[13px] font-extrabold text-slate-900 shrink-0 ml-4">
                          {booking.fare ? `₹${booking.fare.toLocaleString()}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                  {drvBookings.length === 0 && driver.recentTrips.slice(0, 4).map(trip => (
                    <div key={trip.bookingId} className="flex items-center justify-between px-[18px] py-[10px] border-t border-slate-50">
                      <div className="flex items-start gap-[10px] flex-1 min-w-0">
                        <span className="mt-[5px] w-2 h-2 rounded-full shrink-0 bg-[#22C55E]" />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">
                            {trip.from} → {trip.to}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-[2px]">{trip.date}</p>
                        </div>
                      </div>
                      <span className="text-[13px] font-extrabold text-slate-900 shrink-0 ml-4">—</span>
                    </div>
                  ))}
                  {drvBookings.length === 0 && driver.recentTrips.length === 0 && (
                    <p className="text-center text-slate-400 text-[12.5px] py-4 pb-5">No recent trips.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      ))}

      {/* ══ TAB: RECENT TRIPS ══ */}
      {activeTab === "trips" && (
        <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          {/* Header — matches Active Trips table column scheme */}
          <div
            className="grid gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50 rounded-t-[14px]"
            style={{ gridTemplateColumns: "110px 2fr 150px 1.3fr 110px 90px" }}
          >
            {["TRIP ID & TYPE", "ROUTE", "SUPERVISOR", "VEHICLE", "STATUS", "CREATED AT"].map(h => (
              <span key={h} className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.07em]">{h}</span>
            ))}
          </div>

          {isLoading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="grid gap-4 px-5 py-[14px] items-center"
                  style={{
                    gridTemplateColumns: "110px 2fr 150px 1.3fr 110px 90px",
                    borderBottom: i < 4 ? "1px solid #F8FAFC" : "none",
                  }}
                >
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-16" />
                    <Skeleton className="h-4 w-12 rounded" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-2 w-16" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-14" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              ))}
            </div>
          ) : !driver ? null : drvBookings.length > 0 ? (
            <div>
              {drvBookings.map((booking, idx) => {
                const { day, time } = fmtDateTime(booking.createdAt);
                return (
                  <div
                    key={booking.id}
                    className="grid gap-4 px-5 py-[14px] items-center"
                    style={{
                      gridTemplateColumns: "110px 2fr 150px 1.3fr 110px 90px",
                      borderBottom: idx < drvBookings.length - 1 ? "1px solid #F8FAFC" : "none",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {/* TRIP ID & TYPE */}
                    <div className="flex flex-col gap-1">
                      <span className="font-extrabold text-slate-900 text-[13px]">{booking.bookingRef ?? "—"}</span>
                      <span
                        style={{
                          background: booking.type === "Instant" ? "#EEF2FF" : "#FEF3C7",
                          color: booking.type === "Instant" ? "#2563EB" : "#B45309",
                        }}
                        className="text-[10px] font-bold py-[2px] px-[7px] rounded-[4px] inline-block w-fit"
                      >
                        {booking.type}
                      </span>
                    </div>

                    {/* ROUTE */}
                    <div className="flex flex-col gap-[1px] min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">{booking.pickupLocation}</p>
                      <div className="flex items-center gap-[3px]">
                        <div
                          className="w-[42px] h-[2px] rounded-[2px]"
                          style={{ background: `linear-gradient(to right,#A5B4FC,${ACCENT})` }}
                        />
                        <ArrowRight className="h-3 w-3" style={{ color: ACCENT }} />
                      </div>
                      <p className="text-[12px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">{booking.dropLocation}</p>
                    </div>

                    {/* SUPERVISOR */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[13px] text-[#334155] font-medium overflow-hidden text-ellipsis whitespace-nowrap">{booking.supervisorName}</span>
                      {booking.bookingSource && (
                        <span className="bg-slate-200 text-slate-600 border border-slate-300 text-[11px] font-semibold py-[1px] px-2 rounded-[5px] inline-block w-fit">
                          {booking.bookingSource}
                        </span>
                      )}
                    </div>

                    {/* VEHICLE */}
                    <div className="flex flex-col gap-[2px]">
                      <span className="text-[13px] text-[#334155] font-medium">{driver.vehicleReg ?? driver.vehicle ?? "—"}</span>
                      {driver.vehicleReg && driver.vehicle && (
                        <span className="text-[11px] text-slate-500 font-medium">{driver.vehicle}</span>
                      )}
                    </div>

                    {/* STATUS */}
                    <TripStatusBadge status={booking.status} />

                    {/* CREATED AT */}
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium text-[#334155]">{day}</span>
                      <span className="text-[11px] text-slate-400 font-medium mt-[2px]">{time}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : driver.recentTrips.length > 0 ? (
            <div>
              {driver.recentTrips.map((trip, idx) => (
                <div
                  key={trip.bookingId}
                  className="grid gap-4 px-5 py-[14px] items-center"
                  style={{
                    gridTemplateColumns: "110px 2fr 150px 1.3fr 110px 90px",
                    borderBottom: idx < driver.recentTrips.length - 1 ? "1px solid #F8FAFC" : "none",
                  }}
                >
                  {/* TRIP ID & TYPE */}
                  <div className="flex flex-col gap-1">
                    <span className="font-extrabold text-slate-900 text-[13px]">{trip.bookingId}</span>
                    <span className="bg-[#EEF2FF] text-blue-600 text-[10px] font-bold py-[2px] px-[7px] rounded-[4px] inline-block w-fit">Instant</span>
                  </div>

                  {/* ROUTE */}
                  <div className="flex flex-col gap-[1px] min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">{trip.from}</p>
                    <div className="flex items-center gap-[3px]">
                      <div
                        className="w-[42px] h-[2px] rounded-[2px]"
                        style={{ background: `linear-gradient(to right,#A5B4FC,${ACCENT})` }}
                      />
                      <ArrowRight className="h-3 w-3" style={{ color: ACCENT }} />
                    </div>
                    <p className="text-[12px] text-slate-500 overflow-hidden text-ellipsis whitespace-nowrap">{trip.to}</p>
                  </div>

                  {/* SUPERVISOR */}
                  <span className="text-[13px] text-[#334155] font-medium overflow-hidden text-ellipsis whitespace-nowrap">{trip.supervisorName}</span>

                  {/* VEHICLE */}
                  <div className="flex flex-col gap-[2px]">
                    <span className="text-[13px] text-[#334155] font-medium">{driver.vehicleReg ?? driver.vehicle ?? "—"}</span>
                    {driver.vehicleReg && driver.vehicle && (
                      <span className="text-[11px] text-slate-500 font-medium">{driver.vehicle}</span>
                    )}
                  </div>

                  {/* STATUS */}
                  <TripStatusBadge status="Completed" />

                  {/* CREATED AT */}
                  <div className="flex flex-col">
                    <span className="text-[13px] font-medium text-[#334155]">{trip.date}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-10 text-slate-400 text-[13px]">No trips yet.</p>
          )}
        </div>
      )}

      {/* ══ TAB: EARNINGS ══ */}
      {activeTab === "earnings" && (isLoading || !driver ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-[14px]">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-[14px]">
            <StatCard label="Total Earned"    value={`₹${displayEarned.toLocaleString()}`}         icon={IndianRupee} iconBg="#DBEAFE" iconColor="#2563EB" />
            <StatCard label="Completed Trips" value={completedTrips || driver.totalTrips}            icon={CheckCircle2} iconBg="#DCFCE7" iconColor="#15803D" />
            <StatCard label="Avg per Trip"    value={`₹${displayAvg.toLocaleString()}`}             icon={TrendingUp}   iconBg="#EDE9FE" iconColor="#6D28D9" />
          </div>

          <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between px-[22px] pt-[18px] pb-2">
              <div>
                <p className="text-[15px] font-extrabold text-slate-900">Daily Earnings — Last 7 Days</p>
                <p className="text-[12px] text-slate-400 mt-[3px]">
                  Week total: <span className="font-bold text-[#334155]">₹{weekDays.reduce((s, d) => s + d.total, 0).toLocaleString()}</span>
                </p>
              </div>
              <div className="flex gap-[14px] text-[11px] text-slate-500">
                <span className="flex items-center gap-[5px]">
                  <span className="w-[10px] h-[10px] rounded-[3px] bg-blue-600 inline-block" /> Today
                </span>
                <span className="flex items-center gap-[5px]">
                  <span className="w-[10px] h-[10px] rounded-[3px] bg-[#BFDBFE] inline-block" /> Past days
                </span>
              </div>
            </div>
            <div className="px-[22px] pt-1 pb-[18px]">
              <BarChart days={weekDays} />
            </div>
          </div>

          <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between px-5 pt-4 pb-3">
              <p className="text-[15px] font-extrabold text-slate-900">Earnings by Source</p>
              <span className="text-[12px] text-slate-400">{sourceEntries.length} sources</span>
            </div>
            <div className="px-5 pb-5 flex flex-col gap-[14px]">
              {sourceEntries.map(([source, amount]) => {
                const pct      = totalSource > 0 ? (amount / totalSource) * 100 : 0;
                const cfg      = srcCfg(source);
                const tripCount = drvBookings.filter(b => (b.bookingSource ?? "Individual") === source && b.fare).length || (source === "Individual" ? 5 : 3);
                return (
                  <div key={source}>
                    <div className="flex items-center justify-between mb-[7px]">
                      <div className="flex items-center gap-[10px]">
                        <div
                          style={{ background: cfg.bg, color: cfg.color }}
                          className="w-[30px] h-[30px] rounded-lg text-[12px] font-extrabold flex items-center justify-center"
                        >
                          {cfg.initial}
                        </div>
                        <span className="text-[13.5px] font-bold text-slate-900">{source}</span>
                        <span className="text-[11.5px] text-slate-400">{tripCount} trip{tripCount !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[14px] font-extrabold text-slate-900">₹{amount.toLocaleString()}</span>
                        <span className="text-[11px] text-slate-400 ml-2">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-[20px] bg-slate-100 overflow-hidden">
                      <EarningsBar pct={pct} color={cfg.color} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {/* ══ TAB: LOCATION HISTORY ══ */}
      {activeTab === "history" && (isLoading || !driver ? (
        <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-6 py-5">
          <Skeleton className="h-5 w-48 mb-4" />
          <Skeleton className="h-[380px] w-full rounded-xl" />
        </div>
      ) : (
        <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] px-6 py-5">
          <div className="mb-4">
            <p className="text-[15px] font-extrabold text-slate-900">Location History</p>
            <p className="text-[12px] text-slate-400 mt-[3px]">GPS route replay for {driver.name}</p>
          </div>
          <DriverHistoryMap
            driverId={String(id)}
            driverName={driver.name}
            hours={12}
            fetchPoints={async (dId, range) => {
              const res = await vendorDriversApi.locationHistory(dId, range);
              return res.data?.history ?? [];
            }}
          />
        </div>
      ))}

      {/* ══ TAB: SETTINGS ══ */}
      {activeTab === "settings" && (
        <div className="flex flex-col gap-4">
          <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <div className="mb-5">
              <p className="text-[16px] font-extrabold text-slate-900">Driver Information</p>
              <p className="text-[12.5px] text-slate-400 mt-[3px]">Full profile details for this driver</p>
            </div>
            {(() => {
              type SettingsEntry =
                | { label: string; value: string; _skeleton?: false; _key?: never }
                | { label: string; value: string; _skeleton: true; _key: number };

              const settingsEntries: SettingsEntry[] = isLoading || !driver
                ? Array.from({ length: 8 }).map((_, i) => ({ label: "", value: "", _skeleton: true, _key: i }))
                : [
                  { label: "Full Name",           value: driver.name },
                  { label: "Phone Number",        value: driver.phone },
                  { label: "Vehicle",             value: driver.vehicle ?? "—" },
                  { label: "Vehicle Reg No.",     value: driver.vehicleReg ?? "—" },
                  { label: "Vehicle Type",        value: driver.vehicleType ?? "—" },
                  { label: "Vehicle Color",       value: driver.vehicleColor ?? "—" },
                  { label: "Status",              value: driver.status },
                  { label: "Assigned Supervisor", value: driver.assignedSupervisorName ?? "None" },
                ];

              return (
            <div className="grid grid-cols-2 gap-5">
              {settingsEntries.map((entry) => (
                <div key={entry._key ?? entry.label}>
                  {entry._skeleton ? (
                    <>
                      <Skeleton className="h-3 w-24 mb-2" />
                      <Skeleton className="h-4 w-32" />
                    </>
                  ) : (
                    <>
                      <p className="text-[11.5px] font-semibold text-slate-400 uppercase tracking-[0.06em] mb-[5px]">{entry.label}</p>
                      <p className="text-[14px] font-bold text-slate-900">{entry.value}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
              );
            })()}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-[12.5px] text-slate-400">To edit driver details, use the driver management section.</p>
            </div>
          </div>

          <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[16px] font-extrabold text-slate-900">Documents</p>
                <p className="text-[12.5px] text-slate-400 mt-[3px]">Driver licence and vehicle document records</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="text-[12px] font-bold text-blue-600 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[20px] py-1 px-3">
                  {driverDocuments?.length ?? 0} total
                </span>
                <span className="text-[12px] font-bold text-[#15803D] bg-[#DCFCE7] border border-[#BBF7D0] rounded-[20px] py-1 px-3">
                  {driverDocuments?.filter(doc => doc.is_verified).length ?? 0} verified
                </span>
              </div>
            </div>

            {docsLoadedForId !== id ? (
              <div className="grid gap-4" style={{ gridTemplateColumns: "1.4fr 0.9fr 0.9fr 0.8fr" }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className={`py-[14px] ${i === 0 ? "border-t border-slate-100" : "border-t border-slate-50"}`}>
                    <Skeleton className="h-3.5 w-40 mb-2" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <div
                  className="grid gap-4 px-5 py-[11px] bg-slate-50 border-b border-slate-200"
                  style={{ gridTemplateColumns: "1.4fr 0.9fr 0.9fr 0.8fr" }}
                >
                  {["DOCUMENT", "STATUS", "FILE", "ACTION"].map(h => (
                    <span key={h} className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.07em]">{h}</span>
                  ))}
                </div>

                {DRIVER_DOCS.map((def, idx) => {
                  const doc = driverDocuments?.find(d => d.doc_type === def.doc_type);
                  const badge = docBadge(doc);
                  const isLast = idx === DRIVER_DOCS.length - 1;
                  return (
                    <div
                      key={def.doc_type}
                      className="grid gap-4 px-5 py-[14px] items-center"
                      style={{
                        gridTemplateColumns: "1.4fr 0.9fr 0.9fr 0.8fr",
                        borderBottom: isLast ? "none" : "1px solid #F8FAFC",
                      }}
                    >
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-bold text-slate-900">{def.name}</p>
                        <p className="text-[11.5px] text-slate-400 mt-[2px]">{doc?.doc_number ?? "No document number"}</p>
                      </div>

                      <span
                        style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}
                        className="inline-flex items-center gap-[5px] text-[11.5px] font-bold py-[3px] px-[10px] rounded-[20px] w-fit"
                      >
                        <span style={{ background: badge.dot }} className="w-[6px] h-[6px] rounded-full shrink-0" />
                        {badge.label}
                      </span>

                      <span className="text-[12.5px] text-[#334155] font-semibold">
                        {doc?.expiry_date ? new Date(doc.expiry_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </span>

                      <div>
                        {doc?.file_url ? (
                          <button
                            onClick={() => setViewingDoc({
                              url: doc.file_url!,
                              fileName: def.name,
                              fileTypeHint: detectFileType(doc.file_url!),
                            })}
                            style={{ fontFamily: font }}
                            className="py-[5px] px-[11px] rounded-[7px] border-[1.5px] border-slate-200 bg-white text-slate-600 text-[12px] font-semibold cursor-pointer"
                          >
                            View
                          </button>
                        ) : (
                          <span className="text-[12.5px] text-slate-400 italic">Not available</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {viewingDoc && (
        <DocumentViewer
          url={viewingDoc.url}
          fileName={viewingDoc.fileName}
          fileTypeHint={viewingDoc.fileTypeHint}
          onClose={() => setViewingDoc(null)}
        />
      )}

    </div>
  );
}

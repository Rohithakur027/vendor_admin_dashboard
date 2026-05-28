"use client";

import { useParams, useRouter } from "next/navigation";
import { useVendor } from "@/context/VendorContext";
import { useState, useEffect, useRef } from "react";
import { supervisorsApi } from "@/lib/api";
import { PanelSupervisorReport } from "@/modules/reports/PanelSupervisorReport";
import {
  ArrowLeft, Plus, X, Wallet, Route, TrendingUp,
  Building2, User, IndianRupee, ArrowRight, Receipt,
  Check, AlertTriangle, Trash2, Circle, Mail, Phone, MapPin,
  CheckCircle2, XCircle, Eye, EyeOff, KeyRound,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonInline } from "@/components/ui/skeleton";
import { STATUS_STYLES } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";
import type { Booking } from "@/modules/bookings/types";
import { SearchBar } from "@/components/SearchBar";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { ExportButton } from "@/components/ExportButton";
import { exportToXlsx } from "@/lib/exportXlsx";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";
import { TripsTable } from "@/modules/bookings/components/TripsTable";
import { buildTripRenderers } from "@/modules/bookings/tripRenderers";
import { TripDateFilter, type TripPeriod } from "@/components/TripDateFilter";
import { toIsoDate } from "@/modules/reports/primitives";

// Own preference key so a vendor admin can configure the supervisor profile's
// Recent Trips table independently of the global Past Trips view.
const SUPERVISOR_TRIPS_TABLE_KEY = "supervisorRecentTrips" as const;

// ── constants ───────────────────────────────────────────────────────────────
const ACCENT = "#2563EB";

const DUMMY_WEEKLY = [420, 0, 180, 650, 320, 780, 640];
const DUMMY_SPEND  = { Infosys: 1840, Wipro: 710, Individual: 440 };

// ── helpers ─────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function weeklySpend(bookings: { createdAt: string; fare?: number }[]) {
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

// ── Stat Card ────────────────────────────────────────────────────────────────
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
        style={{ background: iconBg, borderRadius: 11, flexShrink: 0 }}
        className="w-[38px] h-[38px] flex items-center justify-center"
      >
        <Icon style={{ color: iconColor }} className="h-5 w-5" />
      </div>
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const c = STATUS_STYLES[status] ?? STATUS_STYLES["Pending"];
  return (
    <span
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
      className="rounded-[20px] text-[11px] font-bold px-[10px] py-[3px] inline-flex items-center gap-[5px] whitespace-nowrap"
    >
      <span style={{ background: c.dot }} className="w-[6px] h-[6px] rounded-full shrink-0" />
      {status}
    </span>
  );
}

// ── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ days }: { days: { label: string; date: string; total: number }[] }) {
  const [mounted, setMounted] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const max   = Math.max(...days.map(d => d.total), 1);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  return (
    <div className="px-1">
      {/* Grid lines */}
      <div className="relative h-[160px]">
        {[0, 33, 66, 100].map(pct => (
          <div key={pct} style={{ bottom: `${pct}%` }} className="absolute left-0 right-0 border-t border-dashed border-slate-100" />
        ))}
        <div className="flex items-end h-full gap-2">
          {days.map((day, i) => {
            const isToday = day.date === today;
            const pct     = day.total > 0 ? (day.total / max) * 100 : 0;
            const delay   = i * 60;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center h-full justify-end">
                {day.total > 0 && (
                  <span
                    style={{ color: isToday ? ACCENT : undefined }}
                    className={`text-[10px] font-bold mb-1 whitespace-nowrap${isToday ? "" : " text-slate-400"}`}
                  >
                    ₹{day.total}
                  </span>
                )}
                <div
                  style={{
                    width: "70%",
                    borderRadius: "6px 6px 0 0",
                    background: isToday ? ACCENT : "#BFDBFE",
                    boxShadow: isToday ? `0 4px 14px ${ACCENT}50` : "none",
                    height: mounted ? `${Math.max(pct, day.total > 0 ? 4 : 0)}%` : "0%",
                    transition: `height 0.7s cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      {/* Labels */}
      <div className="flex gap-2 mt-2">
        {days.map(day => {
          const isToday = day.date === today;
          return (
            <div key={day.date} className="flex-1 text-center">
              <span
                style={{ color: isToday ? ACCENT : undefined }}
                className={`text-[11px]${isToday ? " font-extrabold" : " font-medium text-slate-400"}`}
              >
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SupervisorDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { supervisors, bookings, drivers, updateSupervisor, deleteSupervisor, toggleAppAccess, isLoading } = useVendor();

  const [fetchedSup,   setFetchedSup]   = useState<typeof supervisors[0] | null>(null);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [activeTab,    setActiveTab]    = useState("overview");

  // Column visibility for the Recent Trips table — same plumbing as Past Trips.
  const {
    columns: tripsVisibleCols,
    toggle:  toggleTripsCol,
    reset:   resetTripsCols,
    totalCount: tripsTotalCols,
    loading: tripsPrefsLoading,
  } = useColumnPreferences(SUPERVISOR_TRIPS_TABLE_KEY);
  const tripsSpec = getTableSpec(SUPERVISOR_TRIPS_TABLE_KEY);
  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [settingsSection, setSettingsSection] = useState<"profile" | "security">("profile");
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", zone: "", status: "Active", shift: "Morning", companies: [] as { name: string; address: string | null; city: string | null; state: string | null; pincode: string | null }[] });
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState<string | null>(null);
  const [toast,      setToast]      = useState<string>("");
  const [addCompanyInput, setAddCompanyInput] = useState("");
  const [showAddCompany, setShowAddCompany] = useState(false);

  // ── Account & Security state ──
  const [appAccessSaving, setAppAccessSaving] = useState(false);
  const [appAccessError,  setAppAccessError]  = useState<string | null>(null);

  const [pwForm,    setPwForm]    = useState({ password: "", confirm: "" });
  const [pwShow,    setPwShow]    = useState(false);
  const [pwSaving,  setPwSaving]  = useState(false);
  const [pwSaved,   setPwSaved]   = useState(false);
  const [pwError,   setPwError]   = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteSaving,  setDeleteSaving]  = useState(false);
  const [deleteError,   setDeleteError]   = useState<string | null>(null);
  const [selectedBooking,  setSelectedBooking]  = useState<Booking | null>(null);
  const [tripSearch,       setTripSearch]       = useState("");
  const [tripPeriod,       setTripPeriod]       = useState<TripPeriod>("all");
  const [tripDateFrom,     setTripDateFrom]     = useState("");
  const [tripDateTo,       setTripDateTo]       = useState("");

  function addCompany() {
    const t = addCompanyInput.trim();
    if (!t) { setAddCompanyInput(""); return; }
    if (editForm.companies.some(c => c.name.toLowerCase() === t.toLowerCase())) {
      setAddCompanyInput("");
      return;
    }
    setEditForm(f => ({ ...f, companies: [...f.companies, { name: t, address: null, city: null, state: null, pincode: null }] }));
    setAddCompanyInput("");
  }

  function removeCompany(name: string) {
    setEditForm(f => ({ ...f, companies: f.companies.filter(c => c.name !== name) }));
  }

  function updateCompanyField(name: string, key: "address" | "city" | "state" | "pincode", value: string) {
    setEditForm(f => ({
      ...f,
      companies: f.companies.map(c => c.name === name ? { ...c, [key]: value || null } : c),
    }));
  }

  useEffect(() => {
    const sup = supervisors.find(s => s.id === id);
    if (sup) setEditForm({ name: sup.name, email: sup.email, phone: sup.phone, zone: sup.zone, status: sup.status, shift: "Morning", companies: sup.companies ?? [] });
  }, [id, supervisors]);

  // Fetch directly from API if not present in context (e.g. direct URL nav)
  useEffect(() => {
    if (isLoading) return;
    if (supervisors.find(s => s.id === id)) return;
    setFetchLoading(true);
    supervisorsApi.get(id)
      .then(res => {
        const sup = res.data as unknown as typeof supervisors[0];
        setFetchedSup(sup);
        setEditForm({ name: sup.name, email: sup.email, phone: sup.phone, zone: sup.zone, status: sup.status, shift: "Morning", companies: sup.companies ?? [] });
      })
      .catch(() => setFetchedSup(null))
      .finally(() => setFetchLoading(false));
  }, [id, isLoading, supervisors]);

  const supervisor = supervisors.find(s => s.id === id) ?? fetchedSup;

  if (!isLoading && !fetchLoading && !supervisor) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-slate-500">Supervisor not found.</p>
        <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="h-4 w-4 mr-2" />Go Back</Button>
      </div>
    );
  }


  // bookings
  const supBookings  = bookings.filter(b => b.supervisorId === id);
  const today        = new Date().toISOString().split("T")[0];
  const completedCt  = supBookings.filter(b => b.status === "Completed" && b.createdAt?.startsWith(today)).length;
  const ongoingCt    = supBookings.filter(b => b.status === "Ongoing").length;
  const cancelledCt  = supBookings.filter(b => b.status === "Cancelled").length;
  const sup_initials = supervisor ? supervisor.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "";

  // spend
  const spendMap: Record<string, number> = {};
  supBookings.forEach(b => {
    if (!b.fare) return;
    const src = b.bookingSource ?? "Individual";
    spendMap[src] = (spendMap[src] ?? 0) + b.fare;
  });
  const finalSpend   = Object.values(spendMap).reduce((s, v) => s + v, 0) > 0 ? spendMap : DUMMY_SPEND;
  const totalSpend   = Object.values(finalSpend).reduce((s, v) => s + v, 0);
  const spendEntries = Object.entries(finalSpend).sort((a, b) => b[1] - a[1]);

  const companySrc   = [
    { name: "Infosys",    color: "#2563EB", bg: "#DBEAFE", initial: "I" },
    { name: "Wipro",      color: "#6D28D9", bg: "#EDE9FE", initial: "W" },
    { name: "Individual", color: "#0891B2", bg: "#CFFAFE", initial: "P" },
  ];
  function srcCfg(name: string) {
    return companySrc.find(c => c.name === name) ?? { color: "#64748B", bg: "#F1F5F9", initial: name[0]?.toUpperCase() ?? "?" };
  }

  // weekly chart
  const weekDays = weeklySpend(supBookings);

  const TABS = [
    { value: "overview", label: "Overview" },
    { value: "bookings", label: "Recent Trips" },
    { value: "spend",    label: "Summary" },
    { value: "settings", label: "Settings" },
  ];

  const font = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

  return (
    <div style={{ fontFamily: font }} className="text-slate-900">

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[300] bg-[#f0fdf4] border-[1.5px] border-[#bbf7d0] rounded-xl px-[18px] py-3 flex items-center gap-[10px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] max-w-[340px]">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-[13.5px] font-semibold text-green-700">{toast}</span>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-[14px]">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-[6px] px-[14px] py-[7px] border-[1.5px] border-[#E8EEF4] rounded-[10px] bg-white text-[#334155] font-semibold text-[13px] cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="w-px h-7 bg-[#E8EEF4]" />
          <div>
            <p className="text-[17px] font-extrabold text-slate-900">Supervisor Profile</p>
            <p className="text-[12px] text-slate-500 mt-[1px]">
              {isLoading || fetchLoading || !supervisor ? (
                <SkeletonInline className="h-3 w-32" />
              ) : (
                <>{supervisor.name} · Full details</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="border-b-[1.5px] border-[#E8EEF4] mb-5">
        <div className="flex gap-0">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{
                fontFamily: font,
                color: activeTab === tab.value ? ACCENT : undefined,
                borderBottom: activeTab === tab.value ? `2.5px solid ${ACCENT}` : "2.5px solid transparent",
                fontWeight: activeTab === tab.value ? 700 : 500,
              }}
              className={`px-[18px] py-[10px] text-[14px] border-t-0 border-l-0 border-r-0 bg-none cursor-pointer whitespace-nowrap transition-colors duration-150${activeTab === tab.value ? "" : " text-slate-500"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ TAB: OVERVIEW ══ */}
      {activeTab === "overview" && (isLoading || fetchLoading || !supervisor ? (
        <div className="flex flex-col gap-4">
          <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 flex items-center gap-[18px]">
            <Skeleton className="h-[60px] w-[60px] rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-3 w-32 shrink-0" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 flex items-center justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-[38px] w-[38px] rounded-xl shrink-0" />
              </div>
            ))}
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "1.1fr 1fr" }}>
            <Skeleton className="h-[110px] rounded-2xl" />
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

          {/* Profile card */}
          <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5 flex items-center gap-[18px]">
            <div className="relative">
              <div
                style={{ background: ACCENT }}
                className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-white text-[22px] font-extrabold"
              >
                {sup_initials}
              </div>
              {supervisor.isOnline && (
                <span className="absolute bottom-[2px] right-[2px] w-[13px] h-[13px] rounded-full bg-green-500 border-2 border-white" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-[10px]">
                <span className="text-[18px] font-extrabold">{supervisor.name}</span>
                <span
                  style={{
                    background: supervisor.status === "Active" ? "#DCFCE7" : "#F1F5F9",
                    color: supervisor.status === "Active" ? "#15803D" : "#64748B",
                  }}
                  className="text-[11px] font-bold px-[10px] py-[2px] rounded-[20px]"
                >
                  {supervisor.status}
                </span>
                <span
                  style={{ color: supervisor.isOnline ? "#22C55E" : undefined }}
                  className={`flex items-center gap-1 text-[11px] font-semibold${supervisor.isOnline ? "" : " text-slate-400"}`}
                >
                  <Circle className="h-2 w-2 fill-current" />{supervisor.isOnline ? "Online" : "Offline"}
                </span>
              </div>
              <div className="flex gap-5 mt-2 flex-wrap">
                {[
                  { icon: Mail,   val: supervisor.email },
                  { icon: Phone,  val: supervisor.phone },
                  ...(supervisor.zone ? [{ icon: MapPin, val: supervisor.zone }] : []),
                ].map(({ icon: Icon, val }) => (
                  <span key={val} className="flex items-center gap-[5px] text-[12.5px] text-[#334155]">
                    <Icon className="h-3.5 w-3.5 text-slate-400" />{val}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[12px] text-slate-400 shrink-0">
              Joined {new Date(supervisor.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* 4 Stat chips */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Today's Spend"     value={`₹${(supervisor.dailyHistory.find((d) => d.date === today)?.amount ?? 0).toLocaleString("en-IN")}`} icon={Wallet}     iconBg="#F1F5F9" iconColor="#0F172A" />
            <StatCard label="Assigned Companies" value={supervisor.companies.length} icon={Building2} iconBg="#F1F5F9" iconColor="#0F172A" />
            <StatCard label="Status"             value={supervisor.status}             icon={CheckCircle2} iconBg="#F1F5F9" iconColor="#0F172A" />
            <StatCard label="Presence"           value={supervisor.isOnline ? "Online" : "Offline"} icon={Circle} iconBg="#F1F5F9" iconColor="#0F172A" />
          </div>

          {/* Wallet + Right column */}
          <div className="grid gap-4" style={{ gridTemplateColumns: "1.1fr 1fr" }}>

            {/* Wallet Card — blue gradient matching dashboard */}
            {/* No alignSelf — grid stretches it to match Assigned Companies' height. */}
            <div
              className="rounded-[18px] px-[22px] pt-[18px] pb-[20px] relative overflow-hidden flex flex-col justify-center"
              style={{
                background: "linear-gradient(135deg, #1e40af 0%, #2563EB 60%, #3b82f6 100%)",
              }}
            >
              {/* decorative circles */}
              <div className="absolute top-[-24px] right-[-24px] w-[110px] h-[110px] rounded-full bg-white/[0.07]" />
              <div className="absolute bottom-[-30px] right-6 w-[80px] h-[80px] rounded-full bg-white/[0.05]" />

              <div className="text-[10.5px] font-bold text-white/75 uppercase tracking-[0.8px] mb-2">
                Today&apos;s Spend
              </div>
              <div className="text-[36px] font-extrabold text-white leading-none tracking-[-1px]">
                ₹{(supervisor.dailyHistory.find((d) => d.date === today)?.amount ?? 0).toLocaleString("en-IN")}
              </div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-[14px]">

              {/* Assigned Companies */}
              <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between px-[18px] pt-4 pb-3">
                  <div className="flex items-center gap-[10px]">
                    <div className="bg-slate-100 border border-[#E2E8F0] rounded-[9px] p-[7px]">
                      <Building2 className="h-4 w-4 text-slate-900" />
                    </div>
                    <div>
                      <p className="text-[14px] font-extrabold text-slate-900">Assigned Companies</p>
                      <p className="text-[11px] text-slate-400">Corporate clients</p>
                    </div>
                  </div>
                  <span className="bg-slate-100 text-slate-500 text-[11px] font-bold px-[10px] py-[2px] rounded-[20px]">
                    {supervisor.companies.length} total
                  </span>
                </div>
                <div className="px-4 pb-4 flex flex-wrap gap-2">
                  {supervisor.companies.length === 0 ? (
                    <p className="text-slate-400 text-[12.5px] py-2">No companies assigned.</p>
                  ) : (
                    supervisor.companies.map((c) => (
                      <span
                        key={c.name}
                        className="inline-flex items-center bg-blue-600 text-white text-[12px] font-bold px-3 py-[6px] rounded-lg tracking-[0.1px]"
                      >
                        {c.name}
                      </span>
                    ))
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      ))}

      {/* ══ TAB: RECENT TRIPS ══ */}
      {activeTab === "bookings" && (() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const filteredBookings = supBookings.filter(b => {
          // Date period filter (matches Past Trips behaviour)
          if (tripPeriod === "custom") {
            const d = b.createdAt ? toIsoDate(new Date(b.createdAt)) : "";
            if (!d || d < tripDateFrom || d > tripDateTo) return false;
          } else if (tripPeriod !== "all") {
            const d = new Date(b.createdAt);
            if (tripPeriod === "today"  && d < startOfToday) return false;
            if (tripPeriod === "7days"  && d < new Date(now.getTime() - 7  * 86400_000)) return false;
            if (tripPeriod === "30days" && d < new Date(now.getTime() - 30 * 86400_000)) return false;
          }

          const q   = tripSearch.toLowerCase();
          const drv = drivers.find(d => d.id === b.driverId);
          const driverPhone  = (b.driverPhone ?? drv?.phone ?? "").toLowerCase();
          const vehicleModel = drv?.vehicle ?? "";
          const vehicleReg   = drv?.vehicleReg ?? "";
          const matchQ =
            !q ||
            b.id.toLowerCase().includes(q) ||
            (b.bookingRef?.toLowerCase().includes(q) ?? false) ||
            (drv?.name ?? "").toLowerCase().includes(q) ||
            driverPhone.includes(q) ||
            vehicleModel.toLowerCase().includes(q) ||
            vehicleReg.toLowerCase().replace(/\s+/g, "").includes(q.replace(/\s+/g, "")) ||
            b.pickupLocation.toLowerCase().includes(q) ||
            b.dropLocation.toLowerCase().includes(q);
          return matchQ;
        });

        // Renderers identical to Past Trips. supervisorName is constant on
        // this page (we're inside a single supervisor's profile), so the
        // callback ignores the id and returns the profile name.
        const tripsRenderers = buildTripRenderers(
          () => supervisor?.name ?? "",
          (b) => {
            const d = b.driverId ? drivers.find(x => x.id === b.driverId) : null;
            return {
              name:        d?.name ?? null,
              vehicle:     d?.vehicle ?? null,
              vehicleReg:  d?.vehicleReg ?? null,
              vehicleType: d?.vehicleType ?? null,
              phone:       b.driverPhone ?? d?.phone ?? null,
            };
          },
        );

        return (
        <div className="flex flex-col gap-3">
          {/* Search + Filter row */}
          <div className="flex flex-wrap gap-3 items-center">
            <SearchBar value={tripSearch} onChange={setTripSearch} placeholder="Search by ID, driver, phone, vehicle, route..." />
            <TripDateFilter
              period={tripPeriod}
              dateFrom={tripDateFrom}
              dateTo={tripDateTo}
              onChangePeriod={setTripPeriod}
              onApplyCustom={(f, t) => { setTripDateFrom(f); setTripDateTo(t); }}
              direction="past"
            />

            <ColumnsPopover
              tableKey={SUPERVISOR_TRIPS_TABLE_KEY}
              visible={tripsVisibleCols}
              totalCount={tripsTotalCols}
              onToggle={toggleTripsCol}
              onReset={resetTripsCols}
            />

            <ExportButton
              onClick={() => {
                const rows = filteredBookings.map((b) => {
                  const row: Record<string, string | number | null> = {};
                  for (const k of tripsVisibleCols) {
                    const col = tripsSpec.columns.find((c) => c.key === k);
                    if (!col) continue;
                    const r = (tripsRenderers as Record<string, { csv: (b: Booking) => string | number }>)[k];
                    row[col.label] = r ? r.csv(b) : null;
                  }
                  return row;
                });
                exportToXlsx(`supervisor-${id}-trips`, rows, "Recent Trips");
              }}
              disabled={isLoading || filteredBookings.length === 0}
              className="ml-auto"
              label="Export XLSX"
            />
          </div>

          <TripsTable
            items={filteredBookings}
            visibleCols={tripsVisibleCols}
            renderers={tripsRenderers}
            tableKey={SUPERVISOR_TRIPS_TABLE_KEY}
            isLoading={isLoading}
            prefsLoading={tripsPrefsLoading}
            onRowClick={setSelectedBooking}
            emptyMessage={supBookings.length === 0 ? "No trips yet." : "No trips match your filters."}
          />
        </div>
        );
      })()}

      {/* ══ TAB: SPEND BREAKDOWN ══ */}
      {activeTab === "spend" && (isLoading || fetchLoading || !supervisor ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <PanelSupervisorReport supervisorId={supervisor.id} hideHeader hideSupervisorPicker hideTripsTab />
      ))}

      {/* ══ TAB: TRANSACTIONS ══ */}
      {/* ══ TAB: SETTINGS ══ */}
      {activeTab === "settings" && (isLoading || fetchLoading || !supervisor ? (
        <div className="flex gap-5">
          <div className="w-[210px] shrink-0">
            <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-[6px] space-y-1">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6 space-y-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-64" />
              <div className="grid grid-cols-2 gap-4 pt-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex gap-5">

          {/* Left nav */}
          <div className="w-[210px] shrink-0">
            <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-[6px]">
              {([
                { key: "profile",  label: "Profile" },
                { key: "security", label: "Account & Security" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSettingsSection(key)}
                  style={{
                    fontFamily: font,
                    background: settingsSection === key ? "#EFF6FF" : "transparent",
                    color: settingsSection === key ? ACCENT : undefined,
                    fontWeight: settingsSection === key ? 700 : 500,
                    transition: "background 0.15s",
                  }}
                  className={`w-full block text-left px-[14px] py-[10px] rounded-[10px] text-[13.5px] cursor-pointer border-none${settingsSection === key ? "" : " text-slate-500"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Right content */}
          <div className="flex-1 min-w-0">

            {/* ─ Profile ─ */}
            {settingsSection === "profile" && (
              <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-6">
                <div className="mb-5">
                  <p className="text-[16px] font-extrabold text-slate-900">Edit Profile</p>
                  <p className="text-[12.5px] text-slate-400 mt-[3px]">Update supervisor contact and zone details</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Full Name",     key: "name",  type: "text"  },
                    { label: "Email Address", key: "email", type: "email" },
                    { label: "Phone Number",  key: "phone", type: "text"  },
                    { label: "Zone / Area",   key: "zone",  type: "text"  },
                  ].map(({ label, key, type }) => (
                    <div key={key} className="flex flex-col gap-[5px]">
                      <label style={{ fontFamily: font }} className="text-[12px] font-semibold text-[#334155]">{label}</label>
                      <Input
                        type={type}
                        value={(editForm as any)[key]}
                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ fontFamily: font }}
                      />
                    </div>
                  ))}
                </div>

                {/* Assigned Companies — full width row */}
                <div className="flex flex-col gap-[5px] mt-4">
                  <label style={{ fontFamily: font }} className="text-[12px] font-semibold text-[#334155]">Assigned Companies</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type company name and press Enter"
                      value={addCompanyInput}
                      onChange={e => setAddCompanyInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCompany(); } }}
                      style={{ fontFamily: font }}
                    />
                    <button
                      type="button"
                      onClick={addCompany}
                      className="w-10 h-10 rounded-[10px] border border-[#E2E8F0] bg-white flex items-center justify-center cursor-pointer shrink-0"
                    >
                      <Plus className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                  {editForm.companies && editForm.companies.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 mt-1">
                      {editForm.companies.map((c) => (
                        <div key={c.name} className="flex flex-col gap-[6px] p-[10px] border border-[#E2E8F0] rounded-xl bg-slate-50">
                          <span
                            style={{ background: ACCENT }}
                            className="inline-flex self-start items-center gap-[6px] text-white text-[12px] font-semibold px-[10px] py-[5px] rounded-lg"
                          >
                            {c.name}
                            <button
                              type="button"
                              onClick={() => removeCompany(c.name)}
                              className="flex items-center justify-center w-[14px] h-[14px] rounded-[4px] bg-white/20 border-none cursor-pointer"
                            >
                              <X className="h-2 w-2 text-white" />
                            </button>
                          </span>
                          <Input
                            placeholder={`Street address for ${c.name} (optional)`}
                            value={c.address ?? ""}
                            onChange={e => updateCompanyField(c.name, "address", e.target.value)}
                            style={{ fontFamily: font, height: 34, fontSize: 12.5, background: "#fff" }}
                          />
                          <div className="grid grid-cols-3 gap-[6px]">
                            <Input
                              placeholder="City"
                              value={c.city ?? ""}
                              onChange={e => updateCompanyField(c.name, "city", e.target.value)}
                              style={{ fontFamily: font, height: 34, fontSize: 12.5, background: "#fff" }}
                            />
                            <Input
                              placeholder="State"
                              value={c.state ?? ""}
                              onChange={e => updateCompanyField(c.name, "state", e.target.value)}
                              style={{ fontFamily: font, height: 34, fontSize: 12.5, background: "#fff" }}
                            />
                            <Input
                              placeholder="Pincode"
                              value={c.pincode ?? ""}
                              onChange={e => updateCompanyField(c.name, "pincode", e.target.value.replace(/\D/g, "").slice(0, 10))}
                              style={{ fontFamily: font, height: 34, fontSize: 12.5, background: "#fff" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-400">No companies assigned yet.</p>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-6 pt-5 border-t border-slate-100">
                  <button
                    disabled={editSaving}
                    onClick={async () => {
                      setEditError(null);
                      setEditSaving(true);
                      try {
                        await updateSupervisor(supervisor.id, {
                          name:      editForm.name,
                          email:     editForm.email,
                          phone:     editForm.phone,
                          zone:      editForm.zone,
                          status:    editForm.status as "Active" | "Inactive",
                          companies: editForm.companies,
                        });
                        setToast("Profile updated successfully");
                        setTimeout(() => setToast(""), 2500);
                      } catch (err) {
                        setEditError(err instanceof Error ? err.message : "Failed to save changes");
                      } finally {
                        setEditSaving(false);
                      }
                    }}
                    style={{
                      background: ACCENT,
                      fontFamily: font,
                      cursor: editSaving ? "wait" : "pointer",
                      opacity: editSaving ? 0.7 : 1,
                    }}
                    className="px-[22px] py-[9px] rounded-[9px] text-white font-bold text-[13.5px] border-none"
                  >
                    {editSaving ? "Saving…" : "Save Changes"}
                  </button>
                  {editError && <p className="text-[12.5px] text-red-600 font-semibold">{editError}</p>}
                </div>
              </div>
            )}

            {/* ─ Account & Security ─ */}
            {settingsSection === "security" && (
              <div className="flex flex-col gap-4">

                {/* App access */}
                <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-[22px]">
                  <p className="text-[15px] font-extrabold text-slate-900 mb-1">App Access</p>
                  <p className="text-[12.5px] text-slate-400 mb-4">Control whether this supervisor can log into the app.</p>
                  <div className="flex items-center justify-between bg-slate-50 border border-[#E8EEF4] rounded-xl px-[18px] py-[14px]">
                    <div>
                      <p className="text-[13.5px] font-bold text-slate-900">App Login</p>
                      <p className="text-[12px] text-slate-400 mt-[2px]">
                        Currently <strong style={{ color: supervisor.appAccess ? "#16A34A" : "#DC2626" }}>{supervisor.appAccess ? "Enabled" : "Disabled"}</strong>
                      </p>
                    </div>
                    <button
                      disabled={appAccessSaving}
                      onClick={async () => {
                        setAppAccessError(null);
                        setAppAccessSaving(true);
                        try {
                          await toggleAppAccess(supervisor.id);
                        } catch (err) {
                          setAppAccessError(err instanceof Error ? err.message : "Failed to toggle access");
                        } finally {
                          setAppAccessSaving(false);
                        }
                      }}
                      style={{
                        border: supervisor.appAccess ? "1.5px solid #FECACA" : `1.5px solid ${ACCENT}`,
                        background: supervisor.appAccess ? "#FFF5F5" : `${ACCENT}10`,
                        color: supervisor.appAccess ? "#DC2626" : ACCENT,
                        cursor: appAccessSaving ? "wait" : "pointer",
                        opacity: appAccessSaving ? 0.7 : 1,
                        fontFamily: font,
                      }}
                      className="px-[18px] py-2 rounded-[9px] font-bold text-[13px] transition-all duration-200"
                    >
                      {appAccessSaving ? "Saving…" : supervisor.appAccess ? "Disable Access" : "Enable Access"}
                    </button>
                  </div>
                  {appAccessError && (
                    <p className="text-[12px] text-red-600 font-semibold mt-[10px]">{appAccessError}</p>
                  )}
                </div>

                {/* Update password */}
                <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-[22px]">
                  <p className="text-[15px] font-extrabold text-slate-900 mb-1">
                    Update Password
                  </p>
                  <p className="text-[12.5px] text-slate-400 mb-4">Set a new login password for this supervisor. They will be signed out of any active sessions.</p>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="flex flex-col gap-[5px]">
                      <label style={{ fontFamily: font }} className="text-[12px] font-semibold text-[#334155]">New Password</label>
                      <div className="relative">
                        <Input
                          type={pwShow ? "text" : "password"}
                          placeholder="Min 8 characters"
                          value={pwForm.password}
                          onChange={e => { setPwForm(f => ({ ...f, password: e.target.value })); setPwError(null); setPwSaved(false); }}
                          style={{ fontFamily: font, paddingRight: 36 }}
                        />
                        <button
                          type="button"
                          onClick={() => setPwShow(s => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-1 text-slate-400"
                        >
                          {pwShow ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-[5px]">
                      <label style={{ fontFamily: font }} className="text-[12px] font-semibold text-[#334155]">Confirm Password</label>
                      <Input
                        type={pwShow ? "text" : "password"}
                        placeholder="Confirm the password"
                        value={pwForm.confirm}
                        onChange={e => { setPwForm(f => ({ ...f, confirm: e.target.value })); setPwError(null); setPwSaved(false); }}
                        style={{ fontFamily: font }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      disabled={pwSaving || !pwForm.password || !pwForm.confirm}
                      onClick={async () => {
                        setPwError(null);
                        setPwSaved(false);
                        if (pwForm.password.length < 8) {
                          setPwError("Password must be at least 8 characters");
                          return;
                        }
                        if (pwForm.password !== pwForm.confirm) {
                          setPwError("Passwords do not match");
                          return;
                        }
                        setPwSaving(true);
                        try {
                          await supervisorsApi.updatePassword(supervisor.id, pwForm.password);
                          setPwSaved(true);
                          setPwForm({ password: "", confirm: "" });
                          setTimeout(() => setPwSaved(false), 3000);
                        } catch (err) {
                          setPwError(err instanceof Error ? err.message : "Failed to update password");
                        } finally {
                          setPwSaving(false);
                        }
                      }}
                      style={{
                        background: pwSaved ? "#22C55E" : ACCENT,
                        fontFamily: font,
                        cursor: (pwSaving || !pwForm.password || !pwForm.confirm) ? "not-allowed" : "pointer",
                        opacity: (pwSaving || !pwForm.password || !pwForm.confirm) ? 0.6 : 1,
                        transition: "background 0.2s",
                      }}
                      className="px-[22px] py-[9px] rounded-[9px] text-white font-bold text-[13.5px] border-none"
                    >
                      {pwSaving ? "Updating…" : pwSaved ? "✓ Updated" : "Update Password"}
                    </button>
                    {pwSaved && !pwError && <p className="text-[12.5px] text-green-500 font-semibold">Password updated successfully.</p>}
                    {pwError && <p className="text-[12.5px] text-red-600 font-semibold">{pwError}</p>}
                  </div>
                </div>

                {/* Danger zone */}
                <div className="bg-[#FFFAFA] border-[1.5px] border-[#FECACA] rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-[22px]">
                  <p className="text-[15px] font-extrabold text-red-700 mb-1">Danger Zone</p>
                  <p className="text-[12.5px] text-slate-400 mb-4">Permanent and irreversible actions. Proceed with caution.</p>
                  <div className="flex items-center justify-between bg-[#FFF5F5] border border-[#FECACA] rounded-xl px-[18px] py-[14px]">
                    <div>
                      <p className="text-[13.5px] font-bold text-slate-900">Delete Account</p>
                      <p className="text-[12px] text-slate-400 mt-[2px]">Permanently remove this supervisor and all associated data.</p>
                    </div>
                    <button
                      onClick={() => { setDeleteConfirm(""); setDeleteError(null); setDeleteOpen(true); }}
                      style={{ fontFamily: font }}
                      className="px-[18px] py-2 rounded-[9px] bg-red-600 border-none text-white font-bold text-[13px] cursor-pointer"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      ))}

      {/* ── Booking Detail Sidebar ── */}
      <BookingDetailModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
      />

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!deleteSaving) setDeleteOpen(o); }}>
        <DialogContent className="sm:max-w-md" style={{ fontFamily: font }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: font }} className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Delete Supervisor Account
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 pb-1">
            <p className="text-[13.5px] text-[#334155] mb-3">
              You're about to permanently delete <strong className="text-slate-900">{supervisor?.name}</strong>.
              This action <strong className="text-red-600">cannot be undone</strong>.
            </p>

            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[10px] px-[14px] py-3 mb-[14px]">
              <p className="text-[12px] font-bold text-[#991B1B] mb-2 uppercase tracking-[0.4px]">
                The following will be permanently removed:
              </p>
              <ul className="text-[12.5px] text-[#7F1D1D] leading-[1.7] pl-[18px] m-0">
                <li>Supervisor profile and contact details</li>
                <li>Login account — they will no longer be able to access the app</li>
                <li>All assigned company links</li>
                <li>Wallet transaction history attributed to this supervisor</li>
                <li>Daily spend statistics</li>
                <li>Notification history</li>
              </ul>
              <p className="text-[11.5px] text-[#991B1B] mt-[10px] italic">
                Trips created by this supervisor will be retained for audit purposes but the supervisor reference will be cleared.
              </p>
            </div>

            <div className="flex flex-col gap-[5px]">
              <label style={{ fontFamily: font }} className="text-[12px] font-semibold text-[#334155]">
                Type <strong className="text-red-600 font-mono">DELETE</strong> to confirm
              </label>
              <Input
                value={deleteConfirm}
                onChange={e => { setDeleteConfirm(e.target.value); setDeleteError(null); }}
                placeholder="DELETE"
                disabled={deleteSaving}
                style={{ fontFamily: "monospace", letterSpacing: 1 }}
              />
              {deleteError && <p className="text-[12px] text-red-600 font-semibold mt-1">{deleteError}</p>}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={deleteSaving} onClick={() => setDeleteOpen(false)} style={{ fontFamily: font }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteSaving || deleteConfirm.trim() !== "DELETE"}
              onClick={async () => {
                setDeleteError(null);
                setDeleteSaving(true);
                try {
                  if (!supervisor) return;
                  await deleteSupervisor(supervisor.id);
                  router.push("/dashboard/supervisors");
                } catch (err) {
                  setDeleteError(err instanceof Error ? err.message : "Failed to delete supervisor");
                  setDeleteSaving(false);
                }
              }}
              style={{ fontFamily: font }}
            >
              {deleteSaving ? "Deleting…" : "Permanently Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// animated spend bar
function SpendBar({ pct, color }: { pct: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), 120); return () => clearTimeout(t); }, [pct]);
  return <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 20, transition: "width 0.7s ease" }} />;
}

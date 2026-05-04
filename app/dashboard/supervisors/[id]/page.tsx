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
import { FilterPanel, FilterSection, FilterPill, FilterTrigger } from "@/components/FilterPanel";

// ── constants ───────────────────────────────────────────────────────────────
const ACCENT = "#2563EB";
const CARD_STYLE: React.CSSProperties = {
  background: "#fff",
  border: "1.5px solid #E8EEF4",
  borderRadius: 16,
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};


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
    <div style={CARD_STYLE} className="p-5 flex items-center justify-between gap-3">
      <div>
        <p style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
        <p style={{ fontSize: 36, fontWeight: 800, color: "#0F172A", lineHeight: 1.1, marginTop: 4 }}>{value}</p>
      </div>
      <div style={{ background: iconBg, borderRadius: 11, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon style={{ color: iconColor }} className="h-5 w-5" />
      </div>
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const c = STATUS_STYLES[status] ?? STATUS_STYLES["Pending"];
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "3px 10px", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
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
    <div style={{ padding: "0 4px" }}>
      {/* Grid lines */}
      <div style={{ position: "relative", height: 160 }}>
        {[0, 33, 66, 100].map(pct => (
          <div key={pct} style={{ position: "absolute", bottom: `${pct}%`, left: 0, right: 0, borderTop: "1px dashed #F1F5F9" }} />
        ))}
        <div style={{ display: "flex", alignItems: "flex-end", height: "100%", gap: 8 }}>
          {days.map((day, i) => {
            const isToday = day.date === today;
            const pct     = day.total > 0 ? (day.total / max) * 100 : 0;
            const delay   = i * 60;
            return (
              <div key={day.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                {day.total > 0 && (
                  <span style={{ fontSize: 10, color: isToday ? ACCENT : "#94A3B8", fontWeight: 700, marginBottom: 4, whiteSpace: "nowrap" }}>
                    ₹{day.total}
                  </span>
                )}
                <div
                  style={{
                    width: "70%", borderRadius: "6px 6px 0 0",
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
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {days.map(day => {
          const isToday = day.date === today;
          return (
            <div key={day.date} style={{ flex: 1, textAlign: "center" }}>
              <span style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: isToday ? ACCENT : "#94A3B8" }}>
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

  const [activeTab,    setActiveTab]    = useState("overview");
  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [settingsSection, setSettingsSection] = useState<"profile" | "security">("profile");
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", zone: "", status: "Active", shift: "Morning", companies: [] as string[] });
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
  const [tripStatus,       setTripStatus]       = useState("All Status");
  const [tripType,         setTripType]         = useState("All Types");
  const [draftTripStatus,  setDraftTripStatus]  = useState("All Status");
  const [draftTripType,    setDraftTripType]    = useState("All Types");
  const [tripFilterOpen,   setTripFilterOpen]   = useState(false);

  function openTripFilter() {
    setDraftTripStatus(tripStatus);
    setDraftTripType(tripType);
    setTripFilterOpen(true);
  }
  function applyTripFilter() {
    setTripStatus(draftTripStatus);
    setTripType(draftTripType);
    setTripFilterOpen(false);
  }
  function cancelTripFilter() {
    setTripFilterOpen(false);
  }

  function addCompany() {
    const t = addCompanyInput.trim();
    if (t && !editForm.companies.includes(t)) {
      setEditForm(f => ({ ...f, companies: [...f.companies, t] }));
    }
    setAddCompanyInput("");
  }
  
  function removeCompany(c: string) {
    setEditForm(f => ({ ...f, companies: f.companies.filter(x => x !== c) }));
  }

  useEffect(() => {
    const sup = supervisors.find(s => s.id === id);
    if (sup) setEditForm({ name: sup.name, email: sup.email, phone: sup.phone, zone: sup.zone, status: sup.status, shift: "Morning", companies: sup.companies ?? [] });
  }, [id, supervisors]);

  const supervisor = supervisors.find(s => s.id === id);

  if (!isLoading && !supervisor) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p style={{ color: "#64748B" }}>Supervisor not found.</p>
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
    <div style={{ fontFamily: font, color: "#0F172A" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 300,
          background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12,
          padding: "12px 18px", display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)", maxWidth: 340,
        }}>
          <CheckCircle2 style={{ width: 16, height: 16, color: "#16a34a", flexShrink: 0 }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#15803d" }}>{toast}</span>
        </div>
      )}

      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={() => router.back()}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1.5px solid #E8EEF4", borderRadius: 10, background: "#fff", color: "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div style={{ width: 1, height: 28, background: "#E8EEF4" }} />
          <div>
            <p style={{ fontSize: 17, fontWeight: 800, color: "#0F172A" }}>Supervisor Profile</p>
            <p style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>
              {isLoading || !supervisor ? (
                <SkeletonInline className="h-3 w-32" />
              ) : (
                <>{supervisor.name} · Full details</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ borderBottom: "1.5px solid #E8EEF4", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 0 }}>
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: activeTab === tab.value ? 700 : 500,
                color: activeTab === tab.value ? ACCENT : "#64748B",
                borderTop: "none", borderLeft: "none", borderRight: "none",
                borderBottom: activeTab === tab.value ? `2.5px solid ${ACCENT}` : "2.5px solid transparent",
                background: "none",
                cursor: "pointer", whiteSpace: "nowrap", transition: "color 0.15s",
                fontFamily: font,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ TAB: OVERVIEW ══ */}
      {activeTab === "overview" && (isLoading || !supervisor ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...CARD_STYLE, padding: 20, display: "flex", alignItems: "center", gap: 18 }}>
            <Skeleton className="h-[60px] w-[60px] rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-3 w-32 shrink-0" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={CARD_STYLE} className="p-5 flex items-center justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-[38px] w-[38px] rounded-xl shrink-0" />
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>
            <Skeleton className="h-[110px] rounded-2xl" />
            <div className="space-y-3.5">
              <div style={CARD_STYLE} className="p-4 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <div style={CARD_STYLE} className="p-4 space-y-2.5">
                <Skeleton className="h-4 w-32" />
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-3 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Profile card */}
          <div style={{ ...CARD_STYLE, padding: 20, display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ position: "relative" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 800 }}>
                {sup_initials}
              </div>
              {supervisor.isOnline && (
                <span style={{ position: "absolute", bottom: 2, right: 2, width: 13, height: 13, borderRadius: "50%", background: "#22C55E", border: "2px solid #fff" }} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>{supervisor.name}</span>
                <span style={{ background: supervisor.status === "Active" ? "#DCFCE7" : "#F1F5F9", color: supervisor.status === "Active" ? "#15803D" : "#64748B", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
                  {supervisor.status}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: supervisor.isOnline ? "#22C55E" : "#94A3B8" }}>
                  <Circle className="h-2 w-2 fill-current" />{supervisor.isOnline ? "Online" : "Offline"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap" }}>
                {[
                  { icon: Mail,   val: supervisor.email },
                  { icon: Phone,  val: supervisor.phone },
                  ...(supervisor.zone ? [{ icon: MapPin, val: supervisor.zone }] : []),
                ].map(({ icon: Icon, val }) => (
                  <span key={val} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#334155" }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: "#94A3B8" }} />{val}
                  </span>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 12, color: "#94A3B8", flexShrink: 0 }}>
              Joined {new Date(supervisor.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* 4 Stat chips */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            <StatCard label="Total Trips"    value={supBookings.length}       icon={Route}        iconBg="#F1F5F9" iconColor="#0F172A" />
            <StatCard label="Today's Trips"  value={supervisor.bookingsToday} icon={Route}        iconBg="#F1F5F9" iconColor="#0F172A" />
            <StatCard label="Today's Completed" value={completedCt}              icon={CheckCircle2} iconBg="#F1F5F9" iconColor="#0F172A" />
            <StatCard label="Ongoing"           value={ongoingCt}                icon={Circle}       iconBg="#F1F5F9" iconColor="#0F172A" />
          </div>

          {/* Wallet + Right column */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>

            {/* Wallet Card — blue gradient matching dashboard */}
            <div
              style={{
                background: "linear-gradient(135deg, #1e40af 0%, #2563EB 60%, #3b82f6 100%)",
                borderRadius: 18,
                padding: "18px 22px 20px",
                position: "relative",
                overflow: "hidden",
                alignSelf: "start",
              }}
            >
              {/* decorative circles */}
              <div style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
              <div style={{ position: "absolute", bottom: -30, right: 24, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />

              <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                Today&apos;s Spend
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", lineHeight: 1, letterSpacing: -1 }}>
                ₹{(supervisor.dailyHistory.find((d) => d.date === today)?.amount ?? 0).toLocaleString("en-IN")}
              </div>
            </div>

            {/* Right column */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Assigned Companies */}
              <div style={CARD_STYLE}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 9, padding: 7 }}>
                      <Building2 className="h-4 w-4" style={{ color: "#0F172A" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Assigned Companies</p>
                      <p style={{ fontSize: 11, color: "#94A3B8" }}>Corporate clients</p>
                    </div>
                  </div>
                  <span style={{ background: "#F1F5F9", color: "#64748B", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
                    {supervisor.companies.length} total
                  </span>
                </div>
                <div style={{ padding: "0 16px 16px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {supervisor.companies.length === 0 ? (
                    <p style={{ color: "#94A3B8", fontSize: 12.5, padding: "8px 0" }}>No companies assigned.</p>
                  ) : (
                    supervisor.companies.map((c) => (
                      <span
                        key={c}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          background: "#2563EB",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "6px 12px",
                          borderRadius: 8,
                          letterSpacing: 0.1,
                        }}
                      >
                        {c}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Activity */}
              <div style={{ ...CARD_STYLE, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px" }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Recent Activity</p>
                  <button onClick={() => setActiveTab("bookings")} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, background: "none", border: "none", cursor: "pointer", fontFamily: font }}>
                    View all →
                  </button>
                </div>
                <div>
                  {supBookings.slice(0, 4).map(booking => (
                    <div key={booking.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderTop: "1px solid #F8FAFC" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {booking.pickupLocation} → {booking.dropLocation}
                        </p>
                        <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{fmtDate(booking.createdAt)}</p>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", flexShrink: 0, marginLeft: 16 }}>
                        {booking.fare ? `₹${booking.fare.toLocaleString()}` : "—"}
                      </span>
                    </div>
                  ))}
                  {supBookings.length === 0 && (
                    <p style={{ textAlign: "center", color: "#94A3B8", fontSize: 12.5, padding: "16px 0 20px" }}>No recent trips.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      ))}

      {/* ══ TAB: RECENT TRIPS ══ */}
      {activeTab === "bookings" && (() => {
        const tripFilterCount = (tripStatus !== "All Status" ? 1 : 0) + (tripType !== "All Types" ? 1 : 0);
        const filteredBookings = supBookings.filter(b => {
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
          const matchSt = tripStatus === "All Status" || b.status === tripStatus;
          const matchTy = tripType   === "All Types"  || b.type   === tripType;
          return matchQ && matchSt && matchTy;
        });

        return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Search + Filter row */}
          <div className="flex flex-wrap gap-3 items-center">
            <SearchBar value={tripSearch} onChange={setTripSearch} placeholder="Search by ID, driver, phone, vehicle, route..." />
            <div className="relative shrink-0">
              <FilterTrigger onClick={openTripFilter} activeCount={tripFilterCount} />
              <FilterPanel
                open={tripFilterOpen}
                onClose={cancelTripFilter}
                onCancel={cancelTripFilter}
                onApply={applyTripFilter}
                activeCount={tripFilterCount}
                onClearAll={() => { setDraftTripStatus("All Status"); setDraftTripType("All Types"); }}
              >
                <FilterSection label="Status">
                  {["All Status","Ongoing","Completed","Pending","Cancelled"].map(s => (
                    <FilterPill key={s} label={s} active={draftTripStatus === s} onClick={() => setDraftTripStatus(s)} />
                  ))}
                </FilterSection>
                <FilterSection label="Trip Type">
                  {["All Types","Instant","Scheduled"].map(t => (
                    <FilterPill key={t} label={t} active={draftTripType === t} onClick={() => setDraftTripType(t)} />
                  ))}
                </FilterSection>
              </FilterPanel>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="w-full overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Header */}
              <div className="grid grid-cols-[100px_2fr_150px_1.3fr_1.3fr_110px_90px] items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
                {["TRIP ID & TYPE", "ROUTE", "COMPANY", "VEHICLE", "DRIVER", "STATUS", "CREATED AT"].map(h => (
                  <div key={h} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</div>
                ))}
              </div>

              {/* Rows */}
              <div className="flex flex-col divide-y divide-slate-100">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-[100px_2fr_150px_1.3fr_1.3fr_110px_90px] items-center gap-4 px-6 py-3.5">
                      <div className="space-y-2">
                        <Skeleton className="h-3.5 w-16" />
                        <Skeleton className="h-4 w-12 rounded" />
                      </div>
                      <div className="space-y-1.5 pr-4">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-2 w-16" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                      <Skeleton className="h-4 w-20 rounded" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-3 w-16" />
                      </div>
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-14" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                  ))
                ) : filteredBookings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                    <p className="text-sm font-medium">{supBookings.length === 0 ? "No trips yet." : "No trips match your filters."}</p>
                  </div>
                ) : (
                  filteredBookings.map(booking => {
                    const driver = booking.driverId ? drivers.find(d => d.id === booking.driverId) : null;
                    const driverName = driver?.name ?? null;
                    const vehicle = driver?.vehicle ?? null;
                    const vehicleReg = driver?.vehicleReg ?? null;
                    const d = new Date(booking.createdAt);
                    const day = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toLowerCase();

                    return (
                      <div
                        key={booking.id}
                        className="grid grid-cols-[100px_2fr_150px_1.3fr_1.3fr_110px_90px] items-center gap-4 px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => setSelectedBooking(booking)}
                      >
                        {/* TRIP ID & TYPE */}
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-extrabold text-[#111827] text-[13px]">{booking.bookingRef ?? "—"}</span>
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#eef2ff] text-blue-600 text-[10px] font-bold ring-1 ring-inset ring-blue-100/50">
                            {booking.type}
                          </span>
                        </div>

                        {/* ROUTE */}
                        <div className="flex flex-col min-w-0 pr-4 gap-px">
                          <span className="font-semibold text-[13px] text-slate-800 leading-tight truncate">
                            {booking.pickupLocation.split(",")[0]}
                          </span>
                          <div className="flex items-center gap-1">
                            <div className="w-14 h-[2px] rounded-full" style={{ background: "linear-gradient(to right, #A5B4FC, #2563EB)" }} />
                            <ArrowRight className="h-3 w-3 text-blue-600 shrink-0" />
                          </div>
                          <span className="text-[12px] text-gray-500 truncate">
                            {booking.dropLocation.split(",")[0]}
                          </span>
                        </div>

                        {/* COMPANY */}
                        <div className="flex flex-col items-start gap-1">
                          {booking.bookingSource ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-semibold truncate max-w-[130px]">
                              {booking.bookingSource}
                            </span>
                          ) : (
                            <span className="text-[13px] text-slate-300 font-medium italic">—</span>
                          )}
                        </div>

                        {/* VEHICLE */}
                        <div className="flex flex-col gap-px">
                          {vehicle ? (
                            <>
                              <span className="text-[13px] font-medium text-slate-600 truncate">{vehicle}</span>
                              {vehicleReg && <span className="text-[11px] font-semibold text-slate-500 truncate">{vehicleReg}</span>}
                            </>
                          ) : (
                            <span className="text-[13px] text-slate-300 font-medium italic">—</span>
                          )}
                        </div>

                        {/* DRIVER */}
                        <div className="flex flex-col gap-px">
                          {driverName ? (
                            <span className="text-[13px] font-medium text-slate-600 truncate">{driverName}</span>
                          ) : (
                            <span className="text-[13px] text-slate-300 font-medium italic">Awaiting</span>
                          )}
                        </div>

                        {/* STATUS */}
                        <div>
                          <StatusBadge status={booking.status} />
                        </div>

                        {/* CREATED AT */}
                        <div className="flex flex-col text-left">
                          <span className="text-[13px] font-medium text-slate-700">{day}</span>
                          <span className="text-[11px] text-slate-400 font-medium mt-0.5">{time}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
        );
      })()}

      {/* ══ TAB: SPEND BREAKDOWN ══ */}
      {activeTab === "spend" && (isLoading || !supervisor ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <PanelSupervisorReport supervisorId={supervisor.id} hideHeader hideSupervisorPicker />
      ))}

      {/* ══ TAB: TRANSACTIONS ══ */}
      {/* ══ TAB: SETTINGS ══ */}
      {activeTab === "settings" && (isLoading || !supervisor ? (
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ width: 210, flexShrink: 0 }}>
            <div style={{ ...CARD_STYLE, padding: 6 }} className="space-y-1">
              <Skeleton className="h-9 w-full rounded-lg" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...CARD_STYLE, padding: 24 }} className="space-y-4">
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
        <div style={{ display: "flex", gap: 20 }}>

          {/* Left nav */}
          <div style={{ width: 210, flexShrink: 0 }}>
            <div style={{ ...CARD_STYLE, padding: 6 }}>
              {([
                { key: "profile",  label: "Profile" },
                { key: "security", label: "Account & Security" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSettingsSection(key)}
                  style={{ width: "100%", display: "block", textAlign: "left", padding: "10px 14px", borderRadius: 10, background: settingsSection === key ? "#EFF6FF" : "transparent", color: settingsSection === key ? ACCENT : "#64748B", fontWeight: settingsSection === key ? 700 : 500, fontSize: 13.5, cursor: "pointer", border: "none", fontFamily: font, transition: "background 0.15s" }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Right content */}
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* ─ Profile ─ */}
            {settingsSection === "profile" && (
              <div style={{ ...CARD_STYLE, padding: 24 }}>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Edit Profile</p>
                  <p style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 3 }}>Update supervisor contact and zone details</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[
                    { label: "Full Name",     key: "name",  type: "text"  },
                    { label: "Email Address", key: "email", type: "email" },
                    { label: "Phone Number",  key: "phone", type: "text"  },
                    { label: "Zone / Area",   key: "zone",  type: "text"  },
                  ].map(({ label, key, type }) => (
                    <div key={key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", fontFamily: font }}>{label}</label>
                      <Input
                        type={type}
                        value={(editForm as any)[key]}
                        onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ fontFamily: font }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                  {/* Assigned Companies */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", fontFamily: font }}>Assigned Companies</label>
                    <div style={{ display: "flex", gap: 8 }}>
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
                        style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid #E2E8F0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
                      >
                        <Plus className="h-4 w-4" style={{ color: "#64748B" }} />
                      </button>
                    </div>
                    {editForm.companies && editForm.companies.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                        {editForm.companies.map((c: string) => (
                          <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 8 }}>
                            {c}
                            <button
                              type="button"
                              onClick={() => removeCompany(c)}
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, borderRadius: 4, background: "rgba(255,255,255,0.2)", border: "none", cursor: "pointer" }}
                            >
                              <X className="h-2 w-2" style={{ color: "#fff" }} />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, color: "#94A3B8" }}>No companies assigned yet.</p>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24, paddingTop: 20, borderTop: "1px solid #F1F5F9" }}>
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
                    style={{ padding: "9px 22px", borderRadius: 9, background: ACCENT, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: editSaving ? "wait" : "pointer", opacity: editSaving ? 0.7 : 1, border: "none", fontFamily: font }}
                  >
                    {editSaving ? "Saving…" : "Save Changes"}
                  </button>
                  {editError && <p style={{ fontSize: 12.5, color: "#DC2626", fontWeight: 600 }}>{editError}</p>}
                </div>
              </div>
            )}

            {/* ─ Account & Security ─ */}
            {settingsSection === "security" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* App access */}
                <div style={{ ...CARD_STYLE, padding: 22 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>App Access</p>
                  <p style={{ fontSize: 12.5, color: "#94A3B8", marginBottom: 16 }}>Control whether this supervisor can log into the app.</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFC", border: "1px solid #E8EEF4", borderRadius: 12, padding: "14px 18px" }}>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>App Login</p>
                      <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
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
                      style={{ padding: "8px 18px", borderRadius: 9, border: supervisor.appAccess ? "1.5px solid #FECACA" : `1.5px solid ${ACCENT}`, background: supervisor.appAccess ? "#FFF5F5" : `${ACCENT}10`, color: supervisor.appAccess ? "#DC2626" : ACCENT, fontWeight: 700, fontSize: 13, cursor: appAccessSaving ? "wait" : "pointer", opacity: appAccessSaving ? 0.7 : 1, fontFamily: font, transition: "all 0.2s" }}
                    >
                      {appAccessSaving ? "Saving…" : supervisor.appAccess ? "Disable Access" : "Enable Access"}
                    </button>
                  </div>
                  {appAccessError && (
                    <p style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, marginTop: 10 }}>{appAccessError}</p>
                  )}
                </div>

                {/* Update password */}
                <div style={{ ...CARD_STYLE, padding: 22 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>
                    Update Password
                  </p>
                  <p style={{ fontSize: 12.5, color: "#94A3B8", marginBottom: 16 }}>Set a new login password for this supervisor. They will be signed out of any active sessions.</p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", fontFamily: font }}>New Password</label>
                      <div style={{ position: "relative" }}>
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
                          style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "#94A3B8" }}
                        >
                          {pwShow ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", fontFamily: font }}>Confirm Password</label>
                      <Input
                        type={pwShow ? "text" : "password"}
                        placeholder="Confirm the password"
                        value={pwForm.confirm}
                        onChange={e => { setPwForm(f => ({ ...f, confirm: e.target.value })); setPwError(null); setPwSaved(false); }}
                        style={{ fontFamily: font }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                      style={{ padding: "9px 22px", borderRadius: 9, background: pwSaved ? "#22C55E" : ACCENT, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: (pwSaving || !pwForm.password || !pwForm.confirm) ? "not-allowed" : "pointer", opacity: (pwSaving || !pwForm.password || !pwForm.confirm) ? 0.6 : 1, border: "none", fontFamily: font, transition: "background 0.2s" }}
                    >
                      {pwSaving ? "Updating…" : pwSaved ? "✓ Updated" : "Update Password"}
                    </button>
                    {pwSaved && !pwError && <p style={{ fontSize: 12.5, color: "#22C55E", fontWeight: 600 }}>Password updated successfully.</p>}
                    {pwError && <p style={{ fontSize: 12.5, color: "#DC2626", fontWeight: 600 }}>{pwError}</p>}
                  </div>
                </div>

                {/* Danger zone */}
                <div style={{ ...CARD_STYLE, padding: 22, border: "1.5px solid #FECACA", background: "#FFFAFA" }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#B91C1C", marginBottom: 4 }}>Danger Zone</p>
                  <p style={{ fontSize: 12.5, color: "#94A3B8", marginBottom: 16 }}>Permanent and irreversible actions. Proceed with caution.</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px" }}>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>Delete Account</p>
                      <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Permanently remove this supervisor and all associated data.</p>
                    </div>
                    <button
                      onClick={() => { setDeleteConfirm(""); setDeleteError(null); setDeleteOpen(true); }}
                      style={{ padding: "8px 18px", borderRadius: 9, background: "#DC2626", border: "none", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: font }}
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
            <DialogTitle style={{ color: "#DC2626", display: "flex", alignItems: "center", gap: 8, fontFamily: font }}>
              <AlertTriangle className="h-5 w-5" /> Delete Supervisor Account
            </DialogTitle>
          </DialogHeader>

          <div style={{ padding: "8px 0 4px" }}>
            <p style={{ fontSize: 13.5, color: "#334155", marginBottom: 12 }}>
              You're about to permanently delete <strong style={{ color: "#0F172A" }}>{supervisor?.name}</strong>.
              This action <strong style={{ color: "#DC2626" }}>cannot be undone</strong>.
            </p>

            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#991B1B", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>
                The following will be permanently removed:
              </p>
              <ul style={{ fontSize: 12.5, color: "#7F1D1D", lineHeight: 1.7, paddingLeft: 18, margin: 0 }}>
                <li>Supervisor profile and contact details</li>
                <li>Login account — they will no longer be able to access the app</li>
                <li>All assigned company links</li>
                <li>Wallet transaction history attributed to this supervisor</li>
                <li>Daily spend statistics</li>
                <li>Notification history</li>
              </ul>
              <p style={{ fontSize: 11.5, color: "#991B1B", marginTop: 10, fontStyle: "italic" }}>
                Trips created by this supervisor will be retained for audit purposes but the supervisor reference will be cleared.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", fontFamily: font }}>
                Type <strong style={{ color: "#DC2626", fontFamily: "monospace" }}>DELETE</strong> to confirm
              </label>
              <Input
                value={deleteConfirm}
                onChange={e => { setDeleteConfirm(e.target.value); setDeleteError(null); }}
                placeholder="DELETE"
                disabled={deleteSaving}
                style={{ fontFamily: "monospace", letterSpacing: 1 }}
              />
              {deleteError && <p style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, marginTop: 4 }}>{deleteError}</p>}
            </div>
          </div>

          <DialogFooter style={{ gap: 8 }}>
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

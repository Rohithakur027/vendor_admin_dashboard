"use client";

import { useParams, useRouter } from "next/navigation";
import { useVendor } from "@/context/VendorContext";
import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Plus, Wallet, BookOpen, TrendingUp,
  Building2, User, IndianRupee, ArrowRight, Receipt,
  Check, AlertTriangle, Trash2, Circle, Mail, Phone, MapPin,
  CheckCircle2, XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_STYLES } from "@/components/StatusBadge";

function SupervisorDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-center gap-6">
        <Skeleton className="h-16 w-16 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-36" />
          <div className="flex gap-3 mt-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-6 py-4 gap-4">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
  const { supervisors, bookings, drivers, updateSupervisor, deleteSupervisor, isLoading } = useVendor();

  const [activeTab,    setActiveTab]    = useState("overview");
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeAmt,  setRechargeAmt]  = useState("");
  const [rechargeErr,  setRechargeErr]  = useState("");
  const [deleteOpen,   setDeleteOpen]   = useState(false);
  const [txnForm,      setTxnForm]      = useState({ amount: "", note: "" });
  const [txnRecorded,  setTxnRecorded]  = useState(false);
  const [transactions, setTransactions] = useState<{ id: string; amount: number; note: string; recordedAt: string }[]>([]);
  const [settingsSection, setSettingsSection] = useState<"profile" | "security">("profile");
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", zone: "", walletLimit: "0", status: "Active", shift: "Morning" });
  const [editSaved, setEditSaved] = useState(false);
  const [addCompanyInput, setAddCompanyInput] = useState("");
  const [showAddCompany, setShowAddCompany] = useState(false);

  useEffect(() => {
    const sup = supervisors.find(s => s.id === id);
    if (sup) setEditForm({ name: sup.name, email: sup.email, phone: sup.phone, zone: sup.zone, walletLimit: String(sup.walletLimit), status: sup.status, shift: "Morning" });
  }, [id, supervisors]);

  if (isLoading) return <SupervisorDetailSkeleton />;

  const supervisor = supervisors.find(s => s.id === id);

  if (!supervisor) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p style={{ color: "#64748B" }}>Supervisor not found.</p>
        <Button variant="outline" onClick={() => router.back()}><ArrowLeft className="h-4 w-4 mr-2" />Go Back</Button>
      </div>
    );
  }

  // wallet
  const walletPct       = supervisor.walletLimit > 0 ? Math.min((supervisor.walletUsed / supervisor.walletLimit) * 100, 100) : 0;
  const walletRemaining = supervisor.walletLimit - supervisor.walletUsed;

  // bookings
  const supBookings  = bookings.filter(b => b.supervisorId === id);
  const today        = new Date().toISOString().split("T")[0];
  const completedCt  = supBookings.filter(b => b.status === "Completed" && b.createdAt?.startsWith(today)).length;
  const ongoingCt    = supBookings.filter(b => b.status === "Ongoing").length;
  const cancelledCt  = supBookings.filter(b => b.status === "Cancelled").length;
  const sup_initials = supervisor.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

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

  // total paid
  const totalPaid = transactions.reduce((s, t) => s + t.amount, 0);
  const outstanding = Math.max(0, totalSpend - totalPaid);

  const TABS = [
    { value: "overview",     label: "Overview" },
    { value: "bookings",     label: "Recent Trips" },
    { value: "spend",        label: "Spend Breakdown" },
    { value: "transactions", label: "Transactions" },
    { value: "settings",     label: "Settings" },
  ];

  // ── record transaction ──
  function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(txnForm.amount);
    if (!amt || amt <= 0) return;
    setTransactions(prev => [{
      id: `TXN-${Date.now()}`,
      amount: amt,
      note: txnForm.note,
      recordedAt: new Date().toISOString(),
    }, ...prev]);
    setTxnForm({ amount: "", note: "" });
    setTxnRecorded(true);
    setTimeout(() => setTxnRecorded(false), 2000);
  }

  const font = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

  return (
    <div style={{ fontFamily: font, color: "#0F172A" }}>

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
            <p style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>{supervisor.name} · Full details</p>
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
      {activeTab === "overview" && (
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
            <StatCard label="Total Bookings"    value={supBookings.length}       icon={BookOpen}     iconBg="#F1F5F9" iconColor="#0F172A" />
            <StatCard label="Today's Bookings"  value={supervisor.bookingsToday} icon={TrendingUp}   iconBg="#F1F5F9" iconColor="#0F172A" />
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
                ₹{supervisor.walletUsed.toLocaleString("en-IN")}
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
                  {supBookings.slice(0, 4).map(booking => {
                    const sc = STATUS_STYLES[booking.status] ?? STATUS_STYLES["Pending"];
                    return (
                      <div key={booking.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderTop: "1px solid #F8FAFC" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
                          <span style={{ marginTop: 5, width: 8, height: 8, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {booking.pickupLocation} → {booking.dropLocation}
                            </p>
                            <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{fmtDate(booking.createdAt)}</p>
                          </div>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", flexShrink: 0, marginLeft: 16 }}>
                          {booking.fare ? `₹${booking.fare.toLocaleString()}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                  {supBookings.length === 0 && (
                    <p style={{ textAlign: "center", color: "#94A3B8", fontSize: 12.5, padding: "16px 0 20px" }}>No recent trips.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: RECENT TRIPS ══ */}
      {activeTab === "bookings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Table */}
          <div style={CARD_STYLE}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 88px 80px 108px", gap: 8, padding: "12px 20px", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC", borderRadius: "14px 14px 0 0" }}>
              {["ROUTE", "DRIVER", "COMPANY", "TYPE", "FARE", "STATUS"].map(h => (
                <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</span>
              ))}
            </div>

            {supBookings.length === 0 ? (
              <p style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8", fontSize: 13 }}>No bookings yet.</p>
            ) : (
              <div>
                {supBookings.map(booking => {
                  const sc = STATUS_STYLES[booking.status] ?? STATUS_STYLES["Pending"];
                  const srcC = srcCfg(booking.bookingSource ?? "Individual");
                  return (
                    <div
                      key={booking.id}
                      style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 88px 80px 108px", gap: 8, padding: "14px 20px", borderBottom: "1px solid #F8FAFC", alignItems: "center", cursor: "pointer", transition: "all 0.15s" }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.boxShadow = `inset 0 1px 0 ${ACCENT}50, inset 0 -1px 0 ${ACCENT}50, 0 4px 20px ${ACCENT}12`;
                        (e.currentTarget as HTMLElement).style.background = "#F8FAFC";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.boxShadow = "none";
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                      }}
                    >
                      {/* Route */}
                      <div>
                        <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.pickupLocation}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: 3, margin: "3px 0" }}>
                          <div style={{ width: 42, height: 2, borderRadius: 2, background: `linear-gradient(to right,#A5B4FC,${ACCENT})` }} />
                          <ArrowRight className="h-3 w-3" style={{ color: ACCENT }} />
                        </div>
                        <p style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.dropLocation}</p>
                        <p style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginTop: 3 }}>{fmtDate(booking.createdAt)}</p>
                      </div>
                      {/* Driver */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {booking.driverName ? (
                          <>
                            <span style={{ fontSize: 12.5, color: "#334155", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{booking.driverName.split(" ")[0]}</span>
                            {(() => {
                              const vehicle = booking.driverId ? drivers.find(d => d.id === booking.driverId)?.vehicle : null;
                              return vehicle ? (
                                <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{vehicle}</span>
                              ) : null;
                            })()}
                          </>
                        ) : (
                          <span style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>Awaiting</span>
                        )}
                      </div>
                      {/* Company */}
                      <div>
                        <span style={{ fontSize: 12, color: "#334155", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{booking.bookingSource ?? "Individual"}</span>
                      </div>
                      {/* Type */}
                      <div>
                        <span style={{ background: booking.type === "Instant" ? "#DBEAFE" : "#FEF3C7", color: booking.type === "Instant" ? "#1D4ED8" : "#B45309", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5 }}>
                          {booking.type}
                        </span>
                      </div>
                      {/* Fare */}
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                        {booking.fare ? `₹${booking.fare.toLocaleString()}` : <span style={{ color: "#CBD5E1" }}>—</span>}
                      </span>
                      {/* Status */}
                      <StatusBadge status={booking.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: SPEND BREAKDOWN ══ */}
      {activeTab === "spend" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* 3 stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            <StatCard label="Total Spend"      value={`₹${totalSpend.toLocaleString()}`}  icon={IndianRupee} iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Company Spend"    value={`₹${spendEntries.filter(([k]) => k !== "Individual").reduce((s,[,v]) => s+v, 0).toLocaleString()}`} icon={Building2} iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Individual Spend" value={`₹${(finalSpend["Individual"] ?? 0).toLocaleString()}`} icon={User} iconBg="#F1F5F9" iconColor="#64748B" />
          </div>

          {/* Daily bar chart */}
          <div style={CARD_STYLE}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 22px 8px" }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Daily Spend — Last 7 Days</p>
                <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>
                  Week total: <span style={{ fontWeight: 700, color: "#334155" }}>₹{weekDays.reduce((s,d) => s+d.total,0).toLocaleString()}</span>
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

          {/* Spend by Source */}
          <div style={CARD_STYLE}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px" }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Spend by Source</p>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>{spendEntries.length} sources</span>
            </div>
            <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {spendEntries.map(([source, amount]) => {
                const pct      = totalSpend > 0 ? (amount / totalSpend) * 100 : 0;
                const cfg      = srcCfg(source);
                const tripCount = supBookings.filter(b => (b.bookingSource ?? "Individual") === source && b.fare).length ||
                                  (source === "Infosys" ? 3 : source === "Wipro" ? 2 : 2);
                const isAssigned = supervisor.companies.includes(source);
                return (
                  <div key={source}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {cfg.initial}
                        </div>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>{source}</span>
                        <span style={{ background: isAssigned ? "#DBEAFE" : source === "Individual" ? "#CFFAFE" : "#F1F5F9", color: isAssigned ? "#1D4ED8" : source === "Individual" ? "#0891B2" : "#64748B", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 5 }}>
                          {isAssigned ? "Assigned" : source === "Individual" ? "Individual" : "Other"}
                        </span>
                        <span style={{ fontSize: 11.5, color: "#94A3B8" }}>{tripCount} trip{tripCount !== 1 ? "s" : ""}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>₹{amount.toLocaleString()}</span>
                        <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 8 }}>{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div style={{ height: 8, borderRadius: 20, background: "#F1F5F9", overflow: "hidden" }}>
                      <SpendBar pct={pct} color={cfg.color} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: TRANSACTIONS ══ */}
      {activeTab === "transactions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 3 stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            <StatCard label="Total Billed" value={`₹${totalSpend.toLocaleString()}`} icon={Receipt}   iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Total Paid"   value={`₹${totalPaid.toLocaleString()}`}  icon={Wallet}    iconBg="#F1F5F9" iconColor="#64748B" />
            <StatCard label="Outstanding"  value={`₹${outstanding.toLocaleString()}`} icon={TrendingUp} iconBg="#F1F5F9" iconColor="#64748B" />
          </div>

          {/* Record form */}
          <div style={CARD_STYLE}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 12px" }}>
              <div style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 9, padding: 7 }}>
                <Receipt className="h-4 w-4" style={{ color: "#64748B" }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Record Transaction Received</p>
            </div>
            <form onSubmit={handleRecord} style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: "0 20px 20px", alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, width: 160 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", fontFamily: font }}>Amount Received (₹)</label>
                <Input type="number" placeholder="0" min="1" value={txnForm.amount} onChange={e => setTxnForm(f => ({ ...f, amount: e.target.value }))} style={{ fontFamily: font }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 200 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", fontFamily: font }}>Note (optional)</label>
                <Input placeholder="e.g. Cash received for April dues" value={txnForm.note} onChange={e => setTxnForm(f => ({ ...f, note: e.target.value }))} style={{ fontFamily: font }} />
              </div>
              <button
                type="submit"
                disabled={!txnForm.amount}
                style={{ height: 40, padding: "0 20px", borderRadius: 9, border: "none", background: txnRecorded ? "#22C55E" : ACCENT, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: font, transition: "background 0.2s", opacity: !txnForm.amount ? 0.5 : 1 }}
              >
                {txnRecorded ? "✓ Recorded" : "Record"}
              </button>
            </form>
          </div>

          {/* Transaction history */}
          <div style={CARD_STYLE}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px" }}>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Transaction History</p>
              {transactions.length > 0 && (
                <span style={{ fontSize: 12, color: "#94A3B8" }}>Total received: <strong style={{ color: "#0F172A" }}>₹{totalPaid.toLocaleString()}</strong></span>
              )}
            </div>
            {transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Receipt className="h-5 w-5" style={{ color: "#CBD5E1" }} />
                </div>
                <p style={{ fontSize: 13.5, color: "#94A3B8", fontWeight: 600 }}>No transactions recorded yet</p>
                <p style={{ fontSize: 12, color: "#CBD5E1" }}>Use the form above to log a payment received.</p>
              </div>
            ) : (
              <div>
                {transactions.map(txn => (
                  <div key={txn.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderTop: "1px solid #F8FAFC" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Check className="h-4 w-4" style={{ color: "#64748B" }} />
                      </div>
                      <div>
                        {txn.note && <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{txn.note}</p>}
                        <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>
                          {new Date(txn.recordedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p style={{ fontSize: 10, color: "#CBD5E1", fontFamily: "monospace", marginTop: 1 }}>{txn.id}</p>
                      </div>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "#16A34A" }}>+₹{txn.amount.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: SETTINGS ══ */}
      {activeTab === "settings" && (
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
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Profile Settings</p>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", fontFamily: font }}>Status</label>
                    <select
                      value={editForm.status}
                      onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      style={{ height: 40, border: "1px solid #E2E8F0", borderRadius: 8, padding: "0 12px", fontSize: 14, fontFamily: font, background: "#fff", color: "#0F172A" }}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20, paddingTop: 20, borderTop: "1px solid #F1F5F9" }}>
                  <button
                    onClick={() => {
                      updateSupervisor(supervisor.id, { name: editForm.name, email: editForm.email, phone: editForm.phone, zone: editForm.zone, status: editForm.status as "Active" | "Inactive" });
                      setEditSaved(true);
                      setTimeout(() => setEditSaved(false), 2500);
                    }}
                    style={{ padding: "9px 22px", borderRadius: 9, background: editSaved ? "#22C55E" : ACCENT, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", border: "none", fontFamily: font, transition: "background 0.2s" }}
                  >
                    {editSaved ? "✓ Saved!" : "Save Changes"}
                  </button>
                  {editSaved && <p style={{ fontSize: 12.5, color: "#22C55E", fontWeight: 600 }}>Profile updated successfully.</p>}
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
                      onClick={() => updateSupervisor(supervisor.id, { appAccess: !supervisor.appAccess })}
                      style={{ padding: "8px 18px", borderRadius: 9, border: supervisor.appAccess ? "1.5px solid #FECACA" : `1.5px solid ${ACCENT}`, background: supervisor.appAccess ? "#FFF5F5" : `${ACCENT}10`, color: supervisor.appAccess ? "#DC2626" : ACCENT, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: font, transition: "all 0.2s" }}
                    >
                      {supervisor.appAccess ? "Disable Access" : "Enable Access"}
                    </button>
                  </div>
                </div>

                {/* Password reset */}
                <div style={{ ...CARD_STYLE, padding: 22 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 4 }}>Password Reset</p>
                  <p style={{ fontSize: 12.5, color: "#94A3B8", marginBottom: 16 }}>Send a password reset link to the supervisor's registered email.</p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFC", border: "1px solid #E8EEF4", borderRadius: 12, padding: "14px 18px" }}>
                    <p style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{supervisor.email}</p>
                    <button style={{ padding: "8px 18px", borderRadius: 9, border: "1.5px solid #E8EEF4", background: "#fff", color: "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: font }}>
                      Send Reset Link
                    </button>
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
                      onClick={() => setDeleteOpen(true)}
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
      )}

      {/* ── Recharge Dialog ── */}
      <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
        <DialogContent className="sm:max-w-sm" style={{ fontFamily: font }}>
          <DialogHeader>
            <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: font }}>
              <Wallet className="h-4 w-4" style={{ color: ACCENT }} /> Recharge Wallet
            </DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "8px 0" }}>
            <div style={{ background: "#F8FAFC", border: "1px solid #E8EEF4", borderRadius: 10, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                <span>Current Balance</span>
                <span style={{ fontWeight: 700, color: "#15803D" }}>₹{walletRemaining.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                <span>Total Limit</span>
                <span style={{ fontWeight: 600, color: "#334155" }}>₹{supervisor.walletLimit.toLocaleString()}</span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", fontFamily: font }}>Add Amount (₹)</label>
              <Input id="recharge-amount" type="number" min="1" placeholder="e.g. 5000" value={rechargeAmt}
                onChange={e => { setRechargeAmt(e.target.value); setRechargeErr(""); }}
                style={{ fontFamily: font }}
              />
              {rechargeErr && <p style={{ fontSize: 11.5, color: "#DC2626" }}>{rechargeErr}</p>}
              {rechargeAmt && Number(rechargeAmt) > 0 && (
                <p style={{ fontSize: 12, color: "#64748B" }}>New balance: <strong style={{ color: "#15803D" }}>₹{(walletRemaining + Number(rechargeAmt)).toLocaleString()}</strong></p>
              )}
            </div>
          </div>
          <DialogFooter style={{ gap: 8 }}>
            <Button variant="outline" onClick={() => setRechargeOpen(false)} style={{ fontFamily: font }}>Cancel</Button>
            <Button
              style={{ background: ACCENT, color: "#fff", fontFamily: font }}
              onClick={() => {
                const amt = Number(rechargeAmt);
                if (!amt || amt <= 0) { setRechargeErr("Enter a valid amount"); return; }
                updateSupervisor(supervisor.id, { walletLimit: supervisor.walletLimit + amt });
                setRechargeOpen(false);
              }}
            >
              Confirm Recharge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent style={{ fontFamily: font }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#DC2626", display: "flex", alignItems: "center", gap: 7, fontFamily: font }}>
              <AlertTriangle className="h-5 w-5" /> Confirm Deletion
            </DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: 13.5, color: "#334155", padding: "8px 0" }}>
            Permanently delete <strong style={{ color: "#0F172A" }}>{supervisor.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter style={{ gap: 8 }}>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} style={{ fontFamily: font }}>Cancel</Button>
            <Button variant="destructive" onClick={() => { deleteSupervisor(supervisor.id); router.push("/dashboard/supervisors"); }} style={{ fontFamily: font }}>
              Yes, Delete
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

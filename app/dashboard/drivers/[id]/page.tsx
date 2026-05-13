"use client";

import { useParams, useRouter } from "next/navigation";
import { useVendor } from "@/context/VendorContext";
import { DriverHistoryMap } from "@/components/DriverHistoryMap";
import { useState, useEffect } from "react";
import {
  ArrowLeft, Route, TrendingUp, Circle,
  IndianRupee, ArrowRight, User, Phone, Car,
  CheckCircle2, Building2,
} from "lucide-react";
import { Skeleton, SkeletonInline } from "@/components/ui/skeleton";
import { STATUS_STYLES } from "@/components/StatusBadge";

// ── constants ────────────────────────────────────────────────────────────────
const ACCENT = "#2563EB";
const CARD_STYLE: React.CSSProperties = {
  background: "#fff",
  border: "1.5px solid #E8EEF4",
  borderRadius: 16,
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};

const DUMMY_WEEKLY = [320, 0, 480, 750, 210, 680, 540];

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
  const today = new Date().toISOString().split("T")[0];
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

function EarningsBar({ pct, color }: { pct: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct), 120); return () => clearTimeout(t); }, [pct]);
  return <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 20, transition: "width 0.7s ease" }} />;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function DriverProfilePage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const { drivers, bookings, isLoading } = useVendor();
  const [activeTab, setActiveTab] = useState("overview");

  const driver = drivers.find(d => d.id === id);
  if (!isLoading && !driver) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p style={{ color: "#64748B" }}>Driver not found.</p>
        <button onClick={() => router.back()} style={{ fontSize: 13, color: ACCENT, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Go back</button>
      </div>
    );
  }

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
          <p style={{ fontSize: 12, color: "#64748B", marginTop: 1 }}>
            {isLoading || !driver ? (
              <SkeletonInline className="h-3 w-32" />
            ) : (
              <>{driver.name} · Full details</>
            )}
          </p>
        </div>
      </div>

      {/* ── Tab Bar — left-aligned underline style matching Supervisor Profile ── */}
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
      {activeTab === "overview" && (isLoading || !driver ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...CARD_STYLE, padding: "20px 24px", display: "flex", alignItems: "center", gap: 18 }}>
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
            <Skeleton className="h-[120px] rounded-2xl" />
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

          {/* ── Profile card — identical layout to Supervisor Profile ── */}
          <div style={{ ...CARD_STYLE, padding: "20px 24px", display: "flex", alignItems: "center", gap: 18 }}>
            {/* Avatar + online dot */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 800 }}>
                {drvInitials}
              </div>
              <span style={{ position: "absolute", bottom: 2, right: 2, width: 13, height: 13, borderRadius: "50%", background: isOnline ? "#22C55E" : "#94A3B8", border: "2px solid #fff" }} />
            </div>

            {/* Name + badges + contact row */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Row 1: name + status badge + online text */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{driver.name}</span>
                <span style={{ background: statusCfg.bg, color: statusCfg.text, border: `1px solid ${statusCfg.border}`, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
                  {driver.status}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: isOnline ? "#22C55E" : "#94A3B8" }}>
                  <Circle className="h-2 w-2 fill-current" />{isOnline ? "Online" : "Offline"}
                </span>
              </div>

              {/* Row 2: contact details with icons */}
              <div style={{ display: "flex", gap: 20, marginTop: 8, flexWrap: "wrap" as const }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#334155" }}>
                  <Phone className="h-3.5 w-3.5" style={{ color: "#94A3B8" }} />{driver.phone}
                </span>
                {driver.vehicle && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#334155" }}>
                    <Car className="h-3.5 w-3.5" style={{ color: "#94A3B8" }} />{driver.vehicle}
                  </span>
                )}
                {driver.assignedSupervisorName && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#334155" }}>
                    <User className="h-3.5 w-3.5" style={{ color: "#94A3B8" }} />{driver.assignedSupervisorName}
                  </span>
                )}
              </div>
            </div>

            {/* Last active — far right */}
            <p style={{ fontSize: 12, color: "#94A3B8", flexShrink: 0 }}>
              Last active {new Date(driver.lastActive).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* ── 4 stat cards ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            <StatCard label="Total Trips"       value={driver.totalTrips}    icon={Route}        iconBg="#F1F5F9" iconColor="#0F172A" />
            <StatCard label="Today's Trips"  value={todayBookings.length} icon={Route}        iconBg="#F1F5F9" iconColor="#0F172A" />
            <StatCard label="Today's Completed" value={completedToday}       icon={CheckCircle2} iconBg="#F1F5F9" iconColor="#0F172A" />
            <StatCard label="Ongoing"           value={ongoingCt}            icon={Circle}       iconBg="#F1F5F9" iconColor="#0F172A" />
          </div>

          {/* ── Earnings card (left) + right column — same split as Supervisor's Wallet section ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>

            {/* Solid blue earnings card — matches Supervisor "Wallet Balance" card exactly */}
            <div style={{
              background: "linear-gradient(135deg, #1e40af 0%, #2563EB 60%, #3b82f6 100%)",
              borderRadius: 18, padding: "16px 20px 14px",
              display: "flex", flexDirection: "column", justifyContent: "space-between",
              position: "relative", overflow: "hidden", minHeight: 120,
            }}>
              <div style={{ position: "absolute", top: -24, right: -24, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
              <div style={{ position: "absolute", bottom: -30, right: 30, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />

              <p style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>
                Trip Earnings
              </p>
              <p style={{ fontSize: 32, fontWeight: 800, color: "#fff", lineHeight: 1, letterSpacing: -1, margin: "8px 0" }}>
                ₹{displayEarned.toLocaleString("en-IN")}
              </p>
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                <span>{completedTrips || driver.totalTrips} trips completed</span>
                <span>·</span>
                <span>Avg ₹{displayAvg} / trip</span>
              </div>
            </div>

            {/* Right column: Assigned Supervisor card + Recent Activity card */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Assigned Supervisor — same structure as Supervisor's "Assigned Companies" card */}
              <div style={CARD_STYLE}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 9, padding: 7 }}>
                      <Building2 className="h-4 w-4" style={{ color: "#0F172A" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Assigned Supervisor</p>
                      <p style={{ fontSize: 11, color: "#94A3B8" }}>Current assignment</p>
                    </div>
                  </div>
                  <span style={{ background: "#F1F5F9", color: "#64748B", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
                    {driver.assignedSupervisorName ? "1 assigned" : "None"}
                  </span>
                </div>
                <div style={{ padding: "0 16px 16px", display: "flex", flexWrap: "wrap" as const, gap: 8 }}>
                  {driver.assignedSupervisorName ? (
                    <span style={{ display: "inline-flex", alignItems: "center", background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8 }}>
                      {driver.assignedSupervisorName}
                    </span>
                  ) : (
                    <p style={{ color: "#94A3B8", fontSize: 12.5, padding: "6px 0" }}>No supervisor assigned.</p>
                  )}
                  {driver.vehicle && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#F8FAFC", border: "1px solid #E8EEF4", color: "#334155", fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8 }}>
                      <Car className="h-3 w-3" style={{ color: "#94A3B8" }} /> {driver.vehicle}
                    </span>
                  )}
                </div>
              </div>

              {/* Recent Activity — same structure as Supervisor's "Recent Activity" card */}
              <div style={{ ...CARD_STYLE, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px" }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Recent Activity</p>
                  <button onClick={() => setActiveTab("trips")} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, background: "none", border: "none", cursor: "pointer", fontFamily: font }}>
                    View all →
                  </button>
                </div>
                <div>
                  {(drvBookings.length > 0 ? drvBookings : []).slice(0, 4).map(booking => {
                    const sc = STATUS_STYLES[booking.status] ?? STATUS_STYLES["Pending"];
                    return (
                      <div key={booking.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderTop: "1px solid #F8FAFC" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
                          <span style={{ marginTop: 5, width: 8, height: 8, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
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
                  {drvBookings.length === 0 && driver.recentTrips.slice(0, 4).map(trip => (
                    <div key={trip.bookingId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderTop: "1px solid #F8FAFC" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 }}>
                        <span style={{ marginTop: 5, width: 8, height: 8, borderRadius: "50%", background: "#22C55E", flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                            {trip.from} → {trip.to}
                          </p>
                          <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{trip.date}</p>
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", flexShrink: 0, marginLeft: 16 }}>—</span>
                    </div>
                  ))}
                  {drvBookings.length === 0 && driver.recentTrips.length === 0 && (
                    <p style={{ textAlign: "center" as const, color: "#94A3B8", fontSize: 12.5, padding: "16px 0 20px" }}>No recent trips.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      ))}

      {/* ══ TAB: RECENT TRIPS ══ */}
      {activeTab === "trips" && (
        <div style={CARD_STYLE}>
          {/* Header — matches Active Trips table column scheme */}
          <div style={{ display: "grid", gridTemplateColumns: "110px 2fr 150px 1.3fr 110px 90px", gap: 16, padding: "12px 20px", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC", borderRadius: "14px 14px 0 0" }}>
            {["TRIP ID & TYPE", "ROUTE", "SUPERVISOR", "VEHICLE", "STATUS", "CREATED AT"].map(h => (
              <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>{h}</span>
            ))}
          </div>

          {isLoading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 2fr 150px 1.3fr 110px 90px", gap: 16, padding: "14px 20px", borderBottom: i < 4 ? "1px solid #F8FAFC" : "none", alignItems: "center" }}>
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
                    style={{ display: "grid", gridTemplateColumns: "110px 2fr 150px 1.3fr 110px 90px", gap: 16, padding: "14px 20px", borderBottom: idx < drvBookings.length - 1 ? "1px solid #F8FAFC" : "none", alignItems: "center" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {/* TRIP ID & TYPE */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontWeight: 800, color: "#0F172A", fontSize: 13 }}>{booking.bookingRef ?? "—"}</span>
                      <span style={{ background: booking.type === "Instant" ? "#EEF2FF" : "#FEF3C7", color: booking.type === "Instant" ? "#2563EB" : "#B45309", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, display: "inline-block", width: "fit-content" }}>
                        {booking.type}
                      </span>
                    </div>

                    {/* ROUTE */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{booking.pickupLocation}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <div style={{ width: 42, height: 2, borderRadius: 2, background: `linear-gradient(to right,#A5B4FC,${ACCENT})` }} />
                        <ArrowRight className="h-3 w-3" style={{ color: ACCENT }} />
                      </div>
                      <p style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{booking.dropLocation}</p>
                    </div>

                    {/* SUPERVISOR */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 13, color: "#334155", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{booking.supervisorName}</span>
                      {booking.bookingSource && (
                        <span style={{ background: "#E2E8F0", color: "#475569", border: "1px solid #CBD5E1", fontSize: 11, fontWeight: 600, padding: "1px 8px", borderRadius: 5, display: "inline-block", width: "fit-content" }}>
                          {booking.bookingSource}
                        </span>
                      )}
                    </div>

                    {/* VEHICLE */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{driver.vehicleReg ?? driver.vehicle ?? "—"}</span>
                      {driver.vehicleReg && driver.vehicle && (
                        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>{driver.vehicle}</span>
                      )}
                    </div>

                    {/* STATUS */}
                    <TripStatusBadge status={booking.status} />

                    {/* CREATED AT */}
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>{day}</span>
                      <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500, marginTop: 2 }}>{time}</span>
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
                  style={{ display: "grid", gridTemplateColumns: "110px 2fr 150px 1.3fr 110px 90px", gap: 16, padding: "14px 20px", borderBottom: idx < driver.recentTrips.length - 1 ? "1px solid #F8FAFC" : "none", alignItems: "center" }}
                >
                  {/* TRIP ID & TYPE */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontWeight: 800, color: "#0F172A", fontSize: 13 }}>{trip.bookingId}</span>
                    <span style={{ background: "#EEF2FF", color: "#2563EB", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, display: "inline-block", width: "fit-content" }}>Instant</span>
                  </div>

                  {/* ROUTE */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{trip.from}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <div style={{ width: 42, height: 2, borderRadius: 2, background: `linear-gradient(to right,#A5B4FC,${ACCENT})` }} />
                      <ArrowRight className="h-3 w-3" style={{ color: ACCENT }} />
                    </div>
                    <p style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{trip.to}</p>
                  </div>

                  {/* SUPERVISOR */}
                  <span style={{ fontSize: 13, color: "#334155", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{trip.supervisorName}</span>

                  {/* VEHICLE */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{driver.vehicleReg ?? driver.vehicle ?? "—"}</span>
                    {driver.vehicleReg && driver.vehicle && (
                      <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>{driver.vehicle}</span>
                    )}
                  </div>

                  {/* STATUS */}
                  <TripStatusBadge status="Completed" />

                  {/* CREATED AT */}
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>{trip.date}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: "center" as const, padding: "40px 0", color: "#94A3B8", fontSize: 13 }}>No trips yet.</p>
          )}
        </div>
      )}

      {/* ══ TAB: EARNINGS ══ */}
      {activeTab === "earnings" && (isLoading || !driver ? (
        <div className="space-y-4">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            <StatCard label="Total Earned"    value={`₹${displayEarned.toLocaleString()}`}         icon={IndianRupee} iconBg="#DBEAFE" iconColor="#2563EB" />
            <StatCard label="Completed Trips" value={completedTrips || driver.totalTrips}            icon={CheckCircle2} iconBg="#DCFCE7" iconColor="#15803D" />
            <StatCard label="Avg per Trip"    value={`₹${displayAvg.toLocaleString()}`}             icon={TrendingUp}   iconBg="#EDE9FE" iconColor="#6D28D9" />
          </div>

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

          <div style={CARD_STYLE}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px" }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Earnings by Source</p>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>{sourceEntries.length} sources</span>
            </div>
            <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {sourceEntries.map(([source, amount]) => {
                const pct      = totalSource > 0 ? (amount / totalSource) * 100 : 0;
                const cfg      = srcCfg(source);
                const tripCount = drvBookings.filter(b => (b.bookingSource ?? "Individual") === source && b.fare).length || (source === "Individual" ? 5 : 3);
                return (
                  <div key={source}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {cfg.initial}
                        </div>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>{source}</span>
                        <span style={{ fontSize: 11.5, color: "#94A3B8" }}>{tripCount} trip{tripCount !== 1 ? "s" : ""}</span>
                      </div>
                      <div style={{ textAlign: "right" as const }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>₹{amount.toLocaleString()}</span>
                        <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 8 }}>{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div style={{ height: 8, borderRadius: 20, background: "#F1F5F9", overflow: "hidden" }}>
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
        <div style={{ ...CARD_STYLE, padding: "20px 24px" }}>
          <Skeleton className="h-5 w-48 mb-4" />
          <Skeleton className="h-[380px] w-full rounded-xl" />
        </div>
      ) : (
        <div style={{ ...CARD_STYLE, padding: "20px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Location History</p>
            <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>GPS route replay for {driver.name}</p>
          </div>
          <DriverHistoryMap
            driverId={String(id)}
            driverName={driver.name}
            hours={12}
            apiBase="/api/vendor/drivers"
          />
        </div>
      ))}

      {/* ══ TAB: SETTINGS ══ */}
      {activeTab === "settings" && (
        <div style={{ ...CARD_STYLE, padding: 24 }}>
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Driver Information</p>
            <p style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 3 }}>Full profile details for this driver</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {(isLoading || !driver
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
              ]
            ).map((entry: any, i: number) => (
              <div key={entry._key ?? entry.label}>
                {entry._skeleton ? (
                  <>
                    <Skeleton className="h-3 w-24 mb-2" />
                    <Skeleton className="h-4 w-32" />
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 11.5, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 5 }}>{entry.label}</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{entry.value}</p>
                  </>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #F1F5F9" }}>
            <p style={{ fontSize: 12.5, color: "#94A3B8" }}>To edit driver details, use the driver management section.</p>
          </div>
        </div>
      )}

    </div>
  );
}

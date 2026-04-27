"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { mockDrivers, mockBookings } from "@/lib/mock-data";
import { superadminApi, type DriverApiItem } from "@/lib/api";
import type { Driver, DriverStatus } from "@/modules/drivers/types";
import {
  ArrowLeft, Phone, Car, TrendingUp, IndianRupee, User,
  ArrowRight, FileText, ShieldCheck, Clock, CheckCircle2,
  AlertCircle, Circle, ShieldBan, Trash2, TriangleAlert, Pencil,
} from "lucide-react";
import { STATUS_STYLES } from "@/components/StatusBadge";

// ── constants ────────────────────────────────────────────────────────────────
const ACCENT = "#2563EB";
const CARD_STYLE: React.CSSProperties = {
  background: "#fff",
  border: "1.5px solid #E8EEF4",
  borderRadius: 16,
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};


const DUMMY_WEEKLY = [420, 0, 180, 650, 320, 780, 640];

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

function weeklyEarnings(driverId: string) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0];
    const label   = d.toLocaleDateString("en-IN", { weekday: "short" });
    const real    = mockBookings
      .filter(b => b.driverId === driverId && b.createdAt.startsWith(dateStr) && (b.fare ?? 0) > 0)
      .reduce((s, b) => s + (b.fare ?? 0), 0);
    return { label, date: dateStr, total: real > 0 ? real : DUMMY_WEEKLY[6 - i] };
  });
}

// ── API → Driver shape ────────────────────────────────────────────────────────

function apiToDriver(d: DriverApiItem): Driver {
  return {
    id:                     d.id,
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

// ── page ─────────────────────────────────────────────────────────────────────
export default function SuperAdminDriverProfilePage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [driver,       setDriver]       = useState<Driver | null>(null);
  const [driverLoading,setDriverLoading]= useState(true);
  const [activeTab,    setActiveTab]    = useState("overview");
  const [isBlocked,    setIsBlocked]    = useState(false);
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [deleteConfirm,setDeleteConfirm]= useState(false);
  const [deleteInput,  setDeleteInput]  = useState("");
  const [actionDone,   setActionDone]   = useState<"blocked" | "unblocked" | "deleted" | null>(null);
  const [expiryEdits,  setExpiryEdits]  = useState<Record<string, string>>({});
  const [expiryEditId, setExpiryEditId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const mock = mockDrivers.find(d => d.id === id);
    if (mock) { setDriver(mock); setDriverLoading(false); return; }
    superadminApi.drivers.get(id)
      .then(res => setDriver(apiToDriver(res.data)))
      .catch(() => setDriver(null))
      .finally(() => setDriverLoading(false));
  }, [id]);

  if (driverLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240, color: "#94A3B8", fontSize: 13 }}>
        Loading driver…
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

  const driverBookings = mockBookings.filter(b => b.driverId === driver.id);
  const completedTrips = driverBookings.filter(b => b.status === "Completed");
  const totalEarned    = completedTrips.reduce((s, b) => s + (b.fare ?? 0), 0);
  const avgEarning     = completedTrips.length > 0 ? Math.round(totalEarned / completedTrips.length) : 0;

  const today         = new Date().toISOString().split("T")[0];
  const todayBookings = driverBookings.filter(b => b.createdAt?.startsWith(today));
  const completedToday = todayBookings.filter(b => b.status === "Completed").length;
  const ongoingCt     = driverBookings.filter(b => b.status === "Ongoing").length;

  const displayEarned = totalEarned > 0 ? totalEarned : 3800;
  const displayAvg    = avgEarning > 0 ? avgEarning : 760;

  const weekDays   = weeklyEarnings(driver.id);
  const documents  = getDocuments(driver.id);
  const verifiedCt = documents.filter(d => d.status === "Verified").length;

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
                  <Phone className="h-3.5 w-3.5" style={{ color: "#94A3B8" }} />{driver.phone}
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
            <StatCard label="Total Trips"  value={driver.totalTrips}                        icon={Car}          iconBg="#0F172A" iconColor="#fff" />
            <StatCard label="Completed"    value={completedTrips.length}                    icon={CheckCircle2} iconBg="#0F172A" iconColor="#fff" />
            <StatCard label="Total Earned" value={`₹${displayEarned.toLocaleString()}`}    icon={IndianRupee}  iconBg="#0F172A" iconColor="#fff" />
            <StatCard label="Avg per Trip" value={`₹${displayAvg.toLocaleString()}`}       icon={TrendingUp}   iconBg="#0F172A" iconColor="#fff" />
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
                ₹{displayEarned.toLocaleString("en-IN")}
              </p>
              <div style={{ display: "flex", gap: 14, fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
                <span>{completedTrips.length || driver.totalTrips} trips completed</span>
                <span>·</span>
                <span>Avg ₹{displayAvg} / trip</span>
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
                    { label: "Supervisor",  value: driver.assignedSupervisorName ?? "Unassigned" },
                    { label: "Vehicle",     value: driver.vehicle ?? "—" },
                    { label: "Status",      value: driver.status },
                    { label: "Phone",       value: driver.phone },
                    { label: "Driver ID",   value: driver.id },
                    { label: "Last Active", value: fmtDate(driver.lastActive) },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div style={{ ...CARD_STYLE }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 12px" }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Recent Activity</p>
                  <button onClick={() => setActiveTab("trips")} style={{ fontSize: 12, fontWeight: 700, color: ACCENT, background: "none", border: "none", cursor: "pointer", fontFamily: font }}>
                    View all →
                  </button>
                </div>
                <div>
                  {driverBookings.slice(0, 3).map(b => {
                    const sc = STATUS_STYLES[b.status] ?? STATUS_STYLES["Pending"];
                    return (
                      <div key={b.id} style={{ padding: "10px 18px", borderTop: "1px solid #F8FAFC" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{b.pickupLocation}</p>
                            <div style={{ display: "flex", alignItems: "center", gap: 3, margin: "2px 0" }}>
                              <div style={{ width: 28, height: 2, borderRadius: 2, background: `linear-gradient(to right,#A5B4FC,${ACCENT})` }} />
                              <ArrowRight className="h-2.5 w-2.5" style={{ color: ACCENT }} />
                            </div>
                            <p style={{ fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{b.dropLocation}</p>
                            <p style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{fmtDate(b.createdAt)}</p>
                          </div>
                          <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{b.fare ? `₹${b.fare}` : "—"}</p>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: sc.text, marginTop: 2 }}>
                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />{b.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {driverBookings.length === 0 && (
                    <p style={{ textAlign: "center" as const, color: "#94A3B8", fontSize: 12.5, padding: "16px 0 20px" }}>No recent trips.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: RECENT TRIPS ══ */}
      {activeTab === "trips" && (
        <div style={CARD_STYLE}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr 0.6fr 0.5fr 0.7fr", columnGap: 20, padding: "12px 24px", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC", borderRadius: "14px 14px 0 0" }}>
            {["ROUTE", "SUPERVISOR", "TYPE", "FARE", "STATUS"].map(h => (
              <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>{h}</span>
            ))}
          </div>
          {driverBookings.length === 0 ? (
            <p style={{ textAlign: "center" as const, padding: "40px 0", color: "#94A3B8", fontSize: 13 }}>No trips yet.</p>
          ) : (
            <div>
              {driverBookings.map((b, idx) => (
                <div
                  key={b.id}
                  style={{ display: "grid", gridTemplateColumns: "1.4fr 0.9fr 0.6fr 0.5fr 0.7fr", columnGap: 20, padding: "14px 24px", borderBottom: idx < driverBookings.length - 1 ? "1px solid #F8FAFC" : "none", alignItems: "center" }}
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
                  <span style={{ fontSize: 13, color: "#334155", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{b.supervisorName}</span>
                  <span style={{ background: b.type === "Instant" ? "#DBEAFE" : "#FEF3C7", color: b.type === "Instant" ? "#1D4ED8" : "#B45309", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5, display: "inline-block" }}>
                    {b.type}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                    {b.fare ? `₹${b.fare.toLocaleString()}` : <span style={{ color: "#CBD5E1" }}>—</span>}
                  </span>
                  <TripStatusBadge status={b.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB: EARNINGS ══ */}
      {activeTab === "earnings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
            <StatCard label="Total Earned"    value={`₹${displayEarned.toLocaleString()}`} icon={IndianRupee}  iconBg="#0F172A" iconColor="#fff" />
            <StatCard label="Completed Trips" value={completedTrips.length}                 icon={CheckCircle2} iconBg="#0F172A" iconColor="#fff" />
            <StatCard label="Avg per Trip"    value={`₹${displayAvg.toLocaleString()}`}    icon={TrendingUp}   iconBg="#0F172A" iconColor="#fff" />
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

          {/* Trip earnings table */}
          <div style={CARD_STYLE}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px" }}>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Trip Earnings Breakdown</p>
              <span style={{ fontSize: 12, color: "#94A3B8" }}>{driverBookings.length} trips total</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 0.6fr 0.8fr", columnGap: 20, padding: "10px 24px", borderTop: "1px solid #F8FAFC", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC" }}>
              {["ROUTE", "SUPERVISOR", "FARE", "STATUS"].map(h => (
                <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>{h}</span>
              ))}
            </div>
            {driverBookings.length === 0 ? (
              <p style={{ textAlign: "center" as const, padding: "32px 0", color: "#94A3B8", fontSize: 13 }}>No earnings data yet.</p>
            ) : (
              <div>
                {driverBookings.map((b, idx) => (
                  <div
                    key={b.id}
                    style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 0.6fr 0.8fr", columnGap: 20, padding: "14px 24px", borderBottom: idx < driverBookings.length - 1 ? "1px solid #F8FAFC" : "none", alignItems: "center" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{b.pickupLocation}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 3, margin: "3px 0" }}>
                        <div style={{ width: 32, height: 2, borderRadius: 2, background: `linear-gradient(to right,#A5B4FC,${ACCENT})` }} />
                        <ArrowRight className="h-2.5 w-2.5" style={{ color: ACCENT }} />
                      </div>
                      <p style={{ fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{b.dropLocation}</p>
                      <p style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{fmtDate(b.createdAt)}</p>
                    </div>
                    <span style={{ fontSize: 12.5, color: "#334155", fontWeight: 500 }}>{b.supervisorName}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                      {b.fare ? `₹${b.fare.toLocaleString()}` : <span style={{ color: "#CBD5E1" }}>—</span>}
                    </span>
                    <TripStatusBadge status={b.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TAB: DOCUMENTS ══ */}
      {activeTab === "documents" && (() => {
        const DGRID = "2fr 1.4fr 1.1fr 1.8fr";
        const COL_GAP = 20;
        const ROW_PAD = "14px 24px";


        function ExpiryCell({ docKey, initialDate, hasExpiry }: { docKey: string; initialDate: string | null; hasExpiry: boolean }) {
          const currentVal = expiryEdits[docKey] ?? initialDate ?? "";
          const isEditing  = expiryEditId === docKey;

          if (!hasExpiry) return <span style={{ fontSize: 12, color: "#CBD5E1", fontStyle: "italic" }}>No expiry</span>;

          if (isEditing) return (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="date"
                value={currentVal}
                autoFocus
                onChange={e => setExpiryEdits(p => ({ ...p, [docKey]: e.target.value }))}
                style={{ fontSize: 12, border: "1.5px solid #93C5FD", borderRadius: 7, padding: "3px 8px", color: "#0F172A", outline: "none", fontFamily: font }}
              />
              <button
                onClick={() => setExpiryEditId(null)}
                style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: ACCENT, color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >✓</button>
              <button
                onClick={() => { setExpiryEdits(p => { const n = { ...p }; delete n[docKey]; return n; }); setExpiryEditId(null); }}
                style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >✕</button>
            </div>
          );

          return (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12.5, color: currentVal ? "#334155" : "#94A3B8", fontWeight: currentVal ? 600 : 400 }}>
                {currentVal ? fmtDate(currentVal) : "Not set"}
              </span>
              <button
                onClick={() => { setExpiryEdits(p => ({ ...p, [docKey]: currentVal })); setExpiryEditId(docKey); }}
                style={{ padding: 4, borderRadius: 5, border: "1px solid #E8EEF4", background: "#F8FAFC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          );
        }

        function DocTable({ title, docs }: { title: string; docs: { id: string; name: string; status: string; hasExpiry: boolean; expiryDate: string | null; prefix: string }[] }) {
          return (
            <div style={CARD_STYLE}>
              <div style={{ padding: "14px 24px 12px", borderBottom: "1px solid #F1F5F9" }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{title}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: DGRID, columnGap: COL_GAP, padding: "10px 24px", background: "#F8FAFC" }}>
                {["DOCUMENT", "EXPIRY DATE", "STATUS", "ACTION"].map(h => (
                  <span key={h} style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>{h}</span>
                ))}
              </div>
              {docs.map((doc, idx) => {
                const isPending   = doc.status === "Pending";
                const sc          = STATUS_STYLES[doc.status] ?? STATUS_STYLES["Not Submitted"];
                const docKey      = `${doc.prefix}-${doc.id}`;
                return (
                  <div
                    key={doc.id}
                    style={{ display: "grid", gridTemplateColumns: DGRID, columnGap: COL_GAP, padding: ROW_PAD, borderTop: "1px solid #F8FAFC", alignItems: "center" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {/* DOCUMENT */}
                    <span style={{ fontSize: 13.5, fontWeight: isPending ? 700 : 500, color: isPending ? "#0F172A" : "#94A3B8" }}>{doc.name}</span>

                    {/* EXPIRY DATE */}
                    <ExpiryCell docKey={docKey} initialDate={doc.expiryDate} hasExpiry={doc.hasExpiry} />

                    {/* STATUS */}
                    {isPending ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: sc.text, background: sc.bg, border: `1px solid ${sc.border}`, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" as const, width: "fit-content" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />Pending
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#CBD5E1" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#CBD5E1", flexShrink: 0 }} />Not Submitted
                      </span>
                    )}

                    {/* ACTION */}
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {isPending ? (
                        <>
                          <button style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#334155", fontFamily: font }}>View</button>
                          <button style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font }}>Approve</button>
                          <button style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#334155", fontFamily: font }}>Reject</button>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>Awaiting upload</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              <StatCard label="Total Documents" value={15} icon={FileText}    iconBg="#0F172A" iconColor="#fff" />
              <StatCard label="Submitted"       value={7}  icon={ShieldCheck} iconBg="#0F172A" iconColor="#fff" />
              <StatCard label="Approved"        value={0}  icon={CheckCircle2} iconBg="#0F172A" iconColor="#fff" />
            </div>

            <DocTable title="Driver Documents" docs={[
              { id: "dl",      name: "Driving License",       status: "Pending",       hasExpiry: true,  expiryDate: "2028-01-11", prefix: "drv" },
              { id: "aadhaar", name: "Aadhaar Card",           status: "Pending",       hasExpiry: false, expiryDate: null,         prefix: "drv" },
              { id: "photo",   name: "Profile Photo",          status: "Pending",       hasExpiry: false, expiryDate: null,         prefix: "drv" },
              { id: "address", name: "Current Address Proof",  status: "Pending",       hasExpiry: false, expiryDate: null,         prefix: "drv" },
              { id: "medical", name: "Medical Certificate",    status: "Not Submitted", hasExpiry: true,  expiryDate: null,         prefix: "drv" },
              { id: "police",  name: "Police Verification",    status: "Not Submitted", hasExpiry: false, expiryDate: null,         prefix: "drv" },
              { id: "letter",  name: "Undertaking Letter",     status: "Not Submitted", hasExpiry: false, expiryDate: null,         prefix: "drv" },
              { id: "badge",   name: "Badge",                  status: "Not Submitted", hasExpiry: true,  expiryDate: null,         prefix: "drv" },
            ]} />

            <DocTable title="Vehicle Documents" docs={[
              { id: "rc",      name: "Registration Certificate", status: "Pending",       hasExpiry: true,  expiryDate: "2034-03-20", prefix: "veh" },
              { id: "tax",     name: "Tax Certificate",           status: "Pending",       hasExpiry: true,  expiryDate: null,         prefix: "veh" },
              { id: "permit",  name: "Permit",                    status: "Pending",       hasExpiry: true,  expiryDate: null,         prefix: "veh" },
              { id: "ins",     name: "Insurance",                 status: "Not Submitted", hasExpiry: true,  expiryDate: null,         prefix: "veh" },
              { id: "fitness", name: "Fitness Certificate",       status: "Not Submitted", hasExpiry: true,  expiryDate: null,         prefix: "veh" },
              { id: "form42",  name: "Form 42",                   status: "Not Submitted", hasExpiry: false, expiryDate: null,         prefix: "veh" },
              { id: "puc",     name: "PUC",                       status: "Not Submitted", hasExpiry: true,  expiryDate: null,         prefix: "veh" },
            ]} />
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

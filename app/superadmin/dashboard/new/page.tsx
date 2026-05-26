"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Activity,
  Building2,
  Clock3,
  ExternalLink,
  Gauge,
  IndianRupee,
  MapPin,
  RefreshCw,
  Route,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  superadminApi,
  vendorReportApi,
  type OverviewData,
  type VendorListItem,
  type VendorReportData,
  type VendorWalletTx,
  type DriverApiItem,
  type DriverTripsResponse,
} from "@/lib/api";

const FONT = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";
const LOW_WALLET_THRESHOLD = 5000;

type VendorRow = {
  id: string;
  name: string;
  city: string;
  status: string;
  walletBalance: number;
  bookingsToday: number;
  spendToday: number;
  rechargeToday: number;
  driverCount: number | null;
  lastRechargeAt: string | null;
};

type DriverRow = {
  id: string;
  name: string;
  phone: string;
  status: string;
  isOnline: boolean;
  vehicleLabel: string;
  tripsToday: number;
  completedTripsToday: number;
  earningsToday: number;
  withdrawnToday: number | null;
  lastActiveAt: string | null;
  totalTrips: number;
};

function fmtCurrency(value: number | null | undefined) {
  if (value == null) return "—";
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function fmtNumber(value: number | null | undefined) {
  if (value == null) return "—";
  return Number(value).toLocaleString("en-IN");
}

function formatRelative(iso: string | null) {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function todayISO() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toneClass(tone: "blue" | "green" | "amber" | "red" | "slate") {
  switch (tone) {
    case "green":
      return { bg: "#DCFCE7", fg: "#166534", dot: "#22C55E", iconBg: "#F0FDF4" };
    case "amber":
      return { bg: "#FEF3C7", fg: "#92400E", dot: "#F59E0B", iconBg: "#FFFBEB" };
    case "red":
      return { bg: "#FEE2E2", fg: "#B91C1C", dot: "#EF4444", iconBg: "#FEF2F2" };
    case "slate":
      return { bg: "#E2E8F0", fg: "#475569", dot: "#94A3B8", iconBg: "#F8FAFC" };
    default:
      return { bg: "#DBEAFE", fg: "#1D4ED8", dot: "#3B82F6", iconBg: "#EFF6FF" };
  }
}

type KpiTone = "blue" | "green" | "amber" | "red" | "slate";

function StatusPill({ label, tone = "slate" }: { label: string; tone?: KpiTone }) {
  const c = toneClass(tone);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: c.bg,
        color: c.fg,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function PanelCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1.5px solid #E8EEF4",
        borderRadius: 22,
        boxShadow: "0 8px 28px rgba(15,23,42,0.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 4, lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  tone?: KpiTone;
}) {
  const c = toneClass(tone);
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.94)",
        border: "1.5px solid #E8EEF4",
        borderRadius: 18,
        boxShadow: "0 4px 18px rgba(15,23,42,0.04)",
        padding: "18px 18px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: 128,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.7 }}>
          {label}
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: c.iconBg,
            border: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: c.fg,
            flexShrink: 0,
          }}
        >
          <Icon size={17} />
        </div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.45 }}>{sub}</div>
    </div>
  );
}

function FlowRow({
  label,
  value,
  sub,
  color,
  ratio,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  ratio: number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 110px", gap: 12, alignItems: "center" }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>{label}</div>
        <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "#EEF2F7", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(4, Math.min(100, ratio))}%`, height: "100%", borderRadius: 999, background: color }} />
      </div>
      <div style={{ textAlign: "right", fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>{value}</div>
    </div>
  );
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  const path = useMemo(() => {
    if (values.length === 0) return "";
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const width = 120;
    const height = 34;
    return values
      .map((v, i) => {
        const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
        const normalized = max === min ? 0.5 : (v - min) / (max - min);
        const y = height - normalized * height;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [values]);

  if (values.length === 0) return null;

  return (
    <svg viewBox="0 0 120 34" width="120" height="34" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export default function SuperAdminNewDashboardPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [vendorRows, setVendorRows] = useState<VendorRow[]>([]);
  const [driverRows, setDriverRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const today = todayISO();
    setLoading(true);
    setError(null);

    try {
      const [overviewRes, vendorListRes, driverListRes] = await Promise.all([
        superadminApi.overview(),
        vendorReportApi.listVendors(),
        superadminApi.drivers.list({ limit: 100 }),
      ]);

      const vendors = vendorListRes.data;
      const drivers = driverListRes.data;

      const vendorsDetailed = await Promise.all(
        vendors.map(async (vendor: VendorListItem) => {
          const [report, walletTx] = await Promise.all([
            safe(vendorReportApi.getReport(vendor.id, today, today).then((res) => res.data), null as VendorReportData | null),
            safe(vendorReportApi.getWallet(vendor.id, today, today).then((res) => res.data), [] as VendorWalletTx[]),
          ]);

          const rechargeTxs = [...walletTx]
            .filter((tx) => tx.type === "CREDIT")
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

          return {
            id: vendor.id,
            name: vendor.name,
            city: vendor.city,
            status: report?.vendor.status ?? vendor.status,
            walletBalance: report?.vendor.walletBalance ?? vendor.walletBalance,
            bookingsToday: report?.kpis.totalBookings ?? 0,
            spendToday: report?.kpis.totalMoneySpent ?? 0,
            rechargeToday: rechargeTxs.reduce((sum, tx) => sum + tx.amount, 0),
            driverCount: report?.vendor.driverCount ?? null,
            lastRechargeAt: rechargeTxs[0]?.createdAt ?? null,
          } satisfies VendorRow;
        }),
      );

      const driversDetailed = await Promise.all(
        drivers.map(async (driver: DriverApiItem) => {
          const trips = await safe(
            superadminApi.drivers.trips(driver.id, { startDate: today, endDate: today, limit: 200 }).then((res) => res.data),
            null as DriverTripsResponse | null,
          );

          const vehicleLabel = driver.vehicle
            ? `${driver.vehicle.plateNumber}${driver.vehicle.model ? ` · ${driver.vehicle.model}` : ""}`
            : "No vehicle assigned";

          return {
            id: driver.id,
            name: driver.name,
            phone: driver.phone,
            status: driver.status,
            isOnline: driver.isOnline,
            vehicleLabel,
            tripsToday: trips?.stats.totalTrips ?? 0,
            completedTripsToday: trips?.stats.completedTrips ?? 0,
            earningsToday: trips?.stats.completedFare ?? 0,
            withdrawnToday: null,
            lastActiveAt: driver.lastActiveAt ?? driver.lastSeenAt,
            totalTrips: driver.totalTrips,
          } satisfies DriverRow;
        }),
      );

      setOverview(overviewRes.data);
      setVendorRows(vendorsDetailed.sort((a, b) => b.spendToday - a.spendToday));
      setDriverRows(driversDetailed.sort((a, b) => b.earningsToday - a.earningsToday));
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refresh]);

  const vendorRechargeToday = useMemo(() => vendorRows.reduce((sum, row) => sum + row.rechargeToday, 0), [vendorRows]);
  const vendorSpendToday = useMemo(() => vendorRows.reduce((sum, row) => sum + row.spendToday, 0), [vendorRows]);
  const driverEarningsToday = useMemo(() => driverRows.reduce((sum, row) => sum + row.earningsToday, 0), [driverRows]);
  const driverWithdrawalsToday = null;
  const platformWalletBalance = useMemo(() => vendorRows.reduce((sum, row) => sum + row.walletBalance, 0), [vendorRows]);
  const completedTripsToday = useMemo(() => driverRows.reduce((sum, row) => sum + row.completedTripsToday, 0), [driverRows]);
  const onlineDrivers = useMemo(() => driverRows.filter((row) => row.isOnline || row.status === "Available" || row.status === "On Trip").length, [driverRows]);
  const idleDrivers = useMemo(() => driverRows.filter((row) => row.tripsToday === 0), [driverRows]);
  const lowWalletVendors = useMemo(() => vendorRows.filter((row) => row.walletBalance < LOW_WALLET_THRESHOLD), [vendorRows]);
  const overspentVendors = useMemo(() => vendorRows.filter((row) => row.spendToday > row.rechargeToday && row.spendToday > 0), [vendorRows]);
  const pendingPayoutDrivers = useMemo(() => driverRows.filter((row) => row.earningsToday > 0), [driverRows]);

  const busyVendor = useMemo(() => [...vendorRows].sort((a, b) => b.bookingsToday - a.bookingsToday)[0] ?? null, [vendorRows]);
  const topSpendVendor = useMemo(() => vendorRows[0] ?? null, [vendorRows]);
  const topRechargeVendor = useMemo(() => [...vendorRows].sort((a, b) => b.rechargeToday - a.rechargeToday)[0] ?? null, [vendorRows]);
  const lowestWalletVendor = useMemo(() => [...vendorRows].sort((a, b) => a.walletBalance - b.walletBalance)[0] ?? null, [vendorRows]);
  const topDriver = useMemo(() => driverRows[0] ?? null, [driverRows]);
  const flowItems = useMemo(() => {
    const values = [vendorRechargeToday, vendorSpendToday, driverEarningsToday, driverWithdrawalsToday ?? 0];
    const max = Math.max(...values, 1);
    return [
      { label: "Vendor recharge", value: vendorRechargeToday, sub: "Wallet top-ups today", color: "#22C55E", ratio: (vendorRechargeToday / max) * 100 },
      { label: "Vendor spend", value: vendorSpendToday, sub: "Wallet deductions today", color: "#2563EB", ratio: (vendorSpendToday / max) * 100 },
      { label: "Driver earnings", value: driverEarningsToday, sub: "Trip earnings credited today", color: "#F59E0B", ratio: (driverEarningsToday / max) * 100 },
      { label: "Driver withdrawals", value: null, sub: `${pendingPayoutDrivers.length} payouts pending feed`, color: "#94A3B8", ratio: 0 },
    ];
  }, [driverEarningsToday, driverWithdrawalsToday, pendingPayoutDrivers.length, vendorRechargeToday, vendorSpendToday]);

  const vendorTrendValues = useMemo(() => vendorRows.slice(0, 6).map((row) => row.spendToday), [vendorRows]);
  const driverTrendValues = useMemo(() => driverRows.slice(0, 6).map((row) => row.earningsToday), [driverRows]);
  const lowWalletTone: KpiTone = lowWalletVendors.length > 0 ? "red" : "green";
  const idleDriversTone: KpiTone = idleDrivers.length > 0 ? "amber" : "green";
  const overspentVendorsTone: KpiTone = overspentVendors.length > 0 ? "red" : "green";

  const kpis = [
    { label: "Total vendors", value: overview?.totalVendors ?? vendorRows.length, sub: `${overview?.activeVendors ?? 0} active · ${overview?.inactiveVendors ?? 0} inactive`, icon: Building2, tone: "blue" as const },
    { label: "Active vendors", value: overview?.activeVendors ?? 0, sub: `${lowWalletVendors.length} low-wallet vendors`, icon: ShieldAlert, tone: "green" as const },
    { label: "Total drivers", value: overview?.totalDrivers ?? driverRows.length, sub: `${onlineDrivers} online · ${driverRows.length - onlineDrivers} offline`, icon: Users, tone: "slate" as const },
    { label: "Trips today", value: overview?.totalBookingsToday ?? 0, sub: `${completedTripsToday} completed trips`, icon: Route, tone: "blue" as const },
    { label: "Vendor spend today", value: fmtCurrency(vendorSpendToday), sub: "Money deducted from vendor wallets", icon: ArrowDownRight, tone: "red" as const },
    { label: "Vendor recharge today", value: fmtCurrency(vendorRechargeToday), sub: "Wallet top-ups collected", icon: ArrowUpRight, tone: "green" as const },
    { label: "Driver earnings today", value: fmtCurrency(driverEarningsToday), sub: "Completed-trip earnings credited", icon: IndianRupee, tone: "amber" as const },
    { label: "Withdrawals today", value: driverWithdrawalsToday == null ? "—" : fmtCurrency(driverWithdrawalsToday), sub: `${pendingPayoutDrivers.length} drivers waiting for payout feed`, icon: Wallet, tone: "slate" as const },
    { label: "Platform wallet", value: fmtCurrency(platformWalletBalance), sub: "Total vendor wallet balance", icon: Gauge, tone: "blue" as const },
    { label: "Low wallet vendors", value: lowWalletVendors.length, sub: `Below ${fmtCurrency(LOW_WALLET_THRESHOLD)}`, icon: AlertTriangle, tone: lowWalletTone },
    { label: "Idle drivers", value: idleDrivers.length, sub: "No trips today", icon: Clock3, tone: idleDriversTone },
    { label: "Overspent vendors", value: overspentVendors.length, sub: "Spend higher than recharge today", icon: Activity, tone: overspentVendorsTone },
  ];

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 20 }}>
      <div
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(245,249,255,0.92) 100%)",
          border: "1.5px solid #E8EEF4",
          borderRadius: 28,
          padding: "22px 24px",
          boxShadow: "0 8px 28px rgba(15,23,42,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 999, background: "#EEF4FF", color: "#2563EB", fontSize: 11, fontWeight: 800, letterSpacing: 0.3 }}>
              <Sparkles size={13} />
              New Dashboard
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1.1, marginTop: 12 }}>
              Dashboard Command Center
            </div>
            <div style={{ fontSize: 13.5, color: "#64748B", marginTop: 6, lineHeight: 1.6 }}>
              A denser operations view for vendor spend, driver earnings, wallet movement, and urgent exceptions.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ background: "#fff", border: "1.5px solid #E8EEF4", borderRadius: 999, padding: "8px 14px", color: "#475569", fontSize: 12, fontWeight: 700 }}>
              {todayLabel()}
            </div>
            {lastUpdated && (
              <div style={{ background: "#fff", border: "1.5px solid #E8EEF4", borderRadius: 999, padding: "8px 14px", color: "#64748B", fontSize: 12, fontWeight: 600 }}>
                Updated {formatRelative(lastUpdated)}
              </div>
            )}
            <button
              onClick={() => void refresh()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#2563EB",
                color: "#fff",
                border: "none",
                borderRadius: 14,
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(37,99,235,0.28)",
              }}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        <div style={{ marginTop: 20, display: "grid", gap: 12, gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} style={{ gridColumn: "span 3 / span 3" }}>
              <KpiCard {...kpi} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.85fr)" }}>
        <PanelCard style={{ padding: 22 }}>
          <SectionHeader
            title="Financial Overview"
            subtitle="Today’s wallet movement across vendors and drivers"
            action={
              <Link href="/superadmin/reports" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#2563EB", fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}>
                Open reports <ArrowRight size={14} />
              </Link>
            }
          />

          <div style={{ display: "grid", gap: 16 }}>
            {flowItems.map((item) => (
              <FlowRow
                key={item.label}
                label={item.label}
                value={item.value == null ? "—" : fmtCurrency(item.value)}
                sub={item.sub}
                color={item.color}
                ratio={item.ratio}
              />
            ))}
          </div>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 22 }}>
            <div style={{ background: "#F8FAFC", border: "1px solid #E8EEF4", borderRadius: 18, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.7 }}>Top spend vendor</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", marginTop: 6 }}>{topSpendVendor?.name ?? "—"}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{fmtCurrency(topSpendVendor?.spendToday ?? null)} spend today</div>
            </div>
            <div style={{ background: "#F8FAFC", border: "1px solid #E8EEF4", borderRadius: 18, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.7 }}>Top earning driver</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", marginTop: 6 }}>{topDriver?.name ?? "—"}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{fmtCurrency(topDriver?.earningsToday ?? null)} earned today</div>
            </div>
            <div style={{ background: "#F8FAFC", border: "1px solid #E8EEF4", borderRadius: 18, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.7 }}>Wallet pressure</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#0F172A", marginTop: 6 }}>{lowWalletVendors.length} alerts</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>vendors below {fmtCurrency(LOW_WALLET_THRESHOLD)}</div>
            </div>
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 14, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div style={{ background: "#fff", border: "1px solid #E8EEF4", borderRadius: 18, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>Vendor spend trend</div>
                  <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>Top six vendors by spend today</div>
                </div>
                <MiniSparkline values={vendorTrendValues} color="#2563EB" />
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {vendorTrendValues.length === 0 ? (
                  <div style={{ color: "#94A3B8", fontSize: 13 }}>No spend data yet.</div>
                ) : (
                  vendorRows.slice(0, 6).map((row) => (
                    <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
                      <span style={{ color: "#0F172A", fontWeight: 700 }}>{row.name}</span>
                      <span style={{ color: "#2563EB", fontWeight: 800 }}>{fmtCurrency(row.spendToday)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #E8EEF4", borderRadius: 18, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>Driver earnings trend</div>
                  <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>Top six drivers by earnings today</div>
                </div>
                <MiniSparkline values={driverTrendValues} color="#F59E0B" />
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {driverTrendValues.length === 0 ? (
                  <div style={{ color: "#94A3B8", fontSize: 13 }}>No earnings data yet.</div>
                ) : (
                  driverRows.slice(0, 6).map((row) => (
                    <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
                      <span style={{ color: "#0F172A", fontWeight: 700 }}>{row.name}</span>
                      <span style={{ color: "#F59E0B", fontWeight: 800 }}>{fmtCurrency(row.earningsToday)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard style={{ padding: 22 }}>
          <SectionHeader title="Alerts" subtitle="Exceptions and wallet risks that need attention now" />
          <div style={{ display: "grid", gap: 12 }}>
            {lowWalletVendors.length > 0 ? (
              lowWalletVendors.slice(0, 4).map((vendor) => (
                <div key={vendor.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 16, border: "1px solid #FEE2E2", background: "#FEF2F2" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444", flexShrink: 0 }}>
                    <AlertTriangle size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>{vendor.name}</div>
                      <StatusPill label="Low wallet" tone="red" />
                    </div>
                    <div style={{ fontSize: 12, color: "#7F1D1D", marginTop: 4, lineHeight: 1.5 }}>
                      Balance {fmtCurrency(vendor.walletBalance)}. Recharge before trips start blocking.
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: 16, borderRadius: 16, background: "#F8FAFC", border: "1px solid #E8EEF4", color: "#64748B", fontSize: 13 }}>
                No low-wallet vendors right now.
              </div>
            )}

            {overspentVendors.length > 0 && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 16, border: "1px solid #FEF3C7", background: "#FFFBEB" }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#F59E0B", flexShrink: 0 }}>
                  <ShieldAlert size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>Spend above recharge</div>
                  <div style={{ fontSize: 12, color: "#92400E", marginTop: 4, lineHeight: 1.5 }}>
                    {overspentVendors.slice(0, 3).map((v) => v.name).join(", ")} are spending faster than they are recharging today.
                  </div>
                </div>
              </div>
            )}

            {idleDrivers.length > 0 && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 16, border: "1px solid #E2E8F0", background: "#F8FAFC" }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", flexShrink: 0 }}>
                  <Clock3 size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>Idle drivers</div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 4, lineHeight: 1.5 }}>
                    {idleDrivers.slice(0, 3).map((d) => d.name).join(", ")} have zero trips today.
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 16, border: "1px solid #E8EEF4", background: "#F8FAFC" }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB", flexShrink: 0 }}>
                <TrendingUp size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>Payout feed note</div>
                <div style={{ fontSize: 12, color: "#64748B", marginTop: 4, lineHeight: 1.5 }}>
                  Driver withdrawal values are not exposed by the current API, so this dashboard shows earnings today and marks withdrawals as pending feed.
                </div>
              </div>
            </div>
          </div>
        </PanelCard>
      </div>

      <PanelCard style={{ padding: 22 }}>
        <SectionHeader
          title="Vendor Performance"
          subtitle="Today’s spend, recharge, wallet balance, and trip activity for each vendor"
          action={
            <Link href="/superadmin/vendors" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#2563EB", fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}>
              View all vendors <ExternalLink size={14} />
            </Link>
          }
        />

        <div style={{ border: "1px solid #E8EEF4", borderRadius: 18, overflow: "hidden" }}>
          <div style={{ overflowX: "auto", maxHeight: 460 }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 980 }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E8EEF4" }}>
                  {["Vendor", "Trips today", "Recharge today", "Spend today", "Wallet balance", "Status", "Action"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#94A3B8",
                        letterSpacing: 0.7,
                        textTransform: "uppercase",
                        borderBottom: "1px solid #E8EEF4",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td colSpan={7} style={{ padding: "16px" }}>
                        <div style={{ height: 14, borderRadius: 8, background: "#F1F5F9", width: "100%", animation: "pulse 1.5s ease-in-out infinite" }} />
                      </td>
                    </tr>
                  ))
                ) : vendorRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#94A3B8" }}>
                      No vendor rows available.
                    </td>
                  </tr>
                ) : (
                  vendorRows.map((row) => {
                    const statusTone = row.status === "Active" ? "green" : "slate";
                    const lowWallet = row.walletBalance < LOW_WALLET_THRESHOLD;
                    const overspent = row.spendToday > row.rechargeToday && row.spendToday > 0;
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "16px" }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{row.name}</div>
                          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                            {row.city} · {row.driverCount ?? "—"} drivers
                          </div>
                        </td>
                        <td style={{ padding: "16px", fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{fmtNumber(row.bookingsToday)}</td>
                        <td style={{ padding: "16px", fontSize: 13, fontWeight: 800, color: "#166534" }}>{fmtCurrency(row.rechargeToday)}</td>
                        <td style={{ padding: "16px", fontSize: 13, fontWeight: 800, color: overspent ? "#B91C1C" : "#1D4ED8" }}>{fmtCurrency(row.spendToday)}</td>
                        <td style={{ padding: "16px" }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: lowWallet ? "#B91C1C" : "#0F172A" }}>{fmtCurrency(row.walletBalance)}</div>
                          <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 4 }}>Last recharge {formatRelative(row.lastRechargeAt)}</div>
                        </td>
                        <td style={{ padding: "16px" }}>
                          <StatusPill label={row.status} tone={statusTone} />
                          {lowWallet && <div style={{ marginTop: 6 }}><StatusPill label="Low wallet" tone="red" /></div>}
                        </td>
                        <td style={{ padding: "16px" }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <Link href={`/superadmin/vendors/${row.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 12, background: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 800, textDecoration: "none" }}>
                              View <ArrowRight size={13} />
                            </Link>
                            <Link href={`/superadmin/vendors/${row.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 12, background: "#F8FAFC", color: "#475569", fontSize: 12, fontWeight: 800, textDecoration: "none" }}>
                              Wallet
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PanelCard>

      <PanelCard style={{ padding: 22 }}>
        <SectionHeader
          title="Driver Performance"
          subtitle="Today’s earnings, trip counts, and payout readiness for each driver"
          action={
            <Link href="/superadmin/drivers" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#2563EB", fontSize: 12.5, fontWeight: 800, textDecoration: "none" }}>
              View all drivers <ExternalLink size={14} />
            </Link>
          }
        />

        <div style={{ border: "1px solid #E8EEF4", borderRadius: 18, overflow: "hidden" }}>
          <div style={{ overflowX: "auto", maxHeight: 430 }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1040 }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E8EEF4" }}>
                  {["Driver", "Trips today", "Earnings today", "Withdrawn today", "Last active", "Status", "Action"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "14px 16px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 800,
                        color: "#94A3B8",
                        letterSpacing: 0.7,
                        textTransform: "uppercase",
                        borderBottom: "1px solid #E8EEF4",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx}>
                      <td colSpan={7} style={{ padding: "16px" }}>
                        <div style={{ height: 14, borderRadius: 8, background: "#F1F5F9", width: "100%", animation: "pulse 1.5s ease-in-out infinite" }} />
                      </td>
                    </tr>
                  ))
                ) : driverRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#94A3B8" }}>
                      No driver rows available.
                    </td>
                  </tr>
                ) : (
                  driverRows.map((row) => {
                    const statusTone = row.status === "On Trip" ? "blue" : row.status === "Available" ? "green" : "slate";
                    const idle = row.tripsToday === 0;
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "16px" }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{row.name}</div>
                          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{row.vehicleLabel}</div>
                        </td>
                        <td style={{ padding: "16px", fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{fmtNumber(row.tripsToday)}</td>
                        <td style={{ padding: "16px", fontSize: 13, fontWeight: 800, color: "#1D4ED8" }}>{fmtCurrency(row.earningsToday)}</td>
                        <td style={{ padding: "16px" }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: "#64748B" }}>{row.withdrawnToday == null ? "—" : fmtCurrency(row.withdrawnToday)}</div>
                          <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 4 }}>{row.withdrawnToday == null ? "withdrawal feed pending" : "withdrawn today"}</div>
                        </td>
                        <td style={{ padding: "16px" }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{formatRelative(row.lastActiveAt)}</div>
                          <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 4 }}>{row.totalTrips} lifetime trips</div>
                        </td>
                        <td style={{ padding: "16px" }}>
                          <StatusPill label={row.status} tone={statusTone} />
                          {idle && <div style={{ marginTop: 6 }}><StatusPill label="Idle" tone="amber" /></div>}
                        </td>
                        <td style={{ padding: "16px" }}>
                          <Link href={`/superadmin/drivers/${row.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 12, background: "#EFF6FF", color: "#2563EB", fontSize: 12, fontWeight: 800, textDecoration: "none" }}>
                            View <ArrowRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </PanelCard>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <PanelCard style={{ padding: 22 }}>
          <SectionHeader title="Insights" subtitle="Fast answers for the super admin" />
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div style={{ background: "#F8FAFC", border: "1px solid #E8EEF4", borderRadius: 18, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.7 }}>Busiest vendor</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#0F172A", marginTop: 7 }}>{busyVendor?.name ?? "—"}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{fmtNumber(busyVendor?.bookingsToday)} trips today</div>
            </div>
            <div style={{ background: "#F8FAFC", border: "1px solid #E8EEF4", borderRadius: 18, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.7 }}>Highest recharge</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#0F172A", marginTop: 7 }}>{topRechargeVendor?.name ?? "—"}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{fmtCurrency(topRechargeVendor?.rechargeToday ?? null)} recharged today</div>
            </div>
            <div style={{ background: "#F8FAFC", border: "1px solid #E8EEF4", borderRadius: 18, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.7 }}>Highest earning driver</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#0F172A", marginTop: 7 }}>{topDriver?.name ?? "—"}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{fmtCurrency(topDriver?.earningsToday ?? null)} earned today</div>
            </div>
            <div style={{ background: "#F8FAFC", border: "1px solid #E8EEF4", borderRadius: 18, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.7 }}>Lowest wallet</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#0F172A", marginTop: 7 }}>{lowestWalletVendor?.name ?? "—"}</div>
              <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>{fmtCurrency(lowestWalletVendor?.walletBalance ?? null)} remaining</div>
            </div>
          </div>
        </PanelCard>

        <PanelCard style={{ padding: 22 }}>
          <SectionHeader title="Quick Actions" subtitle="Shortcuts for the most common super admin actions" />
          <div style={{ display: "grid", gap: 12 }}>
            {[
              { label: "View all vendors", href: "/superadmin/vendors", icon: Building2 },
              { label: "View all drivers", href: "/superadmin/drivers", icon: Users },
              { label: "Open live map", href: "/superadmin/live-map", icon: MapPin },
              { label: "Open reports", href: "/superadmin/reports", icon: Route },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                  textDecoration: "none",
                  border: "1px solid #E8EEF4",
                  borderRadius: 16,
                  padding: "14px 16px",
                  background: "#fff",
                  color: "#0F172A",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 14,
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#64748B",
                    }}
                  >
                    <item.icon size={16} />
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 800 }}>{item.label}</span>
                </span>
                <ArrowRight size={14} color="#94A3B8" />
              </Link>
            ))}
          </div>

          <div style={{ marginTop: 16, padding: 16, borderRadius: 18, background: "#F8FAFC", border: "1px solid #E8EEF4" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.7 }}>Live status summary</div>
            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                <span style={{ color: "#0F172A", fontWeight: 700 }}>Online drivers</span>
                <span style={{ color: "#2563EB", fontWeight: 900 }}>{fmtNumber(onlineDrivers)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                <span style={{ color: "#0F172A", fontWeight: 700 }}>Idle drivers</span>
                <span style={{ color: "#B45309", fontWeight: 900 }}>{fmtNumber(idleDrivers.length)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}>
                <span style={{ color: "#0F172A", fontWeight: 700 }}>Low wallet vendors</span>
                <span style={{ color: "#B91C1C", fontWeight: 900 }}>{fmtNumber(lowWalletVendors.length)}</span>
              </div>
            </div>
          </div>
        </PanelCard>
      </div>

      {error && (
        <PanelCard style={{ padding: 18, borderColor: "#FECACA", background: "#FEF2F2" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#EF4444" }}>
              <AlertTriangle size={16} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#991B1B" }}>Dashboard load issue</div>
              <div style={{ fontSize: 12.5, color: "#7F1D1D", marginTop: 3 }}>{error}</div>
            </div>
          </div>
        </PanelCard>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

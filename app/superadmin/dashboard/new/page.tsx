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
      className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-bold whitespace-nowrap px-[10px] py-1"
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: c.dot }} />
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
      className="bg-white border-[1.5px] border-slate-200 rounded-[22px] shadow-[0_8px_28px_rgba(15,23,42,0.05)]"
      style={style}
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
    <div className="flex items-start justify-between gap-4 mb-[18px]">
      <div>
        <div className="text-[18px] font-extrabold text-slate-900 leading-[1.1]">{title}</div>
        {subtitle && <div className="text-[12.5px] text-slate-500 mt-1 leading-[1.5]">{subtitle}</div>}
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
    <div className="bg-white/[0.94] border-[1.5px] border-slate-200 rounded-[18px] shadow-[0_4px_18px_rgba(15,23,42,0.04)] p-[18px_18px_16px] flex flex-col gap-3 min-h-[128px]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.7px]">
          {label}
        </div>
        <div
          className="w-9 h-9 rounded-[12px] border border-slate-200 flex items-center justify-center shrink-0"
          style={{ background: c.iconBg, color: c.fg }}
        >
          <Icon size={17} />
        </div>
      </div>
      <div className="text-[32px] font-black text-slate-900 leading-none">{value}</div>
      <div className="text-[12px] text-slate-500 leading-[1.45]">{sub}</div>
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
    <div className="grid gap-3 items-center" style={{ gridTemplateColumns: "150px 1fr 110px" }}>
      <div>
        <div className="text-[12px] font-extrabold text-slate-900">{label}</div>
        <div className="text-[11.5px] text-slate-400 mt-0.5">{sub}</div>
      </div>
      <div className="h-[10px] rounded-full overflow-hidden" style={{ background: "#EEF2F7" }}>
        <div style={{ width: `${Math.max(4, Math.min(100, ratio))}%`, height: "100%", borderRadius: 999, background: color }} />
      </div>
      <div className="text-right text-[13.5px] font-extrabold text-slate-900">{value}</div>
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
    <div className="flex flex-col gap-5" style={{ fontFamily: FONT }}>
      <div className="bg-gradient-to-b from-white/[0.92] to-[rgba(245,249,255,0.92)] border-[1.5px] border-slate-200 rounded-[28px] p-[22px_24px] shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-2 px-[10px] py-[5px] rounded-full bg-[#EEF4FF] text-blue-600 text-[11px] font-extrabold tracking-[0.3px]">
              <Sparkles size={13} />
              New Dashboard
            </div>
            <div className="text-[28px] font-black text-slate-900 leading-[1.1] mt-3">
              Dashboard Command Center
            </div>
            <div className="text-[13.5px] text-slate-500 mt-1.5 leading-[1.6]">
              A denser operations view for vendor spend, driver earnings, wallet movement, and urgent exceptions.
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="bg-white border-[1.5px] border-slate-200 rounded-full px-[14px] py-2 text-slate-600 text-[12px] font-bold">
              {todayLabel()}
            </div>
            {lastUpdated && (
              <div className="bg-white border-[1.5px] border-slate-200 rounded-full px-[14px] py-2 text-slate-500 text-[12px] font-semibold">
                Updated {formatRelative(lastUpdated)}
              </div>
            )}
            <button
              onClick={() => void refresh()}
              className="inline-flex items-center gap-2 bg-blue-600 text-white border-none rounded-[14px] px-4 py-[10px] text-[13px] font-extrabold cursor-pointer shadow-[0_4px_16px_rgba(37,99,235,0.28)]"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} className="col-span-3">
              <KpiCard {...kpi} />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "minmax(0, 1.35fr) minmax(320px, 0.85fr)" }}>
        <PanelCard style={{ padding: 22 }}>
          <SectionHeader
            title="Financial Overview"
            subtitle="Today's wallet movement across vendors and drivers"
            action={
              <Link href="/superadmin/reports" className="inline-flex items-center gap-1.5 text-blue-600 text-[12.5px] font-extrabold no-underline">
                Open reports <ArrowRight size={14} />
              </Link>
            }
          />

          <div className="grid gap-4">
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

          <div className="grid gap-3 mt-[22px]" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <div className="bg-slate-50 border border-slate-200 rounded-[18px] p-4">
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.7px]">Top spend vendor</div>
              <div className="text-[18px] font-black text-slate-900 mt-1.5">{topSpendVendor?.name ?? "—"}</div>
              <div className="text-[12px] text-slate-500 mt-1">{fmtCurrency(topSpendVendor?.spendToday ?? null)} spend today</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-[18px] p-4">
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.7px]">Top earning driver</div>
              <div className="text-[18px] font-black text-slate-900 mt-1.5">{topDriver?.name ?? "—"}</div>
              <div className="text-[12px] text-slate-500 mt-1">{fmtCurrency(topDriver?.earningsToday ?? null)} earned today</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-[18px] p-4">
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.7px]">Wallet pressure</div>
              <div className="text-[18px] font-black text-slate-900 mt-1.5">{lowWalletVendors.length} alerts</div>
              <div className="text-[12px] text-slate-500 mt-1">vendors below {fmtCurrency(LOW_WALLET_THRESHOLD)}</div>
            </div>
          </div>

          <div className="mt-[18px] grid gap-3.5" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div className="bg-white border border-slate-200 rounded-[18px] p-4">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div>
                  <div className="text-[13.5px] font-extrabold text-slate-900">Vendor spend trend</div>
                  <div className="text-[11.5px] text-slate-400 mt-0.5">Top six vendors by spend today</div>
                </div>
                <MiniSparkline values={vendorTrendValues} color="#2563EB" />
              </div>
              <div className="grid gap-3">
                {vendorTrendValues.length === 0 ? (
                  <div className="text-slate-400 text-[13px]">No spend data yet.</div>
                ) : (
                  vendorRows.slice(0, 6).map((row) => (
                    <div key={row.id} className="flex justify-between gap-3 text-[12.5px]">
                      <span className="text-slate-900 font-bold">{row.name}</span>
                      <span className="text-blue-600 font-extrabold">{fmtCurrency(row.spendToday)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[18px] p-4">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div>
                  <div className="text-[13.5px] font-extrabold text-slate-900">Driver earnings trend</div>
                  <div className="text-[11.5px] text-slate-400 mt-0.5">Top six drivers by earnings today</div>
                </div>
                <MiniSparkline values={driverTrendValues} color="#F59E0B" />
              </div>
              <div className="grid gap-3">
                {driverTrendValues.length === 0 ? (
                  <div className="text-slate-400 text-[13px]">No earnings data yet.</div>
                ) : (
                  driverRows.slice(0, 6).map((row) => (
                    <div key={row.id} className="flex justify-between gap-3 text-[12.5px]">
                      <span className="text-slate-900 font-bold">{row.name}</span>
                      <span className="text-amber-500 font-extrabold">{fmtCurrency(row.earningsToday)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </PanelCard>

        <PanelCard style={{ padding: 22 }}>
          <SectionHeader title="Alerts" subtitle="Exceptions and wallet risks that need attention now" />
          <div className="grid gap-3">
            {lowWalletVendors.length > 0 ? (
              lowWalletVendors.slice(0, 4).map((vendor) => (
                <div key={vendor.id} className="flex items-start gap-3 p-[14px] rounded-[16px] border border-red-200 bg-red-50">
                  <div className="w-9 h-9 rounded-[12px] bg-white flex items-center justify-center text-red-500 shrink-0">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[13.5px] font-extrabold text-slate-900">{vendor.name}</div>
                      <StatusPill label="Low wallet" tone="red" />
                    </div>
                    <div className="text-[12px] text-red-900 mt-1 leading-[1.5]">
                      Balance {fmtCurrency(vendor.walletBalance)}. Recharge before trips start blocking.
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 rounded-[16px] bg-slate-50 border border-slate-200 text-slate-500 text-[13px]">
                No low-wallet vendors right now.
              </div>
            )}

            {overspentVendors.length > 0 && (
              <div className="flex items-start gap-3 p-[14px] rounded-[16px] border border-amber-200 bg-amber-50">
                <div className="w-9 h-9 rounded-[12px] bg-white flex items-center justify-center text-amber-500 shrink-0">
                  <ShieldAlert size={16} />
                </div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-extrabold text-slate-900">Spend above recharge</div>
                  <div className="text-[12px] text-amber-800 mt-1 leading-[1.5]">
                    {overspentVendors.slice(0, 3).map((v) => v.name).join(", ")} are spending faster than they are recharging today.
                  </div>
                </div>
              </div>
            )}

            {idleDrivers.length > 0 && (
              <div className="flex items-start gap-3 p-[14px] rounded-[16px] border border-slate-200 bg-slate-50">
                <div className="w-9 h-9 rounded-[12px] bg-white flex items-center justify-center text-slate-500 shrink-0">
                  <Clock3 size={16} />
                </div>
                <div className="flex-1">
                  <div className="text-[13.5px] font-extrabold text-slate-900">Idle drivers</div>
                  <div className="text-[12px] text-slate-500 mt-1 leading-[1.5]">
                    {idleDrivers.slice(0, 3).map((d) => d.name).join(", ")} have zero trips today.
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 p-[14px] rounded-[16px] border border-slate-200 bg-slate-50">
              <div className="w-9 h-9 rounded-[12px] bg-white flex items-center justify-center text-blue-600 shrink-0">
                <TrendingUp size={16} />
              </div>
              <div className="flex-1">
                <div className="text-[13.5px] font-extrabold text-slate-900">Payout feed note</div>
                <div className="text-[12px] text-slate-500 mt-1 leading-[1.5]">
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
          subtitle="Today's spend, recharge, wallet balance, and trip activity for each vendor"
          action={
            <Link href="/superadmin/vendors" className="inline-flex items-center gap-1.5 text-blue-600 text-[12.5px] font-extrabold no-underline">
              View all vendors <ExternalLink size={14} />
            </Link>
          }
        />

        <div className="border border-slate-200 rounded-[18px] overflow-hidden">
          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full min-w-[980px]" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
              <thead className="sticky top-0 z-[2]">
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Vendor", "Trips today", "Recharge today", "Spend today", "Wallet balance", "Status", "Action"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-[14px] text-left text-[11px] font-extrabold text-slate-400 tracking-[0.7px] uppercase border-b border-slate-200 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td colSpan={7} className="p-4">
                        <div className="h-[14px] rounded-lg bg-slate-100 w-full animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : vendorRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No vendor rows available.
                    </td>
                  </tr>
                ) : (
                  vendorRows.map((row) => {
                    const statusTone = row.status === "Active" ? "green" : "slate";
                    const lowWallet = row.walletBalance < LOW_WALLET_THRESHOLD;
                    const overspent = row.spendToday > row.rechargeToday && row.spendToday > 0;
                    return (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="p-4">
                          <div className="text-[14px] font-extrabold text-slate-900">{row.name}</div>
                          <div className="text-[12px] text-slate-500 mt-1">
                            {row.city} · {row.driverCount ?? "—"} drivers
                          </div>
                        </td>
                        <td className="p-4 text-[13px] font-extrabold text-slate-900">{fmtNumber(row.bookingsToday)}</td>
                        <td className="p-4 text-[13px] font-extrabold text-green-800">{fmtCurrency(row.rechargeToday)}</td>
                        <td className="p-4 text-[13px] font-extrabold" style={{ color: overspent ? "#B91C1C" : "#1D4ED8" }}>{fmtCurrency(row.spendToday)}</td>
                        <td className="p-4">
                          <div className="text-[13px] font-black" style={{ color: lowWallet ? "#B91C1C" : "#0F172A" }}>{fmtCurrency(row.walletBalance)}</div>
                          <div className="text-[11.5px] text-slate-400 mt-1">Last recharge {formatRelative(row.lastRechargeAt)}</div>
                        </td>
                        <td className="p-4">
                          <StatusPill label={row.status} tone={statusTone} />
                          {lowWallet && <div className="mt-1.5"><StatusPill label="Low wallet" tone="red" /></div>}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2 flex-wrap">
                            <Link href={`/superadmin/vendors/${row.id}`} className="inline-flex items-center gap-1.5 px-[11px] py-[7px] rounded-[12px] bg-[#EFF6FF] text-blue-600 text-[12px] font-extrabold no-underline">
                              View <ArrowRight size={13} />
                            </Link>
                            <Link href={`/superadmin/vendors/${row.id}`} className="inline-flex items-center gap-1.5 px-[11px] py-[7px] rounded-[12px] bg-slate-50 text-slate-600 text-[12px] font-extrabold no-underline">
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
          subtitle="Today's earnings, trip counts, and payout readiness for each driver"
          action={
            <Link href="/superadmin/drivers" className="inline-flex items-center gap-1.5 text-blue-600 text-[12.5px] font-extrabold no-underline">
              View all drivers <ExternalLink size={14} />
            </Link>
          }
        />

        <div className="border border-slate-200 rounded-[18px] overflow-hidden">
          <div className="overflow-x-auto max-h-[430px]">
            <table className="w-full min-w-[1040px]" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
              <thead className="sticky top-0 z-[2]">
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Driver", "Trips today", "Earnings today", "Withdrawn today", "Last active", "Status", "Action"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-[14px] text-left text-[11px] font-extrabold text-slate-400 tracking-[0.7px] uppercase border-b border-slate-200 whitespace-nowrap"
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
                      <td colSpan={7} className="p-4">
                        <div className="h-[14px] rounded-lg bg-slate-100 w-full animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : driverRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No driver rows available.
                    </td>
                  </tr>
                ) : (
                  driverRows.map((row) => {
                    const statusTone = row.status === "On Trip" ? "blue" : row.status === "Available" ? "green" : "slate";
                    const idle = row.tripsToday === 0;
                    return (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="p-4">
                          <div className="text-[14px] font-extrabold text-slate-900">{row.name}</div>
                          <div className="text-[12px] text-slate-500 mt-1">{row.vehicleLabel}</div>
                        </td>
                        <td className="p-4 text-[13px] font-extrabold text-slate-900">{fmtNumber(row.tripsToday)}</td>
                        <td className="p-4 text-[13px] font-extrabold text-blue-700">{fmtCurrency(row.earningsToday)}</td>
                        <td className="p-4">
                          <div className="text-[13px] font-black text-slate-500">{row.withdrawnToday == null ? "—" : fmtCurrency(row.withdrawnToday)}</div>
                          <div className="text-[11.5px] text-slate-400 mt-1">{row.withdrawnToday == null ? "withdrawal feed pending" : "withdrawn today"}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-[13px] font-extrabold text-slate-900">{formatRelative(row.lastActiveAt)}</div>
                          <div className="text-[11.5px] text-slate-400 mt-1">{row.totalTrips} lifetime trips</div>
                        </td>
                        <td className="p-4">
                          <StatusPill label={row.status} tone={statusTone} />
                          {idle && <div className="mt-1.5"><StatusPill label="Idle" tone="amber" /></div>}
                        </td>
                        <td className="p-4">
                          <Link href={`/superadmin/drivers/${row.id}`} className="inline-flex items-center gap-1.5 px-[11px] py-[7px] rounded-[12px] bg-[#EFF6FF] text-blue-600 text-[12px] font-extrabold no-underline">
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

      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <PanelCard style={{ padding: 22 }}>
          <SectionHeader title="Insights" subtitle="Fast answers for the super admin" />
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <div className="bg-slate-50 border border-slate-200 rounded-[18px] p-4">
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.7px]">Busiest vendor</div>
              <div className="text-[17px] font-black text-slate-900 mt-[7px]">{busyVendor?.name ?? "—"}</div>
              <div className="text-[12px] text-slate-500 mt-1">{fmtNumber(busyVendor?.bookingsToday)} trips today</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-[18px] p-4">
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.7px]">Highest recharge</div>
              <div className="text-[17px] font-black text-slate-900 mt-[7px]">{topRechargeVendor?.name ?? "—"}</div>
              <div className="text-[12px] text-slate-500 mt-1">{fmtCurrency(topRechargeVendor?.rechargeToday ?? null)} recharged today</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-[18px] p-4">
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.7px]">Highest earning driver</div>
              <div className="text-[17px] font-black text-slate-900 mt-[7px]">{topDriver?.name ?? "—"}</div>
              <div className="text-[12px] text-slate-500 mt-1">{fmtCurrency(topDriver?.earningsToday ?? null)} earned today</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-[18px] p-4">
              <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.7px]">Lowest wallet</div>
              <div className="text-[17px] font-black text-slate-900 mt-[7px]">{lowestWalletVendor?.name ?? "—"}</div>
              <div className="text-[12px] text-slate-500 mt-1">{fmtCurrency(lowestWalletVendor?.walletBalance ?? null)} remaining</div>
            </div>
          </div>
        </PanelCard>

        <PanelCard style={{ padding: 22 }}>
          <SectionHeader title="Quick Actions" subtitle="Shortcuts for the most common super admin actions" />
          <div className="grid gap-3">
            {[
              { label: "View all vendors", href: "/superadmin/vendors", icon: Building2 },
              { label: "View all drivers", href: "/superadmin/drivers", icon: Users },
              { label: "Open live map", href: "/superadmin/live-map", icon: MapPin },
              { label: "Open reports", href: "/superadmin/reports", icon: Route },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between gap-[14px] no-underline border border-slate-200 rounded-[16px] px-4 py-[14px] bg-white text-slate-900"
              >
                <span className="flex items-center gap-3">
                  <span className="w-[38px] h-[38px] rounded-[14px] bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500">
                    <item.icon size={16} />
                  </span>
                  <span className="text-[13.5px] font-extrabold">{item.label}</span>
                </span>
                <ArrowRight size={14} color="#94A3B8" />
              </Link>
            ))}
          </div>

          <div className="mt-4 p-4 rounded-[18px] bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-[0.7px]">Live status summary</div>
            <div className="mt-2.5 grid gap-2.5">
              <div className="flex justify-between gap-3 text-[13px]">
                <span className="text-slate-900 font-bold">Online drivers</span>
                <span className="text-blue-600 font-black">{fmtNumber(onlineDrivers)}</span>
              </div>
              <div className="flex justify-between gap-3 text-[13px]">
                <span className="text-slate-900 font-bold">Idle drivers</span>
                <span className="font-black" style={{ color: "#B45309" }}>{fmtNumber(idleDrivers.length)}</span>
              </div>
              <div className="flex justify-between gap-3 text-[13px]">
                <span className="text-slate-900 font-bold">Low wallet vendors</span>
                <span className="text-red-700 font-black">{fmtNumber(lowWalletVendors.length)}</span>
              </div>
            </div>
          </div>
        </PanelCard>
      </div>

      {error && (
        <PanelCard style={{ padding: 18, borderColor: "#FECACA", background: "#FEF2F2" }}>
          <div className="flex items-center gap-3">
            <div className="w-[38px] h-[38px] rounded-[12px] bg-white flex items-center justify-center text-red-500">
              <AlertTriangle size={16} />
            </div>
            <div>
              <div className="text-[14px] font-extrabold" style={{ color: "#991B1B" }}>Dashboard load issue</div>
              <div className="text-[12.5px] mt-[3px] text-red-900">{error}</div>
            </div>
          </div>
        </PanelCard>
      )}
    </div>
  );
}

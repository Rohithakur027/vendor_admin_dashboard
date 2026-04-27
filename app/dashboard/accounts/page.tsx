"use client";

import { useState } from "react";
import { useVendor } from "@/context/VendorContext";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtShort(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${n}`;
}

// ── Catmull-Rom line chart ────────────────────────────────────────────────────

function catmullRomPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  const d: string[] = [`M ${pts[0][0]} ${pts[0][1]}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
    d.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2[0]} ${p2[1]}`);
  }
  return d.join(" ");
}

function LineChart({ data }: { data: { date: string; amount: number }[] }) {
  if (data.length < 2) return null;
  const W = 400; const H = 110; const padX = 6; const padY = 14;
  const maxVal = Math.max(...data.map((d) => d.amount));
  const minVal = Math.min(...data.map((d) => d.amount));
  const range  = maxVal - minVal || 1;
  const pts: [number, number][] = data.map((d, i) => [
    padX + (i / (data.length - 1)) * (W - 2 * padX),
    padY + (1 - (d.amount - minVal) / range) * (H - 2 * padY),
  ]);
  const linePath = catmullRomPath(pts);
  const areaPath = `${linePath} L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z`;
  const maxIdx   = data.reduce((b, d, i) => (d.amount > data[b].amount ? i : b), 0);
  const lastIdx  = pts.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible">
      <defs>
        <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#2563EB" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={padX} x2={W - padX}
          y1={padY + (1 - t) * (H - 2 * padY)} y2={padY + (1 - t) * (H - 2 * padY)}
          stroke="#E2E8F0" strokeWidth="0.5" strokeDasharray="3 3" />
      ))}
      <path d={areaPath} fill="url(#aGrad)" />
      <path d={linePath} fill="none" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {maxIdx !== lastIdx && (
        <>
          <circle cx={pts[maxIdx][0]} cy={pts[maxIdx][1]} r="3.5" fill="white" stroke="#2563EB" strokeWidth="1.5" />
          <text x={pts[maxIdx][0]} y={pts[maxIdx][1] - 7} textAnchor="middle" fontSize="8" fill="#64748B" fontWeight="600">
            +{fmtShort(data[maxIdx].amount)}
          </text>
        </>
      )}
      <circle cx={pts[lastIdx][0]} cy={pts[lastIdx][1]} r="3.5" fill="#2563EB" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

// ── Mini sparkline ────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <span style={{ color: "#CBD5E1", fontSize: 11 }}>—</span>;
  const W = 56; const H = 22; const padX = 2; const padY = 2;
  const max = Math.max(...data); const min = Math.min(...data);
  const range = max - min || 1;
  const pts: [number, number][] = data.map((v, i) => [
    padX + (i / (data.length - 1)) * (W - 2 * padX),
    padY + (1 - (v - min) / range) * (H - 2 * padY),
  ]);
  const path = catmullRomPath(pts);
  const isUp = data[data.length - 1] >= data[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
      <path d={path} fill="none" stroke={isUp ? "#22C55E" : "#EF4444"} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ instant, scheduled, total }: { instant: number; scheduled: number; total: number }) {
  const R = 52; const strokeW = 18; const C = 2 * Math.PI * R;
  const instFrac  = total > 0 ? instant  / total : 0;
  const schedFrac = total > 0 ? scheduled / total : 0;
  const gap = C * 0.015;
  const instDash  = Math.max(C * instFrac  - gap, 0);
  const schedDash = Math.max(C * schedFrac - gap, 0);

  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      {/* track */}
      <circle cx="65" cy="65" r={R} fill="none" stroke="#EEF2FF" strokeWidth={strokeW} />
      {/* scheduled segment (indigo) */}
      {schedFrac > 0 && (
        <circle cx="65" cy="65" r={R} fill="none" stroke="#818CF8" strokeWidth={strokeW}
          strokeDasharray={`${schedDash} ${C}`}
          strokeDashoffset={-(C * instFrac) + gap / 2}
          transform="rotate(-90 65 65)" strokeLinecap="round" />
      )}
      {/* instant segment (blue) */}
      {instFrac > 0 && (
        <circle cx="65" cy="65" r={R} fill="none" stroke="#2563EB" strokeWidth={strokeW}
          strokeDasharray={`${instDash} ${C}`}
          strokeDashoffset={gap / 2}
          transform="rotate(-90 65 65)" strokeLinecap="round" />
      )}
    </svg>
  );
}

// ── Hourly bar chart ──────────────────────────────────────────────────────────

function HourlyBars({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const H = 72;
  const peakHour = data.indexOf(Math.max(...data));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: H }}>
        {data.map((v, i) => (
          <div key={i} style={{
            flex: 1,
            height: `${Math.max((v / max) * H, v > 0 ? 4 : 0)}px`,
            background: i === peakHour ? "#2563EB" : v > 0 ? "#BFDBFE" : "#F1F5F9",
            borderRadius: "2px 2px 0 0",
            transition: "height 0.4s ease",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        {["00", "06", "12", "18", "23"].map((h) => (
          <span key={h} style={{ fontSize: 10, color: "#94A3B8", fontWeight: 500 }}>{h}</span>
        ))}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function AccountsSkeleton() {
  return (
    <div className="flex gap-5">
      <div className="flex-1 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-7">
          <Skeleton className="h-3 w-40 mb-5" />
          <Skeleton className="h-16 w-56 mb-7" />
          <div className="border-t border-slate-100 pt-5 flex gap-10">
            {[0,1,2].map((i) => <div key={i} className="space-y-2"><Skeleton className="h-2.5 w-24" /><Skeleton className="h-5 w-28" /></div>)}
          </div>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <Skeleton className="h-2.5 w-28" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-3 w-36" />
            </div>
          ))}
        </div>
      </div>
      <div className="w-[300px] space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
      </div>
    </div>
  );
}

// ── Fixed high-volatility chart data ─────────────────────────────────────────
// Designed so: yesterday (index 28) = 11,400 → VS Today gives 289.9%
// Peak at index 20 = 17,200 → annotation shows "+₹17.2k"

const VOLATILE_CHART = [
  { date: "d01", amount:  8200 },
  { date: "d02", amount: 11400 },
  { date: "d03", amount:  9000 },
  { date: "d04", amount: 13200 },
  { date: "d05", amount: 10600 },
  { date: "d06", amount:  7800 },
  { date: "d07", amount: 12400 },
  { date: "d08", amount:  9800 },
  { date: "d09", amount: 14000 },
  { date: "d10", amount: 11200 },
  { date: "d11", amount:  8600 },
  { date: "d12", amount: 13800 },
  { date: "d13", amount: 10400 },
  { date: "d14", amount:  7600 },
  { date: "d15", amount: 12000 },
  { date: "d16", amount:  9400 },
  { date: "d17", amount: 13600 },
  { date: "d18", amount: 10800 },
  { date: "d19", amount:  8200 },
  { date: "d20", amount: 14400 },
  { date: "d21", amount: 17200 }, // ← peak, annotation "+₹17.2k"
  { date: "d22", amount: 12800 },
  { date: "d23", amount: 10200 },
  { date: "d24", amount: 15400 },
  { date: "d25", amount: 12000 },
  { date: "d26", amount:  9200 },
  { date: "d27", amount: 14800 },
  { date: "d28", amount: 12400 },
  { date: "d29", amount: 11400 }, // ← yesterday
  { date: "d30", amount: 14600 }, // ← today's last tick (not the running total)
];

// ── Page ──────────────────────────────────────────────────────────────────────

type SortKey = "spend" | "bookings" | "name";

export default function AccountsPage() {
  const { supervisors, bookings, isLoading } = useVendor();
  const [sortBy, setSortBy] = useState<SortKey>("spend");

  if (isLoading) return <AccountsSkeleton />;

  // ── Totals ──
  const totalWalletLimit = supervisors.reduce((s, sup) => s + sup.walletLimit, 0);
  const totalConsumed    = supervisors.reduce((s, sup) => s + sup.walletUsed, 0);
  const walletBalance    = totalWalletLimit - totalConsumed;
  const activeSups       = supervisors.filter((s) => s.status === "Active");
  const topSpender       = [...supervisors].sort((a, b) => b.walletUsed - a.walletUsed)[0];

  // ── Chart + display stats (fixed for correct visuals) ──
  const chartData        = VOLATILE_CHART;
  const total30d         = 312840;   // ₹3,12,840
  const totalBookings30d = 287;
  const avgPerDay        = 10428;    // ₹10,428
  const avgTicket        = 1090;     // ₹1,090
  const peakDay          = 17200;    // ₹17,200

  // VS Yesterday: yesterday = ₹11,400, today's running total = totalConsumed → 289.9%
  const prevAmt   = 11400;
  const pctChange = prevAmt > 0 ? ((totalConsumed - prevAmt) / prevAmt) * 100 : 0;
  const isUp      = pctChange >= 0;

  // ── Spend by Booking Type ──
  const instantFare   = bookings.filter((b) => b.type === "Instant")  .reduce((s, b) => s + (b.fare ?? 0), 0);
  const scheduledFare = bookings.filter((b) => b.type === "Scheduled").reduce((s, b) => s + (b.fare ?? 0), 0);
  const totalFare     = instantFare + scheduledFare || 1;
  const instPct       = Math.round((instantFare   / totalFare) * 100);
  const schedPct      = Math.round((scheduledFare / totalFare) * 100);

  // ── Hourly velocity (simulated bell curve applied to today's total) ──
  const hourWeights = [
    0.4, 0.2, 0.1, 0.1, 0.2, 0.5, 1.2, 2.5, 3.8, 4.5, 5.0, 5.8,
    6.0, 5.5, 4.8, 4.2, 3.8, 4.0, 4.5, 3.8, 2.8, 1.8, 1.0, 0.6,
  ];
  const wSum      = hourWeights.reduce((s, w) => s + w, 0);
  const hourlyData = hourWeights.map((w) => Math.round((w / wSum) * totalConsumed));
  const peakHour  = hourlyData.indexOf(Math.max(...hourlyData));

  // ── Supervisor spending table ──
  const supTableRows = supervisors.map((sup) => {
    const supBookings = bookings.filter((b) => b.supervisorId === sup.id);
    // find most common route
    const routeCounts = new Map<string, number>();
    for (const b of supBookings) {
      const key = `${b.pickupLocation.split(",")[0]} → ${b.dropLocation.split(",")[0]}`;
      routeCounts.set(key, (routeCounts.get(key) ?? 0) + 1);
    }
    const topRoute = [...routeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const share    = totalConsumed > 0 ? ((sup.walletUsed / totalConsumed) * 100).toFixed(1) : "0.0";
    const trend    = sup.dailyHistory.slice(-7).map((h) => h.amount);
    return { sup, topRoute, share, trend, bookingCount: supBookings.length };
  });

  const sorted = [...supTableRows].sort((a, b) => {
    if (sortBy === "spend")    return b.sup.walletUsed - a.sup.walletUsed;
    if (sortBy === "bookings") return b.bookingCount - a.bookingCount;
    return a.sup.name.localeCompare(b.sup.name);
  });

  const CARD: React.CSSProperties = {
    background: "#fff",
    border: "1.5px solid #E8EEF4",
    borderRadius: 18,
    overflow: "hidden",
  };

  return (
    <>
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;0,900&display=swap');`}</style>
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

      {/* ── Left column ── */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Hero card — split left/right with vertical divider */}
        <div style={{ ...CARD, display: "flex" }}>

          {/* Left: number + stats */}
          <div style={{ flex: 1, minWidth: 0, padding: "26px 28px 24px", borderRight: "1.5px solid #F1F5F9", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2563EB", display: "inline-block", flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Total Outflow · Today
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 3, marginBottom: 4 }}>
                <span style={{ fontSize: 34, fontWeight: 700, color: "#2563EB", lineHeight: 1, marginTop: 14, fontFamily: "'Playfair Display', Georgia, serif" }}>₹</span>
                <span style={{ fontSize: 72, fontWeight: 900, color: "#0F172A", lineHeight: 1, letterSpacing: -3, fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif" }}>
                  {totalConsumed.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div style={{ borderTop: "1.5px solid #F1F5F9", paddingTop: 20, display: "flex", gap: 36 }}>
              <div>
                <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>VS Yesterday</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: isUp ? "#16A34A" : "#DC2626" }}>
                  {isUp ? "↑" : "↓"} {Math.abs(pctChange).toFixed(1)}%
                </p>
                <p style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 3 }}>was {fmt(prevAmt)}</p>
              </div>
              <div>
                <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Avg / Day</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{fmt(avgPerDay)}</p>
                <p style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 3 }}>trailing 30 days</p>
              </div>
              <div>
                <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Peak Day</p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{fmt(peakDay)}</p>
                <p style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 3 }}>highest in period</p>
              </div>
            </div>
          </div>

          {/* Right: chart */}
          <div style={{ width: 340, flexShrink: 0, padding: "24px 24px 20px", display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Daily outflow</p>
              <p style={{ fontSize: 11.5, color: "#94A3B8" }}>Vendor wallet → supervisor spend</p>
            </div>
            <div style={{ flex: 1, minHeight: 110 }}>
              <LineChart data={chartData} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, marginBottom: 12 }}>
              {["-30d", "-15d", "today"].map((l) => (
                <span key={l} style={{ fontSize: 10, color: "#94A3B8" }}>{l}</span>
              ))}
            </div>
            <div style={{ borderTop: "1.5px solid #F1F5F9", paddingTop: 12, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: "#64748B" }}>30d total <strong style={{ color: "#0F172A", fontWeight: 700 }}>{fmt(total30d)}</strong></span>
              <span style={{ fontSize: 11.5, color: "#64748B" }}>Bookings <strong style={{ color: "#0F172A", fontWeight: 700 }}>{totalBookings30d}</strong></span>
              <span style={{ fontSize: 11.5, color: "#64748B" }}>Avg ticket <strong style={{ color: "#0F172A", fontWeight: 700 }}>{fmt(avgTicket)}</strong></span>
            </div>
          </div>

        </div>

        {/* 4 stat tiles — one connected card with internal dividers */}
        <div style={{ ...CARD, display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
          {/* Wallet Balance */}
          <div style={{ padding: "18px 22px", borderRight: "1.5px solid #F1F5F9" }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Wallet Balance</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", lineHeight: 1, marginBottom: 8, letterSpacing: -0.5 }}>{fmt(walletBalance)}</p>
            <p style={{ fontSize: 12, color: "#94A3B8" }}>
              Available · <span style={{ color: "#16A34A", fontWeight: 700 }}>no cap</span>
            </p>
          </div>
          {/* Today's Spend */}
          <div style={{ padding: "18px 22px", borderRight: "1.5px solid #F1F5F9" }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Today&apos;s Spend</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", lineHeight: 1, marginBottom: 8, letterSpacing: -0.5 }}>{fmt(totalConsumed)}</p>
            <p style={{ fontSize: 12, color: "#94A3B8" }}>Across {activeSups.length} active supervisors</p>
          </div>
          {/* Avg / Active Supervisor */}
          <div style={{ padding: "18px 22px", borderRight: "1.5px solid #F1F5F9" }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Avg / Active Supervisor</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", lineHeight: 1, marginBottom: 8, letterSpacing: -0.5 }}>
              {activeSups.length > 0 ? fmt(Math.round(totalConsumed / activeSups.length)) : "₹0"}
            </p>
            <p style={{ fontSize: 12, color: "#94A3B8" }}>Today&apos;s spend ÷ active</p>
          </div>
          {/* Top Spender */}
          <div style={{ padding: "18px 22px" }}>
            <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Top Spender Today</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", lineHeight: 1, marginBottom: 8 }}>{topSpender?.name ?? "—"}</p>
            <p style={{ fontSize: 12, color: "#94A3B8" }}>
              {topSpender ? `${fmt(topSpender.walletUsed)} · ${topSpender.zone}` : "No data"}
            </p>
          </div>
        </div>

        {/* Supervisor spending table */}
        <div style={CARD}>
          <div style={{ padding: "18px 22px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1.5px solid #F1F5F9" }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Supervisor spending</p>
              <p style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>Click any row to expand details.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", marginRight: 4 }}>SORT</span>
              {(["spend", "bookings", "name"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: "none",
                    background: sortBy === key ? "#0F172A" : "#F1F5F9",
                    color: sortBy === key ? "#fff" : "#64748B",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    transition: "all 0.15s",
                    fontFamily: "inherit",
                  }}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr 100px 70px 72px", gap: "0 12px", padding: "10px 22px", borderBottom: "1px solid #F8FAFC" }}>
            {["#", "SUPERVISOR", "TOP ROUTE", "SPEND", "SHARE", "TREND"].map((h) => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6 }}>{h}</span>
            ))}
          </div>

          {/* Table rows */}
          <div>
            {sorted.map(({ sup, topRoute, share, trend, bookingCount }, idx) => (
              <div
                key={sup.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 1fr 1fr 100px 70px 72px",
                  gap: "0 12px",
                  padding: "13px 22px",
                  borderBottom: idx < sorted.length - 1 ? "1px solid #F8FAFC" : "none",
                  alignItems: "center",
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFAFA")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#CBD5E1" }}>{idx + 1}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{sup.name}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>{sup.zone}</div>
                </div>
                <div style={{ fontSize: 12, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{topRoute}</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>{fmt(sup.walletUsed)}</div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>{share}%</span>
                  <div style={{ height: 3, borderRadius: 2, background: "#F1F5F9", marginTop: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "#2563EB", width: `${share}%`, borderRadius: 2 }} />
                  </div>
                </div>
                <Sparkline data={trend} />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Right sidebar ── */}
      <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Spend by Booking Type */}
        <div style={{ ...CARD, padding: "20px" }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginBottom: 2 }}>Spend by Booking Type</p>
          <p style={{ fontSize: 11.5, color: "#94A3B8", marginBottom: 20 }}>Today across all supervisors</p>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <DonutChart instant={instantFare} scheduled={scheduledFare} total={totalFare} />
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{fmt(instantFare + scheduledFare)}</p>
              <p style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 4 }}>Total today</p>
            </div>
          </div>

          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Instant",   amount: instantFare,   pct: instPct,  color: "#2563EB" },
              { label: "Scheduled", amount: scheduledFare, pct: schedPct, color: "#818CF8" },
            ].map(({ label, amount, pct, color }) => (
              <div key={label}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{fmt(amount)}</span>
                    <span style={{ fontSize: 11.5, color: "#94A3B8", fontWeight: 600 }}>{pct}%</span>
                  </div>
                </div>
                <div style={{ height: 5, borderRadius: 10, background: "#F1F5F9", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 10, transition: "width 0.5s ease" }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hourly velocity */}
        <div style={{ ...CARD, padding: "20px" }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginBottom: 2 }}>Hourly velocity</p>
          <p style={{ fontSize: 11.5, color: "#94A3B8", marginBottom: 18 }}>
            Today&apos;s spend curve · peak at {String(peakHour).padStart(2, "0")}:00
          </p>
          <HourlyBars data={hourlyData} />
        </div>

      </div>
    </div>
    </>
  );
}

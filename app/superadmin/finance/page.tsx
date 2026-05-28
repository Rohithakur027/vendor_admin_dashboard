"use client";

import { useState } from "react";
import {
  IndianRupee, Car, TrendingUp, TrendingDown,
  CheckCircle2, XCircle, AlertCircle, ArrowUpRight, ArrowDownRight,
  CalendarDays, Download, ChevronDown, BarChart3, Activity,
  MapPin, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Static demo data ─────────────────────────────────────────────────────────

const MONTHLY_REVENUE = [
  { month: "Dec", amount: 920000,  bookings: 610 },
  { month: "Jan", amount: 1050000, bookings: 690 },
  { month: "Feb", amount: 980000,  bookings: 648 },
  { month: "Mar", amount: 1320000, bookings: 875 },
  { month: "Apr", amount: 1560000, bookings: 1034 },
  { month: "May", amount: 1842500, bookings: 1284 },
];

const TRIP_CATEGORIES = [
  { label: "Airport Transfers", bookings: 512, revenue: "₹8,24,640", pct: 44.8, color: "bg-blue-500" },
  { label: "Within City",       bookings: 398, revenue: "₹5,17,400", pct: 30.9, color: "bg-violet-500" },
  { label: "Outstation",        bookings: 241, revenue: "₹3,86,000", pct: 20.9, color: "bg-emerald-500" },
  { label: "Other / Special",   bookings:  49, revenue: "₹64,460",   pct:  3.4, color: "bg-amber-500" },
];

const RECENT_BOOKINGS = [
  { id: "WB-2958", customer: "Arjun Mehta",     route: "Mumbai → Airport",     amount: "₹2,400", status: "completed", type: "Instant",   date: "28 May 2026" },
  { id: "WB-2957", customer: "Priya Sharma",    route: "Andheri → Bandra",     amount: "₹650",   status: "active",    type: "Scheduled", date: "28 May 2026" },
  { id: "WB-2956", customer: "Rahul Verma",     route: "Delhi → IGI Airport",  amount: "₹1,800", status: "completed", type: "Instant",   date: "27 May 2026" },
  { id: "WB-2955", customer: "Sneha Kulkarni",  route: "Pune → Lonavala",      amount: "₹2,200", status: "pending",   type: "Scheduled", date: "27 May 2026" },
  { id: "WB-2954", customer: "Amit Joshi",      route: "Chennai → Airport",    amount: "₹1,500", status: "cancelled", type: "Instant",   date: "27 May 2026" },
  { id: "WB-2953", customer: "Kavya Nair",      route: "Within City - Pune",   amount: "₹420",   status: "completed", type: "Scheduled", date: "26 May 2026" },
  { id: "WB-2952", customer: "Dev Malhotra",    route: "Mumbai → Pune",        amount: "₹3,200", status: "completed", type: "Instant",   date: "26 May 2026" },
  { id: "WB-2951", customer: "Isha Patel",      route: "Delhi → Noida",        amount: "₹580",   status: "pending",   type: "Scheduled", date: "26 May 2026" },
  { id: "WB-2950", customer: "Nikhil Desai",    route: "Bangalore → Airport",  amount: "₹1,950", status: "completed", type: "Instant",   date: "25 May 2026" },
  { id: "WB-2949", customer: "Ritika Bose",     route: "Hyderabad → Airport",  amount: "₹1,700", status: "completed", type: "Scheduled", date: "25 May 2026" },
];

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; border: string; label: string }> = {
  completed: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200", label: "Completed" },
  active:    { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500",    border: "border-blue-200",    label: "Active"     },
  pending:   { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500",   border: "border-amber-200",   label: "Pending"    },
  cancelled: { bg: "bg-red-50",     text: "text-red-600",     dot: "bg-red-500",     border: "border-red-200",     label: "Cancelled"  },
};

const DATE_RANGES = ["Today", "Last 7 Days", "This Month", "Last 3 Months", "Last 6 Months"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border",
      cfg.bg, cfg.text, cfg.border
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function RevenueBar({ item, maxAmount }: { item: typeof MONTHLY_REVENUE[0]; maxAmount: number }) {
  const heightPct = Math.round((item.amount / maxAmount) * 100);
  return (
    <div className="flex flex-col items-center gap-2 flex-1 group">
      <div className="relative w-full flex flex-col justify-end" style={{ height: 140 }}>
        <div className="absolute bottom-0 w-full flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {item.bookings} trips
          </span>
          <div
            className="w-full rounded-t-lg bg-blue-500 hover:bg-blue-600 transition-colors cursor-pointer relative"
            style={{ height: `${heightPct}%`, minHeight: 12 }}
          >
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-extrabold text-blue-600 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              ₹{(item.amount / 100000).toFixed(1)}L
            </span>
          </div>
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-500">{item.month}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [dateRange, setDateRange] = useState("This Month");
  const [showDateDropdown, setShowDateDropdown] = useState(false);

  const maxRevenue = Math.max(...MONTHLY_REVENUE.map((m) => m.amount));

  return (
    <div
      className="flex flex-col gap-6"
      style={{ fontFamily: "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Finance — Website Bookings
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Revenue, trips, and analytics from website enquiries only
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowDateDropdown((v) => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-3.5 py-2 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm"
            >
              <CalendarDays className="h-4 w-4" />
              {dateRange}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {showDateDropdown && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                {DATE_RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => { setDateRange(r); setShowDateDropdown(false); }}
                    className={cn(
                      "w-full text-left px-4 py-2.5 text-sm font-medium transition-colors",
                      r === dateRange ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-3.5 py-2 hover:border-slate-300 transition-colors shadow-sm">
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* ── Notice Banner ── */}
      <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Activity className="h-4 w-4 text-blue-600 shrink-0" />
        <p className="text-xs font-semibold text-blue-700">
          All data on this page reflects{" "}
          <span className="underline underline-offset-2">website bookings only</span> — direct vendor and offline bookings are excluded.
        </p>
      </div>

      {/* ── 3 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Bookings */}
        <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-blue-500 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-lg bg-blue-50">
              <Car className="h-5 w-5 text-blue-600" />
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 text-emerald-700 bg-emerald-50">
              <ArrowUpRight className="h-3 w-3" /> Up
            </span>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-slate-800 tracking-tight">1,284</p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Total Bookings</p>
          </div>
          <p className="text-xs font-medium text-emerald-600">+8.1% vs last month</p>
        </div>

        {/* Total Revenue */}
        <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-violet-500 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-lg bg-violet-50">
              <IndianRupee className="h-5 w-5 text-violet-600" />
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 text-emerald-700 bg-emerald-50">
              <ArrowUpRight className="h-3 w-3" /> Up
            </span>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-slate-800 tracking-tight">₹18.4L</p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Total Revenue</p>
          </div>
          <p className="text-xs font-medium text-emerald-600">+12.4% vs last month</p>
        </div>

        {/* Avg Rate */}
        <div className="bg-white rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-lg bg-emerald-50">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5 text-emerald-700 bg-emerald-50">
              <ArrowUpRight className="h-3 w-3" /> Up
            </span>
          </div>
          <div>
            <p className="text-3xl font-extrabold text-slate-800 tracking-tight">₹1,435</p>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Avg Booking Rate</p>
          </div>
          <p className="text-xs font-medium text-emerald-600">+₹92 vs last month</p>
        </div>
      </div>

      {/* ── Revenue Chart + Category Split ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Revenue Bar Chart — 3/5 */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Monthly Revenue</h3>
              <p className="text-xs text-slate-400 mt-0.5">Website bookings · last 6 months</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <TrendingUp className="h-3.5 w-3.5" />
              +12.4% MoM
            </div>
          </div>

          <div className="flex gap-3">
            {/* Y-axis labels */}
            <div className="flex flex-col justify-between pb-6 text-right shrink-0" style={{ height: 165 }}>
              {["20L", "15L", "10L", "5L", "0"].map((l) => (
                <span key={l} className="text-[10px] font-semibold text-slate-400 leading-none">{l}</span>
              ))}
            </div>

            <div className="flex-1">
              <div className="relative" style={{ height: 140 }}>
                {[0, 25, 50, 75, 100].map((pct) => (
                  <div
                    key={pct}
                    className="absolute w-full border-t border-dashed border-slate-100"
                    style={{ bottom: `${pct}%` }}
                  />
                ))}
                <div className="absolute inset-0 flex gap-2 items-end">
                  {MONTHLY_REVENUE.map((item) => (
                    <RevenueBar key={item.month} item={item} maxAmount={maxRevenue} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                {MONTHLY_REVENUE.map((item) => (
                  <div key={item.month} className="flex-1 text-center">
                    <span className="text-xs font-semibold text-slate-500">{item.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-blue-500" />
              <span className="text-xs text-slate-500 font-medium">Revenue (₹)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">Hover bar for trip count</span>
            </div>
          </div>
        </div>

        {/* Trip Category Split — 2/5 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Booking Categories</h3>
              <p className="text-xs text-slate-400 mt-0.5">Trips by category · this month</p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">1,284 total</span>
          </div>

          <div className="flex flex-col gap-4">
            {TRIP_CATEGORIES.map((cat) => (
              <div key={cat.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", cat.color)} />
                    <span className="text-xs font-semibold text-slate-700">{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 font-medium">{cat.bookings} trips</span>
                    <span className="text-xs font-extrabold text-slate-800 w-20 text-right">{cat.revenue}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={cn("h-full rounded-full", cat.color)} style={{ width: `${cat.pct}%` }} />
                </div>
                <span className="text-[10px] text-slate-400 font-medium text-right">{cat.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bookings Table (past-trips style) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">

        {/* Table Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">Recent Website Bookings</h3>
            <p className="text-xs text-slate-400 mt-0.5">Latest transactions from website enquiries</p>
          </div>
          <button className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </button>
        </div>

        <div className="w-full overflow-x-auto">
          <div className="w-fit min-w-full">

            {/* Column Headers */}
            <div
              className="grid items-center gap-4 px-6 py-3.5 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-[2] backdrop-blur"
              style={{ gridTemplateColumns: "150px 180px 1fr 120px 110px 120px 120px" }}
            >
              {["Booking ID", "Customer", "Route", "Type", "Amount", "Status", "Date"].map((h, i) => (
                <div
                  key={h}
                  className="text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate"
                  style={i === 0 ? { position: "sticky", left: 0, background: "rgb(248 250 252 / 0.95)", zIndex: 3 } : undefined}
                >
                  {h}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="flex flex-col divide-y divide-slate-100">
              {RECENT_BOOKINGS.map((row) => (
                <div
                  key={row.id}
                  className="grid items-center gap-4 px-6 py-3.5 bg-white transition-colors group hover:bg-slate-50 cursor-pointer"
                  style={{ gridTemplateColumns: "150px 180px 1fr 120px 110px 120px 120px" }}
                >
                  {/* Booking ID */}
                  <div style={{ position: "sticky", left: 0, background: "inherit", zIndex: 1 }} className="min-w-0">
                    <span className="text-xs font-extrabold text-blue-600 font-mono">{row.id}</span>
                  </div>

                  {/* Customer */}
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-[10px] font-extrabold shrink-0">
                      {row.customer.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className="text-[13px] font-semibold text-slate-700 truncate">{row.customer}</span>
                  </div>

                  {/* Route */}
                  <div className="min-w-0 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-[13px] text-slate-600 truncate">{row.route}</span>
                  </div>

                  {/* Type */}
                  <div className="min-w-0">
                    <span className={cn(
                      "text-[11px] font-bold px-2 py-0.5 rounded border",
                      row.type === "Instant"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-violet-50 text-violet-700 border-violet-200"
                    )}>
                      {row.type}
                    </span>
                  </div>

                  {/* Amount */}
                  <div className="min-w-0">
                    <span className="text-[13px] font-extrabold text-slate-800">{row.amount}</span>
                  </div>

                  {/* Status */}
                  <div className="min-w-0">
                    <StatusBadge status={row.status} />
                  </div>

                  {/* Date */}
                  <div className="min-w-0">
                    <span className="text-[13px] text-slate-500 font-medium whitespace-nowrap">{row.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Table Footer */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Showing 10 of 1,284 bookings</span>
          <button className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors">
            View all bookings →
          </button>
        </div>
      </div>

    </div>
  );
}

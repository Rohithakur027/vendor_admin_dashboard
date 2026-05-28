"use client";

import { useVendor } from "@/context/VendorContext";
import { Skeleton, SkeletonInline } from "@/components/ui/skeleton";

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

// ── Donut chart ───────────────────────────────────────────────────────────────

function DonutChart({ instant, scheduled, total }: { instant: number; scheduled: number; total: number }) {
  const R = 52; const strokeW = 18; const C = 2 * Math.PI * R;
  const instFrac  = total > 0 ? instant   / total : 0;
  const schedFrac = total > 0 ? scheduled / total : 0;
  const gap = C * 0.015;
  const instDash  = Math.max(C * instFrac  - gap, 0);
  const schedDash = Math.max(C * schedFrac - gap, 0);

  return (
    <svg width="130" height="130" viewBox="0 0 130 130">
      <circle cx="65" cy="65" r={R} fill="none" stroke="#EEF2FF" strokeWidth={strokeW} />
      {schedFrac > 0 && (
        <circle cx="65" cy="65" r={R} fill="none" stroke="#818CF8" strokeWidth={strokeW}
          strokeDasharray={`${schedDash} ${C}`}
          strokeDashoffset={-(C * instFrac) + gap / 2}
          transform="rotate(-90 65 65)" strokeLinecap="round" />
      )}
      {instFrac > 0 && (
        <circle cx="65" cy="65" r={R} fill="none" stroke="#2563EB" strokeWidth={strokeW}
          strokeDasharray={`${instDash} ${C}`}
          strokeDashoffset={gap / 2}
          transform="rotate(-90 65 65)" strokeLinecap="round" />
      )}
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const { supervisors, bookings, isLoading } = useVendor();

  // ── Totals ──
  const totalConsumed = supervisors.reduce((s, sup) => s + sup.walletUsed, 0);
  const activeSups    = supervisors.filter((s) => s.status === "Active");
  const topSpender    = [...supervisors].sort((a, b) => b.walletUsed - a.walletUsed)[0];

  // ── Fixed display stats ──
  const avgPerDay = 10428;
  const peakDay   = 17200;
  const prevAmt   = 11400;
  const pctChange = prevAmt > 0 ? ((totalConsumed - prevAmt) / prevAmt) * 100 : 0;
  const isUp      = pctChange >= 0;

  // ── Spend by Booking Type ──
  const instantFare   = bookings.filter((b) => b.type === "Instant")  .reduce((s, b) => s + (b.fare ?? 0), 0);
  const scheduledFare = bookings.filter((b) => b.type === "Scheduled").reduce((s, b) => s + (b.fare ?? 0), 0);
  const totalFare     = instantFare + scheduledFare || 1;
  const instPct       = Math.round((instantFare   / totalFare) * 100);
  const schedPct      = Math.round((scheduledFare / totalFare) * 100);

  // ── Supervisor table rows ──
  const supTableRows = supervisors.map((sup) => {
    const supBookings = bookings.filter((b) => b.supervisorId === sup.id);
    const share       = totalConsumed > 0 ? ((sup.walletUsed / totalConsumed) * 100).toFixed(1) : "0.0";
    return { sup, share, bookingCount: supBookings.length };
  });

  const totalBookingsCount = supTableRows.reduce((s, r) => s + r.bookingCount, 0);

  const sortedBySpend    = [...supTableRows].sort((a, b) => b.sup.walletUsed - a.sup.walletUsed);
  const sortedByBookings = [...supTableRows]
    .sort((a, b) => b.bookingCount - a.bookingCount)
    .map((r) => ({
      ...r,
      bookingShare: totalBookingsCount > 0
        ? ((r.bookingCount / totalBookingsCount) * 100).toFixed(1)
        : "0.0",
    }));

  return (
    <>

      <div className="flex gap-5 items-start">

        {/* ── Left column ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* Hero card */}
          <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-[18px] overflow-hidden">
            <div className="px-7 pt-[26px] pb-6">
              <div className="mb-4">
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.12em]">
                  Total Outflow · Today
                </span>
              </div>
              <div className="mb-5">
                {isLoading ? (
                  <Skeleton className="h-9 w-56" />
                ) : (
                  <span className="text-[36px] font-extrabold text-slate-900 leading-none tracking-[-0.5px]">
                    ₹{totalConsumed.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              <div className="border-t-[1.5px] border-[#F1F5F9] pt-5 flex gap-9">
                <div>
                  <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1.5">VS Yesterday</p>
                  {isLoading ? (
                    <Skeleton className="h-5 w-20 mb-1" />
                  ) : (
                    <p className={`text-base font-bold ${isUp ? "text-[#16A34A]" : "text-[#DC2626]"}`}>
                      {isUp ? "↑" : "↓"} {Math.abs(pctChange).toFixed(1)}%
                    </p>
                  )}
                  <p className="text-[11.5px] text-slate-400 mt-[3px]">was {fmt(prevAmt)}</p>
                </div>
                <div>
                  <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1.5">Avg / Day</p>
                  {isLoading ? (
                    <Skeleton className="h-5 w-24 mb-1" />
                  ) : (
                    <p className="text-base font-bold text-slate-900">{fmt(avgPerDay)}</p>
                  )}
                  <p className="text-[11.5px] text-slate-400 mt-[3px]">trailing 30 days</p>
                </div>
                <div>
                  <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.1em] mb-1.5">Peak Day</p>
                  {isLoading ? (
                    <Skeleton className="h-5 w-24 mb-1" />
                  ) : (
                    <p className="text-base font-bold text-slate-900">{fmt(peakDay)}</p>
                  )}
                  <p className="text-[11.5px] text-slate-400 mt-[3px]">highest in period</p>
                </div>
              </div>
            </div>
          </div>

          {/* 4 stat tiles */}
          <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-[18px] overflow-hidden grid grid-cols-4">
            <div className="px-[22px] py-[18px] border-r-[1.5px] border-[#F1F5F9]">
              <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2.5">Total Spent (Lifetime)</p>
              {isLoading ? (
                <Skeleton className="h-7 w-32 mb-2" />
              ) : (
                <p className="text-[26px] font-extrabold text-slate-900 leading-none mb-2 tracking-[-0.5px]">{fmt(totalConsumed)}</p>
              )}
              <p className="text-xs text-slate-400">
                Across all supervisors · <span className="text-[#16A34A] font-bold">vendor wallet</span>
              </p>
            </div>
            <div className="px-[22px] py-[18px] border-r-[1.5px] border-[#F1F5F9]">
              <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2.5">Today&apos;s Spend</p>
              {isLoading ? (
                <Skeleton className="h-7 w-32 mb-2" />
              ) : (
                <p className="text-[26px] font-extrabold text-slate-900 leading-none mb-2 tracking-[-0.5px]">{fmt(totalConsumed)}</p>
              )}
              <p className="text-xs text-slate-400">
                Across {isLoading ? <SkeletonInline className="h-3 w-6" /> : activeSups.length} active supervisors
              </p>
            </div>
            <div className="px-[22px] py-[18px] border-r-[1.5px] border-[#F1F5F9]">
              <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2.5">Avg / Active Supervisor</p>
              {isLoading ? (
                <Skeleton className="h-7 w-32 mb-2" />
              ) : (
                <p className="text-[26px] font-extrabold text-slate-900 leading-none mb-2 tracking-[-0.5px]">
                  {activeSups.length > 0 ? fmt(Math.round(totalConsumed / activeSups.length)) : "₹0"}
                </p>
              )}
              <p className="text-xs text-slate-400">Today&apos;s spend ÷ active</p>
            </div>
            <div className="px-[22px] py-[18px]">
              <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-[0.12em] mb-2.5">Top Spender Today</p>
              {isLoading ? (
                <Skeleton className="h-6 w-32 mb-2" />
              ) : (
                <p className="text-[22px] font-extrabold text-slate-900 leading-none mb-2">{topSpender?.name ?? "—"}</p>
              )}
              {isLoading ? (
                <Skeleton className="h-3 w-28" />
              ) : (
                <p className="text-xs text-slate-400">
                  {topSpender ? `${fmt(topSpender.walletUsed)} · ${topSpender.zone}` : "No data"}
                </p>
              )}
            </div>
          </div>

          {/* Two tables side by side */}
          <div className="grid grid-cols-2 gap-4">

            {/* Spending table */}
            <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-[18px] overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b-[1.5px] border-[#F1F5F9]">
                <p className="text-[15px] font-extrabold text-slate-900">Spending</p>
                <p className="text-[11.5px] text-slate-400 mt-0.5">By supervisor · today</p>
              </div>
              <div className="grid grid-cols-[28px_1fr_90px_76px] gap-x-[10px] px-5 py-[9px] border-b border-[#F8FAFC]">
                {["#", "SUPERVISOR", "SPEND", "SHARE"].map((h) => (
                  <span key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.6px]">{h}</span>
                ))}
              </div>
              <div>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`grid grid-cols-[28px_1fr_90px_76px] gap-x-[10px] px-5 py-3 items-center ${i < 4 ? "border-b border-[#F8FAFC]" : ""}`}
                    >
                      <Skeleton className="h-3 w-3" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                      <Skeleton className="h-3.5 w-16" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-10" />
                        <Skeleton className="h-1 w-full" />
                      </div>
                    </div>
                  ))
                  : sortedBySpend.map(({ sup, share }, idx) => (
                  <div
                    key={sup.id}
                    className={`grid grid-cols-[28px_1fr_90px_76px] gap-x-[10px] px-5 py-3 items-center ${idx < sortedBySpend.length - 1 ? "border-b border-[#F8FAFC]" : ""}`}
                  >
                    <span className="text-xs font-bold text-slate-300">{idx + 1}</span>
                    <div>
                      <div className="text-[13px] font-bold text-slate-900">{sup.name}</div>
                      <div className="text-[11px] text-slate-400">{sup.zone}</div>
                    </div>
                    <div className="text-[13px] font-extrabold text-slate-900">{fmt(sup.walletUsed)}</div>
                    <div>
                      <span className="text-xs font-bold text-slate-500">{share}%</span>
                      <div className="h-[3px] rounded-sm bg-[#F1F5F9] mt-1 overflow-hidden">
                        <div className="h-full bg-slate-900 rounded-sm" style={{ width: `${share}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bookings table */}
            <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-[18px] overflow-hidden">
              <div className="px-5 pt-4 pb-3 border-b-[1.5px] border-[#F1F5F9]">
                <p className="text-[15px] font-extrabold text-slate-900">Trips</p>
                <p className="text-[11.5px] text-slate-400 mt-0.5">Per supervisor · today</p>
              </div>
              <div className="grid grid-cols-[28px_1fr_72px_76px] gap-x-[10px] px-5 py-[9px] border-b border-[#F8FAFC]">
                {["#", "SUPERVISOR", "TRIPS", "SHARE"].map((h) => (
                  <span key={h} className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.6px]">{h}</span>
                ))}
              </div>
              <div>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`grid grid-cols-[28px_1fr_72px_76px] gap-x-[10px] px-5 py-3 items-center ${i < 4 ? "border-b border-[#F8FAFC]" : ""}`}
                    >
                      <Skeleton className="h-3 w-3" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-2.5 w-16" />
                      </div>
                      <Skeleton className="h-3.5 w-8" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-10" />
                        <Skeleton className="h-1 w-full" />
                      </div>
                    </div>
                  ))
                  : sortedByBookings.map(({ sup, bookingCount, bookingShare }, idx) => (
                  <div
                    key={sup.id}
                    className={`grid grid-cols-[28px_1fr_72px_76px] gap-x-[10px] px-5 py-3 items-center ${idx < sortedByBookings.length - 1 ? "border-b border-[#F8FAFC]" : ""}`}
                  >
                    <span className="text-xs font-bold text-slate-300">{idx + 1}</span>
                    <div>
                      <div className="text-[13px] font-bold text-slate-900">{sup.name}</div>
                      <div className="text-[11px] text-slate-400">{sup.zone}</div>
                    </div>
                    <div className="text-[13px] font-extrabold text-slate-900">{bookingCount}</div>
                    <div>
                      <span className="text-xs font-bold text-slate-500">{bookingShare}%</span>
                      <div className="h-[3px] rounded-sm bg-[#F1F5F9] mt-1 overflow-hidden">
                        <div className="h-full bg-slate-900 rounded-sm" style={{ width: `${bookingShare}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* ── Right sidebar ── */}
        <div className="w-[300px] shrink-0 flex flex-col gap-4">

          {/* Spend by Booking Type */}
          <div className="bg-white border-[1.5px] border-[#E8EEF4] rounded-[18px] overflow-hidden p-5">
            <p className="text-sm font-extrabold text-slate-900 mb-0.5">Spend by Trip Type</p>
            <p className="text-[11.5px] text-slate-400 mb-5">Today across all supervisors</p>

            <div className="flex items-center gap-4">
              {isLoading ? (
                <Skeleton className="h-[130px] w-[130px] rounded-full" />
              ) : (
                <DonutChart instant={instantFare} scheduled={scheduledFare} total={totalFare} />
              )}
              <div>
                {isLoading ? (
                  <Skeleton className="h-6 w-24 mb-1" />
                ) : (
                  <p className="text-[22px] font-extrabold text-slate-900 leading-none">{fmt(instantFare + scheduledFare)}</p>
                )}
                <p className="text-[11.5px] text-slate-400 mt-1">Total today</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-[14px]">
              {[
                { label: "Instant",   amount: instantFare,   pct: instPct,  color: "#2563EB" },
                { label: "Scheduled", amount: scheduledFare, pct: schedPct, color: "#818CF8" },
              ].map(({ label, amount, pct, color }) => (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-[7px]">
                      <span className="w-2.5 h-2.5 rounded-[2px] inline-block shrink-0" style={{ background: color }} />
                      <span className="text-[13px] font-semibold text-slate-900">{label}</span>
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-3 w-20" />
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[13px] font-bold text-slate-900">{fmt(amount)}</span>
                        <span className="text-[11.5px] text-slate-400 font-semibold">{pct}%</span>
                      </div>
                    )}
                  </div>
                  <div className="h-[5px] rounded-[10px] bg-[#F1F5F9] overflow-hidden">
                    <div
                      className="h-full rounded-[10px] transition-[width] duration-500 ease-in-out"
                      style={{ width: `${isLoading ? 0 : pct}%`, background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

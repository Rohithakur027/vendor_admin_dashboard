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

  const CARD: React.CSSProperties = {
    background: "#fff",
    border: "1.5px solid #E8EEF4",
    borderRadius: 18,
    overflow: "hidden",
  };

  return (
    <>
<div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* ── Left column ── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Hero card */}
          <div style={CARD}>
            <div style={{ padding: "26px 28px 24px" }}>
              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                  Total Outflow · Today
                </span>
              </div>
              <div style={{ marginBottom: 20 }}>
                {isLoading ? (
                  <Skeleton className="h-9 w-56" />
                ) : (
                  <span style={{ fontSize: 36, fontWeight: 800, color: "#0F172A", lineHeight: 1, letterSpacing: -0.5 }}>
                    ₹{totalConsumed.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              <div style={{ borderTop: "1.5px solid #F1F5F9", paddingTop: 20, display: "flex", gap: 36 }}>
                <div>
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>VS Yesterday</p>
                  {isLoading ? (
                    <Skeleton className="h-5 w-20 mb-1" />
                  ) : (
                    <p style={{ fontSize: 16, fontWeight: 700, color: isUp ? "#16A34A" : "#DC2626" }}>
                      {isUp ? "↑" : "↓"} {Math.abs(pctChange).toFixed(1)}%
                    </p>
                  )}
                  <p style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 3 }}>was {fmt(prevAmt)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Avg / Day</p>
                  {isLoading ? (
                    <Skeleton className="h-5 w-24 mb-1" />
                  ) : (
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{fmt(avgPerDay)}</p>
                  )}
                  <p style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 3 }}>trailing 30 days</p>
                </div>
                <div>
                  <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Peak Day</p>
                  {isLoading ? (
                    <Skeleton className="h-5 w-24 mb-1" />
                  ) : (
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{fmt(peakDay)}</p>
                  )}
                  <p style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 3 }}>highest in period</p>
                </div>
              </div>
            </div>
          </div>

          {/* 4 stat tiles */}
          <div style={{ ...CARD, display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
            <div style={{ padding: "18px 22px", borderRight: "1.5px solid #F1F5F9" }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Total Spent (Lifetime)</p>
              {isLoading ? (
                <Skeleton className="h-7 w-32 mb-2" />
              ) : (
                <p style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", lineHeight: 1, marginBottom: 8, letterSpacing: -0.5 }}>{fmt(totalConsumed)}</p>
              )}
              <p style={{ fontSize: 12, color: "#94A3B8" }}>
                Across all supervisors · <span style={{ color: "#16A34A", fontWeight: 700 }}>vendor wallet</span>
              </p>
            </div>
            <div style={{ padding: "18px 22px", borderRight: "1.5px solid #F1F5F9" }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Today&apos;s Spend</p>
              {isLoading ? (
                <Skeleton className="h-7 w-32 mb-2" />
              ) : (
                <p style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", lineHeight: 1, marginBottom: 8, letterSpacing: -0.5 }}>{fmt(totalConsumed)}</p>
              )}
              <p style={{ fontSize: 12, color: "#94A3B8" }}>
                Across {isLoading ? <SkeletonInline className="h-3 w-6" /> : activeSups.length} active supervisors
              </p>
            </div>
            <div style={{ padding: "18px 22px", borderRight: "1.5px solid #F1F5F9" }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Avg / Active Supervisor</p>
              {isLoading ? (
                <Skeleton className="h-7 w-32 mb-2" />
              ) : (
                <p style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", lineHeight: 1, marginBottom: 8, letterSpacing: -0.5 }}>
                  {activeSups.length > 0 ? fmt(Math.round(totalConsumed / activeSups.length)) : "₹0"}
                </p>
              )}
              <p style={{ fontSize: 12, color: "#94A3B8" }}>Today&apos;s spend ÷ active</p>
            </div>
            <div style={{ padding: "18px 22px" }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Top Spender Today</p>
              {isLoading ? (
                <Skeleton className="h-6 w-32 mb-2" />
              ) : (
                <p style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", lineHeight: 1, marginBottom: 8 }}>{topSpender?.name ?? "—"}</p>
              )}
              {isLoading ? (
                <Skeleton className="h-3 w-28" />
              ) : (
                <p style={{ fontSize: 12, color: "#94A3B8" }}>
                  {topSpender ? `${fmt(topSpender.walletUsed)} · ${topSpender.zone}` : "No data"}
                </p>
              )}
            </div>
          </div>

          {/* Two tables side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Spending table */}
            <div style={CARD}>
              <div style={{ padding: "16px 20px 12px", borderBottom: "1.5px solid #F1F5F9" }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Spending</p>
                <p style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>By supervisor · today</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 90px 76px", gap: "0 10px", padding: "9px 20px", borderBottom: "1px solid #F8FAFC" }}>
                {["#", "SUPERVISOR", "SPEND", "SHARE"].map((h) => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.6 }}>{h}</span>
                ))}
              </div>
              <div>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px 1fr 90px 76px",
                        gap: "0 10px",
                        padding: "12px 20px",
                        borderBottom: i < 4 ? "1px solid #F8FAFC" : "none",
                        alignItems: "center",
                      }}
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
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 1fr 90px 76px",
                      gap: "0 10px",
                      padding: "12px 20px",
                      borderBottom: idx < sortedBySpend.length - 1 ? "1px solid #F8FAFC" : "none",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#CBD5E1" }}>{idx + 1}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{sup.name}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>{sup.zone}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{fmt(sup.walletUsed)}</div>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>{share}%</span>
                      <div style={{ height: 3, borderRadius: 2, background: "#F1F5F9", marginTop: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: "#0F172A", width: `${share}%`, borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bookings table */}
            <div style={CARD}>
              <div style={{ padding: "16px 20px 12px", borderBottom: "1.5px solid #F1F5F9" }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Trips</p>
                <p style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>Per supervisor · today</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 72px 76px", gap: "0 10px", padding: "9px 20px", borderBottom: "1px solid #F8FAFC" }}>
                {["#", "SUPERVISOR", "TRIPS", "SHARE"].map((h) => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.6 }}>{h}</span>
                ))}
              </div>
              <div>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px 1fr 72px 76px",
                        gap: "0 10px",
                        padding: "12px 20px",
                        borderBottom: i < 4 ? "1px solid #F8FAFC" : "none",
                        alignItems: "center",
                      }}
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
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 1fr 72px 76px",
                      gap: "0 10px",
                      padding: "12px 20px",
                      borderBottom: idx < sortedByBookings.length - 1 ? "1px solid #F8FAFC" : "none",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#CBD5E1" }}>{idx + 1}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{sup.name}</div>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>{sup.zone}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{bookingCount}</div>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>{bookingShare}%</span>
                      <div style={{ height: 3, borderRadius: 2, background: "#F1F5F9", marginTop: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: "#0F172A", width: `${bookingShare}%`, borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* ── Right sidebar ── */}
        <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Spend by Booking Type */}
          <div style={{ ...CARD, padding: "20px" }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginBottom: 2 }}>Spend by Trip Type</p>
            <p style={{ fontSize: 11.5, color: "#94A3B8", marginBottom: 20 }}>Today across all supervisors</p>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {isLoading ? (
                <Skeleton className="h-[130px] w-[130px] rounded-full" />
              ) : (
                <DonutChart instant={instantFare} scheduled={scheduledFare} total={totalFare} />
              )}
              <div>
                {isLoading ? (
                  <Skeleton className="h-6 w-24 mb-1" />
                ) : (
                  <p style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{fmt(instantFare + scheduledFare)}</p>
                )}
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
                    {isLoading ? (
                      <Skeleton className="h-3 w-20" />
                    ) : (
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{fmt(amount)}</span>
                        <span style={{ fontSize: 11.5, color: "#94A3B8", fontWeight: 600 }}>{pct}%</span>
                      </div>
                    )}
                  </div>
                  <div style={{ height: 5, borderRadius: 10, background: "#F1F5F9", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${isLoading ? 0 : pct}%`, background: color, borderRadius: 10, transition: "width 0.5s ease" }} />
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

"use client";

import { useState, Fragment, useCallback } from "react";
import { useRouter } from "next/navigation";

import { useVendor } from "@/context/VendorContext";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, Route, ArrowRight } from "lucide-react";
import type { Booking } from "@/modules/bookings/types";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";
import { vendorsApi } from "@/lib/api";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.getElementById("razorpay-script")) { resolve(true); return; }
    const s = document.createElement("script");
    s.id  = "razorpay-script";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function DashboardPage() {
  const { supervisors, bookings, vendorWallet, isLoading, apiCounts, refreshWallet } = useVendor();
  const router = useRouter();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // ── Recharge modal ──
  const [modalOpen,  setModalOpen]  = useState(false);
  const [amount,     setAmount]     = useState("");
  const [paying,     setPaying]     = useState(false);
  const [payError,   setPayError]   = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState<string | null>(null);

  const handleRecharge = useCallback(async () => {
    const amt = Number(amount);
    if (!amt || amt < 100 || amt > 100_000) { setPayError("Enter an amount between ₹100 and ₹1,00,000"); return; }
    setPayError(null);
    setPaying(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { setPayError("Failed to load payment gateway. Check your connection."); setPaying(false); return; }

      const orderRes = await vendorsApi.wallet.createOrder(amt);
      const { order_id, amount: orderAmount, currency, key_id } = orderRes.data;

      const rzp = new window.Razorpay({
        key: key_id, amount: orderAmount, currency, order_id,
        name: "SK Travels", description: "Wallet Recharge",
        theme: { color: "#2563EB" },
        // Whitelist of methods we want offered. PayLater is intentionally
        // omitted. Razorpay still only renders methods that are also enabled
        // on the merchant account — if UPI is disabled in the dashboard, no
        // amount of client config will make it appear.
        method: {
          upi:        true,
          card:       true,
          netbanking: true,
          wallet:     true,
          emi:        true,
        },
        // Feature UPI as the top block in the checkout. show_default_blocks
        // stays true so card/netbanking/wallet still appear naturally below.
        config: {
          display: {
            blocks: {
              upi: {
                name: "Pay using UPI",
                instruments: [{ method: "upi" }],
              },
            },
            sequence: ["block.upi"],
            preferences: { show_default_blocks: true },
          },
        },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            await vendorsApi.wallet.verify({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              amount:              amt,
            });
            await refreshWallet();
            setPaySuccess(`₹${amt.toLocaleString("en-IN")} added to your wallet`);
            setAmount("");
            setModalOpen(false);
          } catch { setPayError("Payment received but wallet update failed. Contact support."); }
          finally  { setPaying(false); }
        },
        modal: { ondismiss: () => setPaying(false) },
      });
      rzp.open();
    } catch { setPayError("Could not initiate payment. Please try again."); setPaying(false); }
  }, [amount, refreshWallet]);

  const today = new Date().toISOString().split("T")[0];
  const bookingsToday = bookings.filter((b) => b.createdAt.startsWith(today));
  const activeSupervisorsToday = supervisors.filter((s) => s.bookingsToday > 0);

  const recentBookings = [...bookings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const apiInRecent = recentBookings.filter((b) => {
    const idx = bookings.findIndex((x) => x.id === b.id);
    return idx < apiCounts.bookings;
  }).length;
  const recentSplitAt = apiInRecent > 0 && apiInRecent < recentBookings.length ? apiInRecent : -1;

  const walletBalance    = vendorWallet?.walletBalance ?? 0;
  const walletUsedTotal  = vendorWallet?.walletUsed
    ?? supervisors.reduce((sum, s) => sum + s.walletUsed, 0);
  const walletCapacity   = walletBalance + walletUsedTotal;

  return (
    <div className="space-y-6">
      {/* ── Success toast ── */}
      {paySuccess && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: "#DCFCE7", border: "1.5px solid #86EFAC", borderRadius: 12, padding: "12px 18px", fontSize: 13, fontWeight: 700, color: "#15803D", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", gap: 10 }}>
          <span>✓</span> {paySuccess}
          <button onClick={() => setPaySuccess(null)} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "#15803D", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* ── Recharge modal ── */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 18, padding: "28px 28px 24px", width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Add Money to Wallet</p>
              <button onClick={() => { setModalOpen(false); setPayError(null); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#94A3B8", lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Amount (₹)</p>
            <input
              type="number" min={100} max={100000} placeholder="e.g. 5000"
              value={amount} onChange={(e) => { setAmount(e.target.value); setPayError(null); }}
              style={{ width: "100%", height: 44, border: `1.5px solid ${payError ? "#FCA5A5" : "#E2E8F0"}`, borderRadius: 10, padding: "0 14px", fontSize: 15, fontWeight: 700, color: "#0F172A", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
            />
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[500, 1000, 2000, 5000].map((q) => (
                <button key={q} onClick={() => { setAmount(String(q)); setPayError(null); }}
                  style={{ flex: 1, height: 30, borderRadius: 7, border: `1.5px solid ${amount === String(q) ? "#2563EB" : "#E2E8F0"}`, background: amount === String(q) ? "#EFF6FF" : "#F8FAFC", color: amount === String(q) ? "#2563EB" : "#64748B", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                  ₹{q >= 1000 ? `${q / 1000}k` : q}
                </button>
              ))}
            </div>
            {payError && <p style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, marginBottom: 12 }}>{payError}</p>}
            <button onClick={handleRecharge} disabled={paying}
              style={{ width: "100%", height: 44, borderRadius: 10, background: paying ? "#93C5FD" : "#2563EB", border: "none", color: "#fff", fontSize: 14, fontWeight: 800, cursor: paying ? "not-allowed" : "pointer" }}>
              {paying ? "Processing…" : `Pay ₹${Number(amount) > 0 ? Number(amount).toLocaleString("en-IN") : "—"}`}
            </button>
            <p style={{ fontSize: 10.5, color: "#94A3B8", textAlign: "center", marginTop: 12 }}>Secured by Razorpay · UPI, Cards, Net Banking, Wallets &amp; EMI</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Supervisors"
          value={supervisors.length}
          icon={Users}
          description={`${supervisors.filter((s) => s.status === "Active").length} active · ${supervisors.filter((s) => s.status !== "Active").length} inactive`}
          loading={isLoading}
        />
        <StatCard
          title="Active Supervisors"
          value={activeSupervisorsToday.length}
          icon={UserCheck}
          description="Created trips today"
          loading={isLoading}
        />
        <StatCard
          title="Total Trips Today"
          value={bookingsToday.length}
          icon={Route}
          description={`${bookingsToday.filter((b) => b.status === "Completed").length} completed`}
          loading={isLoading}
        />
        <StatCard
          title="Remaining Balance"
          value={`₹${walletBalance.toLocaleString("en-IN")}`}
          progress={{
            used:       walletUsedTotal,
            total:      walletCapacity || 1,
            usedLabel:  `Used ₹${walletUsedTotal.toLocaleString("en-IN")}`,
            totalLabel: `Total ₹${walletCapacity.toLocaleString("en-IN")}`,
          }}
          loading={isLoading}
          onAction={{ label: "+ Add Money", onClick: () => { setModalOpen(true); setPayError(null); setPaySuccess(null); } }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Trips</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {isLoading
                ? Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="flex items-center justify-between px-6 py-3.5 gap-4">
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full shrink-0" />
                  </div>
                ))
                : recentBookings.map((booking, idx) => (
                  <Fragment key={booking.id}>
                    {idx === recentSplitAt && (
                      <div className="flex items-center gap-2.5 px-6 py-1.5 bg-amber-50 border-y border-dashed border-amber-200">
                        <div className="flex-1 h-px bg-amber-200" />
                        <span className="text-[9.5px] font-bold text-amber-600 tracking-widest uppercase whitespace-nowrap">Sample Data</span>
                        <div className="flex-1 h-px bg-amber-200" />
                      </div>
                    )}
                    <div
                      className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setSelectedBooking(booking)}
                    >
                      <div className="min-w-0 pr-4">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-medium truncate shrink-0 max-w-[45%]">{booking.pickupLocation}</p>
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <p className="text-sm font-medium truncate">{booking.dropLocation}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[booking.supervisorName, booking.type].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <StatusBadge status={booking.status} size="sm" />
                    </div>
                  </Fragment>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Supervisor Activity with Wallet */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Supervisor Activity & Wallet</CardTitle>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-medium text-blue-600">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                Today
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Column headers */}
            <div className="grid grid-cols-[minmax(0,1fr)_70px_90px] items-center gap-3 px-6 py-2 border-b bg-slate-50/50">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Supervisor</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Trips</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Wallet</p>
            </div>
            <div className="divide-y">
              {isLoading
                ? Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="grid grid-cols-[minmax(0,1fr)_70px_90px] items-center gap-3 px-6 py-3">
                    <div className="min-w-0 space-y-1.5">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-3.5 w-8 ml-auto" />
                    <Skeleton className="h-3.5 w-14 ml-auto" />
                  </div>
                ))
                : supervisors.slice(0, 5).map((sup) => {
                const spendToday = sup.dailyHistory.find((d) => d.date === today)?.amount ?? 0;
                return (
                  <div
                    key={sup.id}
                    className="grid grid-cols-[minmax(0,1fr)_70px_90px] items-center gap-3 px-6 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => router.push(`/dashboard/supervisors/${sup.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{sup.name}</p>
                      <p className="text-xs text-muted-foreground">{sup.zone}</p>
                    </div>
                    <p className={`text-sm font-semibold text-right ${sup.bookingsToday === 0 ? "text-slate-300" : "text-black"}`}>
                      {sup.bookingsToday}
                    </p>
                    <p className={`text-sm font-semibold text-right ${spendToday === 0 ? "text-slate-300" : "text-black"}`}>
                      ₹{spendToday.toLocaleString("en-IN")}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
    </div>
  );
}

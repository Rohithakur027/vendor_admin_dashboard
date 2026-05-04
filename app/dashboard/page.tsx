"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";

import { useVendor } from "@/context/VendorContext";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, Route, ArrowRight } from "lucide-react";
import type { Booking, BookingStatus } from "@/modules/bookings/types";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";

export default function DashboardPage() {
  const { supervisors, bookings, vendorWallet, isLoading, apiCounts } = useVendor();
  const router = useRouter();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

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

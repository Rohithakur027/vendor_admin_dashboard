"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";

import { useVendor } from "@/context/VendorContext";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, BookOpen, ArrowRight } from "lucide-react";
import type { Booking, BookingStatus } from "@/modules/bookings/types";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between px-6 py-3.5 gap-4">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


export default function DashboardPage() {
  const { supervisors, bookings, isLoading, apiCounts } = useVendor();
  const router = useRouter();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  if (isLoading) return <DashboardSkeleton />;

  const today = new Date().toISOString().split("T")[0];
  const bookingsToday = bookings.filter((b) => b.createdAt.startsWith(today));
  const activeSupervisorsToday = supervisors.filter((s) => s.bookingsToday > 0);
  const pendingScheduled = bookings.filter(
    (b) => b.type === "Scheduled" && b.status === "Pending" && !b.driverId
  );

  const recentBookings = [...bookings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);

  const apiInRecent = recentBookings.filter((b) => {
    const idx = bookings.findIndex((x) => x.id === b.id);
    return idx < apiCounts.bookings;
  }).length;
  const recentSplitAt = apiInRecent > 0 && apiInRecent < recentBookings.length ? apiInRecent : -1;

  const onlineSupervisors = supervisors.filter((s) => s.isOnline);

  const totalWalletLimit = supervisors.reduce((sum, s) => sum + s.walletLimit, 0);
  const totalWalletUsed = supervisors.reduce((sum, s) => sum + s.walletUsed, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Supervisors"
          value={supervisors.length}
          icon={Users}
          description={`${supervisors.filter((s) => s.status === "Active").length} active · ${supervisors.filter((s) => s.status !== "Active").length} inactive`}
        />
        <StatCard
          title="Active Supervisors"
          value={activeSupervisorsToday.length}
          icon={UserCheck}
          description="Created bookings today"
        />
        <StatCard
          title="Total Bookings Today"
          value={bookingsToday.length}
          icon={BookOpen}
          description={`${bookingsToday.filter((b) => b.status === "Completed").length} completed`}
        />
        <StatCard
          title="Wallet Balance"
          value={`₹${(totalWalletLimit - totalWalletUsed).toLocaleString()}`}
          progress={{
            used: totalWalletUsed,
            total: totalWalletLimit,
            usedLabel: `₹${totalWalletUsed.toLocaleString()}`,
            totalLabel: `₹${totalWalletLimit.toLocaleString()}`,
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentBookings.map((booking, idx) => (
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
                      {booking.supervisorName} · {booking.type}
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
            <div className="divide-y">
              {supervisors.map((sup) => {
                return (
                  <div
                    key={sup.id}
                    className="flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => router.push(`/dashboard/supervisors/${sup.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sup.name}</p>
                      <p className="text-xs text-muted-foreground">{sup.zone}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center justify-end">
                        <p className="text-sm font-semibold text-black">
                          ₹{sup.walletUsed.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {onlineSupervisors.length > 0 && (
              <div className="px-6 py-2 border-t bg-green-50">
                <p className="text-xs text-green-700">
                  {onlineSupervisors.length} supervisor{onlineSupervisors.length !== 1 ? "s" : ""} online now
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
    </div>
  );
}

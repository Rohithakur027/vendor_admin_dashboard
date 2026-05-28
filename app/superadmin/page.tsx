"use client";

import { useState, useEffect, useCallback } from "react";
import { superadminApi, type OverviewData, type OverviewVendor, type OverviewDriver } from "@/lib/api";
import { useDriverStatusFeed, type DriverStatusEvent } from "@/lib/useDriverStatusFeed";
import { Building2, Users, CheckCircle2, Route } from "lucide-react";
import Link from "next/link";
import { getStatusStyle } from "@/components/StatusBadge";

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2.5">{label}</p>
        <div className="w-8 h-8 rounded-[9px] bg-slate-100 border border-slate-200 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-slate-500" />
        </div>
      </div>
      {loading ? (
        <div className="h-[34px] w-[60px] rounded-lg bg-slate-100 animate-pulse" />
      ) : (
        <div className="text-[34px] font-extrabold text-slate-900 leading-none">{value}</div>
      )}
      {sub && (
        loading
          ? <div className="h-2.5 w-28 rounded bg-slate-100 mt-3 animate-pulse" />
          : <div className="text-[12px] text-slate-400 mt-2 font-medium">{sub}</div>
      )}
    </div>
  );
}

function SkeletonRow({ cols, extra }: { cols: string; extra?: boolean }) {
  return (
    <div className="grid gap-3 px-5 py-3.5 items-center animate-pulse" style={{ gridTemplateColumns: cols }}>
      <div className="h-3 rounded bg-slate-100 w-3/5" />
      {extra && <div className="h-3 rounded bg-slate-100 w-[70%]" />}
      <div className="h-3 rounded bg-slate-100 ml-auto w-8" />
      <div className="h-[22px] rounded-full bg-slate-100 ml-auto w-[60px]" />
    </div>
  );
}

export default function SuperAdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superadminApi
      .overview()
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const onDriverStatus = useCallback((ev: DriverStatusEvent) => {
    setData((prev) => {
      if (!prev) return prev;
      const idx = prev.drivers.findIndex((d) => d.id === ev.driver_id);
      if (idx === -1) return prev;
      const nextDrivers = prev.drivers.slice();
      nextDrivers[idx] = { ...nextDrivers[idx], status: ev.status };
      return {
        ...prev,
        drivers: nextDrivers,
        driversOnTrip:    nextDrivers.filter((d) => d.status === "On Trip").length,
        driversAvailable: nextDrivers.filter((d) => d.status === "Available").length,
      };
    });
  }, []);
  useDriverStatusFeed(onDriverStatus);

  const vendors: OverviewVendor[] = data?.vendors ?? [];
  const drivers: OverviewDriver[] = data?.drivers ?? [];

  const totalVendors      = data?.totalVendors      ?? 0;
  const activeVendors     = data?.activeVendors     ?? 0;
  const inactiveVendors   = data?.inactiveVendors   ?? 0;
  const totalDrivers      = data?.totalDrivers      ?? 0;
  const driversOnTrip     = data?.driversOnTrip     ?? 0;
  const driversAvailable  = data?.driversAvailable  ?? 0;
  const totalBookingsToday = data?.totalBookingsToday ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Page title */}
      <div>
        <p className="text-xl font-extrabold text-slate-900">Dashboard</p>
        <p className="text-[13px] text-slate-400 mt-0.5 font-medium">Live summary across all vendors and drivers</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <StatCard loading={loading} label="Total Vendors"  value={totalVendors}       icon={Building2}    sub={`${activeVendors} active · ${inactiveVendors} inactive`} />
        <StatCard loading={loading} label="Active Vendors" value={activeVendors}      icon={CheckCircle2} sub={`${inactiveVendors} inactive`} />
        <StatCard loading={loading} label="Total Drivers"  value={totalDrivers}       icon={Users}        sub={`${driversAvailable} available · ${driversOnTrip} on trip`} />
        <StatCard loading={loading} label="Trips Today"    value={totalBookingsToday} icon={Route}        sub="across all vendors" />
      </div>

      {/* Two panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Vendors panel */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-[14px] font-extrabold text-slate-900">Vendors</p>
            <Link href="/superadmin/vendors" className="text-[12px] font-semibold text-blue-600 no-underline hover:text-blue-700">
              View all →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <div style={{ minWidth: 320 }}>
              <div className="grid gap-3 px-5 py-2.5 border-b border-slate-50" style={{ gridTemplateColumns: "1fr 110px 90px" }}>
                {["VENDOR", "TODAY TRIPS", "STATUS"].map(h => (
                  <div key={h} className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wide last:text-right [&:nth-child(2)]:text-center">
                    {h}
                  </div>
                ))}
              </div>
              <div>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols="1fr 110px 90px" />)
                  : vendors.slice(0, 5).map((vendor, i) => {
                      const vs = getStatusStyle(vendor.status);
                      return (
                        <div
                          key={vendor.id}
                          className="grid gap-3 px-5 py-3.5 items-center"
                          style={{
                            gridTemplateColumns: "1fr 110px 90px",
                            borderBottom: i < Math.min(vendors.length, 5) - 1 ? "1.5px solid #F8FAFC" : "none",
                          }}
                        >
                          <p className="text-[13px] font-bold text-slate-900">{vendor.name}</p>
                          <p className="text-center text-[14px] font-extrabold" style={{ color: vendor.bookingsToday === 0 ? "#CBD5E1" : "#0F172A" }}>
                            {vendor.bookingsToday}
                          </p>
                          <div className="text-right">
                            <span
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                              style={{ background: vs.bg, color: vs.text }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: vs.dot }} />
                              {vendor.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>
          </div>
        </div>

        {/* Drivers panel */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-[14px] font-extrabold text-slate-900">Drivers</p>
            <Link href="/superadmin/drivers" className="text-[12px] font-semibold text-blue-600 no-underline hover:text-blue-700">
              View all →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <div style={{ minWidth: 480 }}>
              <div className="grid gap-3 px-5 py-2.5 border-b border-slate-50" style={{ gridTemplateColumns: "1fr 140px 110px 100px" }}>
                {["DRIVER", "VEHICLE DETAILS", "TODAY TRIPS", "STATUS"].map((h, idx) => (
                  <div key={h} className={`text-[10.5px] font-bold text-slate-300 uppercase tracking-wide ${idx === 2 ? "text-center" : idx === 3 ? "text-right" : ""}`}>
                    {h}
                  </div>
                ))}
              </div>
              <div>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols="1fr 140px 110px 100px" extra />)
                  : drivers.slice(0, 5).map((driver, i) => {
                      const badge = getStatusStyle(driver.status);
                      return (
                        <div
                          key={driver.id}
                          className="grid gap-3 px-5 py-3.5 items-center"
                          style={{
                            gridTemplateColumns: "1fr 140px 110px 100px",
                            borderBottom: i < Math.min(drivers.length, 5) - 1 ? "1.5px solid #F8FAFC" : "none",
                          }}
                        >
                          <p className="text-[13px] font-bold text-slate-900">{driver.name}</p>
                          <div>
                            {driver.vehicle ? (
                              <>
                                <p className="text-[12px] font-bold text-slate-900 tabular-nums">{driver.vehicle}</p>
                                {driver.vehicleModel && <p className="text-[11px] text-slate-400 font-medium mt-px">{driver.vehicleModel}</p>}
                                {driver.vehicleType && <p className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase tracking-wide">{driver.vehicleType}</p>}
                              </>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">No vehicle assigned</span>
                            )}
                          </div>
                          <p className="text-center text-[14px] font-extrabold" style={{ color: driver.bookingsToday === 0 ? "#CBD5E1" : "#0F172A" }}>
                            {driver.bookingsToday}
                          </p>
                          <div className="text-right">
                            <span
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                              style={{ background: badge.bg, color: badge.text }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: badge.dot }} />
                              {driver.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

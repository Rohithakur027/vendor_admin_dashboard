"use client";

import { useState, useEffect } from "react";
import { superadminApi, type OverviewData, type OverviewVendor, type OverviewDriver } from "@/lib/api";
import { Building2, Users, CheckCircle2, Route } from "lucide-react";
import Link from "next/link";
import { getStatusStyle } from "@/components/StatusBadge";

const font = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "1.5px solid #E8EEF4",
  borderRadius: 16,
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
  fontFamily: font,
};

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
    <div style={{ ...CARD, padding: "20px 22px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 10 }}>
          {label}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "#F1F5F9", border: "1.5px solid #E8EEF4", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={16} color="#64748B" />
        </div>
      </div>
      {loading ? (
        <div style={{ height: 34, width: 60, borderRadius: 8, background: "#F1F5F9", animation: "pulse 1.5s ease-in-out infinite" }} />
      ) : (
        <div style={{ fontSize: 34, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{value}</div>
      )}
      {sub && (
        loading
          ? <div style={{ height: 10, width: 110, borderRadius: 6, background: "#F1F5F9", marginTop: 12, animation: "pulse 1.5s ease-in-out infinite" }} />
          : <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 8, fontWeight: 500 }}>{sub}</div>
      )}
    </div>
  );
}

function SkeletonRow({ cols }: { cols: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, padding: "13px 20px", alignItems: "center" }}>
      <div style={{ height: 12, borderRadius: 6, background: "#F1F5F9", width: "60%" }} />
      <div style={{ height: 12, borderRadius: 6, background: "#F1F5F9", marginLeft: "auto", width: 32 }} />
      <div style={{ height: 22, borderRadius: 99, background: "#F1F5F9", marginLeft: "auto", width: 60 }} />
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
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 24 }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Page title */}
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>Platform Overview</div>
        <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 3, fontWeight: 500 }}>Live summary across all vendors and drivers</div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <StatCard loading={loading} label="Total Vendors"   value={totalVendors}       icon={Building2}    sub={`${activeVendors} active · ${inactiveVendors} inactive`} />
        <StatCard loading={loading} label="Active Vendors"  value={activeVendors}      icon={CheckCircle2} sub={`${inactiveVendors} inactive`} />
        <StatCard loading={loading} label="Total Drivers"   value={totalDrivers}       icon={Users}        sub={`${driversAvailable} available · ${driversOnTrip} on trip`} />
        <StatCard loading={loading} label="Trips Today"  value={totalBookingsToday} icon={Route}        sub="across all vendors" />
      </div>

      {/* Two panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Vendors panel ── */}
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1.5px solid #F1F5F9" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Vendors</div>
            <Link href="/superadmin/vendors" style={{ fontSize: 12, fontWeight: 600, color: "#2563EB", textDecoration: "none" }}>
              View all →
            </Link>
          </div>

          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 320 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px", gap: 12, padding: "10px 20px 8px", borderBottom: "1.5px solid #F8FAFC" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.6 }}>VENDOR</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" }}>TODAY TRIPS</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>STATUS</div>
              </div>

              <div>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <SkeletonRow key={i} cols="1fr 110px 90px" />
                    ))
                  : vendors.slice(0, 5).map((vendor, i) => (
                      <div
                        key={vendor.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 110px 90px",
                          gap: 12,
                          padding: "13px 20px",
                          borderBottom: i < Math.min(vendors.length, 5) - 1 ? "1.5px solid #F8FAFC" : "none",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{vendor.name}</div>
                        <div style={{ textAlign: "center" }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: vendor.bookingsToday === 0 ? "#CBD5E1" : "#0F172A" }}>
                            {vendor.bookingsToday}
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {(() => { const vs = getStatusStyle(vendor.status); return (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: vs.bg, color: vs.text }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: vs.dot, flexShrink: 0 }} />
                              {vendor.status}
                            </span>
                          ); })()}
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          </div>

        </div>

        {/* ── Drivers panel ── */}
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1.5px solid #F1F5F9" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Drivers</div>
            <Link href="/superadmin/drivers" style={{ fontSize: 12, fontWeight: 600, color: "#2563EB", textDecoration: "none" }}>
              View all →
            </Link>
          </div>

          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 320 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 100px", gap: 12, padding: "10px 20px 8px", borderBottom: "1.5px solid #F8FAFC" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.6 }}>DRIVER</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" }}>TODAY TRIPS</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>STATUS</div>
              </div>

              <div>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <SkeletonRow key={i} cols="1fr 110px 100px" />
                    ))
                  : drivers.slice(0, 5).map((driver, i) => {
                      const badge = getStatusStyle(driver.status);
                      return (
                        <div
                          key={driver.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 110px 100px",
                            gap: 12,
                            padding: "13px 20px",
                            borderBottom: i < Math.min(drivers.length, 5) - 1 ? "1.5px solid #F8FAFC" : "none",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{driver.name}</div>
                          <div style={{ textAlign: "center" }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: driver.bookingsToday === 0 ? "#CBD5E1" : "#0F172A" }}>
                              {driver.bookingsToday}
                            </span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: badge.bg, color: badge.text }}>
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.dot, flexShrink: 0 }} />
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

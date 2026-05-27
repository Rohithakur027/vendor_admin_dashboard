"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { superadminApi, type OverviewData, type OverviewVendor, type OverviewDriver } from "@/lib/api";
import { useDriverStatusFeed, type DriverStatusEvent } from "@/lib/useDriverStatusFeed";
import { Building2, Users, CheckCircle2, Route, GripVertical } from "lucide-react";
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

function SkeletonRow({ cols, extra }: { cols: string; extra?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, padding: "13px 20px", alignItems: "center" }}>
      <div style={{ width: 12, height: 12, borderRadius: 3, background: "#F1F5F9" }} />
      <div style={{ height: 12, borderRadius: 6, background: "#F1F5F9", width: "60%" }} />
      {extra && <div style={{ height: 12, borderRadius: 6, background: "#F1F5F9", width: "70%" }} />}
      <div style={{ height: 12, borderRadius: 6, background: "#F1F5F9", marginLeft: "auto", width: 32 }} />
      <div style={{ height: 22, borderRadius: 99, background: "#F1F5F9", marginLeft: "auto", width: 60 }} />
    </div>
  );
}

export default function SuperAdminOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  // Custom DND state variables for overview tables
  const [vendorsOrder, setVendorsOrder] = useState<(string | number)[]>([]);
  const [driversOrder, setDriversOrder] = useState<(string | number)[]>([]);

  // Drag states
  const [draggedVendorIdx, setDraggedVendorIdx] = useState<number | null>(null);
  const [dragOverVendorIdx, setDragOverVendorIdx] = useState<number | null>(null);

  const [draggedDriverIdx, setDraggedDriverIdx] = useState<number | null>(null);
  const [dragOverDriverIdx, setDragOverDriverIdx] = useState<number | null>(null);

  // Hydrate order from localStorage on client-side mount
  useEffect(() => {
    try {
      const savedVendors = localStorage.getItem("superadmin_overview_vendors_order");
      if (savedVendors) {
        setVendorsOrder(JSON.parse(savedVendors));
      }
      const savedDrivers = localStorage.getItem("superadmin_overview_drivers_order");
      if (savedDrivers) {
        setDriversOrder(JSON.parse(savedDrivers));
      }
    } catch (e) {
      console.error("Failed to load table orders from localStorage", e);
    }
  }, []);

  useEffect(() => {
    superadminApi
      .overview()
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Patch the matching driver row + recompute the On Trip / Available
  // aggregates so the stat cards stay in sync without a page reload.
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
        driversOnTrip: nextDrivers.filter((d) => d.status === "On Trip").length,
        driversAvailable: nextDrivers.filter((d) => d.status === "Available").length,
      };
    });
  }, []);
  useDriverStatusFeed(onDriverStatus);

  const vendors: OverviewVendor[] = data?.vendors ?? [];
  const drivers: OverviewDriver[] = data?.drivers ?? [];

  // Sort helper to apply saved custom order lists
  const applyCustomOrder = useCallback(
    <T extends { id: string | number }>(itemsList: T[], orderIds: (string | number)[]): T[] => {
      if (!orderIds || orderIds.length === 0) return itemsList;
      const orderMap: Record<string | number, number> = {};
      orderIds.forEach((id, idx) => {
        orderMap[id] = idx;
      });

      return [...itemsList].sort((a, b) => {
        const aHas = a.id in orderMap;
        const bHas = b.id in orderMap;
        if (aHas && bHas) {
          return orderMap[a.id] - orderMap[b.id];
        }
        if (aHas) return -1;
        if (bHas) return 1;
        return 0;
      });
    },
    []
  );

  const sortedVendors = useMemo(() => {
    return applyCustomOrder(vendors, vendorsOrder);
  }, [vendors, vendorsOrder, applyCustomOrder]);

  const sortedDrivers = useMemo(() => {
    return applyCustomOrder(drivers, driversOrder);
  }, [drivers, driversOrder, applyCustomOrder]);

  const visibleVendors = useMemo(() => sortedVendors.slice(0, 5), [sortedVendors]);
  const visibleDrivers = useMemo(() => sortedDrivers.slice(0, 5), [sortedDrivers]);

  // Drag-and-drop event handlers for Vendors Table
  const handleVendorDragStart = (e: React.DragEvent, index: number) => {
    setDraggedVendorIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleVendorDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedVendorIdx === null || draggedVendorIdx === index) return;
    setDragOverVendorIdx(index);
  };

  const handleVendorDragLeave = () => {
    setDragOverVendorIdx(null);
  };

  const handleVendorDragEnd = () => {
    setDraggedVendorIdx(null);
    setDragOverVendorIdx(null);
  };

  const handleVendorDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedVendorIdx === null || draggedVendorIdx === targetIndex) {
      handleVendorDragEnd();
      return;
    }

    const updatedVisible = [...visibleVendors];
    const [movedItem] = updatedVisible.splice(draggedVendorIdx, 1);
    updatedVisible.splice(targetIndex, 0, movedItem);

    const reorderedIds = updatedVisible.map((item) => item.id);
    const remainingIds = vendors
      .map((item) => item.id)
      .filter((id) => !reorderedIds.includes(id));
    const newOrder = [...reorderedIds, ...remainingIds];

    setVendorsOrder(newOrder);
    localStorage.setItem("superadmin_overview_vendors_order", JSON.stringify(newOrder));

    handleVendorDragEnd();
  };

  // Drag-and-drop event handlers for Drivers Table
  const handleDriverDragStart = (e: React.DragEvent, index: number) => {
    setDraggedDriverIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDriverDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedDriverIdx === null || draggedDriverIdx === index) return;
    setDragOverDriverIdx(index);
  };

  const handleDriverDragLeave = () => {
    setDragOverDriverIdx(null);
  };

  const handleDriverDragEnd = () => {
    setDraggedDriverIdx(null);
    setDragOverDriverIdx(null);
  };

  const handleDriverDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedDriverIdx === null || draggedDriverIdx === targetIndex) {
      handleDriverDragEnd();
      return;
    }

    const updatedVisible = [...visibleDrivers];
    const [movedItem] = updatedVisible.splice(draggedDriverIdx, 1);
    updatedVisible.splice(targetIndex, 0, movedItem);

    const reorderedIds = updatedVisible.map((item) => item.id);
    const remainingIds = drivers
      .map((item) => item.id)
      .filter((id) => !reorderedIds.includes(id));
    const newOrder = [...reorderedIds, ...remainingIds];

    setDriversOrder(newOrder);
    localStorage.setItem("superadmin_overview_drivers_order", JSON.stringify(newOrder));

    handleDriverDragEnd();
  };

  const totalVendors = data?.totalVendors ?? 0;
  const activeVendors = data?.activeVendors ?? 0;
  const inactiveVendors = data?.inactiveVendors ?? 0;
  const totalDrivers = data?.totalDrivers ?? 0;
  const driversOnTrip = data?.driversOnTrip ?? 0;
  const driversAvailable = data?.driversAvailable ?? 0;
  const totalBookingsToday = data?.totalBookingsToday ?? 0;

  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 24 }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .drag-row {
          transition: background-color 0.2s ease, transform 0.2s ease, border 0.2s ease;
        }
        .drag-row:hover {
          background-color: #f8fafc !important;
        }
        .drag-row:hover .drag-handle {
          opacity: 1;
        }
        .drag-handle {
          opacity: 0.4;
          transition: opacity 0.2s ease;
        }
        .drag-handle:hover {
          opacity: 1;
          color: #2563EB;
        }
      `}</style>

      {/* Page title */}
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>Dashboard</div>
        <div style={{ fontSize: 13, color: "#94A3B8", marginTop: 3, fontWeight: 500 }}>Live summary across all vendors and drivers</div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <StatCard loading={loading} label="Total Vendors" value={totalVendors} icon={Building2} sub={`${activeVendors} active · ${inactiveVendors} inactive`} />
        <StatCard loading={loading} label="Active Vendors" value={activeVendors} icon={CheckCircle2} sub={`${inactiveVendors} inactive`} />
        <StatCard loading={loading} label="Total Drivers" value={totalDrivers} icon={Users} sub={`${driversAvailable} available · ${driversOnTrip} on trip`} />
        <StatCard loading={loading} label="Trips Today" value={totalBookingsToday} icon={Route} sub="across all vendors" />
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
            <div style={{ minWidth: 344 }}>
              <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 110px 90px", gap: 12, padding: "10px 20px 8px", borderBottom: "1.5px solid #F8FAFC" }}>
                <div />
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.6 }}>VENDOR</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" }}>TODAY TRIPS</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>STATUS</div>
              </div>

              <div>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} cols="24px 1fr 110px 90px" />
                  ))
                  : visibleVendors.map((vendor, i) => {
                    const isDragged = draggedVendorIdx === i;
                    const isDragOver = dragOverVendorIdx === i;

                    return (
                      <div
                        key={vendor.id}
                        draggable
                        onDragStart={(e) => handleVendorDragStart(e, i)}
                        onDragOver={(e) => handleVendorDragOver(e, i)}
                        onDragLeave={handleVendorDragLeave}
                        onDragEnd={handleVendorDragEnd}
                        onDrop={(e) => handleVendorDrop(e, i)}
                        className="drag-row"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "24px 1fr 110px 90px",
                          gap: 12,
                          padding: "13px 20px",
                          borderBottom: i < visibleVendors.length - 1 ? "1.5px solid #F8FAFC" : "none",
                          alignItems: "center",
                          backgroundColor: isDragOver
                            ? "rgba(37, 99, 235, 0.06)"
                            : isDragged
                            ? "rgba(241, 245, 249, 0.5)"
                            : "transparent",
                          opacity: isDragged ? 0.45 : 1,
                          outline: isDragOver ? "1.5px dashed #3B82F6" : "none",
                          outlineOffset: "-2px",
                          transform: isDragOver ? "scale(1.005)" : "none",
                          boxShadow: isDragged ? "0 4px 12px rgba(0,0,0,0.04)" : "none",
                        }}
                      >
                        <div className="drag-handle" style={{ display: "flex", alignItems: "center", color: "#94A3B8" }}>
                          <GripVertical size={13} style={{ cursor: "grab" }} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{vendor.name}</div>
                        <div style={{ textAlign: "center" }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: vendor.bookingsToday === 0 ? "#CBD5E1" : "#0F172A" }}>
                            {vendor.bookingsToday}
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {(() => {
                            const vs = getStatusStyle(vendor.status); return (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: vs.bg, color: vs.text }}>
                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: vs.dot, flexShrink: 0 }} />
                                {vendor.status}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
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
            <div style={{ minWidth: 504 }}>
              <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 140px 110px 100px", gap: 12, padding: "10px 20px 8px", borderBottom: "1.5px solid #F8FAFC" }}>
                <div />
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.6 }}>DRIVER</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.6 }}>VEHICLE DETAILS</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center" }}>TODAY TRIPS</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#CBD5E1", textTransform: "uppercase", letterSpacing: 0.6, textAlign: "right" }}>STATUS</div>
              </div>

              <div>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonRow key={i} cols="24px 1fr 140px 110px 100px" extra />
                  ))
                  : visibleDrivers.map((driver, i) => {
                    const badge = getStatusStyle(driver.status);
                    const isDragged = draggedDriverIdx === i;
                    const isDragOver = dragOverDriverIdx === i;

                    return (
                      <div
                        key={driver.id}
                        draggable
                        onDragStart={(e) => handleDriverDragStart(e, i)}
                        onDragOver={(e) => handleDriverDragOver(e, i)}
                        onDragLeave={handleDriverDragLeave}
                        onDragEnd={handleDriverDragEnd}
                        onDrop={(e) => handleDriverDrop(e, i)}
                        className="drag-row"
                        style={{
                          display: "grid",
                          gridTemplateColumns: "24px 1fr 140px 110px 100px",
                          gap: 12,
                          padding: "13px 20px",
                          borderBottom: i < visibleDrivers.length - 1 ? "1.5px solid #F8FAFC" : "none",
                          alignItems: "center",
                          backgroundColor: isDragOver
                            ? "rgba(37, 99, 235, 0.06)"
                            : isDragged
                            ? "rgba(241, 245, 249, 0.5)"
                            : "transparent",
                          opacity: isDragged ? 0.45 : 1,
                          outline: isDragOver ? "1.5px dashed #3B82F6" : "none",
                          outlineOffset: "-2px",
                          transform: isDragOver ? "scale(1.005)" : "none",
                          boxShadow: isDragged ? "0 4px 12px rgba(0,0,0,0.04)" : "none",
                        }}
                      >
                        <div className="drag-handle" style={{ display: "flex", alignItems: "center", color: "#94A3B8" }}>
                          <GripVertical size={13} style={{ cursor: "grab" }} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{driver.name}</div>
                        <div>
                          {driver.vehicle ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{driver.vehicle}</div>
                              {driver.vehicleModel && (
                                <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500, marginTop: 1 }}>{driver.vehicleModel}</div>
                              )}
                              {driver.vehicleType && (
                                <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>{driver.vehicleType}</div>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "#64748B", fontWeight: 400, fontStyle: "italic" }}>No vehicle assigned</span>
                          )}
                        </div>
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

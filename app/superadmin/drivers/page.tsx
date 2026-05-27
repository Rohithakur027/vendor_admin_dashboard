"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { superadminApi, type DriverApiItem } from "@/lib/api";
import { useDriverStatusFeed, type DriverStatusEvent } from "@/lib/useDriverStatusFeed";
import { Users, Navigation, CircleCheck, WifiOff, GripVertical } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FilterPanel,
  FilterSection,
  FilterPill,
  FilterTrigger,
} from "@/components/FilterPanel";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { ExportButton } from "@/components/ExportButton";
import { exportToXlsx } from "@/lib/exportXlsx";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";

const FONT = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "1.5px solid #E8EEF4",
  borderRadius: 16,
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
  fontFamily: FONT,
};

function StatCard({
  label, value, icon: Icon, sub, loading,
}: {
  label: string; value: number | string; icon: React.ElementType; sub?: string; loading?: boolean;
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

type StatusFilter = "All" | "Available" | "On Trip" | "Offline";

function formatDateStrings(iso: string) {
  try {
    const d = new Date(iso);
    const day  = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toLowerCase();
    return { day, time };
  } catch {
    return { day: "Unknown", time: "00:00 am" };
  }
}

function fmtPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return phone;
}

function fmtJoined(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function renderCell(key: string, d: DriverApiItem) {
  switch (key) {
    case "name":
      return (
        <div className="flex flex-col min-w-0">
          <span className="font-extrabold text-[#111827] text-[13.5px] truncate leading-snug">{d.name}</span>
          <span className="text-[11px] text-slate-400 font-medium mt-0.5">{d.driverRef ?? d.id.slice(0, 8)}</span>
        </div>
      );
    case "phone":
      return <span className="text-[13px] text-slate-600 font-medium">{fmtPhone(d.phone)}</span>;
    case "email":
      return <span className="text-[13px] text-slate-600 font-medium truncate">{d.email ?? "—"}</span>;
    case "status":
      return (
        <div className="flex flex-col gap-1 items-start">
          <StatusBadge status={d.isOnline ? "Online" : "Offline"} size="sm" />
          {d.isVerified && (
            <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
              ✓ Verified
            </span>
          )}
        </div>
      );
    case "zone":
      return <span className="text-[13px] text-slate-600 font-medium">{d.zone ?? "—"}</span>;
    case "vehicle": {
      const v = d.vehicle;
      return v ? (
        <div className="flex flex-col gap-px min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium text-slate-600 truncate">{v.plateNumber}</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-500 truncate">{v.model ?? "Unknown Model"}</span>
          {v.type && <span className="text-[10px] text-slate-400">{v.type}</span>}
        </div>
      ) : <span className="text-[13px] text-slate-300 italic">—</span>;
    }
    case "lastSeen":
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-slate-700">{formatDateStrings(d.lastActiveAt).day}</span>
          <span className="text-[11px] text-slate-400 font-medium">{formatDateStrings(d.lastActiveAt).time}</span>
        </div>
      );
    case "totalTrips":
      return <span className="text-[13px] font-semibold text-slate-700">{d.totalTrips}</span>;
    case "documents":
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-semibold text-slate-700">
            {d.documents.verified}<span className="text-slate-400 font-normal">/{d.documents.total}</span>
          </span>
          <span className="text-[10.5px] text-slate-400">verified</span>
        </div>
      );
    case "createdAt":
      return <span className="text-[13px] text-slate-600 font-medium">{fmtJoined(d.createdAt)}</span>;
    default:
      return <span className="text-[13px] text-slate-400">—</span>;
  }
}

function exportValue(key: string, d: DriverApiItem) {
  switch (key) {
    case "name":
      return d.name;
    case "phone":
      return d.phone;
    case "email":
      return d.email ?? null;
    case "status":
      return d.isOnline ? "Online" : "Offline";
    case "zone":
      return d.zone ?? null;
    case "vehicle":
      return [d.vehicle?.plateNumber, d.vehicle?.model, d.vehicle?.type].filter(Boolean).join(" | ");
    case "lastSeen":
      return d.lastActiveAt ? `${formatDateStrings(d.lastActiveAt).day} ${formatDateStrings(d.lastActiveAt).time}` : null;
    case "totalTrips":
      return d.totalTrips;
    case "documents":
      return `${d.documents.verified}/${d.documents.total}`;
    case "createdAt":
      return fmtJoined(d.createdAt);
    default:
      return null;
  }
}

export default function SuperAdminDriversPage() {
  const router = useRouter();

  const TABLE_KEY = "allDrivers" as const;
  const { columns: visibleCols, toggle: toggleCol, reset: resetCols, setColumns: setCols, totalCount: colTotal } = useColumnPreferences(TABLE_KEY);
  const spec = getTableSpec(TABLE_KEY);

  const gridTemplate = useMemo(
    () => `24px ${visibleCols.map(k => { const c = spec.columns.find(x => x.key === k); return c ? `minmax(${c.minWidth}px,1fr)` : "1fr"; }).join(" ")}`,
    [visibleCols, spec.columns],
  );
  const minTableWidth = useMemo(
    () => visibleCols.reduce((s, k) => s + (spec.columns.find(x => x.key === k)?.minWidth ?? 100), 0) + 80,
    [visibleCols, spec.columns],
  );

  const [drivers,      setDrivers]      = useState<DriverApiItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [filterOpen,   setFilterOpen]   = useState(false);

  // Custom ordering lists of IDs saved in localStorage
  const [driverOrder, setDriverOrder] = useState<(string | number)[]>([]);

  // Drag and drop local states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load order from localStorage on client-side mount
  useEffect(() => {
    try {
      const savedDrivers = localStorage.getItem("superadmin_all_drivers_order");
      if (savedDrivers) {
        setDriverOrder(JSON.parse(savedDrivers));
      }
    } catch (e) {
      console.error("Failed to load table orders from localStorage", e);
    }
  }, []);

  const activeFilterCount = statusFilter !== "All" ? 1 : 0;

  // Sort helper to apply saved custom order lists
  const applyCustomOrder = useCallback(
    <T extends { id: string | number }>(items: T[], orderIds: (string | number)[]): T[] => {
      if (!orderIds || orderIds.length === 0) return items;
      const orderMap = new Map<string | number, number>();
      orderIds.forEach((id, idx) => orderMap.set(id, idx));

      return [...items].sort((a, b) => {
        const aHas = orderMap.has(a.id);
        const bHas = orderMap.has(b.id);
        if (aHas && bHas) {
          return orderMap.get(a.id)! - orderMap.get(b.id)!;
        }
        if (aHas) return -1;
        if (bHas) return 1;
        return 0;
      });
    },
    []
  );

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await superadminApi.drivers.list({
        limit: 200,
        status: statusFilter !== "All" ? statusFilter : undefined,
      });
      setDrivers(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDrivers();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [fetchDrivers]);

  const onDriverStatus = useCallback((ev: DriverStatusEvent) => {
    setDrivers((prev) => {
      const idx = prev.findIndex((d) => d.id === ev.driver_id);
      if (idx === -1) {
        if (statusFilter !== "All" && ev.status === statusFilter) fetchDrivers();
        return prev;
      }
      if (statusFilter !== "All" && ev.status !== statusFilter) {
        return prev.filter((_, i) => i !== idx);
      }
      const next = prev.slice();
      next[idx] = { ...next[idx], isOnline: ev.is_online, status: ev.status, lastSeenAt: ev.last_seen_at };
      return next;
    });
  }, [statusFilter, fetchDrivers]);
  useDriverStatusFeed(onDriverStatus);

  const sortedDrivers = useMemo(() => {
    return applyCustomOrder(drivers, driverOrder);
  }, [drivers, driverOrder, applyCustomOrder]);

  const totalCt     = drivers.length;
  const onTripCt    = drivers.filter(d => d.status === "On Trip").length;
  const availableCt = drivers.filter(d => d.isOnline).length;
  const offlineCt   = drivers.filter(d => !d.isOnline).length;

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedDrivers;
    return sortedDrivers.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.phone.includes(q) ||
      (d.driverRef ?? "").toLowerCase().includes(q) ||
      (d.email ?? "").toLowerCase().includes(q) ||
      (d.zone ?? "").toLowerCase().includes(q) ||
      (d.vehicle?.plateNumber ?? "").toLowerCase().includes(q) ||
      (d.vehicle?.model ?? "").toLowerCase().includes(q)
    );
  }, [sortedDrivers, search]);

  // Drag-and-drop event handlers
  const handleDragStart = (
    e: React.DragEvent,
    index: number
  ) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (
    e: React.DragEvent,
    index: number
  ) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (
    e: React.DragEvent,
    targetIndex: number
  ) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      handleDragEnd();
      return;
    }

    const updatedFiltered = [...filteredDrivers];
    const [movedItem] = updatedFiltered.splice(draggedIndex, 1);
    updatedFiltered.splice(targetIndex, 0, movedItem);

    // Merge custom indices with remaining items
    const reorderedIds = updatedFiltered.map((item) => item.id);
    const remainingIds = drivers
      .map((item) => item.id)
      .filter((id) => !reorderedIds.includes(id));
    const newOrder = [...reorderedIds, ...remainingIds];

    setDriverOrder(newOrder);
    localStorage.setItem("superadmin_all_drivers_order", JSON.stringify(newOrder));

    handleDragEnd();
  };

  function handleExport() {
    const rows = filteredDrivers.map((d) => {
      const row: Record<string, string | number | null> = {};
      for (const key of visibleCols) {
        const col = spec.columns.find((c) => c.key === key);
        row[col?.label ?? key] = exportValue(key, d);
      }
      return row;
    });
    exportToXlsx("drivers", rows, "Drivers");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
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

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <StatCard loading={loading} label="Total Drivers"  value={totalCt}     icon={Users}       />
        <StatCard loading={loading} label="On Trip"        value={onTripCt}    icon={Navigation}  />
        <StatCard loading={loading} label="Online"         value={availableCt} icon={CircleCheck} />
        <StatCard loading={loading} label="Offline"        value={offlineCt}   icon={WifiOff}     />
      </div>

      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search by name, phone, email, vehicle…"
        />

        <div className="relative shrink-0">
          <FilterTrigger onClick={() => setFilterOpen(v => !v)} activeCount={activeFilterCount} />
          <FilterPanel
            open={filterOpen}
            onClose={() => setFilterOpen(false)}
            activeCount={activeFilterCount}
            onClearAll={() => setStatusFilter("All")}
          >
            <FilterSection label="Status">
              {(["All", "Available", "On Trip", "Offline"] as StatusFilter[]).map(s => (
                <FilterPill key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
              ))}
            </FilterSection>
          </FilterPanel>
        </div>

        <ColumnsPopover
          tableKey={TABLE_KEY}
          visible={visibleCols}
          totalCount={colTotal}
          onToggle={toggleCol}
          onReset={resetCols}
          onSelectAll={() => setCols(spec.columns.map((c) => c.key))}
        />

        <div className="ml-auto">
          <ExportButton onClick={handleExport} disabled={filteredDrivers.length === 0} label="Export XLSX" />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <div className="w-fit min-w-full" style={{ minWidth: minTableWidth }}>

            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 16, padding: "10px 28px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <div />
              {visibleCols.map(key => {
                const col = spec.columns.find(c => c.key === key);
                return (
                  <div key={key} style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    {col?.label ?? key}
                  </div>
                );
              })}
            </div>

            {/* Body */}
            <div className="flex flex-col divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: gridTemplate, gap: 16, padding: "14px 28px" }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#F1F5F9" }} />
                    {visibleCols.map(k => <Skeleton key={k} className="h-3.5 w-3/4" />)}
                  </div>
                ))
              ) : error ? (
                <div className="py-12 text-center text-sm text-red-500">{error}</div>
              ) : filteredDrivers.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm font-medium text-slate-500">No drivers found.</p>
                </div>
              ) : (
                filteredDrivers.map((d, i) => {
                  const isDragged = draggedIndex === i;
                  const isDragOver = dragOverIndex === i;

                  return (
                    <div
                      key={d.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDragLeave={handleDragLeave}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, i)}
                      onClick={() => router.push(`/superadmin/drivers/${d.id}`)}
                      className="drag-row"
                      style={{
                        display: "grid",
                        gridTemplateColumns: gridTemplate,
                        gap: 16,
                        padding: "13px 28px",
                        alignItems: "center",
                        cursor: "grab",
                        userSelect: "none",
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
                      {visibleCols.map(key => (
                        <div key={key}>{renderCell(key, d)}</div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useVendor } from "@/context/VendorContext";
import { DriverTable } from "@/modules/drivers/components/DriverTable";
import { DriverFilters } from "@/modules/drivers/components/DriverFilters";
import { SkeletonInline } from "@/components/ui/skeleton";
import type { DriverStatus } from "@/modules/drivers/types";
import { Info } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { exportToCsv } from "@/lib/exportCsv";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";

const TABLE_KEY = "drivers" as const;

export default function DriversPage() {
  const { drivers, isLoading, apiCounts } = useVendor();
  const { columns: visibleCols, toggle, reset, totalCount, loading: prefsLoading } = useColumnPreferences(TABLE_KEY);
  const spec = getTableSpec(TABLE_KEY);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DriverStatus | "All">("All");

  const filtered = drivers.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search);
    const matchesStatus = statusFilter === "All" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const apiInFiltered = filtered.filter((d) => {
    const idx = drivers.findIndex((x) => x.id === d.id);
    return idx < apiCounts.drivers;
  }).length;
  const splitAt = apiInFiltered > 0 && apiInFiltered < filtered.length ? apiInFiltered : undefined;

  const gridTemplate = useMemo(() =>
    visibleCols.map(key => {
      const col = spec.columns.find(c => c.key === key);
      return col ? `minmax(${col.minWidth}px, 1fr)` : "1fr";
    }).join(" "),
    [visibleCols, spec.columns],
  );

  const minTableWidth = useMemo(
    () => visibleCols.reduce((sum, k) => sum + (spec.columns.find(c => c.key === k)?.minWidth ?? 100), 0) + 48,
    [visibleCols, spec.columns],
  );

  function handleExport() {
    const rows = filtered.map((d) => ({
      "Driver ID":                   d.driverRef ?? d.id,
      "Name":                        d.name,
      "Phone":                       d.phone,
      "Status":                      d.status,
      "Supervisor":                  d.assignedSupervisorName ?? "",
      "Vehicle":                     d.vehicle ?? "",
      "Vehicle Registration Number": d.vehicleReg ?? "",
      "Total Trips":                 d.totalTrips,
      "Last Active":                 d.lastActive ? new Date(d.lastActive).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase() : "",
    }));
    exportToCsv("drivers", rows);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Drivers</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading ? <SkeletonInline className="h-3 w-8" /> : drivers.length} associated drivers
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
          <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          Read-only view. Drivers are independent and cannot be added or deleted.
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <DriverFilters
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        </div>
        <ColumnsPopover tableKey={TABLE_KEY} visible={visibleCols} totalCount={totalCount} onToggle={toggle} onReset={reset} />
        <ExportButton onClick={handleExport} disabled={isLoading || filtered.length === 0} />
      </div>

      <DriverTable
        drivers={filtered}
        splitAt={splitAt}
        loading={isLoading}
        visibleCols={visibleCols}
        gridTemplate={gridTemplate}
        minTableWidth={minTableWidth}
        prefsLoading={prefsLoading}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useVendor } from "@/context/VendorContext";
import { DriverTable } from "@/modules/drivers/components/DriverTable";
import { DriverFilters } from "@/modules/drivers/components/DriverFilters";
import { Skeleton, SkeletonInline } from "@/components/ui/skeleton";
import type { DriverStatus } from "@/modules/drivers/types";
import { Info } from "lucide-react";

export default function DriversPage() {
  const { drivers, isLoading, apiCounts } = useVendor();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DriverStatus | "All">("All");

  const filtered = drivers.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search);
    const matchesStatus = statusFilter === "All" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Count how many API items made it through the filter — that's where the separator goes
  const apiInFiltered = filtered.filter((d) => {
    const idx = drivers.findIndex((x) => x.id === d.id);
    return idx < apiCounts.drivers;
  }).length;
  const splitAt = apiInFiltered > 0 && apiInFiltered < filtered.length ? apiInFiltered : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Drivers</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              <SkeletonInline className="h-3 w-8" />
            ) : (
              drivers.length
            )} associated drivers
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg">
          <Info className="h-3.5 w-3.5 text-blue-500 shrink-0" />
          Read-only view. Drivers are independent and cannot be added or deleted.
        </div>
      </div>

      <DriverFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <DriverTable drivers={filtered} splitAt={splitAt} loading={isLoading} />
    </div>
  );
}

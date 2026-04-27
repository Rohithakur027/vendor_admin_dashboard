"use client";

import { useState } from "react";
import { useVendor } from "@/context/VendorContext";
import { DriverTable } from "@/modules/drivers/components/DriverTable";
import { DriverFilters } from "@/modules/drivers/components/DriverFilters";
import { Skeleton } from "@/components/ui/skeleton";
import type { DriverStatus } from "@/modules/drivers/types";
import { Info } from "lucide-react";

function DriversSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-72 rounded-lg" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/50 flex gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
        <div className="flex flex-col divide-y divide-slate-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-6 py-4">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DriversPage() {
  const { drivers, isLoading, apiCounts } = useVendor();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<DriverStatus | "All">("All");

  if (isLoading) return <DriversSkeleton />;

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
          <p className="text-sm text-muted-foreground">{drivers.length} associated drivers</p>
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

      <DriverTable drivers={filtered} splitAt={splitAt} />
    </div>
  );
}

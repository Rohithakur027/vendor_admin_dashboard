"use client";

import { useState } from "react";
import { useVendor } from "@/context/VendorContext";
import { SupervisorTable } from "@/modules/supervisors/components/SupervisorTable";
import { SupervisorDrawer } from "@/modules/supervisors/components/SupervisorDrawer";
import { SupervisorFilters } from "@/modules/supervisors/components/SupervisorFilters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import type { Supervisor, SupervisorFormData, SupervisorStatus } from "@/modules/supervisors/types";

function SupervisorsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/50 flex gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-20" />
          ))}
        </div>
        <div className="flex flex-col divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-6 py-4">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SupervisorsPage() {
  const { supervisors, addSupervisor, updateSupervisor, deleteSupervisor, isLoading, apiCounts } = useVendor();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supervisor | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupervisorStatus | "All">("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  if (isLoading) return <SupervisorsSkeleton />;

  const hasDateFilter = !!(dateFrom || dateTo);

  // Per-supervisor wallet consumed and booking count for the selected date range
  const walletConsumedMap: Record<string, number> = {};
  const bookingCountMap: Record<string, number>   = {};
  for (const sup of supervisors) {
    if (!hasDateFilter) {
      walletConsumedMap[sup.id] = sup.walletUsed;
      bookingCountMap[sup.id]   = sup.dailyHistory.reduce((s, d) => s + d.bookings, 0);
    } else {
      const inRange = sup.dailyHistory.filter(
        (d) => (!dateFrom || d.date >= dateFrom) && (!dateTo || d.date <= dateTo)
      );
      walletConsumedMap[sup.id] = inRange.reduce((s, d) => s + d.amount,   0);
      bookingCountMap[sup.id]   = inRange.reduce((s, d) => s + d.bookings, 0);
    }
  }

  const filtered = supervisors.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const apiInFiltered = filtered.filter((s) => {
    const idx = supervisors.findIndex((x) => x.id === s.id);
    return idx < apiCounts.supervisors;
  }).length;
  const splitAt = apiInFiltered > 0 && apiInFiltered < filtered.length ? apiInFiltered : undefined;

  function handleEdit(supervisor: Supervisor) {
    setEditTarget(supervisor);
    setDrawerOpen(true);
  }

  async function handleSubmit(data: SupervisorFormData): Promise<void> {
    if (editTarget) {
      updateSupervisor(editTarget.id, {
        name:        data.name,
        email:       data.email,
        phone:       data.phone,
        status:      data.status,
        walletLimit: data.walletLimit,
        companies:   data.companies,
      });
      return;
    }
    await addSupervisor(data);
  }

  function handleDrawerClose() {
    setDrawerOpen(false);
    setEditTarget(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Supervisors</h2>
          <p className="text-sm text-muted-foreground">{supervisors.length} total supervisors</p>
        </div>
        <Button
          onClick={() => { setEditTarget(null); setDrawerOpen(true); }}
          className="bg-blue-600 hover:bg-blue-700 gap-2 rounded-xl px-5 h-10 text-[13px] font-semibold"
        >
          <span className="flex items-center justify-center h-5 w-5 rounded-full border border-white/50 shrink-0">
            <Plus className="h-3 w-3" />
          </span>
          Add Supervisor
        </Button>
      </div>

      <SupervisorFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
      />

      <SupervisorTable
        supervisors={filtered}
        onEdit={handleEdit}
        onDelete={deleteSupervisor}
        walletConsumedMap={walletConsumedMap}
        bookingCountMap={bookingCountMap}
        hasDateFilter={hasDateFilter}
        splitAt={splitAt}
      />

      <SupervisorDrawer
        open={drawerOpen}
        onClose={handleDrawerClose}
        onSubmit={handleSubmit}
        editData={editTarget}
      />
    </div>
  );
}

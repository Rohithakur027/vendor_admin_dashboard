"use client";

import { useState } from "react";
import { useVendor } from "@/context/VendorContext";
import { SupervisorTable } from "@/modules/supervisors/components/SupervisorTable";
import { SupervisorDrawer } from "@/modules/supervisors/components/SupervisorDrawer";
import { SupervisorFilters } from "@/modules/supervisors/components/SupervisorFilters";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonInline } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import type { Supervisor, SupervisorFormData, SupervisorStatus } from "@/modules/supervisors/types";

export default function SupervisorsPage() {
  const { supervisors, addSupervisor, updateSupervisor, deleteSupervisor, isLoading, apiCounts } = useVendor();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supervisor | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupervisorStatus | "All">("All");

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
        name:      data.name,
        email:     data.email,
        phone:     data.phone,
        status:    data.status,
        companies: data.companies,
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Supervisors</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading ? (
              <SkeletonInline className="h-3 w-8" />
            ) : (
              supervisors.length
            )} total supervisors
          </p>
        </div>
        <Button
          onClick={() => { setEditTarget(null); setDrawerOpen(true); }}
          disabled={isLoading}
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
      />

      <SupervisorTable
        supervisors={filtered}
        onEdit={handleEdit}
        onDelete={deleteSupervisor}
        splitAt={splitAt}
        loading={isLoading}
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

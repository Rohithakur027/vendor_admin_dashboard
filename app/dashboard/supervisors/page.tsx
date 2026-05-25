"use client";

import { useMemo, useState } from "react";
import { useVendor } from "@/context/VendorContext";
import { SupervisorTable } from "@/modules/supervisors/components/SupervisorTable";
import { SupervisorDrawer } from "@/modules/supervisors/components/SupervisorDrawer";
import { SupervisorFilters } from "@/modules/supervisors/components/SupervisorFilters";
import { Button } from "@/components/ui/button";
import { SkeletonInline } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import type { Supervisor, SupervisorFormData, SupervisorStatus } from "@/modules/supervisors/types";
import { ExportButton } from "@/components/ExportButton";
import { exportToCsv } from "@/lib/exportCsv";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";

const TABLE_KEY = "supervisors" as const;

export default function SupervisorsPage() {
  const { supervisors, addSupervisor, updateSupervisor, deleteSupervisor, isLoading, apiCounts } = useVendor();
  const { columns: visibleCols, toggle, reset, totalCount, loading: prefsLoading } = useColumnPreferences(TABLE_KEY);
  const spec = getTableSpec(TABLE_KEY);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supervisor | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupervisorStatus | "All">("All");

  const filtered = supervisors.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.phone ?? "").toLowerCase().includes(q);
    const matchesStatus = statusFilter === "All" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const apiInFiltered = filtered.filter((s) => {
    const idx = supervisors.findIndex((x) => x.id === s.id);
    return idx < apiCounts.supervisors;
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

  function handleEdit(supervisor: Supervisor) {
    setEditTarget(supervisor);
    setDrawerOpen(true);
  }

  async function handleSubmit(data: SupervisorFormData): Promise<void> {
    if (editTarget) {
      updateSupervisor(editTarget.id, {
        name: data.name, email: data.email, phone: data.phone,
        status: data.status, companies: data.companies,
      });
      return;
    }
    await addSupervisor(data);
  }

  function handleDrawerClose() {
    setDrawerOpen(false);
    setEditTarget(null);
  }

  function handleExport() {
    const rows = filtered.map((s) => ({
      "Supervisor ID": s.ref ?? "",
      "Name":    s.name,
      "Email":   s.email,
      "Phone":   s.phone,
      "Status":  s.status,
      "Zone":    s.zone ?? "",
      "Wallet Used": s.walletUsed ?? 0,
      "Joined On":   s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-IN") : "",
    }));
    exportToCsv("supervisors", rows);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Supervisors</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading ? <SkeletonInline className="h-3 w-8" /> : supervisors.length} total supervisors
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

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <SupervisorFilters
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
          />
        </div>
        <ExportButton onClick={handleExport} disabled={isLoading || filtered.length === 0} />
      </div>

      <SupervisorTable
        supervisors={filtered}
        onEdit={handleEdit}
        onDelete={deleteSupervisor}
        splitAt={splitAt}
        loading={isLoading}
        visibleCols={visibleCols}
        gridTemplate={gridTemplate}
        minTableWidth={minTableWidth}
        prefsLoading={prefsLoading}
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

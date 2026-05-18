"use client";

import { useState, useEffect } from "react";
import { SearchBar } from "@/components/SearchBar";
import {
  FilterPanel,
  FilterSection,
  FilterPill,
  FilterTrigger,
} from "@/components/FilterPanel";
import type { SupervisorStatus } from "../types";

interface SupervisorFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: SupervisorStatus | "All";
  onStatusFilterChange: (v: SupervisorStatus | "All") => void;
}

const STATUS_OPTIONS: SupervisorStatus[] = ["Active", "Inactive"];

export function SupervisorFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: SupervisorFiltersProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [pending, setPending] = useState<SupervisorStatus | "All">(statusFilter);

  // Sync pending state when panel opens
  useEffect(() => {
    if (filterOpen) setPending(statusFilter);
  }, [filterOpen, statusFilter]);

  const activeCount = statusFilter !== "All" ? 1 : 0;

  function handleApply() {
    onStatusFilterChange(pending);
    setFilterOpen(false);
  }

  function handleCancel() {
    setPending(statusFilter);
    setFilterOpen(false);
  }

  function handleClearAll() {
    setPending("All");
    onStatusFilterChange("All");
    setFilterOpen(false);
  }

  return (
    <div className="flex gap-3 items-center">
      <SearchBar
        value={search}
        onChange={onSearchChange}
        placeholder="Search by name or email…"
      />
      <div className="relative shrink-0">
        <FilterTrigger
          onClick={() => setFilterOpen((v) => !v)}
          activeCount={activeCount}
        />
        <FilterPanel
          open={filterOpen}
          onClose={handleCancel}
          activeCount={activeCount}
          onClearAll={handleClearAll}
          onApply={handleApply}
          onCancel={handleCancel}
        >
          <FilterSection label="Status">
            {STATUS_OPTIONS.map((s) => (
              <FilterPill
                key={s}
                label={s}
                active={pending === s}
                onClick={() => setPending(pending === s ? "All" : s)}
              />
            ))}
          </FilterSection>
        </FilterPanel>
      </div>
    </div>
  );
}

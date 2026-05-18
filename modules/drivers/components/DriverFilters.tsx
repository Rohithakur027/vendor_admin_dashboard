"use client";

import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import {
  FilterPanel,
  FilterSection,
  FilterPill,
  FilterTrigger,
} from "@/components/FilterPanel";
import type { DriverStatus } from "../types";

interface DriverFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: DriverStatus | "All";
  onStatusFilterChange: (v: DriverStatus | "All") => void;
}

const STATUS_OPTIONS: DriverStatus[] = ["Available", "On Trip", "Offline"];

export function DriverFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: DriverFiltersProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  const activeCount = statusFilter !== "All" ? 1 : 0;

  return (
    <div className="flex gap-3 items-center">
      <SearchBar
        value={search}
        onChange={onSearchChange}
        placeholder="Search by name or phone…"
      />
      <div className="relative shrink-0">
        <FilterTrigger
          onClick={() => setFilterOpen((v) => !v)}
          activeCount={activeCount}
        />
        <FilterPanel
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          activeCount={activeCount}
          onClearAll={() => onStatusFilterChange("All")}
        >
          <FilterSection label="Status">
            {STATUS_OPTIONS.map((s) => (
              <FilterPill
                key={s}
                label={s}
                active={statusFilter === s}
                onClick={() => onStatusFilterChange(statusFilter === s ? "All" : s)}
              />
            ))}
          </FilterSection>
        </FilterPanel>
      </div>
    </div>
  );
}

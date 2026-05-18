"use client";

import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import {
  FilterPanel,
  FilterSection,
  FilterPill,
  FilterTrigger,
} from "@/components/FilterPanel";
import type { BookingType, BookingStatus } from "../types";
import type { Supervisor } from "@/modules/supervisors/types";

interface BookingFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  typeFilter: BookingType | "All";
  onTypeChange: (v: BookingType | "All") => void;
  statusFilter: BookingStatus | "All";
  onStatusChange: (v: BookingStatus | "All") => void;
  supervisorFilter: string;
  onSupervisorChange: (v: string) => void;
  supervisors: Supervisor[];
}

const TYPE_OPTIONS: BookingType[] = ["Instant", "Scheduled"];
const STATUS_OPTIONS: BookingStatus[] = ["Pending", "Ongoing", "Completed", "Cancelled"];

export function BookingFilters({
  search,
  onSearchChange,
  typeFilter,
  onTypeChange,
  statusFilter,
  onStatusChange,
  supervisorFilter,
  onSupervisorChange,
  supervisors,
}: BookingFiltersProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  const activeCount =
    (typeFilter !== "All" ? 1 : 0) +
    (statusFilter !== "All" ? 1 : 0) +
    (supervisorFilter !== "All" ? 1 : 0);

  function handleClearAll() {
    onTypeChange("All");
    onStatusChange("All");
    onSupervisorChange("All");
  }

  return (
    <div className="flex gap-3 items-center flex-wrap">
      <SearchBar
        value={search}
        onChange={onSearchChange}
        placeholder="Search by ID or location…"
        className="flex-1 min-w-48"
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
          onClearAll={handleClearAll}
        >
          <FilterSection label="Type">
            {TYPE_OPTIONS.map((t) => (
              <FilterPill
                key={t}
                label={t}
                active={typeFilter === t}
                onClick={() => onTypeChange(typeFilter === t ? "All" : t)}
              />
            ))}
          </FilterSection>
          <FilterSection label="Status">
            {STATUS_OPTIONS.map((s) => (
              <FilterPill
                key={s}
                label={s}
                active={statusFilter === s}
                onClick={() => onStatusChange(statusFilter === s ? "All" : s)}
              />
            ))}
          </FilterSection>
          {supervisors.length > 0 && (
            <FilterSection label="Supervisor">
              {supervisors.map((sv) => (
                <FilterPill
                  key={sv.id}
                  label={sv.name}
                  active={supervisorFilter === sv.id}
                  onClick={() => onSupervisorChange(supervisorFilter === sv.id ? "All" : sv.id)}
                />
              ))}
            </FilterSection>
          )}
        </FilterPanel>
      </div>
    </div>
  );
}

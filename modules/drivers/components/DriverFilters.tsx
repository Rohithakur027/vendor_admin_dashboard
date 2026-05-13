"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import type { DriverStatus } from "../types";

interface DriverFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: DriverStatus | "All";
  onStatusFilterChange: (v: DriverStatus | "All") => void;
}

export function DriverFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}: DriverFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoComplete="off"
          placeholder="Search by name or phone…"
          className="pl-9"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Select
        value={statusFilter}
        onValueChange={(v) => onStatusFilterChange(v as DriverStatus | "All")}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All">All Statuses</SelectItem>
          <SelectItem value="Available">Available</SelectItem>
          <SelectItem value="On Trip">On Trip</SelectItem>
          <SelectItem value="Offline">Offline</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

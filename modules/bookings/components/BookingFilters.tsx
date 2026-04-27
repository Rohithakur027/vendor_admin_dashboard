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
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative flex-1 min-w-48">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by ID or location…"
          className="pl-9"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Select value={typeFilter} onValueChange={(v) => onTypeChange(v as BookingType | "All")}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All">All Types</SelectItem>
          <SelectItem value="Instant">Instant</SelectItem>
          <SelectItem value="Scheduled">Scheduled</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={(v) => onStatusChange(v as BookingStatus | "All")}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All">All Statuses</SelectItem>
          <SelectItem value="Pending">Pending</SelectItem>
          <SelectItem value="Ongoing">Ongoing</SelectItem>
          <SelectItem value="Completed">Completed</SelectItem>
          <SelectItem value="Cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>
      <Select value={supervisorFilter} onValueChange={(v) => onSupervisorChange(v ?? "All")}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Supervisor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="All">All Supervisors</SelectItem>
          {supervisors.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

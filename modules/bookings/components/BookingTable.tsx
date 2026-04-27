"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import type { Booking, BookingStatus, BookingType } from "../types";
import { StatusBadge } from "@/components/StatusBadge";

interface BookingTableProps {
  bookings: Booking[];
  onRowClick: (booking: Booking) => void;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BookingTable({ bookings, onRowClick }: BookingTableProps) {
  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="w-24">ID</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="hidden sm:table-cell">Supervisor</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead className="hidden lg:table-cell">Route</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bookings.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                No bookings found.
              </TableCell>
            </TableRow>
          )}
          {bookings.map((booking) => (
            <TableRow
              key={booking.id}
              className="cursor-pointer hover:bg-blue-50/50"
              onClick={() => onRowClick(booking)}
            >
              <TableCell className="font-mono text-xs text-muted-foreground">
                {booking.id}
              </TableCell>
              <TableCell>
                <StatusBadge status={booking.type} size="sm" />
              </TableCell>
              <TableCell className="hidden sm:table-cell text-sm">
                {booking.supervisorName}
              </TableCell>
              <TableCell className="text-sm">
                {booking.driverName ?? (
                  <span className="text-muted-foreground italic">Awaiting</span>
                )}
              </TableCell>
              <TableCell className="hidden lg:table-cell max-w-[220px]">
                <div className="flex flex-col gap-px min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{booking.pickupLocation}</p>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-14 h-[2px] rounded-full"
                      style={{ background: "linear-gradient(to right, #A5B4FC, #2563EB)" }}
                    />
                    <ArrowRight className="h-3 w-3 text-blue-600 shrink-0" />
                  </div>
                  <p className="text-sm text-gray-500 truncate">{booking.dropLocation}</p>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={booking.status} size="sm" />
              </TableCell>
              <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                {formatDate(booking.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

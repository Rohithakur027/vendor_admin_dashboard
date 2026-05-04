"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Phone, MapPin, Calendar, User } from "lucide-react";
import type { Driver, DriverStatus } from "../types";
import { StatusBadge } from "@/components/StatusBadge";

interface DriverDetailPanelProps {
  driver: Driver | null;
  onClose: () => void;
}

export function DriverDetailPanel({ driver, onClose }: DriverDetailPanelProps) {
  if (!driver) return null;

  return (
    <Dialog open={!!driver} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">{driver.name}</DialogTitle>
          <DialogDescription>Driver profile and recent activity</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <StatusBadge status={driver.status} size="sm" />
            <span className="text-sm text-muted-foreground">{driver.totalTrips} trips completed</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" />
              <span>{driver.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4 shrink-0" />
              <span>{driver.assignedSupervisorName ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground col-span-2">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Last active: {new Date(driver.lastActive).toLocaleString()}</span>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-sm font-semibold mb-3">Recent Trips</p>
            {driver.recentTrips.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent trips.</p>
            ) : (
              <div className="space-y-3">
                {driver.recentTrips.map((trip) => (
                  <div key={trip.bookingId} className="bg-gray-50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">{trip.tripRef ?? trip.bookingId}</span>
                      <span className="text-xs text-muted-foreground">{trip.date}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 text-green-600 shrink-0" />
                      <span className="text-sm">{trip.from}</span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 text-red-500 shrink-0" />
                      <span className="text-sm">{trip.to}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Supervisor: {trip.supervisorName}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

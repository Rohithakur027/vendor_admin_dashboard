"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/StatusBadge";
import type { Booking } from "./types";

export const EM_DASH = "—";

export function formatDateStrings(iso: string | null | undefined) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return {
      day:  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }),
      time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }).toLowerCase(),
    };
  } catch { return { day: "Unknown", time: "" }; }
}

export function formatIST(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

export interface DriverInfo {
  name:        string | null;
  vehicle:     string | null;
  vehicleReg:  string | null;
  vehicleType: string | null;
  phone:       string | null;
}

export function buildTripRenderers(
  supervisorName: (id: string | null | undefined) => string,
  driverFor:      (b: Booking) => DriverInfo,
) {
  return {
    tripId: {
      header:   () => "TRIP ID & TYPE",
      body:     (b: Booking) => (
        <div className="flex flex-col items-start gap-1 min-w-0">
          <span className="font-extrabold text-[#111827] text-[13px] truncate" title={b.bookingRef ?? ""}>
            {b.bookingRef ?? EM_DASH}
          </span>
          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-[#eef2ff] text-blue-600 text-[10px] font-bold ring-1 ring-inset ring-blue-100/50">
            {b.type ?? EM_DASH}
          </span>
        </div>
      ),
      skeleton: () => (<div className="space-y-2"><Skeleton className="h-3.5 w-16" /><Skeleton className="h-4 w-12 rounded" /></div>),
      csv:      (b: Booking) => `${b.bookingRef ?? ""}${b.type ? ` · ${b.type}` : ""}`,
    },
    route: {
      header:   () => "ROUTE",
      body:     (b: Booking) => (
        <div className="flex flex-col min-w-0 pr-4 gap-px">
          <span className="font-semibold text-[13px] text-slate-800 leading-tight truncate" title={b.pickupLocation}>
            {b.pickupLocation.split(",")[0]}
          </span>
          <div className="flex items-center gap-1">
            <div className="w-14 h-[2px] rounded-full" style={{ background: "linear-gradient(to right, #A5B4FC, #2563EB)" }} />
            <ArrowRight className="h-3 w-3 text-blue-600 shrink-0" />
          </div>
          <span className="text-[12px] text-gray-500 truncate" title={b.dropLocation}>
            {b.dropLocation.split(",")[0]}
          </span>
        </div>
      ),
      skeleton: () => (<div className="space-y-1.5 pr-4"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3 w-2/3" /></div>),
      csv:      (b: Booking) => `${b.pickupLocation} → ${b.dropLocation}`,
    },
    supervisorCompany: {
      header:   () => "SUPERVISOR & COMPANY",
      body:     (b: Booking) => {
        const sup = supervisorName(b.supervisorId);
        return (
          <div className="flex flex-col items-start gap-1 min-w-0">
            <span className="text-[13px] font-medium text-slate-600 truncate" title={sup}>{sup || EM_DASH}</span>
            {b.bookingSource ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 border border-slate-300 text-[11px] font-semibold truncate max-w-[110px]" title={b.bookingSource}>
                {b.bookingSource}
              </span>
            ) : <span className="text-[11px] text-slate-300 italic">{EM_DASH}</span>}
          </div>
        );
      },
      skeleton: () => (<div className="space-y-1.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3 w-20" /></div>),
      csv:      (b: Booking) => `${supervisorName(b.supervisorId)}${b.bookingSource ? ` · ${b.bookingSource}` : ""}`,
    },
    vehicle: {
      header:   () => "VEHICLE",
      body:     (b: Booking) => {
        const d = driverFor(b);
        if (!d.vehicleReg && !d.vehicle) return <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
        return (
          <div className="flex flex-col gap-px min-w-0">
            <span className="text-[13px] font-medium text-slate-600 truncate" title={d.vehicleReg ?? d.vehicle ?? ""}>
              {d.vehicleReg || d.vehicle}
            </span>
            {d.vehicleReg && d.vehicle && (
              <span className="text-[11px] font-semibold text-slate-500 truncate">{d.vehicle}</span>
            )}
            {d.vehicleType && (
              <span className="text-[11px] font-medium text-slate-500 truncate">{d.vehicleType}</span>
            )}
          </div>
        );
      },
      skeleton: () => (<div className="space-y-1.5"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-3 w-16" /><Skeleton className="h-2.5 w-12" /></div>),
      csv:      (b: Booking) => {
        const d = driverFor(b);
        return [d.vehicleReg, d.vehicle].filter(Boolean).join(" · ");
      },
    },
    driver: {
      header:   () => "DRIVER",
      body:     (b: Booking) => {
        const d = driverFor(b);
        return d.name
          ? <span className="text-[13px] font-medium text-slate-600 truncate block" title={d.name}>{d.name}</span>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => (<div className="space-y-1.5"><Skeleton className="h-3.5 w-24" /></div>),
      csv:      (b: Booking) => driverFor(b).name ?? "",
    },
    status: {
      header:   () => "STATUS",
      body:     (b: Booking) => <StatusBadge status={b.status} size="sm" />,
      skeleton: () => <Skeleton className="h-6 w-20 rounded-full" />,
      csv:      (b: Booking) => b.status,
    },
    pickupTime: {
      header:   () => "PICKUP TIME",
      body:     (b: Booking) => {
        const f = formatDateStrings(b.pickupTime);
        return f
          ? <div className="flex flex-col"><span className="text-[13px] font-medium text-slate-700">{f.day}</span><span className="text-[11px] text-slate-400 mt-0.5">{f.time}</span></div>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
      csv:      (b: Booking) => formatIST(b.pickupTime) ?? "",
    },
    scheduledAt: {
      header:   () => "SCHEDULED AT",
      body:     (b: Booking) => {
        const f = formatDateStrings(b.scheduledTime);
        return f
          ? <div className="flex flex-col"><span className="text-[13px] font-medium text-slate-700">{f.day}</span><span className="text-[11px] text-slate-400 mt-0.5">{f.time}</span></div>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
      csv:      (b: Booking) => formatIST(b.scheduledTime) ?? "",
    },
    createdAt: {
      header:   () => "CREATED AT",
      body:     (b: Booking) => {
        const f = formatDateStrings(b.createdAt);
        return f
          ? <div className="flex flex-col"><span className="text-[13px] font-medium text-slate-700">{f.day}</span><span className="text-[11px] text-slate-400 mt-0.5">{f.time}</span></div>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
      csv:      (b: Booking) => formatIST(b.createdAt) ?? "",
    },
    completedAt: {
      header:   () => "COMPLETED AT",
      body:     (b: Booking) => {
        const f = formatDateStrings(b.completedAt);
        return f
          ? <div className="flex flex-col"><span className="text-[13px] font-medium text-slate-700">{f.day}</span><span className="text-[11px] text-slate-400 mt-0.5">{f.time}</span></div>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
      csv:      (b: Booking) => formatIST(b.completedAt) ?? "",
    },
    startedAt: {
      header:   () => "STARTED AT",
      body:     (b: Booking) => {
        const startedAt = (b as Booking & { startedAt?: string | null }).startedAt;
        const f = formatDateStrings(startedAt);
        return f
          ? <div className="flex flex-col"><span className="text-[13px] font-medium text-slate-700">{f.day}</span><span className="text-[11px] text-slate-400 mt-0.5">{f.time}</span></div>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => (<div className="space-y-1"><Skeleton className="h-3.5 w-14" /><Skeleton className="h-3 w-12" /></div>),
      csv:      (b: Booking) => formatIST((b as Booking & { startedAt?: string | null }).startedAt) ?? "",
    },
    fare: {
      header:   () => "FARE",
      body:     (b: Booking) => b.fare != null
        ? <span className="text-[13px] font-bold text-slate-800 tabular-nums">₹{Number(b.fare).toLocaleString("en-IN")}</span>
        : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>,
      skeleton: () => <Skeleton className="h-3.5 w-16" />,
      csv:      (b: Booking) => b.fare ?? "",
    },
    passengers: {
      header:   () => "PASSENGERS",
      body:     (b: Booking) => b.passengers != null
        ? <span className="text-[13px] text-slate-700 tabular-nums">{b.passengers}</span>
        : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>,
      skeleton: () => <Skeleton className="h-3.5 w-8" />,
      csv:      (b: Booking) => b.passengers ?? "",
    },
    distance: {
      header:   () => "DISTANCE",
      body:     (b: Booking) => {
        const dist = (b as Booking & { distanceKm?: number | null }).distanceKm;
        return dist != null
          ? <span className="text-[13px] text-slate-700 tabular-nums">{Number(dist).toFixed(1)} km</span>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => <Skeleton className="h-3.5 w-14" />,
      csv:      (b: Booking) => (b as Booking & { distanceKm?: number | null }).distanceKm ?? "",
    },
    escort: {
      header:   () => "ESCORT",
      body:     (b: Booking) => {
        const escort = (b as Booking & { escortRequired?: boolean; escortPickup?: string | null });
        if (!escort.escortRequired) return <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
        return (
          <div className="flex flex-col gap-px min-w-0">
            <span className="text-[12px] font-semibold text-amber-700">Required</span>
            {escort.escortPickup && (
              <span className="text-[11px] text-slate-500 truncate" title={escort.escortPickup}>{escort.escortPickup}</span>
            )}
          </div>
        );
      },
      skeleton: () => <Skeleton className="h-3.5 w-16" />,
      csv:      (b: Booking) => {
        const escort = (b as Booking & { escortRequired?: boolean; escortPickup?: string | null });
        return escort.escortRequired ? `Required${escort.escortPickup ? ` · ${escort.escortPickup}` : ""}` : "";
      },
    },
    notes: {
      header:   () => "NOTES",
      body:     (b: Booking) => {
        const notes = (b as Booking & { notes?: string | null }).notes;
        return notes
          ? <span className="text-[12px] text-slate-600 truncate block" title={notes}>{notes}</span>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => <Skeleton className="h-3.5 w-24" />,
      csv:      (b: Booking) => (b as Booking & { notes?: string | null }).notes ?? "",
    },
    invoice: {
      header:   () => "INVOICE",
      body:     (b: Booking) => {
        const inv = (b as Booking & { invoiceId?: string | null }).invoiceId;
        return inv
          ? <span className="text-[12px] font-mono text-slate-600 truncate block" title={inv}>{inv.slice(0, 8)}</span>
          : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>;
      },
      skeleton: () => <Skeleton className="h-3.5 w-16" />,
      csv:      (b: Booking) => (b as Booking & { invoiceId?: string | null }).invoiceId ?? "",
    },
    pickupLatLng: {
      header:   () => "PICKUP LAT/LNG",
      body:     (b: Booking) => b.pickupLat != null && b.pickupLng != null
        ? (
          <div className="flex flex-col gap-px font-mono tabular-nums">
            <span className="text-[12px] text-slate-700">{b.pickupLat.toFixed(6)}</span>
            <span className="text-[11px] text-slate-400">{b.pickupLng.toFixed(6)}</span>
          </div>
        )
        : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>,
      skeleton: () => (<div className="space-y-1"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /></div>),
      csv:      (b: Booking) => b.pickupLat != null && b.pickupLng != null ? `${b.pickupLat},${b.pickupLng}` : "",
    },
    dropLatLng: {
      header:   () => "DROP LAT/LNG",
      body:     (b: Booking) => b.dropLat != null && b.dropLng != null
        ? (
          <div className="flex flex-col gap-px font-mono tabular-nums">
            <span className="text-[12px] text-slate-700">{b.dropLat.toFixed(6)}</span>
            <span className="text-[11px] text-slate-400">{b.dropLng.toFixed(6)}</span>
          </div>
        )
        : <span className="text-[13px] text-slate-300 italic">{EM_DASH}</span>,
      skeleton: () => (<div className="space-y-1"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-20" /></div>),
      csv:      (b: Booking) => b.dropLat != null && b.dropLng != null ? `${b.dropLat},${b.dropLng}` : "",
    },
  } as const;
}

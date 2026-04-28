"use client";

import {
  createContext, useContext, useState, useEffect, ReactNode, useCallback,
} from "react";
import { supervisorsApi, bookingsApi } from "@/lib/api";
import type { BookingApiItem } from "@/lib/api";
import type { Supervisor, SupervisorFormData } from "@/modules/supervisors/types";
import type { Driver } from "@/modules/drivers/types";
import type { Booking } from "@/modules/bookings/types";
import { mockSupervisors, mockBookings, mockDrivers } from "@/lib/mock-data";

interface VendorContextValue {
  supervisors: Supervisor[];
  drivers: Driver[];
  bookings: Booking[];
  isLoading: boolean;
  apiCounts: { supervisors: number; bookings: number; drivers: number };
  addSupervisor: (data: SupervisorFormData) => Promise<void>;
  updateSupervisor: (id: string, data: Partial<Supervisor>) => void;
  deleteSupervisor: (id: string) => void;
  toggleAppAccess: (id: string) => void;
}

const VendorContext = createContext<VendorContextValue | null>(null);

function toBooking(item: BookingApiItem): Booking {
  return {
    id:              item.id,
    type:            item.type as "Instant" | "Scheduled",
    status:          item.status as "Pending" | "Ongoing" | "Completed" | "Cancelled",
    supervisorId:    item.supervisorId   ?? "",
    supervisorName:  item.supervisorName ?? "",
    driverId:        item.driverId,
    driverName:      item.driverName,
    pickupLocation:  item.pickupLocation,
    dropLocation:    item.dropLocation,
    scheduledTime:   item.scheduledTime,
    createdAt:       item.createdAt,
    fare:            item.fare       ?? undefined,
    passengers:      item.passengers ?? undefined,
    bookingSource:   item.bookingSource,
    bookingRef:      item.bookingRef,
    driverPhone:     item.driverPhone,
  };
}

function deriveDrivers(apiItems: BookingApiItem[]): Driver[] {
  const tripsByDriver = new Map<string, BookingApiItem[]>();

  for (const item of apiItems) {
    if (!item.driverId) continue;
    const list = tripsByDriver.get(item.driverId) ?? [];
    list.push(item);
    tripsByDriver.set(item.driverId, list);
  }

  return Array.from(tripsByDriver.entries()).map(([driverId, trips]) => {
    const sorted = [...trips].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latest     = sorted[0];
    const ongoingTrip = sorted.find((t) => t.status === "Ongoing");
    const completedCount = sorted.filter((t) => t.status === "Completed").length;
    const current    = ongoingTrip ?? latest;

    return {
      id:                    driverId,
      name:                  latest.driverName   ?? "Unknown",
      phone:                 latest.driverPhone  ?? "",
      status:                (ongoingTrip ? "On Trip" : "Available") as Driver["status"],
      assignedSupervisorId:  current.supervisorId   ?? null,
      assignedSupervisorName: current.supervisorName ?? null,
      totalTrips:            completedCount,
      lastActive:            latest.createdAt,
      recentTrips:           sorted.slice(0, 5).map((t) => ({
        bookingId:      t.id,
        from:           t.pickupLocation,
        to:             t.dropLocation,
        date:           t.createdAt,
        supervisorName: t.supervisorName ?? "",
      })),
    } as Driver;
  });
}

export function VendorProvider({ children }: { children: ReactNode }) {
  const [apiSups, setApiSups] = useState<Supervisor[]>([]);
  const [apiBks,  setApiBks]  = useState<Booking[]>([]);
  const [apiDrvs, setApiDrvs] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Combine API data (first) with mock data (after) so mock rows appear below real rows
  const supervisors = [...apiSups, ...mockSupervisors];
  const bookings    = [...apiBks, ...mockBookings];
  const drivers     = [...apiDrvs, ...mockDrivers];
  const apiCounts   = {
    supervisors: apiSups.length,
    bookings:    apiBks.length,
    drivers:     apiDrvs.length,
  };

  const fetchAll = useCallback(async () => {
    try {
      const [supsRes, bksRes] = await Promise.all([
        supervisorsApi.list(),
        bookingsApi.list({ limit: 100 }),
      ]);
      setApiSups(supsRes.data as unknown as Supervisor[]);
      const apiItems = bksRes.data;
      setApiBks(apiItems.map(toBooking));
      setApiDrvs(deriveDrivers(apiItems));
    } catch {
      // auth or network error — AuthContext handles redirect
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const addSupervisor = useCallback(async (data: SupervisorFormData): Promise<void> => {
    const res = await supervisorsApi.create({
      name:        data.name,
      email:       data.email,
      phone:       data.phone,
      zone:        data.zone,
      password:    data.password,
      status:      data.status,
      walletLimit: data.walletLimit,
      companies:   data.companies,
    });
    setApiSups((prev) => [res.data as unknown as Supervisor, ...prev]);
  }, []);

  const updateSupervisor = useCallback(async (id: string, data: Partial<Supervisor>) => {
    setApiSups((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...data } : s))
    );
    try {
      const res = await supervisorsApi.update(id, {
        name:        data.name,
        phone:       data.phone,
        zone:        data.zone,
        status:      data.status,
        walletLimit: data.walletLimit,
      });
      setApiSups((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, ...(res.data as unknown as Supervisor) } : s
        )
      );
    } catch {
      fetchAll();
    }
  }, [fetchAll]);

  const deleteSupervisor = useCallback(async (id: string) => {
    setApiSups((prev) => prev.filter((s) => s.id !== id));
    try {
      await supervisorsApi.delete(id);
    } catch {
      fetchAll();
    }
  }, [fetchAll]);

  const toggleAppAccess = useCallback(async (id: string) => {
    setApiSups((prev) =>
      prev.map((s) => (s.id === id ? { ...s, appAccess: !s.appAccess } : s))
    );
    try {
      const res = await supervisorsApi.toggleAccess(id);
      setApiSups((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, ...(res.data as unknown as Supervisor) } : s
        )
      );
    } catch {
      fetchAll();
    }
  }, [fetchAll]);

  return (
    <VendorContext.Provider
      value={{
        supervisors,
        drivers,
        bookings,
        isLoading,
        apiCounts,
        addSupervisor,
        updateSupervisor,
        deleteSupervisor,
        toggleAppAccess,
      }}
    >
      {children}
    </VendorContext.Provider>
  );
}

export function useVendor() {
  const ctx = useContext(VendorContext);
  if (!ctx) throw new Error("useVendor must be used inside VendorProvider");
  return ctx;
}

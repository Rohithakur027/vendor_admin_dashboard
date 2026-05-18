"use client";

import {
  createContext, useContext, useState, useEffect, ReactNode, useCallback,
} from "react";
import { supervisorsApi, tripsApi, vendorsApi } from "@/lib/api";
import type { TripApiItem, VendorWalletSnapshot } from "@/lib/api";
import type { Supervisor, SupervisorFormData } from "@/modules/supervisors/types";
import type { Driver } from "@/modules/drivers/types";
import type { Booking } from "@/modules/bookings/types";
import { mockSupervisors, mockBookings, mockDrivers } from "@/lib/mock-data";
import { useAuth } from "./AuthContext";

interface VendorContextValue {
  supervisors: Supervisor[];
  drivers: Driver[];
  bookings: Booking[];
  vendorWallet: VendorWalletSnapshot | null;
  isLoading: boolean;
  apiCounts: { supervisors: number; bookings: number; drivers: number };
  addSupervisor: (data: SupervisorFormData) => Promise<void>;
  updateSupervisor: (id: string, data: Partial<Supervisor>) => Promise<void>;
  deleteSupervisor: (id: string) => Promise<void>;
  toggleAppAccess: (id: string) => Promise<void>;
  refreshWallet: () => Promise<void>;
}

const VendorContext = createContext<VendorContextValue | null>(null);

function toBooking(item: TripApiItem): Booking {
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
    pickupLat:       item.pickupLat,
    pickupLng:       item.pickupLng,
    dropLat:         item.dropLat,
    dropLng:         item.dropLng,
    scheduledTime:   item.scheduledTime,
    createdAt:       item.createdAt,
    completedAt:     item.completedAt ?? null,
    fare:            item.fare       ?? undefined,
    passengers:      item.passengers ?? undefined,
    bookingSource:   item.bookingSource,
    bookingRef:      item.tripRef,
    driverPhone:     item.driverPhone,
    stops:           item.stops ?? [],
  };
}

function deriveDrivers(apiItems: TripApiItem[]): Driver[] {
  const tripsByDriver = new Map<string, TripApiItem[]>();

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
      vehicle:               latest.vehicleModel ?? undefined,
      vehicleReg:            latest.vehicleReg        ?? undefined,
      vehicleType:           latest.vehicleType       ?? undefined,
      vehicleColor:          latest.vehicleColor      ?? undefined,
      vehicleMakeYear:       latest.vehicleMakeYear   ?? undefined,
      status:                (ongoingTrip ? "On Trip" : "Available") as Driver["status"],
      assignedSupervisorId:  current.supervisorId   ?? null,
      assignedSupervisorName: current.supervisorName ?? null,
      totalTrips:            completedCount,
      lastActive:            latest.createdAt,
      recentTrips:           sorted.slice(0, 5).map((t) => ({
        bookingId:      t.id,
        tripRef:        t.tripRef ?? null,
        from:           t.pickupLocation,
        to:             t.dropLocation,
        date:           t.createdAt,
        supervisorName: t.supervisorName ?? "",
      })),
    } as Driver;
  });
}

export function VendorProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [apiSups, setApiSups] = useState<Supervisor[]>([]);
  const [apiBks,  setApiBks]  = useState<Booking[]>([]);
  const [apiDrvs, setApiDrvs] = useState<Driver[]>([]);
  const [vendorWallet, setVendorWallet] = useState<VendorWalletSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Combine API data (first) with mock data (after) so mock rows appear below real rows
  const supervisors = [...apiSups];
  const bookings    = [...apiBks];
  const drivers     = [...apiDrvs, ...mockDrivers];
  const apiCounts   = {
    supervisors: apiSups.length,
    bookings:    apiBks.length,
    drivers:     apiDrvs.length,
  };

  const fetchAll = useCallback(async () => {
    try {
      const [supsRes, bksRes, walletRes] = await Promise.all([
        supervisorsApi.list(),
        tripsApi.list({ limit: 100 }),
        vendorsApi.myWallet().catch(() => null),
      ]);
      setApiSups(supsRes.data as unknown as Supervisor[]);
      const apiItems = bksRes.data;
      setApiBks(apiItems.map(toBooking));
      setApiDrvs(deriveDrivers(apiItems));
      setVendorWallet(walletRes?.data ?? null);
    } catch {
      // auth or network error — AuthContext handles redirect
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    // Vendor APIs are scoped to a single vendor via JWT vendor_id. Superadmins
    // (and unauthenticated visitors) have no vendor scope and would just hit
    // 400/403s. Skip the fetch entirely for them.
    if (!isAuthenticated || (user?.role !== "vendor" && user?.role !== "vendor_member")) {
      setIsLoading(false);
      return;
    }
    fetchAll();
  }, [authLoading, isAuthenticated, user?.role, fetchAll]);

  const addSupervisor = useCallback(async (data: SupervisorFormData): Promise<void> => {
    const res = await supervisorsApi.create({
      name:            data.name,
      email:           data.email,
      phone:           data.phone,
      zone:            data.zone,
      password:        data.password,
      status:          data.status,
      companies:       data.companies,
      sendCredentials: data.sendCredentials,
    });
    setApiSups((prev) => [res.data as unknown as Supervisor, ...prev]);
  }, []);

  const updateSupervisor = useCallback(async (id: string, data: Partial<Supervisor>) => {
    setApiSups((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...data } : s))
    );
    try {
      const res = await supervisorsApi.update(id, {
        name:      data.name,
        email:     data.email,
        phone:     data.phone,
        zone:      data.zone,
        status:    data.status,
        companies: data.companies,
      });
      setApiSups((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, ...(res.data as unknown as Supervisor) } : s
        )
      );
    } catch (err) {
      fetchAll();
      throw err;
    }
  }, [fetchAll]);

  const deleteSupervisor = useCallback(async (id: string) => {
    setApiSups((prev) => prev.filter((s) => s.id !== id));
    try {
      await supervisorsApi.delete(id);
    } catch (err) {
      fetchAll();
      throw err;
    }
  }, [fetchAll]);

  const refreshWallet = useCallback(async () => {
    const walletRes = await vendorsApi.myWallet().catch(() => null);
    setVendorWallet(walletRes?.data ?? null);
  }, []);

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
    } catch (err) {
      fetchAll();
      throw err;
    }
  }, [fetchAll]);

  return (
    <VendorContext.Provider
      value={{
        supervisors,
        drivers,
        bookings,
        vendorWallet,
        isLoading,
        apiCounts,
        addSupervisor,
        updateSupervisor,
        deleteSupervisor,
        toggleAppAccess,
        refreshWallet,
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

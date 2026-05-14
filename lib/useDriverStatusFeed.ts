"use client";

import { useEffect } from "react";
import { getSocket } from "./socket";

export type DriverStatus = "Available" | "On Trip" | "Offline";

export interface DriverStatusEvent {
  driver_id:    string;
  user_id:      string;
  is_online:    boolean;
  status:       DriverStatus | string;
  last_seen_at: string;
  lat?:         number | null;
  lng?:         number | null;
}

/**
 * Subscribe to backend `superadmin:driver:status` broadcasts. The callback
 * should be wrapped in useCallback so the listener isn't re-bound on every
 * render.
 */
export function useDriverStatusFeed(onStatus: (ev: DriverStatusEvent) => void): void {
  useEffect(() => {
    const sock = getSocket();
    sock.on("superadmin:driver:status", onStatus);
    return () => { sock.off("superadmin:driver:status", onStatus); };
  }, [onStatus]);
}

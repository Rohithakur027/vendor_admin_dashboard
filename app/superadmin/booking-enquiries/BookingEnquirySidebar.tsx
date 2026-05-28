"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerClose,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, Phone, Search } from "lucide-react";
import { superadminApi, type AddressSuggestion, type DriverApiItem, type DriverInterest, type WebsiteBookingEnquiry, type WebsiteGeneralEnquiry } from "@/lib/api";
import { CustomDatePicker, CustomTimePicker, format12h } from "@/components/HistoryPickers";
import { Switch } from "@/components/ui/switch";

const FONT = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

function toUserError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message;
  if (
    msg.startsWith("Cannot read") ||
    msg.startsWith("TypeError") ||
    msg.startsWith("ReferenceError") ||
    msg.includes(" is not ") ||
    msg.includes("undefined") ||
    msg.includes("null")
  ) return fallback;
  return msg;
}

const STATUS_COLORS: Record<string, { bg: string; color: string; dot: string; border: string }> = {
  pending:         { bg: "#fefce8", color: "#854d0e", dot: "#eab308",  border: "#fef08a" },
  driver_assigned: { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6",  border: "#bfdbfe" },
  completed:       { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e",  border: "#bbf7d0" },
  cancelled:       { bg: "#fef2f2", color: "#b91c1c", dot: "#ef4444",  border: "#fecaca" },
  new:             { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6",  border: "#bfdbfe" },
  "in review":     { bg: "#fefce8", color: "#854d0e", dot: "#eab308",  border: "#fef08a" },
  resolved:        { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e",  border: "#bbf7d0" },
  closed:          { bg: "#f8fafc", color: "#475569", dot: "#94a3b8",  border: "#e2e8f0" },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

function fmtPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return phone;
}


function fmtMoney(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
}

function parseMoneyInput(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

type FareInputs = {
  perKmCharge: string;
  bataCharge: string;
  fastagCharge: string;
  additionalCharge: string;
  additionalDescription: string;
};

function getInitialFareInputs(booking: WebsiteBookingEnquiry | null): FareInputs {
  const distance = booking?.distanceKm ?? 0;
  const estimated = booking?.estimatedFare ?? null;
  const perKmCharge = distance > 0 && estimated != null && Number.isFinite(estimated)
    ? String(Number((estimated / distance).toFixed(2)))
    : "";

  return {
    perKmCharge,
    bataCharge: "",
    fastagCharge: "",
    additionalCharge: "",
    additionalDescription: "",
  };
}

function buildInvoiceDraft(booking: WebsiteBookingEnquiry, fareInputs: FareInputs) {
  const distanceKm = booking.distanceKm ?? 0;
  const perKmCharge = parseMoneyInput(fareInputs.perKmCharge);
  const bataCharge = parseMoneyInput(fareInputs.bataCharge);
  const fastagCharge = parseMoneyInput(fareInputs.fastagCharge);
  const additionalCharge = parseMoneyInput(fareInputs.additionalCharge);
  const perKmAmount = distanceKm * perKmCharge;
  const totalFare = perKmAmount + bataCharge + fastagCharge + additionalCharge;
  const invoiceNumber = `INV-${(booking.enqRef ?? booking.id).replace(/\s+/g, "").toUpperCase()}`;

  return {
    invoiceNumber,
    distanceKm,
    perKmCharge,
    perKmAmount,
    bataCharge,
    fastagCharge,
    additionalCharge,
    additionalDescription: fareInputs.additionalDescription.trim(),
    totalFare,
  };
}

function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? "—").toString();
  const t = STATUS_COLORS[s.toLowerCase()] ?? { bg: "#f8fafc", color: "#475569", dot: "#94a3b8", border: "#e2e8f0" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: t.bg, color: t.color, border: `1px solid ${t.border}`, borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "3px 10px", whiteSpace: "nowrap" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.dot, flexShrink: 0 }} />
      {s.replace(/_/g, " ")}
    </span>
  );
}

const SLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 10.5, fontWeight: 800, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 10 }}>
    {children}
  </div>
);

const CloseBtn = () => (
  <DrawerClose asChild>
    <button
      style={{ width: 32, height: 32, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", flexShrink: 0 }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M1 1l12 12M13 1L1 13" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    </button>
  </DrawerClose>
);

function ContactRow({ icon: Icon, value }: { icon: typeof Mail; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 26, height: 26, borderRadius: 7, background: "#F1F5F9", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={12} color="#64748B" />
      </div>
      <span style={{ fontSize: 12.5, color: "#475569", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function DriverCard({
  driver,
  selected,
  onSelect,
}: {
  driver: DriverApiItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: "100%",
        textAlign: "left",
        borderRadius: 14,
        border: `1.5px solid ${selected ? "#BFDBFE" : "#E5E7EB"}`,
        background: selected ? "#EFF6FF" : "#fff",
        padding: 14,
        cursor: "pointer",
        boxShadow: selected ? "0 0 0 1px #DBEAFE inset" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 15,
            fontWeight: 900,
            color: selected ? "#1D4ED8" : "#0F172A",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            letterSpacing: 0.8,
          }}>
            {driver.vehicle?.plateNumber ?? "No vehicle number"}
          </div>
          <div style={{ fontSize: 11.5, color: "#334155", fontWeight: 700, marginTop: 3 }}>
            {driver.vehicle?.model ?? driver.vehicle?.type ?? "Vehicle model not available"}
          </div>
          <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 500, marginTop: 3 }}>
            {driver.name}
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500, marginTop: 2 }}>
            {fmtPhone(driver.phone)}
          </div>
        </div>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            padding: "4px 9px",
            borderRadius: 999,
            background: driver.isOnline ? "#DCFCE7" : "#F1F5F9",
            color: driver.isOnline ? "#15803D" : "#64748B",
            whiteSpace: "nowrap",
          }}
        >
          {driver.isOnline ? "Online" : "Offline"}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 11.5 }}>
        <span style={{ color: "#94A3B8", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.4 }}>Last active</span>
        <span style={{ color: "#334155", fontWeight: 600, textAlign: "right" as const }}>
          {new Date(driver.lastActiveAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </button>
  );
}

function InterestDriverCard({
  interest,
  onAccept,
  onReject,
  onUndo,
  accepting,
  rejecting,
  undoing,
}: {
  interest: DriverInterest;
  onAccept: () => void;
  onReject: () => void;
  onUndo: () => void;
  accepting: boolean;
  rejecting: boolean;
  undoing: boolean;
}) {
  const busy = accepting || rejecting || undoing;
  const isResponded = interest.status !== "Pending";

  return (
    <div style={{
      borderRadius: 14,
      border: `1.5px solid ${isResponded ? (interest.status === "accepted" ? "#BBF7D0" : "#FECACA") : "#E5E7EB"}`,
      background: isResponded ? (interest.status === "accepted" ? "#F0FDF4" : "#FEF2F2") : "#fff",
      padding: 14,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: 0.8 }}>
            {interest.vehicleReg ?? "No vehicle reg"}
          </div>
          <div style={{ fontSize: 11.5, color: "#334155", fontWeight: 700, marginTop: 3 }}>
            {interest.vehicleModel ?? interest.vehicleType ?? "—"}
          </div>
          <div style={{ fontSize: 11.5, color: "#64748B", fontWeight: 500, marginTop: 3 }}>{interest.driverName}</div>
          <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 500, marginTop: 2 }}>{fmtPhone(interest.driverPhone)}</div>
        </div>
        {isResponded ? (
          <span style={{
            fontSize: 10.5, fontWeight: 800, padding: "4px 10px", borderRadius: 999,
            background: interest.status === "accepted" ? "#DCFCE7" : "#FEE2E2",
            color: interest.status === "accepted" ? "#15803D" : "#B91C1C",
          }}>
            {interest.status === "accepted" ? "Accepted" : "Rejected"}
          </span>
        ) : (
          <span style={{ fontSize: 10.5, fontWeight: 800, padding: "4px 10px", borderRadius: 999, background: "#FEF9C3", color: "#854D0E" }}>
            Interested
          </span>
        )}
      </div>
      {interest.expressedAt && (
        <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 10 }}>
          Expressed interest {fmtDate(interest.expressedAt)}
        </div>
      )}
      {!isResponded && (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onReject}
            disabled={busy}
            style={{ flex: 1, height: 34, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#475569", fontSize: 12, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}
          >
            {rejecting ? "Rejecting…" : "Reject"}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            style={{ flex: 1, height: 34, borderRadius: 9, border: "1.5px solid #0F172A", background: accepting ? "#334155" : "#0F172A", color: "#fff", fontSize: 12, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer" }}
          >
            {accepting ? "Accepting…" : "Accept"}
          </button>
        </div>
      )}
      {interest.status === "rejected" && (
        <button
          type="button"
          onClick={onUndo}
          disabled={undoing}
          style={{ width: "100%", height: 32, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", fontSize: 11.5, fontWeight: 700, cursor: undoing ? "not-allowed" : "pointer", marginTop: 4 }}
        >
          {undoing ? "Undoing…" : "Undo Rejection"}
        </button>
      )}
    </div>
  );
}

function BookingDriverAssignContent({
  booking,
  onCancel,
  onUpdated,
  initialManualMode = false,
  draftMode = false,
  onDraftPublish,
  onDraftAssign,
}: {
  booking: WebsiteBookingEnquiry;
  onCancel: () => void;
  onUpdated: (updated: WebsiteBookingEnquiry) => void;
  initialManualMode?: boolean;
  draftMode?: boolean;
  onDraftPublish?: () => Promise<WebsiteBookingEnquiry | null>;
  onDraftAssign?: (driverId: string) => Promise<WebsiteBookingEnquiry | null>;
}) {
  const bookingStatus = booking.websiteBookingStatus; // "published" | "driver_assigned" | "pending" | null

  // Manual mode — only entered from the published state
  const [manualMode, setManualMode] = useState(initialManualMode);

  // Driver list state
  const [drivers, setDrivers] = useState<DriverApiItem[]>([]);
  const [driverLoading, setDriverLoading] = useState(false);
  const [driverLoadError, setDriverLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Publish / unpublish state
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Cancel assignment state
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Interest cards state
  const [interests, setInterests] = useState<DriverInterest[]>([]);
  const [interestLoading, setInterestLoading] = useState(false);
  const [interestError, setInterestError] = useState<string | null>(null);
  const [actioningInterest, setActioningInterest] = useState<{ id: string; action: "accept" | "reject" | "undo" } | null>(null);

  // Reset state when booking changes
  useEffect(() => {
    setManualMode(initialManualMode);
    setSelectedDriverId(null);
    setInterests([]);
  }, [booking.id, initialManualMode]);

  // Load drivers when driver list is visible (default state or manual mode)
  const showDriverList = bookingStatus !== "published" && bookingStatus !== "driver_assigned" || manualMode;

  const loadDrivers = useCallback(async () => {
    setDriverLoading(true);
    setDriverLoadError(null);
    try {
      const res = await superadminApi.drivers.list({ limit: 100 });
      setDrivers(res.data);
    } catch (err) {
      setDriverLoadError(err instanceof Error ? err.message : "Failed to load drivers.");
    } finally {
      setDriverLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showDriverList) return;
    const timer = setTimeout(() => { void loadDrivers(); }, 0);
    return () => clearTimeout(timer);
  }, [showDriverList, loadDrivers]);

  // Load interests whenever a website_bookings record exists and booking is not driver_assigned
  const loadInterests = useCallback(async () => {
    if (!booking.websiteBookingId) return;
    setInterestLoading(true);
    setInterestError(null);
    try {
      const res = await superadminApi.bookingEnquiries.listInterests(booking.websiteBookingId);
      setInterests(res.data);
    } catch (err) {
      setInterestError(err instanceof Error ? err.message : "Failed to load driver interests.");
    } finally {
      setInterestLoading(false);
    }
  }, [booking.websiteBookingId]);

  useEffect(() => {
    if (bookingStatus === "driver_assigned" || !booking.websiteBookingId) return;
    void loadInterests();
  }, [bookingStatus, booking.websiteBookingId, loadInterests]);

  const pendingInterests = useMemo(() => interests.filter(i => i.status === "Pending"), [interests]);

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = booking.isScheduled ? drivers : drivers.filter(d => d.isOnline);
    if (!q) return pool;
    return pool.filter(d => {
      const vehicle = [d.vehicle?.plateNumber, d.vehicle?.model, d.vehicle?.type].filter(Boolean).join(" ").toLowerCase();
      return d.name.toLowerCase().includes(q) || d.phone.toLowerCase().includes(q) || vehicle.includes(q);
    });
  }, [booking.isScheduled, drivers, search]);

  const selectedDriver = filteredDrivers.find(d => d.id === selectedDriverId) ?? null;

  async function handlePublish() {
    if (draftMode && onDraftPublish) {
      setPublishing(true);
      setPublishError(null);
      try {
        const nextBooking = await onDraftPublish();
        if (nextBooking) onUpdated(nextBooking);
      } catch (err) {
        setPublishError(toUserError(err, "Unable to publish trip. Please try again."));
      } finally {
        setPublishing(false);
      }
      return;
    }

    setPublishing(true);
    setPublishError(null);
    try {
      const res = await superadminApi.bookingEnquiries.publishRide(booking.id);
      onUpdated({ ...booking, isPublished: true, websiteBookingStatus: "published", websiteBookingId: res.data.id, websiteBookingRef: res.data.bookingRef });
    } catch (err) {
      setPublishError(toUserError(err, "Unable to publish trip. Please try again."));
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    setUnpublishing(true);
    setPublishError(null);
    try {
      const res = await superadminApi.bookingEnquiries.unpublishTrip(booking.id);
      onUpdated(res.data);
      setManualMode(false);
    } catch (err) {
      setPublishError(toUserError(err, "Unable to cancel publishing. Please try again."));
    } finally {
      setUnpublishing(false);
    }
  }

  async function handleAssign() {
    if (!selectedDriverId) return;
    if (draftMode && onDraftAssign) {
      setSaving(true);
      setSaveError(null);
      try {
        const nextBooking = await onDraftAssign(selectedDriverId);
        if (nextBooking) onUpdated(nextBooking);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Failed to assign driver.");
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await superadminApi.bookingEnquiries.assignWebsiteBookingDriverDirect(booking.id, { driver_id: selectedDriverId });
      onUpdated(res.data);
      setManualMode(false);
    } catch (err) {
      setSaveError(toUserError(err, "Unable to assign driver. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelAssignment() {
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await superadminApi.bookingEnquiries.cancelAssignment(booking.id);
      onUpdated(res.data);
    } catch (err) {
      setCancelError(toUserError(err, "Unable to cancel assignment. Please try again."));
    } finally {
      setCancelling(false);
    }
  }

  async function handleAcceptInterest(interest: DriverInterest) {
    setActioningInterest({ id: interest.id, action: "accept" });
    try {
      const res = await superadminApi.bookingEnquiries.acceptInterest(booking.id, interest.id);
      onUpdated(res.data);
    } catch (err) {
      setInterestError(err instanceof Error ? err.message : "Failed to accept driver.");
    } finally {
      setActioningInterest(null);
    }
  }

  async function handleRejectInterest(interest: DriverInterest) {
    setActioningInterest({ id: interest.id, action: "reject" });
    try {
      await superadminApi.bookingEnquiries.rejectInterest(booking.id, interest.id);
      setInterests(prev => prev.map(i => i.id === interest.id ? { ...i, status: "rejected" } : i));
    } catch (err) {
      setInterestError(err instanceof Error ? err.message : "Failed to reject driver.");
    } finally {
      setActioningInterest(null);
    }
  }

  async function handleUndoReject(interest: DriverInterest) {
    setActioningInterest({ id: interest.id, action: "undo" });
    try {
      await superadminApi.bookingEnquiries.undoRejectInterest(booking.id, interest.id);
      setInterests(prev => prev.map(i => i.id === interest.id ? { ...i, status: "Pending" } : i));
    } catch (err) {
      setInterestError(err instanceof Error ? err.message : "Failed to undo rejection.");
    } finally {
      setActioningInterest(null);
    }
  }

  // ── Shared interest cards render ──────────────────────────────────────────
  function InterestSection({ showAll }: { showAll: boolean }) {
    const visibleInterests = showAll ? interests : pendingInterests;
    if (interestLoading) return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", color: "#94A3B8", fontSize: 12.5, fontWeight: 600 }}>
        <Loader2 size={15} className="animate-spin" /> Loading interests…
      </div>
    );
    if (interestError) return (
      <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#B91C1C", borderRadius: 10, padding: "10px 12px", fontSize: 12 }}>{interestError}</div>
    );
    if (visibleInterests.length === 0) {
      if (!showAll) return null;
      return <div style={{ padding: "20px 0", textAlign: "center", color: "#94A3B8", fontSize: 12.5 }}>No driver has expressed interest yet.</div>;
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visibleInterests.map(interest => (
          <InterestDriverCard
            key={interest.id}
            interest={interest}
            accepting={actioningInterest?.id === interest.id && actioningInterest.action === "accept"}
            rejecting={actioningInterest?.id === interest.id && actioningInterest.action === "reject"}
            undoing={actioningInterest?.id === interest.id && actioningInterest.action === "undo"}
            onAccept={() => void handleAcceptInterest(interest)}
            onReject={() => void handleRejectInterest(interest)}
            onUndo={() => void handleUndoReject(interest)}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, flex: 1 }}>

      {/* Error banners */}
      {(publishError || cancelError) && (
        <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#B91C1C", borderRadius: 10, padding: "10px 12px", fontSize: 12 }}>
          {publishError ?? cancelError}
        </div>
      )}

      {/* ── STATE 1: DRIVER ASSIGNED ── */}
      {bookingStatus === "driver_assigned" && !manualMode && (
        <>
          <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 13, padding: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 10 }}>
              Assigned Driver
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#0F172A", letterSpacing: 0.6 }}>{booking.vehicleReg ?? "—"}</div>
            <div style={{ fontSize: 12, color: "#334155", fontWeight: 700, marginTop: 3 }}>{booking.vehicleModel ?? "—"}</div>
            <div style={{ fontSize: 12.5, color: "#0F172A", fontWeight: 600, marginTop: 6 }}>{booking.driverName ?? "—"}</div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{booking.driverPhone ? fmtPhone(booking.driverPhone) : "—"}</div>
            {booking.websiteBookingRef && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #E5E7EB", fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>
                {booking.websiteBookingRef}
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleCancelAssignment}
            disabled={cancelling}
            className="h-10 w-full rounded-xl text-[13px] font-semibold"
          >
            {cancelling ? "Cancelling…" : "Cancel Assignment"}
          </Button>
        </>
      )}

      {/* ── STATE 2: PUBLISHED ── */}
      {bookingStatus === "published" && !manualMode && (
        <>
          <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 13, padding: 13 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0F172A", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: "#0F172A", textTransform: "uppercase" as const, letterSpacing: 0.6 }}>Trip Published</div>
                  {booking.websiteBookingRef && (
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#334155", marginTop: 1 }}>{booking.websiteBookingRef}</div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleUnpublish}
                disabled={unpublishing}
                style={{ fontSize: 11.5, fontWeight: 700, color: "#475569", background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 8, padding: "5px 10px", cursor: unpublishing ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
              >
                {unpublishing ? "Cancelling…" : "Cancel Publishing"}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setManualMode(true)}
            style={{ width: "100%", height: 46, borderRadius: 11, border: "none", background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            Manual Assignment
          </button>

          <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.8 }}>
            Driver Interests
          </div>
          <InterestSection showAll={true} />
        </>
      )}

      {/* ── STATE 3: DEFAULT (pending / no booking) ── */}
      {(bookingStatus === "pending" || bookingStatus === "new" || !bookingStatus) && !manualMode && (
        <>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={publishing}
            className="h-11 w-full rounded-xl text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white"
          >
            {publishing ? "Publishing…" : "Publish Trip"}
          </Button>

          {/* Show all interests if any exist (e.g. after cancel assignment — rejected ones show with undo) */}
          {booking.websiteBookingId && interests.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>or accept from interested drivers</span>
                <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
              </div>
              <InterestSection showAll={true} />
            </>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
            <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>or assign manually</span>
            <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
          </div>
        </>
      )}

      {/* ── DRIVER LIST (default state or manual mode) ── */}
      {showDriverList && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {manualMode && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#334155" }}>Manual Assignment</div>
              <button
                type="button"
                onClick={() => setManualMode(false)}
                style={{ fontSize: 11.5, fontWeight: 700, color: "#64748B", background: "none", border: "none", cursor: "pointer", padding: "4px 8px" }}
              >
                ← Back
              </button>
            </div>
          )}

          <div style={{ position: "relative" }}>
            <Search size={14} color="#94A3B8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search drivers by name, phone, or vehicle"
              className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-[13px]"
            />
          </div>

          {driverLoadError && (
            <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#B91C1C", borderRadius: 10, padding: "10px 12px", fontSize: 12 }}>
              {driverLoadError}
            </div>
          )}

          {driverLoading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "18px 0", color: "#94A3B8", fontSize: 12.5, fontWeight: 600 }}>
              <Loader2 size={15} className="animate-spin" />
              Loading drivers…
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center", color: "#94A3B8", fontSize: 12.5 }}>
              {booking.isScheduled ? "No drivers found." : "No online drivers found."}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredDrivers.map(driver => (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  selected={selectedDriverId === driver.id}
                  onSelect={() => setSelectedDriverId(driver.id)}
                />
              ))}
            </div>
          )}

          <div style={{ marginTop: "auto", position: "sticky", bottom: 0, background: "linear-gradient(to top, #fff 70%, rgba(255,255,255,0))", paddingTop: 8 }}>
            {saveError && (
              <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#B91C1C", borderRadius: 10, padding: "10px 12px", fontSize: 12, marginBottom: 10 }}>
                {saveError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <Button
                type="button"
                variant="outline"
                onClick={manualMode ? () => setManualMode(false) : onCancel}
                className="h-10 flex-1 rounded-xl text-[13px] font-semibold"
                disabled={saving}
              >
                {manualMode ? "Back" : "Cancel"}
              </Button>
              <Button
                type="button"
                onClick={handleAssign}
                disabled={!selectedDriverId || saving}
                className="h-10 flex-1 rounded-xl text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? "Assigning…" : "Assign Driver"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Website booking detail ────────────────────────────────────────────────────

function WebsiteBookingContent({
  b,
}: {
  b: WebsiteBookingEnquiry;
}) {
  const pickupParts = b.pickupLocation.split(",").map(p => p.trim()).filter(Boolean);
  const destParts   = b.destination.split(",").map(p => p.trim()).filter(Boolean);
  const pickupMain  = pickupParts[0] ?? b.pickupLocation;
  const pickupSub   = pickupParts.slice(1).join(", ");
  const destMain    = destParts[0] ?? b.destination;
  const destSub     = destParts.slice(1).join(", ");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Customer */}
      <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
        <SLabel>Customer</SLabel>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 10 }}>{b.customerName}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {b.customerEmail && <ContactRow icon={Mail}  value={b.customerEmail} />}
          <ContactRow icon={Phone} value={fmtPhone(b.customerMobile)} />
        </div>
      </div>

      {/* Route */}
      <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
        <SLabel>Route</SLabel>
        <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
          <div style={{ width: 10, flexShrink: 0, position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid #0F172A", background: "#fff", marginTop: 4, zIndex: 1 }} />
            <div style={{ position: "absolute", top: 14, bottom: -4, width: 2, background: "#D1D5DB", zIndex: 0 }} />
          </div>
          <div style={{ flex: 1, paddingBottom: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", lineHeight: 1.3 }}>{pickupMain}</div>
            {pickupSub && <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>{pickupSub}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ width: 10, flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#0F172A", marginTop: 4 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", lineHeight: 1.3 }}>{destMain}</div>
            {destSub && <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>{destSub}</div>}
          </div>
        </div>
        {b.distanceKm != null && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #EBEBEB" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, padding: "4px 10px" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>Distance</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{b.distanceKm} km</span>
            </div>
          </div>
        )}
      </div>

      {/* Trip details */}
      <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
        <SLabel>Trip Details</SLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Vehicle",    value: b.vehicleType ?? "—" },
            { label: "Type",       value: b.isScheduled ? "Scheduled" : "Instant" },
            { label: "Passengers", value: String(b.passengers) },
          ].map(d => (
            <div key={d.label} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 9, padding: "9px 12px", textAlign: "center" as const }}>
              <div style={{ fontSize: 10.5, color: "#9CA3AF", marginBottom: 3, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.4 }}>{d.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{d.value}</div>
            </div>
          ))}
          {b.bookingCategory && (
            <div style={{ gridColumn: "1 / -1", background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 9, padding: "9px 12px", textAlign: "center" as const }}>
              <div style={{ fontSize: 10.5, color: "#9CA3AF", marginBottom: 3, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.4 }}>Booking Category</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                {b.bookingCategory}{b.bookingCategory === "within_city" && <span style={{ fontWeight: 500, color: "#64748B" }}> (Disposable)</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scheduled time */}
      {b.isScheduled && b.scheduledAt && (
        <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
          <SLabel>Scheduled For</SLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#94A3B8", marginBottom: 3 }}>Date</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                {new Date(b.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <div style={{ width: 1, height: 28, background: "#E5E7EB" }} />
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#94A3B8", marginBottom: 3 }}>Time</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                {new Date(b.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return date (only if it's a return trip and returnAt exists) */}
      {b.isReturnTrip && b.returnAt && (
        <div style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 13, padding: 15 }}>
          <SLabel>Return Trip</SLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#94A3B8", marginBottom: 3 }}>Date</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                {new Date(b.returnAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <div style={{ width: 1, height: 28, background: "#BFDBFE" }} />
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#94A3B8", marginBottom: 3 }}>Time</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                {new Date(b.returnAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function WebsiteBookingTransactionContent({
  b,
  fareInputs,
}: {
  b: WebsiteBookingEnquiry;
  fareInputs: FareInputs;
}) {
  return null;
}

function BookingInvoicePreview({
  booking,
  fareInputs,
  setFareInputs,
  invoiceRef,
}: {
  booking: WebsiteBookingEnquiry;
  fareInputs: FareInputs;
  setFareInputs: Dispatch<SetStateAction<FareInputs>>;
  invoiceRef: React.RefObject<HTMLDivElement | null>;
}) {
  const invoice = buildInvoiceDraft(booking, fareInputs);

  return (
    <div ref={invoiceRef} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.6 }}>
          Per Km Charge
        </div>
        <Input
          type="number"
          min="0"
          step="0.1"
          value={fareInputs.perKmCharge}
          onChange={e => setFareInputs(prev => ({ ...prev, perKmCharge: e.target.value }))}
          placeholder="Charge per km"
          className="h-10 rounded-xl border-slate-200 bg-white text-[13px]"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.6 }}>
          Driver BATA Charge
        </div>
        <Input
          type="number"
          min="0"
          step="0.1"
          value={fareInputs.bataCharge}
          onChange={e => setFareInputs(prev => ({ ...prev, bataCharge: e.target.value }))}
          placeholder="BATA charge"
          className="h-10 rounded-xl border-slate-200 bg-white text-[13px]"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.6 }}>
          Fastag
        </div>
        <Input
          type="number"
          min="0"
          step="0.1"
          value={fareInputs.fastagCharge}
          onChange={e => setFareInputs(prev => ({ ...prev, fastagCharge: e.target.value }))}
          placeholder="Fastag"
          className="h-10 rounded-xl border-slate-200 bg-white text-[13px]"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.6 }}>
          Additional Charge
        </div>
        <Input
          type="number"
          min="0"
          step="0.1"
          value={fareInputs.additionalCharge}
          onChange={e => setFareInputs(prev => ({ ...prev, additionalCharge: e.target.value }))}
          placeholder="Additional charge"
          className="h-10 rounded-xl border-slate-200 bg-white text-[13px]"
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.6 }}>
          Additional Charge Description
        </div>
        <textarea
          value={fareInputs.additionalDescription}
          onChange={e => setFareInputs(prev => ({ ...prev, additionalDescription: e.target.value }))}
          placeholder="Describe the extra charge"
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            minHeight: 84,
            borderRadius: 12,
            border: "1.5px solid #E2E8F0",
            padding: "10px 12px",
            fontSize: 13,
            lineHeight: 1.5,
            outline: "none",
            fontFamily: "inherit",
            background: "#fff",
            color: "#0F172A",
          }}
        />
      </div>

      <div style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: 13, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" as const, letterSpacing: 0.6 }}>Auto Total</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A" }}>₹{fmtMoney(invoice.totalFare)}</div>
        </div>
        <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
          {invoice.distanceKm > 0
            ? `${fmtMoney(invoice.distanceKm)} km x ₹${fmtMoney(invoice.perKmCharge)} = ₹${fmtMoney(invoice.perKmAmount)}`
            : "Distance charge is based on the trip kilometers."}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <span style={{ background: "#DBEAFE", color: "#1D4ED8", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
            BATA ₹{fmtMoney(invoice.bataCharge)}
          </span>
          <span style={{ background: "#DBEAFE", color: "#1D4ED8", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
            Fastag ₹{fmtMoney(invoice.fastagCharge)}
          </span>
          <span style={{ background: "#DBEAFE", color: "#1D4ED8", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
            Additional ₹{fmtMoney(invoice.additionalCharge)}
          </span>
        </div>
      </div>

    </div>
  );
}

function InfoTile({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.7, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", lineHeight: 1.5, wordBreak: "break-word" as const }}>{value}</div>
    </div>
  );
}

function InvoiceRow({ label, value, amount }: { label: string; value: string; amount: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 10, alignItems: "start", background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>{label}</div>
      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.5 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color: "#0F172A", whiteSpace: "nowrap" as const }}>{amount}</div>
    </div>
  );
}

// ── Website general enquiry detail ───────────────────────────────────────────

function WebsiteGeneralEnquiryContent({ e }: { e: WebsiteGeneralEnquiry }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Contact */}
      <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
        <SLabel>Contact</SLabel>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 10 }}>{e.name}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {e.email  && <ContactRow icon={Mail}  value={e.email} />}
          <ContactRow icon={Phone} value={fmtPhone(e.mobile)} />
        </div>
      </div>

      {/* Company */}
      {e.companyName && (
        <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
          <SLabel>Company</SLabel>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{e.companyName}</div>
        </div>
      )}

      {/* Message */}
      <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
        <SLabel>Message</SLabel>
        <p style={{ fontSize: 13, color: "#334155", lineHeight: 1.7, margin: 0 }}>{e.message}</p>
      </div>

      {/* Status + Created */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 12, padding: 13 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 8 }}>Status</div>
          <StatusPill status={e.status} />
        </div>
        <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 12, padding: 13 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 8 }}>Submitted</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{fmtDate(e.createdAt)}</div>
        </div>
      </div>
    </div>
  );
}

// ── New Trip Sidebar ──────────────────────────────────────────────────────────

type BookingMode = "instant" | "scheduled";
type NewTripStep = "details" | "assignment";

const VEHICLE_TYPES = ["Sedan", "SUV", "Hatchback", "Innova"];
const VEHICLE_PASSENGER_LIMITS: Record<string, number> = {
  Sedan: 3,
  SUV: 5,
  Hatchback: 3,
  Innova: 5,
};
const BOOKING_CATEGORIES = [
  { value: "airport_taxis", label: "Airport Taxis" },
  { value: "within_city",   label: "Within City" },
  { value: "out_station",   label: "Out Station" },
];

function NTLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-slate-600">
      {children}
    </p>
  );
}

function NTInput({
  placeholder,
  value,
  onChange,
  type = "text",
  required,
  inputMode,
  maxLength,
  autoComplete,
  pattern,
  error,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  autoComplete?: string;
  pattern?: string;
  error?: string;
}) {
  return (
    <div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete}
        pattern={pattern}
        aria-invalid={Boolean(error)}
        className={`h-10 w-full rounded-xl border bg-white px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
            : "border-slate-200 focus:border-blue-400 focus:ring-blue-100"
        }`}
      />
      {error && <p className="mt-1 text-[11px] font-medium text-rose-600">{error}</p>}
    </div>
  );
}

function DropdownField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find(o => o.value === value)?.label ?? "";

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className={`flex h-10 w-full items-center justify-between rounded-xl border bg-white px-3 text-left text-[13px] shadow-sm transition focus:outline-none focus:ring-2 ${
          value ? "border-slate-200 text-slate-900 focus:border-blue-400 focus:ring-blue-100" : "border-slate-200 text-slate-400 focus:border-blue-400 focus:ring-blue-100"
        }`}
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="ml-2 flex-shrink-0 text-slate-400">
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
          <div className="max-h-64 overflow-auto py-2">
            {options.map(option => {
              const active = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left text-[13px] hover:bg-slate-50 ${
                    active ? "bg-blue-50 text-blue-700" : "text-slate-700"
                  }`}
                >
                  <span className="font-medium">{option.label}</span>
                  {active && <span className="text-[11px] font-bold uppercase tracking-wide">Selected</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PassengerCounter({
  value,
  onChange,
  max,
  error,
  onLimitReached,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  error?: string;
  onLimitReached?: () => void;
}) {
  const atLimit = typeof max === "number" && value >= max;

  return (
    <div>
      <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, value - 1))}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-base leading-none text-slate-500 hover:bg-slate-100"
        >
          −
        </button>
        <span className="flex-1 text-center text-[13px] font-bold text-slate-900">{value}</span>
        <button
          type="button"
          onClick={() => {
            if (atLimit) {
              onLimitReached?.();
              return;
            }
            onChange(value + 1);
          }}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-base leading-none text-slate-500 hover:bg-slate-100"
        >
          +
        </button>
      </div>
      {error && <p className="mt-1 text-[11px] font-medium text-rose-600">{error}</p>}
    </div>
  );
}

function AddressAutocompleteField({
  value,
  onChange,
  placeholder,
  error,
  onSelectSuggestion,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  error?: string;
  onSelectSuggestion?: (suggestion: AddressSuggestion) => void;
}) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const requestSeq = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const seq = ++requestSeq.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await superadminApi.bookingEnquiries.autocompletePlaces(q);
        if (requestSeq.current === seq) {
          setSuggestions(res.data);
        }
      } catch {
        if (requestSeq.current === seq) {
          setSuggestions([]);
        }
      } finally {
        if (requestSeq.current === seq) {
          setLoading(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const showDropdown = open && value.trim().length >= 2;

  return (
    <div ref={rootRef} className="relative">
      <input
        value={value}
        onChange={e => {
          onChange(e.target.value);
          setOpen(e.target.value.trim().length >= 2);
        }}
        onFocus={() => setOpen(value.trim().length >= 2)}
        placeholder={placeholder}
        autoComplete="off"
        aria-invalid={Boolean(error)}
        className={`h-10 w-full rounded-xl border bg-white px-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 ${
          error
            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
            : "border-slate-200 focus:border-blue-400 focus:ring-blue-100"
        }`}
      />
      {error && <p className="mt-1 text-[11px] font-medium text-rose-600">{error}</p>}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
          {loading ? (
            <div className="px-4 py-3 text-[12px] text-slate-500">Searching places…</div>
          ) : suggestions.length > 0 ? (
            <div className="max-h-64 overflow-auto">
              {suggestions.map(suggestion => (
                <button
                  key={suggestion.id}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    onChange(suggestion.placeName);
                    onSelectSuggestion?.(suggestion);
                    setOpen(false);
                  }}
                  className="flex w-full flex-col gap-1 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                >
                  <span className="text-[13px] font-semibold text-slate-900">{suggestion.placeName}</span>
                  <span className="text-[11px] leading-4 text-slate-500">
                    {suggestion.context ?? suggestion.placeType.join(" · ")}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-[12px] text-slate-500">
              No place suggestions found. Try a broader search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── New Trip draft persistence ────────────────────────────────────────────────
const NT_DRAFT_KEY = "nt_new_trip_draft_v1";
type NTDraft = {
  mode: BookingMode; pickupLocation: string; destination: string;
  bookingCategory: string; vehicleType: string;
  schedDate: string; schedTime: string;
  returnTrip: boolean; returnDate: string; returnTime: string;
  passengers: number; customerName: string; email: string; mobile: string;
};
function ntReadDraft(): NTDraft | null {
  try { return JSON.parse(localStorage.getItem(NT_DRAFT_KEY) ?? "null"); } catch { return null; }
}
function ntWriteDraft(d: NTDraft) {
  try { localStorage.setItem(NT_DRAFT_KEY, JSON.stringify(d)); } catch {}
}
function ntClearDraft() {
  try { localStorage.removeItem(NT_DRAFT_KEY); } catch {}
}

export function NewTripSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<NewTripStep>("details");
  const [mode, setMode] = useState<BookingMode>("instant");
  const [pickupLocation, setPickupLocation] = useState("");
  const [destination, setDestination] = useState("");
  const [bookingCategory, setBookingCategory] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("09:00");
  const [returnTrip, setReturnTrip] = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("09:00");
  const [passengers, setPassengers] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [tripErrors, setTripErrors] = useState({ pickup: "", destination: "", returnDate: "", passengers: "" });
  const [customerErrors, setCustomerErrors] = useState({ email: "", mobile: "" });
  const [createdBooking, setCreatedBooking] = useState<WebsiteBookingEnquiry | null>(null);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [autoOpenManualMode, setAutoOpenManualMode] = useState(false);
  const [assignTab, setAssignTab] = useState<"assign-driver" | "details">("assign-driver");
  const draftBookingIdRef = useRef(`draft-${Math.random().toString(36).slice(2)}`);

  const selectedVehicleLimit = vehicleType ? VEHICLE_PASSENGER_LIMITS[vehicleType] : undefined;
  const draftBooking: WebsiteBookingEnquiry = {
    id: draftBookingIdRef.current,
    enqRef: null,
    createdAt: null,
    isScheduled: mode === "scheduled",
    scheduledAt: mode === "scheduled" && schedDate ? `${schedDate}T${schedTime}:00` : null,
    isReturnTrip: bookingCategory === "airport_taxis" ? returnTrip : false,
    returnAt: bookingCategory === "airport_taxis" && returnTrip && returnDate ? `${returnDate}T${returnTime}:00` : null,
    pickupLocation: pickupLocation.trim(),
    destination: destination.trim(),
    distanceKm: null,
    bookingType: mode === "scheduled" ? "Scheduled" : "Instant",
    bookingCategory: bookingCategory || null,
    vehicleType: vehicleType || null,
    passengers,
    customerName: customerName.trim(),
    customerEmail: email.trim() || null,
    customerMobile: mobile.trim(),
    status: "pending",
    pickupLat: null,
    pickupLng: null,
    dropLat: null,
    dropLng: null,
    estimatedFare: null,
    driverId: null,
    driverName: null,
    driverPhone: null,
    vehicleReg: null,
    vehicleModel: null,
    isPublished: false,
    websiteBookingId: null,
    websiteBookingRef: null,
    websiteBookingStatus: null,
  };

  // Restore draft on first mount
  useEffect(() => {
    const d = ntReadDraft();
    if (!d) return;
    if (d.mode) setMode(d.mode);
    if (d.pickupLocation) setPickupLocation(d.pickupLocation);
    if (d.destination) setDestination(d.destination);
    if (d.bookingCategory) setBookingCategory(d.bookingCategory);
    if (d.vehicleType) setVehicleType(d.vehicleType);
    if (d.schedDate) setSchedDate(d.schedDate);
    if (d.schedTime) setSchedTime(d.schedTime);
    if (d.returnTrip) setReturnTrip(d.returnTrip);
    if (d.returnDate) setReturnDate(d.returnDate);
    if (d.returnTime) setReturnTime(d.returnTime);
    if (d.passengers) setPassengers(d.passengers);
    if (d.customerName) setCustomerName(d.customerName);
    if (d.email) setEmail(d.email);
    if (d.mobile) setMobile(d.mobile);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft whenever any form field changes
  useEffect(() => {
    if (!pickupLocation && !destination && !customerName && !email && !mobile) return;
    ntWriteDraft({ mode, pickupLocation, destination, bookingCategory, vehicleType, schedDate, schedTime, returnTrip, returnDate, returnTime, passengers, customerName, email, mobile });
  }, [mode, pickupLocation, destination, bookingCategory, vehicleType, schedDate, schedTime, returnTrip, returnDate, returnTime, passengers, customerName, email, mobile]);

  function getPassengerLimitMessage(vehicle: string, max: number) {
    return `${vehicle} allows up to ${max} passengers. Please reduce the passenger count.`;
  }

  function setPassengerError(message: string) {
    setTripErrors(prev => ({ ...prev, passengers: message }));
  }

  function handleVehicleChange(nextVehicle: string) {
    setVehicleType(nextVehicle);

    const nextLimit = nextVehicle ? VEHICLE_PASSENGER_LIMITS[nextVehicle] : undefined;
    if (typeof nextLimit === "number" && passengers > nextLimit) {
      setPassengers(nextLimit);
      setPassengerError(getPassengerLimitMessage(nextVehicle, nextLimit));
      return;
    }

    setPassengerError("");
  }

  function handlePassengerChange(nextPassengers: number) {
    if (typeof selectedVehicleLimit === "number" && nextPassengers > selectedVehicleLimit) {
      setPassengerError(getPassengerLimitMessage(vehicleType, selectedVehicleLimit));
      return;
    }

    setPassengers(nextPassengers);
    if (tripErrors.passengers) setPassengerError("");
  }

  function handleReset() {
    ntClearDraft();
    setStep("details");
    setMode("instant");
    setPickupLocation("");
    setDestination("");
    setBookingCategory("");
    setVehicleType("");
    setSchedDate("");
    setSchedTime("09:00");
    setReturnTrip(false);
    setReturnDate("");
    setReturnTime("09:00");
    setPassengers(1);
    setCustomerName("");
    setEmail("");
    setMobile("");
    setTripErrors({ pickup: "", destination: "", returnDate: "", passengers: "" });
    setCustomerErrors({ email: "", mobile: "" });
    setCreatedBooking(null);
    setCreatingBooking(false);
    setSubmitError("");
    setAutoOpenManualMode(false);
  }

  // Explicit cancel — resets form and clears draft
  function handleCancel() {
    handleReset();
    onClose();
  }

  useEffect(() => {
    if (bookingCategory !== "airport_taxis" && (returnTrip || returnDate)) {
      setReturnTrip(false);
      setReturnDate("");
      setReturnTime("09:00");
    }
  }, [bookingCategory, returnTrip, returnDate]);

  function validateTripDetails() {
    const nextErrors = { pickup: "", destination: "", returnDate: "", passengers: "" };
    if (!pickupLocation.trim()) nextErrors.pickup = "Pickup location is required.";
    if (!destination.trim()) nextErrors.destination = "Destination is required.";
    if (bookingCategory === "airport_taxis" && returnTrip && !returnDate.trim()) {
      nextErrors.returnDate = "Return date is required.";
    }
    if (typeof selectedVehicleLimit === "number" && passengers > selectedVehicleLimit) {
      nextErrors.passengers = getPassengerLimitMessage(vehicleType, selectedVehicleLimit);
    }
    setTripErrors(nextErrors);
    return !nextErrors.pickup && !nextErrors.destination && !nextErrors.returnDate && !nextErrors.passengers;
  }

  function validateCustomerDetails() {
    const nextErrors = { email: "", mobile: "" };
    const trimmedEmail = email.trim();
    const digits = mobile.replace(/\D/g, "");

    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!digits) {
      nextErrors.mobile = "Mobile number is required.";
    } else if (!/^\d{10}$/.test(digits)) {
      nextErrors.mobile = "Enter a 10-digit mobile number.";
    }

    setCustomerErrors(nextErrors);
    return !nextErrors.email && !nextErrors.mobile;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === "details") {
      if (!validateTripDetails()) return;
      if (!validateCustomerDetails()) return;
      setStep("assignment");
      return;
    }
  }

  function buildBookingPayload() {
    return {
      customer_name: customerName.trim(),
      customer_email: email.trim() || undefined,
      customer_mobile: mobile.trim(),
      pickup_location: pickupLocation.trim(),
      destination: destination.trim(),
      pickup_lat: undefined,
      pickup_lng: undefined,
      destination_lat: undefined,
      destination_lng: undefined,
      booking_type: mode === "scheduled" ? "Scheduled" : "Instant",
      booking_category: bookingCategory || undefined,
      vehicle_type: vehicleType || undefined,
      passengers,
      is_scheduled: mode === "scheduled",
      scheduled_date_time: mode === "scheduled" && schedDate ? `${schedDate}T${schedTime}:00` : undefined,
      is_return_trip: bookingCategory === "airport_taxis" ? returnTrip : false,
      return_date_time: bookingCategory === "airport_taxis" && returnTrip && returnDate ? `${returnDate}T${returnTime}:00` : undefined,
      distance_km: undefined,
      estimated_fare: undefined,
    };
  }

  async function createDirectBooking(status: "published" | "driver_assigned", driverId?: string) {
    setCreatingBooking(true);
    setSubmitError("");
    try {
      const res = await superadminApi.bookingEnquiries.createWebsiteBooking({
        ...buildBookingPayload(),
        driver_id: driverId,
        status,
      });
      setCreatedBooking(res.data);
      return res.data;
    } catch (err) {
      setSubmitError(toUserError(err, "Unable to create booking. Please try again."));
      return null;
    } finally {
      setCreatingBooking(false);
    }
  }

  async function publishDraftBooking() {
    return createDirectBooking("published");
  }

  async function startManualAssignment(driverId?: string) {
    setAutoOpenManualMode(true);
    const booking = await createDirectBooking("driver_assigned", driverId);
    if (!booking) setAutoOpenManualMode(false);
    return booking;
  }

  return (
    <Drawer open={open} onOpenChange={o => { if (!o) onClose(); }} direction="right">
      <DrawerContent className="flex h-full w-[480px] flex-col border-l border-slate-200 bg-white shadow-[-8px_0_40px_rgba(0,0,0,0.08)]">
        <DrawerTitle className="sr-only">New Trip</DrawerTitle>

        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-100 px-5 pb-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Admin Booking</p>
              <h2 className="text-[18px] font-extrabold text-slate-900">New Trip</h2>
            </div>
            <DrawerClose asChild>
              <button className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-[9px] border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </DrawerClose>
          </div>

          {step === "details" ? (
            <div className="mt-3.5 flex gap-0.5 rounded-[10px] bg-slate-100 p-[3px]">
              {(["instant", "scheduled"] as BookingMode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 h-[34px] rounded-lg border-none text-[13px] font-bold transition-all cursor-pointer ${
                    mode === m
                      ? "bg-white text-slate-900 shadow-sm"
                      : "bg-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {m === "instant" ? "Instant Booking" : "Scheduled Booking"}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span style={{ display: "inline-block", background: "#DBEAFE", color: "#1D4ED8", padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {mode === "scheduled" ? "Scheduled" : "Instant"}
                </span>
                {vehicleType && (
                  <span style={{ display: "inline-block", background: "#F1F5F9", color: "#475569", padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                    {vehicleType}
                  </span>
                )}
                {bookingCategory && (
                  <span style={{ display: "inline-block", background: "#F1F5F9", color: "#475569", padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                    {bookingCategory}{bookingCategory === "within_city" && <span style={{ fontWeight: 400 }}> (Disposable)</span>}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setStep("details")}
                  className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] font-semibold text-slate-500 hover:bg-slate-100"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M7 2L3 6l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Edit details
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, borderBottom: "1px solid #E2E8F0" }}>
                {([
                  { key: "assign-driver", label: "Assign Driver" },
                  { key: "details",       label: "Details" },
                ] as const).map(tab => {
                  const isActive = assignTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setAssignTab(tab.key)}
                      style={{
                        padding: "9px 14px", fontSize: 13, fontWeight: 700,
                        background: "transparent", border: "none", cursor: "pointer",
                        color: isActive ? "#2563EB" : "#64748B",
                        borderBottom: isActive ? "2px solid #2563EB" : "2px solid transparent",
                        marginBottom: -1,
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Scrollable form */}
        <form
          id="new-trip-form"
          onSubmit={handleSubmit}
          className="enquiry-sb-scroll flex flex-1 flex-col gap-4 overflow-y-auto px-5 pt-5"
        >
          <style>{`.enquiry-sb-scroll::-webkit-scrollbar{width:4px}.enquiry-sb-scroll::-webkit-scrollbar-track{background:transparent}.enquiry-sb-scroll::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:99px}.enquiry-sb-scroll::-webkit-scrollbar-thumb:hover{background:#CBD5E1}`}</style>

          {step === "details" ? (
            <>
              {/* Trip Details */}
              <div className="flex flex-col gap-3 rounded-[13px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700">Trip Details</p>

                <div>
                  <NTLabel>Pickup Location *</NTLabel>
                  <AddressAutocompleteField
                    placeholder="Enter pickup location"
                    value={pickupLocation}
                    onChange={setPickupLocation}
                    error={tripErrors.pickup}
                  />
                </div>

                <div>
                  <NTLabel>Destination *</NTLabel>
                  <AddressAutocompleteField
                    placeholder="Enter your destination"
                    value={destination}
                    onChange={setDestination}
                    error={tripErrors.destination}
                  />
                </div>

                <div>
                  <NTLabel>Booking Category</NTLabel>
                  <DropdownField value={bookingCategory} onChange={setBookingCategory} placeholder="Booking Type" options={BOOKING_CATEGORIES} />
                </div>
                <div>
                  <NTLabel>Vehicle Type</NTLabel>
                  <DropdownField value={vehicleType} onChange={handleVehicleChange} placeholder="Select vehicle" options={VEHICLE_TYPES.map(v => ({ value: v, label: v }))} />
                </div>

                {bookingCategory === "airport_taxis" && (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <span className="text-[12.5px] font-semibold text-slate-700">Return Trip</span>
                      <Switch
                        size="sm"
                        checked={returnTrip}
                        onCheckedChange={setReturnTrip}
                      />
                    </div>
                    {returnTrip && (
                      <>
                        <div>
                          <NTLabel>Return Date *</NTLabel>
                          <CustomDatePicker value={returnDate} onChange={setReturnDate}>
                            <div className={`flex h-10 w-full items-center rounded-xl border bg-white px-3 text-[13px] cursor-pointer ${tripErrors.returnDate ? "border-rose-300" : "border-slate-200"}`}>
                              <span className={returnDate ? "text-slate-900" : "text-slate-400"}>{returnDate || "Select date"}</span>
                            </div>
                          </CustomDatePicker>
                          {tripErrors.returnDate && <p className="mt-1 text-[11px] font-medium text-rose-600">{tripErrors.returnDate}</p>}
                        </div>
                        <div>
                          <NTLabel>Return Time</NTLabel>
                          <CustomTimePicker value={returnTime} onChange={setReturnTime}>
                            <div className="flex h-10 w-full items-center rounded-xl border border-slate-200 bg-white px-3 text-[13px] cursor-pointer">
                              <span className="text-slate-900">{format12h(returnTime)}</span>
                            </div>
                          </CustomTimePicker>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {mode === "scheduled" && (
                  <>
                    <div>
                      <NTLabel>Scheduled Date *</NTLabel>
                      <CustomDatePicker value={schedDate} onChange={setSchedDate}>
                        <div className="flex h-10 w-full items-center rounded-xl border border-slate-200 bg-white px-3 text-[13px] cursor-pointer">
                          <span className={schedDate ? "text-slate-900" : "text-slate-400"}>{schedDate || "Select date"}</span>
                        </div>
                      </CustomDatePicker>
                    </div>
                    <div>
                      <NTLabel>Scheduled Time *</NTLabel>
                      <CustomTimePicker value={schedTime} onChange={setSchedTime}>
                        <div className="flex h-10 w-full items-center rounded-xl border border-slate-200 bg-white px-3 text-[13px] cursor-pointer">
                          <span className="text-slate-900">{format12h(schedTime)}</span>
                        </div>
                      </CustomTimePicker>
                    </div>
                  </>
                )}
                <div>
                  <NTLabel>Passengers *</NTLabel>
                  <PassengerCounter
                    value={passengers}
                    onChange={handlePassengerChange}
                    max={selectedVehicleLimit}
                    error={tripErrors.passengers}
                    onLimitReached={() => {
                      if (typeof selectedVehicleLimit === "number") {
                        setPassengerError(getPassengerLimitMessage(vehicleType, selectedVehicleLimit));
                      }
                    }}
                  />
                </div>
              </div>

              {/* Customer Details */}
              <div className="flex flex-col gap-3 rounded-[13px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-700">Customer Details</p>

                <div>
                  <NTLabel>Your Name *</NTLabel>
                  <NTInput placeholder="Customer name" value={customerName} onChange={setCustomerName} required />
                </div>

                <div className="flex flex-col gap-2.5">
                  <div>
                    <NTLabel>Email Address *</NTLabel>
                    <NTInput
                      placeholder="Email address"
                      value={email}
                      onChange={v => {
                        setEmail(v);
                        if (customerErrors.email) setCustomerErrors(prev => ({ ...prev, email: "" }));
                      }}
                      type="email"
                      autoComplete="email"
                      required
                      error={customerErrors.email}
                    />
                  </div>
                  <div>
                    <NTLabel>Mobile Number *</NTLabel>
                    <NTInput
                      placeholder="Mobile number"
                      value={mobile}
                      onChange={v => {
                        const digits = v.replace(/\D/g, "").slice(0, 10);
                        setMobile(digits);
                        if (customerErrors.mobile) setCustomerErrors(prev => ({ ...prev, mobile: "" }));
                      }}
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      autoComplete="tel"
                      pattern={"\\d{10}"}
                      required
                      error={customerErrors.mobile}
                    />
                  </div>
                </div>
              </div>

              {submitError && (
                <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] leading-5 text-rose-700">
                  {submitError}
                </div>
              )}
            </>
          ) : step === "assignment" ? (
            <>
              {assignTab === "details" ? (
                <WebsiteBookingContent b={createdBooking ?? draftBooking} />
              ) : (
                <BookingDriverAssignContent
                  booking={createdBooking ?? draftBooking}
                  onCancel={() => setStep("details")}
                  initialManualMode={autoOpenManualMode}
                  draftMode={!createdBooking}
                  onDraftPublish={publishDraftBooking}
                  onDraftAssign={startManualAssignment}
                  onUpdated={updated => setCreatedBooking(updated)}
                />
              )}
              {submitError && (
                <div className="mt-4 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] leading-5 text-rose-700">
                  {submitError}
                </div>
              )}
            </>
          ) : null}

          <div className="h-20 flex-shrink-0" />
        </form>

        {/* Footer */}
        {step === "details" ? (
          <div className="flex flex-shrink-0 gap-2.5 border-t border-slate-100 bg-white px-5 pb-5 pt-3.5">
            <button
              type="button"
              onClick={handleCancel}
              className="h-11 flex-1 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="new-trip-form"
              className="h-11 flex-[2] cursor-pointer rounded-xl border-none bg-blue-600 text-[13px] font-bold text-white hover:bg-blue-700"
            >
              Next
            </button>
          </div>
        ) : (
          <div className="flex flex-shrink-0 gap-2.5 border-t border-slate-100 bg-white px-5 pb-5 pt-3.5">
            <button
              type="button"
              onClick={handleCancel}
              className="h-11 flex-1 cursor-pointer rounded-xl border border-slate-200 bg-slate-50 text-[13px] font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

// ── Exported sidebars ─────────────────────────────────────────────────────────

export function WebsiteBookingDetailSidebar({ booking, onClose, onAssigned }: {
  booking: WebsiteBookingEnquiry | null;
  onClose: () => void;
  onAssigned?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "assign-driver" | "driver-transaction" | "invoices">("details");
  const [localBooking, setLocalBooking] = useState<WebsiteBookingEnquiry | null>(booking);
  const [fareInputs, setFareInputs] = useState<FareInputs>(() => getInitialFareInputs(booking));
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const invoiceDraft = useMemo(() => (localBooking ? buildInvoiceDraft(localBooking, fareInputs) : null), [localBooking, fareInputs]);

  useEffect(() => {
    setLocalBooking(booking);
    setFareInputs(getInitialFareInputs(booking));
    setActiveTab("details");
  }, [booking?.id]);

  async function downloadInvoicePdf() {
    if (!booking || !invoiceRef.current || downloadingInvoice) return;
    setDownloadingInvoice(true);
    const hideScrollbars = document.createElement("style");
    hideScrollbars.textContent = "* { scrollbar-width: none !important; } *::-webkit-scrollbar { display: none !important; }";
    document.head.appendChild(hideScrollbars);
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      const dataUrl = await toPng(invoiceRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#ffffff" });
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load invoice preview"));
      });

      const imgW = 210;
      const pageH = 297;
      const imgH = (img.height * imgW) / img.width;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      let remaining = imgH;
      let offset = 0;

      while (remaining > 0) {
        if (offset > 0) pdf.addPage();
        pdf.addImage(dataUrl, "PNG", 0, -offset, imgW, imgH);
        offset += pageH;
        remaining -= pageH;
      }

      pdf.save(`${invoiceDraft?.invoiceNumber ?? "invoice"}.pdf`);
    } catch (err) {
      console.error("Invoice PDF generation failed", err);
    } finally {
      document.head.removeChild(hideScrollbars);
      setDownloadingInvoice(false);
    }
  }

  return (
    <Drawer open={!!booking} onOpenChange={o => !o && onClose()} direction="right">
      <DrawerContent
        key={booking?.id ?? "empty"}
        className="flex flex-col h-full"
        style={{ width: 520, background: "#fff", borderLeft: "1.5px solid #EAEAEA", boxShadow: "-8px 0 40px rgba(0,0,0,0.08)", fontFamily: FONT }}
      >
        <DrawerTitle className="sr-only">Booking Detail</DrawerTitle>

        <div style={{ padding: "18px 20px 16px", borderBottom: "1.5px solid #F1F5F9", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" as const }}>
                {booking?.enqRef ?? "Website Booking"}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Booking Detail</div>
            </div>
            <CloseBtn />
          </div>
          {booking && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ display: "inline-block", background: "#DBEAFE", color: "#1D4ED8", padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {booking.isScheduled ? "Scheduled" : "Instant"}
              </span>
              {booking.vehicleType && (
                <span style={{ display: "inline-block", background: "#F1F5F9", color: "#475569", padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {booking.vehicleType}
                </span>
              )}
              {booking.bookingCategory && (
                <span style={{ display: "inline-block", background: "#F1F5F9", color: "#475569", padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {booking.bookingCategory}{booking.bookingCategory === "within_city" && <span style={{ fontWeight: 400 }}> (Disposable)</span>}
                </span>
              )}
              {booking.isReturnTrip && (
                <span style={{ display: "inline-block", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  Return Trip
                </span>
              )}
              {booking.status && booking.status.toLowerCase() !== "new" && <StatusPill status={booking.status} />}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14, borderBottom: "1px solid #E2E8F0" }}>
            {([
              { key: "details", label: "Details" },
              { key: "assign-driver", label: "Assign Driver" },
              { key: "driver-transaction", label: "Driver Transaction" },
              { key: "invoices", label: "Invoice" },
            ] as const).map(tab => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: "9px 14px",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: active ? "#2563EB" : "#64748B",
                    borderBottom: active ? "2px solid #2563EB" : "2px solid transparent",
                    marginBottom: -1,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

        </div>

        <div
          className="enquiry-sb-scroll"
          style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}
        >
          <style>{`.enquiry-sb-scroll::-webkit-scrollbar{width:4px}.enquiry-sb-scroll::-webkit-scrollbar-track{background:transparent}.enquiry-sb-scroll::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:99px}.enquiry-sb-scroll::-webkit-scrollbar-thumb:hover{background:#CBD5E1}`}</style>
          {localBooking && activeTab === "details" && (
            <WebsiteBookingContent
              b={localBooking}
            />
          )}
          {localBooking && activeTab === "assign-driver" && (
            <BookingDriverAssignContent
              key={localBooking.id}
              booking={localBooking}
              onCancel={onClose}
              onUpdated={(updated) => {
                setLocalBooking(updated);
                onAssigned?.();
              }}
            />
          )}
          {localBooking && activeTab === "driver-transaction" && (
            <WebsiteBookingTransactionContent b={localBooking} fareInputs={fareInputs} />
          )}
          {localBooking && activeTab === "invoices" && invoiceDraft && (
            <BookingInvoicePreview booking={localBooking} fareInputs={fareInputs} setFareInputs={setFareInputs} invoiceRef={invoiceRef} />
          )}
        </div>

        {booking && activeTab === "invoices" && (
          <div style={{ flexShrink: 0, padding: "14px 20px 18px", borderTop: "1.5px solid #F1F5F9", background: "#fff" }}>
            <Button
              type="button"
              onClick={downloadInvoicePdf}
              disabled={downloadingInvoice}
              className="h-11 w-full rounded-xl text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white"
            >
              {downloadingInvoice ? "Generating Invoice…" : "Download Invoice"}
            </Button>
          </div>
        )}

      </DrawerContent>
    </Drawer>
  );
}

export function WebsiteGeneralEnquiryDetailSidebar({ enquiry, onClose }: {
  enquiry: WebsiteGeneralEnquiry | null;
  onClose: () => void;
}) {
  return (
    <Drawer open={!!enquiry} onOpenChange={o => !o && onClose()} direction="right">
      <DrawerContent
        className="flex flex-col h-full"
        style={{ width: 440, background: "#fff", borderLeft: "1.5px solid #EAEAEA", boxShadow: "-8px 0 40px rgba(0,0,0,0.08)", fontFamily: FONT }}
      >
        <DrawerTitle className="sr-only">Enquiry Detail</DrawerTitle>

        <div style={{ padding: "18px 20px 16px", borderBottom: "1.5px solid #F1F5F9", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" as const }}>
                {enquiry?.enqRef ?? "Website Enquiry"}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Enquiry Detail</div>
            </div>
            <CloseBtn />
          </div>
          {enquiry && (
            <div style={{ display: "flex", gap: 6 }}>
              <StatusPill status={enquiry.status} />
            </div>
          )}
        </div>

        <div
          className="enquiry-sb-scroll"
          style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}
        >
          {enquiry && <WebsiteGeneralEnquiryContent e={enquiry} />}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

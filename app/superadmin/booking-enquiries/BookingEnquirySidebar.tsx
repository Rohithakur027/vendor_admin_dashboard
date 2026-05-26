"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerClose,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2, Mail, Phone, Search } from "lucide-react";
import { TripInvoiceDocument } from "@/app/dashboard/accounts/invoicing/TripInvoiceView";
import { superadminApi, type DriverApiItem, type InvoiceDetail, type WebsiteBookingEnquiry, type WebsiteGeneralEnquiry } from "@/lib/api";

const FONT = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

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

function toDateKey(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildBookingInvoice(booking: WebsiteBookingEnquiry): InvoiceDetail {
  const fare = typeof booking.estimatedFare === "number" && Number.isFinite(booking.estimatedFare)
    ? booking.estimatedFare
    : 0;
  const bookingDate = toDateKey(booking.scheduledAt ?? booking.createdAt);
  const ref = (booking.enqRef ?? booking.id).replace(/\s+/g, "").toUpperCase();
  const invoiceNumber = `INV-${ref}`;

  return {
    id: booking.id,
    invoiceNumber,
    companyName: booking.customerName,
    companyAddress: booking.customerEmail ?? fmtPhone(booking.customerMobile),
    periodFrom: bookingDate,
    periodTo: bookingDate,
    amount: fare,
    status: "Pending",
    issuedAt: bookingDate,
    dueDate: addDays(bookingDate, 7),
    paidAt: null,
    tripCount: 1,
    paymentRef: null,
    notes: "Generated from booking enquiry details.",
    trips: [
      {
        tripId: booking.id,
        tripRef: booking.enqRef ?? booking.id.slice(0, 8).toUpperCase(),
        pickupAddress: booking.pickupLocation,
        dropAddress: booking.destination,
        pickupTime: booking.scheduledAt ?? booking.createdAt ?? new Date().toISOString(),
        dropTime: booking.returnAt,
        fare,
        supervisorName: "Website enquiry",
        driverName: booking.driverName ?? "Unassigned",
        driverId: booking.driverId ?? null,
        driverPhone: booking.driverPhone ?? null,
        vehicleModel: booking.vehicleType ?? null,
        vehicleReg: null,
        passengers: booking.passengers,
        distanceKm: booking.distanceKm,
        tollCharges: 0,
        bookingType: booking.bookingType,
        pickupLat: booking.pickupLat,
        pickupLng: booking.pickupLng,
        dropLat: booking.dropLat,
        dropLng: booking.dropLng,
      },
    ],
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
  <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 10 }}>
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

function BookingDriverAssignContent({
  booking,
  onCancel,
  onAssigned,
}: {
  booking: WebsiteBookingEnquiry;
  onCancel: () => void;
  onAssigned: () => void;
}) {
  const [drivers, setDrivers] = useState<DriverApiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(booking.driverId ?? null);
  const [fare, setFare] = useState<string>(booking.estimatedFare != null ? String(booking.estimatedFare) : "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadDrivers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await superadminApi.drivers.list({ limit: 100 });
      setDrivers(res.data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load drivers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDrivers();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadDrivers]);

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool = booking.isScheduled ? drivers : drivers.filter(driver => driver.isOnline);
    if (!q) return pool;
    return pool.filter(driver => {
      const vehicle = [driver.vehicle?.plateNumber, driver.vehicle?.model, driver.vehicle?.type].filter(Boolean).join(" ").toLowerCase();
      return (
        driver.name.toLowerCase().includes(q) ||
        driver.phone.toLowerCase().includes(q) ||
        vehicle.includes(q)
      );
    });
  }, [booking.isScheduled, drivers, search]);

  const selectedDriver = filteredDrivers.find(d => d.id === selectedDriverId) ?? null;

  async function handleAssign() {
    if (!selectedDriverId) return;
    const fareValue = Number(fare);
    if (!Number.isFinite(fareValue) || fareValue < 0) {
      setSaveError("Enter a valid fare before assigning the driver.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await superadminApi.bookingEnquiries.assignWebsiteBookingDriver(booking.id, {
        driver_id: selectedDriverId,
        estimated_fare: fareValue,
      });
      onAssigned();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to assign driver.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, flex: 1 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase" as const, letterSpacing: 0.6 }}>
            Fare
          </div>
          <Input
            type="number"
            min="0"
            step="1"
            value={fare}
            onChange={e => setFare(e.target.value)}
            placeholder="Enter fare before assigning"
            className="h-10 rounded-xl border-slate-200 bg-white text-[13px]"
          />
        </div>

        <div style={{ position: "relative" }}>
          <Search size={14} color="#94A3B8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search drivers by name, phone, or vehicle"
            className="h-10 rounded-xl border-slate-200 bg-white pl-9 text-[13px]"
          />
        </div>

        {loadError && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#B91C1C", borderRadius: 10, padding: "10px 12px", fontSize: 12 }}>
            {loadError}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "18px 0", color: "#94A3B8", fontSize: 12.5, fontWeight: 600 }}>
            <Loader2 size={15} className="animate-spin" />
            Loading drivers…
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div style={{ padding: "16px 0", textAlign: "center", color: "#94A3B8", fontSize: 12.5 }}>
            {booking.isScheduled ? "No drivers found." : "No online drivers found."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 340, overflowY: "auto", paddingRight: 2 }}>
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
      </div>

      <div style={{ marginTop: "auto", position: "sticky", bottom: 0, background: "linear-gradient(to top, #fff 70%, rgba(255,255,255,0))", paddingTop: 8 }}>
        {saveError && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#B91C1C", borderRadius: 10, padding: "10px 12px", fontSize: 12, marginBottom: 10 }}>
            {saveError}
          </div>
        )}
        {selectedDriver && (
          <div style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: 13, padding: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: "#1D4ED8", textTransform: "uppercase" as const, letterSpacing: 0.6, marginBottom: 6 }}>
              Selected Driver
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>{selectedDriver.vehicle?.plateNumber ?? "No vehicle number"}</div>
            <div style={{ fontSize: 12, color: "#334155", fontWeight: 700, marginTop: 2 }}>
              {selectedDriver.vehicle?.model ?? selectedDriver.vehicle?.type ?? "Vehicle model not available"}
            </div>
            <div style={{ fontSize: 12, color: "#0F172A", marginTop: 2 }}>{selectedDriver.name}</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{fmtPhone(selectedDriver.phone)}</div>
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="h-10 flex-1 rounded-xl text-[13px] font-semibold"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleAssign}
            disabled={!selectedDriverId || saving || fare.trim() === ""}
            className="h-10 flex-1 rounded-xl text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? "Assigning…" : "Save & Assign"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Website booking detail ────────────────────────────────────────────────────

function WebsiteBookingContent({
  b,
  invoiceData,
  onDownloadInvoice,
  downloadingInvoice,
}: {
  b: WebsiteBookingEnquiry;
  invoiceData: InvoiceDetail | null;
  onDownloadInvoice: () => void;
  downloadingInvoice: boolean;
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
            { label: "Created",    value: fmtDate(b.createdAt) },
          ].map(d => (
            <div key={d.label} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 9, padding: "9px 12px", textAlign: "center" as const }}>
              <div style={{ fontSize: 10.5, color: "#9CA3AF", marginBottom: 3, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.4 }}>{d.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{d.value}</div>
            </div>
          ))}
          {b.bookingCategory && (
            <div style={{ gridColumn: "1 / -1", background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 9, padding: "9px 12px", textAlign: "center" as const }}>
              <div style={{ fontSize: 10.5, color: "#9CA3AF", marginBottom: 3, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 0.4 }}>Booking Category</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{b.bookingCategory}</div>
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

      <Button
        type="button"
        onClick={onDownloadInvoice}
        disabled={downloadingInvoice || !invoiceData}
        className="h-10 w-full rounded-xl bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700"
      >
        <Download size={14} className="mr-2" />
        {downloadingInvoice ? "Generating…" : "Download Invoice"}
      </Button>

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

// ── Exported sidebars ─────────────────────────────────────────────────────────

export function WebsiteBookingDetailSidebar({ booking, onClose, onAssigned }: {
  booking: WebsiteBookingEnquiry | null;
  onClose: () => void;
  onAssigned?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "assign-driver">("details");
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [renderInvoiceDoc, setRenderInvoiceDoc] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const invoiceData = useMemo(() => (booking ? buildBookingInvoice(booking) : null), [booking]);

  const handleDownloadInvoice = useCallback(async () => {
    if (!invoiceData || downloadingInvoice) return;
    setDownloadingInvoice(true);
    const hideScrollbars = document.createElement("style");
    hideScrollbars.textContent =
      "* { scrollbar-width: none !important; } *::-webkit-scrollbar { display: none !important; }";
    document.head.appendChild(hideScrollbars);

    try {
      setRenderInvoiceDoc(true);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      if (!invoiceRef.current) {
        throw new Error("Invoice document not ready");
      }

      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      const dataUrl = await toPng(invoiceRef.current, {
        pixelRatio: 2,
        backgroundColor: "#F4F6FB",
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

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

      pdf.save(`${invoiceData.invoiceNumber}.pdf`);
    } catch (err) {
      console.error("Invoice generation failed", err);
    } finally {
      document.head.removeChild(hideScrollbars);
      setRenderInvoiceDoc(false);
      setDownloadingInvoice(false);
    }
  }, [downloadingInvoice, invoiceData]);

  return (
    <Drawer open={!!booking} onOpenChange={o => !o && onClose()} direction="right">
      <DrawerContent
        key={booking?.id ?? "empty"}
        className="flex flex-col h-full"
        style={{ width: 440, background: "#fff", borderLeft: "1.5px solid #EAEAEA", boxShadow: "-8px 0 40px rgba(0,0,0,0.08)", fontFamily: FONT }}
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
                  {booking.bookingCategory}
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
          {booking && activeTab === "details" && (
            <WebsiteBookingContent
              b={booking}
              invoiceData={invoiceData}
              onDownloadInvoice={() => void handleDownloadInvoice()}
              downloadingInvoice={downloadingInvoice}
            />
          )}
          {booking && activeTab === "assign-driver" && (
            <BookingDriverAssignContent
              key={booking.id}
              booking={booking}
              onCancel={onClose}
              onAssigned={() => {
                onAssigned?.();
                onClose();
              }}
            />
          )}
        </div>

        {renderInvoiceDoc && invoiceData && (
          <div
            style={{
              position: "fixed",
              left: -12000,
              top: 0,
              width: 860,
              opacity: 0,
              pointerEvents: "none",
              overflow: "hidden",
            }}
            aria-hidden="true"
          >
            <TripInvoiceDocument ref={invoiceRef} inv={invoiceData} mode="trips-only" />
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

"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Drawer,
  DrawerContent,
  DrawerClose,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Clock, CheckCircle2, XCircle, Loader2, Phone, FileText, ExternalLink, Maximize2, X as XIcon } from "lucide-react";
import type { Booking, BookingStatus } from "../types";
import { useVendor } from "@/context/VendorContext";
import { STATUS_STYLES } from "@/components/StatusBadge";
import { superadminApi, type DriverDocuments } from "@/lib/api";

const LiveTrackingMap = dynamic(
  () => import("@/components/LiveTrackingMap"),
  { ssr: false },
);

const ACCENT = "#2563EB";

interface BookingDetailModalProps {
  booking: Booking | null;
  onClose: () => void;
}

export function BookingDetailModal({ booking, onClose }: BookingDetailModalProps) {
  const { drivers, supervisors } = useVendor();
  const [activeTab, setActiveTab] = useState<"details" | "documents" | "live">("details");
  const [driverDocs, setDriverDocs]     = useState<DriverDocuments | null>(null);
  const [docsLoading, setDocsLoading]   = useState(false);
  const [docsError, setDocsError]       = useState<string | null>(null);
  const [expandedDoc, setExpandedDoc]   = useState<{ label: string; url: string | null } | null>(null);

  // reset to details tab whenever a new booking is opened
  useEffect(() => {
    setActiveTab("details");
    setDriverDocs(null);
    setDocsError(null);
    setExpandedDoc(null);
  }, [booking?.id]);

  // fetch documents when tab becomes active
  useEffect(() => {
    if (activeTab !== "documents" || !booking?.driverId) return;
    if (driverDocs || docsLoading) return;
    setDocsLoading(true);
    setDocsError(null);
    superadminApi.drivers.documents(booking.driverId)
      .then((res) => setDriverDocs(res.data))
      .catch((err) => setDocsError(err.message ?? "Failed to load documents"))
      .finally(() => setDocsLoading(false));
  }, [activeTab, booking?.driverId]);

  const driver     = booking?.driverId     ? drivers.find((d) => d.id === booking.driverId)         : null;
  const supervisor = booking?.supervisorId ? supervisors.find((s) => s.id === booking.supervisorId) : null;
  const ss         = booking ? (STATUS_STYLES[booking.status] ?? null) : null;
  const isOngoing  = booking?.status === "Ongoing";

  const timelineSteps = (() => {
    if (!booking || booking.type !== "Instant") return null;
    const events = booking.timeline ?? [];
    const status = booking.status;

    const base = [
      { label: "Trip Created", done: events.length >= 1, active: false },
      { label: "Driver Assigned", done: events.length >= 2, active: false },
      { label: "Trip Started",    done: events.length >= 3, active: false },
      { label: "In Progress",     done: status === "Ongoing" || status === "Completed", active: status === "Ongoing" },
      { label: "Arrival at Drop", done: status === "Completed", active: false },
    ];

    const times = events.map((e) => e.time);
    return base.map((step, i) => ({
      ...step,
      time: times[i] ?? (step.active ? "Now" : step.done ? "" : booking.scheduledTime
        ? new Date(booking.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "—"),
    }));
  })();

  /* ── Section label ── */
  const SLabel = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>
      {children}
    </div>
  );

  /* ── Details content (shared between tab and no-tab mode) ── */
  const DetailsContent = () => (
    <>
      {/* ── Route ── */}
      <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
        <SLabel>Route</SLabel>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 3 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#0F172A", flexShrink: 0 }} />
            <div style={{ width: 1.5, flex: 1, minHeight: 26, background: "#D1D5DB", margin: "4px 0" }} />
            <div style={{ width: 9, height: 9, borderRadius: 2, background: "#0F172A", flexShrink: 0 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", marginBottom: 2 }}>Pickup</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>{booking?.pickupLocation}</div>
              <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>
                {booking?.createdAt && new Date(booking.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", marginBottom: 2 }}>Drop</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>{booking?.dropLocation}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
          {[
            { label: "Created",    value: booking?.createdAt ? new Date(booking.createdAt).toLocaleDateString([], { day: "numeric", month: "short" }) : "—" },
            { label: "Type",       value: booking?.type ?? "—" },
            { label: "Fare",       value: booking?.fare ? `₹${booking.fare}` : "—" },
            { label: "Passengers", value: booking?.passengers != null ? `${booking.passengers}` : "—" },
          ].map((d) => (
            <div key={d.label} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 9, padding: "9px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 10.5, color: "#9CA3AF", marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{d.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{d.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scheduled date/time (Scheduled bookings only) ── */}
      {booking?.type === "Scheduled" && booking.scheduledTime && (
        <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
          <SLabel>Scheduled For</SLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#94A3B8", marginBottom: 3 }}>Date</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                {new Date(booking.scheduledTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <div style={{ width: 1, height: 28, background: "#E5E7EB" }} />
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#94A3B8", marginBottom: 3 }}>Time</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>
                {new Date(booking.scheduledTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Driver & Supervisor ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
        <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 12, padding: 13 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Driver</div>
          {booking?.driverName ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 7 }}>
                {booking.driverName}
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "#F1F5F9", border: "1.5px solid #E2E8F0" }}>
                <Phone size={13} color="#64748B" />
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#94A3B8", fontStyle: "italic" }}>Awaiting</div>
          )}
        </div>

        <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 12, padding: 13 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Supervisor</div>
          {booking?.supervisorName ? (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>
                {booking.supervisorName}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <Phone size={11} color="#94A3B8" />
                <span style={{ fontSize: 11.5, color: "#64748B", fontWeight: 600 }}>
                  {supervisor?.phone ?? "—"}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#94A3B8", fontStyle: "italic" }}>Unassigned</div>
          )}
        </div>
      </div>

      {/* ── Vehicle Details ── */}
      {driver && (driver.vehicle || driver.vehicleReg) && (
        <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "#F1F5F9", border: "1.5px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M3 13h14M5 13l1.5-5h7L15 13" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="6.5" cy="14.5" r="1.5" stroke="#374151" strokeWidth="1.4"/>
                <circle cx="13.5" cy="14.5" r="1.5" stroke="#374151" strokeWidth="1.4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A" }}>Vehicle Details</div>
              <div style={{ fontSize: 11, color: "#94A3B8" }}>Assigned vehicle info</div>
            </div>
          </div>

          {driver.vehicleReg && (
            <div style={{ background: "#0F172A", borderRadius: 11, padding: "14px 16px", marginBottom: 11, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>Registration No.</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: 2.5, fontVariantNumeric: "tabular-nums" }}>{driver.vehicleReg}</div>
              </div>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <rect x="2" y="6" width="16" height="10" rx="2.5" stroke="#fff" strokeWidth="1.4" opacity="0.8"/>
                  <path d="M6 6V5a4 4 0 018 0v1" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity="0.8"/>
                  <circle cx="7" cy="11" r="1" fill="#fff" opacity="0.7"/>
                  <circle cx="13" cy="11" r="1" fill="#fff" opacity="0.7"/>
                  <path d="M8 11h4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity="0.7"/>
                </svg>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Model",     value: driver.vehicle?.split(" ").slice(0, 2).join(" ") ?? "—" },
              { label: "Type",      value: driver.vehicleType      ?? "—" },
              { label: "Color",     value: driver.vehicleColor     ?? "—" },
              { label: "Make Year", value: driver.vehicleMakeYear ? String(driver.vehicleMakeYear) : "—" },
            ].map((d) => (
              <div key={d.label} style={{ background: "#fff", border: "1.5px solid #E5E7EB", borderRadius: 9, padding: "9px 11px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{d.label}</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{d.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Driver Request — Scheduled ── */}
      {booking?.type === "Scheduled" && booking.interestedDrivers !== undefined && (
        <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
          <SLabel>Driver Request</SLabel>
          {booking.interestedDrivers.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#94A3B8", fontSize: 13, background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1.5px solid #EBEBEB" }}>
              <Loader2 size={14} className="animate-spin" />
              Waiting for a driver to request this trip…
            </div>
          ) : (() => {
            const d = booking.interestedDrivers![0];
            const dStyle = d.status === "Accepted"
              ? { bg: "#DCFCE7", border: "#BBF7D0", color: "#15803D" }
              : d.status === "Rejected"
              ? { bg: "#F8FAFC", border: "#E2E8F0", color: "#94A3B8" }
              : { bg: "#fff", border: "#E2E8F0", color: "#B45309" };
            return (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: dStyle.bg, border: `1.5px solid ${dStyle.border}`, borderRadius: 11, padding: "12px 14px", opacity: d.status === "Rejected" ? 0.7 : 1 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{d.driverName}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    Requested {new Date(d.requestedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: dStyle.color }}>
                  {d.status === "Accepted" && <><CheckCircle2 size={14} /> Accepted</>}
                  {d.status === "Rejected" && <><XCircle size={14} /> Rejected</>}
                  {d.status === "Pending"  && <><Clock size={14} /> Pending</>}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </>
  );

  /* ── Documents content — always render the 3 sections; data wired later ── */
  const DocumentsContent = () => {
    const docs = [
      { key: "driving_license" as const, label: "Driving License"   },
      { key: "insurance"       as const, label: "Vehicle Insurance" },
      { key: "tax_certificate" as const, label: "Vehicle Tax"       },
      { key: "vehicle_rc"      as const, label: "Vehicle RC"        },
    ];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {docsError && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 10, padding: "10px 12px", color: "#DC2626", fontSize: 12 }}>
            {docsError}
          </div>
        )}
        {docs.map(({ key, label }) => {
          const doc       = driverDocs ? driverDocs[key] : null;
          const verified  = doc?.is_verified ?? false;
          const submitted = doc?.submitted   ?? false;
          const fileUrl   = doc?.file_url    ?? null;
          return (
            <div key={key} style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{label}</div>
                  <div style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 2 }}>
                    {docsLoading ? "Loading…" : submitted ? (verified ? "Verified" : "Pending review") : "Not submitted"}
                  </div>
                </div>

                <button
                  onClick={() => setExpandedDoc({ label, url: fileUrl })}
                  title="Expand"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", color: "#475569", flexShrink: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
                >
                  <Maximize2 size={14} />
                </button>
              </div>

              <div style={{
                background: "#fff", border: "1.5px dashed #E5E7EB", borderRadius: 10,
                padding: "18px 14px", display: "flex", alignItems: "center", justifyContent: "center",
                minHeight: 78,
              }}>
                {docsLoading ? (
                  <Loader2 size={16} className="animate-spin" style={{ color: "#94A3B8" }} />
                ) : fileUrl ? (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: ACCENT, textDecoration: "none" }}
                  >
                    <ExternalLink size={13} /> View document
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: "#94A3B8" }}>No file uploaded yet</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── Live content (map + timeline) ── */
  const LiveContent = () => (
    <>
      {/* Map */}
      {booking && (
        <LiveTrackingMap
          booking_id={booking.id}
          pickup_address={booking.pickupLocation}
          drop_address={booking.dropLocation}
          driver_name={booking.driverName}
          driver_phone={booking.driverPhone ?? driver?.phone ?? null}
          booking_ref={booking.bookingRef ?? null}
        />
      )}

      {/* Timeline */}
      {timelineSteps && (
        <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
          <SLabel>Trip Timeline</SLabel>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {timelineSteps.map((step, i) => (
              <div key={step.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%", marginTop: 2, flexShrink: 0,
                    background: step.active ? "#0F172A" : step.done ? "#374151" : "#E5E7EB",
                    border: `2px solid ${step.active ? "#0F172A" : step.done ? "#374151" : "#E5E7EB"}`,
                    boxShadow: step.active ? "0 0 0 3px #0F172A25" : "none",
                  }} />
                  {i < timelineSteps.length - 1 && (
                    <div style={{ width: 1.5, height: 22, background: step.done ? "#D1D5DB" : "#F3F4F6" }} />
                  )}
                </div>
                <div style={{ paddingBottom: 14 }}>
                  <div style={{ fontSize: 12.5, fontWeight: step.active ? 800 : step.done ? 600 : 400, color: step.active ? "#0F172A" : step.done ? "#374151" : "#9CA3AF" }}>
                    {step.label}
                  </div>
                  {step.time && (
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{step.time}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
    <Drawer open={!!booking} onOpenChange={(o) => !o && onClose()} direction="right">
      <DrawerContent
        className="flex flex-col h-full"
        style={{
          width: 440,
          background: "#fff",
          borderLeft: "1.5px solid #EAEAEA",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.08)",
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        <DrawerTitle className="sr-only">Booking Details</DrawerTitle>
        {/* ── Header ── */}
        <div style={{ padding: "18px 20px 0", borderBottom: "1.5px solid #F1F5F9", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              {booking?.bookingRef && (
                <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 700, letterSpacing: 0.5, marginBottom: 4 }}>
                  {booking.bookingRef}
                </div>
              )}
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Trip Details</div>
            </div>
            <DrawerClose asChild>
              <button style={{ width: 32, height: 32, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", flexShrink: 0, transition: "background 0.15s, border-color 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#CBD5E1"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F8FAFC"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </DrawerClose>
          </div>

          {/* Badges */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: isOngoing ? 0 : 16 }}>
            {ss && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: ss.bg, color: ss.text, border: `1px solid ${ss.border}`, padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: ss.dot, flexShrink: 0 }} />
                {booking!.status}
              </span>
            )}
            <span style={{ display: "inline-block", background: "#DBEAFE", color: "#1D4ED8", padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
              {booking?.type}
            </span>
            {booking?.bookingSource && booking.bookingSource !== "Individual" && (
              <span style={{ display: "inline-block", background: "#F1F5F9", color: "#475569", padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {booking.bookingSource}
              </span>
            )}
          </div>

          {/* Tab bar — always visible */}
          <div style={{ display: "flex", marginTop: 14 }}>
            {(["details", "documents", ...(isOngoing ? ["live"] : [])] as const).map((tab) => {
              const active = activeTab === tab;
              const label = tab === "live" ? "Live" : tab === "documents" ? "Documents" : "Details";
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  style={{
                    padding: "8px 18px",
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? ACCENT : "#64748B",
                    background: "none",
                    border: "none",
                    outline: "none",
                    borderBottom: active ? `2.5px solid ${ACCENT}` : "2.5px solid transparent",
                    marginBottom: -1.5,
                    cursor: "pointer",
                    transition: "color 0.15s",
                    fontFamily: "inherit",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div
          className="booking-sidebar-scroll"
          style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}
        >
          <style>{`
            .booking-sidebar-scroll::-webkit-scrollbar { width: 4px; }
            .booking-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
            .booking-sidebar-scroll::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 99px; }
            .booking-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
          `}</style>

          {activeTab === "details"   && <DetailsContent />}
          {activeTab === "documents" && <DocumentsContent />}
          {activeTab === "live"      && isOngoing && <LiveContent />}
        </div>
      </DrawerContent>
    </Drawer>

    {/* Fullscreen document expand modal — sibling to drawer, sits above with higher z-index */}
    {expandedDoc && (
      <div
        onClick={() => setExpandedDoc(null)}
        style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.65)",
          zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 960, maxHeight: "92vh",
            display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1.5px solid #F1F5F9" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6 }}>Document</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginTop: 2 }}>{expandedDoc.label}</div>
            </div>
            <button
              onClick={() => setExpandedDoc(null)}
              style={{ width: 34, height: 34, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              <XIcon size={16} />
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 360, padding: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC" }}>
            {expandedDoc.url
              ? (() => {
                  const u = expandedDoc.url.toLowerCase().split("?")[0];
                  if (/\.(jpe?g|png|webp|gif|bmp|svg)$/.test(u)) {
                    // eslint-disable-next-line @next/next/no-img-element
                    return <img src={expandedDoc.url} alt={expandedDoc.label} style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain" }} />;
                  }
                  if (/\.pdf$/.test(u)) {
                    return <iframe src={expandedDoc.url} title={expandedDoc.label} style={{ width: "100%", height: "70vh", border: "none", background: "#fff" }} />;
                  }
                  return (
                    <a href={expandedDoc.url!} target="_blank" rel="noopener noreferrer" style={{ padding: "10px 18px", borderRadius: 9, background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                      Open file
                    </a>
                  );
                })()
              : (
                <div style={{ textAlign: "center" as const, color: "#94A3B8" }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>No file uploaded yet</div>
                  <div style={{ fontSize: 11.5, marginTop: 4 }}>Document will appear here once provided.</div>
                </div>
              )
            }
          </div>
        </div>
      </div>
    )}
    </>
  );
}

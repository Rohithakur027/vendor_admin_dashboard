"use client";

import { useState, useEffect } from "react";
import { CarFront } from "lucide-react";
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

  const driver     = booking?.driverId
    ? drivers.find((d) => d.id === booking.driverId)
    : null;
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
    <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.8px] mb-3">
      {children}
    </div>
  );

  /* ── Details content (shared between tab and no-tab mode) ── */
  const DetailsContent = () => (
    <>
      {/* ── Route ── */}
      {(() => {
        const stops = booking?.stops ?? [];
        const hasStops = stops.length > 0;

        // Helper: split "Main Street, Area, City" into main + sub parts
        function splitAddr(addr: string) {
          const parts = addr.split(",").map(p => p.trim()).filter(Boolean);
          return { main: parts[0] ?? addr, sub: parts.slice(1).join(", ") };
        }

        const pickup = splitAddr(booking?.pickupLocation ?? "");
        const drop   = splitAddr(booking?.dropLocation   ?? "");

        return (
        <div className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[13px] p-[15px]">
        <SLabel>Route</SLabel>

        {/* Continuous vertical track + markers */}
        <div>
          {/* ── Pickup ── */}
          <div className="flex gap-3 items-stretch">
            <div className="w-[10px] shrink-0 relative flex flex-col items-center">
              <div className="w-[10px] h-[10px] rounded-full border-2 border-slate-900 bg-white mt-1 z-[1]" />
              <div className="absolute top-[14px] bottom-[-4px] w-[2px] bg-[#D1D5DB] z-0" />
            </div>
            <div className="flex-1 pb-[14px]">
              <div className="text-[13.5px] font-bold text-slate-900 leading-[1.3]">{pickup.main}</div>
              {pickup.sub && <div className="text-[11.5px] text-slate-400 mt-0.5 leading-[1.4]">{pickup.sub}</div>}
            </div>
          </div>

          {/* ── Stops (always visible) ── */}
          {hasStops && stops.map((s, i) => {
            const sa = splitAddr(s.address);
            return (
              <div key={s.id} className="flex gap-3 items-stretch">
                <div className="w-[10px] shrink-0 relative flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full border-[1.5px] border-slate-400 bg-white mt-[5px] z-[1]" />
                  <div className="absolute top-[13px] bottom-[-4px] w-[2px] bg-[#D1D5DB] z-0" />
                </div>
                <div className="flex-1 pb-[14px]">
                  <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.5px] mb-0.5">
                    Stop {i + 1}
                  </div>
                  <div className="text-[13px] font-semibold text-slate-700 leading-[1.3]">{sa.main}</div>
                  {sa.sub && <div className="text-[11px] text-slate-400 mt-px">{sa.sub}</div>}
                </div>
              </div>
            );
          })}

          {/* ── Drop ── */}
          <div className="flex gap-3 items-stretch">
            <div className="w-[10px] shrink-0 flex flex-col items-center">
              <div className="w-[10px] h-[10px] rounded-[2px] bg-slate-900 mt-1 z-[1]" />
            </div>
            <div className="flex-1">
              <div className="text-[13.5px] font-bold text-slate-900 leading-[1.3]">{drop.main}</div>
              {drop.sub && <div className="text-[11.5px] text-slate-400 mt-0.5 leading-[1.4]">{drop.sub}</div>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-[14px]">
          {[
            { label: "Created",    value: booking?.createdAt ? new Date(booking.createdAt).toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—" },
            ...(booking?.status === "Completed" ? [{ label: "Completed", value: booking?.completedAt ? new Date(booking.completedAt).toLocaleString("en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—" }] : []),
            { label: "Type",       value: booking?.type ?? "—" },
            { label: "Fare",       value: booking?.fare ? `₹${booking.fare}` : "—" },
            { label: "Passengers", value: booking?.passengers != null ? `${booking.passengers}` : "—" },
          ].map((d) => (
            <div key={d.label} className="bg-white border-[1.5px] border-slate-200 rounded-[9px] px-3 py-[9px] text-center">
              <div className="text-[10.5px] text-slate-400 mb-[3px] font-semibold uppercase tracking-[0.4px]">{d.label}</div>
              <div className="text-[14px] font-extrabold text-slate-900">{d.value}</div>
            </div>
          ))}
        </div>
        </div>
        );
      })()}

      {/* ── Scheduled date/time (Scheduled bookings only) ── */}
      {booking?.type === "Scheduled" && booking.scheduledTime && (
        <div className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[13px] p-[15px]">
          <SLabel>Scheduled For</SLabel>
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[10.5px] font-semibold text-slate-400 mb-[3px]">Date</div>
              <div className="text-[13.5px] font-bold text-slate-900">
                {new Date(booking.scheduledTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
            <div className="w-px h-7 bg-slate-200" />
            <div>
              <div className="text-[10.5px] font-semibold text-slate-400 mb-[3px]">Time</div>
              <div className="text-[13.5px] font-bold text-slate-900">
                {new Date(booking.scheduledTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Driver & Supervisor ── */}
      <div className="grid grid-cols-2 gap-[9px]">
        <div className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[12px] p-[13px]">
          <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.6px] mb-[10px]">Driver</div>
          {booking?.driverName ? (
            <div>
              <div className="text-[13px] font-bold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap mb-[6px]">
                {booking.driverName}
              </div>
              <div className="flex items-center h-[26px]">
                <div className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-[7px] bg-slate-100 border border-slate-200 shrink-0">
                  <Phone size={12} color="#64748B" />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-slate-400 italic">Awaiting</div>
          )}
        </div>

        <div className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[12px] p-[13px]">
          <div className="text-[10.5px] font-bold text-slate-400 uppercase tracking-[0.6px] mb-[10px]">Supervisor</div>
          {booking?.supervisorName ? (
            <div>
              <div className="text-[13px] font-bold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap mb-[6px]">
                {booking.supervisorName}
              </div>
              <div className="flex items-center gap-[6px] h-[26px]">
                <div className="flex items-center justify-center w-[26px] h-[26px] rounded-[7px] bg-slate-100 border border-slate-200 shrink-0">
                  <Phone size={12} color="#64748B" />
                </div>
                <span className="text-[11.5px] text-slate-600 font-semibold">
                  {supervisor?.phone ?? "—"}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-[13px] text-slate-400 italic">Unassigned</div>
          )}
        </div>
      </div>

      {/* ── Vehicle Details ── */}
      {driver && (driver.vehicle || driver.vehicleReg) && (
        <div className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[13px] p-[15px]">
          <div className="flex items-center gap-[9px] mb-[14px]">
            <div className="w-[30px] h-[30px] rounded-[8px] bg-slate-100 border-[1.5px] border-slate-200 flex items-center justify-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M3 13h14M5 13l1.5-5h7L15 13" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="6.5" cy="14.5" r="1.5" stroke="#374151" strokeWidth="1.4"/>
                <circle cx="13.5" cy="14.5" r="1.5" stroke="#374151" strokeWidth="1.4"/>
              </svg>
            </div>
            <div>
              <div className="text-[13.5px] font-bold text-slate-900">Vehicle Details</div>
              <div className="text-[11px] text-slate-400">Assigned vehicle info</div>
            </div>
          </div>

          {driver.vehicleReg && (
            <div className="bg-slate-900 rounded-[11px] px-4 py-[14px] mb-[11px] flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.8px] mb-[5px]">Registration No.</div>
                <div className="text-[16px] font-extrabold text-white tracking-[2.5px] tabular-nums">{driver.vehicleReg}</div>
              </div>
              <div className="w-[34px] h-[34px] rounded-[9px] bg-white/10 flex items-center justify-center">
                <CarFront size={18} color="#fff" strokeWidth={1.8} opacity={0.8} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Model",     value: driver.vehicle?.split(" ").slice(0, 2).join(" ") ?? "—" },
              { label: "Type",      value: driver.vehicleType      ?? "—" },
              { label: "Color",     value: driver.vehicleColor     ?? "—" },
              { label: "Make Year", value: driver.vehicleMakeYear ? String(driver.vehicleMakeYear) : "—" },
            ].map((d) => (
              <div key={d.label} className="bg-white border-[1.5px] border-slate-200 rounded-[9px] px-[11px] py-[9px]">
                <div className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-[0.4px] mb-1">{d.label}</div>
                <div className="text-[12.5px] font-bold text-slate-900">{d.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Driver Request — Scheduled ── */}
      {booking?.type === "Scheduled" && booking.interestedDrivers !== undefined && (
        <div className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[13px] p-[15px]">
          <SLabel>Driver Request</SLabel>
          {booking.interestedDrivers.length === 0 ? (
            <div className="flex items-center gap-2 text-slate-400 text-[13px] bg-white rounded-[10px] px-[14px] py-3 border-[1.5px] border-slate-200">
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
                  <div className="text-[13px] font-bold text-slate-900">{d.driverName}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
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
      <div className="flex flex-col gap-[10px]">
        {docsError && (
          <div className="bg-[#FEF2F2] border-[1.5px] border-[#FECACA] rounded-[10px] px-3 py-[10px] text-[#DC2626] text-[12px]">
            {docsError}
          </div>
        )}
        {docs.map(({ key, label }) => {
          const doc       = driverDocs ? driverDocs[key] : null;
          const verified  = doc?.is_verified ?? false;
          const submitted = doc?.submitted   ?? false;
          const fileUrl   = doc?.file_url    ?? null;
          return (
            <div key={key} className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[13px] p-[15px]">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-900">{label}</div>
                  <div className="text-[11.5px] text-slate-400 mt-0.5">
                    {docsLoading ? "Loading…" : submitted ? (verified ? "Verified" : "Pending review") : "Not submitted"}
                  </div>
                </div>

                <button
                  onClick={() => setExpandedDoc({ label, url: fileUrl })}
                  title="Expand"
                  className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-[8px] border-[1.5px] border-slate-200 bg-white cursor-pointer text-slate-600 shrink-0"
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#F1F5F9"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
                >
                  <Maximize2 size={14} />
                </button>
              </div>

              <div className="bg-white border-[1.5px] border-dashed border-slate-200 rounded-[10px] px-[14px] py-[18px] flex items-center justify-center min-h-[78px]">
                {docsLoading ? (
                  <Loader2 size={16} className="animate-spin text-slate-400" />
                ) : fileUrl ? (
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-[6px] text-[12.5px] font-semibold text-blue-600 no-underline"
                  >
                    <ExternalLink size={13} /> View document
                  </a>
                ) : (
                  <span className="text-[12px] text-slate-400">No file uploaded yet</span>
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
        <div className="bg-slate-50 border-[1.5px] border-slate-200 rounded-[13px] p-[15px]">
          <SLabel>Trip Timeline</SLabel>
          <div className="flex flex-col">
            {timelineSteps.map((step, i) => (
              <div key={step.label} className="flex gap-3 items-start">
                <div className="flex flex-col items-center shrink-0">
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%", marginTop: 2, flexShrink: 0,
                    background: step.active ? "#0F172A" : step.done ? "#374151" : "#E5E7EB",
                    border: `2px solid ${step.active ? "#0F172A" : step.done ? "#374151" : "#E5E7EB"}`,
                    boxShadow: step.active ? "0 0 0 3px #0F172A25" : "none",
                  }} />
                  {i < timelineSteps.length - 1 && (
                    <div className="w-[1.5px] h-[22px]" style={{ background: step.done ? "#D1D5DB" : "#F3F4F6" }} />
                  )}
                </div>
                <div className="pb-[14px]">
                  <div style={{ fontSize: 12.5, fontWeight: step.active ? 800 : step.done ? 600 : 400, color: step.active ? "#0F172A" : step.done ? "#374151" : "#9CA3AF" }}>
                    {step.label}
                  </div>
                  {step.time && (
                    <div className="text-[11px] text-slate-400 mt-px">{step.time}</div>
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
        className="flex flex-col h-full border-l-[1.5px] border-[#EAEAEA] shadow-[-8px_0_40px_rgba(0,0,0,0.08)] font-['Plus_Jakarta_Sans',system-ui,sans-serif]"
        style={{
          width: 440,
        }}
      >
        <DrawerTitle className="sr-only">Booking Details</DrawerTitle>
        {/* ── Header ── */}
        <div className="px-5 pt-[18px] border-b-[1.5px] border-slate-100 shrink-0">
          <div className="flex justify-between items-center mb-3">
            <div>
              {booking?.bookingRef && (
                <div className="text-[11px] text-slate-400 font-bold tracking-[0.5px] mb-1">
                  {booking.bookingRef}
                </div>
              )}
              <div className="text-[18px] font-extrabold text-slate-900">Trip Details</div>
            </div>
            <DrawerClose asChild>
              <button
                className="w-8 h-8 rounded-[9px] border-[1.5px] border-slate-200 bg-slate-50 cursor-pointer flex items-center justify-center text-slate-500 shrink-0 transition-[background,border-color] duration-150"
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
          <div className={`flex gap-[6px] flex-wrap ${isOngoing ? "" : "mb-4"}`}>
            {ss && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: ss.bg, color: ss.text, border: `1px solid ${ss.border}`, padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: ss.dot, flexShrink: 0 }} />
                {booking!.status}
              </span>
            )}
            <span className="inline-block bg-blue-100 text-blue-700 px-[11px] py-1 rounded-full text-[12px] font-semibold">
              {booking?.type}
            </span>
            {booking?.bookingSource && booking.bookingSource !== "Individual" && (
              <span className="inline-block bg-slate-100 text-slate-600 px-[11px] py-1 rounded-full text-[12px] font-semibold">
                {booking.bookingSource}
              </span>
            )}
          </div>

          {/* Tab bar — always visible */}
          <div className="flex mt-[14px]">
            {(["details", "documents", ...(isOngoing ? ["live"] : [])] as const).map((tab) => {
              const active = activeTab === tab;
              const label = tab === "live" ? "Live" : tab === "documents" ? "Documents" : "Details";
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`px-[18px] py-2 text-[13px] bg-transparent border-none outline-none cursor-pointer transition-colors duration-150 font-[inherit] -mb-[1.5px] ${
                    active
                      ? "font-bold text-blue-600 border-b-[2.5px] border-blue-600"
                      : "font-medium text-slate-500 border-b-[2.5px] border-transparent"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div
          className="booking-sidebar-scroll flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3"
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
        className="fixed inset-0 bg-[rgba(15,23,42,0.65)] z-[100] flex items-center justify-center p-6"
      >
        <div
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-2xl w-full max-w-[960px] max-h-[92vh] flex flex-col shadow-[0_24px_80px_rgba(0,0,0,0.25)] font-['Plus_Jakarta_Sans',system-ui,sans-serif]"
        >
          <div className="flex items-center justify-between px-[22px] py-4 border-b-[1.5px] border-slate-100">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.6px]">Document</div>
              <div className="text-[16px] font-extrabold text-slate-900 mt-0.5">{expandedDoc.label}</div>
            </div>
            <button
              onClick={() => setExpandedDoc(null)}
              className="w-[34px] h-[34px] rounded-[9px] border-[1.5px] border-slate-200 bg-slate-50 cursor-pointer text-slate-500 flex items-center justify-center"
            >
              <XIcon size={16} />
            </button>
          </div>
          <div className="flex-1 min-h-[360px] p-[18px] flex items-center justify-center bg-slate-50">
            {expandedDoc.url
              ? (() => {
                  const u = expandedDoc.url.toLowerCase().split("?")[0];
                  if (/\.(jpe?g|png|webp|gif|bmp|svg)$/.test(u)) {
                    // eslint-disable-next-line @next/next/no-img-element
                    return <img src={expandedDoc.url} alt={expandedDoc.label} className="max-w-full max-h-[70vh] object-contain" />;
                  }
                  if (/\.pdf$/.test(u)) {
                    return <iframe src={expandedDoc.url} title={expandedDoc.label} className="w-full h-[70vh] border-none bg-white" />;
                  }
                  return (
                    <a href={expandedDoc.url!} target="_blank" rel="noopener noreferrer" className="px-[18px] py-[10px] rounded-[9px] bg-blue-600 text-white text-[13px] font-bold no-underline">
                      Open file
                    </a>
                  );
                })()
              : (
                <div className="text-center text-slate-400">
                  <div className="text-[13px] font-semibold">No file uploaded yet</div>
                  <div className="text-[11.5px] mt-1">Document will appear here once provided.</div>
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

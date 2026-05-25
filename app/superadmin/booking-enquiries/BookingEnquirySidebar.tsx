"use client";

import {
  Drawer,
  DrawerContent,
  DrawerClose,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Phone, Mail } from "lucide-react";
import type { WebsiteBookingEnquiry, WebsiteGeneralEnquiry } from "@/lib/api";

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

// ── Website booking detail ────────────────────────────────────────────────────

function WebsiteBookingContent({ b }: { b: WebsiteBookingEnquiry }) {
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

      {/* Status */}
      {b.status && (
        <div style={{ background: "#FAFAFA", border: "1.5px solid #EBEBEB", borderRadius: 13, padding: 15 }}>
          <SLabel>Status</SLabel>
          <StatusPill status={b.status} />
        </div>
      )}

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

export function WebsiteBookingDetailSidebar({ booking, onClose }: {
  booking: WebsiteBookingEnquiry | null;
  onClose: () => void;
}) {
  return (
    <Drawer open={!!booking} onOpenChange={o => !o && onClose()} direction="right">
      <DrawerContent
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
                <span style={{ display: "inline-block", background: "#F0FDF4", color: "#15803D", padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {booking.bookingCategory}
                </span>
              )}
              {booking.isReturnTrip && (
                <span style={{ display: "inline-block", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", padding: "4px 11px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  Return Trip
                </span>
              )}
              {booking.status && <StatusPill status={booking.status} />}
            </div>
          )}
        </div>

        <div
          className="enquiry-sb-scroll"
          style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}
        >
          <style>{`.enquiry-sb-scroll::-webkit-scrollbar{width:4px}.enquiry-sb-scroll::-webkit-scrollbar-track{background:transparent}.enquiry-sb-scroll::-webkit-scrollbar-thumb{background:#E2E8F0;border-radius:99px}.enquiry-sb-scroll::-webkit-scrollbar-thumb:hover{background:#CBD5E1}`}</style>
          {booking && <WebsiteBookingContent b={booking} />}
        </div>
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

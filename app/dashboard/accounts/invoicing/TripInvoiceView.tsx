"use client";

import { useState, useEffect, useRef } from "react";
import { type InvoiceDetail, type InvoiceTripItem } from "@/lib/api";
import ConsolidatedInvoiceCard from "./ConsolidatedInvoiceCard";

const NAVY       = "#1B2B7E";
const NAVY_LIGHT = "#EEF0FB";
const NAVY_BORDER = "#C5CBF0";

const VI = {
  short: "SK",
  name:  "SK Travels",
  line1: "#12, 3rd Cross, Koramangala, Bangalore – 560034",
  phone: "+91 98765 43210",
  email: "reservations@sktravels.com",
  gst:   "29ABCSK1234M1ZS",
  pan:   "ABCSK1234M",
  sac:   "996601",
  bank: {
    accountName: "SK Travels",
    accountNo:   "1234 5678 9012",
    bankName:    "HDFC Bank, Koramangala",
    ifsc:        "HDFC0001234",
    upi:         "sktravels@hdfcbank",
  },
};

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso)
    .toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    .toUpperCase();
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtPeriod(from: string, to: string) {
  const fd = new Date(from + "T12:00:00");
  const td = new Date(to   + "T12:00:00");
  if (fd.getMonth() === td.getMonth() && fd.getFullYear() === td.getFullYear()) {
    return fd.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  }
  return `${fd.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — ${td.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
}

function computeFare(fare: number, toll = 0) {
  const taxable = +fare.toFixed(2);
  const cgst    = +(taxable * 0.025).toFixed(2);
  const sgst    = cgst;
  const total   = +(taxable + toll + cgst + sgst).toFixed(2);
  return { taxable, toll, cgst, sgst, total };
}

function numWords(n: number): string {
  const O = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const T = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function h(x: number): string {
    if (!x) return "";
    if (x < 20) return O[x];
    if (x < 100) return T[~~(x/10)] + (x%10 ? " "+O[x%10] : "");
    return O[~~(x/100)] + " Hundred" + (x%100 ? " and "+h(x%100) : "");
  }
  const r = Math.floor(Math.abs(n));
  const p = Math.round((Math.abs(n)-r)*100);
  const parts: string[] = [];
  if (~~(r/10000000)) parts.push(h(~~(r/10000000))+" Crore");
  if (~~((r%10000000)/100000)) parts.push(h(~~((r%10000000)/100000))+" Lakh");
  if (~~((r%100000)/1000)) parts.push(h(~~((r%100000)/1000))+" Thousand");
  if (r%1000) parts.push(h(r%1000));
  return (parts.join(" ")||"Zero") + " Rupees" + (p ? " and "+h(p)+" Paise" : "") + " Only";
}

function RouteMap({ pickup, drop }: { pickup: string; drop: string; distanceKm?: number | null }) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!TOKEN) { setReady(true); return; }

    const geocode = (q: string) =>
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q + ", India")}.json?limit=1&country=in&access_token=${TOKEN}`
      )
        .then(r => r.json())
        .then((d: { features?: { center: [number, number] }[] }) => d.features?.[0]?.center);

    Promise.all([geocode(pickup), geocode(drop)])
      .then(([p, d]) => {
        if (!p || !d) return;
        const overlays = `pin-s-a+22c55e(${p[0]},${p[1]}),pin-s-b+ef4444(${d[0]},${d[1]})`;
        setMapUrl(
          `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays}/auto/560x220@2x?padding=60&access_token=${TOKEN}`
        );
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [pickup, drop]);

  if (!ready) {
    return (
      <div style={{ height: 220, borderRadius: 10, background: "#eaf0ea", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 12, color: "#6B7280" }}>Loading map…</span>
      </div>
    );
  }

  if (mapUrl) {
    return (
      <img
        src={mapUrl}
        alt="Route map"
        crossOrigin="anonymous"
        style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 10, display: "block" }}
      />
    );
  }

  /* Fallback: simple SVG when geocoding fails */
  const p = pickup.split(",")[0].trim().slice(0, 18);
  const d = drop.split(",")[0].trim().slice(0, 18);
  return (
    <div style={{ position: "relative", background: "#eaf0ea", borderRadius: 10, overflow: "hidden", height: 220 }}>
      <svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <rect width="300" height="220" fill="#e8f0e8" />
        <line x1="0" y1="110" x2="300" y2="110" stroke="#d0dbd0" strokeWidth="10" />
        <line x1="150" y1="0" x2="150" y2="220" stroke="#d0dbd0" strokeWidth="10" />
        <path d="M 65 185 C 90 150 120 120 150 95 C 175 72 200 55 230 42"
          stroke={NAVY} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="65" cy="185" r="10" fill="#22c55e" /><circle cx="65" cy="185" r="5" fill="white" />
        <circle cx="230" cy="42" r="10" fill="#ef4444" /><circle cx="230" cy="42" r="5" fill="white" />
        <rect x="78" y="175" width="90" height="22" rx="4" fill="white" opacity="0.92" />
        <text x="123" y="190" fontSize="9" fill="#166534" fontFamily="sans-serif" fontWeight="600" textAnchor="middle">{p}</text>
        <rect x="135" y="30" width="90" height="22" rx="4" fill="white" opacity="0.92" />
        <text x="180" y="45" fontSize="9" fill="#991b1b" fontFamily="sans-serif" fontWeight="600" textAnchor="middle">{d}</text>
      </svg>
    </div>
  );
}

function TripInvoiceCard({
  trip, inv, idx,
}: {
  trip: InvoiceTripItem;
  inv:  InvoiceDetail;
  idx:  number;
}) {
  const fd       = computeFare(trip.fare, trip.tollCharges ?? 0);
  const pickupT  = fmtTime(trip.pickupTime);
  const dropT    = fmtTime(trip.dropTime);
  const tripDate = trip.pickupTime
    ? new Date(trip.pickupTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  const infoRows: [string, string][] = [
    ["Trip ID",      trip.tripRef || "—"],
    ["Driver",       trip.driverName || "—"],
    ["Vehicle",      trip.vehicleModel || "—"],
    ["Reg. no.",     trip.vehicleReg   || "—"],
    ...(trip.driverPhone  ? [["Driver phone", trip.driverPhone] as [string, string]] : []),
    ["Supervisor",   trip.supervisorName || "—"],
  ];

  return (
    <div style={{
      background: "#fff", borderRadius: 16, border: "1px solid #E2E6F0",
      width: "100%", maxWidth: 780, overflow: "hidden",
      boxShadow: "0 4px 32px rgba(27,43,126,0.08)",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: "1.75rem 2rem", borderBottom: "1px solid #E8ECF4",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        gap: "1rem", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 40, height: 40, background: NAVY, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: 0.5, flexShrink: 0,
          }}>{VI.short}</div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: 0 }}>{VI.name}</p>
            <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0", lineHeight: 1.6 }}>{VI.line1}</p>
            <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0", lineHeight: 1.6 }}>
              {VI.email} · {VI.phone}
            </p>
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0", lineHeight: 1.6 }}>
              GST: {VI.gst} · PAN: {VI.pan}
            </p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: NAVY, margin: 0, letterSpacing: "-0.5px" }}>
            {inv.invoiceNumber}
          </p>
          <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0", lineHeight: 1.6 }}>
            Invoice date: {fmtDate(inv.issuedAt)}
          </p>
          <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0", lineHeight: 1.6 }}>
            Due date: {fmtDate(inv.dueDate)}
          </p>
          <p style={{ fontSize: 11, color: "#9CA3AF", margin: "2px 0 0", lineHeight: 1.6 }}>
            SAC: {VI.sac}
          </p>
        </div>
      </div>

      {/* From / Billed To */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #E8ECF4" }}>
        <div style={{ padding: "1.25rem 2rem", borderRight: "1px solid #E8ECF4" }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF", margin: "0 0 8px" }}>From</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>{VI.name}</p>
          <p style={{ fontSize: 12, color: "#6B7280", margin: "3px 0 0", lineHeight: 1.6 }}>{VI.line1}</p>
          <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>{VI.gst}</p>
        </div>
        <div style={{ padding: "1.25rem 2rem" }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF", margin: "0 0 8px" }}>Billed to</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>{inv.companyName}</p>
          {inv.companyAddress && (
            <p style={{ fontSize: 12, color: "#6B7280", margin: "3px 0 0", lineHeight: 1.6 }}>{inv.companyAddress}</p>
          )}
          <p style={{ fontSize: 12, color: "#6B7280", margin: "3px 0 0", lineHeight: 1.6 }}>
            Period: {fmtPeriod(inv.periodFrom, inv.periodTo)}
          </p>
          {inv.tripCount > 1 && (
            <p style={{ fontSize: 12, color: "#6B7280", margin: "3px 0 0", lineHeight: 1.6 }}>
              Trip {idx + 1} of {inv.tripCount}
            </p>
          )}
        </div>
      </div>

      {/* Route Map + Trip Info */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #E8ECF4" }}>
        <div style={{ padding: "1.25rem 2rem", borderRight: "1px solid #E8ECF4" }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF", margin: "0 0 8px" }}>Route map</p>
          <RouteMap
            pickup={trip.pickupAddress || "Pickup"}
            drop={trip.dropAddress || "Drop"}
            distanceKm={trip.distanceKm}
          />
        </div>
        <div style={{ padding: "1.25rem 2rem" }}>
          {/* Badges row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {trip.bookingType && (
              <span style={{
                display: "inline-flex", alignItems: "center",
                background: NAVY_LIGHT, border: `1px solid ${NAVY_BORDER}`,
                borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 600, color: NAVY,
              }}>{trip.bookingType}</span>
            )}
            <span style={{ fontSize: 11, color: "#6B7280" }}>{tripDate}</span>
            {trip.passengers && (
              <>
                <span style={{ fontSize: 11, color: "#D1D5DB" }}>·</span>
                <span style={{ fontSize: 11, color: "#6B7280" }}>
                  {trip.passengers} passenger{trip.passengers > 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>

          {/* Timing box */}
          <div style={{
            background: "#F8F9FE", borderRadius: 10, padding: "14px 16px",
            marginBottom: 14, display: "grid", gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center", gap: 8,
          }}>
            <div>
              <p style={{ fontSize: 9, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Pickup</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "4px 0 0", letterSpacing: "-0.5px" }}>{pickupT}</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 9, color: "#9CA3AF" }}>
                {trip.distanceKm ? `${trip.distanceKm} km` : ""}
              </span>
              <div style={{ height: 1, background: "#D1D5DB", marginTop: 4 }} />
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 9, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Drop</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "4px 0 0", letterSpacing: "-0.5px" }}>{dropT}</p>
            </div>
          </div>

          {/* Route addresses */}
          <div style={{ marginBottom: 14, background: "#F8F9FE", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 9, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Pickup</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#111827", margin: "3px 0 0", lineHeight: 1.4 }}>{trip.pickupAddress || "—"}</p>
            </div>
            <div style={{ height: 1, background: "#E5E7EB", margin: "8px 0" }} />
            <div>
              <p style={{ fontSize: 9, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>Drop</p>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#111827", margin: "3px 0 0", lineHeight: 1.4 }}>{trip.dropAddress || "—"}</p>
            </div>
          </div>

          {/* Info rows */}
          {infoRows.map(([label, value], i) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 0",
              borderBottom: i === infoRows.length - 1 ? "none" : "1px solid #F3F4F6",
            }}>
              <span style={{ fontSize: 11, color: "#6B7280" }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#111827" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bank Details + Fare Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: "1px solid #E8ECF4" }}>
        <div style={{ padding: "1.25rem 2rem", borderRight: "1px solid #E8ECF4" }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF", margin: "0 0 8px" }}>Bank details</p>
          {([
            ["Account name", VI.bank.accountName, false],
            ["Account no",   VI.bank.accountNo,   false],
            ["Bank",         VI.bank.bankName,     false],
            ["IFSC",         VI.bank.ifsc,         false],
            ["UPI",          VI.bank.upi,          true],
          ] as [string, string, boolean][]).map(([label, value, highlight], i, arr) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 0",
              borderBottom: i === arr.length - 1 ? "none" : "1px solid #F3F4F6",
            }}>
              <span style={{ fontSize: 11, color: "#6B7280" }}>{label}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: highlight ? NAVY : "#111827" }}>{value}</span>
            </div>
          ))}
          <div style={{ background: "#F8F9FE", borderRadius: 8, padding: "10px 14px", marginTop: 14 }}>
            <p style={{ fontSize: 11, color: "#6B7280", margin: 0, lineHeight: 1.6 }}>
              Please include <strong>{inv.invoiceNumber}</strong> in payment reference.<br />
              This is a computer generated invoice — no signature required.
            </p>
          </div>
        </div>

        <div style={{ padding: "1.25rem 2rem" }}>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#9CA3AF", margin: "0 0 8px" }}>Fare breakdown</p>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "6px 0", borderBottom: "1px solid #E8ECF4", paddingBottom: 8,
          }}>
            <span style={{ fontSize: 12, color: "#374151", fontWeight: 600 }}>Total fare</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>
              ₹{fd.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div style={{ height: 8 }} />
          {([
            ["CGST @ 2.5%", fd.cgst],
            ["SGST @ 2.5%", fd.sgst],
            ...(fd.toll > 0 ? [["Toll charges", fd.toll] as [string, number]] : []),
          ] as [string, number][]).map(([label, value]) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 0", borderBottom: "1px solid #F3F4F6",
            }}>
              <span style={{ fontSize: 11, color: "#6B7280" }}>{label}</span>
              <span style={{ fontSize: 12, color: "#374151" }}>
                ₹{value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
          <div style={{
            background: NAVY, borderRadius: 10, padding: "16px 18px", marginTop: 14,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Total due</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>
              ₹{fd.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p style={{ fontSize: 10, color: "#9CA3AF", margin: "8px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
            In words: {numWords(fd.total)}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: "0.875rem 2rem", display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 8, borderTop: "1px solid #E8ECF4",
      }}>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>
          {inv.invoiceNumber} · {trip.tripRef || "—"} · {VI.name}
        </span>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>Due {fmtDate(inv.dueDate)}</span>
      </div>
    </div>
  );
}

export default function TripInvoiceView({
  inv,
  onClose,
  mode = "auto",
}: {
  inv:      InvoiceDetail;
  onClose?: () => void;
  mode?:    "summary" | "detailed" | "auto";
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  async function downloadPdf() {
    if (!contentRef.current || downloading) return;
    setDownloading(true);
    const hideScrollbars = document.createElement("style");
    hideScrollbars.textContent =
      "* { scrollbar-width: none !important; } *::-webkit-scrollbar { display: none !important; }";
    document.head.appendChild(hideScrollbars);
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      const dataUrl = await toPng(contentRef.current, {
        pixelRatio: 2,
        backgroundColor: "#F4F6FB",
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((res) => { img.onload = () => res(); });

      const imgW  = 210;
      const pageH = 297;
      const imgH  = (img.height * imgW) / img.width;
      const pdf   = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      let remaining = imgH;
      let offset    = 0;
      while (remaining > 0) {
        if (offset > 0) pdf.addPage();
        pdf.addImage(dataUrl, "PNG", 0, -offset, imgW, imgH);
        offset    += pageH;
        remaining -= pageH;
      }

      pdf.save(`${inv.invoiceNumber}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
    } finally {
      document.head.removeChild(hideScrollbars);
      setDownloading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 60,
      background: "#F4F6FB", overflowY: "auto",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(244,246,251,0.92)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid #E2E6F0",
        padding: "12px 2rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: NAVY, fontFamily: "monospace" }}>
            {inv.invoiceNumber}
          </span>
          <span style={{ fontSize: 13, color: "#6B7280" }}>
            · {inv.companyName} · {inv.tripCount} trip{inv.tripCount === 1 ? "" : "s"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => void downloadPdf()}
            disabled={downloading}
            style={{
              padding: "7px 18px", border: `1.5px solid ${NAVY_BORDER}`,
              borderRadius: 10, background: NAVY, color: "#fff",
              fontSize: 13, fontWeight: 600,
              cursor: downloading ? "default" : "pointer",
              opacity: downloading ? 0.7 : 1,
              fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
            }}
          >
            {downloading ? "Generating…" : "Download PDF"}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: "7px 18px", border: "1.5px solid #E2E6F0",
                borderRadius: 10, background: "#fff", color: "#374151",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
              }}
            >
              ← Back
            </button>
          )}
        </div>
      </div>

      {/* Invoice cards — this div is captured for PDF */}
      <div ref={contentRef} style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 32, padding: "2rem", background: "#F4F6FB",
      }}>
        {inv.trips.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
            No trip details available for this invoice.
          </div>
        ) : mode === "summary" ? (
          <ConsolidatedInvoiceCard inv={inv} />
        ) : mode === "detailed" || mode === "auto" ? (
          <>
            <ConsolidatedInvoiceCard inv={inv} />
            {inv.trips.map((trip, idx) => (
              <TripInvoiceCard key={trip.tripId} trip={trip} inv={inv} idx={idx} />
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

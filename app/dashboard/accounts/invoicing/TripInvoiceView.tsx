"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { type InvoiceDetail, type InvoiceTripItem } from "@/lib/api";
import { formatInvoiceNumber } from "@/lib/invoice-format";
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function LocalRouteMap({
  pickup,
  drop,
  pickupLat,
  pickupLng,
  dropLat,
  dropLng,
}: {
  pickup: string;
  drop: string;
  pickupLat: number;
  pickupLng: number;
  dropLat: number;
  dropLng: number;
}) {
  const width = 300;
  const height = 220;
  const pad = 24;
  const minLat = Math.min(pickupLat, dropLat);
  const maxLat = Math.max(pickupLat, dropLat);
  const minLng = Math.min(pickupLng, dropLng);
  const maxLng = Math.max(pickupLng, dropLng);
  const latSpan = Math.max(maxLat - minLat, 0.0015);
  const lngSpan = Math.max(maxLng - minLng, 0.0015);
  const mapW = width - pad * 2;
  const mapH = height - pad * 2;
  const toXY = (lat: number, lng: number) => ({
    x: pad + ((lng - minLng) / lngSpan) * mapW,
    y: height - pad - ((lat - minLat) / latSpan) * mapH,
  });

  const from = toXY(pickupLat, pickupLng);
  const to = toXY(dropLat, dropLng);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const controlA = { x: from.x + dx * 0.32 - dy * 0.12, y: from.y + dy * 0.32 + dx * 0.08 };
  const controlB = { x: from.x + dx * 0.68 + dy * 0.12, y: from.y + dy * 0.68 - dx * 0.08 };

  const trimLabel = (value: string) => {
    const first = value.split(",")[0]?.trim() || value;
    return first.length > 20 ? `${first.slice(0, 19)}…` : first;
  };

  return (
    <div className="relative h-[220px] rounded-[10px] overflow-hidden bg-[#eaf0ea]">
      <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
        <defs>
          <pattern id="route-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#d9e3d9" strokeWidth="1" opacity="0.7" />
          </pattern>
          <linearGradient id="route-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f8fbf8" />
            <stop offset="100%" stopColor="#edf5ed" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="url(#route-fill)" />
        <rect width={width} height={height} fill="url(#route-grid)" opacity="0.7" />
        <path
          d={`M ${from.x} ${from.y} C ${controlA.x} ${controlA.y}, ${controlB.x} ${controlB.y}, ${to.x} ${to.y}`}
          stroke={NAVY}
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M ${from.x} ${from.y} C ${controlA.x} ${controlA.y}, ${controlB.x} ${controlB.y}, ${to.x} ${to.y}`}
          stroke="#ffffff"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5 7"
          opacity="0.7"
        />
        <circle cx={from.x} cy={from.y} r="12" fill="#22c55e" opacity="0.16" />
        <circle cx={to.x} cy={to.y} r="12" fill="#ef4444" opacity="0.16" />
        <circle cx={from.x} cy={from.y} r="8" fill="#22c55e" />
        <circle cx={from.x} cy={from.y} r="3.5" fill="#ffffff" />
        <circle cx={to.x} cy={to.y} r="8" fill="#ef4444" />
        <circle cx={to.x} cy={to.y} r="3.5" fill="#ffffff" />

        <rect
          x={Math.max(10, Math.min(width - 110, from.x + 12))}
          y={Math.max(12, Math.min(height - 36, from.y - 18))}
          width="100"
          height="20"
          rx="5"
          fill="#ffffff"
          opacity="0.92"
        />
        <text
          x={Math.max(60, Math.min(width - 60, from.x + 62))}
          y={Math.max(26, Math.min(height - 22, from.y - 4))}
          fontSize="9"
          fill="#166534"
          fontFamily="sans-serif"
          fontWeight="700"
          textAnchor="middle"
        >
          {trimLabel(pickup)}
        </text>

        <rect
          x={Math.max(10, Math.min(width - 110, to.x - 112))}
          y={Math.max(12, Math.min(height - 36, to.y - 18))}
          width="100"
          height="20"
          rx="5"
          fill="#ffffff"
          opacity="0.92"
        />
        <text
          x={Math.max(50, Math.min(width - 50, to.x - 62))}
          y={Math.max(26, Math.min(height - 22, to.y - 4))}
          fontSize="9"
          fill="#991b1b"
          fontFamily="sans-serif"
          fontWeight="700"
          textAnchor="middle"
        >
          {trimLabel(drop)}
        </text>
      </svg>
    </div>
  );
}

function GeocodedRouteMap({ pickup, drop }: { pickup: string; drop: string }) {
  const [mapUrl, setMapUrl] = useState<string | null>(null);
  const hasToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "no-token">(() => (
    hasToken ? "loading" : "no-token"
  ));

  useEffect(() => {
    if (!hasToken) return;
    const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

    const geocode = (q: string) =>
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q + ", India")}.json?limit=1&country=in&access_token=${TOKEN}`
      )
        .then(r => r.json())
        .then((d: { features?: { center: [number, number] }[] }) => d.features?.[0]?.center);

    Promise.all([geocode(pickup), geocode(drop)])
      .then(([p, d]) => {
        if (!p || !d) {
          setStatus("error");
          return;
        }
        const overlays = `pin-s-a+22c55e(${p[0]},${p[1]}),pin-s-b+ef4444(${d[0]},${d[1]})`;
        setMapUrl(
          `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${overlays}/auto/560x220@2x?padding=60&access_token=${TOKEN}`
        );
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [hasToken, pickup, drop]);

  if (status === "no-token") {
    return (
      <div className="h-[220px] rounded-[10px] bg-[#eaf0ea] flex items-center justify-center">
        <span className="text-[12px] text-gray-500">Route map unavailable</span>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="h-[220px] rounded-[10px] bg-[#eaf0ea] flex items-center justify-center">
        <span className="text-[12px] text-gray-500">Loading map…</span>
      </div>
    );
  }

  if (mapUrl) {
    return (
      <img
        src={mapUrl}
        alt="Route map"
        crossOrigin="anonymous"
        className="w-full h-[220px] object-cover rounded-[10px] block"
      />
    );
  }

  /* Fallback: simple SVG when geocoding fails */
  const p = pickup.split(",")[0].trim().slice(0, 18);
  const d = drop.split(",")[0].trim().slice(0, 18);
  return (
    <div className="relative bg-[#eaf0ea] rounded-[10px] overflow-hidden h-[220px]">
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

function RouteMap({
  pickup,
  drop,
  pickupLat,
  pickupLng,
  dropLat,
  dropLng,
}: {
  pickup: string;
  drop: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropLat?: number | null;
  dropLng?: number | null;
}) {
  if (process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return <GeocodedRouteMap pickup={pickup} drop={drop} />;
  }

  if ([pickupLat, pickupLng, dropLat, dropLng].every(isFiniteNumber)) {
    const pLat = pickupLat as number;
    const pLng = pickupLng as number;
    const dLat = dropLat as number;
    const dLng = dropLng as number;
    return (
      <LocalRouteMap
        pickup={pickup}
        drop={drop}
        pickupLat={pLat}
        pickupLng={pLng}
        dropLat={dLat}
        dropLng={dLng}
      />
    );
  }

  return <GeocodedRouteMap pickup={pickup} drop={drop} />;
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
    <div className="bg-white rounded-2xl border border-[#E2E6F0] w-full max-w-[780px] overflow-hidden shadow-[0_4px_32px_rgba(27,43,126,0.08)]" style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div className="px-8 py-7 border-b border-[#E8ECF4] flex justify-between items-start gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white text-[13px] font-semibold tracking-[0.5px] shrink-0"
            style={{ background: NAVY }}
          >{VI.short}</div>
          <div>
            <p className="text-lg font-semibold text-[#111827] m-0">{VI.name}</p>
            <p className="text-[12px] text-gray-500 mt-[2px] leading-relaxed m-0">{VI.line1}</p>
            <p className="text-[12px] text-gray-500 mt-[2px] leading-relaxed m-0">
              {VI.email} · {VI.phone}
            </p>
            <p className="text-[11px] text-gray-400 mt-[2px] leading-relaxed m-0">
              GST: {VI.gst} · PAN: {VI.pan}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-bold tracking-[-0.5px] m-0" style={{ color: NAVY }}>
            {formatInvoiceNumber(inv.invoiceNumber)}
          </p>
          <p className="text-[12px] text-gray-500 mt-[2px] leading-relaxed m-0">
            Invoice date: {fmtDate(inv.issuedAt)}
          </p>
          <p className="text-[12px] text-gray-500 mt-[2px] leading-relaxed m-0">
            Due date: {fmtDate(inv.dueDate)}
          </p>
          <p className="text-[11px] text-gray-400 mt-[2px] leading-relaxed m-0">
            SAC: {VI.sac}
          </p>
        </div>
      </div>

      {/* From / Billed To */}
      <div className="grid grid-cols-2 border-b border-[#E8ECF4]">
        <div className="px-8 py-5 border-r border-[#E8ECF4]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 m-0 mb-2">From</p>
          <p className="text-[13px] font-semibold text-[#111827] m-0">{VI.name}</p>
          <p className="text-[12px] text-gray-500 mt-[3px] leading-relaxed m-0">{VI.line1}</p>
          <p className="text-[11px] text-gray-400 mt-1 m-0">{VI.gst}</p>
        </div>
        <div className="px-8 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 m-0 mb-2">Billed to</p>
          <p className="text-[13px] font-semibold text-[#111827] m-0">{inv.companyName}</p>
          {inv.companyAddress && (
            <p className="text-[12px] text-gray-500 mt-[3px] leading-relaxed m-0">{inv.companyAddress}</p>
          )}
          <p className="text-[12px] text-gray-500 mt-[3px] leading-relaxed m-0">
            Period: {fmtPeriod(inv.periodFrom, inv.periodTo)}
          </p>
          {inv.tripCount > 1 && (
            <p className="text-[12px] text-gray-500 mt-[3px] leading-relaxed m-0">
              Trip {idx + 1} of {inv.tripCount}
            </p>
          )}
        </div>
      </div>

      {/* Route Map + Trip Info */}
      <div className="grid grid-cols-2 border-b border-[#E8ECF4]">
        <div className="px-8 py-5 border-r border-[#E8ECF4]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 m-0 mb-2">Route map</p>
          <RouteMap
            pickup={trip.pickupAddress || "Pickup"}
            drop={trip.dropAddress || "Drop"}
            pickupLat={trip.pickupLat}
            pickupLng={trip.pickupLng}
            dropLat={trip.dropLat}
            dropLng={trip.dropLng}
          />
        </div>
        <div className="px-8 py-5">
          {/* Badges row */}
          <div className="flex items-center gap-2 mb-[14px] flex-wrap">
            {trip.bookingType && (
              <span
                className="inline-flex items-center rounded-[20px] px-3 py-[3px] text-[11px] font-semibold border"
                style={{ background: NAVY_LIGHT, borderColor: NAVY_BORDER, color: NAVY }}
              >{trip.bookingType}</span>
            )}
            <span className="text-[11px] text-gray-500">{tripDate}</span>
            {trip.passengers && (
              <>
                <span className="text-[11px] text-gray-300">·</span>
                <span className="text-[11px] text-gray-500">
                  {trip.passengers} passenger{trip.passengers > 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>

          {/* Timing box */}
          <div className="bg-[#F8F9FE] rounded-[10px] px-4 py-[14px] mb-[14px] grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-[0.06em] m-0">Pickup</p>
              <p className="text-[20px] font-bold text-[#111827] mt-1 m-0 tracking-[-0.5px]">{pickupT}</p>
            </div>
            <div className="text-center">
              <span className="text-[9px] text-gray-400">
                {trip.distanceKm ? `${trip.distanceKm} km` : ""}
              </span>
              <div className="h-px bg-gray-300 mt-1" />
            </div>
            <div className="text-right">
              <p className="text-[9px] text-gray-400 uppercase tracking-[0.06em] m-0">Drop</p>
              <p className="text-[20px] font-bold text-[#111827] mt-1 m-0 tracking-[-0.5px]">{dropT}</p>
            </div>
          </div>

          {/* Route addresses */}
          <div className="mb-[14px] bg-[#F8F9FE] rounded-[10px] px-[14px] py-3">
            <div className="mb-2">
              <p className="text-[9px] text-gray-400 uppercase tracking-[0.06em] m-0">Pickup</p>
              <p className="text-[12px] font-semibold text-[#111827] mt-[3px] leading-[1.4] m-0">{trip.pickupAddress || "—"}</p>
            </div>
            <div className="h-px bg-[#E5E7EB] my-2" />
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-[0.06em] m-0">Drop</p>
              <p className="text-[12px] font-semibold text-[#111827] mt-[3px] leading-[1.4] m-0">{trip.dropAddress || "—"}</p>
            </div>
          </div>

          {/* Info rows */}
          {infoRows.map(([label, value], i) => (
            <div key={label} className={`flex justify-between items-center py-[6px] ${i === infoRows.length - 1 ? "" : "border-b border-[#F3F4F6]"}`}>
              <span className="text-[11px] text-gray-500">{label}</span>
              <span className="text-[11px] font-semibold text-[#111827]">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bank Details + Fare Breakdown */}
      <div className="grid grid-cols-2 border-t border-[#E8ECF4]">
        <div className="px-8 py-5 border-r border-[#E8ECF4]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 m-0 mb-2">Bank details</p>
          {([
            ["Account name", VI.bank.accountName, false],
            ["Account no",   VI.bank.accountNo,   false],
            ["Bank",         VI.bank.bankName,     false],
            ["IFSC",         VI.bank.ifsc,         false],
            ["UPI",          VI.bank.upi,          true],
          ] as [string, string, boolean][]).map(([label, value, highlight], i, arr) => (
            <div key={label} className={`flex justify-between items-center py-[6px] ${i === arr.length - 1 ? "" : "border-b border-[#F3F4F6]"}`}>
              <span className="text-[11px] text-gray-500">{label}</span>
              <span className="text-[11px] font-semibold" style={{ color: highlight ? NAVY : "#111827" }}>{value}</span>
            </div>
          ))}
          <div className="bg-[#F8F9FE] rounded-lg px-[14px] py-[10px] mt-[14px]">
            <p className="text-[11px] text-gray-500 m-0 leading-relaxed">
              Please include <strong>{formatInvoiceNumber(inv.invoiceNumber)}</strong> in payment reference.<br />
              This is a computer generated invoice — no signature required.
            </p>
          </div>
        </div>

        <div className="px-8 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 m-0 mb-2">Fare breakdown</p>
          <div className="flex justify-between items-center py-[6px] border-b border-[#E8ECF4] pb-2">
            <span className="text-[12px] text-[#374151] font-semibold">Total fare</span>
            <span className="text-[12px] font-bold text-[#111827]">
              ₹{fd.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="h-2" />
          {([
            ["CGST @ 2.5%", fd.cgst],
            ["SGST @ 2.5%", fd.sgst],
            ...(fd.toll > 0 ? [["Toll charges", fd.toll] as [string, number]] : []),
          ] as [string, number][]).map(([label, value]) => (
            <div key={label} className="flex justify-between items-center py-[6px] border-b border-[#F3F4F6]">
              <span className="text-[11px] text-gray-500">{label}</span>
              <span className="text-[12px] text-[#374151]">
                ₹{value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
          <div
            className="rounded-[10px] px-[18px] py-4 mt-[14px] flex justify-between items-center"
            style={{ background: NAVY }}
          >
            <span className="text-[13px] text-white/70">Total due</span>
            <span className="text-[24px] font-bold text-white tracking-[-0.5px]">
              ₹{fd.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 leading-[1.5] italic m-0">
            In words: {numWords(fd.total)}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-[0.875rem] flex justify-between items-center flex-wrap gap-2 border-t border-[#E8ECF4]">
        <span className="text-[11px] text-gray-400">
          {formatInvoiceNumber(inv.invoiceNumber)} · {trip.tripRef || "—"} · {VI.name}
        </span>
        <span className="text-[11px] text-gray-400">Due {fmtDate(inv.dueDate)}</span>
      </div>
    </div>
  );
}

export const TripInvoiceDocument = forwardRef<HTMLDivElement, {
  inv: InvoiceDetail;
  mode?: "summary" | "detailed" | "trips-only" | "auto";
}>(
  function TripInvoiceDocument({ inv, mode = "auto" }, ref) {
    return (
      <div ref={ref} className="flex flex-col items-center gap-8 p-8 bg-[#F4F6FB]">
        {inv.trips.length === 0 ? (
          <div className="py-[60px] text-center text-gray-400 text-[14px]">
            No trip details available for this invoice.
          </div>
        ) : mode === "summary" ? (
          <ConsolidatedInvoiceCard inv={inv} />
        ) : mode === "trips-only" ? (
          <>
            {inv.trips.map((trip, idx) => (
              <TripInvoiceCard key={trip.tripId} trip={trip} inv={inv} idx={idx} />
            ))}
          </>
        ) : mode === "detailed" || mode === "auto" ? (
          <>
            <ConsolidatedInvoiceCard inv={inv} />
            {inv.trips.map((trip, idx) => (
              <TripInvoiceCard key={trip.tripId} trip={trip} inv={inv} idx={idx} />
            ))}
          </>
        ) : null}
      </div>
    );
  }
);

TripInvoiceDocument.displayName = "TripInvoiceDocument";

export default function TripInvoiceView({
  inv,
  onClose,
  mode = "auto",
}: {
  inv:      InvoiceDetail;
  onClose?: () => void;
  mode?:    "summary" | "detailed" | "trips-only" | "auto";
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

      pdf.save(`${formatInvoiceNumber(inv.invoiceNumber)}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
    } finally {
      document.head.removeChild(hideScrollbars);
      setDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#F4F6FB] overflow-y-auto"
      style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}
    >
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-[rgba(244,246,251,0.92)] backdrop-blur-[8px] border-b border-[#E2E6F0] px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-[10px]">
          <span className="text-[14px] font-bold font-mono" style={{ color: NAVY }}>
            {formatInvoiceNumber(inv.invoiceNumber)}
          </span>
          <span className="text-[13px] text-gray-500">
            · {inv.companyName} · {inv.tripCount} trip{inv.tripCount === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void downloadPdf()}
            disabled={downloading}
            className="px-[18px] py-[7px] rounded-[10px] text-[13px] font-semibold text-white border-[1.5px]"
            style={{
              background: NAVY,
              borderColor: NAVY_BORDER,
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
              className="px-[18px] py-[7px] border-[1.5px] border-[#E2E6F0] rounded-[10px] bg-white text-[#374151] text-[13px] font-semibold cursor-pointer"
              style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}
            >
              ← Back
            </button>
          )}
        </div>
      </div>

      <TripInvoiceDocument ref={contentRef} inv={inv} mode={mode} />
    </div>
  );
}

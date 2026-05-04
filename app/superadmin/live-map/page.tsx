"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Navigation, Circle, Search, AlertCircle, ChevronRight, ChevronLeft, X } from "lucide-react";
import { superadminApi, type LiveDriver, type LiveLocationEvent } from "@/lib/api";
import { getSocket } from "@/lib/socket";

const ACCENT = "#2563EB";
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const BANGALORE_CENTER: [number, number] = [77.5946, 12.9716];
const REFETCH_MS = 60 * 1000;

/* ── Map pin with car icon ──────────────────────────────────────────
   Teardrop pin (Google-Maps style) with a small car silhouette in the
   white inner disc. Color encodes status: green = Available,
   blue = On Trip, gray = Offline, red = SOS (with dashed outer ring). */
function carSvg(body: string, sos = false): string {
  const ring = sos
    ? `<circle cx="20" cy="18" r="19" fill="none" stroke="${body}" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.85"/>`
    : "";
  return `<svg width="40" height="54" viewBox="0 0 40 54" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="20" cy="52" rx="5" ry="1.5" fill="rgba(0,0,0,0.22)"/>
  ${ring}
  <path d="M20 51 C20 51 36 33 36 18 C36 8.06 28.84 0 20 0 C11.16 0 4 8.06 4 18 C4 33 20 51 20 51 Z"
        fill="${body}" stroke="white" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="20" cy="18" r="10" fill="white"/>
  <g transform="translate(20 18)" fill="${body}">
    <rect x="-6" y="-5.5" width="12" height="9" rx="2"/>
    <rect x="-4.5" y="-4.3" width="9" height="3.2" rx="0.6" fill="white"/>
    <line x1="0" y1="-4.3" x2="0" y2="-1.1" stroke="${body}" stroke-width="0.7"/>
    <rect x="-7" y="-1.5" width="1.4" height="2.8" rx="0.5"/>
    <rect x="5.6" y="-1.5" width="1.4" height="2.8" rx="0.5"/>
    <circle cx="-3.2" cy="3.8" r="1.4"/>
    <circle cx="3.2" cy="3.8" r="1.4"/>
  </g>
</svg>`;
}

function popupHtml(d: LiveDriver): string {
  const plate = d.vehicle?.plate ?? "—";
  const veh   = d.vehicle ? `${d.vehicle.model ?? ""}${d.vehicle.type ? `  ·  ${d.vehicle.type}` : ""}` : "No vehicle";
  const ref   = d.driver_ref ?? d.driver_id.slice(0, 8);
  const vendor= d.vendor?.name ?? "—";
  const route = d.trip ? `${d.trip.from} <span style="color:#CBD5E1;margin:0 3px;">→</span> ${d.trip.to}` : "Idle — no active trip";
  const badge = !d.is_online
    ? `<span style="background:#F1F5F9;color:#475569;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;display:inline-flex;align-items:center;gap:4px;">
         <span style="width:5px;height:5px;border-radius:50%;background:#94A3B8;display:inline-block;"></span>Offline
       </span>`
    : `<span style="background:#DCFCE7;color:#15803D;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;display:inline-flex;align-items:center;gap:4px;">
         <span style="width:5px;height:5px;border-radius:50%;background:#16A34A;display:inline-block;"></span>${d.status}
       </span>`;
  return `
    <div style="font-family:system-ui,sans-serif;min-width:210px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px;">
        <span style="font-size:13px;font-weight:800;color:#0F172A;">${escapeHtml(d.name)}</span>
        ${badge}
      </div>
      <div style="font-size:11px;color:#64748B;margin-bottom:8px;">${escapeHtml(d.phone)}</div>
      <div style="background:#F1F5F9;border-radius:8px;padding:8px 10px;margin-bottom:8px;">
        <div style="font-size:13.5px;font-weight:800;color:#0F172A;letter-spacing:0.6px;font-family:monospace;">${escapeHtml(plate)}</div>
        <div style="font-size:11px;color:#64748B;margin-top:3px;">${escapeHtml(veh)}</div>
      </div>
      <div style="border-top:1px solid #F1F5F9;padding-top:7px;">
        <div style="font-size:9.5px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">${escapeHtml(ref)} · ${escapeHtml(vendor)}</div>
        <div style="font-size:11.5px;color:#475569;">${route}</div>
      </div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]!));
}

let cssInjected = false;
function injectCss() {
  if (cssInjected || typeof document === "undefined") return;
  const s = document.createElement("style");
  s.textContent = `
    .drv-popup .mapboxgl-popup-content {
      padding: 12px 14px !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.16) !important;
      border: 1.5px solid #E8EEF4 !important;
    }
    .drv-popup .mapboxgl-popup-tip { display: none !important; }
  `;
  document.head.appendChild(s);
  cssInjected = true;
}

type MarkerVisual = { body: string; glow: string; sos: boolean };

// Pick the pin color by driver status. Offline = gray, Available = green,
// On Trip = blue, SOS = red with a dashed outer ring (selected just makes
// the pin a hair darker so it pops above siblings).
function markerColors(d: LiveDriver, selected: boolean): MarkerVisual {
  // SOS / panic — not yet wired to a backend flag, but reserved for the
  // moment we add it. Until then this branch is unreachable.
  const sos = (d as unknown as { sos?: boolean }).sos === true;
  if (sos) {
    return { body: "#EF4444", glow: "drop-shadow(0 0 10px rgba(239,68,68,0.55))", sos: true };
  }
  if (!d.is_online) {
    return { body: "#94A3B8", glow: "drop-shadow(0 1px 4px rgba(100,116,139,0.35))", sos: false };
  }
  if (d.status === "On Trip") {
    return {
      body: selected ? "#1D4ED8" : "#3B82F6",
      glow: selected
        ? "drop-shadow(0 0 9px rgba(37,99,235,0.55)) drop-shadow(0 2px 4px rgba(0,0,0,0.25))"
        : "drop-shadow(0 2px 6px rgba(59,130,246,0.45)) drop-shadow(0 1px 3px rgba(0,0,0,0.18))",
      sos: false,
    };
  }
  // Available
  return {
    body: selected ? "#15803D" : "#22C55E",
    glow: selected
      ? "drop-shadow(0 0 9px rgba(34,197,94,0.55)) drop-shadow(0 2px 4px rgba(0,0,0,0.25))"
      : "drop-shadow(0 2px 6px rgba(34,197,94,0.45)) drop-shadow(0 1px 3px rgba(0,0,0,0.18))",
    sos: false,
  };
}

function createMarkerEl(d: LiveDriver, selected: boolean): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;";
  const c = markerColors(d, selected);
  const plate = d.vehicle?.plate ?? d.driver_ref ?? "DRIVER";
  el.innerHTML = `
    <div class="car-wrap" style="filter:${c.glow};transition:filter 0.2s;">${carSvg(c.body, c.sos)}</div>
    <span class="reg-lbl" style="background:${selected ? ACCENT : "#fff"};color:${selected ? "#fff" : "#0F172A"};font-size:9px;font-weight:800;padding:2px 7px;border-radius:5px;box-shadow:0 2px 8px rgba(0,0,0,0.16);white-space:nowrap;font-family:monospace;letter-spacing:0.5px;margin-top:-2px;">${escapeHtml(plate)}</span>
  `;
  return el;
}

function updateMarkerStyle(el: HTMLDivElement, d: LiveDriver, selected: boolean, plate: string) {
  const wrap = el.querySelector(".car-wrap") as HTMLDivElement | null;
  const lbl  = el.querySelector(".reg-lbl")  as HTMLSpanElement | null;
  if (!wrap || !lbl) return;
  const c = markerColors(d, selected);
  wrap.innerHTML = carSvg(c.body, c.sos);
  wrap.style.filter = c.glow;
  lbl.style.background = selected ? ACCENT : "#fff";
  lbl.style.color      = selected ? "#fff" : "#0F172A";
  lbl.textContent = plate;
}

interface MarkerRef {
  marker: mapboxgl.Marker;
  el:     HTMLDivElement;
  popup:  mapboxgl.Popup;
  // Cached render keys — used to skip SVG/HTML rebuilds on pure position
  // updates so the hover popup doesn't flicker when socket events tick in.
  visKey:   string;
  popupKey: string;
}

export default function LiveMapPage() {
  const [drivers,    setDrivers]    = useState<LiveDriver[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen,  setPanelOpen]  = useState(true);
  const font = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<mapboxgl.Map | null>(null);
  const markersRef      = useRef<Record<string, MarkerRef>>({});
  const driversRef      = useRef<LiveDriver[]>([]);
  driversRef.current = drivers;

  /* ── Snapshot fetch ─────────────────────────────────────────── */
  const loadSnapshot = useCallback(async () => {
    try {
      const res = await superadminApi.liveMap.snapshot();
      setDrivers(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
    const t = setInterval(loadSnapshot, REFETCH_MS);
    return () => clearInterval(t);
  }, [loadSnapshot]);

  /* ── Socket subscription ────────────────────────────────────── */
  useEffect(() => {
    const sock = getSocket();

    const onUpdate = (ev: LiveLocationEvent) => {
      if (!ev.driver_id) return;
      setDrivers((prev) => {
        const idx = prev.findIndex((d) => d.driver_id === ev.driver_id);
        if (idx === -1) {
          // New driver appeared mid-session — refetch snapshot to get full row
          loadSnapshot();
          return prev;
        }
        const next = prev.slice();
        next[idx] = { ...next[idx], lat: ev.lat, lng: ev.lng, speed: ev.speed, updated_at: ev.updated_at };
        return next;
      });
    };

    sock.on("superadmin:location:update", onUpdate);
    return () => {
      sock.off("superadmin:location:update", onUpdate);
    };
  }, [loadSnapshot]);

  /* ── Mapbox init ────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) {
      setError("Mapbox token missing — set NEXT_PUBLIC_MAPBOX_TOKEN");
      return;
    }
    injectCss();
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: BANGALORE_CENTER,
      zoom: 11,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;

    return () => {
      Object.values(markersRef.current).forEach((m) => m.marker.remove());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
    };
  }, []);

  /* ── Reconcile markers on driver list change ─────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set<string>();

    drivers.forEach((d) => {
      seen.add(d.driver_id);
      const selected = d.driver_id === selectedId;
      const plate    = d.vehicle?.plate ?? d.driver_ref ?? "DRIVER";
      const existing = markersRef.current[d.driver_id];
      // Render keys — anything in here changing means we need to rebuild the
      // SVG / popup HTML. Pure position updates (lat/lng only) don't appear
      // here, so they don't trigger a DOM rebuild — that's what kept the
      // hover popup flickering on every socket tick.
      const visKey   = `${selected}|${d.is_online}|${d.status}|${plate}`;
      const popupKey = `${visKey}|${d.name}|${d.phone}|${d.vendor?.name ?? ""}|${d.vehicle?.model ?? ""}|${d.vehicle?.type ?? ""}|${d.trip?.from ?? ""}|${d.trip?.to ?? ""}|${d.trip?.booking_ref ?? ""}|${d.driver_ref ?? ""}`;

      if (existing) {
        existing.marker.setLngLat([d.lng, d.lat]);
        existing.popup.setLngLat([d.lng, d.lat]);
        if (existing.popupKey !== popupKey) {
          existing.popup.setHTML(popupHtml(d));
          existing.popupKey = popupKey;
        }
        if (existing.visKey !== visKey) {
          updateMarkerStyle(existing.el, d, selected, plate);
          existing.visKey = visKey;
        }
        return;
      }

      const el = createMarkerEl(d, selected);
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([d.lng, d.lat])
        .addTo(map);
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: [0, -66],
        className: "drv-popup",
        maxWidth: "270px",
      })
        .setLngLat([d.lng, d.lat])
        .setHTML(popupHtml(d));

      // Small grace period on mouseleave so cursor sliding from the marker
      // into the popup (which sits ~66px above) doesn't immediately tear it
      // down — that round-trip was the second source of flicker.
      let hideTimer: ReturnType<typeof setTimeout> | null = null;
      const showPopup = () => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (!popup.isOpen()) popup.addTo(map);
      };
      const hidePopupSoon = () => {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => { popup.remove(); hideTimer = null; }, 120);
      };
      el.addEventListener("mouseenter", showPopup);
      el.addEventListener("mouseleave", hidePopupSoon);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const cur = driversRef.current.find((x) => x.driver_id === d.driver_id);
        if (!cur) return;
        setSelectedId((prev) => (prev === d.driver_id ? null : d.driver_id));
        map.flyTo({ center: [cur.lng, cur.lat], zoom: 14, duration: 900, essential: true });
      });

      markersRef.current[d.driver_id] = { marker, el, popup, visKey, popupKey };
    });

    // Remove markers for drivers no longer in the list
    Object.keys(markersRef.current).forEach((id) => {
      if (!seen.has(id)) {
        markersRef.current[id].marker.remove();
        delete markersRef.current[id];
      }
    });
  }, [drivers, selectedId]);

  function handleTripClick(d: LiveDriver) {
    setSelectedId(d.driver_id);
    mapRef.current?.flyTo({ center: [d.lng, d.lat], zoom: 14, duration: 900, essential: true });
  }

  const onlineCount  = drivers.filter(d => d.is_online).length;
  const offlineCount = drivers.filter(d => !d.is_online).length;

  const filtered = drivers.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const plate = (d.vehicle?.plate ?? "").toLowerCase().replace(/-/g, "");
    return (
      d.name.toLowerCase().includes(q) ||
      (d.vendor?.name ?? "").toLowerCase().includes(q) ||
      (d.driver_ref ?? "").toLowerCase().includes(q) ||
      (d.trip?.booking_ref ?? "").toLowerCase().includes(q) ||
      plate.includes(q.replace(/-/g, ""))
    );
  });

  const selected = drivers.find((d) => d.driver_id === selectedId) ?? null;

  return (
    <div
      className="-m-4 md:-m-6 h-[calc(100%+2rem)] md:h-[calc(100%+3rem)]"
      style={{ fontFamily: font, color: "#0F172A", position: "relative", overflow: "hidden" }}
    >
      {/* ── Map (full bleed) ── */}
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />

      {/* ── Floating header card (top-left) ── */}
      <div style={{
        position: "absolute", top: 16, left: 16, zIndex: 10,
        display: "flex", alignItems: "center", gap: 14,
        background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)",
        border: "1.5px solid rgba(226,232,240,0.9)",
        borderRadius: 12, padding: "10px 16px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
      }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.15 }}>Live Map</p>
          <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>Real-time vehicle tracking across all vendors</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: 18, padding: "4px 10px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#16A34A", display: "inline-block" }} className="animate-pulse" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#15803D" }}>{onlineCount} live</span>
          </div>
          {offlineCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 18, padding: "4px 10px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#94A3B8", display: "inline-block" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>{offlineCount} offline</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Legend (top-left, below header) ── */}
      <div style={{
        position: "absolute", top: 76, left: 16, zIndex: 10,
        background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)",
        border: "1.5px solid rgba(226,232,240,0.9)",
        borderRadius: 11, padding: "9px 12px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        fontFamily: font,
      }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.6, marginRight: 2 }}>Legend</span>
        {[
          { color: "#22C55E", label: "Available" },
          { color: "#3B82F6", label: "On Trip"   },
          { color: "#94A3B8", label: "Offline"   },
        ].map((it) => (
          <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "#334155" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: it.color, flexShrink: 0, boxShadow: "0 0 0 1.5px white, 0 0 0 2.5px rgba(15,23,42,0.06)" }} />
            {it.label}
          </span>
        ))}
      </div>

      {/* Error banner */}
      {error && (
          <div style={{ position: "absolute", top: 12, left: 12, zIndex: 20, background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", borderRadius: 10, padding: "8px 12px", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}

        {/* Collapsed handle — click to reopen the panel */}
        {!panelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            title="Show drivers"
            style={{
              position: "absolute", top: 16, right: 16, zIndex: 10,
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 12px", height: 42, borderRadius: 11,
              border: "1.5px solid rgba(226,232,240,0.9)",
              background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)", cursor: "pointer",
              color: "#0F172A", fontFamily: font, fontWeight: 700, fontSize: 12.5,
            }}
          >
            <ChevronLeft className="h-4 w-4" style={{ color: "#64748B" }} />
            <span>{onlineCount} live{offlineCount > 0 ? ` · ${offlineCount} offline` : ""}</span>
          </button>
        )}

        {/* Right panel — search + drivers combined, collapsible */}
        {panelOpen && (
          <div style={{
            position: "absolute", top: 12, right: 12, bottom: 12, width: 320,
            zIndex: 10, borderRadius: 14, overflow: "hidden",
            background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)",
            border: "1.5px solid rgba(226,232,240,0.9)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            display: "flex", flexDirection: "column",
          }}>
            {/* Header — search + collapse */}
            <div style={{
              padding: "11px 12px",
              borderBottom: "1px solid #F1F5F9",
              display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
            }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search className="h-4 w-4" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search driver, vehicle, trip…"
                  style={{
                    width: "100%", paddingLeft: 34, paddingRight: search ? 30 : 10, height: 36,
                    borderRadius: 9, border: "1.5px solid #E2E8F0",
                    background: "#F8FAFC",
                    fontSize: 12.5, fontFamily: font, color: "#0F172A", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    title="Clear"
                    style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex" }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                title="Hide panel"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: "1.5px solid #E2E8F0", background: "#fff",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ChevronRight className="h-4 w-4" style={{ color: "#64748B" }} />
              </button>
            </div>

            {/* Sub-header — count */}
            <div style={{ padding: "9px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>Drivers</p>
              <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>
                {filtered.length} shown · {onlineCount} live · {offlineCount} offline
              </span>
            </div>

            {/* Driver list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {loading ? (
                <p style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8", fontSize: 13 }}>Loading…</p>
              ) : filtered.length === 0 ? (
                <p style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8", fontSize: 13 }}>
                  {drivers.length === 0 ? "No drivers online right now." : "No results."}
                </p>
              ) : filtered.map(d => {
                const isSel  = d.driver_id === selectedId;
                const plate  = d.vehicle?.plate ?? "—";
                return (
                  <div
                    key={d.driver_id}
                    onClick={() => handleTripClick(d)}
                    style={{
                      padding: "11px 15px", borderBottom: "1px solid #F8FAFC", cursor: "pointer",
                      background: isSel ? "#EFF6FF" : "transparent",
                      borderLeft: isSel ? `3px solid ${ACCENT}` : "3px solid transparent",
                      transition: "background 0.12s",
                    }}
                    onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                    onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", fontFamily: "monospace", letterSpacing: "0.3px" }}>
                        {plate}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: !d.is_online ? "#94A3B8" : "#16A34A" }}>
                        <Circle className="h-2 w-2 fill-current" /> {!d.is_online ? "Offline" : "Live"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>{d.name}</span>
                      {d.vehicle?.model && (
                        <span style={{ fontSize: 11, color: "#94A3B8" }}>· {d.vehicle.model}</span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: "#64748B" }}>
                      {d.trip
                        ? <>{d.trip.from} <span style={{ color: "#CBD5E1" }}>→</span> {d.trip.to}</>
                        : <span style={{ color: "#94A3B8", fontStyle: "italic" }}>Idle — no active trip</span>}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected detail card */}
        {selected && (() => {
          const speedKmh = selected.speed != null ? Math.round(selected.speed) : null;
          const lastSeen = (() => {
            const ms = Date.now() - new Date(selected.updated_at).getTime();
            const s  = Math.floor(ms / 1000);
            if (s < 60)   return `${s}s ago`;
            const m = Math.floor(s / 60);
            if (m < 60)   return `${m} min ago`;
            const h = Math.floor(m / 60);
            return `${h}h ago`;
          })();
          return (
          <div style={{
            position: "absolute", bottom: 12, left: 12, zIndex: 10,
            background: "rgba(255,255,255,0.97)", border: "1.5px solid rgba(226,232,240,0.9)",
            borderRadius: 14, padding: "13px 16px", width: 320, maxWidth: "calc(100vw - 24px)",
            backdropFilter: "blur(8px)", boxShadow: "0 6px 28px rgba(0,0,0,0.14)",
            fontFamily: font,
          }}>
            {/* Header row — ref + status + close */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: "#EFF6FF", padding: "3px 9px", borderRadius: 5, fontFamily: "monospace", letterSpacing: 0.4 }}>
                {selected.trip?.booking_ref ?? selected.driver_ref ?? selected.driver_id.slice(0, 8)}
              </span>
              <span style={{
                display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700,
                color: !selected.is_online ? "#475569" : "#15803D",
                background: !selected.is_online ? "#F1F5F9" : "#DCFCE7",
                padding: "3px 9px", borderRadius: 12,
              }}>
                <Circle className="h-2 w-2 fill-current" />
                {!selected.is_online ? "Offline" : selected.status}
              </span>
              <button
                onClick={() => setSelectedId(null)}
                title="Close"
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 0, display: "flex", alignItems: "center" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Driver name + phone */}
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 1 }}>{selected.name}</div>
            <div style={{ fontSize: 11.5, color: "#64748B", marginBottom: 10 }}>
              {selected.phone}
              {selected.vendor?.name && <> · <span style={{ fontWeight: 600, color: "#475569" }}>{selected.vendor.name}</span></>}
            </div>

            {/* Vehicle */}
            {selected.vehicle && (
              <div style={{ background: "#F1F5F9", borderRadius: 9, padding: "9px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A", fontFamily: "monospace", letterSpacing: 0.6 }}>{selected.vehicle.plate}</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                  {selected.vehicle.model ?? "—"}{selected.vehicle.type ? ` · ${selected.vehicle.type}` : ""}
                </div>
              </div>
            )}

            {/* Trip route */}
            {selected.trip ? (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#334155", marginBottom: 10, lineHeight: 1.45 }}>
                <Navigation className="h-3.5 w-3.5" style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
                <span><span style={{ color: "#475569" }}>{selected.trip.from}</span> <span style={{ color: "#CBD5E1", margin: "0 3px" }}>→</span> <span style={{ color: "#475569" }}>{selected.trip.to}</span></span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic", marginBottom: 10 }}>Idle — no active trip</div>
            )}

            {/* Live metrics — speed / last update */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, paddingTop: 9, borderTop: "1px solid #F1F5F9" }}>
              <div>
                <div style={{ fontSize: 9.5, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Speed</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                  {speedKmh != null ? <>{speedKmh}<span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600, marginLeft: 3 }}>km/h</span></> : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 9.5, color: "#94A3B8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>{selected.is_online ? "Last update" : "Last seen"}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: !selected.is_online ? "#94A3B8" : "#0F172A", fontVariantNumeric: "tabular-nums" }}>{lastSeen}</div>
              </div>
            </div>
          </div>
          );
        })()}
    </div>
  );
}

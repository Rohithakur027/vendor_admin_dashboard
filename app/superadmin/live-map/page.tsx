"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Navigation, Circle, Search, AlertCircle, ChevronRight, ChevronLeft, X, Clock, ArrowLeft, Calendar, ArrowRight } from "lucide-react";
import { superadminApi, type LiveDriver, type LiveLocationEvent, type LocationHistoryPoint } from "@/lib/api";
import { getSocket } from "@/lib/socket";

const ACCENT = "#2563EB";
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const BANGALORE_CENTER: [number, number] = [77.5946, 12.9716];
const REFETCH_MS = 60 * 1000;

/* ── Map pin with car icon ──────────────────────────────────────────── */
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
  const plate  = d.vehicle?.plate ?? "—";
  const veh    = d.vehicle ? `${d.vehicle.model ?? ""}${d.vehicle.type ? `  ·  ${d.vehicle.type}` : ""}` : "No vehicle";
  const ref    = d.driver_ref ?? d.driver_id.slice(0, 8);
  const vendor = d.vendor?.name ?? "—";
  const route  = d.trip
    ? `${d.trip.from} <span style="color:#CBD5E1;margin:0 3px;">→</span> ${d.trip.to}`
    : "Idle — no active trip";
  const badge  = !d.is_online
    ? `<span style="background:#F1F5F9;color:#475569;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;display:inline-flex;align-items:center;gap:4px;"><span style="width:5px;height:5px;border-radius:50%;background:#94A3B8;display:inline-block;"></span>Offline</span>`
    : `<span style="background:#DCFCE7;color:#15803D;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;display:inline-flex;align-items:center;gap:4px;"><span style="width:5px;height:5px;border-radius:50%;background:#16A34A;display:inline-block;"></span>${d.status}</span>`;
  return `
    <div onclick="window.__liveMapSelectDriver('${d.driver_id}',${d.lat},${d.lng})" style="font-family:system-ui,sans-serif;min-width:210px;cursor:pointer;">
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
      <div style="margin-top:9px;padding-top:7px;border-top:1px solid #F1F5F9;text-align:center;font-size:10px;font-weight:700;color:#2563EB;letter-spacing:0.3px;">View details →</div>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
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

    /* History — date card (transparent native input layered over a custom display) */
    .hist-date-card { position: relative; }
    .hist-date-card input[type="date"] {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      opacity: 0; cursor: pointer;
      border: none; padding: 0; margin: 0; background: transparent;
      font: inherit; color: transparent;
    }
    .hist-date-card input[type="date"]::-webkit-calendar-picker-indicator {
      position: absolute; inset: 0; width: 100%; height: 100%;
      opacity: 0; cursor: pointer;
    }
    .hist-date-card:hover .hist-date-display {
      background: #F1F5F9;
      border-color: #CBD5E1;
    }

    /* History — time card (transparent native input layered over a custom display) */
    .hist-time-card { position: relative; flex: 1; }
    .hist-time-card input[type="time"] {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      opacity: 0; cursor: pointer;
      border: none; padding: 0; margin: 0; background: transparent;
      font: inherit; color: transparent;
    }
    .hist-time-card input[type="time"]::-webkit-calendar-picker-indicator {
      position: absolute; inset: 0; width: 100%; height: 100%;
      opacity: 0; cursor: pointer;
    }
    .hist-time-card:hover .hist-time-display {
      background: #F1F5F9;
      border-color: #CBD5E1;
    }
    .hist-time-card:focus-within .hist-time-display {
      border-color: #2563EB;
      background: #fff;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
    }
  `;
  document.head.appendChild(s);
  cssInjected = true;
}

type MarkerVisual = { body: string; glow: string; sos: boolean };

function markerColors(d: LiveDriver, selected: boolean): MarkerVisual {
  const sos = (d as unknown as { sos?: boolean }).sos === true;
  if (sos) return { body: "#EF4444", glow: "drop-shadow(0 0 10px rgba(239,68,68,0.55))", sos: true };
  if (!d.is_online) return { body: "#94A3B8", glow: "drop-shadow(0 1px 4px rgba(100,116,139,0.35))", sos: false };
  if (d.status === "On Trip") {
    return {
      body: selected ? "#1D4ED8" : "#3B82F6",
      glow: selected
        ? "drop-shadow(0 0 9px rgba(37,99,235,0.55)) drop-shadow(0 2px 4px rgba(0,0,0,0.25))"
        : "drop-shadow(0 2px 6px rgba(59,130,246,0.45)) drop-shadow(0 1px 3px rgba(0,0,0,0.18))",
      sos: false,
    };
  }
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
  const c     = markerColors(d, selected);
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
  wrap.innerHTML   = carSvg(c.body, c.sos);
  wrap.style.filter = c.glow;
  lbl.style.background = selected ? ACCENT : "#fff";
  lbl.style.color      = selected ? "#fff" : "#0F172A";
  lbl.textContent = plate;
}

/* ── History layer helpers ──────────────────────────────────────────── */
const HIST_SOURCE = "driver-history";
const HIST_LINE   = "driver-history-line";
const HIST_DOTS   = "driver-history-dots";

function addHistoryLayers(map: mapboxgl.Map, points: LocationHistoryPoint[]): void {
  const coords = points.map((p) => [p.lng, p.lat]);
  map.addSource(HIST_SOURCE, {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: {},              geometry: { type: "LineString", coordinates: coords } },
        { type: "Feature", properties: { pt: "start" }, geometry: { type: "Point",      coordinates: coords[0] } },
        { type: "Feature", properties: { pt: "end" },   geometry: { type: "Point",      coordinates: coords[coords.length - 1] } },
      ],
    },
  });
  map.addLayer({
    id: HIST_LINE, type: "line", source: HIST_SOURCE,
    filter: ["==", "$type", "LineString"],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: { "line-color": "#2563EB", "line-width": 3, "line-opacity": 0.8 },
  });
  map.addLayer({
    id: HIST_DOTS, type: "circle", source: HIST_SOURCE,
    filter: ["==", "$type", "Point"],
    paint: {
      "circle-radius": 7,
      "circle-color": ["case", ["==", ["get", "pt"], "start"], "#22C55E", "#EF4444"],
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#fff",
    },
  });
}

function removeHistoryLayers(map: mapboxgl.Map): void {
  if (map.getLayer(HIST_DOTS))   map.removeLayer(HIST_DOTS);
  if (map.getLayer(HIST_LINE))   map.removeLayer(HIST_LINE);
  if (map.getSource(HIST_SOURCE)) map.removeSource(HIST_SOURCE);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface MarkerRef {
  marker:   mapboxgl.Marker;
  el:       HTMLDivElement;
  popup:    mapboxgl.Popup;
  visKey:   string;
  popupKey: string;
}

/* ── Component ──────────────────────────────────────────────────────── */
export default function LiveMapPage() {
  const [drivers,     setDrivers]     = useState<LiveDriver[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [search,      setSearch]      = useState("");
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [panelOpen,   setPanelOpen]   = useState(true);
  const [mapReady,    setMapReady]    = useState(false);

  // History mode
  const [mode,        setMode]        = useState<"live" | "history">("live");
  const [histSearch,  setHistSearch]  = useState("");
  const [histDriver,  setHistDriver]  = useState<LiveDriver | null>(null);
  const toDateStr = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, "0");
    const dd   = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  const todayStr     = toDateStr(new Date());
  const yesterdayStr = toDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const formatDateLong = (s: string) => {
    if (!s) return "";
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  };
  const [histDate,      setHistDate]      = useState<string>(todayStr);
  const [histStartTime, setHistStartTime] = useState<string>("00:00");
  const [histEndTime,   setHistEndTime]   = useState<string>("23:59");
  const [histApplied,   setHistApplied]   = useState<{ date: string; startTime: string; endTime: string } | null>(null);
  const [histPoints,    setHistPoints]    = useState<LocationHistoryPoint[] | null>(null);
  const [histLoading,   setHistLoading]   = useState(false);
  const [histError,     setHistError]     = useState<string | null>(null);

  const font = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<mapboxgl.Map | null>(null);
  const markersRef      = useRef<Record<string, MarkerRef>>({});
  const driversRef      = useRef<LiveDriver[]>([]);
  const modeRef         = useRef<"live" | "history">("live");
  driversRef.current = drivers;
  modeRef.current    = mode;

  // Strip <main> padding so map bleeds edge-to-edge
  useEffect(() => {
    const mainEl = document.querySelector<HTMLElement>("main");
    if (!mainEl) return;
    const prev = { padding: mainEl.style.padding, overflow: mainEl.style.overflow };
    mainEl.style.padding  = "0";
    mainEl.style.overflow = "hidden";
    return () => { mainEl.style.padding = prev.padding; mainEl.style.overflow = prev.overflow; };
  }, []);

  /* ── Snapshot fetch ─────────────────────────────────────────────── */
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

  /* ── Socket subscription ────────────────────────────────────────── */
  useEffect(() => {
    const sock = getSocket();
    const onUpdate = (ev: LiveLocationEvent) => {
      if (!ev.driver_id) return;
      setDrivers((prev) => {
        const idx = prev.findIndex((d) => d.driver_id === ev.driver_id);
        if (idx === -1) { loadSnapshot(); return prev; }
        const next = prev.slice();
        next[idx] = { ...next[idx], lat: ev.lat, lng: ev.lng, speed: ev.speed, updated_at: ev.updated_at };
        return next;
      });
    };
    const onOffline = (ev: { driver_id: string; user_id: string }) => {
      if (!ev.driver_id) return;
      setDrivers((prev) => {
        const idx = prev.findIndex((d) => d.driver_id === ev.driver_id);
        if (idx === -1) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx], is_online: false, status: "Offline", speed: null };
        return next;
      });
    };
    sock.on("superadmin:location:update", onUpdate);
    sock.on("superadmin:driver:offline",  onOffline);
    return () => {
      sock.off("superadmin:location:update", onUpdate);
      sock.off("superadmin:driver:offline",  onOffline);
    };
  }, [loadSnapshot]);

  /* ── Popup click → select driver ───────────────────────────────── */
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__liveMapSelectDriver = (
      driverId: string, lat: number, lng: number,
    ) => {
      setSelectedId((prev) => (prev === driverId ? null : driverId));
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 900, essential: true });
    };
    return () => { delete (window as unknown as Record<string, unknown>).__liveMapSelectDriver; };
  }, []);

  /* ── Mapbox init ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) { setError("Mapbox token missing — set NEXT_PUBLIC_MAPBOX_TOKEN"); return; }
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
    setMapReady(true);
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(mapContainerRef.current);
    return () => {
      ro.disconnect();
      Object.values(markersRef.current).forEach((m) => m.marker.remove());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  /* ── Reconcile markers ──────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    drivers.forEach((d) => {
      seen.add(d.driver_id);
      const selected = d.driver_id === selectedId;
      const plate    = d.vehicle?.plate ?? d.driver_ref ?? "DRIVER";
      const existing = markersRef.current[d.driver_id];
      const visKey   = `${selected}|${d.is_online}|${d.status}|${plate}`;
      const popupKey = `${visKey}|${d.name}|${d.phone}|${d.vendor?.name ?? ""}|${d.vehicle?.model ?? ""}|${d.vehicle?.type ?? ""}|${d.trip?.from ?? ""}|${d.trip?.to ?? ""}|${d.trip?.booking_ref ?? ""}|${d.driver_ref ?? ""}`;
      if (existing) {
        existing.marker.setLngLat([d.lng, d.lat]);
        existing.popup.setLngLat([d.lng, d.lat]);
        if (existing.popupKey !== popupKey) { existing.popup.setHTML(popupHtml(d)); existing.popupKey = popupKey; }
        if (existing.visKey   !== visKey)   { updateMarkerStyle(existing.el, d, selected, plate); existing.visKey = visKey; }
        return;
      }
      const el     = createMarkerEl(d, selected);
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([d.lng, d.lat]).addTo(map);
      const popup  = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: [0, -66], className: "drv-popup", maxWidth: "270px" })
        .setLngLat([d.lng, d.lat]).setHTML(popupHtml(d));
      let hideTimer: ReturnType<typeof setTimeout> | null = null;
      const showPopup = () => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (!popup.isOpen()) {
          popup.addTo(map);
          const popupEl = popup.getElement();
          if (popupEl) {
            popupEl.addEventListener("mouseenter", () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } });
            popupEl.addEventListener("mouseleave", hidePopupSoon);
          }
        }
      };
      const hidePopupSoon = () => { if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => { popup.remove(); hideTimer = null; }, 120); };
      el.addEventListener("mouseenter", showPopup);
      el.addEventListener("mouseleave", hidePopupSoon);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (modeRef.current === "history") return;
        const cur = driversRef.current.find((x) => x.driver_id === d.driver_id);
        if (!cur) return;
        setSelectedId((prev) => (prev === d.driver_id ? null : d.driver_id));
        map.flyTo({ center: [cur.lng, cur.lat], zoom: 14, duration: 900, essential: true });
      });
      markersRef.current[d.driver_id] = { marker, el, popup, visKey, popupKey };
    });
    Object.keys(markersRef.current).forEach((id) => {
      if (!seen.has(id)) { markersRef.current[id].marker.remove(); delete markersRef.current[id]; }
    });
  }, [drivers, selectedId, mapReady]);

  /* ── History: fetch points when driver / applied range changes ──── */
  useEffect(() => {
    if (!histDriver || !histApplied) { setHistPoints(null); setHistError(null); return; }
    const from = new Date(`${histApplied.date}T${histApplied.startTime}:00`);
    const to   = new Date(`${histApplied.date}T${histApplied.endTime}:59`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      setHistError("Invalid date/time range");
      setHistPoints(null);
      return;
    }
    setHistLoading(true);
    setHistError(null);
    superadminApi.drivers
      .locationHistory(histDriver.user_id, { from: from.toISOString(), to: to.toISOString() })
      .then((res) => setHistPoints(res.data.history))
      .catch((err) => setHistError(err instanceof Error ? err.message : "Failed to load history"))
      .finally(() => setHistLoading(false));
  }, [histDriver, histApplied]);

  /* ── History: draw / clear map layer ────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (mode !== "history" || !histPoints || histPoints.length < 2) {
      if (map.isStyleLoaded()) removeHistoryLayers(map);
      return;
    }
    const apply = () => {
      removeHistoryLayers(map);
      addHistoryLayers(map, histPoints);
      const lngs = histPoints.map((p) => p.lng);
      const lats  = histPoints.map((p) => p.lat);
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: { top: 60, bottom: 60, left: 60, right: 360 }, duration: 900 },
      );
    };
    if (map.isStyleLoaded()) apply(); else map.once("style.load", apply);
  }, [mode, histPoints]);

  /* ── Clean up history when switching back to live ────────────────── */
  useEffect(() => {
    if (mode === "live") {
      setHistDriver(null);
      setHistPoints(null);
      setHistSearch("");
      setHistError(null);
      setHistApplied(null);
      setSelectedId(null);
      const map = mapRef.current;
      if (map?.isStyleLoaded()) removeHistoryLayers(map);
    }
  }, [mode]);

  function handleTripClick(d: LiveDriver) {
    setSelectedId(d.driver_id);
    mapRef.current?.flyTo({ center: [d.lng, d.lat], zoom: 14, duration: 900, essential: true });
  }

  const onlineCount  = drivers.filter((d) => d.is_online).length;
  const offlineCount = drivers.filter((d) => !d.is_online).length;

  const filtered = drivers.filter((d) => {
    if (!search) return true;
    const q     = search.toLowerCase();
    const plate = (d.vehicle?.plate ?? "").toLowerCase().replace(/-/g, "");
    return (
      d.name.toLowerCase().includes(q) ||
      (d.vendor?.name ?? "").toLowerCase().includes(q) ||
      (d.driver_ref ?? "").toLowerCase().includes(q) ||
      (d.trip?.booking_ref ?? "").toLowerCase().includes(q) ||
      plate.includes(q.replace(/-/g, ""))
    );
  });

  const histFiltered = drivers.filter((d) => {
    if (!histSearch) return true;
    const q     = histSearch.toLowerCase();
    const plate = (d.vehicle?.plate ?? "").toLowerCase().replace(/-/g, "");
    return (
      d.name.toLowerCase().includes(q) ||
      (d.driver_ref ?? "").toLowerCase().includes(q) ||
      plate.includes(q.replace(/-/g, ""))
    );
  });

  const selected = drivers.find((d) => d.driver_id === selectedId) ?? null;

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="w-full h-full" style={{ fontFamily: font, color: "#0F172A", position: "relative", overflow: "hidden" }}>
      {/* Map (full bleed) */}
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />

      {/* Floating header (top-left) */}
      <div style={{ position: "absolute", top: 16, left: 16, zIndex: 10, display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(226,232,240,0.9)", borderRadius: 12, padding: "10px 16px", boxShadow: "0 4px 20px rgba(0,0,0,0.10)" }}>
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

      {/* Legend */}
      <div style={{ position: "absolute", top: 76, left: 16, zIndex: 10, background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(226,232,240,0.9)", borderRadius: 11, padding: "9px 12px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", fontFamily: font }}>
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

      {/* Collapsed handle */}
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          title="Show panel"
          style={{ position: "absolute", top: 16, right: 16, zIndex: 10, display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", height: 42, borderRadius: 11, border: "1.5px solid rgba(226,232,240,0.9)", background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", cursor: "pointer", color: "#0F172A", fontFamily: font, fontWeight: 700, fontSize: 12.5 }}
        >
          <ChevronLeft className="h-4 w-4" style={{ color: "#64748B" }} />
          <span>{onlineCount} live{offlineCount > 0 ? ` · ${offlineCount} offline` : ""}</span>
        </button>
      )}

      {/* ── Right panel ─────────────────────────────────────────────── */}
      {panelOpen && (
        <div style={{ position: "absolute", top: 12, right: 12, bottom: 12, width: 320, zIndex: 10, borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(226,232,240,0.9)", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>

          {/* Mode tabs + collapse */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #F1F5F9", display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
            <button
              onClick={() => setMode("live")}
              style={{ flex: 1, height: 32, borderRadius: 8, border: `1.5px solid ${mode === "live" ? ACCENT : "#E2E8F0"}`, background: mode === "live" ? "#EFF6FF" : "#fff", color: mode === "live" ? ACCENT : "#64748B", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: font }}
            >
              <Circle className="h-3 w-3 fill-current" /> Live
            </button>
            <button
              onClick={() => setMode("history")}
              style={{ flex: 1, height: 32, borderRadius: 8, border: `1.5px solid ${mode === "history" ? ACCENT : "#E2E8F0"}`, background: mode === "history" ? "#EFF6FF" : "#fff", color: mode === "history" ? ACCENT : "#64748B", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: font }}
            >
              <Clock className="h-3 w-3" /> History
            </button>
            <button
              onClick={() => setPanelOpen(false)}
              title="Hide panel"
              style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <ChevronRight className="h-4 w-4" style={{ color: "#64748B" }} />
            </button>
          </div>

          {/* ── LIVE MODE ── */}
          {mode === "live" && (
            <>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
                <div style={{ position: "relative" }}>
                  <Search className="h-4 w-4" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search driver, vehicle, trip…"
                    style={{ width: "100%", paddingLeft: 34, paddingRight: search ? 30 : 10, height: 36, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", fontSize: 12.5, fontFamily: font, color: "#0F172A", outline: "none", boxSizing: "border-box" }}
                  />
                  {search && (
                    <button onClick={() => setSearch("")} title="Clear" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex" }}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ padding: "9px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 800, color: "#0F172A" }}>Drivers</p>
                <span style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600 }}>{filtered.length} shown · {onlineCount} live · {offlineCount} offline</span>
              </div>
              <div style={{ flex: 1, overflowY: "auto" }}>
                {loading ? (
                  <p style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8", fontSize: 13 }}>Loading…</p>
                ) : filtered.length === 0 ? (
                  <p style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8", fontSize: 13 }}>
                    {drivers.length === 0 ? "No drivers online right now." : "No results."}
                  </p>
                ) : filtered.map((d) => {
                  const isSel = d.driver_id === selectedId;
                  const plate = d.vehicle?.plate ?? "—";
                  return (
                    <div
                      key={d.driver_id}
                      onClick={() => handleTripClick(d)}
                      style={{ padding: "11px 15px", borderBottom: "1px solid #F8FAFC", cursor: "pointer", background: isSel ? "#EFF6FF" : "transparent", borderLeft: isSel ? `3px solid ${ACCENT}` : "3px solid transparent", transition: "background 0.12s" }}
                      onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                      onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", fontFamily: "monospace", letterSpacing: "0.3px" }}>{plate}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: !d.is_online ? "#94A3B8" : "#16A34A" }}>
                          <Circle className="h-2 w-2 fill-current" /> {!d.is_online ? "Offline" : "Live"}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>{d.name}</span>
                        {d.vehicle?.model && <span style={{ fontSize: 11, color: "#94A3B8" }}>· {d.vehicle.model}</span>}
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
            </>
          )}

          {/* ── HISTORY MODE ── */}
          {mode === "history" && (
            <>
              {!histDriver ? (
                /* Driver picker */
                <>
                  <div style={{ padding: "8px 12px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
                    <div style={{ position: "relative" }}>
                      <Search className="h-4 w-4" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                      <input
                        value={histSearch}
                        onChange={(e) => setHistSearch(e.target.value)}
                        placeholder="Search driver or vehicle…"
                        style={{ width: "100%", paddingLeft: 34, paddingRight: histSearch ? 30 : 10, height: 36, borderRadius: 9, border: "1.5px solid #E2E8F0", background: "#F8FAFC", fontSize: 12.5, fontFamily: font, color: "#0F172A", outline: "none", boxSizing: "border-box" }}
                      />
                      {histSearch && (
                        <button onClick={() => setHistSearch("")} title="Clear" style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 4, display: "flex" }}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ padding: "9px 14px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
                    <p style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>
                      Select a driver to view their <strong style={{ color: "#0F172A" }}>location trail</strong> on the map.
                    </p>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {loading ? (
                      <p style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8", fontSize: 13 }}>Loading…</p>
                    ) : histFiltered.length === 0 ? (
                      <p style={{ textAlign: "center", padding: "32px 0", color: "#94A3B8", fontSize: 13 }}>No drivers found.</p>
                    ) : histFiltered.map((d) => (
                      <div
                        key={d.driver_id}
                        onClick={() => {
                          setHistDriver(d);
                          setHistApplied({ date: histDate, startTime: histStartTime, endTime: histEndTime });
                        }}
                        style={{ padding: "11px 15px", borderBottom: "1px solid #F8FAFC", cursor: "pointer", transition: "background 0.12s" }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F8FAFC"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{d.name}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, color: d.is_online ? "#16A34A" : "#94A3B8" }}>
                            <Circle className="h-2 w-2 fill-current" /> {d.is_online ? "Live" : "Offline"}
                          </span>
                        </div>
                        {d.vehicle && (
                          <div style={{ fontSize: 11.5, color: "#64748B", fontFamily: "monospace" }}>
                            {d.vehicle.plate}{d.vehicle.model ? ` · ${d.vehicle.model}` : ""}
                          </div>
                        )}
                        {!d.vehicle && d.driver_ref && (
                          <div style={{ fontSize: 11.5, color: "#94A3B8" }}>{d.driver_ref}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* History detail for selected driver */
                <>
                  <div style={{ padding: "9px 12px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
                    <button
                      onClick={() => { setHistDriver(null); setHistPoints(null); setHistError(null); setHistApplied(null); }}
                      style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#64748B", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: font }}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to drivers
                    </button>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
                    {/* Driver info */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 2 }}>{histDriver.name}</div>
                      {histDriver.vehicle ? (
                        <div style={{ fontSize: 12, color: "#64748B", fontFamily: "monospace" }}>
                          {histDriver.vehicle.plate}{histDriver.vehicle.model ? ` · ${histDriver.vehicle.model}` : ""}
                        </div>
                      ) : histDriver.driver_ref ? (
                        <div style={{ fontSize: 12, color: "#94A3B8" }}>{histDriver.driver_ref}</div>
                      ) : null}
                    </div>

                    {/* Date + time range selector */}
                    {(() => {
                      const isDirty =
                        !histApplied ||
                        histApplied.date      !== histDate ||
                        histApplied.startTime !== histStartTime ||
                        histApplied.endTime   !== histEndTime;
                      const rangeInvalid = histStartTime >= histEndTime;
                      const isEntireDay  = histStartTime === "00:00" && histEndTime === "23:59";
                      const setDay = () => { setHistStartTime("00:00"); setHistEndTime("23:59"); };

                      const presets: { label: string; date: string }[] = [
                        { label: "Today",     date: todayStr     },
                        { label: "Yesterday", date: yesterdayStr },
                      ];

                      return (
                        <div style={{ marginBottom: 16 }}>
                          {/* Header */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                              <Calendar className="h-3 w-3" /> Date & time range
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              {presets.map((p) => {
                                const active = histDate === p.date;
                                return (
                                  <button
                                    key={p.label}
                                    type="button"
                                    onClick={() => setHistDate(p.date)}
                                    style={{
                                      fontSize: 10.5, fontWeight: 700,
                                      padding: "3px 9px", borderRadius: 12,
                                      border: `1px solid ${active ? ACCENT : "#E2E8F0"}`,
                                      background: active ? "#EFF6FF" : "#fff",
                                      color: active ? ACCENT : "#64748B",
                                      cursor: "pointer", fontFamily: font,
                                      transition: "all 0.12s",
                                    }}
                                  >
                                    {p.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Date card (custom display over hidden native input) */}
                          <div className="hist-date-card" style={{ marginBottom: 10 }}>
                            <div
                              className="hist-date-display"
                              style={{
                                display: "flex", alignItems: "center", gap: 12,
                                height: 50, padding: "0 14px",
                                borderRadius: 11,
                                background: "#F8FAFC",
                                border: "1.5px solid #E2E8F0",
                                transition: "all 0.15s",
                              }}
                            >
                              <div style={{
                                width: 34, height: 34, borderRadius: 9,
                                background: "#EFF6FF",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0,
                              }}>
                                <Calendar className="h-4 w-4" style={{ color: ACCENT }} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                  Date
                                </div>
                                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginTop: 1 }}>
                                  {formatDateLong(histDate)}
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4" style={{ color: "#94A3B8", flexShrink: 0 }} />
                            </div>
                            <input
                              type="date"
                              value={histDate}
                              max={todayStr}
                              onChange={(e) => { if (e.target.value) setHistDate(e.target.value); }}
                              aria-label="Pick date"
                            />
                          </div>

                          {/* Time row */}
                          <div style={{ display: "flex", alignItems: "stretch", gap: 8, marginBottom: 10 }}>
                            {/* From */}
                            <div className="hist-time-card">
                              <div
                                className="hist-time-display"
                                style={{
                                  display: "flex", alignItems: "center", gap: 10,
                                  height: 50, padding: "0 12px",
                                  borderRadius: 11,
                                  background: "#F8FAFC",
                                  border: "1.5px solid #E2E8F0",
                                  transition: "all 0.15s",
                                }}
                              >
                                <div style={{
                                  width: 32, height: 32, borderRadius: 9,
                                  background: "#DCFCE7",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  flexShrink: 0,
                                }}>
                                  <Clock className="h-4 w-4" style={{ color: "#15803D" }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    From
                                  </div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginTop: 1, fontVariantNumeric: "tabular-nums" }}>
                                    {histStartTime}
                                  </div>
                                </div>
                              </div>
                              <input
                                type="time"
                                value={histStartTime}
                                onChange={(e) => { if (e.target.value) setHistStartTime(e.target.value); }}
                                aria-label="From time"
                              />
                            </div>

                            {/* Separator */}
                            <div style={{ display: "flex", alignItems: "center", color: "#CBD5E1", flexShrink: 0 }}>
                              <ArrowRight className="h-3.5 w-3.5" />
                            </div>

                            {/* To */}
                            <div className="hist-time-card">
                              <div
                                className="hist-time-display"
                                style={{
                                  display: "flex", alignItems: "center", gap: 10,
                                  height: 50, padding: "0 12px",
                                  borderRadius: 11,
                                  background: "#F8FAFC",
                                  border: "1.5px solid #E2E8F0",
                                  transition: "all 0.15s",
                                }}
                              >
                                <div style={{
                                  width: 32, height: 32, borderRadius: 9,
                                  background: "#FEE2E2",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  flexShrink: 0,
                                }}>
                                  <Clock className="h-4 w-4" style={{ color: "#B91C1C" }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    To
                                  </div>
                                  <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", marginTop: 1, fontVariantNumeric: "tabular-nums" }}>
                                    {histEndTime}
                                  </div>
                                </div>
                              </div>
                              <input
                                type="time"
                                value={histEndTime}
                                onChange={(e) => { if (e.target.value) setHistEndTime(e.target.value); }}
                                aria-label="To time"
                              />
                            </div>
                          </div>

                          {/* Entire-day shortcut */}
                          <button
                            type="button"
                            onClick={setDay}
                            disabled={isEntireDay}
                            style={{
                              width: "100%",
                              fontSize: 11, fontWeight: 600,
                              color: isEntireDay ? "#94A3B8" : "#475569",
                              background: isEntireDay ? "#F1F5F9" : "#fff",
                              border: "1px dashed #CBD5E1",
                              borderRadius: 8,
                              padding: "6px 10px",
                              cursor: isEntireDay ? "default" : "pointer",
                              marginBottom: 10,
                              fontFamily: font,
                            }}
                          >
                            {isEntireDay ? "✓ Entire day selected" : "Set entire day (00:00 — 23:59)"}
                          </button>

                          {/* Apply */}
                          <button
                            type="button"
                            disabled={!isDirty || rangeInvalid}
                            onClick={() => setHistApplied({ date: histDate, startTime: histStartTime, endTime: histEndTime })}
                            style={{
                              width: "100%", height: 40, borderRadius: 10, border: "none",
                              background: rangeInvalid ? "#FEE2E2" : (!isDirty ? "#CBD5E1" : ACCENT),
                              color: rangeInvalid ? "#991B1B" : "#fff",
                              fontSize: 13, fontWeight: 700,
                              cursor: (!isDirty || rangeInvalid) ? "not-allowed" : "pointer",
                              fontFamily: font,
                              boxShadow: (!isDirty || rangeInvalid) ? "none" : "0 2px 8px rgba(37,99,235,0.25)",
                              transition: "all 0.15s",
                            }}
                          >
                            {rangeInvalid ? "End must be after start" : (isDirty ? "Apply range" : "✓ Showing this range")}
                          </button>
                        </div>
                      );
                    })()}

                    {/* Loading */}
                    {histLoading && (
                      <div style={{ textAlign: "center", padding: "28px 0", color: "#94A3B8", fontSize: 13 }}>
                        Loading history…
                      </div>
                    )}

                    {/* Error */}
                    {histError && !histLoading && (
                      <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 9, padding: "10px 12px", fontSize: 12, color: "#991B1B", fontWeight: 600 }}>
                        {histError}
                      </div>
                    )}

                    {/* Results */}
                    {histPoints && !histLoading && (
                      histPoints.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "28px 0" }}>
                          <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 4 }}>No location data</div>
                          <div style={{ fontSize: 11.5, color: "#CBD5E1" }}>
                            No points recorded for{histApplied ? ` ${histApplied.date} ${histApplied.startTime}–${histApplied.endTime}` : " the selected range"}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Stats grid */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                            <div style={{ background: "#EFF6FF", borderRadius: 10, padding: "12px 14px" }}>
                              <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>{histPoints.length}</div>
                              <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 2 }}>points recorded</div>
                            </div>
                            <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px" }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", fontVariantNumeric: "tabular-nums" }}>
                                {histApplied ? `${histApplied.startTime}–${histApplied.endTime}` : ""}
                              </div>
                              <div style={{ fontSize: 10.5, color: "#64748B", marginTop: 2 }}>
                                {histApplied?.date ?? ""}
                              </div>
                            </div>
                          </div>

                          {/* Time range card */}
                          <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Route window</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E", flexShrink: 0, boxShadow: "0 0 0 2px #fff, 0 0 0 3.5px #22C55E44" }} />
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{fmtTime(histPoints[0].recorded_at)}</div>
                                <div style={{ fontSize: 10.5, color: "#94A3B8" }}>Start</div>
                              </div>
                            </div>
                            <div style={{ marginLeft: 4.5, width: 1, height: 14, background: "#E2E8F0", marginBottom: 8 }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444", flexShrink: 0, boxShadow: "0 0 0 2px #fff, 0 0 0 3.5px #EF444444" }} />
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{fmtTime(histPoints[histPoints.length - 1].recorded_at)}</div>
                                <div style={{ fontSize: 10.5, color: "#94A3B8" }}>Latest</div>
                              </div>
                            </div>
                          </div>

                        </>
                      )
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Live selected detail card (live mode only) ───────────────── */}
      {mode === "live" && selected && (() => {
        const speedKmh = selected.speed != null ? Math.round(selected.speed) : null;
        const lastSeen = (() => {
          const ms = Date.now() - new Date(selected.updated_at).getTime();
          const s  = Math.floor(ms / 1000);
          if (s < 60) return `${s}s ago`;
          const m = Math.floor(s / 60);
          if (m < 60) return `${m} min ago`;
          return `${Math.floor(m / 60)}h ago`;
        })();
        return (
          <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 10, background: "rgba(255,255,255,0.97)", border: "1.5px solid rgba(226,232,240,0.9)", borderRadius: 14, padding: "13px 16px", width: 320, maxWidth: "calc(100vw - 24px)", backdropFilter: "blur(8px)", boxShadow: "0 6px 28px rgba(0,0,0,0.14)", fontFamily: font }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, background: "#EFF6FF", padding: "3px 9px", borderRadius: 5, fontFamily: "monospace", letterSpacing: 0.4 }}>
                {selected.trip?.booking_ref ?? selected.driver_ref ?? selected.driver_id.slice(0, 8)}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: !selected.is_online ? "#475569" : "#15803D", background: !selected.is_online ? "#F1F5F9" : "#DCFCE7", padding: "3px 9px", borderRadius: 12 }}>
                <Circle className="h-2 w-2 fill-current" />
                {!selected.is_online ? "Offline" : selected.status}
              </span>
              <button onClick={() => setSelectedId(null)} title="Close" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 0, display: "flex", alignItems: "center" }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 1 }}>{selected.name}</div>
            <div style={{ fontSize: 11.5, color: "#64748B", marginBottom: 10 }}>
              {selected.phone}
              {selected.vendor?.name && <> · <span style={{ fontWeight: 600, color: "#475569" }}>{selected.vendor.name}</span></>}
            </div>
            {selected.vehicle && (
              <div style={{ background: "#F1F5F9", borderRadius: 9, padding: "9px 12px", marginBottom: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0F172A", fontFamily: "monospace", letterSpacing: 0.6 }}>{selected.vehicle.plate}</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{selected.vehicle.model ?? "—"}{selected.vehicle.type ? ` · ${selected.vehicle.type}` : ""}</div>
              </div>
            )}
            {selected.trip ? (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, color: "#334155", marginBottom: 10, lineHeight: 1.45 }}>
                <Navigation className="h-3.5 w-3.5" style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
                <span>
                  <span style={{ color: "#475569" }}>{selected.trip.from}</span>
                  <span style={{ color: "#CBD5E1", margin: "0 3px" }}>→</span>
                  <span style={{ color: "#475569" }}>{selected.trip.to}</span>
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic", marginBottom: 10 }}>Idle — no active trip</div>
            )}
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

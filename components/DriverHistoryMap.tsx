"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { superadminApi, type LocationHistoryPoint } from "@/lib/api";

// Mapbox loaded lazily to avoid SSR issues
let mapboxgl: typeof import("mapbox-gl") | null = null;

async function loadMapbox() {
  if (mapboxgl) return mapboxgl;
  mapboxgl = await import("mapbox-gl");
  return mapboxgl;
}

type HistoryRange = { from: string; to: string } | { hours: number };

interface Props {
  driverId:    string;
  driverName:  string;
  hours?:      number;
  /** When set, overrides the internal 6h/12h/24h controls and fetches this exact range. */
  range?:      { from: string; to: string } | null;
  /** Override the default fetch (superadmin API). Vendor pages pass their own fetcher. */
  fetchPoints?: (driverId: string, range: HistoryRange) => Promise<LocationHistoryPoint[]>;
}

interface HistoryState {
  loading: boolean;
  error:   string | null;
  points:  LocationHistoryPoint[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatSpeed(s: number | null) {
  if (s == null) return "—";
  return `${Math.round(s)} km/h`;
}

async function defaultFetchPoints(driverId: string, range: HistoryRange): Promise<LocationHistoryPoint[]> {
  const res = await superadminApi.drivers.locationHistory(driverId, range);
  return res.data?.history ?? [];
}

export function DriverHistoryMap({ driverId, driverName, hours = 12, range: rangeProp, fetchPoints = defaultFetchPoints }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<import("mapbox-gl").Map | null>(null);
  const markerRef       = useRef<import("mapbox-gl").Marker | null>(null);
  const animFrameRef    = useRef<number | null>(null);

  const [state,        setState]        = useState<HistoryState>({ loading: true, error: null, points: [] });
  const [scrubIdx,     setScrubIdx]     = useState(0);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [hoursFilter,  setHoursFilter]  = useState(hours);
  const [mapReady,     setMapReady]     = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<LocationHistoryPoint | null>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // ── Fetch history ────────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setState({ loading: true, error: null, points: [] });
    setScrubIdx(0);
    setIsPlaying(false);
    try {
      const range: HistoryRange = rangeProp ?? { hours: hoursFilter };
      const points = await fetchPoints(driverId, range);
      setState({ loading: false, error: null, points });
    } catch (err) {
      setState({ loading: false, error: (err as Error).message, points: [] });
    }
  }, [driverId, hoursFilter, rangeProp, fetchPoints]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Init map ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || !token) return;
    let map: import("mapbox-gl").Map;

    loadMapbox().then((mb) => {
      mb.default.accessToken = token;
      map = new mb.default.Map({
        container: mapContainerRef.current!,
        style:     "mapbox://styles/mapbox/light-v11",
        center:    [77.5946, 12.9716], // Bangalore default
        zoom:      11,
      });

      map.on("load", () => {
        mapRef.current = map;
        setMapReady(true);
      });
    });

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      map?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Draw route when map + points are ready ───────────────────────────────────
  useEffect(() => {
    const map    = mapRef.current;
    const points = state.points;
    if (!map || !mapReady || points.length === 0) return;

    const coords = points.map((p) => [p.lng, p.lat] as [number, number]);

    // Remove previous layers/sources
    ["route-line", "route-start", "route-end"].forEach((id) => {
      if (map.getLayer(id))  map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });

    // Line
    map.addSource("route-line", {
      type: "geojson",
      data: { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} },
    });
    map.addLayer({
      id:     "route-line",
      type:   "line",
      source: "route-line",
      layout: { "line-join": "round", "line-cap": "round" },
      paint:  { "line-color": "#2563EB", "line-width": 3, "line-opacity": 0.85 },
    });

    // Start marker (green)
    const startEl = document.createElement("div");
    startEl.style.cssText = "width:14px;height:14px;border-radius:50%;background:#22C55E;border:3px solid #fff;box-shadow:0 0 0 2px #22C55E;";
    new (mapboxgl!.default.Marker)({ element: startEl })
      .setLngLat(coords[0])
      .setPopup(new (mapboxgl!.default.Popup)({ offset: 14 }).setText(`Start · ${formatTime(points[0].recorded_at)}`))
      .addTo(map);

    // End marker (red)
    const endEl = document.createElement("div");
    endEl.style.cssText = "width:14px;height:14px;border-radius:50%;background:#EF4444;border:3px solid #fff;box-shadow:0 0 0 2px #EF4444;";
    new (mapboxgl!.default.Marker)({ element: endEl })
      .setLngLat(coords[coords.length - 1])
      .setPopup(new (mapboxgl!.default.Popup)({ offset: 14 }).setText(`End · ${formatTime(points[points.length - 1].recorded_at)}`))
      .addTo(map);

    // Animated playhead marker (blue)
    const headEl = document.createElement("div");
    headEl.style.cssText = "width:18px;height:18px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 2px 8px rgba(37,99,235,0.5);cursor:pointer;";
    const headMarker = new (mapboxgl!.default.Marker)({ element: headEl })
      .setLngLat(coords[0])
      .addTo(map);
    markerRef.current = headMarker;

    // Fit bounds
    const lngs = coords.map(c => c[0]);
    const lats  = coords.map(c => c[1]);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 60, maxZoom: 15, duration: 800 },
    );

    setScrubIdx(0);
  }, [mapReady, state.points]);

  // ── Sync playhead marker to scrubIdx ────────────────────────────────────────
  useEffect(() => {
    const marker = markerRef.current;
    const pt     = state.points[scrubIdx];
    if (!marker || !pt) return;
    marker.setLngLat([pt.lng, pt.lat]);
    setHoveredPoint(pt);
  }, [scrubIdx, state.points]);

  // ── Playback animation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || state.points.length === 0) return;

    let idx = scrubIdx;
    const step = () => {
      idx += 1;
      if (idx >= state.points.length) {
        setIsPlaying(false);
        return;
      }
      setScrubIdx(idx);
      animFrameRef.current = setTimeout(() => step(), 80) as unknown as number;
    };
    animFrameRef.current = setTimeout(() => step(), 80) as unknown as number;

    return () => {
      if (animFrameRef.current) clearTimeout(animFrameRef.current as unknown as number);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  if (!token) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        <p className="text-sm text-slate-400">NEXT_PUBLIC_MAPBOX_TOKEN is not set.</p>
      </div>
    );
  }

  const { loading, error, points } = state;
  const currentPt = points[scrubIdx] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {!rangeProp && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {[6, 12, 24].map((h) => (
              <button
                key={h}
                onClick={() => setHoursFilter(h)}
                style={{
                  padding: "5px 14px", borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  background: hoursFilter === h ? "#2563EB" : "#F1F5F9",
                  color:      hoursFilter === h ? "#fff"    : "#64748B",
                  border:     hoursFilter === h ? "none"    : "1px solid #E2E8F0",
                }}
              >
                {h}h
              </button>
            ))}
          </div>
        )}

        <button
          onClick={fetchHistory}
          disabled={loading}
          style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", background: "#F1F5F9", color: "#334155", border: "1px solid #E2E8F0" }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>

        {points.length > 0 && (
          <button
            onClick={() => {
              if (scrubIdx >= points.length - 1) setScrubIdx(0);
              setIsPlaying((v) => !v);
            }}
            style={{ padding: "5px 18px", borderRadius: 20, fontSize: 12.5, fontWeight: 700, cursor: "pointer", background: "#2563EB", color: "#fff", border: "none" }}
          >
            {isPlaying ? "⏸ Pause" : scrubIdx >= points.length - 1 ? "↺ Replay" : "▶ Play"}
          </button>
        )}

        <span style={{ marginLeft: "auto", fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>
          {loading ? "Loading…" : `${points.length} point${points.length !== 1 ? "s" : ""}${rangeProp ? "" : ` · last ${hoursFilter}h`}`}
        </span>
      </div>

      {/* Map container */}
      <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", border: "1.5px solid #E8EEF4", height: 380 }}>
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

        {/* Loading / error / empty overlay */}
        {(loading || error || (!loading && points.length === 0)) && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(248,250,252,0.9)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {loading && (
              <>
                <div style={{ width: 28, height: 28, border: "3px solid #E2E8F0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <p style={{ fontSize: 13, color: "#64748B" }}>Loading route history…</p>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </>
            )}
            {!loading && error && <p style={{ fontSize: 13, color: "#EF4444" }}>{error}</p>}
            {!loading && !error && points.length === 0 && (
              <p style={{ fontSize: 13, color: "#94A3B8" }}>
                {rangeProp
                  ? "No location history found for the selected range."
                  : `No location history found for the last ${hoursFilter}h.`}
              </p>
            )}
          </div>
        )}

        {/* Speed tooltip */}
        {currentPt && !loading && points.length > 0 && (
          <div style={{
            position: "absolute", bottom: 14, left: 14,
            background: "rgba(15,23,42,0.82)", backdropFilter: "blur(8px)",
            color: "#fff", borderRadius: 10, padding: "8px 14px",
            fontSize: 12.5, fontWeight: 600, lineHeight: 1.6,
            pointerEvents: "none",
          }}>
            <div>{formatTime(currentPt.recorded_at)}</div>
            <div style={{ color: "rgba(255,255,255,0.7)" }}>Speed: {formatSpeed(currentPt.speed)}</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
              {scrubIdx + 1} / {points.length}
            </div>
          </div>
        )}
      </div>

      {/* Timeline scrubber */}
      {points.length > 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <input
            type="range"
            min={0}
            max={points.length - 1}
            value={scrubIdx}
            onChange={(e) => {
              setIsPlaying(false);
              setScrubIdx(parseInt(e.target.value, 10));
            }}
            style={{ width: "100%", accentColor: "#2563EB", cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94A3B8" }}>
            <span>{formatTime(points[0].recorded_at)}</span>
            <span style={{ fontWeight: 700, color: "#2563EB" }}>{driverName}</span>
            <span>{formatTime(points[points.length - 1].recorded_at)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

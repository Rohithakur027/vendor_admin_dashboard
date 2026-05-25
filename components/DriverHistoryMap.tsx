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
  route:   [number, number][] | null;
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

type MapMatchingResponse = {
  code?: string;
  message?: string;
  matchings?: Array<{
    geometry?: {
      type?: "LineString";
      coordinates?: [number, number][];
    } | [number, number][];
  }>;
};

function dedupeHistoryPoints(points: LocationHistoryPoint[]): LocationHistoryPoint[] {
  const out: LocationHistoryPoint[] = [];
  for (const point of points) {
    const prev = out[out.length - 1];
    if (prev && prev.lat === point.lat && prev.lng === point.lng) continue;
    out.push(point);
  }
  return out;
}

function sampleHistoryPoints(points: LocationHistoryPoint[], maxPoints = 100): LocationHistoryPoint[] {
  if (points.length <= maxPoints) return points;
  const sampled: LocationHistoryPoint[] = [];
  const lastIdx = points.length - 1;
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round((i * lastIdx) / (maxPoints - 1));
    const point = points[idx];
    if (!sampled.length || sampled[sampled.length - 1] !== point) sampled.push(point);
  }
  return sampled;
}

async function fetchMatchedRoute(points: LocationHistoryPoint[], token: string): Promise<[number, number][] | null> {
  const cleaned = sampleHistoryPoints(dedupeHistoryPoints(points), 100);
  if (cleaned.length < 2) return null;

  const coordinates = cleaned.map((p) => `${p.lng},${p.lat}`).join(";");
  const radiuses = cleaned.map(() => "25").join(";");
  const url =
    `https://api.mapbox.com/matching/v5/mapbox/driving/${coordinates}` +
    `?geometries=geojson&overview=full&tidy=true&radiuses=${radiuses}&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Map matching failed (${res.status})`);

  const json = (await res.json()) as MapMatchingResponse;
  const matchings = json.matchings ?? [];
  if (matchings.length === 0) return null;

  const route: [number, number][] = [];
  for (const matching of matchings) {
    const geometry = matching.geometry;
    const coords = Array.isArray(geometry) ? geometry : geometry?.coordinates;
    if (!coords || coords.length === 0) continue;
    for (const coord of coords) {
      const prev = route[route.length - 1];
      if (prev && prev[0] === coord[0] && prev[1] === coord[1]) continue;
      route.push([coord[0], coord[1]]);
    }
  }

  return route.length >= 2 ? route : null;
}

export function DriverHistoryMap({ driverId, driverName, hours = 12, range: rangeProp, fetchPoints = defaultFetchPoints }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<import("mapbox-gl").Map | null>(null);
  const markerRef       = useRef<import("mapbox-gl").Marker | null>(null);
  const animFrameRef    = useRef<number | null>(null);

  const [state,        setState]        = useState<HistoryState>({ loading: true, error: null, points: [], route: null });
  const [scrubIdx,     setScrubIdx]     = useState(0);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [hoursFilter,  setHoursFilter]  = useState(hours);
  const [mapReady,     setMapReady]     = useState(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // ── Fetch history ────────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setState({ loading: true, error: null, points: [], route: null });
    setScrubIdx(0);
    setIsPlaying(false);
    try {
      const range: HistoryRange = rangeProp ?? { hours: hoursFilter };
      const points = await fetchPoints(driverId, range);
      let route: [number, number][] | null = null;
      try {
        if (token) route = await fetchMatchedRoute(points, token);
      } catch {
        route = null;
      }
      setState({ loading: false, error: null, points, route });
    } catch (err) {
      setState({ loading: false, error: (err as Error).message, points: [], route: null });
    }
  }, [driverId, hoursFilter, rangeProp, fetchPoints, token]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchHistory(); }, [fetchHistory]);

  // ── Init map ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || !token) return;
    let map: import("mapbox-gl").Map;

    loadMapbox().then((mb) => {
      mb.default.accessToken = token;
      map = new mb.default.Map({
        container: mapContainerRef.current!,
        style:     "mapbox://styles/mapbox/streets-v12",
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
  }, [token]);

  // ── Draw route when map + points are ready ───────────────────────────────────
  useEffect(() => {
    const map    = mapRef.current;
    const points = state.points;
    if (!map || !mapReady || points.length === 0) return;

    const rawCoords = points.map((p) => [p.lng, p.lat] as [number, number]);
    const coords = state.route ?? rawCoords;

    // Remove previous layers/sources
    ["route-line", "route-start", "route-end", "route-line-outline"].forEach((id) => {
      if (map.getLayer(id))  map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });

    // Line
    map.addSource("route-line", {
      type: "geojson",
      data: { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} },
    });
    map.addLayer({
      id:     "route-line-outline",
      type:   "line",
      source: "route-line",
      layout: { "line-join": "round", "line-cap": "round" },
      paint:  { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.8 },
    });
    map.addLayer({
      id:     "route-line",
      type:   "line",
      source: "route-line",
      layout: { "line-join": "round", "line-cap": "round" },
      paint:  { "line-color": "#2563EB", "line-width": 5, "line-opacity": 0.95 },
    });

    // Start marker (green)
    const startEl = document.createElement("div");
    startEl.style.cssText = "width:14px;height:14px;border-radius:50%;background:#22C55E;border:3px solid #fff;box-shadow:0 0 0 2px #22C55E;";
    new (mapboxgl!.default.Marker)({ element: startEl })
      .setLngLat(rawCoords[0])
      .setPopup(new (mapboxgl!.default.Popup)({ offset: 14 }).setText(`Start · ${formatTime(points[0].recorded_at)}`))
      .addTo(map);

    // End marker (red)
    const endEl = document.createElement("div");
    endEl.style.cssText = "width:14px;height:14px;border-radius:50%;background:#EF4444;border:3px solid #fff;box-shadow:0 0 0 2px #EF4444;";
    new (mapboxgl!.default.Marker)({ element: endEl })
      .setLngLat(rawCoords[rawCoords.length - 1])
      .setPopup(new (mapboxgl!.default.Popup)({ offset: 14 }).setText(`End · ${formatTime(points[points.length - 1].recorded_at)}`))
      .addTo(map);

    // Animated playhead marker (blue)
    const headEl = document.createElement("div");
    headEl.style.cssText = "width:18px;height:18px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 2px 8px rgba(37,99,235,0.5);cursor:pointer;";
    const headMarker = new (mapboxgl!.default.Marker)({ element: headEl })
      .setLngLat(rawCoords[0])
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
  }, [mapReady, state.points, state.route]);

  // ── Sync playhead marker to scrubIdx ────────────────────────────────────────
  useEffect(() => {
    const marker = markerRef.current;
    const pt     = state.points[scrubIdx];
    if (!marker || !pt) return;
    marker.setLngLat([pt.lng, pt.lat]);
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
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Map container — streets-v12 style matching main Live Map */}
      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", border: "1.5px solid #E8EEF4", height: 420, boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

        {/* Floating header — matches main Live Map header card */}
        <div style={{
          position: "absolute", top: 14, left: 14,
          background: "rgba(255,255,255,0.96)", backdropFilter: "blur(10px)",
          borderRadius: 12, padding: "10px 16px", boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
          border: "1px solid rgba(226,232,240,0.8)", minWidth: 200,
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.2px" }}>
            Location History
          </div>
          <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>{driverName}</div>
        </div>

        {/* Legend pill — matches main Live Map legend */}
        <div style={{
          position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.96)", backdropFilter: "blur(10px)",
          borderRadius: 20, padding: "6px 14px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
          border: "1px solid rgba(226,232,240,0.8)",
          display: "flex", alignItems: "center", gap: 14, fontSize: 12, fontWeight: 600,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} />
            Start
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#64748B" }}>
            <span style={{ width: 34, height: 3, background: "linear-gradient(to right,#A5B4FC,#2563EB)", borderRadius: 2, display: "inline-block" }} />
            Route
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#EF4444", display: "inline-block" }} />
            End
          </span>
        </div>

        {/* Controls — top-right floating pill matching main Live Map style */}
        <div style={{
          position: "absolute", top: 14, right: 14,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          {!rangeProp && (
            <div style={{
              background: "rgba(255,255,255,0.96)", backdropFilter: "blur(10px)",
              borderRadius: 20, padding: "4px 6px", boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
              border: "1px solid rgba(226,232,240,0.8)",
              display: "flex", alignItems: "center", gap: 4,
            }}>
              {[6, 12, 24].map((h) => (
                <button
                  key={h}
                  onClick={() => setHoursFilter(h)}
                  style={{
                    padding: "4px 12px", borderRadius: 16, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: hoursFilter === h ? "#2563EB" : "transparent",
                    color:      hoursFilter === h ? "#fff"    : "#64748B",
                    border: "none", transition: "all 0.15s",
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
            style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              background: "rgba(255,255,255,0.96)", backdropFilter: "blur(10px)",
              color: "#334155", border: "1px solid rgba(226,232,240,0.8)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            }}
          >
            {loading ? "Loading…" : "↻ Refresh"}
          </button>
        </div>

        {/* Play/Pause button — bottom-right floating, matching main Live Map action style */}
        {points.length > 0 && (
          <div style={{ position: "absolute", bottom: 14, right: 14 }}>
            <button
              onClick={() => {
                if (scrubIdx >= points.length - 1) setScrubIdx(0);
                setIsPlaying((v) => !v);
              }}
              style={{
                padding: "8px 20px", borderRadius: 20, fontSize: 13, fontWeight: 700,
                cursor: "pointer", background: "#2563EB", color: "#fff", border: "none",
                boxShadow: "0 2px 12px rgba(37,99,235,0.35)",
              }}
            >
              {isPlaying ? "⏸ Pause" : scrubIdx >= points.length - 1 ? "↺ Replay" : "▶ Play"}
            </button>
          </div>
        )}

        {/* Loading / error / empty overlay */}
        {(loading || error || (!loading && points.length === 0)) && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(248,250,252,0.92)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            {loading && (
              <>
                <div style={{ width: 32, height: 32, border: "3px solid #E2E8F0", borderTopColor: "#2563EB", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <p style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>Loading route history…</p>
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

        {/* Speed tooltip — bottom-left, matching main Live Map detail card style */}
        {currentPt && !loading && points.length > 0 && (
          <div style={{
            position: "absolute", bottom: 14, left: 14,
            background: "rgba(15,23,42,0.85)", backdropFilter: "blur(10px)",
            color: "#fff", borderRadius: 12, padding: "10px 16px",
            fontSize: 12.5, fontWeight: 600, lineHeight: 1.7,
            pointerEvents: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{formatTime(currentPt.recorded_at)}</div>
            <div style={{ color: "rgba(255,255,255,0.7)" }}>Speed: {formatSpeed(currentPt.speed)}</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>
              {scrubIdx + 1} / {points.length} pts
            </div>
          </div>
        )}
      </div>

      {/* Timeline scrubber — below the map card */}
      {points.length > 1 && (
        <div style={{
          background: "#fff", border: "1.5px solid #E8EEF4", borderTop: "none",
          borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
          padding: "12px 18px", display: "flex", flexDirection: "column", gap: 6,
        }}>
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

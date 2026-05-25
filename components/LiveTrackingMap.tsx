'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { io, type Socket } from 'socket.io-client'

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:3001'
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
const DEFAULT_CENTER: [number, number] = [77.5946, 12.9716]
const ANIM_MS = 4500

export interface LiveTrackingMapProps {
  booking_id: string
  pickup_address: string
  drop_address: string
  pickup_lat?: number
  pickup_lng?: number
  drop_lat?: number
  drop_lng?: number
  driver_name?: string | null
  driver_phone?: string | null
  booking_ref?: string | null
}

type TrackState = 'initializing' | 'no_location' | 'live' | 'completed' | 'token_error'

function calculateBearing(start: [number, number], end: [number, number]): number {
  const startLat = (start[1] * Math.PI) / 180
  const startLng = (start[0] * Math.PI) / 180
  const endLat = (end[1] * Math.PI) / 180
  const endLng = (end[0] * Math.PI) / 180
  const dLng = endLng - startLng
  const x = Math.sin(dLng) * Math.cos(endLat)
  const y =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng)
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360
}

async function geocode(address: string): Promise<[number, number] | null> {
  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.startsWith('pk.dummy')) return null
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&country=IN`,
    )
    if (!res.ok) return null
    const json = (await res.json()) as { features?: { center: [number, number] }[] }
    return json.features?.[0]?.center ?? null
  } catch {
    return null
  }
}

function makeCarEl(): { host: HTMLDivElement; icon: HTMLDivElement } {
  const host = document.createElement('div')
  host.style.cssText = 'width:40px;height:40px;'
  const icon = document.createElement('div')
  icon.style.cssText = 'width:40px;height:40px;will-change:transform;transition:transform 0.5s ease;'
  icon.innerHTML = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" fill="#2563EB" stroke="white" stroke-width="2.5"/>
    <path d="M20 9L28.5 30L20 25L11.5 30L20 9Z" fill="white"/>
    <path d="M20 14L26 30L20 25.5L14 30L20 14Z" fill="#BFDBFE" opacity="0.55"/>
  </svg>`
  host.appendChild(icon)
  return { host, icon }
}

function makePinEl(label: string, color: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;'
  el.innerHTML = `
    <div style="background:${color};color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;white-space:nowrap;box-shadow:0 2px 6px ${color}55;font-family:system-ui,sans-serif;letter-spacing:0.2px;">${label}</div>
    <div style="width:10px;height:10px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.25);"></div>
  `
  return el
}

function addTrafficLayers(map: mapboxgl.Map, visible: boolean) {
  if (!map.getSource('mapbox-traffic')) {
    map.addSource('mapbox-traffic', {
      type: 'vector',
      url: 'mapbox://mapbox.mapbox-traffic-v1',
    })
  }
  if (!map.getLayer('traffic-lines')) {
    map.addLayer({
      id: 'traffic-lines',
      type: 'line',
      source: 'mapbox-traffic',
      'source-layer': 'traffic',
      layout: { visibility: visible ? 'visible' : 'none' },
      paint: {
        'line-width': 3,
        'line-color': [
          'match',
          ['get', 'congestion'],
          'low', '#00E653',
          'moderate', '#FFD600',
          'heavy', '#E65100',
          'severe', '#C50000',
          '#CBD5E1',
        ] as mapboxgl.Expression,
      },
    })
  }
}

export default function LiveTrackingMap({
  booking_id,
  pickup_address,
  drop_address,
  pickup_lat,
  pickup_lng,
  drop_lat,
  drop_lng,
  driver_name,
  driver_phone,
  booking_ref,
}: LiveTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null)
  const carIconRef = useRef<HTMLDivElement | null>(null)
  const prevCoordsRef = useRef<[number, number] | null>(null)
  const rafRef = useRef<number>(0)
  const driverOnMapRef = useRef(false)
  const mapLoadedRef = useRef(false)
  const hasLocationRef = useRef(false)
  const isMountedRef = useRef(true)
  const trafficEnabledRef = useRef(false)

  const [state, setState] = useState<TrackState>('initializing')
  const [connectionLost, setConnectionLost] = useState(false)
  const [speed, setSpeed] = useState<number | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [trafficEnabled, setTrafficEnabled] = useState(false)

  useEffect(() => {
    isMountedRef.current = true

    if (!mapContainerRef.current) return

    // ── Socket setup (independent of map state) ──────────────────────────────
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('auth_token') : null
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      if (!isMountedRef.current) return
      setConnectionLost(false)
      socket.emit('watch:trip', { booking_id })
    })

    socket.on('location:update', (payload: { lat: number; lng: number; speed: number | null; updated_at: string }) => {
      if (!isMountedRef.current) return
      const { lat, lng, speed: spd, updated_at } = payload
      const newCoords: [number, number] = [lng, lat]

      // Add driver marker to map on first location
      if (mapLoadedRef.current && mapRef.current && !driverOnMapRef.current && driverMarkerRef.current) {
        driverMarkerRef.current.setLngLat(newCoords).addTo(mapRef.current)
        driverOnMapRef.current = true
        prevCoordsRef.current = newCoords
      }

      if (mapLoadedRef.current && driverOnMapRef.current && driverMarkerRef.current) {
        const prev = prevCoordsRef.current ?? newCoords
        const samePoint = prev[0] === newCoords[0] && prev[1] === newCoords[1]
        const bearing = samePoint ? 0 : calculateBearing(prev, newCoords)

        if (carIconRef.current && !samePoint) {
          carIconRef.current.style.transform = `rotate(${bearing}deg)`
        }

        // Start from current interpolated position
        const ll = driverMarkerRef.current.getLngLat()
        const animFrom: [number, number] = [ll.lng, ll.lat]

        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        const startTime = performance.now()
        const step = (now: number) => {
          const t = Math.min((now - startTime) / ANIM_MS, 1)
          driverMarkerRef.current?.setLngLat([
            animFrom[0] + (newCoords[0] - animFrom[0]) * t,
            animFrom[1] + (newCoords[1] - animFrom[1]) * t,
          ])
          if (t < 1) rafRef.current = requestAnimationFrame(step)
        }
        rafRef.current = requestAnimationFrame(step)

        if (mapRef.current) {
          mapRef.current.easeTo({ center: [lng, lat], duration: ANIM_MS, easing: (t) => t })
        }

        prevCoordsRef.current = newCoords
      }

      hasLocationRef.current = true
      if (isMountedRef.current) {
        setState('live')
        setSpeed(spd ?? null)
        setUpdatedAt(updated_at)
      }
    })

    socket.on('trip:completed', () => {
      if (isMountedRef.current) setState('completed')
      socket.disconnect()
    })

    socket.on('disconnect', () => {
      if (isMountedRef.current) setConnectionLost(true)
    })

    // ── Map setup ────────────────────────────────────────────────────────────
    mapboxgl.accessToken = MAPBOX_TOKEN

    let map: mapboxgl.Map
    try {
      map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: DEFAULT_CENTER,
        zoom: 13,
        attributionControl: false,
      })
    } catch {
      if (isMountedRef.current) setState('token_error')
      return
    }
    mapRef.current = map

    map.on('error', (e) => {
      const status = (e as unknown as { error?: { status?: number } }).error?.status
      if (status === 401 || status === 403) {
        if (isMountedRef.current) setState('token_error')
      }
    })

    map.on('load', async () => {
      if (!isMountedRef.current) return
      mapLoadedRef.current = true

      // Resolve coordinates
      const pCoords: [number, number] | null =
        pickup_lat != null && pickup_lng != null
          ? [pickup_lng, pickup_lat]
          : await geocode(pickup_address)

      const dCoords: [number, number] | null =
        drop_lat != null && drop_lng != null
          ? [drop_lng, drop_lat]
          : await geocode(drop_address)

      if (!isMountedRef.current) return

      if (pCoords) {
        new mapboxgl.Marker({ element: makePinEl('Pickup', '#16A34A'), anchor: 'bottom' })
          .setLngLat(pCoords)
          .addTo(map)
      }

      if (dCoords) {
        new mapboxgl.Marker({ element: makePinEl('Drop', '#DC2626'), anchor: 'bottom' })
          .setLngLat(dCoords)
          .addTo(map)
      }

      if (pCoords && dCoords) {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [pCoords, dCoords] },
          },
        })
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2563EB', 'line-width': 2, 'line-dasharray': [3, 3] },
        })

        const bounds = new mapboxgl.LngLatBounds()
        bounds.extend(pCoords)
        bounds.extend(dCoords)
        map.fitBounds(bounds, { padding: 60, duration: 800, maxZoom: 15 })
      } else if (pCoords) {
        map.easeTo({ center: pCoords, zoom: 14 })
      }

      addTrafficLayers(map, trafficEnabledRef.current)

      // Pre-create driver marker (not added until first location arrives)
      const { host, icon } = makeCarEl()
      carIconRef.current = icon
      driverMarkerRef.current = new mapboxgl.Marker({ element: host, anchor: 'center' })

      // Only transition to no_location if no location has arrived yet
      if (isMountedRef.current && !hasLocationRef.current) {
        setState('no_location')
      }
    })

    map.on('style.load', () => {
      if (!mapLoadedRef.current) return
      addTrafficLayers(map, trafficEnabledRef.current)
    })

    return () => {
      isMountedRef.current = false
      cancelAnimationFrame(rafRef.current)
      const sock = socketRef.current
      if (sock) {
        if (sock.connected) sock.emit('leave:trip', { booking_id })
        sock.disconnect()
      }
      map.remove()
      mapRef.current = null
      mapLoadedRef.current = false
      driverOnMapRef.current = false
      hasLocationRef.current = false
    }
  // booking_id intentionally the only dep — everything else is stable or a ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking_id])

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
      })
    } catch {
      return iso
    }
  }

  const showInfo = state === 'live' || state === 'no_location'

  const toggleTraffic = () => {
    const next = !trafficEnabledRef.current
    trafficEnabledRef.current = next
    setTrafficEnabled(next)
    const map = mapRef.current
    if (map && mapLoadedRef.current && map.getLayer('traffic-lines')) {
      map.setLayoutProperty('traffic-lines', 'visibility', next ? 'visible' : 'none')
    }
  }

  return (
    <div style={{ position: 'relative', height: 360, borderRadius: 12, overflow: 'hidden', background: '#E5E7EB' }}>
      {/* Map canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Skeleton — map initialising */}
      {state === 'initializing' && (
        <div style={{
          position: 'absolute', inset: 0, background: '#F3F4F6', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10,
        }}>
          <style>{`@keyframes ltm-spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ width: 30, height: 30, border: '3px solid #E5E7EB', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'ltm-spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>Loading map…</span>
        </div>
      )}

      {/* Invalid / missing Mapbox token */}
      {state === 'token_error' && (
        <div style={{
          position: 'absolute', inset: 0, background: '#F8FAFC', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', padding: 24, fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 10px' }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#94A3B8" strokeWidth="1.5" fill="none"/>
              <circle cx="12" cy="9" r="2.5" stroke="#94A3B8" strokeWidth="1.5"/>
            </svg>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>Map unavailable</div>
            <div style={{ fontSize: 11.5, color: '#94A3B8', maxWidth: 220 }}>Add valid Mapbox token to enable map</div>
          </div>
        </div>
      )}

      {/* Trip completed */}
      {state === 'completed' && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.88)', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{ textAlign: 'center', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#DCFCE7', border: '2px solid #BBF7D0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>Trip Completed</div>
          </div>
        </div>
      )}

      {/* Waiting for driver location */}
      {state === 'no_location' && (
        <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 5 }}>
          <div style={{
            background: 'rgba(15,23,42,0.78)', color: 'white', fontSize: 11.5, fontWeight: 600,
            padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
          }}>
            Waiting for driver location…
          </div>
        </div>
      )}

      {/* Connection lost banner */}
      {connectionLost && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 15,
          background: '#FEF2F2', borderBottom: '1.5px solid #FECACA',
          padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: '#B91C1C', fontWeight: 600 }}>Connection lost — reconnecting…</span>
        </div>
      )}

      {/* Info card — top-right overlay */}
      {showInfo && (
        <div style={{
          position: 'absolute', top: connectionLost ? 38 : 10, right: 10, zIndex: 10,
          background: 'rgba(255,255,255,0.96)', border: '1.5px solid #E5E7EB',
          borderRadius: 11, padding: '10px 13px', minWidth: 148,
          backdropFilter: 'blur(8px)', boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
          fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
        }}>
          {driver_name && (
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', marginBottom: 1 }}>
              {driver_name}
            </div>
          )}
          {driver_phone && (
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 500, marginBottom: 6 }}>
              {driver_phone}
            </div>
          )}
          {booking_ref && !driver_name && !driver_phone && (
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {booking_ref}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ textAlign: 'center', minWidth: 36 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#2563EB', lineHeight: 1 }}>
                {speed != null ? Math.round(speed) : '—'}
              </div>
              <div style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                km/h
              </div>
            </div>
            {updatedAt && (
              <>
                <div style={{ width: 1, height: 26, background: '#E5E7EB', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600 }}>Updated</div>
                  <div style={{ fontSize: 10.5, color: '#0F172A', fontWeight: 700 }}>{fmtTime(updatedAt)}</div>
                </div>
              </>
            )}
          </div>
          {booking_ref && (driver_name || driver_phone) && (
            <div style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: 600, marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {booking_ref}
            </div>
          )}
        </div>
      )}

      {/* Traffic toggle button — top-left, always visible */}
      <button
        onClick={toggleTraffic}
        style={{
          position: 'absolute',
          top: connectionLost ? 44 : 10,
          left: 10,
          zIndex: 20,
          background: trafficEnabled ? '#2563EB' : '#ffffff',
          border: `2px solid ${trafficEnabled ? '#1d4ed8' : '#D1D5DB'}`,
          borderRadius: 8,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
          fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
          fontSize: 12,
          fontWeight: 700,
          color: trafficEnabled ? '#ffffff' : '#111827',
          lineHeight: 1,
          userSelect: 'none',
        }}
        title={trafficEnabled ? 'Hide traffic layer' : 'Show traffic layer'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="2" width="6" height="20" rx="3" stroke="currentColor" strokeWidth="2"/>
          <circle cx="12" cy="7" r="1.8" fill={trafficEnabled ? '#fca5a5' : '#EF4444'}/>
          <circle cx="12" cy="12" r="1.8" fill={trafficEnabled ? '#fde68a' : '#F59E0B'}/>
          <circle cx="12" cy="17" r="1.8" fill={trafficEnabled ? '#bbf7d0' : '#22C55E'}/>
        </svg>
        Traffic
        <span style={{
          fontSize: 9,
          fontWeight: 800,
          padding: '1px 5px',
          borderRadius: 4,
          background: trafficEnabled ? 'rgba(255,255,255,0.25)' : '#F3F4F6',
          color: trafficEnabled ? '#ffffff' : '#6B7280',
          letterSpacing: 0.3,
        }}>
          {trafficEnabled ? 'ON' : 'OFF'}
        </span>
      </button>

      {/* Traffic legend — bottom-left, visible only when traffic is ON */}
      {trafficEnabled && (
        <div style={{
          position: 'absolute', bottom: 28, left: 10, zIndex: 20,
          background: '#ffffff', border: '1.5px solid #E5E7EB',
          borderRadius: 8, padding: '8px 11px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.14)',
          fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Traffic</div>
          {[
            { label: 'Low', color: '#00E653' },
            { label: 'Moderate', color: '#FFD600' },
            { label: 'Heavy', color: '#E65100' },
            { label: 'Severe', color: '#C50000' },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <div style={{ width: 16, height: 4, borderRadius: 2, background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 10.5, color: '#374151', fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

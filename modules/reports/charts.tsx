"use client";

import { useState } from "react";
import { A } from "./primitives";

// Round `rough` UP to the next "nice" number: a {1, 2, 5} × 10^n value.
// e.g. 173 → 200, 287 → 500, 1100 → 2000, 0.42 → 0.5.
// Used to derive axis tick spacing so we get ₹0/₹200/₹400/₹600 instead of
// the visually ugly ₹201/₹402/₹603 you get from dataMax / tickCount.
function niceStep(rough: number, integerOnly: boolean): number {
  if (!Number.isFinite(rough) || rough <= 0) return integerOnly ? 1 : 1;
  const exp  = Math.floor(Math.log10(rough));
  const base = Math.pow(10, exp);
  const norm = rough / base; // 1..10
  const niceFraction = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  let step = niceFraction * base;
  if (integerOnly && step < 1) step = 1;
  if (integerOnly) step = Math.max(1, Math.round(step));
  return step;
}

// Build [0, step, 2*step, ...] up to or just past `max`. Returns 5 ticks for a
// readable axis without overcrowding.
function niceTicks(max: number, integerOnly: boolean): number[] {
  if (!(max > 0)) return integerOnly ? [0, 1] : [0, 1];
  const targetCount = 4;
  const step = niceStep(max / targetCount, integerOnly);
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  // Always include one tick above dataMax for headroom.
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export function SvgBarChart({
  data,
  xKey,
  yKey,
  color = A,
  yFormat = (v: number) => String(v),
  height = 220,
  maxBarWidth,
  yMax,
  yLabel,
}: {
  data:    Record<string, unknown>[];
  xKey:    string;
  yKey:    string;
  color?:  string;
  yFormat?: (v: number) => string;
  height?: number;
  maxBarWidth?: number;
  yMax?: number;
  yLabel?: string;
}) {
  const W = 1400, H = height, P = { l: 52, r: 14, t: 8, b: 28 };
  const innerW = W - P.l - P.r, innerH = H - P.t - P.b;
  const dataMax = Math.max(...data.map((d) => d[yKey] as number), 0);
  // Force integer ticks when every value is whole (e.g. trip counts) — avoids
  // duplicate-looking axis labels when fractional ticks round to the same int.
  const integerOnly = data.every((d) => Number.isInteger(d[yKey] as number));
  const ticks = yMax !== undefined
    ? niceTicks(yMax, integerOnly)
    : niceTicks(dataMax, integerOnly);
  const max = ticks[ticks.length - 1] || 1;
  const naturalSlot = innerW / data.length;
  const slot = maxBarWidth ? Math.min(naturalSlot, maxBarWidth / 0.62) : naturalSlot;
  const barW = slot * 0.62;
  const xStart = P.l + (innerW - slot * data.length) / 2;
  // Show at most ~8 labels to keep them readable on long ranges.
  const maxLabels = 8;
  const labelStep = data.length <= maxLabels ? 1 : Math.ceil(data.length / maxLabels);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%">
        {ticks.map((t, i) => {
          const y = P.t + innerH - (t / max) * innerH;
          return (
            <g key={i}>
              <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="#EFF1F6" strokeDasharray={i === 0 ? "0" : "3 3"} />
              <text x={P.l - 8} y={y + 3} textAnchor="end" fontSize="12" fontWeight="600" fill="#475569" fontFamily="system-ui,-apple-system,sans-serif">
                {yFormat(Math.round(t))}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const x = xStart + i * slot + (slot - barW) / 2;
          const h = ((d[yKey] as number) / max) * innerH;
          const y = P.t + innerH - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={h} fill={color} rx="2.5"
                opacity={hover !== null && hover !== i ? 0.35 : 1}
                style={{ transition: "opacity 100ms" }} />
              <rect x={xStart + i * slot} y={P.t} width={slot} height={innerH} fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
              {i % labelStep === 0 && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#475569" fontFamily="system-ui,-apple-system,sans-serif">
                  {String(d[xKey])}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null &&
        (() => {
          const d = data[hover];
          const xPct = ((xStart + hover * slot + slot / 2) / W) * 100;
          return (
            <div style={{
              position: "absolute", left: `${xPct}%`, top: 4, transform: "translateX(-50%)",
              pointerEvents: "none", background: "#0F172A", color: "#fff", borderRadius: 8,
              padding: "9px 12px", fontSize: 12.5, boxShadow: "0 6px 20px rgba(11,15,26,0.22)",
              whiteSpace: "nowrap", minWidth: 110, zIndex: 20,
            }}>
              <div style={{ color: "#fff", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
                {String(d[xKey])}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                {yLabel && <span style={{ color: "rgba(255,255,255,0.7)" }}>{yLabel}</span>}
                <span style={{ fontWeight: 700, marginLeft: yLabel ? "auto" : 0 }}>{yFormat(d[yKey] as number)}</span>
              </div>
            </div>
          );
        })()}
    </div>
  );
}

export function SvgLineChart({
  data,
  xKey,
  series,
  yFormat = (v: number) => String(v),
  height = 220,
}: {
  data:    Record<string, unknown>[];
  xKey:    string;
  series:  { key: string; label: string; color: string }[];
  yFormat?: (v: number) => string;
  height?: number;
}) {
  const W = 1400, H = height, P = { l: 56, r: 14, t: 8, b: 28 };
  const innerW = W - P.l - P.r, innerH = H - P.t - P.b;
  const allVals = data.flatMap((d) => series.map((s) => d[s.key] as number));
  const dataMax = Math.max(...allVals, 0);
  const integerOnly = allVals.every(Number.isInteger);
  const ticks = niceTicks(dataMax, integerOnly);
  const max = ticks[ticks.length - 1] || 1;
  const xStep = innerW / Math.max(data.length - 1, 1);
  const [hover, setHover] = useState<number | null>(null);
  const pathFor = (key: string) =>
    data.map((d, i) => {
      const x = P.l + i * xStep;
      const y = P.t + innerH - ((d[key] as number) / max) * innerH;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    }).join(" ");
  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height="100%" onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => {
          const y = P.t + innerH - (t / max) * innerH;
          return (
            <g key={i}>
              <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="#EFF1F6" strokeDasharray={i === 0 ? "0" : "3 3"} />
              <text x={P.l - 8} y={y + 3} textAnchor="end" fontSize="12" fontWeight="600" fill="#475569" fontFamily="system-ui,-apple-system,sans-serif">
                {yFormat(Math.round(t))}
              </text>
            </g>
          );
        })}
        {series.map((s) => (
          <path key={s.key} d={pathFor(s.key)} stroke={s.color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {data.map((d, i) =>
          series.map((s) => {
            const x = P.l + i * xStep;
            const y = P.t + innerH - ((d[s.key] as number) / max) * innerH;
            return <circle key={s.key + i} cx={x} cy={y} r={hover === i ? 4 : 2.5} fill={s.color} />;
          })
        )}
        {hover !== null && (
          <line x1={P.l + hover * xStep} y1={P.t} x2={P.l + hover * xStep} y2={P.t + innerH}
            stroke="#0F172A" strokeDasharray="2 2" strokeWidth="0.8" opacity="0.3" />
        )}
        {data.map((_, i) => (
          <rect key={i} x={P.l + (i - 0.5) * xStep} y={P.t} width={xStep} height={innerH} fill="transparent"
            onMouseEnter={() => setHover(i)} />
        ))}
        {data.map((d, i) => i % 2 === 0 && (
          <text key={"x" + i} x={P.l + i * xStep} y={H - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#475569" fontFamily="system-ui,-apple-system,sans-serif">
            {String(d[xKey])}
          </text>
        ))}
      </svg>
      {hover !== null &&
        (() => {
          const d = data[hover];
          const xPct = ((P.l + hover * xStep) / W) * 100;
          return (
            <div style={{
              position: "absolute", left: `${xPct}%`, top: 4, transform: "translateX(-50%)",
              pointerEvents: "none", background: "#0F172A", color: "#fff", borderRadius: 6,
              padding: "7px 10px", fontSize: 11.5, boxShadow: "0 4px 14px rgba(11,15,26,0.18)", minWidth: 130,
            }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                {String(d[xKey])}
              </div>
              {series.map((s) => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>{s.label}</span>
                  <span style={{ fontWeight: 600, marginLeft: "auto" }}>{yFormat(d[s.key] as number)}</span>
                </div>
              ))}
            </div>
          );
        })()}
    </div>
  );
}

export function SvgDonut({
  data,
  colors,
  size = 190,
  thickness = 26,
  valueFormat = (v: number) => String(v),
}: {
  data:         { name: string; value: number; pct: number }[];
  colors:       string[];
  size?:        number;
  thickness?:   number;
  valueFormat?: (v: number) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = size / 2 - thickness / 2;
  const cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  const [hover, setHover] = useState<number | null>(null);
  let offset = 0;
  const segs = data.map((d, i) => {
    const frac = d.value / total;
    const dash = frac * C;
    const seg = (
      <circle key={i} cx={cx} cy={cy} r={r} stroke={colors[i]} strokeWidth={thickness} fill="none"
        strokeDasharray={`${dash - 2} ${C - dash + 2}`} strokeDashoffset={-offset}
        transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt"
        opacity={hover !== null && hover !== i ? 0.35 : 1}
        style={{ transition: "opacity 100ms", cursor: "pointer" }}
        onMouseEnter={() => setHover(i)}
        onMouseLeave={() => setHover(null)} />
    );
    offset += dash;
    return seg;
  });
  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <circle cx={cx} cy={cy} r={r} stroke="#F1F5F9" strokeWidth={thickness} fill="none" />
        {segs}
      </svg>
      {hover !== null && (
        <div style={{
          position: "absolute", left: "50%", bottom: "100%", transform: "translateX(-50%)",
          marginBottom: 8, pointerEvents: "none", background: "#0F172A", color: "#fff",
          borderRadius: 6, padding: "7px 10px", fontSize: 11.5,
          boxShadow: "0 4px 14px rgba(11,15,26,0.18)", whiteSpace: "nowrap", zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontVariantNumeric: "tabular-nums" }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: colors[hover], flexShrink: 0 }} />
            <span style={{ color: "rgba(255,255,255,0.7)" }}>{data[hover].name}</span>
            <span style={{ fontWeight: 600 }}>{valueFormat(data[hover].value)}</span>
            <span style={{ color: "rgba(255,255,255,0.5)" }}>{data[hover].pct}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

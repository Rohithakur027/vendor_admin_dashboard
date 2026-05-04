"use client";

import React from "react";

export const A    = "#2563EB";
export const FONT = "var(--font-plus-jakarta-sans),'Plus Jakarta Sans',sans-serif";
export const fmt    = (n: number) => "₹" + Number(n).toLocaleString("en-IN");
export const fmtINRk = (n: number) =>
  n >= 1000 ? "₹" + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : "₹" + n;

export function toIsoDate(d: Date) {
  return d.toISOString().split("T")[0];
}
export function inRange(d: Date, from: string, to: string) {
  return d >= new Date(from + "T00:00:00") && d <= new Date(to + "T23:59:59");
}

export function Card({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background:    "#fff",
        border:        "1.5px solid #E8EEF4",
        borderRadius:  14,
        boxShadow:     "0 1px 6px rgba(0,0,0,0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  iconBg,
}: {
  label:  string;
  value:  string | number;
  sub?:   string;
  icon:   React.ReactNode;
  iconBg?: string;
}) {
  return (
    <Card style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.7 }}>
          {label}
        </div>
        <div
          style={{
            width:           34,
            height:          34,
            borderRadius:    10,
            background:      iconBg || "#F8FAFC",
            display:         "flex",
            alignItems:      "center",
            justifyContent:  "center",
            flexShrink:      0,
          }}
        >
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1, letterSpacing: -0.5 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: "#94A3B8" }}>{sub}</div>}
    </Card>
  );
}

export function Badge({
  label,
  color,
  bg,
  dot,
}: {
  label: string;
  color: string;
  bg:    string;
  dot?:  string;
}) {
  return (
    <span
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            4,
        background:     bg,
        color,
        padding:        "3px 10px",
        borderRadius:   20,
        fontSize:       11.5,
        fontWeight:     700,
        whiteSpace:     "nowrap",
      }}
    >
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0 }} />}
      {label}
    </span>
  );
}

export function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 0" }}>
      <div
        style={{
          width:          44,
          height:         44,
          borderRadius:   "50%",
          background:     "#F1F5F9",
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          margin:         "0 auto 12px",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
          <rect x="3" y="3" width="16" height="16" rx="3" stroke="#CBD5E1" strokeWidth="1.5" />
          <path d="M7 11h8M7 7.5h8M7 14.5h4" stroke="#CBD5E1" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#94A3B8" }}>{msg}</div>
    </div>
  );
}

export function ReportSkeleton({
  hideHeader = false,
  statCount   = 4,
}: {
  hideHeader?: boolean;
  statCount?:  number;
} = {}) {
  const box = (h: number, w: string | number = "100%", r = 8): React.CSSProperties => ({
    height:       h,
    width:        w,
    background:   "#F1F5F9",
    borderRadius: r,
    animation:    "skpulse 1.6s ease-in-out infinite",
  });
  return (
    <>
      <style>{`@keyframes skpulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!hideHeader && (
          <Card style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={box(50, 50, 25)} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={box(16, "42%")} />
                <div style={box(11, "60%")} />
              </div>
            </div>
          </Card>
        )}
        {/* Filter bar (date picker chip) */}
        <div style={{ display: "flex", gap: 10 }}>
          <div style={box(34, 200, 9)} />
        </div>
        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${statCount},1fr)`, gap: 12 }}>
          {Array.from({ length: statCount }).map((_, i) => (
            <Card key={i} style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={box(11, "55%")} />
              <div style={box(26, "38%")} />
              <div style={box(9, "68%")} />
            </Card>
          ))}
        </div>
        {/* Chart row 1 */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
          <Card style={{ padding: "20px 22px" }}><div style={box(260)} /></Card>
          <Card style={{ padding: "20px 22px" }}><div style={box(260)} /></Card>
        </div>
        {/* Chart row 2 */}
        <Card style={{ padding: "20px 22px" }}><div style={box(220)} /></Card>
        {/* Table row */}
        <Card style={{ padding: "20px 22px" }}><div style={box(180)} /></Card>
      </div>
    </>
  );
}

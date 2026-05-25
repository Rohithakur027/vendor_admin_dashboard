"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type React from "react";

const CAL_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CAL_DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

export function CustomDatePicker({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.split("-")[0]) : new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.split("-")[1]) - 1 : new Date().getMonth());
  const wrapRef = useRef<HTMLDivElement>(null);
  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!open) return;
    function onOut(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, [open]);

  function prev() { viewMonth === 0 ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1); }
  function next() { viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0)) : setViewMonth(m => m + 1); }

  const daysInMo = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (string | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMo; d++) cells.push(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div ref={wrapRef} style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
      <div onClick={() => setOpen(v => !v)} style={{ cursor: "pointer" }}>
        {children}
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 999, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", padding: 14, width: 240, fontFamily: "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button type="button" onClick={prev} style={{ padding: 4, border: "none", background: "none", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", color: "#64748B" }}>
              <ChevronLeft style={{ width: 15, height: 15 }} />
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>{CAL_MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={next} style={{ padding: 4, border: "none", background: "none", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", color: "#64748B" }}>
              <ChevronRight style={{ width: 15, height: 15 }} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
            {CAL_DAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#94A3B8", paddingBottom: 4 }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {cells.map((dt, i) => {
              if (!dt) return <div key={i} style={{ height: 30 }} />;
              const sel = dt === value, tdy = dt === todayStr;
              return (
                <button type="button" key={dt} onClick={() => { onChange(dt); setOpen(false); }}
                  style={{ height: 30, borderRadius: "50%", border: "none", cursor: "pointer", fontSize: 12, fontWeight: sel ? 800 : tdy ? 700 : 400, background: sel ? "#2563EB" : "transparent", color: sel ? "#fff" : tdy ? "#2563EB" : "#334155", outline: tdy && !sel ? `1.5px solid #2563EB` : "none", transition: "background 0.1s" }}
                  onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "#F1F5F9"; }}
                  onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >{parseInt(dt.split("-")[2])}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomTimePicker({ value, onChange, align = "left", children }: { value: string; onChange: (v: string) => void; align?: "left" | "right"; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const valueH = parseInt(value.split(":")[0] || "0");
  const valueM = parseInt(value.split(":")[1] || "0");

  const h12  = valueH === 0 ? 12 : valueH > 12 ? valueH - 12 : valueH;
  const ampm = valueH >= 12 ? "PM" : "AM";

  useEffect(() => {
    if (!open) return;
    function onOut(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, [open]);

  const setHour = (h: number) => {
    let h24 = h;
    if (ampm === "PM" && h < 12) h24 += 12;
    if (ampm === "AM" && h === 12) h24 = 0;
    onChange(`${String(h24).padStart(2, "0")}:${String(valueM).padStart(2, "0")}`);
  };

  const setMin = (m: number) => {
    onChange(`${String(valueH).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  };

  const setAmpm = (newAmpm: string) => {
    let h24 = valueH;
    if (newAmpm === "PM" && h24 < 12) h24 += 12;
    if (newAmpm === "AM" && h24 >= 12) h24 -= 12;
    onChange(`${String(h24).padStart(2, "0")}:${String(valueM).padStart(2, "0")}`);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", flex: 1, minWidth: 0 }} onClick={e => e.stopPropagation()}>
      <div onClick={() => setOpen(v => !v)} style={{ cursor: "pointer" }}>
        {children}
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", ...(align === "right" ? { right: 0 } : { left: 0 }), zIndex: 999, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", padding: 14, display: "flex", gap: 10, fontFamily: "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif" }}>
          <select value={h12} onChange={e => setHour(parseInt(e.target.value))} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", outline: "none", fontSize: 13, cursor: "pointer" }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
            ))}
          </select>
          <span style={{ fontSize: 16, fontWeight: 700, color: "#64748B", display: "flex", alignItems: "center" }}>:</span>
          <select value={valueM} onChange={e => setMin(parseInt(e.target.value))} style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#F8FAFC", outline: "none", fontSize: 13, cursor: "pointer" }}>
            {Array.from({ length: 60 }, (_, i) => i).map(m => (
              <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
            ))}
          </select>
          <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 8, overflow: "hidden", padding: 2 }}>
            <button type="button" onClick={() => setAmpm("AM")} style={{ padding: "4px 8px", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "none", cursor: "pointer", background: ampm === "AM" ? "#fff" : "transparent", color: ampm === "AM" ? "#0F172A" : "#64748B", boxShadow: ampm === "AM" ? "0 2px 6px rgba(0,0,0,0.06)" : "none" }}>AM</button>
            <button type="button" onClick={() => setAmpm("PM")} style={{ padding: "4px 8px", fontSize: 12, fontWeight: 700, borderRadius: 6, border: "none", cursor: "pointer", background: ampm === "PM" ? "#fff" : "transparent", color: ampm === "PM" ? "#0F172A" : "#64748B", boxShadow: ampm === "PM" ? "0 2px 6px rgba(0,0,0,0.06)" : "none" }}>PM</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function format12h(time: string) {
  if (!time) return "00:00 AM";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

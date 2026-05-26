"use client";

import { useState } from "react";
import { toIsoDate } from "./primitives";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const PAST_PRESETS = [
  { label: "Last 7 days",  days: 6  },
  { label: "Last 30 days", days: 29 },
  { label: "Last 90 days", days: 89 },
];
const FUTURE_PRESETS = [
  { label: "Next 7 days",  days: 6  },
  { label: "Next 30 days", days: 29 },
  { label: "Next 90 days", days: 89 },
];

export function DateRangePicker({
  from,
  to,
  onApply,
  onClose,
  direction = "past",
}: {
  from:     string;
  to:       string;
  onApply: (f: string, t: string) => void;
  onClose: () => void;
  direction?: "past" | "future";
}) {
  const todayStr = toIsoDate(new Date());
  const isOutOfRange = (ds: string) => direction === "past" ? ds > todayStr : false;
  const [mode,    setMode]    = useState<"range" | "single">("range");
  const [phase,   setPhase]   = useState<"from" | "to">("from");
  const [tmpFrom, setTmpFrom] = useState(from);
  const [tmpTo,   setTmpTo]   = useState(to);
  const [hover,   setHover]   = useState<string | null>(null);
  const initD = new Date(from);
  const [calY, setCalY] = useState(initD.getFullYear());
  const [calM, setCalM] = useState(initD.getMonth());

  const daysInMonth  = new Date(calY, calM + 1, 0).getDate();
  const firstWeekDay = new Date(calY, calM, 1).getDay();

  const prevMonth = () => { if (calM === 0) { setCalM(11); setCalY((y) => y - 1); } else setCalM((m) => m - 1); };
  const nextMonth = () => { if (calM === 11) { setCalM(0); setCalY((y) => y + 1); } else setCalM((m) => m + 1); };

  const dayStr = (day: number) =>
    `${calY}-${String(calM + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const handleDay = (ds: string) => {
    if (isOutOfRange(ds)) return;
    if (mode === "single") { setTmpFrom(ds); setTmpTo(ds); return; }
    if (phase === "from") { setTmpFrom(ds); setTmpTo(ds); setPhase("to"); }
    else {
      const f = ds < tmpFrom ? ds : tmpFrom;
      const t = ds < tmpFrom ? tmpFrom : ds;
      setTmpFrom(f); setTmpTo(t); setPhase("from");
    }
  };

  const fmtSel = (s: string) =>
    new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div style={{
      position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
      background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: 14,
      boxShadow: "0 8px 32px rgba(0,0,0,0.14)", padding: "16px 18px", minWidth: 290,
    }} onMouseLeave={() => setHover(null)}>
      <div style={{ display: "flex", marginBottom: 12, padding: 3, background: "#F1F5F9", borderRadius: 9 }}>
        {(["range", "single"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setPhase("from"); }}
            style={{
              flex: 1, padding: "5px 0", fontSize: 11.5, borderRadius: 6, border: "none",
              background: mode === m ? "#fff" : "transparent",
              color:      mode === m ? "#0F172A" : "#64748B",
              fontWeight: mode === m ? 700 : 500, cursor: "pointer", fontFamily: "inherit",
              boxShadow:  mode === m ? "0 1px 3px rgba(0,0,0,0.06)" : "none", transition: "all 0.12s",
            }}>
            {m === "range" ? "Date Range" : "Single Date"}
          </button>
        ))}
      </div>
      {mode === "range" && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {(direction === "past" ? PAST_PRESETS : FUTURE_PRESETS).map((p) => {
            const d = new Date();
            d.setDate(d.getDate() + (direction === "past" ? -p.days : p.days));
            const pf = direction === "past" ? toIsoDate(d) : todayStr;
            const pt = direction === "past" ? todayStr     : toIsoDate(d);
            const active = tmpFrom === pf && tmpTo === pt && phase === "from";
            return (
              <button key={p.label} onClick={() => { onApply(pf, pt); onClose(); }}
                style={{
                  flex: 1, padding: "5px 0", fontSize: 11, borderRadius: 7,
                  border: `1.5px solid ${active ? "#3B82F6" : "#E2E8F0"}`,
                  background: active ? "#EFF6FF" : "#fff", color: active ? "#2563EB" : "#64748B",
                  fontWeight: active ? 600 : 400, cursor: "pointer", fontFamily: "inherit",
                }}>
                {p.label}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", color: "#64748B", fontSize: 18, lineHeight: 1 }}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{MONTH_NAMES[calM]} {calY}</span>
        <button onClick={nextMonth} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 8px", color: "#64748B", fontSize: 18, lineHeight: 1 }}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
        {DAY_NAMES.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 10.5, color: "#94A3B8", fontWeight: 600, padding: "2px 0" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px 0" }}>
        {Array.from({ length: firstWeekDay }).map((_, i) => <div key={"b" + i} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const ds = dayStr(i + 1);
          const disabled = isOutOfRange(ds);
          const isFrom = ds === tmpFrom;
          const isTo   = ds === tmpTo;
          const effectiveEnd = phase === "to" && hover && hover >= tmpFrom ? hover : tmpTo;
          const inRng  = ds > tmpFrom && ds < effectiveEnd;
          const isToday = ds === todayStr;
          return (
            <button key={i} onClick={() => handleDay(ds)} onMouseEnter={() => !disabled && setHover(ds)}
              style={{
                padding: "5px 2px", textAlign: "center", fontSize: 12, borderRadius: 6, border: "none",
                cursor: disabled ? "default" : "pointer",
                background: (isFrom || isTo) ? "#2563EB" : inRng ? "#DBEAFE" : "transparent",
                color: (isFrom || isTo) ? "#fff" : inRng ? "#1D4ED8" : disabled ? "#CBD5E1" : isToday ? "#2563EB" : "#0F172A",
                fontWeight: (isFrom || isTo || isToday) ? 700 : 400,
              }}>
              {i + 1}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 11.5, color: "#64748B", textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
        {mode === "single"
          ? <>Selected: <span style={{ fontWeight: 700, color: "#0F172A" }}>{fmtSel(tmpFrom)}</span></>
          : phase === "to"
            ? <>Now select an end date</>
            : <><span style={{ fontWeight: 700, color: "#0F172A" }}>{fmtSel(tmpFrom)}</span>{tmpTo !== tmpFrom && <> — <span style={{ fontWeight: 700, color: "#0F172A" }}>{fmtSel(tmpTo)}</span></>}</>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onClose}
          style={{ flex: 1, padding: "8px 0", fontSize: 12.5, borderRadius: 8, border: "1.5px solid #E2E8F0", background: "#fff", color: "#64748B", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Cancel
        </button>
        <button onClick={() => { onApply(tmpFrom, tmpTo); onClose(); }}
          style={{ flex: 1, padding: "8px 0", fontSize: 12.5, borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          Apply
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { TbFilter } from "react-icons/tb";
import { toIsoDate } from "@/modules/reports/primitives";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

export type TripPeriod = "today" | "7days" | "30days" | "all" | "custom";

interface Props {
  period:          TripPeriod;
  dateFrom:        string;
  dateTo:          string;
  onChangePeriod:  (p: TripPeriod) => void;
  onApplyCustom:   (from: string, to: string) => void;
  direction?:      "past" | "future";
}

export function TripDateFilter({ period, dateFrom, dateTo, onChangePeriod, onApplyCustom, direction = "past" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // calendar internal state
  const todayStr = toIsoDate(new Date());
  const [calMode,  setCalMode]  = useState<"range"|"single">("range");
  const [calPhase, setCalPhase] = useState<"from"|"to">("from");
  const [tmpFrom,  setTmpFrom]  = useState(dateFrom || todayStr);
  const [tmpTo,    setTmpTo]    = useState(dateTo   || todayStr);
  const [hover,    setHover]    = useState<string|null>(null);
  const now = new Date();
  const [calY, setCalY] = useState(now.getFullYear());
  const [calM, setCalM] = useState(now.getMonth());

  const daysInMonth  = new Date(calY, calM + 1, 0).getDate();
  const firstWeekDay = new Date(calY, calM, 1).getDay();
  const dayStr = (day: number) =>
    `${calY}-${String(calM + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const isOutOfRange = (ds: string) => direction === "past" ? ds > todayStr : false;

  const handleDay = (ds: string) => {
    if (isOutOfRange(ds)) return;
    if (calMode === "single") { setTmpFrom(ds); setTmpTo(ds); return; }
    if (calPhase === "from") { setTmpFrom(ds); setTmpTo(ds); setCalPhase("to"); }
    else {
      const f = ds < tmpFrom ? ds : tmpFrom;
      const t = ds < tmpFrom ? tmpFrom : ds;
      setTmpFrom(f); setTmpTo(t); setCalPhase("from");
    }
  };

  const fmtSel = (s: string) =>
    new Date(s + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const QUICK_OPTS = direction === "past"
    ? [
        { key: "today"  as TripPeriod, label: "Today"        },
        { key: "7days"  as TripPeriod, label: "Last 7 Days"  },
        { key: "30days" as TripPeriod, label: "Last 30 Days" },
        { key: "all"    as TripPeriod, label: "All Time"     },
      ]
    : [
        { key: "today"  as TripPeriod, label: "Today"        },
        { key: "7days"  as TripPeriod, label: "Next 7 Days"  },
        { key: "30days" as TripPeriod, label: "Next 30 Days" },
        { key: "all"    as TripPeriod, label: "All Time"     },
      ];

  const isActive = period !== "all";

  return (
    <div className="relative shrink-0" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-2 h-[42px] px-4 rounded-xl text-[13px] font-semibold border-[1.5px] transition-colors ${
          isActive
            ? "bg-blue-50 border-blue-500 text-blue-600"
            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
        }`}
      >
        <TbFilter className="h-[15px] w-[15px] shrink-0" />
        Filter
        {isActive && (
          <span className="flex items-center justify-center h-4 w-4 rounded-full bg-blue-600 text-white text-[10px] font-bold">1</span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute top-[calc(100%+8px)] right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl"
          style={{ width: 296, padding: "16px 18px" }}
        >
          {/* Quick presets */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Select</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {QUICK_OPTS.map(opt => (
              <button
                key={opt.key}
                onClick={() => { onChangePeriod(opt.key); setOpen(false); }}
                className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors whitespace-nowrap ${
                  period === opt.key
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100 mb-4" />

          {/* Custom date range */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Custom Date Range</p>

          {/* Mode toggle */}
          <div style={{ display:"flex", marginBottom:12, padding:3, background:"#F1F5F9", borderRadius:9 }}>
            {(["range","single"] as const).map(m => (
              <button key={m} onClick={() => { setCalMode(m); setCalPhase("from"); }}
                style={{
                  flex:1, padding:"5px 0", fontSize:11.5, borderRadius:6, border:"none",
                  background: calMode===m ? "#fff" : "transparent",
                  color:      calMode===m ? "#0F172A" : "#64748B",
                  fontWeight: calMode===m ? 700 : 500, cursor:"pointer", fontFamily:"inherit",
                  boxShadow:  calMode===m ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                }}>
                {m === "range" ? "Date Range" : "Single Date"}
              </button>
            ))}
          </div>

          {/* Month nav */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <button onClick={() => { if(calM===0){setCalM(11);setCalY(y=>y-1);}else setCalM(m=>m-1); }}
              style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 8px", color:"#64748B", fontSize:18, lineHeight:1 }}>‹</button>
            <span style={{ fontSize:13, fontWeight:700, color:"#0F172A" }}>{MONTH_NAMES[calM]} {calY}</span>
            <button onClick={() => { if(calM===11){setCalM(0);setCalY(y=>y+1);}else setCalM(m=>m+1); }}
              style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 8px", color:"#64748B", fontSize:18, lineHeight:1 }}>›</button>
          </div>

          {/* Day name headers */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign:"center", fontSize:10.5, color:"#94A3B8", fontWeight:600, padding:"2px 0" }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"2px 0" }}>
            {Array.from({ length: firstWeekDay }).map((_,i) => <div key={"b"+i} />)}
            {Array.from({ length: daysInMonth }).map((_,i) => {
              const ds = dayStr(i + 1);
              const disabled = isOutOfRange(ds);
              const isFrom = ds === tmpFrom;
              const isTo   = ds === tmpTo;
              const effectiveEnd = calPhase==="to" && hover && hover>=tmpFrom ? hover : tmpTo;
              const inRng  = ds > tmpFrom && ds < effectiveEnd;
              const isToday = ds === todayStr;
              return (
                <button key={i} onClick={() => handleDay(ds)} onMouseEnter={() => !disabled && setHover(ds)}
                  style={{
                    padding:"5px 2px", textAlign:"center", fontSize:12, borderRadius:6, border:"none",
                    cursor: disabled ? "default" : "pointer",
                    background: (isFrom||isTo) ? "#2563EB" : inRng ? "#DBEAFE" : "transparent",
                    color: (isFrom||isTo) ? "#fff" : inRng ? "#1D4ED8" : disabled ? "#CBD5E1" : isToday ? "#2563EB" : "#0F172A",
                    fontWeight: (isFrom||isTo||isToday) ? 700 : 400,
                  }}>
                  {i+1}
                </button>
              );
            })}
          </div>

          {/* Selection label */}
          <div style={{ marginTop:10, fontSize:11.5, color:"#64748B", textAlign:"center", fontVariantNumeric:"tabular-nums" }}>
            {calMode === "single"
              ? <>Selected: <span style={{ fontWeight:700, color:"#0F172A" }}>{fmtSel(tmpFrom)}</span></>
              : calPhase === "to"
                ? <>Now select an end date</>
                : <><span style={{ fontWeight:700, color:"#0F172A" }}>{fmtSel(tmpFrom)}</span>{tmpTo!==tmpFrom && <> — <span style={{ fontWeight:700, color:"#0F172A" }}>{fmtSel(tmpTo)}</span></>}</>}
          </div>

          {/* Footer buttons */}
          <div style={{ display:"flex", gap:8, marginTop:12 }}>
            <button onClick={() => setOpen(false)}
              style={{ flex:1, padding:"8px 0", fontSize:12.5, borderRadius:8, border:"1.5px solid #E2E8F0", background:"#fff", color:"#64748B", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              Cancel
            </button>
            <button
              onClick={() => {
                onApplyCustom(tmpFrom, tmpTo);
                onChangePeriod("custom");
                setOpen(false);
              }}
              style={{ flex:1, padding:"8px 0", fontSize:12.5, borderRadius:8, border:"none", background:"#2563EB", color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import {
  superadminApi,
  type GeneralBookingEnquiry,
  type SpecialBookingInquiry,
} from "@/lib/api";
import { MessageSquare, Inbox } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { Skeleton } from "@/components/ui/skeleton";

const FONT = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";

type Tab = "general" | "special";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day:    "2-digit",
      month:  "short",
      year:   "numeric",
      hour:   "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return phone;
}

function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? "—").toString();
  const tone: Record<string, { bg: string; color: string }> = {
    pending:         { bg: "#FEF3C7", color: "#92400E" },
    driver_assigned: { bg: "#DBEAFE", color: "#1E40AF" },
    completed:       { bg: "#DCFCE7", color: "#166534" },
    cancelled:       { bg: "#FEE2E2", color: "#991B1B" },
    New:             { bg: "#DBEAFE", color: "#1E40AF" },
    "In Review":     { bg: "#FEF3C7", color: "#92400E" },
    Resolved:        { bg: "#DCFCE7", color: "#166534" },
    Closed:          { bg: "#E2E8F0", color: "#475569" },
  };
  const t = tone[s] ?? { bg: "#E2E8F0", color: "#475569" };
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 999,
      background: t.bg, color: t.color, fontSize: 11, fontWeight: 700,
      textTransform: "capitalize", letterSpacing: 0.2,
    }}>
      {s.replace(/_/g, " ")}
    </span>
  );
}

export default function BookingEnquiriesPage() {
  const [tab, setTab] = useState<Tab>("general");

  const [general, setGeneral] = useState<GeneralBookingEnquiry[]>([]);
  const [special, setSpecial] = useState<SpecialBookingInquiry[]>([]);

  const [generalTotal, setGeneralTotal] = useState(0);
  const [specialTotal, setSpecialTotal] = useState(0);

  const [loading,     setLoading]     = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search,      setSearch]      = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  useEffect(() => {
    setLoading(true);
    const params = { limit: 100, ...(search.trim() && { search: search.trim() }) };
    if (tab === "general") {
      superadminApi.bookingEnquiries.listGeneral(params)
        .then(res => { setGeneral(res.data); setGeneralTotal(res.pagination.total); })
        .catch(() => { setGeneral([]); setGeneralTotal(0); })
        .finally(() => setLoading(false));
    } else {
      superadminApi.bookingEnquiries.listSpecial(params)
        .then(res => { setSpecial(res.data); setSpecialTotal(res.pagination.total); })
        .catch(() => { setSpecial([]); setSpecialTotal(0); })
        .finally(() => setLoading(false));
    }
  }, [tab, search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>Booking Enquiries</h2>
        <p style={{ fontSize: 13, color: "#64748B", marginTop: 3 }}>
          Customer booking requests and special-trip inquiries
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
        {[
          { label: "General Bookings",       value: generalTotal, icon: Inbox },
          { label: "Special Trip Inquiries", value: specialTotal, icon: MessageSquare },
        ].map(s => (
          <div key={s.label} style={{
            background: "#fff", borderRadius: 14, border: "1.5px solid #E8EEF4",
            padding: "16px 18px", display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: "#F1F5F9",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <s.icon className="h-5 w-5" style={{ color: "#64748B" }} />
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-[22px] w-10 mb-1.5" />
              ) : (
                <p style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{s.value}</p>
              )}
              <p style={{ fontSize: 11.5, color: "#64748B", marginTop: 3 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #E2E8F0" }}>
        {([
          { key: "general", label: "General Bookings" },
          { key: "special", label: "Special Inquiries" },
        ] as { key: Tab; label: string }[]).map(t => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: FONT,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: active ? "#2563EB" : "#64748B",
                borderBottom: active ? "2px solid #2563EB" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder={tab === "general"
            ? "Search by customer name, email, phone, or location…"
            : "Search by name, company, email, or phone…"}
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">
          {tab === "general" ? (
            <div className="min-w-[1100px]">
              <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,2.2fr)_140px_120px_140px_140px] items-center gap-6 px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
                {["CUSTOMER", "TRIP", "TYPE", "PASSENGERS", "STATUS", "CREATED"].map(h => (
                  <div key={h} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</div>
                ))}
              </div>
              <div className="flex flex-col divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,2.2fr)_140px_120px_140px_140px] items-center gap-6 px-6 py-3.5">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3.5 w-56" />
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-3.5 w-10" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-3.5 w-24" />
                    </div>
                  ))
                ) : general.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-sm font-medium text-slate-500">
                      {search ? "No bookings match your search." : "No general booking enquiries found."}
                    </p>
                  </div>
                ) : (
                  general.map(b => (
                    <div key={b.id} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,2.2fr)_140px_120px_140px_140px] items-center gap-6 px-6 py-3.5 hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col min-w-0">
                        <span className="font-extrabold text-[#111827] text-[13px] truncate">{b.customerName}</span>
                        <span className="text-[11.5px] text-slate-500 font-medium truncate">{b.customerEmail}</span>
                        <span className="text-[11px] text-slate-400 font-medium">{fmtPhone(b.customerMobile)}</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12.5px] text-slate-700 font-semibold truncate" title={b.pickupLocation}>
                          ↑ {b.pickupLocation}
                        </span>
                        <span className="text-[12.5px] text-slate-700 font-semibold truncate" title={b.destination}>
                          ↓ {b.destination}
                        </span>
                      </div>
                      <span className="text-[12.5px] text-slate-600 font-medium">
                        {b.isScheduled ? "Scheduled" : "Instant"}
                        {b.vehicleType ? ` · ${b.vehicleType}` : ""}
                      </span>
                      <span className="text-[13px] text-slate-600 font-medium">{b.passengers}</span>
                      <div><StatusPill status={b.status} /></div>
                      <span className="text-[12px] text-slate-500 font-medium">{fmtDate(b.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="min-w-[1100px]">
              <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,2.4fr)_120px_140px] items-center gap-6 px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
                {["NAME", "COMPANY", "MESSAGE", "STATUS", "CREATED"].map(h => (
                  <div key={h} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</div>
                ))}
              </div>
              <div className="flex flex-col divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,2.4fr)_120px_140px] items-center gap-6 px-6 py-3.5">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3.5 w-72" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-3.5 w-24" />
                    </div>
                  ))
                ) : special.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-sm font-medium text-slate-500">
                      {search ? "No inquiries match your search." : "No special booking inquiries found."}
                    </p>
                  </div>
                ) : (
                  special.map(s => (
                    <div key={s.id} className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,2.4fr)_120px_140px] items-center gap-6 px-6 py-3.5 hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col min-w-0">
                        <span className="font-extrabold text-[#111827] text-[13px] truncate">{s.firstName} {s.lastName}</span>
                        <span className="text-[11.5px] text-slate-500 font-medium truncate">{s.email}</span>
                        <span className="text-[11px] text-slate-400 font-medium">{fmtPhone(s.phone)}</span>
                      </div>
                      <span className="text-[13px] text-slate-700 font-semibold truncate" title={s.companyName}>{s.companyName}</span>
                      <span className="text-[12.5px] text-slate-600 leading-snug line-clamp-2" title={s.message}>{s.message}</span>
                      <div><StatusPill status={s.status} /></div>
                      <span className="text-[12px] text-slate-500 font-medium">{fmtDate(s.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

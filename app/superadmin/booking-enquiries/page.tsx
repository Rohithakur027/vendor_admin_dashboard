"use client";

import { useState, useEffect, useRef } from "react";
import {
  superadminApi,
  type GeneralBookingEnquiry,
  type SpecialBookingInquiry,
} from "@/lib/api";
import { MessageSquare, Inbox, ArrowRight } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportButton } from "@/components/ExportButton";
import { exportToCsv } from "@/lib/exportCsv";

const FONT = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";
const BLUE = "#2563eb";

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

const STATUS_PILL: Record<string, { bg: string; color: string; dot: string; border: string }> = {
  pending:         { bg: "#fefce8", color: "#854d0e", dot: "#eab308",  border: "#fef08a" },
  driver_assigned: { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6",  border: "#bfdbfe" },
  completed:       { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e",  border: "#bbf7d0" },
  cancelled:       { bg: "#fef2f2", color: "#b91c1c", dot: "#ef4444",  border: "#fecaca" },
  New:             { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6",  border: "#bfdbfe" },
  "In Review":     { bg: "#fefce8", color: "#854d0e", dot: "#eab308",  border: "#fef08a" },
  Resolved:        { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e",  border: "#bbf7d0" },
  Closed:          { bg: "#f8fafc", color: "#475569", dot: "#94a3b8",  border: "#e2e8f0" },
};

function StatusPill({ status }: { status: string | null }) {
  const s = (status ?? "—").toString();
  const key = Object.keys(STATUS_PILL).find(k => k.toLowerCase() === s.toLowerCase()) ?? s;
  const t = STATUS_PILL[key] ?? { bg: "#f8fafc", color: "#475569", dot: "#94a3b8", border: "#e2e8f0" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, width: "fit-content",
      background: t.bg, color: t.color, border: `1px solid ${t.border}`,
      borderRadius: 20, fontSize: 11, fontWeight: 700, padding: "3px 10px", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.dot, flexShrink: 0 }} />
      {s.replace(/_/g, " ")}
    </span>
  );
}

function RouteCell({ from, to }: { from: string; to: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {from.split(",")[0]}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 4, margin: "3px 0" }}>
        <div style={{ width: 40, height: 2, background: "linear-gradient(to right,#a5b4fc,#2563eb)", borderRadius: 2 }} />
        <ArrowRight style={{ width: 10, height: 10, color: BLUE }} />
      </div>
      <p style={{ fontSize: 12, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {to.split(",")[0]}
      </p>
    </div>
  );
}

function PersonCell({ name, email, phone }: { name: string; email: string; phone: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
      <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
      <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>{fmtPhone(phone)}</span>
    </div>
  );
}

const GENERAL_COLS = "minmax(0,1.6fr) minmax(0,2.2fr) 150px 110px 150px";
const SPECIAL_COLS = "minmax(0,1.6fr) minmax(0,1.4fr) minmax(0,2.2fr) 150px";

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

  function handleExportGeneral() {
    exportToCsv("general-bookings.csv", general.map(b => ({
      "Customer Name":  b.customerName,
      "Email":          b.customerEmail,
      "Phone":          b.customerMobile,
      "Pickup Address":      b.pickupLocation,
      "Destination Address": b.destination,
      "Vehicle Type":   b.vehicleType ?? "",
      "Booking Type":   b.isScheduled ? "Scheduled" : "Instant",
      "Passengers":     b.passengers,
      "Created":        fmtDate(b.createdAt),
    })));
  }

  function handleExportSpecial() {
    exportToCsv("special-inquiries.csv", special.map(s => ({
      "First Name":  s.firstName,
      "Last Name":   s.lastName,
      "Email":       s.email,
      "Phone":       s.phone,
      "Company":     s.companyName,
      "Message":     s.message,
      "Created":     fmtDate(s.createdAt),
    })));
  }

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
                padding: "9px 16px", fontSize: 13, fontWeight: 700, fontFamily: FONT,
                background: "transparent", border: "none", cursor: "pointer",
                color: active ? BLUE : "#64748B",
                borderBottom: active ? `2px solid ${BLUE}` : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Search + Export */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder={tab === "general"
            ? "Search by customer name, email, phone, or location…"
            : "Search by name, company, email, or phone…"}
        />
        <div style={{ marginLeft: "auto" }}>
          {tab === "general"
            ? <ExportButton onClick={handleExportGeneral} disabled={general.length === 0} />
            : <ExportButton onClick={handleExportSpecial} disabled={special.length === 0} />
          }
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1.5px solid #E8EEF4", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>

          {/* ── GENERAL BOOKINGS ── */}
          {tab === "general" && (
            <div style={{ minWidth: 1100 }}>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: GENERAL_COLS, gap: 16, padding: "10px 24px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["CUSTOMER", "ROUTE", "TYPE", "PASSENGERS", "CREATED"].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</div>
                ))}
              </div>
              {/* Rows */}
              <div>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: GENERAL_COLS, gap: 16, padding: "14px 24px", borderBottom: "1px solid #f8fafc" }}>
                      <Skeleton className="h-3.5 w-36" />
                      <Skeleton className="h-3.5 w-48" />
                      <Skeleton className="h-3.5 w-20" />
                      <Skeleton className="h-3.5 w-10" />
                      <Skeleton className="h-3.5 w-24" />
                    </div>
                  ))
                ) : general.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                    {search ? "No bookings match your search." : "No general booking enquiries found."}
                  </div>
                ) : (
                  general.map((b, i) => (
                    <div key={b.id} style={{
                      display: "grid", gridTemplateColumns: GENERAL_COLS, gap: 16,
                      padding: "12px 24px", alignItems: "center",
                      borderBottom: i < general.length - 1 ? "1px solid #f8fafc" : "none",
                      transition: "background 0.15s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <PersonCell name={b.customerName} email={b.customerEmail} phone={b.customerMobile} />
                      <RouteCell from={b.pickupLocation} to={b.destination} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {b.vehicleType && (
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{b.vehicleType}</span>
                        )}
                        <span style={{ fontSize: 10, fontWeight: 700, background: "#eef2ff", color: "#4f46e5", padding: "2px 7px", borderRadius: 6, display: "inline-block", width: "fit-content" }}>
                          {b.isScheduled ? "Scheduled" : "Instant"}
                        </span>
                      </div>
                      <span style={{ fontSize: 13, color: "#334155", fontWeight: 600 }}>{b.passengers}</span>
                      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{fmtDate(b.createdAt)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── SPECIAL INQUIRIES ── */}
          {tab === "special" && (
            <div style={{ minWidth: 1000 }}>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: SPECIAL_COLS, gap: 16, padding: "10px 24px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                {["NAME", "COMPANY", "MESSAGE", "CREATED"].map(h => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</div>
                ))}
              </div>
              {/* Rows */}
              <div>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: SPECIAL_COLS, gap: 16, padding: "14px 24px", borderBottom: "1px solid #f8fafc" }}>
                      <Skeleton className="h-3.5 w-36" />
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3.5 w-64" />
                      <Skeleton className="h-3.5 w-24" />
                    </div>
                  ))
                ) : special.length === 0 ? (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                    {search ? "No inquiries match your search." : "No special booking inquiries found."}
                  </div>
                ) : (
                  special.map((s, i) => (
                    <div key={s.id} style={{
                      display: "grid", gridTemplateColumns: SPECIAL_COLS, gap: 16,
                      padding: "12px 24px", alignItems: "center",
                      borderBottom: i < special.length - 1 ? "1px solid #f8fafc" : "none",
                      transition: "background 0.15s",
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <PersonCell name={`${s.firstName} ${s.lastName}`} email={s.email} phone={s.phone} />
                      <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.companyName}>
                        {s.companyName}
                      </span>
                      <span style={{ fontSize: 12.5, color: "#64748b", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }} title={s.message}>
                        {s.message}
                      </span>
                      <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{fmtDate(s.createdAt)}</span>
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

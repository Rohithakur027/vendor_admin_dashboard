"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { mockVendors } from "@/lib/mock-data";
import { ArrowLeft, Building2, MapPin, Phone, Mail, Users, Calendar, TrendingUp, Wallet, ShieldOff, ShieldCheck, Plus, CheckCircle2 } from "lucide-react";

const BLUE = "#2563eb";
const FONT = "'DM Sans', system-ui, sans-serif";

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function VendorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const base = mockVendors.find(v => v.id === id);

  const [vendor,        setVendor]        = useState(base ?? null);
  const [walletBalance, setWalletBalance] = useState(12450);
  const [rechargeOpen,  setRechargeOpen]  = useState(false);
  const [rechargeAmt,   setRechargeAmt]   = useState("");
  const [rechargeErr,   setRechargeErr]   = useState("");
  const [toast,         setToast]         = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  if (!vendor) {
    return (
      <div style={{ fontFamily: FONT, padding: 40, color: "#64748b", fontSize: 14 }}>
        Vendor not found.{" "}
        <button onClick={() => router.back()} style={{ color: BLUE, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
          Go back
        </button>
      </div>
    );
  }

  function toggleBlock() {
    const next = vendor!.status === "Active" ? "Inactive" : "Active";
    setVendor(v => v ? { ...v, status: next } : v);
    showToast(next === "Inactive" ? "Vendor account blocked." : "Vendor account unblocked.");
  }

  function handleRecharge() {
    const amt = parseFloat(rechargeAmt);
    if (!rechargeAmt || isNaN(amt) || amt <= 0) { setRechargeErr("Enter a valid amount"); return; }
    setWalletBalance(b => b + amt);
    setRechargeOpen(false);
    setRechargeAmt("");
    setRechargeErr("");
    showToast(`₹${amt.toLocaleString("en-IN")} added to wallet.`);
  }

  const isBlocked = vendor.status === "Inactive";

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');`}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 300,
          background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12,
          padding: "12px 18px", display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)", maxWidth: 340,
        }}>
          <CheckCircle2 style={{ width: 16, height: 16, color: "#16a34a", flexShrink: 0 }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#15803d" }}>{toast}</span>
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "0 20px", height: 52, display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => router.push("/superadmin/vendors")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748b", fontFamily: FONT, fontSize: 13, fontWeight: 600, padding: 0 }}
        >
          <ArrowLeft style={{ width: 15, height: 15 }} />
          Vendors
        </button>
        <span style={{ color: "#cbd5e1" }}>/</span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: BLUE }}>{vendor.name}</span>
      </div>

      {/* Profile header card */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "24px 28px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" as const }}>
        {/* Avatar */}
        <div style={{
          width: 60, height: 60, borderRadius: 16, flexShrink: 0,
          background: isBlocked ? "#f1f5f9" : "#eff6ff",
          color: isBlocked ? "#94a3b8" : BLUE,
          fontWeight: 800, fontSize: 22,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {initials(vendor.name)}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const, marginBottom: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{vendor.name}</span>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
              background: isBlocked ? "#f1f5f9" : "#f0fdf4",
              color:      isBlocked ? "#64748b"  : "#15803d",
              border: `1px solid ${isBlocked ? "#e2e8f0" : "#bbf7d0"}`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: isBlocked ? "#94a3b8" : "#22c55e" }} />
              {vendor.status}
            </span>
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" as const }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b" }}>
              <MapPin style={{ width: 13, height: 13 }} /> {vendor.city}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b" }}>
              <Mail style={{ width: 13, height: 13 }} /> {vendor.email}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b" }}>
              <Phone style={{ width: 13, height: 13 }} /> {vendor.phone}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b" }}>
              <Calendar style={{ width: 13, height: 13 }} /> Joined {fmtDate(vendor.joinedAt)}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button
            onClick={toggleBlock}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 10, cursor: "pointer", fontFamily: FONT,
              fontSize: 13, fontWeight: 700, transition: "all 0.15s",
              border: isBlocked ? "1.5px solid #bbf7d0" : "1.5px solid #fecaca",
              background: isBlocked ? "#f0fdf4" : "#fef2f2",
              color: isBlocked ? "#15803d" : "#b91c1c",
            }}
          >
            {isBlocked
              ? <><ShieldCheck style={{ width: 15, height: 15 }} /> Unblock Account</>
              : <><ShieldOff   style={{ width: 15, height: 15 }} /> Block Account</>
            }
          </button>
          <button
            onClick={() => setRechargeOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              background: BLUE, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: FONT,
            }}
          >
            <Wallet style={{ width: 15, height: 15 }} /> Recharge Wallet
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Drivers",       value: vendor.totalDrivers,           icon: Users,       blue: false },
          { label: "Bookings Today",      value: vendor.totalBookingsToday,     icon: TrendingUp,  blue: false },
          { label: "All-Time Bookings",   value: vendor.totalBookingsAllTime,   icon: Building2,   blue: false },
          { label: "Wallet Balance",      value: `₹${walletBalance.toLocaleString("en-IN")}`, icon: Wallet, blue: true  },
        ].map(s => (
          <div key={s.label} style={{
            background: s.blue ? "#eff6ff" : "#fff",
            border: `1px solid ${s.blue ? "#bfdbfe" : "#e2e8f0"}`,
            borderRadius: 14, padding: "18px 20px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
              background: s.blue ? "#dbeafe" : "#f8fafc",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <s.icon style={{ width: 18, height: 18, color: s.blue ? BLUE : "#64748b" }} />
            </div>
            <div>
              <p style={{ fontSize: s.blue ? 16 : 22, fontWeight: 800, color: s.blue ? BLUE : "#0f172a", lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 4 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Details grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Company Details */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Company Details</span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {[
              { label: "Company Name",    value: vendor.name },
              { label: "Contact Person",  value: vendor.contactPerson },
              { label: "Business Email",  value: vendor.email },
              { label: "Phone",           value: vendor.phone },
              { label: "City",            value: vendor.city },
              { label: "Member Since",    value: fmtDate(vendor.joinedAt) },
            ].map((row, i) => (
              <div key={row.label} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 20px",
                borderBottom: i < 5 ? "1px solid #f8fafc" : "none",
              }}>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{row.label}</span>
                <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 700 }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Secondary POCs */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Secondary POCs</span>
          </div>
          {!vendor.secondaryPOCs || vendor.secondaryPOCs.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center" as const, color: "#cbd5e1", fontSize: 13 }}>
              No secondary contacts added.
            </div>
          ) : (
            <div style={{ padding: "8px 0" }}>
              {vendor.secondaryPOCs.map((poc, i) => (
                <div key={i} style={{
                  padding: "12px 20px",
                  borderBottom: i < vendor.secondaryPOCs!.length - 1 ? "1px solid #f8fafc" : "none",
                }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>{poc.name}</p>
                  <p style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{poc.email}</p>
                  <p style={{ fontSize: 12, color: "#64748b" }}>{poc.phone}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recharge wallet modal */}
      {rechargeOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => { setRechargeOpen(false); setRechargeAmt(""); setRechargeErr(""); }}
        >
          <div
            style={{ background: "#fff", borderRadius: 18, padding: 28, width: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Wallet style={{ width: 18, height: 18, color: BLUE }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Recharge Wallet</p>
                <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>Current balance: ₹{walletBalance.toLocaleString("en-IN")}</p>
              </div>
            </div>

            {/* Amount input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>Amount (₹)</label>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#475569", fontWeight: 600 }}>₹</span>
                <input
                  autoFocus
                  type="number"
                  min="1"
                  placeholder="0"
                  value={rechargeAmt}
                  onChange={e => { setRechargeAmt(e.target.value); setRechargeErr(""); }}
                  onKeyDown={e => { if (e.key === "Enter") handleRecharge(); if (e.key === "Escape") { setRechargeOpen(false); setRechargeAmt(""); setRechargeErr(""); } }}
                  style={{
                    width: "100%", padding: "10px 14px 10px 30px",
                    border: `1.5px solid ${rechargeErr ? "#fca5a5" : "#e2e8f0"}`,
                    borderRadius: 10, fontSize: 15, fontFamily: FONT,
                    color: "#0f172a", background: "#f8fafc", outline: "none",
                    boxSizing: "border-box" as const,
                  }}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = BLUE; (e.target as HTMLInputElement).style.background = "#fff"; }}
                  onBlur={e  => { (e.target as HTMLInputElement).style.borderColor = rechargeErr ? "#fca5a5" : "#e2e8f0"; (e.target as HTMLInputElement).style.background = "#f8fafc"; }}
                />
              </div>
              {rechargeErr && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{rechargeErr}</p>}
            </div>

            {/* Quick amounts */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[500, 1000, 2000, 5000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => { setRechargeAmt(String(amt)); setRechargeErr(""); }}
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 8,
                    border: rechargeAmt === String(amt) ? `1.5px solid ${BLUE}` : "1.5px solid #e2e8f0",
                    background: rechargeAmt === String(amt) ? "#eff6ff" : "#fff",
                    color: rechargeAmt === String(amt) ? BLUE : "#475569",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                  }}
                >
                  +{amt >= 1000 ? `${amt/1000}k` : amt}
                </button>
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleRecharge}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: BLUE, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT }}
              >
                Add to Wallet
              </button>
              <button
                onClick={() => { setRechargeOpen(false); setRechargeAmt(""); setRechargeErr(""); }}
                style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: FONT }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

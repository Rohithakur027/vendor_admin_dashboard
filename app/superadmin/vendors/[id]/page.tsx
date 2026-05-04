"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { vendorsApi, type VendorDetailApiItem, type WalletTransaction } from "@/lib/api";
import {
  ArrowLeft, Building2, MapPin, Phone, Mail, Users,
  Calendar, TrendingUp, Wallet, ShieldOff, ShieldCheck,
  CheckCircle2, Loader2, AlertCircle, Route,
} from "lucide-react";

const BLUE = "#2563eb";
const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function VendorProfilePage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [vendor,       setVendor]       = useState<VendorDetailApiItem | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState("");
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeAmt,  setRechargeAmt]  = useState("");
  const [rechargeErr,  setRechargeErr]  = useState("");
  const [recharging,   setRecharging]   = useState(false);

  const [toggling,     setToggling]     = useState(false);
  const [toast,        setToast]        = useState("");

  useEffect(() => {
    Promise.all([
      vendorsApi.get(id),
      vendorsApi.transactions(id).catch(() => ({ success: true as const, data: [] })),
    ])
      .then(([vendorRes, txRes]) => {
        setVendor(vendorRes.data);
        setTransactions(txRes.data);
      })
      .catch((err) => setFetchError(err instanceof Error ? err.message : "Failed to load vendor"))
      .finally(() => setLoading(false));
  }, [id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function toggleBlock() {
    if (!vendor || toggling) return;
    const next = vendor.status === "Active" ? "Inactive" : "Active";
    setToggling(true);
    try {
      const res = await vendorsApi.update(id, { status: next });
      setVendor(res.data);
      showToast(next === "Inactive" ? "Vendor account blocked." : "Vendor account unblocked.");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setToggling(false);
    }
  }

  async function handleRecharge() {
    const amt = parseFloat(rechargeAmt);
    if (!rechargeAmt || isNaN(amt) || amt <= 0) {
      setRechargeErr("Enter a valid amount");
      return;
    }
    setRecharging(true);
    setRechargeErr("");
    try {
      const res = await vendorsApi.recharge(id, amt);
      setVendor((v) => v ? { ...v, wallet_balance: res.data.wallet_balance } : v);
      setTransactions(prev => [{
        id:             crypto.randomUUID(),
        type:           "CREDIT",
        amount:         amt,
        note:           "Wallet recharge by superadmin",
        balance_before: vendor?.wallet_balance ?? null,
        balance_after:  res.data.wallet_balance,
        created_at:     new Date().toISOString(),
      }, ...prev]);
      setRechargeOpen(false);
      setRechargeAmt("");
      showToast(`${fmtCurrency(amt)} added to wallet.`);
    } catch (err) {
      setRechargeErr(err instanceof Error ? err.message : "Recharge failed.");
    } finally {
      setRecharging(false);
    }
  }

  // ── Fetch error ───────────────────────────────────────────────────────────
  if (!loading && (fetchError || !vendor)) {
    return (
      <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "0 20px", height: 52, display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => router.push("/superadmin/vendors")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#64748b", fontFamily: FONT, fontSize: 13, fontWeight: 600, padding: 0 }}>
            <ArrowLeft style={{ width: 15, height: 15 }} /> Vendors
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "16px 20px" }}>
          <AlertCircle style={{ width: 18, height: 18, color: "#ef4444", flexShrink: 0 }} />
          <span style={{ fontSize: 13.5, color: "#b91c1c", fontWeight: 600 }}>{fetchError || "Vendor not found."}</span>
        </div>
      </div>
    );
  }

  const isBlocked = vendor?.status === "Inactive";
  const skeletonBox = (w: number | string, h: number) => (
    <span style={{ display: "inline-block", width: w, height: h, background: "#f1f5f9", borderRadius: 6, animation: "skel-pulse 1.5s ease-in-out infinite", verticalAlign: "middle" }} />
  );

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 20 }}>

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
          <ArrowLeft style={{ width: 15, height: 15 }} /> Vendors
        </button>
        <span style={{ color: "#cbd5e1" }}>/</span>
        {loading || !vendor ? skeletonBox(120, 14) : (
          <span style={{ fontSize: 13.5, fontWeight: 700, color: BLUE }}>{vendor.name}</span>
        )}
      </div>

      {/* Profile header card */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, padding: "24px 28px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" as const }}>
        {loading || !vendor ? (
          <div style={{ width: 60, height: 60, borderRadius: 16, background: "#f1f5f9", flexShrink: 0, animation: "skel-pulse 1.5s ease-in-out infinite" }} />
        ) : (
          <div style={{
            minWidth: 60, height: 60, borderRadius: 16, flexShrink: 0, padding: "0 14px",
            background: isBlocked ? "#f1f5f9" : "#eff6ff",
            color: isBlocked ? "#94a3b8" : BLUE,
            fontWeight: 800, fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center",
            textAlign: "center", maxWidth: 160, wordBreak: "break-word",
          }}>
            {vendor.name}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const, marginBottom: 6 }}>
            {loading || !vendor ? (
              <>
                {skeletonBox(200, 22)}
                {skeletonBox(70, 20)}
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" as const }}>
            {loading || !vendor ? (
              <>
                {skeletonBox(120, 13)}
                {skeletonBox(180, 13)}
                {skeletonBox(140, 13)}
              </>
            ) : (
              <>
                {vendor.city && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b" }}>
                    <MapPin style={{ width: 13, height: 13 }} /> {vendor.city}
                  </span>
                )}
                {vendor.email && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b" }}>
                    <Mail style={{ width: 13, height: 13 }} /> {vendor.email}
                  </span>
                )}
                {vendor.phone && (
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b" }}>
                    <Phone style={{ width: 13, height: 13 }} /> {vendor.phone}
                  </span>
                )}
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#64748b" }}>
                  <Calendar style={{ width: 13, height: 13 }} /> Joined {fmtDate(vendor.joinedAt)}
                </span>
              </>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button
            onClick={toggleBlock}
            disabled={toggling || loading || !vendor}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 10, cursor: toggling ? "not-allowed" : "pointer",
              fontFamily: FONT, fontSize: 13, fontWeight: 700, transition: "all 0.15s",
              border: isBlocked ? "1.5px solid #bbf7d0" : "1.5px solid #fecaca",
              background: isBlocked ? "#f0fdf4" : "#fef2f2",
              color: isBlocked ? "#15803d" : "#b91c1c",
              opacity: (toggling || loading) ? 0.6 : 1,
            }}
          >
            {toggling
              ? <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />
              : isBlocked
                ? <ShieldCheck style={{ width: 15, height: 15 }} />
                : <ShieldOff   style={{ width: 15, height: 15 }} />
            }
            {isBlocked ? "Unblock Account" : "Block Account"}
          </button>
          <button
            onClick={() => setRechargeOpen(true)}
            disabled={loading || !vendor}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 16px", borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer",
              background: BLUE, color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: FONT,
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Wallet style={{ width: 15, height: 15 }} /> Recharge Wallet
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {[
          { label: "Total Supervisors",  value: vendor?.totalSupervisors ?? 0, icon: Users,      blue: false },
          { label: "Trips Today",    value: vendor?.totalBookingsToday ?? 0,   icon: Route,      blue: false },
          { label: "All-Time Trips", value: vendor?.totalBookingsAllTime ?? 0, icon: Route,      blue: false },
          { label: "Wallet Balance",    value: fmtCurrency(vendor?.wallet_balance ?? 0), icon: Wallet, blue: true },
        ].map((s) => (
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
              {loading || !vendor ? skeletonBox(80, 22) : (
                <p style={{ fontSize: s.blue ? 16 : 22, fontWeight: 800, color: s.blue ? BLUE : "#0f172a", lineHeight: 1 }}>{s.value}</p>
              )}
              <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 4 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Details grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Vendor Details */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Vendor Details</span>
          </div>
          <div style={{ padding: "6px 0" }}>
            {[
              { label: "Vendor Name",    value: vendor?.name },
              { label: "Contact Person", value: vendor?.contactPerson },
              { label: "Business Email", value: vendor?.email },
              { label: "Phone",          value: vendor?.phone },
              { label: "City",           value: vendor?.city },
              { label: "Member Since",   value: vendor ? fmtDate(vendor.joinedAt) : "" },
            ].map((row, i) => (
              <div key={row.label} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 20px",
                borderBottom: i < 5 ? "1px solid #f8fafc" : "none",
              }}>
                <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{row.label}</span>
                {loading || !vendor ? skeletonBox(120, 14) : (
                  <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 700, maxWidth: "60%", textAlign: "right" as const, wordBreak: "break-word" as const }}>{row.value || "—"}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 20px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Recent Transactions</span>
          </div>
          {loading ? (
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", borderBottom: i < 3 ? "1px solid #f8fafc" : "none" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: "#f1f5f9", flexShrink: 0, animation: "skel-pulse 1.5s ease-in-out infinite" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    {skeletonBox("70%", 12)}
                    {skeletonBox("40%", 10)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    {skeletonBox(60, 13)}
                    {skeletonBox(40, 10)}
                  </div>
                </div>
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center" as const, color: "#cbd5e1", fontSize: 13 }}>
              No transactions yet.
            </div>
          ) : (
            <div style={{ overflowY: "auto", maxHeight: 320 }}>
              {transactions.map((tx, i) => {
                const isCredit = tx.type === "CREDIT";
                const fmtAmt   = fmtCurrency(tx.amount);
                const fmtTime  = new Date(tx.created_at).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit", hour12: true,
                });
                return (
                  <div
                    key={tx.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 20px",
                      borderBottom: i < transactions.length - 1 ? "1px solid #f8fafc" : "none",
                    }}
                  >
                    {/* Indicator dot */}
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      background: isCredit ? "#f0fdf4" : "#fef2f2",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15,
                    }}>
                      {isCredit ? "↑" : "↓"}
                    </div>

                    {/* Note + time */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {tx.note ?? (isCredit ? "Credit" : "Debit")}
                      </p>
                      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{fmtTime}</p>
                    </div>

                    {/* Amount + balance after */}
                    <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                      <p style={{ fontSize: 13.5, fontWeight: 800, color: isCredit ? "#15803d" : "#b91c1c" }}>
                        {isCredit ? "+" : "−"}{fmtAmt}
                      </p>
                      {tx.balance_after != null && (
                        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>Bal: {fmtCurrency(tx.balance_after)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recharge wallet modal */}
      {rechargeOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => { if (!recharging) { setRechargeOpen(false); setRechargeAmt(""); setRechargeErr(""); } }}
        >
          <div
            style={{ background: "#fff", borderRadius: 18, padding: 28, width: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Wallet style={{ width: 18, height: 18, color: BLUE }} />
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Recharge Wallet</p>
                <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 1 }}>Current balance: {fmtCurrency(vendor?.wallet_balance ?? 0)}</p>
              </div>
            </div>

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
                  onChange={(e) => { setRechargeAmt(e.target.value); setRechargeErr(""); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRecharge();
                    if (e.key === "Escape" && !recharging) { setRechargeOpen(false); setRechargeAmt(""); setRechargeErr(""); }
                  }}
                  disabled={recharging}
                  style={{
                    width: "100%", padding: "10px 14px 10px 30px",
                    border: `1.5px solid ${rechargeErr ? "#fca5a5" : "#e2e8f0"}`,
                    borderRadius: 10, fontSize: 15, fontFamily: FONT,
                    color: "#0f172a", background: "#f8fafc", outline: "none",
                    boxSizing: "border-box" as const, opacity: recharging ? 0.6 : 1,
                  }}
                  onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = BLUE; (e.target as HTMLInputElement).style.background = "#fff"; }}
                  onBlur={(e)  => { (e.target as HTMLInputElement).style.borderColor = rechargeErr ? "#fca5a5" : "#e2e8f0"; (e.target as HTMLInputElement).style.background = "#f8fafc"; }}
                />
              </div>
              {rechargeErr && <p style={{ fontSize: 11.5, color: "#ef4444", marginTop: 5 }}>{rechargeErr}</p>}
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[500, 1000, 2000, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  disabled={recharging}
                  onClick={() => { setRechargeAmt(String(amt)); setRechargeErr(""); }}
                  style={{
                    flex: 1, padding: "6px 0", borderRadius: 8,
                    border: rechargeAmt === String(amt) ? `1.5px solid ${BLUE}` : "1.5px solid #e2e8f0",
                    background: rechargeAmt === String(amt) ? "#eff6ff" : "#fff",
                    color: rechargeAmt === String(amt) ? BLUE : "#475569",
                    fontSize: 12, fontWeight: 700, cursor: recharging ? "not-allowed" : "pointer", fontFamily: FONT,
                  }}
                >
                  +{amt >= 1000 ? `${amt / 1000}k` : amt}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleRecharge}
                disabled={recharging}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                  background: BLUE, color: "#fff", fontWeight: 700, fontSize: 14,
                  cursor: recharging ? "not-allowed" : "pointer", fontFamily: FONT,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: recharging ? 0.8 : 1,
                }}
              >
                {recharging && <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />}
                {recharging ? "Processing…" : "Add to Wallet"}
              </button>
              <button
                onClick={() => { setRechargeOpen(false); setRechargeAmt(""); setRechargeErr(""); }}
                disabled={recharging}
                style={{ padding: "11px 18px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, cursor: recharging ? "not-allowed" : "pointer", fontFamily: FONT }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes skel-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { vendorsApi, type VendorDetailApiItem, type VendorDocument } from "@/lib/api";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, User,
  CheckCircle2, XCircle, Loader2, AlertCircle, FileText, Users, ExternalLink,
} from "lucide-react";

const FONT = "var(--font-plus-jakarta-sans), 'Plus Jakarta Sans', sans-serif";
const BLUE = "#2563eb";

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return d; }
}

function fmtPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  return phone;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
        <Icon style={{ width: 15, height: 15, color: "#64748B" }} />
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", marginTop: 2 }}>{value}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1.5px solid #E8EEF4", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
      <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.06em" }}>{title}</h3>
      {children}
    </div>
  );
}

export default function VendorReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [vendor,   setVendor]   = useState<VendorDetailApiItem | null>(null);
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [actionErr, setActionErr] = useState("");
  const [done,      setDone]      = useState<"approved" | "rejected" | null>(null);

  const [rejectReason, setRejectReason] = useState("");
  const [showReject,   setShowReject]   = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      vendorsApi.get(id),
      vendorsApi.documents.list(id).catch(() => ({ success: true as const, data: [] as VendorDocument[] })),
    ])
      .then(([vRes, dRes]) => { setVendor(vRes.data); setDocuments(dRes.data ?? []); })
      .catch(err => setError(err instanceof Error ? err.message : "Failed to load vendor"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleApprove() {
    if (!id) return;
    setApproving(true); setActionErr("");
    try {
      await vendorsApi.verify(id);
      setDone("approved");
      setTimeout(() => router.push("/superadmin/vendors"), 1600);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Failed to approve vendor");
    } finally { setApproving(false); }
  }

  async function handleReject() {
    if (!id) return;
    setRejecting(true); setActionErr("");
    try {
      await vendorsApi.reject(id, rejectReason.trim() || undefined);
      setDone("rejected");
      setTimeout(() => router.push("/superadmin/vendors"), 1600);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : "Failed to reject vendor");
    } finally { setRejecting(false); }
  }

  // ── Loading ──
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320, fontFamily: FONT }}>
        <Loader2 style={{ width: 28, height: 28, color: BLUE, animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 12, padding: "14px 18px", fontFamily: FONT }}>
        <AlertCircle style={{ width: 18, height: 18, color: "#EF4444", flexShrink: 0 }} />
        <span style={{ fontSize: 13, color: "#B91C1C", fontWeight: 600 }}>{error || "Vendor not found."}</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT, maxWidth: 780 }}>

      {/* ── Back + header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button
          onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#64748B", background: "#F1F5F9", border: "none", borderRadius: 9, padding: "7px 13px", cursor: "pointer" }}
        >
          <ArrowLeft style={{ width: 14, height: 14 }} /> Back
        </button>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>Vendor Review</h2>
          <p style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>Self-registered vendor — review details and approve or reject</p>
        </div>
      </div>

      {/* ── Current status badge ── */}
      {(() => {
        const v = vendor as VendorDetailApiItem & { is_verified?: boolean; verification_note?: string | null };
        const isVerified = v.is_verified === true;
        const isRejected = v.is_verified === false && !!v.verification_note;
        const bg     = isVerified ? "#F0FDF4" : isRejected ? "#FEF2F2" : "#FFFBEB";
        const border = isVerified ? "#BBF7D0" : isRejected ? "#FECACA" : "#FDE68A";
        const color  = isVerified ? "#15803D" : isRejected ? "#B91C1C" : "#92400E";
        const dot    = isVerified ? "#16A34A" : isRejected ? "#DC2626" : "#F59E0B";
        const label  = isVerified ? "Verified" : isRejected ? "Rejected" : "Pending review";
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: dot }} />
              <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
            </div>
            {v.verification_note && (
              <span style={{ fontSize: 12, color, fontWeight: 600, opacity: 0.85 }}>Reason: {v.verification_note}</span>
            )}
          </div>
        );
      })()}

      {/* ── Done banner ── */}
      {done && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, borderRadius: 12, padding: "14px 18px",
          background: done === "approved" ? "#F0FDF4" : "#FEF2F2",
          border: `1.5px solid ${done === "approved" ? "#BBF7D0" : "#FECACA"}`,
        }}>
          {done === "approved"
            ? <CheckCircle2 style={{ width: 18, height: 18, color: "#16A34A", flexShrink: 0 }} />
            : <XCircle      style={{ width: 18, height: 18, color: "#EF4444", flexShrink: 0 }} />
          }
          <span style={{ fontSize: 13, fontWeight: 700, color: done === "approved" ? "#15803D" : "#B91C1C" }}>
            {done === "approved" ? "Vendor approved — redirecting…" : "Vendor rejected — redirecting…"}
          </span>
        </div>
      )}

      {/* ── Company info ── */}
      <SectionCard title="Company Information">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <InfoRow icon={Building2} label="Company Name"   value={vendor.name} />
          <InfoRow icon={MapPin}    label="City"           value={vendor.city} />
          <InfoRow icon={User}      label="Contact Person" value={vendor.contactPerson} />
          <InfoRow icon={Phone}     label="Phone"          value={fmtPhone(vendor.phone)} />
          <InfoRow icon={Mail}      label="Email"          value={vendor.email} />
          <InfoRow icon={Building2} label="Registered On"  value={fmtDate(vendor.joinedAt)} />
        </div>
        {(vendor as VendorDetailApiItem & { address?: string }).address && (
          <div style={{ paddingTop: 4, borderTop: "1px solid #F1F5F9" }}>
            <InfoRow icon={MapPin} label="Address" value={(vendor as VendorDetailApiItem & { address?: string }).address!} />
          </div>
        )}
      </SectionCard>

      {/* ── Secondary POCs ── */}
      {vendor.secondaryPOCs?.length > 0 && (
        <SectionCard title="Secondary Points of Contact">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {vendor.secondaryPOCs.map((poc, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E8EEF4" }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Users style={{ width: 15, height: 15, color: "#6366F1" }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{poc.name}</p>
                  <p style={{ fontSize: 11.5, color: "#64748B" }}>{poc.email} · {fmtPhone(poc.phone)}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Documents ── */}
      <SectionCard title="Submitted Documents">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(["PAN_CARD", "GST_CERTIFICATE"] as const).map(docType => {
            const label = docType === "PAN_CARD" ? "PAN Card" : "GST Registration Certificate";
            const doc = documents.find(d => d.doc_type === docType);
            return (
              <div key={docType} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E8EEF4" }}>
                <FileText style={{ width: 16, height: 16, color: doc ? "#2563EB" : "#94A3B8", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{label}</p>
                  {doc && (
                    <p style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>
                      {doc.doc_number || "No number"}
                      {doc.expiry_date ? ` · expires ${fmtDate(doc.expiry_date)}` : ""}
                    </p>
                  )}
                </div>
                {doc?.file_url ? (
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "#2563EB", textDecoration: "none" }}>
                    View <ExternalLink style={{ width: 12, height: 12 }} />
                  </a>
                ) : (
                  <span style={{ fontSize: 11.5, color: "#94A3B8", fontWeight: 500 }}>{doc ? "No file" : "Not submitted"}</span>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* ── Action error ── */}
      {actionErr && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 10, padding: "12px 16px" }}>
          <AlertCircle style={{ width: 15, height: 15, color: "#EF4444", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "#B91C1C", fontWeight: 600 }}>{actionErr}</span>
        </div>
      )}

      {/* ── Reject reason input ── */}
      {showReject && !done && (
        <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #FECACA", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>Rejection reason (optional)</label>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="e.g. Incomplete information, invalid documents…"
            rows={3}
            style={{ resize: "vertical", border: "1.5px solid #E2E8F0", borderRadius: 10, padding: "10px 12px", fontSize: 13, fontFamily: FONT, color: "#0F172A", outline: "none", width: "100%", boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={() => setShowReject(false)} style={{ fontSize: 13, fontWeight: 600, color: "#64748B", background: "#F1F5F9", border: "none", borderRadius: 9, padding: "8px 16px", cursor: "pointer" }}>
              Cancel
            </button>
            <button onClick={handleReject} disabled={rejecting} style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: "#EF4444", border: "none", borderRadius: 9, padding: "8px 18px", cursor: rejecting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 7, opacity: rejecting ? 0.7 : 1 }}>
              {rejecting && <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />}
              Confirm Reject
            </button>
          </div>
        </div>
      )}

      {/* ── Action buttons ── */}
      {!done && (
        <div style={{ display: "flex", gap: 12, paddingBottom: 8 }}>
          {!showReject && (
            <button
              onClick={() => setShowReject(true)}
              disabled={approving}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "#B91C1C", background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 11, padding: "11px 22px", cursor: approving ? "not-allowed" : "pointer", opacity: approving ? 0.5 : 1 }}
            >
              <XCircle style={{ width: 16, height: 16 }} /> Reject
            </button>
          )}
          <button
            onClick={handleApprove}
            disabled={approving || rejecting}
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "#fff", background: BLUE, border: "none", borderRadius: 11, padding: "11px 28px", cursor: (approving || rejecting) ? "not-allowed" : "pointer", opacity: (approving || rejecting) ? 0.7 : 1 }}
          >
            {approving && <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />}
            {approving ? "Approving…" : <><CheckCircle2 style={{ width: 16, height: 16 }} /> Approve Vendor</>}
          </button>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

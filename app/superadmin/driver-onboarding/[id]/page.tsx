"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { driverOnboardingApi, type OnboardingDetail, type OnboardingDoc } from "@/lib/api";
import { STATUS_STYLES } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

const BLUE = "#1d4ed8";
const FONT = "'DM Sans', system-ui, sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────
type DocStatus = "Pending" | "Approved" | "Rejected" | "Not Submitted";

interface Doc {
  id:              string; // = doc_type
  name:            string;
  desc:            string;
  submitted:       boolean;
  status:          DocStatus;
  rejectionReason: string;
  hasExpiry:       boolean;
  expiryDate:      string | null;
}

function mapDoc(d: OnboardingDoc): Doc {
  return {
    id:              d.doc_type,
    name:            d.name,
    desc:            d.description,
    submitted:       d.submitted,
    status:          d.status as DocStatus,
    rejectionReason: d.rejection_note ?? "",
    hasExpiry:       d.has_expiry,
    expiryDate:      d.expiry_date,
  };
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function buildSections(r: OnboardingDetail) {
  const fmt = (v: string | null | undefined) => v || "—";
  type Field = { label: string; value: string; raw: string; key: string };
  const sections: { title: string; fields: Field[] }[] = [
    {
      title: "PERSONAL INFORMATION",
      fields: [
        { label: "FULL NAME",       value: fmt(r.full_name),         raw: r.full_name ?? "",         key: "full_name" },
        { label: "DATE OF BIRTH",   value: fmtDate(r.date_of_birth), raw: r.date_of_birth ?? "",     key: "date_of_birth" },
        { label: "GENDER",          value: fmt(r.gender),            raw: r.gender ?? "",            key: "gender" },
        { label: "PHONE NUMBER",    value: fmt(r.phone),             raw: r.phone ?? "",             key: "phone" },
        { label: "ALTERNATE PHONE", value: fmt(r.alternate_phone),   raw: r.alternate_phone ?? "",   key: "alternate_phone" },
        { label: "EMAIL ADDRESS",   value: fmt(r.email),             raw: r.email ?? "",             key: "email" },
      ],
    },
    {
      title: "ADDRESS DETAILS",
      fields: [
        { label: "CURRENT ADDRESS",   value: fmt(r.current_address),   raw: r.current_address ?? "",   key: "current_address" },
        { label: "CITY",              value: fmt(r.city),              raw: r.city ?? "",              key: "city" },
        { label: "STATE",             value: fmt(r.state),             raw: r.state ?? "",             key: "state" },
        { label: "PINCODE",           value: fmt(r.pincode),           raw: r.pincode ?? "",           key: "pincode" },
        { label: "PERMANENT ADDRESS", value: fmt(r.permanent_address), raw: r.permanent_address ?? "", key: "permanent_address" },
        { label: "NATIONALITY",       value: fmt(r.nationality),       raw: r.nationality ?? "",       key: "nationality" },
      ],
    },
    {
      title: "LICENSE & EMPLOYMENT",
      fields: [
        { label: "LICENSE NUMBER",      value: fmt(r.license_number),                                                         raw: r.license_number ?? "",                                      key: "license_number" },
        { label: "LICENSE CLASS",       value: fmt(r.license_class),                                                          raw: r.license_class ?? "",                                       key: "license_class" },
        { label: "LICENSE EXPIRY",      value: fmtDate(r.license_expiry),                                                     raw: r.license_expiry ?? "",                                      key: "license_expiry" },
        { label: "YEARS OF EXPERIENCE", value: r.years_of_experience != null ? `${r.years_of_experience} Years` : "—",        raw: r.years_of_experience != null ? String(r.years_of_experience) : "", key: "years_of_experience" },
        { label: "JOINING DATE",        value: fmtDate(r.joining_date),                                                       raw: r.joining_date ?? "",                                        key: "joining_date" },
      ],
    },
    {
      title: "EMERGENCY CONTACT",
      fields: [
        { label: "CONTACT NAME",  value: fmt(r.emergency_contact_name),         raw: r.emergency_contact_name ?? "",         key: "emergency_contact_name" },
        { label: "RELATIONSHIP",  value: fmt(r.emergency_contact_relationship), raw: r.emergency_contact_relationship ?? "", key: "emergency_contact_relationship" },
        { label: "CONTACT PHONE", value: fmt(r.emergency_contact_phone),        raw: r.emergency_contact_phone ?? "",        key: "emergency_contact_phone" },
      ],
    },
  ];

  if (r.vehicle) {
    sections.push({
      title: "VEHICLE INFORMATION",
      fields: [
        { label: "PLATE NUMBER", value: fmt(r.vehicle.plate_number), raw: r.vehicle.plate_number ?? "", key: "vehicle.plate_number" },
        { label: "MODEL",        value: fmt(r.vehicle.model),        raw: r.vehicle.model ?? "",        key: "vehicle.model" },
        { label: "COLOR",        value: fmt(r.vehicle.color),        raw: r.vehicle.color ?? "",        key: "vehicle.color" },
        { label: "TYPE",         value: fmt(r.vehicle.type),         raw: r.vehicle.type ?? "",         key: "vehicle.type" },
      ],
    });
  }

  return sections;
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: DocStatus }) {
  const c = STATUS_STYLES[status] ?? STATUS_STYLES["Not Submitted"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      whiteSpace: "nowrap" as const, width: "fit-content",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

// ── View modal ────────────────────────────────────────────────────────────────
function ViewModal({
  doc, onClose, onApprove, onReject,
}: {
  doc: Doc;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [changeMode, setChangeMode] = useState(false);
  const [reason,     setReason]     = useState("");

  const decided    = doc.status === "Approved" || doc.status === "Rejected";
  const showActions = !decided || changeMode;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 520, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>{doc.name}</p>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Submitted by driver</p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: 14, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >✕</button>
        </div>

        <div style={{
          minHeight: 280, background: "#eff6ff", border: `2px dashed ${BLUE}`,
          borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 20,
        }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="3" width="16" height="18" rx="2" stroke={BLUE} strokeWidth="1.5"/>
              <path d="M8 8h8M8 12h8M8 16h5" stroke={BLUE} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: BLUE }}>{doc.name}</p>
          <p style={{ fontSize: 12, color: "#94a3b8" }}>{doc.desc}</p>
        </div>

        {decided && !changeMode ? (
          <div style={{ textAlign: "center" as const }}>
            <StatusBadge status={doc.status} />
            {doc.status === "Rejected" && doc.rejectionReason && (
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>Reason: {doc.rejectionReason}</p>
            )}
            <button
              onClick={() => { setChangeMode(true); setRejectMode(false); setReason(""); }}
              style={{ display: "block", margin: "10px auto 0", fontSize: 12, color: BLUE, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: FONT }}
            >Change Decision</button>
          </div>
        ) : rejectMode ? (
          <div>
            <input
              autoFocus
              placeholder="Rejection reason..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: FONT, color: "#0f172a", background: "#f8fafc", outline: "none", boxSizing: "border-box" as const, marginBottom: 12 }}
              onFocus={e  => { (e.target as HTMLInputElement).style.borderColor = BLUE; }}
              onBlur={e   => { (e.target as HTMLInputElement).style.borderColor = "#e2e8f0"; }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => { if (reason.trim()) { onReject(reason); onClose(); } }}
                disabled={!reason.trim()}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none", background: reason.trim() ? "#EF4444" : "#e2e8f0", color: reason.trim() ? "#fff" : "#94a3b8", fontWeight: 700, fontSize: 13.5, cursor: reason.trim() ? "pointer" : "not-allowed", fontFamily: FONT }}
              >Confirm Reject</button>
              <button
                onClick={() => setRejectMode(false)}
                style={{ padding: "10px 16px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 13.5, cursor: "pointer", fontFamily: FONT }}
              >Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { onApprove(); onClose(); }}
              style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "none", background: BLUE, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT }}
            >Approve</button>
            <button
              onClick={() => setRejectMode(true)}
              style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: FONT }}
            >Reject</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Custom date picker ────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function DatePickerCell({ value, onChange, hasExpiry }: { value: string; onChange: (v: string) => void; hasExpiry: boolean }) {
  const [open, setOpen]          = useState(false);
  const [viewYear, setViewYear]  = useState(() => value ? parseInt(value.split("-")[0]) : new Date().getFullYear());
  const [viewMonth, setViewMonth]= useState(() => value ? parseInt(value.split("-")[1]) - 1 : new Date().getMonth());
  const wrapRef = useRef<HTMLDivElement>(null);
  const today   = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  if (!hasExpiry) return <span style={{ fontSize: 12, color: "#cbd5e1", fontStyle: "italic" }}>No expiry</span>;

  function prevMonth() { viewMonth === 0 ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1); }
  function nextMonth() { viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0)) : setViewMonth(m => m + 1); }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (string | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-block" }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 7,
          border: open ? `1.5px solid ${BLUE}` : "1px solid #e2e8f0",
          background: open ? "#eff6ff" : "#f8fafc", cursor: "pointer", fontFamily: FONT,
          color: value ? "#334155" : "#94a3b8", fontSize: 12.5, fontWeight: value ? 600 : 400,
        }}
      >
        {value ? fmtDate(value) : "Not set"}
        <ChevronRight style={{ width: 12, height: 12, transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 999,
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14,
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)", padding: 14, width: 240,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={prevMonth} style={{ padding: 4, border: "none", background: "none", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", color: "#64748b" }}>
              <ChevronLeft style={{ width: 15, height: 15 }} />
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{MONTHS[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} style={{ padding: 4, border: "none", background: "none", cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", color: "#64748b" }}>
              <ChevronRight style={{ width: 15, height: 15 }} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#94a3b8", paddingBottom: 4 }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {cells.map((dateStr, idx) => {
              if (!dateStr) return <div key={idx} style={{ height: 30 }} />;
              const isSelected = dateStr === value;
              const isToday    = dateStr === today;
              return (
                <button
                  key={dateStr}
                  onClick={() => { onChange(dateStr); setOpen(false); }}
                  style={{
                    height: 30, borderRadius: "50%", border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: isSelected ? 800 : isToday ? 700 : 400,
                    background: isSelected ? BLUE : "transparent",
                    color: isSelected ? "#fff" : isToday ? BLUE : "#334155",
                    outline: isToday && !isSelected ? `1.5px solid ${BLUE}` : "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#f1f5f9"; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {parseInt(dateStr.split("-")[2])}
                </button>
              );
            })}
          </div>
          {value && (
            <button
              onClick={() => { onChange(""); setOpen(false); }}
              style={{ marginTop: 10, width: "100%", padding: "6px 0", border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", color: "#94a3b8", fontSize: 11.5, cursor: "pointer", fontFamily: FONT }}
            >Clear date</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Document table ────────────────────────────────────────────────────────────
function DocTable({
  docs, onApprove, onReject, onView, onUpload,
}: {
  docs:      Doc[];
  onApprove: (id: string) => void;
  onReject:  (id: string, reason: string) => void;
  onView:    (doc: Doc) => void;
  onUpload:  (id: string, file: File) => void;
}) {
  const [rejectingId,   setRejectingId]   = useState<string | null>(null);
  const [reason,        setReason]        = useState("");
  const [expiryEdits,   setExpiryEdits]   = useState<Record<string, string>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const pendingDocId  = useRef<string>("");

  const GRID = "2fr 1.2fr 1.3fr 1.7fr 1.3fr";
  const GAP  = 16;

  function confirmReject(id: string) {
    onReject(id, reason);
    setRejectingId(null);
    setReason("");
  }

  const triggerUpload = useCallback((docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    pendingDocId.current = docId;
    fileInputRef.current?.click();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && pendingDocId.current) {
      const docId = pendingDocId.current;
      setUploadedFiles(prev => ({ ...prev, [docId]: file.name }));
      onUpload(docId, file);
    }
    e.target.value = "";
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
      {/* Hidden file input shared across all rows */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <div style={{ display: "grid", gridTemplateColumns: GRID, columnGap: GAP, padding: "11px 24px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        {["DOCUMENT", "STATUS", "EXPIRY DATE", "ACTION", "UPLOAD FILE"].map(h => (
          <span key={h} style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>{h}</span>
        ))}
      </div>

      {docs.map((doc, idx) => {
        const currentExpiry  = expiryEdits[doc.id] ?? doc.expiryDate ?? "";
        const uploadedName   = uploadedFiles[doc.id];
        return (
          <div key={doc.id}>
            <div
              onClick={() => doc.submitted && onView(doc)}
              style={{
                display: "grid", gridTemplateColumns: GRID, columnGap: GAP,
                padding: "15px 24px", alignItems: "center",
                borderBottom: idx < docs.length - 1 || rejectingId === doc.id ? "1px solid #f1f5f9" : "none",
                transition: "background 0.12s",
                cursor: doc.submitted ? "pointer" : "default",
              }}
              onMouseEnter={e => { if (doc.submitted) (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {/* Document name */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: doc.submitted ? "#0f172a" : "#94a3b8" }}>{doc.name}</span>
                {uploadedName && (
                  <span style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                    📎 {uploadedName}
                  </span>
                )}
              </div>

              <StatusBadge status={doc.status} />

              <div onClick={e => e.stopPropagation()}>
                <DatePickerCell
                  value={currentExpiry}
                  hasExpiry={doc.hasExpiry}
                  onChange={v => setExpiryEdits(p => ({ ...p, [doc.id]: v }))}
                />
              </div>

              {/* Action column */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={e => e.stopPropagation()}>
                {!doc.submitted ? (
                  <span style={{ fontSize: 12.5, color: "#94a3b8", fontStyle: "italic" }}>Awaiting upload</span>
                ) : (
                  <>
                    {doc.status === "Approved" && (
                      <button onClick={() => { setRejectingId(doc.id); setReason(""); }} style={{ padding: "5px 11px", borderRadius: 7, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Reject instead</button>
                    )}
                    {doc.status === "Rejected" && (
                      <button onClick={() => onApprove(doc.id)} style={{ padding: "5px 13px", borderRadius: 7, border: "none", background: BLUE, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Approve instead</button>
                    )}
                    {doc.status === "Pending" && (
                      <>
                        <button onClick={() => onApprove(doc.id)} style={{ padding: "5px 13px", borderRadius: 7, border: "none", background: BLUE, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Approve</button>
                        <button onClick={() => { setRejectingId(doc.id); setReason(""); }} style={{ padding: "5px 11px", borderRadius: 7, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Reject</button>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Upload File column */}
              <div onClick={e => e.stopPropagation()}>
                {uploadedName ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: 140 }}>
                      📎 {uploadedName}
                    </span>
                    <button
                      onClick={e => triggerUpload(doc.id, e)}
                      style={{ padding: "3px 8px", borderRadius: 6, border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT, width: "fit-content" }}
                    >Change</button>
                  </div>
                ) : (
                  <button
                    onClick={e => triggerUpload(doc.id, e)}
                    style={{ padding: "5px 11px", borderRadius: 7, border: "1.5px solid #bfdbfe", background: "#eff6ff", color: BLUE, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}
                  >Upload yourself</button>
                )}
              </div>
            </div>

            {rejectingId === doc.id && (
              <div style={{ padding: "12px 24px 16px", background: "#fafafa", borderBottom: idx < docs.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                <input
                  autoFocus
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Add rejection reason..."
                  style={{ width: "100%", padding: "9px 14px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: FONT, color: "#0f172a", background: "#f8fafc", outline: "none", boxSizing: "border-box" as const }}
                  onFocus={e  => { (e.target as HTMLInputElement).style.borderColor = BLUE; }}
                  onBlur={e   => { (e.target as HTMLInputElement).style.borderColor = "#e2e8f0"; }}
                  onKeyDown={e => {
                    if (e.key === "Enter"  && reason.trim()) confirmReject(doc.id);
                    if (e.key === "Escape") { setRejectingId(null); setReason(""); }
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button
                    onClick={() => confirmReject(doc.id)}
                    disabled={!reason.trim()}
                    style={{ padding: "7px 18px", borderRadius: 7, border: "none", background: reason.trim() ? "#EF4444" : "#e2e8f0", color: reason.trim() ? "#fff" : "#94a3b8", fontWeight: 700, fontSize: 12.5, cursor: reason.trim() ? "pointer" : "not-allowed", fontFamily: FONT }}
                  >Confirm Reject</button>
                  <button
                    onClick={() => { setRejectingId(null); setReason(""); }}
                    style={{ padding: "7px 14px", borderRadius: 7, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: FONT }}
                  >Cancel</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DriverReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [record,      setRecord]      = useState<OnboardingDetail | null>(null);
  const [driverDocs,  setDriverDocs]  = useState<Doc[]>([]);
  const [vehicleDocs, setVehicleDocs] = useState<Doc[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<"basic" | "driver" | "vehicle">("basic");
  const [viewDoc,     setViewDoc]     = useState<{ doc: Doc; kind: "driver" | "vehicle" } | null>(null);

  // basic-details inline editing
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [sectionDraft,   setSectionDraft]   = useState<Record<string, string>>({});

  function startEdit(section: ReturnType<typeof buildSections>[0]) {
    setEditingSection(section.title);
    const draft: Record<string, string> = {};
    for (const f of section.fields) draft[f.key] = f.raw;
    setSectionDraft(draft);
  }

  function saveEdit() {
    setRecord(prev => {
      if (!prev) return prev;
      const next = { ...prev } as typeof prev & { vehicle: typeof prev.vehicle };
      for (const [key, val] of Object.entries(sectionDraft)) {
        if (key.startsWith("vehicle.")) {
          const vKey = key.split(".")[1] as "plate_number" | "model" | "color" | "type";
          if (next.vehicle) next.vehicle = { ...next.vehicle, [vKey]: val || null };
        } else {
          (next as unknown as Record<string, unknown>)[key] = val || null;
        }
      }
      return next;
    });
    setEditingSection(null);
    setSectionDraft({});
  }

  // onboarding-level reject modal
  const [rejectModal,    setRejectModal]    = useState(false);
  const [rejectNote,     setRejectNote]     = useState("");
  const [approveModal,   setApproveModal]   = useState(false);
  const [actionLoading,  setActionLoading]  = useState(false);
  const [toast,          setToast]          = useState("");

  useEffect(() => {
    if (!id) return;
    driverOnboardingApi.get(id)
      .then(res => {
        setRecord(res.data);
        setDriverDocs(res.data.documents.driver.map(mapDoc));
        setVehicleDocs(res.data.documents.vehicle.map(mapDoc));
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function applyUpload(docId: string, kind: "driver" | "vehicle") {
    const setter = kind === "driver" ? setDriverDocs : setVehicleDocs;
    setter(prev => prev.map(d =>
      d.id === docId && !d.submitted
        ? { ...d, submitted: true, status: "Pending" as DocStatus }
        : d
    ));
  }

  function applyApprove(docId: string, kind: "driver" | "vehicle") {
    const setter = kind === "driver" ? setDriverDocs : setVehicleDocs;
    setter(prev => prev.map(d => d.id === docId ? { ...d, status: "Approved" as DocStatus, rejectionReason: "" } : d));
    driverOnboardingApi.patchDocument(id!, docId, { action: "approve" })
      .catch(() => {
        setter(prev => prev.map(d => d.id === docId ? { ...d, status: "Pending" as DocStatus } : d));
        setToast("Failed to approve document.");
      });
  }

  function applyReject(docId: string, reason: string, kind: "driver" | "vehicle") {
    const setter = kind === "driver" ? setDriverDocs : setVehicleDocs;
    setter(prev => prev.map(d => d.id === docId ? { ...d, status: "Rejected" as DocStatus, rejectionReason: reason } : d));
    driverOnboardingApi.patchDocument(id!, docId, { action: "reject", rejection_note: reason })
      .catch(() => {
        setter(prev => prev.map(d => d.id === docId ? { ...d, status: "Pending" as DocStatus } : d));
        setToast("Failed to reject document.");
      });
  }

  async function handleApproveOnboarding() {
    setActionLoading(true);
    try {
      await driverOnboardingApi.approve(id!);
      setRecord(prev => prev ? { ...prev, status: "Approved" } : null);
      setApproveModal(false);
      setToast("Onboarding approved! Driver account created.");
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed to approve onboarding.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectOnboarding() {
    if (!rejectNote.trim()) return;
    setActionLoading(true);
    try {
      await driverOnboardingApi.reject(id!, { rejection_note: rejectNote });
      setRecord(prev => prev ? { ...prev, status: "Rejected", rejection_note: rejectNote } : null);
      setRejectModal(false);
      setRejectNote("");
      setToast("Onboarding rejected.");
    } catch {
      setToast("Failed to reject onboarding.");
    } finally {
      setActionLoading(false);
    }
  }

  if (!loading && !record) {
    return (
      <div style={{ fontFamily: FONT, padding: 40, color: "#64748b", fontSize: 14 }}>
        Driver not found.{" "}
        <button onClick={() => router.back()} style={{ color: BLUE, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>
          Go back
        </button>
      </div>
    );
  }

  const allDocs     = [...driverDocs, ...vehicleDocs];
  const submittedCt = allDocs.filter(d => d.submitted).length;
  const approvedCt  = allDocs.filter(d => d.status === "Approved").length;

  const dApproved = driverDocs.filter(d => d.status === "Approved").length;
  const dRejected = driverDocs.filter(d => d.status === "Rejected").length;
  const dPending  = driverDocs.filter(d => d.submitted && d.status === "Pending").length;
  const vApproved = vehicleDocs.filter(d => d.status === "Approved").length;
  const vRejected = vehicleDocs.filter(d => d.status === "Rejected").length;
  const vPending  = vehicleDocs.filter(d => d.submitted && d.status === "Pending").length;

  const docKind: "driver" | "vehicle" = activeTab === "driver" ? "driver" : "vehicle";
  const activeDocs = activeTab === "driver" ? driverDocs : vehicleDocs;

  const statusStyle = record ? (STATUS_STYLES[record.status] ?? STATUS_STYLES["Pending"]) : STATUS_STYLES["Pending"];
  const basicSections = record ? buildSections(record) : [];
  const canAct = record ? (record.status !== "Approved" && record.status !== "Rejected") : false;

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');`}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 300,
          background: "#DCFCE7", border: "1.5px solid #BBF7D0", borderRadius: 12,
          padding: "14px 18px", display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)", maxWidth: 380,
        }}>
          <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "#15803D" }} />
          <p style={{ fontSize: 13.5, fontWeight: 600, color: "#14532D" }}>{toast}</p>
        </div>
      )}

      {/* Back button */}
      <div>
        <button
          onClick={() => router.push("/superadmin/driver-onboarding")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, background: "#fff", color: "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT }}
        >
          <ArrowLeft style={{ width: 15, height: 15 }} /> Back
        </button>
      </div>

      {/* Breadcrumb + onboarding actions */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13.5, color: "#64748b" }}>Driver Onboarding</span>
          <span style={{ color: "#cbd5e1", fontSize: 14, fontWeight: 300 }}>/</span>
          {loading || !record ? (
            <Skeleton className="h-3.5 w-28" />
          ) : (
            <span style={{ fontSize: 13.5, fontWeight: 700, color: BLUE }}>{record.full_name}</span>
          )}
        </div>
        {loading || !record ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
        ) : canAct ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setRejectModal(true)}
              style={{ padding: "7px 16px", borderRadius: 8, border: "1.5px solid #FECACA", background: "#FEF2F2", color: "#B91C1C", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}
            >Reject Onboarding</button>
            <button
              onClick={() => setApproveModal(true)}
              style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: BLUE, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}
            >Approve Onboarding</button>
          </div>
        ) : (
          <span style={{
            fontSize: 12.5, fontWeight: 700, padding: "5px 14px", borderRadius: 20,
            background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}`,
          }}>
            {record.status}
          </span>
        )}
      </div>

      {/* Driver profile card */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 28px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" as const }}>
        {loading || !record ? (
          <Skeleton className="h-14 w-14 rounded-full shrink-0" />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#dbeafe", color: BLUE, fontWeight: 800, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {initials(record.full_name)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7, flexWrap: "wrap" as const }}>
            {loading || !record ? (
              <>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </>
            ) : (
              <>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{record.full_name}</span>
                <span style={{
                  fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                  background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}`,
                  display: "inline-flex", alignItems: "center", gap: 5,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusStyle.dot }} />
                  {record.status}
                </span>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" as const }}>
            {loading || !record ? (
              <>
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3.5 w-32" />
              </>
            ) : (
              <>
                <span style={{ fontSize: 12.5, color: "#64748b" }}>{record.phone}</span>
                {record.email && <span style={{ fontSize: 12.5, color: "#64748b" }}>{record.email}</span>}
                <span style={{ fontSize: 12.5, color: "#64748b" }}>Registered {fmtDate(record.created_at)}</span>
              </>
            )}
          </div>
          {record?.rejection_note && (
            <p style={{ fontSize: 12, color: "#B91C1C", marginTop: 6 }}>Rejection note: {record.rejection_note}</p>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          {[
            { label: "Total Docs", value: record?.doc_counts.total ?? 0, blue: false },
            { label: "Submitted",  value: submittedCt,                   blue: false },
            { label: "Approved",   value: approvedCt,                    blue: true  },
          ].map(s => (
            <div key={s.label} style={{ padding: "12px 22px", borderRadius: 12, border: "1px solid #e2e8f0", background: s.blue ? "#eff6ff" : "#fff", textAlign: "center" as const, minWidth: 76 }}>
              {loading || !record ? (
                <Skeleton className="h-7 w-8 mx-auto mb-1" />
              ) : (
                <p style={{ fontSize: 24, fontWeight: 800, color: s.blue ? BLUE : "#0f172a", lineHeight: 1 }}>{s.value}</p>
              )}
              <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 5 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
        {(["basic", "driver", "vehicle"] as const).map(tab => {
          const active = activeTab === tab;
          const label  = tab === "basic" ? "Basic Details" : tab === "driver" ? "Driver Documents" : "Vehicle Documents";
          const badge  = tab === "driver" ? `${dApproved}/${driverDocs.length}` : tab === "vehicle" ? `${vApproved}/${vehicleDocs.length}` : null;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 9, cursor: "pointer",
                fontFamily: FONT, fontSize: 13.5, fontWeight: active ? 700 : 500,
                color:  active ? BLUE : "#475569",
                background: active ? "#eff6ff" : "#fff",
                border: active ? `2px solid ${BLUE}` : "1.5px solid #e2e8f0",
                transition: "all 0.12s",
              }}
            >
              {label}
              {badge && (
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: active ? BLUE : "#e2e8f0", color: active ? "#fff" : "#64748b" }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}

        {activeTab !== "basic" && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" as const }}>
            {[
              { label: `${activeTab === "driver" ? dApproved : vApproved} Approved`, color: BLUE,     bg: "#eff6ff", border: "#bfdbfe" },
              { label: `${activeTab === "driver" ? dRejected : vRejected} Rejected`, color: "#B91C1C", bg: "#FEE2E2", border: "#FECACA" },
              { label: `${activeTab === "driver" ? dPending  : vPending} Pending`,   color: "#B45309", bg: "#FEF3C7", border: "#FDE68A" },
            ].map(p => (
              <span key={p.label} style={{ fontSize: 12.5, fontWeight: 600, color: p.color, background: p.bg, border: `1px solid ${p.border}`, borderRadius: 20, padding: "4px 12px", whiteSpace: "nowrap" as const }}>{p.label}</span>
            ))}
          </div>
        )}
      </div>

      {/* Tab: Basic Details */}
      {activeTab === "basic" && (loading || !record ? (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          {[
            { title: "PERSONAL INFORMATION", rows: 2 },
            { title: "ADDRESS DETAILS",      rows: 2 },
            { title: "LICENSE & EMPLOYMENT", rows: 2 },
          ].map((section, si, arr) => (
            <div key={section.title} style={{ borderBottom: si < arr.length - 1 ? "1px solid #f1f5f9" : "none" }}>
              <div style={{ padding: "10px 20px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                <Skeleton className="h-3 w-40" />
              </div>
              {Array.from({ length: section.rows }).map((_, ri) => (
                <div key={ri} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: ri < section.rows - 1 ? "1px solid #f1f5f9" : "none" }}>
                  {[0, 1, 2].map((ci) => (
                    <div key={ci} style={{ padding: "16px 20px", borderRight: ci < 2 ? "1px solid #f1f5f9" : "none", display: "flex", flexDirection: "column", gap: 8 }}>
                      <Skeleton className="h-2.5 w-20" />
                      <Skeleton className="h-3.5 w-32" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          {basicSections.map((section, si) => {
            const isEditing = editingSection === section.title;
            const cols = 3;
            return (
              <div key={section.title} style={{ borderBottom: si < basicSections.length - 1 ? "1px solid #f1f5f9" : "none" }}>

                {/* Section header */}
                <div style={{ padding: "10px 20px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{section.title}</span>
                  {isEditing ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={saveEdit}
                        style={{ padding: "4px 14px", borderRadius: 6, border: "none", background: BLUE, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}
                      >Save</button>
                      <button
                        onClick={() => { setEditingSection(null); setSectionDraft({}); }}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}
                      >Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(section)}
                      style={{ padding: "4px 12px", borderRadius: 6, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}
                    >Edit</button>
                  )}
                </div>

                {/* Fields grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                  {section.fields.map((field, fi) => {
                    const total   = section.fields.length;
                    const lastRow = Math.floor((total - 1) / cols);
                    const row     = Math.floor(fi / cols);
                    return (
                      <div
                        key={field.label}
                        style={{
                          padding: "14px 20px",
                          borderRight:  fi % cols !== cols - 1 ? "1px solid #f1f5f9" : "none",
                          borderBottom: row < lastRow ? "1px solid #f1f5f9" : "none",
                          background: isEditing ? "#fafbfc" : "transparent",
                        }}
                      >
                        <p style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 6 }}>{field.label}</p>
                        {isEditing ? (
                          <input
                            value={sectionDraft[field.key] ?? ""}
                            onChange={e => setSectionDraft(prev => ({ ...prev, [field.key]: e.target.value }))}
                            style={{
                              width: "100%", padding: "7px 10px", border: "1.5px solid #e2e8f0",
                              borderRadius: 7, fontSize: 13, fontFamily: FONT, color: "#0f172a",
                              background: "#fff", outline: "none", boxSizing: "border-box" as const,
                            }}
                            onFocus={e  => { (e.target as HTMLInputElement).style.borderColor = BLUE; }}
                            onBlur={e   => { (e.target as HTMLInputElement).style.borderColor = "#e2e8f0"; }}
                          />
                        ) : (
                          <p style={{ fontSize: 13.5, fontWeight: 700, color: "#0f172a" }}>{field.value}</p>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>
      ))}

      {/* Tab: Driver / Vehicle Documents */}
      {(activeTab === "driver" || activeTab === "vehicle") && (loading ? (
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 130px 130px 140px 140px", gap: 16, padding: "16px 24px", borderBottom: i < 3 ? "1px solid #f1f5f9" : "none", alignItems: "center" }}>
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-24 rounded" />
              <Skeleton className="h-7 w-24 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <DocTable
          docs={activeDocs}
          onApprove={docId => applyApprove(docId, docKind)}
          onReject={(docId, reason) => applyReject(docId, reason, docKind)}
          onView={doc => setViewDoc({ doc, kind: docKind })}
          onUpload={(docId) => applyUpload(docId, docKind)}
        />
      ))}

      {/* View document modal */}
      {viewDoc && (
        <ViewModal
          doc={viewDoc.doc}
          onClose={() => setViewDoc(null)}
          onApprove={() => {
            applyApprove(viewDoc.doc.id, viewDoc.kind);
            setViewDoc(prev => prev ? { ...prev, doc: { ...prev.doc, status: "Approved" } } : null);
          }}
          onReject={reason => {
            applyReject(viewDoc.doc.id, reason, viewDoc.kind);
            setViewDoc(prev => prev ? { ...prev, doc: { ...prev.doc, status: "Rejected", rejectionReason: reason } } : null);
          }}
        />
      )}

      {/* Approve onboarding modal */}
      {approveModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => !actionLoading && setApproveModal(false)}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 440, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Approve Onboarding?</p>
            <p style={{ fontSize: 13.5, color: "#64748b", marginBottom: 22, lineHeight: 1.6 }}>
              This will create a driver account for <strong>{record?.full_name}</strong> with their phone number as the default password. All approved documents will be transferred.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleApproveOnboarding}
                disabled={actionLoading}
                style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "none", background: actionLoading ? "#93c5fd" : BLUE, color: "#fff", fontWeight: 700, fontSize: 14, cursor: actionLoading ? "not-allowed" : "pointer", fontFamily: FONT }}
              >{actionLoading ? "Processing…" : "Confirm Approve"}</button>
              <button
                onClick={() => setApproveModal(false)}
                disabled={actionLoading}
                style={{ padding: "11px 20px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: FONT }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject onboarding modal */}
      {rejectModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => !actionLoading && setRejectModal(false)}
        >
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 440, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", marginBottom: 10 }}>Reject Onboarding</p>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>Provide a reason for rejecting this driver's onboarding application.</p>
            <textarea
              autoFocus
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Rejection reason…"
              rows={3}
              style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, fontFamily: FONT, color: "#0f172a", background: "#f8fafc", outline: "none", resize: "none" as const, boxSizing: "border-box" as const, marginBottom: 16 }}
              onFocus={e  => { (e.target as HTMLTextAreaElement).style.borderColor = "#ef4444"; }}
              onBlur={e   => { (e.target as HTMLTextAreaElement).style.borderColor = "#e2e8f0"; }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={handleRejectOnboarding}
                disabled={!rejectNote.trim() || actionLoading}
                style={{ flex: 1, padding: "11px 0", borderRadius: 8, border: "none", background: rejectNote.trim() && !actionLoading ? "#EF4444" : "#e2e8f0", color: rejectNote.trim() && !actionLoading ? "#fff" : "#94a3b8", fontWeight: 700, fontSize: 14, cursor: rejectNote.trim() && !actionLoading ? "pointer" : "not-allowed", fontFamily: FONT }}
              >{actionLoading ? "Processing…" : "Confirm Reject"}</button>
              <button
                onClick={() => { setRejectModal(false); setRejectNote(""); }}
                disabled={actionLoading}
                style={{ padding: "11px 20px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: FONT }}
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

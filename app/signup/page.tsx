"use client";

import { useState } from "react";
import { vendorSignupApi, vendorsApi, type VendorBillingCycle, type VendorBillingType } from "@/lib/api";
import {
  Eye, EyeOff, AlertCircle, CheckCircle2,
  ArrowLeft, ArrowRight, Loader2, Check,
  Upload, FileText, X, Mail, Phone,
} from "lucide-react";

// Placeholder contact info shown on the signup confirmation screen.
// TODO: move to env / settings once finalised.
const SUPPORT_EMAIL = "contact@skvoyages.in";
const SUPPORT_PHONE = "+91 99999 99999";

type Step = 1 | 2 | 3;

function Field({
  label, error, children,
}: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12.5, fontWeight: 600, color: "#475569", display: "block" }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: 11.5, color: "#ef4444", fontWeight: 500 }}>{error}</p>}
    </div>
  );
}

export default function VendorSignupPage() {

  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [name,          setName]          = useState("");
  const [city,          setCity]          = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email,         setEmail]         = useState("");
  const [phone,         setPhone]         = useState("");
  const [step1Errors,   setStep1Errors]   = useState<Partial<Record<"name"|"city"|"contactPerson"|"email"|"phone", string>>>({});

  // Step 2 – Documents (optional)
  const [panNum,  setPanNum]  = useState("");
  const [panFile, setPanFile] = useState<File | null>(null);
  const [gstNum,  setGstNum]  = useState("");
  const [gstFile, setGstFile] = useState<File | null>(null);

  // Step 3
  const [password,     setPassword]     = useState("");
  const [confirmPw,    setConfirmPw]    = useState("");
  const [showPw,       setShowPw]       = useState(false);
  const [billingType,    setBillingType]    = useState<VendorBillingType>("PREPAID");
  const [creditLimit,    setCreditLimit]    = useState("");
  const [billingCycle,   setBillingCycle]   = useState<VendorBillingCycle>("MONTHLY");
  const [paymentDueDays, setPaymentDueDays] = useState("7");
  const [step3Errors,    setStep3Errors]    = useState<Partial<Record<"password"|"confirm"|"billing_type"|"credit_limit"|"billing_cycle"|"payment_due_days", string>>>({});

  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState("");
  const [success,  setSuccess]  = useState(false);

  const FONT = "'DM Sans', system-ui, sans-serif";
  const BLUE = "#2563eb";

  function inputStyle(hasError?: string): React.CSSProperties {
    return {
      width: "100%", padding: "10px 14px", border: `1.5px solid ${hasError ? "#fca5a5" : "#e2e8f0"}`,
      borderRadius: 10, fontSize: 14, fontFamily: FONT, color: "#0f172a", background: "#f8fafc",
      outline: "none", boxSizing: "border-box",
    };
  }

  function validateStep1() {
    const e: typeof step1Errors = {};
    if (!name.trim())          e.name          = "Company name is required";
    if (!city.trim())          e.city          = "City is required";
    if (!contactPerson.trim()) e.contactPerson = "Contact person is required";
    if (!email.trim())         e.email         = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Invalid email format";
    if (!phone.trim())         e.phone         = "Phone is required";
    else if (!/^\d{10}$/.test(phone.replace(/\s/g, ""))) e.phone = "Must be exactly 10 digits";
    setStep1Errors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep3() {
    const e: typeof step3Errors = {};
    if (billingType !== "PREPAID" && billingType !== "POSTPAID") {
      e.billing_type = "Billing type is required";
    }
    if (billingType === "POSTPAID") {
      const limit = Number(creditLimit);
      const days = Number(paymentDueDays);
      if (!creditLimit || !Number.isFinite(limit) || limit <= 0) e.credit_limit = "Credit limit must be greater than 0";
      if (billingCycle !== "WEEKLY" && billingCycle !== "MONTHLY") e.billing_cycle = "Select a billing cycle";
      if (!paymentDueDays || !Number.isInteger(days) || days <= 0) e.payment_due_days = "Payment due days must be greater than 0";
    }
    if (!password)             e.password = "Password is required";
    else if (password.length < 8) e.password = "Password must be at least 8 characters";
    if (!confirmPw)            e.confirm  = "Please confirm your password";
    else if (password !== confirmPw) e.confirm = "Passwords do not match";
    setStep3Errors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() {
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) { handleNext(); return; }
    if (step === 2) { handleNext(); return; }
    if (!validateStep3()) return;

    setLoading(true); setApiError("");
    try {
      const isPostpaid = billingType === "POSTPAID";
      const res = await vendorSignupApi.signup({
        name,
        city,
        contactPerson,
        email,
        phone,
        password,
        billing_type: billingType,
        credit_limit: isPostpaid ? Number(creditLimit) : 0,
        outstanding_balance: 0,
        billing_cycle: isPostpaid ? billingCycle : "MONTHLY",
        payment_due_days: isPostpaid ? Number(paymentDueDays) : 7,
      });

      // Attempt document uploads silently — uses the freshly issued token from
      // the signup response. We don't write that token to sessionStorage on
      // purpose: the post-signup UX is a "request received" screen, not an
      // automatic login. The vendor signs in normally after their request is
      // approved by the SK Travels team.
      const vendorId = res.user.vendor_id;
      if (vendorId && (panNum || panFile || gstNum || gstFile)) {
        try {
          // Briefly stash the token so apiUpload picks it up via getToken().
          sessionStorage.setItem("auth_token", res.token);
          if (panNum || panFile) {
            await vendorsApi.uploadDocument(vendorId, "PAN_CARD", panNum || undefined, panFile || undefined);
          }
          if (gstNum || gstFile) {
            await vendorsApi.uploadDocument(vendorId, "GST_CERTIFICATE", gstNum || undefined, gstFile || undefined);
          }
        } catch { /* silently ignore — documents can be uploaded later from vendor profile */ }
        finally { sessionStorage.removeItem("auth_token"); }
      }

      setSuccess(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally { setLoading(false); }
  }

  const STEPS: { label: string }[] = [
    { label: "Company Info" },
    { label: "Documents" },
    { label: "Set Password" },
  ];

  return (
    <div style={{ height: "100vh", overflow: "hidden", display: "flex", fontFamily: FONT }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        html, body { height: 100%; overflow: hidden; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: #94a3b8; }
        input:focus { outline: none; border-color: #2563eb !important; background: #fff !important; }
        .signup-btn { width: 100%; padding: 11px; border-radius: 10px; border: none; background: #2563eb; color: #fff; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; transition: background 0.15s, opacity 0.15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .signup-btn:hover:not(:disabled) { background: #1d4ed8; }
        .signup-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .doc-upload-label { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border: 2px dashed #e2e8f0; border-radius: 10px; padding: 16px 12px; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
        .doc-upload-label:hover { border-color: #93c5fd; background: #eff6ff; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Left panel ── */}
      <div style={{
        flex: "0 0 48%", height: "100%",
        background: "linear-gradient(145deg, #1e40af 0%, #2563eb 45%, #3b82f6 100%)",
        display: "flex", flexDirection: "column", padding: "32px 48px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -80, right: -80, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", top: "38%", right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, zIndex: 1 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 17h18M5 17V9a2 2 0 012-2h10a2 2 0 012 2v8M9 17v-4h6v4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="7.5" cy="17.5" r="1.5" fill="#fff"/>
              <circle cx="16.5" cy="17.5" r="1.5" fill="#fff"/>
            </svg>
          </div>
          <span style={{ color: "#fff", fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em" }}>SK Travels</span>
        </div>

        {/* Tagline */}
        <div style={{ marginTop: 40, zIndex: 1 }}>
          <h1 style={{ color: "#fff", fontSize: 30, fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.02em" }}>
            Join SK Travels<br />as a Vendor.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.72)", fontSize: 14.5, marginTop: 14, lineHeight: 1.6, maxWidth: 300 }}>
            Register your fleet business and manage drivers, trips, and invoicing from one powerful dashboard.
          </p>
        </div>

        {/* Feature list */}
        <div style={{ marginTop: 36, zIndex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            "Manage your entire driver fleet",
            "Real-time trip tracking & dispatch",
            "Automated invoicing & wallet",
            "Multi-company client management",
          ].map(feat => (
            <div key={feat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13.5 }}>{feat}</span>
            </div>
          ))}
        </div>

      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", padding: "24px 48px", overflow: "auto" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>

          {success ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 18px",
              }}>
                <CheckCircle2 style={{ width: 32, height: 32, color: "#16a34a" }} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>
                We&apos;ve got your request!
              </h2>
              <p style={{ fontSize: 13.5, color: "#64748b", marginTop: 10, lineHeight: 1.6 }}>
                Thanks for signing up, <strong style={{ color: "#0f172a" }}>{contactPerson || name}</strong>. Our team will
                review your details and get back to you shortly. In the meantime, feel free to reach out to us:
              </p>

              <div style={{
                marginTop: 20, padding: "16px 18px", border: "1px solid #e2e8f0", borderRadius: 12,
                background: "#f8fafc", display: "flex", flexDirection: "column", gap: 12,
              }}>
                <a href={`mailto:${SUPPORT_EMAIL}`} style={{
                  display: "flex", alignItems: "center", gap: 10, textDecoration: "none",
                }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 8, background: "#eff6ff",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Mail style={{ width: 15, height: 15, color: BLUE }} />
                  </span>
                  <div style={{ textAlign: "left", minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</p>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>{SUPPORT_EMAIL}</p>
                  </div>
                </a>
                <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, "")}`} style={{
                  display: "flex", alignItems: "center", gap: 10, textDecoration: "none",
                }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 8, background: "#eff6ff",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Phone style={{ width: 15, height: 15, color: BLUE }} />
                  </span>
                  <div style={{ textAlign: "left", minWidth: 0 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Phone</p>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>{SUPPORT_PHONE}</p>
                  </div>
                </a>
              </div>

              <a href="/login" className="signup-btn" style={{ marginTop: 22, textDecoration: "none" }}>
                Back to sign in <ArrowRight style={{ width: 16, height: 16 }} />
              </a>
            </div>
          ) : (
          <>
          {/* Back to login */}
          <a href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "#64748b", fontWeight: 600, textDecoration: "none", marginBottom: 24 }}
            onMouseEnter={e => (e.currentTarget.style.color = BLUE)}
            onMouseLeave={e => (e.currentTarget.style.color = "#64748b")}>
            <ArrowLeft style={{ width: 14, height: 14 }} /> Back to sign in
          </a>

          <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Create your account</h2>
          <p style={{ fontSize: 13.5, color: "#94a3b8", marginTop: 5 }}>
            {step === 1 ? "Tell us about your company." : step === 2 ? "Upload your KYC documents (optional)." : "Set a secure password for your account."}
          </p>

          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 20, marginBottom: 24 }}>
            {STEPS.map((s, idx) => {
              const num = (idx + 1) as Step;
              const done = num < step;
              const active = num === step;
              return (
                <div key={num} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%", fontSize: 11, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: done || active ? BLUE : "#f1f5f9",
                    color: done || active ? "#fff" : "#94a3b8",
                  }}>
                    {done ? <Check style={{ width: 12, height: 12 }} /> : num}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: active ? "#334155" : "#94a3b8" }}>
                    {s.label}
                  </span>
                  {idx < STEPS.length - 1 && (
                    <div style={{ height: 1, width: 20, background: step > num ? BLUE : "#e2e8f0", marginLeft: 2 }} />
                  )}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── Step 1: Company Info ── */}
            {step === 1 && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Field label="Company Name" error={step1Errors.name}>
                    <input
                      style={inputStyle(step1Errors.name)}
                      placeholder="e.g. Rapid Rides Pvt Ltd"
                      value={name}
                      onChange={e => { setName(e.target.value); setStep1Errors(p => ({ ...p, name: undefined })); }}
                    />
                  </Field>
                  <Field label="City" error={step1Errors.city}>
                    <input
                      style={inputStyle(step1Errors.city)}
                      placeholder="e.g. Bangalore"
                      value={city}
                      onChange={e => { setCity(e.target.value); setStep1Errors(p => ({ ...p, city: undefined })); }}
                    />
                  </Field>
                </div>

                <Field label="Contact Person" error={step1Errors.contactPerson}>
                  <input
                    style={inputStyle(step1Errors.contactPerson)}
                    placeholder="Your full name"
                    value={contactPerson}
                    onChange={e => { setContactPerson(e.target.value); setStep1Errors(p => ({ ...p, contactPerson: undefined })); }}
                  />
                </Field>

                <Field label="Business Email" error={step1Errors.email}>
                  <input
                    type="email"
                    style={inputStyle(step1Errors.email)}
                    placeholder="contact@yourcompany.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setStep1Errors(p => ({ ...p, email: undefined })); }}
                  />
                </Field>

                <Field label="Phone Number" error={step1Errors.phone}>
                  <input
                    style={inputStyle(step1Errors.phone)}
                    placeholder="10-digit mobile number"
                    value={phone}
                    maxLength={10}
                    onChange={e => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setStep1Errors(p => ({ ...p, phone: undefined })); }}
                  />
                </Field>

                <button type="button" onClick={handleNext} className="signup-btn" style={{ marginTop: 6 }}>
                  Continue <ArrowRight style={{ width: 16, height: 16 }} />
                </button>
              </>
            )}

            {/* ── Step 2: Documents ── */}
            {step === 2 && (
              <>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>KYC Documents</p>

                {/* PAN Card */}
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FileText style={{ width: 15, height: 15, color: "#94a3b8" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>PAN Card</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>(optional)</span>
                  </div>
                  <Field label="PAN Number">
                    <input
                      style={{ ...inputStyle(), fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}
                      placeholder="e.g. ABCDE1234F"
                      value={panNum}
                      maxLength={10}
                      onChange={e => setPanNum(e.target.value.toUpperCase().slice(0, 10))}
                    />
                  </Field>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Upload PAN Card</label>
                    {panFile ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
                        <FileText style={{ width: 15, height: 15, color: "#3b82f6", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{panFile.name}</span>
                        <button type="button" onClick={() => setPanFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#93c5fd", display: "flex", alignItems: "center" }}>
                          <X style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    ) : (
                      <label className="doc-upload-label">
                        <Upload style={{ width: 18, height: 18, color: "#cbd5e1" }} />
                        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Click to upload PDF or image</span>
                        <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setPanFile(f); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                </div>

                {/* GST Certificate */}
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <FileText style={{ width: 15, height: 15, color: "#94a3b8" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>GST Registration Certificate</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>(optional)</span>
                  </div>
                  <Field label="GST Number">
                    <input
                      style={{ ...inputStyle(), fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}
                      placeholder="e.g. 29ABCDE1234F1Z5"
                      value={gstNum}
                      maxLength={15}
                      onChange={e => setGstNum(e.target.value.toUpperCase().slice(0, 15))}
                    />
                  </Field>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>Upload GST Certificate</label>
                    {gstFile ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10 }}>
                        <FileText style={{ width: 15, height: 15, color: "#3b82f6", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#1d4ed8", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{gstFile.name}</span>
                        <button type="button" onClick={() => setGstFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#93c5fd", display: "flex", alignItems: "center" }}>
                          <X style={{ width: 14, height: 14 }} />
                        </button>
                      </div>
                    ) : (
                      <label className="doc-upload-label">
                        <Upload style={{ width: 18, height: 18, color: "#cbd5e1" }} />
                        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>Click to upload PDF or image</span>
                        <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setGstFile(f); e.target.value = ""; }} />
                      </label>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: 11.5, color: "#94a3b8", textAlign: "center" }}>You can skip and upload documents later from your vendor profile.</p>

                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setStep(1)}
                    style={{ flex: "0 0 auto", padding: "11px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6 }}>
                    <ArrowLeft style={{ width: 15, height: 15 }} /> Back
                  </button>
                  <button type="button" onClick={handleNext} className="signup-btn" style={{ flex: 1 }}>
                    Continue <ArrowRight style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              </>
            )}

            {/* ── Step 3: Set Password ── */}
            {step === 3 && (
              <>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 2 }}>
                  <p style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Signing up as</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginTop: 2 }}>{name} · {email}</p>
                </div>

                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
                  <Field label="Billing Type" error={step3Errors.billing_type}>
                    <select
                      value={billingType}
                      onChange={e => {
                        const next = e.target.value as VendorBillingType;
                        setBillingType(next);
                        setStep3Errors(p => ({ ...p, billing_type: undefined, credit_limit: undefined, billing_cycle: undefined, payment_due_days: undefined }));
                        if (next === "PREPAID") {
                          setCreditLimit("");
                          setBillingCycle("MONTHLY");
                          setPaymentDueDays("7");
                        }
                      }}
                      style={inputStyle(step3Errors.billing_type)}
                    >
                      <option value="PREPAID">PREPAID</option>
                      <option value="POSTPAID">POSTPAID</option>
                    </select>
                  </Field>

                  <p style={{ fontSize: 11.5, color: BLUE, fontWeight: 600, background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 9, padding: "8px 10px", lineHeight: 1.45 }}>
                    {billingType === "PREPAID"
                      ? "PREPAID: Trips are allowed only when wallet balance is available."
                      : "POSTPAID: Trips are billed later and controlled by credit limit."}
                  </p>

                  {billingType === "POSTPAID" && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <Field label="Credit Limit" error={step3Errors.credit_limit}>
                        <input
                          type="number"
                          min={1}
                          style={inputStyle(step3Errors.credit_limit)}
                          placeholder="50000"
                          value={creditLimit}
                          onChange={e => { setCreditLimit(e.target.value); setStep3Errors(p => ({ ...p, credit_limit: undefined })); }}
                        />
                      </Field>
                      <Field label="Billing Cycle" error={step3Errors.billing_cycle}>
                        <select
                          value={billingCycle}
                          onChange={e => { setBillingCycle(e.target.value as VendorBillingCycle); setStep3Errors(p => ({ ...p, billing_cycle: undefined })); }}
                          style={inputStyle(step3Errors.billing_cycle)}
                        >
                          <option value="WEEKLY">WEEKLY</option>
                          <option value="MONTHLY">MONTHLY</option>
                        </select>
                      </Field>
                      <Field label="Payment Due Days" error={step3Errors.payment_due_days}>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          style={inputStyle(step3Errors.payment_due_days)}
                          placeholder="7"
                          value={paymentDueDays}
                          onChange={e => { setPaymentDueDays(e.target.value); setStep3Errors(p => ({ ...p, payment_due_days: undefined })); }}
                        />
                      </Field>
                    </div>
                  )}
                </div>

                <Field label="Password" error={step3Errors.password}>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPw ? "text" : "password"}
                      style={{ ...inputStyle(step3Errors.password), paddingRight: 42 }}
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setStep3Errors(p => ({ ...p, password: undefined })); }}
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94a3b8", display: "flex", alignItems: "center" }}
                      tabIndex={-1}>
                      {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                    </button>
                  </div>
                </Field>

                <Field label="Confirm Password" error={step3Errors.confirm}>
                  <input
                    type={showPw ? "text" : "password"}
                    style={inputStyle(step3Errors.confirm)}
                    placeholder="Re-enter your password"
                    value={confirmPw}
                    onChange={e => { setConfirmPw(e.target.value); setStep3Errors(p => ({ ...p, confirm: undefined })); }}
                  />
                </Field>

                {apiError && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#fef2f2", border: "1.5px solid #fecaca", borderRadius: 9, padding: "10px 12px" }}>
                    <AlertCircle style={{ width: 15, height: 15, color: "#ef4444", marginTop: 1, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#dc2626" }}>{apiError}</span>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setStep(2)} disabled={loading}
                    style={{ flex: "0 0 auto", padding: "11px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6, opacity: loading ? 0.5 : 1 }}>
                    <ArrowLeft style={{ width: 15, height: 15 }} /> Back
                  </button>
                  <button type="submit" className="signup-btn" disabled={loading} style={{ flex: 1 }}>
                    {loading && <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} />}
                    {loading ? "Submitting request…" : "Submit Request"}
                  </button>
                </div>
              </>
            )}
          </form>

          <p style={{ textAlign: "center" as const, marginTop: 22, fontSize: 13, color: "#94a3b8" }}>
            Already have an account?{" "}
            <a href="/login" style={{ color: BLUE, fontWeight: 700, textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = "none")}>
              Sign in
            </a>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

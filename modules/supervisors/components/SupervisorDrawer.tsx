"use client";

import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import {
  Plus, X, Eye, EyeOff, RefreshCw, Check,
  ChevronRight, ChevronLeft, Loader2, AlertCircle, CheckCircle2,
} from "lucide-react";
import type { Supervisor, SupervisorFormData } from "../types";

// ── types ────────────────────────────────────────────────────────────────────
interface SupervisorDrawerProps {
  open:      boolean;
  onClose:   () => void;
  onSubmit:  (data: SupervisorFormData) => Promise<void>;
  editData?: Supervisor | null;
}

interface FormErrors { name?: string; email?: string; phone?: string; password?: string; }

type SubmitState = "idle" | "loading" | "success" | "error";

// ── helpers ──────────────────────────────────────────────────────────────────
const empty: SupervisorFormData = {
  name: "", email: "", phone: "", zone: "",
  password: "", status: "Active", companies: [],
};

function generatePassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── component ────────────────────────────────────────────────────────────────
export function SupervisorDrawer({ open, onClose, onSubmit, editData }: SupervisorDrawerProps) {
  const [step,             setStep]             = useState(1);
  const [form,             setForm]             = useState<SupervisorFormData>(empty);
  const [errors,           setErrors]           = useState<FormErrors>({});
  const [companyInput,     setCompanyInput]     = useState("");
  const [showPassword,     setShowPassword]     = useState(false);
  const [copied,           setCopied]           = useState(false);
  const [sent,             setSent]             = useState(false);
  const [credEmail,        setCredEmail]        = useState("");
  const [credEmailTouched, setCredEmailTouched] = useState(false);

  // ── submission state ──
  const [submitState,  setSubmitState]  = useState<SubmitState>("idle");
  const [apiError,     setApiError]     = useState("");
  const [apiErrorFields, setApiErrorFields] = useState<FormErrors>({});

  // reset on open/editData change
  useEffect(() => {
    if (editData) {
      setForm({ name: editData.name, email: editData.email, phone: editData.phone, zone: editData.zone, password: "", status: editData.status, companies: editData.companies || [] });
      setCredEmail(editData.email);
    } else {
      setForm(empty);
      setCredEmail("");
    }
    setStep(1);
    setErrors({});
    setCompanyInput("");
    setShowPassword(false);
    setCopied(false);
    setSent(false);
    setCredEmailTouched(false);
    setSubmitState("idle");
    setApiError("");
    setApiErrorFields({});
  }, [editData, open]);

  useEffect(() => {
    if (!credEmailTouched) setCredEmail(form.email);
  }, [form.email, credEmailTouched]);

  // ── field helpers ──
  function field<K extends keyof SupervisorFormData>(key: K, value: SupervisorFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors])         setErrors(prev => ({ ...prev, [key]: undefined }));
    if (apiErrorFields[key as keyof FormErrors]) setApiErrorFields(prev => ({ ...prev, [key]: undefined }));
    if (apiError) setApiError("");
  }

  function validateStep1(): boolean {
    const e: FormErrors = {};
    if (!form.name.trim())  e.name  = "Name is required";
    if (!form.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address";
    if (!form.phone.trim()) e.phone = "Phone is required";
    else if (!/^\d{10}$/.test(form.phone.replace(/\s/g, ""))) e.phone = "Phone must be exactly 10 digits";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: FormErrors = {};
    if (!editData && form.password.length < 8) e.password = "Min 8 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleNext() { if (validateStep1()) setStep(2); }

  // ── API submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) { handleNext(); return; }
    if (!validateStep2()) return;
    if (submitState === "loading" || submitState === "success") return;

    // edit mode — optimistic update, no loading state needed
    if (editData) {
      void onSubmit(form);
      onClose();
      return;
    }

    setSubmitState("loading");
    setApiError("");
    setApiErrorFields({});

    try {
      await onSubmit({ ...form, email: credEmail || form.email, sendCredentials: sent });

      // ── success ──
      setSubmitState("success");
      setTimeout(() => {
        onClose();
        setSubmitState("idle");
      }, 1200);

    } catch (err: unknown) {
      setSubmitState("error");
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setApiError(msg);
    }
  }

  function handleGenerate() { field("password", generatePassword()); setShowPassword(true); setSent(false); }
  function handleCopy()     { if (!form.password) return; navigator.clipboard.writeText(form.password); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  function addCompany()     {
    const t = companyInput.trim();
    if (!t) { setCompanyInput(""); return; }
    if (form.companies.some(c => c.name.toLowerCase() === t.toLowerCase())) {
      setCompanyInput("");
      return;
    }
    field("companies", [...form.companies, { name: t, address: null, city: null, state: null, pincode: null }]);
    setCompanyInput("");
  }
  function removeCompany(name: string) {
    field("companies", form.companies.filter(c => c.name !== name));
  }
  function updateCompanyField(name: string, key: "address" | "city" | "state" | "pincode", value: string) {
    field("companies", form.companies.map(c => c.name === name ? { ...c, [key]: value || null } : c));
  }

  // ── submit button visual ──
  const btnConfig = {
    idle: {
      label: editData ? "Save Changes" : "Add Supervisor",
      icon:  null,
      cls:   "bg-blue-600 hover:bg-blue-700 text-white",
    },
    loading: {
      label: "Creating Supervisor…",
      icon:  <Loader2 className="h-4 w-4 animate-spin" />,
      cls:   "bg-blue-500 text-white cursor-not-allowed",
    },
    success: {
      label: "Supervisor Added!",
      icon:  <CheckCircle2 className="h-4 w-4" />,
      cls:   "bg-emerald-500 text-white cursor-not-allowed",
    },
    error: {
      label: editData ? "Save Changes" : "Add Supervisor",
      icon:  null,
      cls:   "bg-blue-600 hover:bg-blue-700 text-white",
    },
  }[submitState];

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <DialogTitle className="text-[16px] font-bold text-slate-800">
            {editData ? "Edit Supervisor" : "Add New Supervisor"}
          </DialogTitle>
          <p className="text-[13px] text-slate-400 mt-0.5">
            {editData ? "Update the supervisor's details below." : "Fill in the details to onboard a new supervisor."}
          </p>

          {/* Step indicator */}
          {!editData && (
            <div className="flex items-center gap-2 mt-3">
              {[1, 2].map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold transition-all ${
                    s < step ? "bg-blue-600 text-white" : s === step ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                  }`}>
                    {s < step ? <Check className="h-3 w-3" /> : s}
                  </div>
                  <span className={`text-[12px] font-semibold ${s === step ? "text-slate-700" : "text-slate-400"}`}>
                    {s === 1 ? "Details" : "Credentials"}
                  </span>
                  {s < 2 && <div className={`h-px w-6 ${step > s ? "bg-blue-600" : "bg-slate-200"}`} />}
                </div>
              ))}
            </div>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

            {/* ── Step 1: Details ── */}
            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Full Name" error={errors.name ?? apiErrorFields.name}>
                    <Input placeholder="Kiran Gowda" value={form.name}  onChange={e => field("name", e.target.value)}  className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
                  </Field>
                  <Field label="Phone" error={errors.phone ?? apiErrorFields.phone}>
                    <Input placeholder="+91 98765 43210" value={form.phone} onChange={e => field("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
                  </Field>
                </div>

                <Field label="Email" error={errors.email ?? apiErrorFields.email}>
                  <Input type="email" placeholder="kiran@example.com" value={form.email} onChange={e => field("email", e.target.value)} className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
                </Field>

                <Field label="Zone">
                  <Input placeholder="e.g. Koramangala, Whitefield" value={form.zone} onChange={e => field("zone", e.target.value)} className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
                </Field>

                {/* Companies */}
                <div className="space-y-2.5">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Assigned Companies</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type company name and press Enter"
                      value={companyInput}
                      onChange={e => setCompanyInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCompany(); } }}
                      className="h-[38px] rounded-xl border-slate-200 text-[13px]"
                    />
                    <button type="button" onClick={addCompany} className="h-[38px] w-[38px] rounded-xl shrink-0 border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center transition-colors">
                      <Plus className="h-4 w-4 text-slate-500" />
                    </button>
                  </div>
                  {form.companies.length > 0 ? (
                    <div className="space-y-2">
                      {form.companies.map(c => {
                        const hasAnyAddr = c.address || c.city || c.state || c.pincode;
                        return (
                          <div key={c.name} className="rounded-xl border border-slate-200 bg-slate-50/40 p-2.5 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white text-[12px] font-semibold px-2.5 py-1.5 rounded-lg max-w-full">
                                <span className="truncate">{c.name}</span>
                                <button type="button" onClick={() => removeCompany(c.name)} className="flex items-center justify-center h-3 w-3 rounded bg-blue-500 hover:bg-blue-400 transition-colors shrink-0">
                                  <X className="h-2 w-2 text-white" />
                                </button>
                              </span>
                            </div>
                            <Input
                              placeholder={`Street address for ${c.name} (optional)`}
                              value={c.address ?? ""}
                              onChange={e => updateCompanyField(c.name, "address", e.target.value)}
                              className="h-[34px] rounded-lg border-slate-200 bg-white text-[12.5px]"
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <Input
                                placeholder="City"
                                value={c.city ?? ""}
                                onChange={e => updateCompanyField(c.name, "city", e.target.value)}
                                className="h-[34px] rounded-lg border-slate-200 bg-white text-[12.5px]"
                              />
                              <Input
                                placeholder="State"
                                value={c.state ?? ""}
                                onChange={e => updateCompanyField(c.name, "state", e.target.value)}
                                className="h-[34px] rounded-lg border-slate-200 bg-white text-[12.5px]"
                              />
                              <Input
                                placeholder="Pincode"
                                value={c.pincode ?? ""}
                                onChange={e => updateCompanyField(c.name, "pincode", e.target.value.replace(/\D/g, "").slice(0, 10))}
                                className="h-[34px] rounded-lg border-slate-200 bg-white text-[12.5px]"
                              />
                            </div>
                            {!hasAnyAddr && (
                              <p className="text-[11px] text-slate-400">You can add this later from the supervisor's profile.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[12px] text-slate-400">No companies assigned yet.</p>
                  )}
                </div>
              </>
            )}

            {/* ── Step 2: Credentials ── */}
            {step === 2 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    {editData ? "Reset Password" : "Login Credentials"}
                  </p>
                  <button type="button" onClick={handleGenerate} className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                    <RefreshCw className="h-3 w-3" /> Generate
                  </button>
                </div>

                <Field label="Login Email">
                  <Input
                    type="email"
                    placeholder="kiran@example.com"
                    value={credEmail}
                    onChange={e => { setCredEmail(e.target.value); setCredEmailTouched(true); }}
                    className="h-[38px] rounded-xl border-slate-200 bg-white text-[13px]"
                  />
                  {credEmailTouched && form.email && credEmail !== form.email && (
                    <p className="text-[11px] text-slate-400 mt-1">Different from profile email ({form.email})</p>
                  )}
                </Field>

                <Field label={editData ? "New Password (optional)" : "Password"} error={errors.password ?? apiErrorFields.password}>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 8 characters"
                      value={form.password}
                      onChange={e => field("password", e.target.value)}
                      className="h-[38px] rounded-xl border-slate-200 bg-white text-[13px] pr-20 font-mono tracking-wider"
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                      {form.password && (
                        <button type="button" onClick={handleCopy} className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-700 transition-colors">
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      )}
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </Field>

                {/* Send credentials row */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setSent(v => !v)}
                    className={`h-[18px] w-[18px] shrink-0 rounded-[4px] flex items-center justify-center transition-all border ${
                      sent ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-400"
                    }`}
                  >
                    {sent && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
                  </button>
                  <span className="text-[13px] text-slate-500 font-medium">Send credentials to email</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-6 pb-6 pt-4 border-t border-slate-100 shrink-0">

            {/* API error banner */}
            {submitState === "error" && apiError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-red-700 font-medium">{apiError}</p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                {step === 2 && !editData && (
                  <button
                    type="button"
                    onClick={() => { setStep(1); setErrors({}); setApiError(""); }}
                    disabled={submitState === "loading"}
                    className="flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-800 font-medium transition-colors disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={submitState === "loading"}
                  className="rounded-xl h-9 px-5 text-[13px]"
                >
                  Cancel
                </Button>

                {step === 1 && !editData ? (
                  <Button type="button" onClick={handleNext} className="rounded-xl h-9 px-5 text-[13px] bg-blue-600 hover:bg-blue-700 gap-1.5">
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                ) : (
                  /* ── The "Add Supervisor" button with all visual states ── */
                  <button
                    type="submit"
                    disabled={submitState === "loading" || submitState === "success"}
                    className={`
                      inline-flex items-center gap-2 rounded-xl h-9 px-5 text-[13px] font-semibold
                      transition-all duration-300 border-0 outline-none select-none
                      ${btnConfig.cls}
                      ${submitState === "loading" ? "scale-[0.98] shadow-inner" : ""}
                      ${submitState === "success" ? "scale-[1.02] shadow-md shadow-emerald-200" : ""}
                      ${submitState === "idle" || submitState === "error" ? "shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.98]" : ""}
                    `}
                  >
                    {/* Spinner / success icon / nothing */}
                    {btnConfig.icon}

                    {/* Label */}
                    <span className="relative">
                      {btnConfig.label}

                      {/* Loading shimmer underline */}
                      {submitState === "loading" && (
                        <span className="absolute bottom-0 left-0 h-px w-full bg-white/40 animate-pulse" />
                      )}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Live status sub-text below footer buttons */}
            {submitState === "loading" && (
              <p className="text-[11px] text-blue-500 font-medium text-right mt-2 animate-pulse">
                Creating account &amp; sending credentials…
              </p>
            )}
            {submitState === "success" && (
              <p className="text-[11px] text-emerald-600 font-semibold text-right mt-2">
                ✓ Supervisor onboarded successfully!
              </p>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────
function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-semibold text-slate-600">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-red-500 font-medium">{error}</p>}
    </div>
  );
}

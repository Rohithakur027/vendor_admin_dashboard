"use client";

import { useState } from "react";
import { vendorsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface PasswordForm {
  currentPassword: string;
  newPassword:     string;
  confirmPassword: string;
}

const blank: PasswordForm = { currentPassword: "", newPassword: "", confirmPassword: "" };

export function VendorSecuritySettings() {
  const [form,   setForm]   = useState<PasswordForm>(blank);
  const [show,   setShow]   = useState<Record<keyof PasswordForm, boolean>>({
    currentPassword: false, newPassword: false, confirmPassword: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof PasswordForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  function setField<K extends keyof PasswordForm>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key])  setErrors(e => ({ ...e, [key]: undefined }));
    if (apiError)     setApiError(null);
    if (success)      setSuccess(false);
  }

  function validate(): boolean {
    const e: Partial<Record<keyof PasswordForm, string>> = {};
    if (!form.currentPassword)            e.currentPassword = "Enter your current password";
    if (!form.newPassword)                e.newPassword     = "Enter a new password";
    else if (form.newPassword.length < 8) e.newPassword     = "Minimum 8 characters";
    else if (form.newPassword === form.currentPassword)
      e.newPassword     = "New password must be different";
    if (!form.confirmPassword)            e.confirmPassword = "Re-enter the new password";
    else if (form.confirmPassword !== form.newPassword)
      e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    setApiError(null);
    try {
      await vendorsApi.updateMyPassword(form.currentPassword, form.newPassword);
      setForm(blank);
      setSuccess(true);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
        <div className="bg-slate-100 border border-slate-200 rounded-lg p-1.5">
          <Shield className="h-4 w-4 text-slate-700" />
        </div>
        <div>
          <p className="text-[14px] font-bold text-slate-900">Account & Security</p>
          <p className="text-[11.5px] text-slate-400">Update your sign-in password.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4 max-w-md">
        <PasswordField
          label="Current Password"
          name="currentPassword"
          value={form.currentPassword}
          show={show.currentPassword}
          onToggleShow={() => setShow(s => ({ ...s, currentPassword: !s.currentPassword }))}
          onChange={v => setField("currentPassword", v)}
          error={errors.currentPassword}
        />
        <PasswordField
          label="New Password"
          name="newPassword"
          value={form.newPassword}
          show={show.newPassword}
          onToggleShow={() => setShow(s => ({ ...s, newPassword: !s.newPassword }))}
          onChange={v => setField("newPassword", v)}
          error={errors.newPassword}
          helper="Minimum 8 characters."
        />
        <PasswordField
          label="Confirm New Password"
          name="confirmPassword"
          value={form.confirmPassword}
          show={show.confirmPassword}
          onToggleShow={() => setShow(s => ({ ...s, confirmPassword: !s.confirmPassword }))}
          onChange={v => setField("confirmPassword", v)}
          error={errors.confirmPassword}
        />

        {apiError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-red-700 font-medium">{apiError}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-[12.5px] text-emerald-700 font-semibold">Password updated successfully.</p>
          </div>
        )}

        <div className="pt-1">
          <Button
            type="submit"
            disabled={saving}
            className="rounded-xl h-10 px-5 text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Updating…" : "Update Password"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PasswordField({
  label, name, value, show, onToggleShow, onChange, error, helper,
}: {
  label:        string;
  name:         string;
  value:        string;
  show:         boolean;
  onToggleShow: () => void;
  onChange:     (v: string) => void;
  error?:       string;
  helper?:      string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-semibold text-slate-600">{label}</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          name={name}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
          className="h-[40px] rounded-xl border-slate-200 text-[13px] pr-10 font-mono tracking-wider"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      {error
        ? <p className="text-[11px] text-red-500 font-medium">{error}</p>
        : helper && <p className="text-[11px] text-slate-400">{helper}</p>}
    </div>
  );
}

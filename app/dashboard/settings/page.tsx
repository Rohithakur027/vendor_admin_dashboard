"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users, UserCheck, UserX, Search, Plus, Pencil, Trash2,
  X, ChevronLeft, BookOpen, Map, BarChart2, FileText,
  CheckCircle2, Shield, Check, Mail, Phone, Calendar,
  Clock, AlertCircle, Filter, Eye, EyeOff, UserCircle,
} from "lucide-react";
import { VendorProfileSettings  } from "@/modules/profile/VendorProfileSettings";
import { VendorSecuritySettings } from "@/modules/profile/VendorSecuritySettings";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TeamMemberFilters } from "./TeamMemberFilters";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import type { PermissionModule } from "@/modules/team-members/types";
import { vendorTeamApi, type TeamMemberShape } from "@/lib/api";

const FONT = "var(--font-plus-jakarta-sans),'Plus Jakarta Sans',sans-serif";

// ─── Permission modules ───────────────────────────────────────────────────────

const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: "trip_management",
    label: "Trip Management",
    icon: Map,
    borderColor: "border-slate-200",
    bgColor: "bg-slate-50",
    iconColor: "text-slate-500",
    chipColor: "bg-slate-100 text-slate-600",
    actions: [],
  },
  {
    key: "report_monitoring",
    label: "Report Monitoring",
    icon: BarChart2,
    borderColor: "border-slate-200",
    bgColor: "bg-slate-50",
    iconColor: "text-slate-500",
    chipColor: "bg-slate-100 text-slate-600",
    actions: [],
  },
  {
    key: "invoicing_monitoring",
    label: "Invoicing Monitoring",
    icon: FileText,
    borderColor: "border-slate-200",
    bgColor: "bg-slate-50",
    iconColor: "text-slate-500",
    chipColor: "bg-slate-100 text-slate-600",
    actions: [],
  },
  {
    key: "supervisor_management",
    label: "Supervisor Management",
    icon: BookOpen,
    borderColor: "border-slate-200",
    bgColor: "bg-slate-50",
    iconColor: "text-slate-500",
    chipColor: "bg-slate-100 text-slate-600",
    actions: [],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    + " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function toMobileNumber(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

// ─── Form types ───────────────────────────────────────────────────────────────

type FormState = {
  full_name:   string;
  email:       string;
  phone:       string;
  password:    string;
  role_label:  string;
  permissions: Record<string, string[]>;
};

function blankForm(): FormState {
  return { full_name: "", email: "", phone: "", password: "", role_label: "", permissions: {} };
}

function memberToForm(m: TeamMemberShape): FormState {
  return {
    full_name:   m.full_name,
    email:       m.email,
    phone:       m.phone,
    password:    "",
    role_label:  m.role_label,
    permissions: { ...m.permissions },
  };
}

// ─── Toast ───────────────────────────────────────────────────────────────────

type ToastData = { id: number; message: string; error?: boolean };

function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold border bg-white text-slate-700 ${
      toast.error ? "border-red-200" : "border-slate-200"
    }`}>
      {toast.error
        ? <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
        : <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-blue-600" />}
      {toast.message}
    </div>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-semibold text-slate-600">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-red-500 font-medium">{error}</p>}
    </div>
  );
}

// ─── Permission card ─────────────────────────────────────────────────────────

function PermissionCard({
  mod, enabled, onChange,
}: {
  mod: PermissionModule;
  enabled: boolean;
  onChange?: (enabled: boolean) => void;
}) {
  const Icon = mod.icon;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50">
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-slate-400" />
          <span className="text-[13px] font-semibold text-slate-700">{mod.label}</span>
        </div>
        {onChange ? (
          <Switch checked={enabled} onCheckedChange={onChange} />
        ) : (
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
            enabled ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
          }`}>
            {enabled ? "Access granted" : "No access"}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Detail sidebar ───────────────────────────────────────────────────────────

function DetailSidebar({
  member, onClose, onEdit, onToggleActive,
}: {
  member: TeamMemberShape | null;
  onClose: () => void;
  onEdit: (m: TeamMemberShape) => void;
  onToggleActive: (id: string) => void;
}) {
  const open = !!member;
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-[380px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ fontFamily: FONT }}
      >
        {!member ? null : (
          <>
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 shrink-0">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-slate-900 truncate">{member.full_name}</p>
                <p className="text-[12px] text-slate-400 mt-0.5 truncate">{member.role_label}</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 ml-3 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between px-6 py-3 bg-slate-50/60 border-b border-slate-100 shrink-0">
              <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                member.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}>
                {member.is_active ? "Active" : "Inactive"}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-slate-500 font-medium">{member.is_active ? "Deactivate" : "Activate"}</span>
                <Switch checked={member.is_active} onCheckedChange={() => onToggleActive(member.id)} size="sm" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contact Info</p>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">Email</p>
                      <p className="text-[13px] text-slate-700 font-semibold">{member.email}</p>
                    </div>
                  </div>
                  {member.phone && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400 font-medium">Mobile</p>
                        <p className="text-[13px] text-slate-700 font-semibold">{member.phone}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400 font-medium">Added on</p>
                      <p className="text-[13px] text-slate-700 font-semibold">{formatDate(member.created_at)}</p>
                    </div>
                  </div>
                  {member.last_login_at && (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-400 font-medium">Last login</p>
                        <p className="text-[13px] text-slate-700 font-semibold">{formatDateTime(member.last_login_at)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Module Access</p>
                <div className="space-y-2">
                  {PERMISSION_MODULES.map(mod => (
                    <PermissionCard key={mod.key} mod={mod} enabled={(member.permissions[mod.key] ?? []).length > 0} />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
              <Button
                onClick={() => { onClose(); onEdit(member); }}
                className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl text-[13px] font-semibold h-10"
              >
                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Member
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Add/Edit dialog ──────────────────────────────────────────────────────────

function MemberDialog({
  open, mode, initialForm, onClose, onSave, isSaving,
}: {
  open:        boolean;
  mode:        "add" | "edit";
  initialForm: FormState;
  onClose:     () => void;
  onSave:      (form: FormState) => void;
  isSaving:    boolean;
}) {
  const [step,   setStep]   = useState<1 | 2>(1);
  const [form,   setForm]   = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open) { setForm(initialForm); setStep(1); setErrors({}); setShowPassword(false); }
  }, [open, initialForm]);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: undefined }));
  }

  function validateStep1() {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.full_name.trim())  errs.full_name  = "Name is required";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Enter a valid email";
    if (mode === "add") {
      if (!form.password.trim()) errs.password = "Password is required";
      else if (form.password.trim().length < 8) errs.password = "Min. 8 characters required";
    }
    if (!form.role_label.trim()) errs.role_label = "Role is required";
    if (toMobileNumber(form.phone).length !== 10) errs.phone = "Enter a valid 10-digit mobile number";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function setPermissions(key: string, on: boolean) {
    setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: on ? ["access"] : [] } }));
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && !isSaving && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[560px] p-0 gap-0 rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-[16px] font-bold text-slate-800">
                {mode === "add" ? "Add Team Member" : "Edit Team Member"}
              </DialogTitle>
              <p className="text-[13px] text-slate-400 mt-0.5">
                {step === 1 ? "Fill in the basic information below." : "Set module access and permissions."}
              </p>
            </div>
            <button onClick={onClose} disabled={isSaving} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 mt-0.5 ml-4 shrink-0 disabled:opacity-40">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            {([{ s: 1 as const, label: "Basic Info" }, { s: 2 as const, label: "Permissions" }]).map(({ s, label }, idx) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center justify-center h-6 w-6 rounded-full text-[11px] font-bold transition-all ${
                  s < step ? "bg-blue-600 text-white" : s === step ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
                }`}>
                  {s < step ? <Check className="h-3 w-3" /> : s}
                </div>
                <span className={`text-[12px] font-semibold ${s === step ? "text-slate-700" : "text-slate-400"}`}>{label}</span>
                {idx < 1 && <div className={`h-px w-6 ${step > s ? "bg-blue-600" : "bg-slate-200"}`} />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <style>{`.mm-scroll::-webkit-scrollbar{width:5px}.mm-scroll::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px}`}</style>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 mm-scroll">
          {step === 1 ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Full Name *" error={errors.full_name}>
                  <Input placeholder="e.g. Ravi Kumar" value={form.full_name}
                    onChange={e => setField("full_name", e.target.value)}
                    className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
                </Field>
                <Field label="Role / Designation *" error={errors.role_label}>
                  <Input placeholder="e.g. Booking Manager" value={form.role_label}
                    onChange={e => setField("role_label", e.target.value)}
                    className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
                </Field>
              </div>
              <Field label="Email Address *" error={errors.email}>
                <Input type="email" placeholder="e.g. ravi@sktravels.com" value={form.email}
                  onChange={e => setField("email", e.target.value)}
                  className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Mobile Number *" error={errors.phone}>
                  <Input type="tel" placeholder="10-digit number" value={form.phone}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setField("phone", val);
                    }}
                    className="h-[38px] rounded-xl border-slate-200 text-[13px]" />
                </Field>
                {mode === "add" && (
                  <Field label="Password *" error={errors.password}>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} placeholder="Min. 8 characters" value={form.password}
                        onChange={e => setField("password", e.target.value)}
                        className="h-[38px] rounded-xl border-slate-200 text-[13px] pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-[12px] text-slate-400">Toggle a module on to grant access to this member.</p>
              {PERMISSION_MODULES.map(mod => (
                <PermissionCard key={mod.key} mod={mod}
                  enabled={(form.permissions[mod.key] ?? []).length > 0}
                  onChange={on => setPermissions(mod.key, on)} />
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl shrink-0">
          {step === 2 ? (
            <button onClick={() => setStep(1)} disabled={isSaving}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSaving} className="rounded-xl h-10 px-5 text-[13px] font-semibold border-slate-200">Cancel</Button>
            {step === 1 ? (
              <Button onClick={() => { if (validateStep1()) setStep(2); }}
                className="rounded-xl h-10 px-6 bg-blue-600 hover:bg-blue-700 text-[13px] font-semibold text-white">
                Next
              </Button>
            ) : (
              <Button onClick={() => onSave(form)} disabled={isSaving}
                className="rounded-xl h-10 px-6 bg-blue-600 hover:bg-blue-700 text-[13px] font-semibold text-white min-w-[120px]">
                {isSaving ? "Saving…" : mode === "add" ? "Add Member" : "Save Changes"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Table skeleton ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {[1, 2].map(i => (
        <div key={i} className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_100px_110px_60px_76px] items-center gap-4 px-5 py-4 border-b border-slate-100">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-36 rounded" />
            <Skeleton className="h-3 w-48 rounded" />
          </div>
          <Skeleton className="h-3.5 w-28 rounded" />
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3.5 w-20 rounded" />
          <Skeleton className="h-5 w-9 rounded" />
          <Skeleton className="h-7 w-16 rounded-md" />
        </div>
      ))}
    </>
  );
}

// ─── Permission chips ─────────────────────────────────────────────────────────

function PermissionChips({ permissions }: { permissions: Record<string, string[]> }) {
  const active = Object.keys(permissions).filter(k => (permissions[k] ?? []).length > 0);
  const shown  = active.slice(0, 2);
  const rest   = active.length - shown.length;
  return (
    <div className="flex items-center flex-wrap gap-1">
      {shown.map(key => {
        const mod = PERMISSION_MODULES.find(m => m.key === key);
        if (!mod) return null;
        return (
          <span key={key} className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-600">
            {mod.label}
          </span>
        );
      })}
      {rest > 0 && (
        <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-400">+{rest} more</span>
      )}
      {active.length === 0 && <span className="text-[11px] text-slate-400 italic">No access</span>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VendorSettingsPage() {
  const [members,        setMembers]        = useState<TeamMemberShape[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [loadError,      setLoadError]      = useState<string | null>(null);
  const [search,         setSearch]         = useState("");
  const [filter,         setFilter]         = useState<"all" | "active" | "inactive">("all");
  const [toasts,         setToasts]         = useState<ToastData[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMemberShape | null>(null);
  const [dialogOpen,     setDialogOpen]     = useState(false);
  const [dialogMode,     setDialogMode]     = useState<"add" | "edit">("add");
  const [dialogForm,     setDialogForm]     = useState<FormState>(blankForm());
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [deleteDialog,   setDeleteDialog]   = useState<{ open: boolean; member: TeamMemberShape | null }>({ open: false, member: null });

  // ─── Tabs (Profile / Team Members / Account & Security) ──
  type TabKey = "profile" | "team" | "security";
  const router       = useRouter();
  const searchParams = useSearchParams();
  const tabParam     = searchParams.get("tab");
  const initialTab: TabKey =
    tabParam === "profile"  ? "profile"  :
    tabParam === "security" ? "security" : "team";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  function switchTab(tab: TabKey) {
    setActiveTab(tab);
    const sp = new URLSearchParams(Array.from(searchParams.entries()));
    if (tab === "team") sp.delete("tab"); else sp.set("tab", tab);
    const qs = sp.toString();
    router.replace(qs ? `/dashboard/settings?${qs}` : "/dashboard/settings");
  }

  function addToast(message: string, error = false) {
    const id = Date.now();
    setToasts(ts => [...ts, { id, message, error }]);
  }

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await vendorTeamApi.list();
      setMembers(data);
    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  function openAdd() {
    setDialogMode("add"); setDialogForm(blankForm()); setEditingId(null); setDialogOpen(true);
  }

  function openEdit(m: TeamMemberShape) {
    setDialogMode("edit"); setDialogForm(memberToForm(m)); setEditingId(m.id); setDialogOpen(true);
  }

  async function handleSave(form: FormState) {
    setSaving(true);
    const mobile = toMobileNumber(form.phone);
    try {
      if (dialogMode === "add") {
        const member = await vendorTeamApi.create({
          full_name:     form.full_name.trim(),
          email:         form.email.trim(),
          mobile_number: mobile,
          password:      form.password,
          role_label:    form.role_label.trim(),
          permissions:   form.permissions,
        });
        setMembers(ms => [member, ...ms]);
        addToast(`${member.full_name} added successfully`);
      } else {
        const member = await vendorTeamApi.update(editingId!, {
          full_name:     form.full_name.trim(),
          email:         form.email.trim(),
          mobile_number: mobile,
          role_label:    form.role_label.trim(),
          permissions:   form.permissions,
          ...(form.password ? { password: form.password } : {}),
        });
        setMembers(ms => ms.map(m => m.id !== editingId ? m : member));
        setSelectedMember(prev => prev?.id === editingId ? member : prev);
        addToast("Changes saved successfully");
      }
      setDialogOpen(false);
    } catch (err) {
      addToast((err as Error).message, true);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string) {
    const m = members.find(x => x.id === id);
    if (!m) return;
    const next = !m.is_active;
    setMembers(ms => ms.map(x => x.id !== id ? x : { ...x, is_active: next }));
    setSelectedMember(prev => prev?.id === id ? { ...prev, is_active: next } : prev);
    try {
      await vendorTeamApi.toggleStatus(id);
      addToast(`${m.full_name} ${next ? "activated" : "deactivated"}`);
    } catch (err) {
      setMembers(ms => ms.map(x => x.id !== id ? x : { ...x, is_active: m.is_active }));
      setSelectedMember(prev => prev?.id === id ? { ...prev, is_active: m.is_active } : prev);
      addToast((err as Error).message, true);
    }
  }

  async function handleDelete() {
    if (!deleteDialog.member) return;
    const target = deleteDialog.member;
    setDeleting(true);
    try {
      await vendorTeamApi.delete(target.id);
      setMembers(ms => ms.filter(m => m.id !== target.id));
      if (selectedMember?.id === target.id) setSelectedMember(null);
      addToast(`${target.full_name} removed`);
      setDeleteDialog({ open: false, member: null });
    } catch (err) {
      addToast((err as Error).message, true);
      setDeleteDialog({ open: false, member: null });
    } finally {
      setDeleting(false);
    }
  }

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.role_label.toLowerCase().includes(q);
    const matchFilter = filter === "all" || (filter === "active" ? m.is_active : !m.is_active);
    return matchSearch && matchFilter;
  });

  const totalActive   = members.filter(m =>  m.is_active).length;
  const totalInactive = members.filter(m => !m.is_active).length;

  const COLS = "grid-cols-[minmax(0,1.8fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_100px_110px_60px_76px]";

  return (
    <div style={{ fontFamily: FONT }} className="space-y-5">

      {/* Settings page header */}
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500">Manage your profile, account & team members.</p>
      </div>

      {/* Left-rail layout: vertical pill rail + right content card */}
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5 items-start">

        {/* ── Left rail ── */}
        <nav className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2 flex flex-col gap-1 md:sticky md:top-4">
          {([
            { key: "profile",  label: "Profile",            icon: UserCircle },
            { key: "team",     label: "Team Members",       icon: Users      },
            { key: "security", label: "Account & Security", icon: Shield     },
          ] as const).map(({ key, label, icon: Icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => switchTab(key)}
                className={`flex items-center gap-2.5 w-full text-left px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </button>
            );
          })}
        </nav>

        {/* ── Right content ── */}
        <div className="space-y-5 min-w-0">

      {activeTab === "profile" && <VendorProfileSettings />}

      {activeTab === "security" && <VendorSecuritySettings />}

      {activeTab === "team" && <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">Team Members</h1>
            <p className="text-sm text-slate-500">Manage staff access and module permissions</p>
          </div>
        </div>
        <Button
          onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 gap-2 rounded-xl px-5 h-10 text-[13px] font-semibold"
        >
          <span className="flex items-center justify-center h-5 w-5 rounded-full border border-white/50 shrink-0">
            <Plus className="h-3 w-3" />
          </span>
          Add Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Members", value: members.length, icon: Users    },
          { label: "Active",        value: totalActive,    icon: UserCheck },
          { label: "Inactive",      value: totalInactive,  icon: UserX     },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <s.icon className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              {loading ? <Skeleton className="h-6 w-8 mb-1 rounded" /> : (
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              )}
              <p className="text-[12px] text-slate-500 font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <TeamMemberFilters
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        onFilterChange={setFilter}
      />

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className={`grid ${COLS} items-center gap-4 px-5 py-3 bg-slate-50/50 border-b border-slate-100`}>
          {["MEMBER", "ROLE / DESIGNATION", "PERMISSIONS", "STATUS", "ADDED", "ACTIVE", ""].map((h, i) => (
            <span key={i} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {loading ? (
          <TableSkeleton />
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <AlertCircle className="w-10 h-10 mb-3 opacity-30 text-red-400" />
            <p className="text-sm font-medium text-red-400">{loadError}</p>
            <button onClick={loadMembers} className="mt-3 text-[12px] text-blue-600 hover:underline font-semibold">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Users className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No team members found</p>
          </div>
        ) : (
          filtered.map(m => (
            <div
              key={m.id}
              onClick={() => setSelectedMember(m)}
              className="grid items-center gap-4 px-5 py-4 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors cursor-pointer"
              style={{ gridTemplateColumns: "minmax(0,1.8fr) minmax(0,1.3fr) minmax(0,1.6fr) 100px 110px 60px 76px" }}
            >
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-800 truncate">{m.full_name}</p>
                <p className="text-[11px] text-slate-400 truncate">{m.email}</p>
              </div>

              <p className="text-[12px] text-slate-600 font-medium truncate">{m.role_label}</p>

              <PermissionChips permissions={m.permissions} />

              <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-semibold w-fit ${
                m.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}>
                {m.is_active ? "Active" : "Inactive"}
              </span>

              <p className="text-[11px] text-slate-500">{formatDate(m.created_at)}</p>

              <div onClick={e => e.stopPropagation()}>
                <Switch checked={m.is_active} onCheckedChange={() => toggleActive(m.id)} size="sm" />
              </div>

              <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                <button onClick={() => openEdit(m)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setDeleteDialog({ open: true, member: m })}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      </>}

        </div>
      </div>

      {/* Detail sidebar (rendered always; visibility controlled by `member` prop) */}
      <DetailSidebar
        member={activeTab === "team" ? selectedMember : null}
        onClose={() => setSelectedMember(null)}
        onEdit={m => { setSelectedMember(null); openEdit(m); }}
        onToggleActive={toggleActive}
      />

      {/* Add/Edit dialog */}
      <MemberDialog
        open={dialogOpen}
        mode={dialogMode}
        initialForm={dialogForm}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        isSaving={saving}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={o => !deleting && setDeleteDialog(d => ({ ...d, open: o }))}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog.member?.full_name} will lose all access immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting} onClick={() => setDeleteDialog({ open: false, member: null })}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white min-w-[80px]">
              {deleting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2">
        {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={() => setToasts(ts => ts.filter(x => x.id !== t.id))} />)}
      </div>
    </div>
  );
}

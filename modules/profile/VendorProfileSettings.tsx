"use client";

import { useEffect, useRef, useState } from "react";
import { vendorsApi, type VendorDetailApiItem, type VendorDocument } from "@/lib/api";
import { Building2, IndianRupee, MapPin, FileText, Upload, CheckCircle2, AlertCircle, Pencil, Save, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const BLUE = "#2563EB";

interface FormState {
  name:          string;
  contactPerson: string;
  email:         string;
  phone:         string;
  city:          string;
  address:       string;
  pan:           string;
  gst:           string;
}

function toForm(v: VendorDetailApiItem | null): FormState {
  return {
    name:          v?.name          ?? "",
    contactPerson: v?.contactPerson ?? "",
    email:         v?.email         ?? "",
    phone:         v?.phone         ?? "",
    city:          v?.city          ?? "",
    address:       v?.address       ?? "",
    pan:           v?.pan           ?? "",
    gst:           v?.gst           ?? "",
  };
}

function initials(name?: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export function VendorProfileSettings() {
  const [vendor,    setVendor]    = useState<VendorDetailApiItem | null>(null);
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState<FormState>(toForm(null));
  const [saving,  setSaving]  = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── PAN / GST document upload state ──
  const [docNumber,  setDocNumber]  = useState<Record<"PAN_CARD" | "GST_CERTIFICATE", string>>({
    PAN_CARD: "", GST_CERTIFICATE: "",
  });
  const [uploading,  setUploading]  = useState<"PAN_CARD" | "GST_CERTIFICATE" | null>(null);
  const [uploadErr,  setUploadErr]  = useState<string | null>(null);
  const [toast,      setToast]      = useState<string | null>(null);
  const panFileRef = useRef<HTMLInputElement>(null);
  const gstFileRef = useRef<HTMLInputElement>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [profileRes, docsRes] = await Promise.all([
        vendorsApi.me(),
        vendorsApi.myDocuments().catch(() => ({ data: [] as VendorDocument[] })),
      ]);
      setVendor(profileRes.data);
      setForm(toForm(profileRes.data));
      setDocuments(docsRes.data);
      // Seed doc number inputs from existing documents
      const next = { PAN_CARD: "", GST_CERTIFICATE: "" };
      for (const d of docsRes.data) {
        if (d.doc_type === "PAN_CARD" || d.doc_type === "GST_CERTIFICATE") {
          next[d.doc_type] = d.doc_number ?? "";
        }
      }
      setDocNumber(next);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAll(); }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function startEdit()  { setForm(toForm(vendor)); setSaveError(null); setEditing(true); }
  function cancelEdit() { setForm(toForm(vendor)); setSaveError(null); setEditing(false); }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = {
        name:          form.name.trim(),
        contactPerson: form.contactPerson.trim(),
        email:         form.email.trim(),
        phone:         form.phone.trim(),
        city:          form.city.trim(),
        address:       form.address.trim(),
        pan:           form.pan.trim().toUpperCase(),
        gst:           form.gst.trim().toUpperCase(),
      };
      const res = await vendorsApi.updateMe(payload);
      setVendor(res.data);
      setForm(toForm(res.data));
      setEditing(false);
      setToast("Profile updated");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(docType: "PAN_CARD" | "GST_CERTIFICATE", file: File | undefined) {
    setUploading(docType);
    setUploadErr(null);
    try {
      const number = docNumber[docType].trim() || undefined;
      const res = await vendorsApi.uploadMyDocument(docType, number, file);
      // Replace the matching doc in state
      setDocuments((prev) => {
        const filtered = prev.filter((d) => d.doc_type !== docType);
        return [...filtered, res.data];
      });
      setToast(`${docType === "PAN_CARD" ? "PAN" : "GST"} document saved`);
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  const panDoc = documents.find((d) => d.doc_type === "PAN_CARD");
  const gstDoc = documents.find((d) => d.doc_type === "GST_CERTIFICATE");
  const isBlocked = vendor?.status === "Inactive";

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
        <AlertCircle className="h-4 w-4" /> {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-white shadow-lg border border-slate-200 text-sm font-semibold text-slate-700">
          <CheckCircle2 className="h-4 w-4 text-blue-600" /> {toast}
        </div>
      )}

      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
        <div
          className="h-[60px] w-[60px] rounded-full flex items-center justify-center text-white text-xl font-extrabold shrink-0"
          style={{ background: isBlocked ? "#94A3B8" : BLUE }}
        >
          {initials(vendor?.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[17px] font-extrabold text-slate-900">{vendor?.name}</span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                isBlocked ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${isBlocked ? "bg-slate-400" : "bg-emerald-500"}`}
              />
              {vendor?.status}
            </span>
          </div>
          <p className="text-[12.5px] text-slate-500 mt-1">
            {[vendor?.email, vendor?.phone, vendor?.city].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {/* Editable basic details */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-1.5">
              <Building2 className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <p className="text-[14px] font-bold text-slate-900">Vendor Details</p>
              <p className="text-[11.5px] text-slate-400">Basic info, address & registration</p>
            </div>
          </div>
          {!editing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 px-3 text-[12.5px] font-semibold"
              onClick={startEdit}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 px-3 text-[12.5px] font-semibold"
                onClick={cancelEdit}
                disabled={saving}
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="gap-1.5 h-8 px-3 text-[12.5px] font-semibold bg-blue-600 hover:bg-blue-700"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 p-5">
          <DetailField label="Vendor Name"   value={form.name}          editing={editing} onChange={(v) => setForm({ ...form, name: v })} />
          <DetailField label="Contact Person" value={form.contactPerson} editing={editing} onChange={(v) => setForm({ ...form, contactPerson: v })} />
          <DetailField label="Email"          value={form.email}         editing={editing} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <DetailField label="Phone"          value={form.phone}         editing={editing} onChange={(v) => setForm({ ...form, phone: v })} />
          <DetailField label="City"           value={form.city}          editing={editing} onChange={(v) => setForm({ ...form, city: v })} />
          <DetailField
            label="Address"
            value={form.address}
            editing={editing}
            onChange={(v) => setForm({ ...form, address: v })}
            multiline
            className="md:col-span-2"
          />
          <DetailField
            label="PAN Number"
            value={form.pan}
            editing={editing}
            onChange={(v) => setForm({ ...form, pan: v.toUpperCase() })}
            placeholder="ABCDE1234F"
            mono
          />
          <DetailField
            label="GST Number"
            value={form.gst}
            editing={editing}
            onChange={(v) => setForm({ ...form, gst: v.toUpperCase() })}
            placeholder="22ABCDE1234F1Z5"
            mono
          />
        </div>

        {saveError && (
          <div className="px-5 pb-4 -mt-1">
            <p className="text-[12px] font-medium text-red-600 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> {saveError}
            </p>
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-1.5">
            <FileText className="h-4 w-4 text-slate-700" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-slate-900">Documents</p>
            <p className="text-[11.5px] text-slate-400">Upload PAN card and GST certificate</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5">
          <DocumentCard
            label="PAN Card"
            icon={IndianRupee}
            docType="PAN_CARD"
            doc={panDoc}
            number={docNumber.PAN_CARD}
            onNumberChange={(v) => setDocNumber((d) => ({ ...d, PAN_CARD: v.toUpperCase() }))}
            fileRef={panFileRef}
            uploading={uploading === "PAN_CARD"}
            onUpload={(file) => handleUpload("PAN_CARD", file)}
          />
          <DocumentCard
            label="GST Certificate"
            icon={MapPin}
            docType="GST_CERTIFICATE"
            doc={gstDoc}
            number={docNumber.GST_CERTIFICATE}
            onNumberChange={(v) => setDocNumber((d) => ({ ...d, GST_CERTIFICATE: v.toUpperCase() }))}
            fileRef={gstFileRef}
            uploading={uploading === "GST_CERTIFICATE"}
            onUpload={(file) => handleUpload("GST_CERTIFICATE", file)}
          />
        </div>

        {uploadErr && (
          <div className="px-5 pb-4">
            <p className="text-[12px] font-medium text-red-600 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" /> {uploadErr}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline editable field ──────────────────────────────────────────────────

function DetailField({
  label, value, editing, onChange, type, placeholder, multiline, mono, className,
}: {
  label:       string;
  value:       string;
  editing:     boolean;
  onChange:    (v: string) => void;
  type?:       string;
  placeholder?: string;
  multiline?:  boolean;
  mono?:       boolean;
  className?:  string;
}) {
  return (
    <div className={className}>
      <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</Label>
      {editing ? (
        multiline ? (
          <textarea
            className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 resize-none"
            rows={3}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <Input
            type={type ?? "text"}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={`mt-1.5 h-9 text-[13px] ${mono ? "font-mono uppercase" : ""}`}
          />
        )
      ) : (
        <p className={`mt-1.5 text-[13.5px] font-semibold text-slate-800 ${mono ? "font-mono" : ""}`}>
          {value || "—"}
        </p>
      )}
    </div>
  );
}

// ─── Document upload card ────────────────────────────────────────────────────

function DocumentCard({
  label, icon: Icon, docType, doc, number, onNumberChange, fileRef, uploading, onUpload,
}: {
  label:    string;
  icon:     React.ElementType;
  docType:  "PAN_CARD" | "GST_CERTIFICATE";
  doc?:     VendorDocument;
  number:   string;
  onNumberChange: (v: string) => void;
  fileRef:  React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  onUpload: (file: File | undefined) => void;
}) {
  const hasFile = !!doc?.file_url;
  const placeholder = docType === "PAN_CARD" ? "ABCDE1234F" : "22ABCDE1234F1Z5";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="bg-white border border-slate-200 rounded-lg p-1.5">
            <Icon className="h-3.5 w-3.5 text-slate-600" />
          </div>
          <span className="text-[13px] font-bold text-slate-800">{label}</span>
        </div>
        {doc && (
          <span
            className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
              doc.is_verified
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {doc.is_verified ? "Verified" : "Pending review"}
          </span>
        )}
      </div>

      <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Number</Label>
      <Input
        value={number}
        onChange={(e) => onNumberChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 mb-3 h-9 text-[13px] font-mono uppercase"
      />

      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            onUpload(f);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 h-9 px-3 text-[12.5px] font-semibold flex-1"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading…" : hasFile ? "Replace file" : "Upload file"}
        </Button>
        {!hasFile && (
          <Button
            type="button"
            size="sm"
            className="h-9 px-3 text-[12.5px] font-semibold bg-blue-600 hover:bg-blue-700"
            onClick={() => onUpload(undefined)}
            disabled={uploading || !number.trim()}
          >
            Save number
          </Button>
        )}
      </div>

      {hasFile && (
        <a
          href={doc!.file_url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:underline"
        >
          <FileText className="h-3.5 w-3.5" /> View current file
        </a>
      )}
    </div>
  );
}

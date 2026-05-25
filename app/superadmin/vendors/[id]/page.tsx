"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { vendorsApi, type VendorBillingCycle, type VendorBillingType, type VendorDetailApiItem, type TripApiItem, type VendorDocument } from "@/lib/api";
import {
  ArrowLeft, MapPin, Phone, Mail, Users,
  Wallet, ShieldOff, ShieldCheck,
  CheckCircle2, Loader2, AlertCircle, ArrowRight,
  IndianRupee, Building2, Upload, FileText, Eye, EyeOff,
  CalendarDays,
} from "lucide-react";
import dynamic from "next/dynamic";
import { detectFileType } from "@/components/document-viewer/useDocumentViewer";

const DocumentViewer = dynamic(
  () => import("@/components/document-viewer/DocumentViewer").then(m => ({ default: m.DocumentViewer })),
  { ssr: false }
);
import { SearchBar } from "@/components/SearchBar";
import { FilterPanel, FilterSection, FilterPill, FilterTrigger } from "@/components/FilterPanel";
import { ColumnsPopover } from "@/components/ColumnsPopover";
import { BookingDetailModal } from "@/modules/bookings/components/BookingDetailModal";
import { ExportButton } from "@/components/ExportButton";
import { exportToXlsx } from "@/lib/exportXlsx";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { getTableSpec } from "@/lib/columnConfig";
import { TripsTable } from "@/modules/bookings/components/TripsTable";
import { buildTripRenderers } from "@/modules/bookings/tripRenderers";
import type { Booking, BookingStatus, BookingType } from "@/modules/bookings/types";
import { cn } from "@/lib/utils";

const VENDOR_TRIPS_TABLE_KEY = "vendorTripsAdmin" as const;

// Adapt the superadmin trips API shape (TripApiItem) into the Booking shape
// the shared TripsTable + tripRenderers expect. supervisorName/driver info
// stay attached so the renderers (which take id-based lookups) can resolve
// them through the maps we build alongside.
function tripApiItemToBooking(t: TripApiItem): Booking {
  return {
    id:              t.id,
    type:            (t.type as BookingType) ?? "Instant",
    supervisorId:    t.supervisorId ?? "",
    supervisorName:  t.supervisorName ?? "",
    driverId:        t.driverId,
    driverName:      t.driverName,
    pickupLocation:  t.pickupLocation,
    dropLocation:    t.dropLocation,
    scheduledTime:   t.scheduledTime,
    status:          (t.status as BookingStatus) ?? "Pending",
    createdAt:       t.createdAt,
    completedAt:     t.completedAt,
    fare:            t.fare ?? undefined,
    passengers:      t.passengers ?? undefined,
    bookingSource:   t.bookingSource,
    bookingRef:      t.tripRef,
    driverPhone:     t.driverPhone,
    pickupLat:       t.pickupLat,
    pickupLng:       t.pickupLng,
    dropLat:         t.dropLat,
    dropLng:         t.dropLng,
    stops:           t.stops,
  };
}

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") { resolve(false); return; }
    if (document.getElementById("razorpay-script")) { resolve(true); return; }
    const s = document.createElement("script");
    s.id  = "razorpay-script";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

const BLUE = "#2563eb";
const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const CARD: React.CSSProperties = {
  background: "#fff",
  border: "1.5px solid #E8EEF4",
  borderRadius: 16,
  boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}
function fmtDateTime(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) + " · " +
    dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase();
}
function fmtCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

const STATUS_PILL: Record<string, { bg: string; color: string; dot: string; border: string }> = {
  Completed:         { bg: "#f0fdf4", color: "#15803d", dot: "#22c55e",  border: "#bbf7d0" },
  Ongoing:           { bg: "#eff6ff", color: "#1d4ed8", dot: "#3b82f6",  border: "#bfdbfe" },
  Pending:           { bg: "#fefce8", color: "#854d0e", dot: "#eab308",  border: "#fef08a" },
  Cancelled:         { bg: "#fef2f2", color: "#b91c1c", dot: "#ef4444",  border: "#fecaca" },
  "Awaiting Driver": { bg: "#fef9c3", color: "#92400e", dot: "#f59e0b",  border: "#fde68a" },
  "Driver Confirmed":{ bg: "#dbeafe", color: "#1e40af", dot: "#60a5fa",  border: "#bfdbfe" },
};
function StatusPill({ status }: { status: string }) {
  const s = STATUS_PILL[status] ?? STATUS_PILL["Pending"];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:s.bg, color:s.color, border:`1px solid ${s.border}`, borderRadius:20, fontSize:11, fontWeight:700, padding:"3px 10px", whiteSpace:"nowrap" }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.dot, flexShrink:0 }} />
      {status}
    </span>
  );
}

function SkeletonBox({ w, h, r = 6 }: { w: number | string; h: number; r?: number }) {
  return <span style={{ display:"inline-block", width:w, height:h, background:"#f1f5f9", borderRadius:r, animation:"skel-pulse 1.5s ease-in-out infinite", verticalAlign:"middle" }} />;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ElementType }) {
  return (
    <div style={{ ...CARD, padding: "20px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <p style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
        <p style={{ fontSize: 36, fontWeight: 800, color: "#0f172a", lineHeight: 1.1, marginTop: 4 }}>{value}</p>
      </div>
      <div style={{ background: "#f1f5f9", borderRadius: 11, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon style={{ width: 20, height: 20, color: "#64748b" }} />
      </div>
    </div>
  );
}

export default function VendorProfilePage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();

  const [vendor,       setVendor]       = useState<VendorDetailApiItem | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [fetchError,   setFetchError]   = useState("");
  const [trips,        setTrips]        = useState<TripApiItem[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripSearch,      setTripSearch]      = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [tripStatus,      setTripStatus]      = useState("All Status");
  const [tripType,        setTripType]        = useState("All Types");
  const [draftTripStatus, setDraftTripStatus] = useState("All Status");
  const [draftTripType,   setDraftTripType]   = useState("All Types");
  const [tripFilterOpen,  setTripFilterOpen]  = useState(false);
  const [tripCalendarOpen, setTripCalendarOpen] = useState(false);
  const [tripPeriod,      setTripPeriod]      = useState<"all"|"today"|"last7"|"last30"|"custom">("all");
  const [draftTripPeriod, setDraftTripPeriod] = useState<"all"|"today"|"last7"|"last30"|"custom">("all");
  const [tripDateMode,    setTripDateMode]    = useState<"range"|"single">("range");
  const [draftDateMode,   setDraftDateMode]   = useState<"range"|"single">("range");
  const [tripDateFrom,    setTripDateFrom]    = useState<Date | null>(null);
  const [tripDateTo,      setTripDateTo]      = useState<Date | null>(null);
  const [draftDateFrom,   setDraftDateFrom]   = useState<Date | null>(null);
  const [draftDateTo,     setDraftDateTo]     = useState<Date | null>(null);
  const [calViewDate,     setCalViewDate]     = useState(() => new Date());

  function openTripFilter() {
    setDraftTripStatus(tripStatus);
    setDraftTripType(tripType);
    setTripFilterOpen(true);
  }
  function applyTripFilter() {
    setTripStatus(draftTripStatus);
    setTripType(draftTripType);
    setTripFilterOpen(false);
  }
  function cancelTripFilter() { setTripFilterOpen(false); }

  function openTripCalendar() {
    setDraftTripPeriod(tripPeriod);
    setDraftDateMode(tripDateMode);
    setDraftDateFrom(tripDateFrom);
    setDraftDateTo(tripDateTo);
    setTripCalendarOpen(true);
  }
  function applyTripCalendar() {
    setTripPeriod(draftTripPeriod);
    setTripDateMode(draftDateMode);
    setTripDateFrom(draftDateFrom);
    setTripDateTo(draftDateTo);
    setTripCalendarOpen(false);
  }
  function cancelTripCalendar() { setTripCalendarOpen(false); }

  const [activeTab, setActiveTab] = useState("overview");

  // Column visibility for the superadmin Trips tab — shared infra with Past Trips
  // so the Columns popover and the rendering pipeline are identical.
  const {
    columns: tripsVisibleCols,
    toggle:  toggleTripsCol,
    reset:   resetTripsCols,
    totalCount: tripsTotalCols,
    loading: tripsPrefsLoading,
  } = useColumnPreferences(VENDOR_TRIPS_TABLE_KEY);

  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeAmt,  setRechargeAmt]  = useState("");
  const [rechargeErr,  setRechargeErr]  = useState("");
  const [recharging,   setRecharging]   = useState(false);

  const [toggling, setToggling] = useState(false);
  const [toast,    setToast]    = useState("");

  const [settingsSection,   setSettingsSection]   = useState<"profile" | "security">("profile");
  const [editName,          setEditName]          = useState("");
  const [editCity,          setEditCity]          = useState("");
  const [editContactPerson, setEditContactPerson] = useState("");
  const [editPhone,         setEditPhone]         = useState("");
  const [editEmail,         setEditEmail]         = useState("");
  const [editPan,           setEditPan]           = useState("");
  const [editGst,           setEditGst]           = useState("");
  const [editBillingType,   setEditBillingType]   = useState<VendorBillingType>("PREPAID");
  const [editCreditLimit,   setEditCreditLimit]   = useState("");
  const [editBillingCycle,  setEditBillingCycle]  = useState<VendorBillingCycle>("MONTHLY");
  const [editDueDays,       setEditDueDays]       = useState("7");
  const [editSaving,        setEditSaving]        = useState(false);
  const [editErr,           setEditErr]           = useState("");

  const [pwForm,   setPwForm]   = useState({ password: "", confirm: "" });
  const [pwShow,   setPwShow]   = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved,  setPwSaved]  = useState(false);
  const [pwError,  setPwError]  = useState<string | null>(null);

  // Documents tab
  const [docs,        setDocs]        = useState<VendorDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingDoc,setUploadingDoc]= useState<string | null>(null);
  const [docError,    setDocError]    = useState<string | null>(null);
  const [viewingDoc,  setViewingDoc]  = useState<VendorDocument | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    Promise.all([
      vendorsApi.get(id),
      vendorsApi.documents.list(id).catch(() => ({ success: true as const, data: [] as VendorDocument[] })),
    ])
      .then(([vRes, docsRes]) => {
        setVendor(vRes.data);
        setDocs(docsRes.data);
        setEditName(vRes.data.name ?? "");
        setEditCity(vRes.data.city ?? "");
        setEditContactPerson(vRes.data.contactPerson ?? "");
        setEditPhone(vRes.data.phone ?? "");
        setEditEmail(vRes.data.email ?? "");
        const panDocVal = docsRes.data.find(d => d.doc_type === "PAN_CARD")?.doc_number ?? "";
        const gstDocVal = docsRes.data.find(d => d.doc_type === "GST_CERTIFICATE")?.doc_number ?? "";
        setEditPan(panDocVal || vRes.data.pan || "");
        setEditGst(gstDocVal);
        setEditBillingType(vRes.data.billing_type ?? "PREPAID");
        setEditCreditLimit(String(vRes.data.credit_limit ?? ""));
        setEditBillingCycle(vRes.data.billing_cycle ?? "MONTHLY");
        setEditDueDays(String(vRes.data.payment_due_days ?? 7));
      })
      .catch((err) => setFetchError(err instanceof Error ? err.message : "Failed to load vendor"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (activeTab !== "trips") return;
    if (trips.length > 0) return;
    setTripsLoading(true);
    vendorsApi.trips(id).then(r => setTrips(r.data)).catch(() => {}).finally(() => setTripsLoading(false));
  }, [activeTab, id, trips.length]);

  useEffect(() => {
    if (activeTab !== "documents") return;
    if (docs.length > 0) return;
    setDocsLoading(true);
    vendorsApi.documents.list(id)
      .then(r => setDocs(r.data))
      .catch(() => {})
      .finally(() => setDocsLoading(false));
  }, [activeTab, id, docs.length]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function toggleBlock() {
    if (!vendor || toggling) return;
    const next = vendor.status === "Active" ? "Inactive" : "Active";
    setToggling(true);
    try {
      const res = await vendorsApi.update(id, { status: next });
      setVendor(res.data);
      showToast(next === "Inactive" ? "Vendor account blocked." : "Vendor account unblocked.");
    } catch (err) { showToast(err instanceof Error ? err.message : "Update failed."); }
    finally { setToggling(false); }
  }

  async function refreshAfterRecharge(_creditedAmount: number, newBalance: number) {
    setVendor(v => v ? { ...v, wallet_balance: newBalance } : v);
  }

  async function handleRecharge() {
    const amt = parseFloat(rechargeAmt);
    if (!rechargeAmt || isNaN(amt) || amt < 100 || amt > 100_000) {
      setRechargeErr("Amount must be between ₹100 and ₹1,00,000"); return;
    }
    setRecharging(true); setRechargeErr("");
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { setRechargeErr("Failed to load payment gateway."); setRecharging(false); return; }
      const orderRes = await vendorsApi.adminWallet.createOrder(id, amt);
      const { order_id, amount: orderAmount, currency, key_id } = orderRes.data;
      const rzp = new window.Razorpay({
        key: key_id, amount: orderAmount, currency, order_id,
        name: "SK Travels", description: `Wallet recharge — ${vendor?.name ?? "Vendor"}`,
        theme: { color: BLUE },
        method: { upi: true, card: true, netbanking: true, wallet: true, emi: true },
        prefill: { name: vendor?.name ?? undefined, email: vendor?.email ?? undefined, contact: vendor?.phone ?? undefined },
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await vendorsApi.adminWallet.verify(id, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: amt,
            });
            const newBalance = verifyRes.data.new_balance ?? ((vendor?.wallet_balance ?? 0) + amt);
            await refreshAfterRecharge(amt, newBalance);
            setRechargeOpen(false); setRechargeAmt("");
            showToast(`${fmtCurrency(amt)} added to ${vendor?.name ?? "vendor"}'s wallet.`);
          } catch (err) {
            setRechargeErr(err instanceof Error ? err.message : "Payment received but update failed.");
          } finally { setRecharging(false); }
        },
        modal: { ondismiss: () => setRecharging(false) },
      });
      rzp.open();
    } catch (err) { setRechargeErr(err instanceof Error ? err.message : "Could not initiate payment."); setRecharging(false); }
  }

  async function handleDocUpload(docType: string, file: File) {
    setUploadingDoc(docType);
    setDocError(null);
    try {
      const fd = new FormData();
      fd.append("doc_type", docType);
      fd.append("file", file);
      const res = await vendorsApi.documents.upload(id, fd);
      setDocs(prev => {
        const next = prev.filter(d => d.doc_type !== docType);
        return [...next, res.data];
      });
      showToast("Document uploaded successfully.");
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingDoc(null);
    }
  }

  async function handleDocPatch(docType: string, action: "approve" | "reject") {
    setUploadingDoc(docType);
    setDocError(null);
    try {
      const res = await vendorsApi.documents.patch(id, docType, action);
      setDocs(prev => prev.map(d => d.doc_type === docType ? res.data : d));
      showToast(action === "approve" ? "Document approved." : "Document rejected.");
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setUploadingDoc(null);
    }
  }

  async function handleSaveProfile() {
    const nextBillingType = editBillingType;
    const nextLimit = Number(editCreditLimit);
    const nextDueDays = Number(editDueDays);
    if (nextBillingType === "POSTPAID") {
      if (!Number.isFinite(nextLimit) || nextLimit <= 0) {
        setEditErr("Credit limit must be greater than 0 for postpaid vendors.");
        return;
      }
      if (editBillingCycle !== "WEEKLY" && editBillingCycle !== "MONTHLY") {
        setEditErr("Billing cycle must be WEEKLY or MONTHLY.");
        return;
      }
      if (!Number.isInteger(nextDueDays) || nextDueDays <= 0) {
        setEditErr("Payment due days must be greater than 0 for postpaid vendors.");
        return;
      }
    }
    setEditSaving(true); setEditErr("");
    try {
      const res = await vendorsApi.update(id, {
        name:          editName.trim(),
        city:          editCity.trim(),
        contactPerson: editContactPerson.trim(),
        phone:         editPhone.trim(),
        email:         editEmail.trim(),
        pan:           editPan.trim(),
        gst:           editGst.trim(),
        billing_type:  nextBillingType,
        credit_limit:  nextBillingType === "POSTPAID" ? nextLimit : 0,
        ...(nextBillingType === "PREPAID" ? { outstanding_balance: 0 } : {}),
        billing_cycle: nextBillingType === "POSTPAID" ? editBillingCycle : "MONTHLY",
        payment_due_days: nextBillingType === "POSTPAID" ? nextDueDays : 7,
      });
      setVendor(res.data);
      // Refresh docs so PAN/GST numbers update in the overview panel
      vendorsApi.documents.list(id).then(r => setDocs(r.data)).catch(() => {});
      showToast("Profile updated successfully.");
    } catch (err) { setEditErr(err instanceof Error ? err.message : "Failed to save."); }
    finally { setEditSaving(false); }
  }

  if (!loading && (fetchError || !vendor)) {
    return (
      <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button onClick={() => router.push("/superadmin/vendors")} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", border:"1.5px solid #e2e8f0", borderRadius:10, background:"#fff", color:"#334155", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:FONT }}>
            <ArrowLeft style={{ width:16, height:16 }} /> Back
          </button>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10, background:"#fef2f2", border:"1px solid #fecaca", borderRadius:12, padding:"16px 20px" }}>
          <AlertCircle style={{ width:18, height:18, color:"#ef4444", flexShrink:0 }} />
          <span style={{ fontSize:13.5, color:"#b91c1c", fontWeight:600 }}>{fetchError || "Vendor not found."}</span>
        </div>
      </div>
    );
  }

  const isBlocked = vendor?.status === "Inactive";
  const TABS = [
    { value: "overview",  label: "Overview" },
    { value: "trips",     label: "Recent Trips" },
    { value: "documents", label: "Documents" },
    { value: "settings",  label: "Settings" },
  ];

  const DOCS = [
    { key: "PAN_CARD",        label: "PAN Card",                     noExpiry: true },
    { key: "GST_CERTIFICATE", label: "GST Registration Certificate", noExpiry: true },
  ];

  return (
    <div style={{ fontFamily: FONT, color: "#0f172a", display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:20, right:20, zIndex:300, background:"#f0fdf4", border:"1.5px solid #bbf7d0", borderRadius:12, padding:"12px 18px", display:"flex", alignItems:"center", gap:10, boxShadow:"0 8px 32px rgba(0,0,0,0.1)", maxWidth:340 }}>
          <CheckCircle2 style={{ width:16, height:16, color:"#16a34a", flexShrink:0 }} />
          <span style={{ fontSize:13.5, fontWeight:600, color:"#15803d" }}>{toast}</span>
        </div>
      )}

      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <button
          onClick={() => router.push("/superadmin/vendors")}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", border: "1.5px solid #E8EEF4", borderRadius: 10, background: "#fff", color: "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: FONT }}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} /> Back
        </button>
        <div style={{ width: 1, height: 28, background: "#E8EEF4" }} />
        <div>
          <p style={{ fontSize: 17, fontWeight: 800, color: "#0F172A" }}>Vendor Profile</p>
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 1 }}>
            {loading || !vendor ? <SkeletonBox w={128} h={12} /> : `${vendor.name} · Full details`}
          </p>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ borderBottom: "1.5px solid #E8EEF4", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 0 }}>
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              style={{ padding: "10px 18px", fontSize: 14, fontWeight: activeTab === tab.value ? 700 : 500, color: activeTab === tab.value ? BLUE : "#64748b", borderTop: "none", borderLeft: "none", borderRight: "none", borderBottom: activeTab === tab.value ? `2.5px solid ${BLUE}` : "2.5px solid transparent", background: "none", cursor: "pointer", whiteSpace: "nowrap" as const, transition: "color 0.15s", fontFamily: FONT }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ TAB: OVERVIEW ══ */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Profile card */}
          <div style={{ ...CARD, padding: 20, display: "flex", alignItems: "center", gap: 18 }}>
            {loading || !vendor ? (
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#f1f5f9", flexShrink: 0, animation: "skel-pulse 1.5s ease-in-out infinite" }} />
            ) : (
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: isBlocked ? "#e2e8f0" : BLUE, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 800, flexShrink: 0 }}>
                {initials(vendor.name)}
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                {loading || !vendor ? (
                  <><SkeletonBox w={180} h={20} /><SkeletonBox w={64} h={20} /></>
                ) : (
                  <>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{vendor.name}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: isBlocked ? "#f1f5f9" : "#DCFCE7", color: isBlocked ? "#64748b" : "#15803D", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: isBlocked ? "#94a3b8" : "#22C55E" }} />
                      {vendor.status}
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" as const }}>
                {loading || !vendor ? (
                  <><SkeletonBox w={120} h={13} /><SkeletonBox w={150} h={13} /><SkeletonBox w={80} h={13} /></>
                ) : (
                  <>
                    {vendor.email && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#334155" }}><Mail style={{ width: 14, height: 14, color: "#94A3B8" }} />{vendor.email}</span>}
                    {vendor.phone && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#334155" }}><Phone style={{ width: 14, height: 14, color: "#94A3B8" }} />{vendor.phone}</span>}
                    {vendor.city  && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "#334155" }}><MapPin style={{ width: 14, height: 14, color: "#94A3B8" }} />{vendor.city}</span>}
                  </>
                )}
              </div>
            </div>
            {loading || !vendor ? (
              <SkeletonBox w={120} h={12} r={6} />
            ) : (
              <p style={{ fontSize: 12, color: "#94A3B8", flexShrink: 0 }}>
                Joined {fmtDate(vendor.joinedAt)}
              </p>
            )}
          </div>

          {/* Stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {loading || !vendor ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ ...CARD, padding: "20px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <SkeletonBox w={80} h={11} />
                    <SkeletonBox w={50} h={32} />
                  </div>
                  <SkeletonBox w={38} h={38} r={11} />
                </div>
              ))
            ) : (
              <>
                <StatCard label="Total Supervisors" value={vendor.totalSupervisors ?? 0}     icon={Users} />
                <StatCard label="Wallet Balance"    value={fmtCurrency(vendor.wallet_balance ?? 0)} icon={IndianRupee} />
                <StatCard label="Billing Type"      value={vendor.billing_type ?? "PREPAID"} icon={Wallet} />
                <StatCard label="Status"            value={vendor.status ?? "Active"} icon={CheckCircle2} />
              </>
            )}
          </div>

          {/* Wallet card + Recent Transactions */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>

            {/* Left column: wallet card + secondary POCs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Blue gradient wallet card */}
              <div
                style={{
                  background: "linear-gradient(135deg, #1e40af 0%, #2563EB 60%, #3b82f6 100%)",
                  borderRadius: 18,
                  padding: "18px 22px 22px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ position: "absolute", top: -24, right: -24, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
                <div style={{ position: "absolute", bottom: -30, right: 24, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 8 }}>
                  Wallet Balance
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", lineHeight: 1, letterSpacing: -1 }}>
                    {loading || !vendor ? "—" : fmtCurrency(vendor.wallet_balance ?? 0)}
                  </div>
                  <button
                    onClick={() => setRechargeOpen(true)}
                    disabled={loading || !vendor}
                    style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, border: "none", background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: FONT, backdropFilter: "blur(4px)" }}
                  >
                    <Wallet style={{ width: 14, height: 14 }} /> Recharge Wallet
                  </button>
                </div>
              </div>

              {/* Secondary POCs */}
              <div style={{ ...CARD, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 12px", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 9, padding: 7 }}>
                    <Users style={{ width: 16, height: 16, color: "#0F172A" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Secondary POCs</p>
                    <p style={{ fontSize: 11, color: "#94A3B8" }}>Additional points of contact</p>
                  </div>
                </div>
                <div style={{ padding: "8px 0 4px" }}>
                  {loading ? (
                    [0, 1].map(i => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: "1px solid #F8FAFC" }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Users style={{ width: 14, height: 14, color: "#64748B" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <SkeletonBox w="40%" h={11} />
                          <div style={{ marginTop: 4 }}><SkeletonBox w="70%" h={12} /></div>
                        </div>
                      </div>
                    ))
                  ) : !vendor?.secondaryPOCs?.length ? (
                    <div style={{ padding: "16px 18px", textAlign: "center" as const }}>
                      <p style={{ fontSize: 13, color: "#CBD5E1", fontWeight: 500 }}>No secondary POCs added</p>
                    </div>
                  ) : (
                    vendor.secondaryPOCs.map((poc, idx) => (
                      <div key={idx} style={{ padding: "12px 18px", borderBottom: idx < vendor.secondaryPOCs!.length - 1 ? "1px solid #F8FAFC" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Users style={{ width: 14, height: 14, color: "#64748B" }} />
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{poc.name || "—"}</p>
                        </div>
                        <div style={{ paddingLeft: 40, display: "flex", flexDirection: "column" as const, gap: 3 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Phone style={{ width: 12, height: 12, color: "#94A3B8", flexShrink: 0 }} />
                            <p style={{ fontSize: 12, color: "#475569" }}>{poc.phone || "—"}</p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Mail style={{ width: 12, height: 12, color: "#94A3B8", flexShrink: 0 }} />
                            <p style={{ fontSize: 12, color: "#475569", whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{poc.email || "—"}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>{/* end left column */}

            {/* Vendor Details */}
            <div style={{ ...CARD, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 12px", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 9, padding: 7 }}>
                  <Building2 style={{ width: 16, height: 16, color: "#0F172A" }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>Vendor Details</p>
                  <p style={{ fontSize: 11, color: "#94A3B8" }}>Basic info & registration</p>
                </div>
              </div>
              <div style={{ padding: "8px 0 4px" }}>
                {(() => {
                  const panDoc = docs.find(d => d.doc_type === "PAN_CARD");
                  const gstDoc = docs.find(d => d.doc_type === "GST_CERTIFICATE");
                  const rows: { label: string; value: string | null | undefined; icon: React.ElementType }[] = [
                    { label: "Contact Person", value: vendor?.contactPerson, icon: Users },
                    { label: "Phone",          value: vendor?.phone,         icon: Phone },
                    { label: "Email",          value: vendor?.email,         icon: Mail },
                    { label: "City",           value: vendor?.city,          icon: MapPin },
                    { label: "Billing Type",   value: vendor?.billing_type ?? "PREPAID", icon: Wallet },
                    { label: "Credit Limit",   value: vendor?.billing_type === "POSTPAID" ? fmtCurrency(Number(vendor.credit_limit ?? 0)) : "—", icon: IndianRupee },
                    { label: "Outstanding",    value: vendor?.billing_type === "POSTPAID" ? fmtCurrency(Number(vendor.outstanding_balance ?? 0)) : "—", icon: IndianRupee },
                    { label: "Billing Cycle",  value: vendor?.billing_type === "POSTPAID" ? (vendor.billing_cycle ?? "MONTHLY") : "—", icon: FileText },
                    { label: "Payment Due",    value: vendor?.billing_type === "POSTPAID" ? `${vendor.payment_due_days ?? 7} days` : "—", icon: FileText },
                    { label: "PAN Number",     value: panDoc?.doc_number,    icon: FileText },
                    { label: "GST Number",     value: gstDoc?.doc_number,    icon: FileText },
                  ];
                  return rows.map(({ label, value, icon: Icon }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 18px", borderBottom: "1px solid #F8FAFC" }}>
                      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon style={{ width: 14, height: 14, color: "#64748B" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <p style={{ fontSize: 10.5, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{label}</p>
                          {label === "Contact Person" && (
                            <span style={{ fontSize: 9, fontWeight: 800, background: "#EFF6FF", color: "#2563EB", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>Primary</span>
                          )}
                        </div>
                        {loading ? (
                          <SkeletonBox w="60%" h={12} />
                        ) : (
                          <p style={{ fontSize: 13, fontWeight: 600, color: value ? "#0F172A" : "#CBD5E1", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {value ?? "—"}
                          </p>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══ TAB: RECENT TRIPS ══ */}
      {activeTab === "trips" && (() => {
        const tripFilterCount = tripType !== "All Types" ? 1 : 0;
        const tripDateFilterCount = tripPeriod !== "all" ? 1 : 0;
        const tripDateButtonLabel =
          tripPeriod === "today" ? "Today" :
          tripPeriod === "last7" ? "Last 7 Days" :
          tripPeriod === "last30" ? "Last 30 Days" :
          tripPeriod === "custom" && tripDateFrom
            ? tripDateMode === "single" || !tripDateTo
              ? tripDateFrom.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
              : `${tripDateFrom.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${tripDateTo.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
            : "Date Range";
        const filtered = trips.filter(t => {
          const q = tripSearch.toLowerCase();
          const matchQ =
            !q ||
            (t.tripRef ?? "").toLowerCase().includes(q) ||
            (t.driverName ?? "").toLowerCase().includes(q) ||
            (t.driverPhone ?? "").toLowerCase().includes(q) ||
            (t.vehicleModel ?? "").toLowerCase().includes(q) ||
            (t.vehicleReg ?? "").toLowerCase().replace(/\s+/g, "").includes(q.replace(/\s+/g, "")) ||
            t.pickupLocation.toLowerCase().includes(q) ||
            t.dropLocation.toLowerCase().includes(q);
          const matchSt = tripStatus === "All Status" || t.status === tripStatus;
          const matchTy = tripType   === "All Types"  || t.type   === tripType;
          const matchDate = (() => {
            if (tripPeriod === "all") return true;
            const d = new Date(t.createdAt);
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            if (tripPeriod === "today") return d >= todayStart;
            if (tripPeriod === "last7") {
              const from = new Date(todayStart); from.setDate(from.getDate() - 6);
              return d >= from;
            }
            if (tripPeriod === "last30") {
              const from = new Date(todayStart); from.setDate(from.getDate() - 29);
              return d >= from;
            }
            if (tripPeriod === "custom" && tripDateFrom) {
              const from = new Date(tripDateFrom); from.setHours(0, 0, 0, 0);
              if (tripDateMode === "single") {
                const to = new Date(from); to.setDate(to.getDate() + 1);
                return d >= from && d < to;
              }
              if (tripDateTo) {
                const to = new Date(tripDateTo); to.setHours(23, 59, 59, 999);
                return d >= from && d <= to;
              }
              return d >= from;
            }
            return true;
          })();
          return matchQ && matchSt && matchTy && matchDate;
        });

        // Adapt the API rows into Booking shape so the shared TripsTable +
        // tripRenderers can render them identically to Past Trips.
        const vendorName = vendor?.name ?? "";
        const filteredBookings: Booking[] = filtered.map(t =>
          Object.assign(tripApiItemToBooking(t), { vendorName }),
        );
        const tripSupervisorMap = new Map(
          filtered.filter(t => t.supervisorId).map(t => [t.supervisorId as string, t.supervisorName ?? ""]),
        );
        const tripDriverMap = new Map(
          filtered.map(t => [t.id, {
            name:        t.driverName,
            phone:       t.driverPhone,
            vehicle:     t.vehicleModel,
            vehicleReg:  t.vehicleReg,
            vehicleType: t.vehicleType,
          }]),
        );
        const tripsRenderers = buildTripRenderers(
          (id) => (id ? (tripSupervisorMap.get(id) ?? "") : ""),
          (b)  => {
            const d = tripDriverMap.get(b.id) ?? { name: null, phone: null, vehicle: null, vehicleReg: null, vehicleType: null };
            return {
              name:        d.name ?? null,
              vehicle:     d.vehicle ?? null,
              vehicleReg:  d.vehicleReg ?? null,
              vehicleType: d.vehicleType ?? null,
              phone:       d.phone ?? null,
            };
          },
        );

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Search + Filter row */}
            <div className="flex flex-wrap gap-3 items-center">
              <SearchBar value={tripSearch} onChange={setTripSearch} placeholder="Search by ID, driver, phone, vehicle, route..." />
              <div className="relative shrink-0">
                <FilterTrigger onClick={openTripFilter} activeCount={tripFilterCount} />
                <FilterPanel
                  open={tripFilterOpen}
                  onClose={cancelTripFilter}
                  onCancel={cancelTripFilter}
                  onApply={applyTripFilter}
                  activeCount={tripFilterCount}
                  panelClassName="w-80"
                  onClearAll={() => {
                    setDraftTripType("All Types");
                  }}
                >
                  <FilterSection label="Trip Type">
                    {["All Types","Instant","Scheduled"].map(t => (
                      <FilterPill key={t} label={t} active={draftTripType === t} onClick={() => setDraftTripType(t)} />
                    ))}
                  </FilterSection>
                </FilterPanel>
              </div>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={openTripCalendar}
                  aria-label="Open trip date range calendar"
                  className={cn(
                    "relative inline-flex items-center gap-2 h-[42px] px-4 rounded-xl border text-[12.5px] font-medium transition-colors",
                    tripDateFilterCount > 0
                      ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <CalendarDays className="h-[15px] w-[15px] shrink-0" />
                  <span className="max-w-[190px] truncate">{tripDateButtonLabel}</span>
                  {tripDateFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-blue-600 text-[10px] font-bold text-white flex items-center justify-center">
                      {tripDateFilterCount}
                    </span>
                  )}
                </button>
                <FilterPanel
                  open={tripCalendarOpen}
                  onClose={cancelTripCalendar}
                  onCancel={cancelTripCalendar}
                  onApply={applyTripCalendar}
                  activeCount={tripDateFilterCount}
                  panelClassName="w-80"
                  onClearAll={() => {
                    setDraftTripPeriod("all");
                    setDraftDateFrom(null);
                    setDraftDateTo(null);
                  }}
                >
                  {(() => {
                    const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
                    const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
                    const yr = calViewDate.getFullYear();
                    const mo = calViewDate.getMonth();
                    const firstDow = new Date(yr, mo, 1).getDay();
                    const daysInMo = new Date(yr, mo + 1, 0).getDate();
                    const todayDate = new Date(); todayDate.setHours(0,0,0,0);

                    function sameDay(a: Date | null, b: Date): boolean {
                      if (!a) return false;
                      return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
                    }
                    function inDraftRange(d: Date): boolean {
                      if (draftDateMode !== "range" || !draftDateFrom || !draftDateTo) return false;
                      const from = new Date(draftDateFrom); from.setHours(0,0,0,0);
                      const to   = new Date(draftDateTo);   to.setHours(23,59,59,999);
                      return d >= from && d <= to;
                    }
                    function handleDayClick(day: number) {
                      const clicked = new Date(yr, mo, day);
                      setDraftTripPeriod("custom");
                      if (draftDateMode === "single") {
                        setDraftDateFrom(clicked); setDraftDateTo(null);
                      } else {
                        if (!draftDateFrom || draftDateTo) {
                          setDraftDateFrom(clicked); setDraftDateTo(null);
                        } else {
                          if (clicked < draftDateFrom) { setDraftDateTo(draftDateFrom); setDraftDateFrom(clicked); }
                          else { setDraftDateTo(clicked); }
                        }
                      }
                    }
                    const cells: (number | null)[] = [
                      ...Array.from({ length: firstDow }, () => null),
                      ...Array.from({ length: daysInMo }, (_, i) => i + 1),
                    ];
                    const fmtOpts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
                    const selectedLabel = draftDateFrom
                      ? (draftDateMode === "single" || !draftDateTo)
                        ? draftDateFrom.toLocaleDateString("en-IN", fmtOpts)
                        : `${draftDateFrom.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${draftDateTo.toLocaleDateString("en-IN", fmtOpts)}`
                      : null;

                    return (
                      <div className="space-y-3 pt-1">
                        {/* Quick Select */}
                        <div>
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Quick Select</p>
                          <div className="flex flex-wrap gap-1.5">
                            {([
                              { key: "today"  as const, label: "Today" },
                              { key: "last7"  as const, label: "Last 7 Days" },
                              { key: "last30" as const, label: "Last 30 Days" },
                              { key: "all"    as const, label: "All Time" },
                            ]).map(({ key, label }) => (
                              <button
                                key={key}
                                onClick={() => { setDraftTripPeriod(key); setDraftDateFrom(null); setDraftDateTo(null); }}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap",
                                  draftTripPeriod === key
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700"
                                )}
                              >{label}</button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Date Range */}
                        <div>
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Custom Date Range</p>
                          {/* Mode toggle */}
                          <div className="flex bg-slate-100 rounded-lg p-0.5 mb-3">
                            {(["range", "single"] as const).map(mode => (
                              <button
                                key={mode}
                                onClick={() => { setDraftDateMode(mode); setDraftDateTo(null); }}
                                className={cn(
                                  "flex-1 py-1.5 rounded-md text-xs font-semibold transition-colors",
                                  draftDateMode === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                                )}
                              >{mode === "range" ? "Date Range" : "Single Date"}</button>
                            ))}
                          </div>

                          {/* Calendar header */}
                          <div className="flex items-center justify-between mb-2">
                            <button
                              onClick={() => setCalViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 text-base leading-none"
                            >‹</button>
                            <span className="text-sm font-semibold text-slate-800">{MONTHS[mo]} {yr}</span>
                            <button
                              onClick={() => setCalViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 text-base leading-none"
                            >›</button>
                          </div>

                          {/* Day-of-week labels */}
                          <div className="grid grid-cols-7 mb-1">
                            {DAY_LABELS.map(dl => (
                              <div key={dl} className="text-center text-[10px] font-semibold text-slate-400">{dl}</div>
                            ))}
                          </div>

                          {/* Day cells */}
                          <div className="grid grid-cols-7 gap-y-0.5">
                            {cells.map((day, i) => {
                              if (!day) return <div key={`e-${i}`} />;
                              const thisDate = new Date(yr, mo, day);
                              const isFuture   = thisDate > todayDate;
                              const isSelected = sameDay(draftDateFrom, thisDate) || sameDay(draftDateTo, thisDate);
                              const isInRange  = inDraftRange(thisDate);
                              const isToday    = sameDay(todayDate, thisDate);
                              return (
                                <button
                                  key={day}
                                  disabled={isFuture}
                                  onClick={() => handleDayClick(day)}
                                  className={cn(
                                    "w-full aspect-square flex items-center justify-center text-[11px] font-medium transition-colors",
                                    isFuture   ? "text-slate-300 cursor-not-allowed" :
                                    isSelected ? "bg-blue-600 text-white font-bold rounded-full" :
                                    isInRange  ? "bg-blue-100 text-blue-700" :
                                    isToday    ? "text-blue-600 font-bold rounded-full" :
                                                 "text-slate-700 hover:bg-slate-100 rounded-full"
                                  )}
                                >{day}</button>
                              );
                            })}
                          </div>

                          {/* Selected label */}
                          {selectedLabel && (
                            <p className="text-center text-[11px] font-semibold text-slate-700 mt-2 pt-2 border-t border-slate-100">
                              {selectedLabel}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </FilterPanel>
              </div>

              <ColumnsPopover
                tableKey={VENDOR_TRIPS_TABLE_KEY}
                visible={tripsVisibleCols}
                totalCount={tripsTotalCols}
                onToggle={toggleTripsCol}
                onReset={resetTripsCols}
              />

              <ExportButton
                onClick={() => {
                  const tripsSpec = getTableSpec(VENDOR_TRIPS_TABLE_KEY);
                  const rendererExport = tripsRenderers as Record<string, { csv?: (b: Booking) => string | number }>;

                  const rows = filteredBookings.map((b) => {
                    const out: Record<string, string | number> = {};

                    tripsVisibleCols.forEach((key) => {
                      const col = tripsSpec.columns.find((c) => c.key === key);
                      if (!col) return;

                      if (key === "tripId") {
                        out["Trip ID"]   = b.bookingRef ?? "";
                        out["Trip Type"] = b.type ?? "";
                        return;
                      }

                      if (key === "route") {
                        out["Pickup Address"] = b.pickupLocation ?? "";
                        out["Destination Address"] = b.dropLocation ?? "";
                        return;
                      }

                      if (key === "supervisorCompany") {
                        out["Supervisor"] = tripSupervisorMap.get(b.supervisorId) ?? b.supervisorName ?? "";
                        out["Company"]    = b.bookingSource ?? "";
                        return;
                      }

                      if (key === "vehicle") {
                        const d = tripDriverMap.get(b.id);
                        out["Vehicle Number"] = d?.vehicleReg ?? "";
                        out["Vehicle Model"]  = d?.vehicle ?? "";
                        out["Vehicle Type"]   = d?.vehicleType ?? "";
                        return;
                      }

                      if (key === "pickupLatLng") {
                        out["Pickup Latitude"]  = b.pickupLat ?? "";
                        out["Pickup Longitude"] = b.pickupLng ?? "";
                        return;
                      }

                      if (key === "dropLatLng") {
                        out["Drop Latitude"]  = b.dropLat ?? "";
                        out["Drop Longitude"] = b.dropLng ?? "";
                        return;
                      }

                      if (key === "escort") {
                        const escort = b as Booking & { escortRequired?: boolean; escortPickup?: string | null };
                        out["Escort Required"] = escort.escortRequired ? "Yes" : "";
                        return;
                      }

                      out[col.label] = rendererExport[key]?.csv?.(b) ?? "";
                    });

                    return out;
                  });
                  exportToXlsx(`vendor-${id}-trips`, rows, "Recent Trips");
                }}
                disabled={tripsLoading || filteredBookings.length === 0}
                label="Export XLSX"
                className="ml-auto"
              />
            </div>

            <div className="flex items-center gap-2 text-[13px] text-slate-500">
              <span className="font-semibold text-slate-400 text-[14px]">{filteredBookings.length}</span>
              <span>{filteredBookings.length === 1 ? "trip" : "trips"} on this page</span>
            </div>

            <TripsTable
              items={filteredBookings}
              visibleCols={tripsVisibleCols}
              renderers={tripsRenderers}
              tableKey={VENDOR_TRIPS_TABLE_KEY}
              isLoading={tripsLoading}
              prefsLoading={tripsPrefsLoading}
              emptyMessage={trips.length === 0 ? "No trips yet." : "No trips match your filters."}
              onRowClick={setSelectedBooking}
            />
          </div>
        );
      })()}

      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />

      {/* ══ TAB: DOCUMENTS ══ */}
      {activeTab === "documents" && (() => {
        const docMap = Object.fromEntries(docs.map(d => [d.doc_type, d]));
        const approvedCount = docs.filter(d => d.is_verified).length;
        const rejectedCount = docs.filter(d => !d.is_verified && d.note !== null).length;
        const pendingCount  = docs.filter(d => !d.is_verified && d.note === null).length;
        const submittedCount = docs.length;

        function docStatus(d: VendorDocument | undefined): "not_submitted" | "pending" | "approved" | "rejected" {
          if (!d) return "not_submitted";
          if (d.is_verified) return "approved";
          if (d.note !== null) return "rejected";
          return "pending";
        }

        return (
          <div style={{ ...CARD, overflow:"hidden" }}>

            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", borderBottom:"1px solid #e2e8f0" }}>
              <div style={{ display:"flex", gap:10 }}>
                <button style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", borderRadius:10, border:`2px solid ${BLUE}`, background:"#fff", color:BLUE, fontSize:13, fontWeight:700, cursor:"default", fontFamily:FONT }}>
                  Vendor Documents
                  <span style={{ background:BLUE, color:"#fff", borderRadius:20, fontSize:11, fontWeight:800, padding:"1px 8px" }}>{submittedCount}/{DOCS.length}</span>
                </button>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <span style={{ background:"#f0fdf4", color:"#15803d", border:"1px solid #bbf7d0", borderRadius:20, fontSize:12, fontWeight:700, padding:"4px 14px" }}>{approvedCount} Approved</span>
                <span style={{ background:"#fef2f2", color:"#b91c1c", border:"1px solid #fecaca", borderRadius:20, fontSize:12, fontWeight:700, padding:"4px 14px" }}>{rejectedCount} Rejected</span>
                <span style={{ background:"#fefce8", color:"#854d0e", border:"1px solid #fde68a", borderRadius:20, fontSize:12, fontWeight:700, padding:"4px 14px" }}>{pendingCount} Pending</span>
              </div>
            </div>

            {/* Error banner */}
            {docError && (
              <div style={{ display:"flex", alignItems:"center", gap:10, background:"#fef2f2", borderBottom:"1px solid #fecaca", padding:"10px 24px" }}>
                <AlertCircle style={{ width:15, height:15, color:"#ef4444", flexShrink:0 }} />
                <span style={{ fontSize:13, color:"#b91c1c", fontWeight:600 }}>{docError}</span>
                <button onClick={() => setDocError(null)} style={{ marginLeft:"auto", background:"none", border:"none", color:"#b91c1c", cursor:"pointer", fontSize:13, fontWeight:700 }}>×</button>
              </div>
            )}

            {/* Column headers */}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1.5fr", gap:16, padding:"10px 24px", background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
              {["DOCUMENT","STATUS","EXPIRY DATE","ACTION"].map(h => (
                <div key={h} style={{ fontSize:11, fontWeight:700, color:"#94a3b8", textTransform:"uppercase" as const, letterSpacing:"0.07em" }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {docsLoading ? (
              Array.from({ length: DOCS.length }).map((_, i) => (
                <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1.5fr", gap:16, padding:"18px 24px", borderBottom: i < DOCS.length - 1 ? "1px solid #f8fafc" : "none", alignItems:"center" }}>
                  <SkeletonBox w="60%" h={14} /><SkeletonBox w={80} h={22} /><SkeletonBox w={60} h={14} /><SkeletonBox w={140} h={30} r={8} />
                </div>
              ))
            ) : DOCS.map((def, i) => {
              const doc  = docMap[def.key];
              const st   = docStatus(doc);
              const busy = uploadingDoc === def.key;

              const STATUS_CFG = {
                not_submitted: { dot:"#cbd5e1", color:"#94a3b8", label:"Not Submitted" },
                pending:       { dot:"#f59e0b", color:"#92400e", label:"Pending Review" },
                approved:      { dot:"#22c55e", color:"#15803d", label:"Approved"       },
                rejected:      { dot:"#ef4444", color:"#b91c1c", label:"Rejected"       },
              };
              const cfg = STATUS_CFG[st];

              return (
                <div key={def.key} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1.5fr", gap:16, padding:"16px 24px", borderBottom: i < DOCS.length - 1 ? "1px solid #f8fafc" : "none", alignItems:"center" }}>

                  {/* Document name */}
                  <span style={{ fontSize:14, color:"#334155", fontWeight:600 }}>{def.label}</span>

                  {/* Status badge */}
                  <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12.5, color:cfg.color, fontWeight:600 }}>
                    <span style={{ width:7, height:7, borderRadius:"50%", background:cfg.dot, flexShrink:0 }} />
                    {cfg.label}
                  </span>

                  {/* Expiry */}
                  <span style={{ fontSize:13, color:"#94a3b8", fontStyle:"italic" }}>
                    {def.noExpiry ? "No expiry" : (doc?.expiry_date ? fmtDate(doc.expiry_date) : "—")}
                  </span>

                  {/* Actions */}
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    {/* Hidden file input */}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
                      style={{ display:"none" }}
                      ref={el => { fileInputRefs.current[def.key] = el; }}
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleDocUpload(def.key, f);
                        e.target.value = "";
                      }}
                    />

                    {st === "not_submitted" && (
                      <button
                        disabled={busy}
                        onClick={() => fileInputRefs.current[def.key]?.click()}
                        style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 14px", borderRadius:8, border:"none", background:BLUE, color:"#fff", fontSize:12.5, fontWeight:700, cursor: busy ? "wait" : "pointer", fontFamily:FONT, opacity: busy ? 0.7 : 1 }}
                      >
                        {busy ? <Loader2 style={{ width:13, height:13, animation:"spin 1s linear infinite" }} /> : <Upload style={{ width:13, height:13 }} />}
                        Upload
                      </button>
                    )}

                    {(st === "pending" || st === "approved" || st === "rejected") && doc?.file_url && (
                      <button
                        onClick={() => setViewingDoc(doc)}
                        style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 14px", borderRadius:8, border:"1.5px solid #e2e8f0", background:"#f8fafc", color:"#334155", fontSize:12.5, fontWeight:700, fontFamily:FONT, whiteSpace:"nowrap" as const, cursor:"pointer" }}
                      >
                        <FileText style={{ width:13, height:13 }} /> View
                      </button>
                    )}

                    {st === "pending" && (
                      <button
                        disabled={busy}
                        onClick={() => handleDocPatch(def.key, "approve")}
                        style={{ padding:"6px 14px", borderRadius:8, border:"none", background:"#16a34a", color:"#fff", fontSize:12.5, fontWeight:700, cursor: busy ? "wait" : "pointer", fontFamily:FONT, opacity: busy ? 0.7 : 1 }}
                      >
                        {busy ? "…" : "Approve"}
                      </button>
                    )}

                    {(st === "pending" || st === "approved") && (
                      <button
                        disabled={busy}
                        onClick={() => handleDocPatch(def.key, "reject")}
                        style={{ padding:"6px 14px", borderRadius:8, border:"none", background:"#dc2626", color:"#fff", fontSize:12.5, fontWeight:700, cursor: busy ? "wait" : "pointer", fontFamily:FONT, opacity: busy ? 0.7 : 1 }}
                      >
                        {busy ? "…" : "Reject"}
                      </button>
                    )}

                    {(st === "pending" || st === "approved" || st === "rejected") && (
                      <button
                        disabled={busy}
                        onClick={() => fileInputRefs.current[def.key]?.click()}
                        style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 14px", borderRadius:8, border:`1.5px solid ${BLUE}`, background:"#eff6ff", color:BLUE, fontSize:12.5, fontWeight:700, cursor: busy ? "wait" : "pointer", fontFamily:FONT, opacity: busy ? 0.7 : 1, whiteSpace:"nowrap" as const }}
                      >
                        {busy ? <Loader2 style={{ width:13, height:13, animation:"spin 1s linear infinite" }} /> : <Upload style={{ width:13, height:13 }} />}
                        Re-upload
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ══ TAB: SETTINGS ══ */}
      {activeTab === "settings" && (
        <div style={{ display:"flex", gap:20 }}>

          {/* Left nav */}
          <div style={{ width:210, flexShrink:0 }}>
            <div style={{ ...CARD, padding:6 }}>
              {([
                { key:"profile",  label:"Profile" },
                { key:"security", label:"Account & Security" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSettingsSection(key)}
                  style={{ width:"100%", display:"block", textAlign:"left", padding:"10px 14px", borderRadius:10, background: settingsSection === key ? "#EFF6FF" : "transparent", color: settingsSection === key ? BLUE : "#64748b", fontWeight: settingsSection === key ? 700 : 500, fontSize:13.5, cursor:"pointer", border:"none", fontFamily:FONT, transition:"background 0.15s" }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Right content */}
          <div style={{ flex:1, minWidth:0 }}>

            {/* ─ Profile ─ */}
            {settingsSection === "profile" && (
              <div style={{ ...CARD, padding:24 }}>
                <div style={{ marginBottom:20 }}>
                  <p style={{ fontSize:16, fontWeight:800, color:"#0f172a" }}>Edit Profile</p>
                  <p style={{ fontSize:12.5, color:"#94a3b8", marginTop:3 }}>Update the vendor&apos;s business details</p>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                  {([
                    { label:"Vendor Name",    value:editName,          setter:setEditName,          placeholder:"Company name",      upper:false },
                    { label:"City",           value:editCity,          setter:setEditCity,          placeholder:"City",               upper:false },
                    { label:"Contact Person", value:editContactPerson, setter:setEditContactPerson, placeholder:"Full name",          upper:false },
                    { label:"Phone Number",   value:editPhone,         setter:setEditPhone,         placeholder:"+91 XXXXX XXXXX",    upper:false },
                    { label:"Email Address",  value:editEmail,         setter:setEditEmail,         placeholder:"email@example.com",  upper:false },
                    { label:"PAN Number",     value:editPan,           setter:setEditPan,           placeholder:"ABCDE1234F",         upper:true  },
                    { label:"GST Number",     value:editGst,           setter:setEditGst,           placeholder:"22AAAAA0000A1Z5",    upper:true  },
                  ] as { label:string; value:string; setter:(v:string)=>void; placeholder:string; upper:boolean }[]).map(({ label, value, setter, placeholder, upper }) => (
                    <div key={label} style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      <label style={{ fontSize:12, fontWeight:600, color:"#334155", fontFamily:FONT }}>{label}</label>
                      <input
                        value={value}
                        onChange={e => setter(upper ? e.target.value.toUpperCase() : e.target.value)}
                        placeholder={placeholder}
                        style={{ padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:9, fontSize:13.5, fontFamily:FONT, color:"#0f172a", outline:"none", background:"#fafbfc", letterSpacing: upper ? "0.04em" : undefined }}
                        onFocus={e => (e.target as HTMLInputElement).style.borderColor = BLUE}
                        onBlur={e  => (e.target as HTMLInputElement).style.borderColor = "#e2e8f0"}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ marginTop:22, paddingTop:20, borderTop:"1px solid #f1f5f9" }}>
                  <div style={{ marginBottom:14 }}>
                    <p style={{ fontSize:14, fontWeight:800, color:"#0f172a" }}>Billing Settings</p>
                    <p style={{ fontSize:12.5, color:"#94a3b8", marginTop:3 }}>
                      {editBillingType === "PREPAID"
                        ? "PREPAID: Trips are allowed only when wallet balance is available."
                        : "POSTPAID: Trips are billed later and controlled by credit limit."}
                    </p>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      <label style={{ fontSize:12, fontWeight:600, color:"#334155", fontFamily:FONT }}>Billing Type</label>
                      <select
                        value={editBillingType}
                        onChange={e => {
                          const next = e.target.value as VendorBillingType;
                          setEditBillingType(next);
                          if (next === "PREPAID") {
                            setEditCreditLimit("");
                            setEditBillingCycle("MONTHLY");
                            setEditDueDays("7");
                          }
                        }}
                        style={{ padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:9, fontSize:13.5, fontFamily:FONT, color:"#0f172a", outline:"none", background:"#fafbfc" }}
                      >
                        <option value="PREPAID">PREPAID</option>
                        <option value="POSTPAID">POSTPAID</option>
                      </select>
                    </div>

                    {editBillingType === "POSTPAID" && (
                      <>
                        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                          <label style={{ fontSize:12, fontWeight:600, color:"#334155", fontFamily:FONT }}>Credit Limit</label>
                          <input
                            type="number"
                            min={1}
                            value={editCreditLimit}
                            onChange={e => setEditCreditLimit(e.target.value)}
                            placeholder="50000"
                            style={{ padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:9, fontSize:13.5, fontFamily:FONT, color:"#0f172a", outline:"none", background:"#fafbfc" }}
                          />
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                          <label style={{ fontSize:12, fontWeight:600, color:"#334155", fontFamily:FONT }}>Billing Cycle</label>
                          <select
                            value={editBillingCycle}
                            onChange={e => setEditBillingCycle(e.target.value as VendorBillingCycle)}
                            style={{ padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:9, fontSize:13.5, fontFamily:FONT, color:"#0f172a", outline:"none", background:"#fafbfc" }}
                          >
                            <option value="WEEKLY">WEEKLY</option>
                            <option value="MONTHLY">MONTHLY</option>
                          </select>
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                          <label style={{ fontSize:12, fontWeight:600, color:"#334155", fontFamily:FONT }}>Payment Due Days</label>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={editDueDays}
                            onChange={e => setEditDueDays(e.target.value)}
                            placeholder="7"
                            style={{ padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:9, fontSize:13.5, fontFamily:FONT, color:"#0f172a", outline:"none", background:"#fafbfc" }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:24, paddingTop:20, borderTop:"1px solid #f1f5f9" }}>
                  <button onClick={handleSaveProfile} disabled={editSaving} style={{ padding:"9px 22px", borderRadius:9, background:BLUE, border:"none", color:"#fff", fontWeight:700, fontSize:13.5, cursor: editSaving ? "wait" : "pointer", opacity: editSaving ? 0.7 : 1, fontFamily:FONT }}>
                    {editSaving ? "Saving…" : "Save Changes"}
                  </button>
                  {editErr && <p style={{ fontSize:12.5, color:"#dc2626", fontWeight:600 }}>{editErr}</p>}
                </div>
              </div>
            )}

            {/* ─ Account & Security ─ */}
            {settingsSection === "security" && (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

                {/* Update Password */}
                <div style={{ ...CARD, padding:22 }}>
                  <p style={{ fontSize:15, fontWeight:800, color:"#0f172a", marginBottom:4 }}>Update Password</p>
                  <p style={{ fontSize:12.5, color:"#94a3b8", marginBottom:16 }}>Set a new login password for this vendor account.</p>

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      <label style={{ fontSize:12, fontWeight:600, color:"#334155", fontFamily:FONT }}>New Password</label>
                      <div style={{ position:"relative" }}>
                        <input
                          type={pwShow ? "text" : "password"}
                          placeholder="Min 8 characters"
                          value={pwForm.password}
                          onChange={e => { setPwForm(f => ({ ...f, password: e.target.value })); setPwError(null); setPwSaved(false); }}
                          style={{ width:"100%", padding:"9px 36px 9px 12px", border:"1.5px solid #e2e8f0", borderRadius:9, fontSize:13.5, fontFamily:FONT, color:"#0f172a", outline:"none", background:"#fafbfc", boxSizing:"border-box" as const }}
                          onFocus={e => (e.target as HTMLInputElement).style.borderColor = BLUE}
                          onBlur={e  => (e.target as HTMLInputElement).style.borderColor = "#e2e8f0"}
                        />
                        <button
                          type="button"
                          onClick={() => setPwShow(s => !s)}
                          style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:4, color:"#94a3b8" }}
                        >
                          {pwShow ? <EyeOff style={{ width:16, height:16 }} /> : <Eye style={{ width:16, height:16 }} />}
                        </button>
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      <label style={{ fontSize:12, fontWeight:600, color:"#334155", fontFamily:FONT }}>Confirm Password</label>
                      <input
                        type={pwShow ? "text" : "password"}
                        placeholder="Confirm the password"
                        value={pwForm.confirm}
                        onChange={e => { setPwForm(f => ({ ...f, confirm: e.target.value })); setPwError(null); setPwSaved(false); }}
                        style={{ width:"100%", padding:"9px 12px", border:"1.5px solid #e2e8f0", borderRadius:9, fontSize:13.5, fontFamily:FONT, color:"#0f172a", outline:"none", background:"#fafbfc" }}
                        onFocus={e => (e.target as HTMLInputElement).style.borderColor = BLUE}
                        onBlur={e  => (e.target as HTMLInputElement).style.borderColor = "#e2e8f0"}
                      />
                    </div>
                  </div>

                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <button
                      disabled={pwSaving || !pwForm.password || !pwForm.confirm}
                      onClick={async () => {
                        setPwError(null); setPwSaved(false);
                        if (pwForm.password.length < 8) { setPwError("Password must be at least 8 characters"); return; }
                        if (pwForm.password !== pwForm.confirm) { setPwError("Passwords do not match"); return; }
                        setPwSaving(true);
                        try {
                          await vendorsApi.updatePassword(id, pwForm.password);
                          setPwSaved(true);
                          setPwForm({ password:"", confirm:"" });
                          setTimeout(() => setPwSaved(false), 3000);
                        } catch (err) {
                          setPwError(err instanceof Error ? err.message : "Failed to update password");
                        } finally { setPwSaving(false); }
                      }}
                      style={{ padding:"9px 22px", borderRadius:9, background: pwSaved ? "#22c55e" : BLUE, color:"#fff", fontWeight:700, fontSize:13.5, cursor:(pwSaving || !pwForm.password || !pwForm.confirm) ? "not-allowed" : "pointer", opacity:(pwSaving || !pwForm.password || !pwForm.confirm) ? 0.6 : 1, border:"none", fontFamily:FONT, transition:"background 0.2s" }}
                    >
                      {pwSaving ? "Updating…" : pwSaved ? "✓ Updated" : "Update Password"}
                    </button>
                    {pwSaved  && !pwError && <p style={{ fontSize:12.5, color:"#22c55e", fontWeight:600 }}>Password updated successfully.</p>}
                    {pwError  && <p style={{ fontSize:12.5, color:"#dc2626", fontWeight:600 }}>{pwError}</p>}
                  </div>
                </div>

                {/* Block / Unblock — Danger Zone */}
                <div style={{ ...CARD, padding:22, border:"1.5px solid #fecaca", background:"#fffafa" }}>
                  <p style={{ fontSize:15, fontWeight:800, color:"#b91c1c", marginBottom:4 }}>Danger Zone</p>
                  <p style={{ fontSize:12.5, color:"#94a3b8", marginBottom:16 }}>Blocking prevents this vendor from accessing the platform.</p>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#fff5f5", border:"1px solid #fecaca", borderRadius:12, padding:"14px 18px" }}>
                    <div>
                      <p style={{ fontSize:13.5, fontWeight:700, color:"#0f172a" }}>{isBlocked ? "Unblock Vendor Account" : "Block Vendor Account"}</p>
                      <p style={{ fontSize:12, color:"#94a3b8", marginTop:2 }}>Currently <strong style={{ color: isBlocked ? "#dc2626" : "#16a34a" }}>{isBlocked ? "Blocked" : "Active"}</strong></p>
                    </div>
                    <button onClick={toggleBlock} disabled={toggling} style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 18px", borderRadius:9, border:"none", background: isBlocked ? "#16a34a" : "#dc2626", color:"#fff", fontWeight:700, fontSize:13, cursor: toggling ? "wait" : "pointer", fontFamily:FONT, opacity: toggling ? 0.7 : 1 }}>
                      {toggling ? <Loader2 style={{ width:14, height:14, animation:"spin 1s linear infinite" }} /> : isBlocked ? <ShieldCheck style={{ width:14, height:14 }} /> : <ShieldOff style={{ width:14, height:14 }} />}
                      {toggling ? "Updating…" : isBlocked ? "Unblock Account" : "Block Account"}
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Document Viewer Modal ── */}
      {viewingDoc && viewingDoc.file_url && (() => {
        const storedType = detectFileType(viewingDoc.file_url);
        const apiBase    = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
        // Always proxy PDFs through the backend — avoids 401/CORS issues for
        // both legacy Cloudinary URLs and new Google Drive URLs.
        const viewerUrl  = storedType === "pdf"
          ? `${apiBase}/api/superadmin/vendors/${id}/documents/${viewingDoc.doc_type}/download`
          : viewingDoc.file_url;
        const previewLinkResolver = storedType === "pdf"
          ? () => vendorsApi.documents
              .previewLink(id, viewingDoc.doc_type)
              .then(r => r.data.url)
          : undefined;
        return (
          <DocumentViewer
            url={viewerUrl}
            fileTypeHint={storedType}
            fileName={DOCS.find(d => d.key === viewingDoc.doc_type)?.label ?? viewingDoc.doc_type}
            onClose={() => setViewingDoc(null)}
            previewLinkResolver={previewLinkResolver}
          />
        );
      })()}

      {/* ── Recharge Modal ── */}
      {rechargeOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={() => { if (!recharging) { setRechargeOpen(false); setRechargeAmt(""); setRechargeErr(""); } }}>
          <div style={{ background:"#fff", borderRadius:18, padding:28, width:380, boxShadow:"0 24px 64px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
              <div>
                <p style={{ fontSize:15, fontWeight:800, color:"#0f172a" }}>Recharge Wallet</p>
                <p style={{ fontSize:12, color:"#94a3b8", marginTop:1 }}>Current balance: {fmtCurrency(vendor?.wallet_balance ?? 0)}</p>
              </div>
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:12, fontWeight:700, color:"#475569", display:"block", marginBottom:6 }}>Amount (₹)</label>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"#475569", fontWeight:600 }}>₹</span>
                <input autoFocus type="number" min="1" placeholder="0" value={rechargeAmt} onChange={e => { setRechargeAmt(e.target.value); setRechargeErr(""); }} onKeyDown={e => { if (e.key === "Enter") handleRecharge(); if (e.key === "Escape" && !recharging) { setRechargeOpen(false); setRechargeAmt(""); setRechargeErr(""); } }} disabled={recharging} style={{ width:"100%", padding:"10px 14px 10px 30px", border:`1.5px solid ${rechargeErr ? "#fca5a5" : "#e2e8f0"}`, borderRadius:10, fontSize:15, fontFamily:FONT, color:"#0f172a", background:"#f8fafc", outline:"none", boxSizing:"border-box" as const, opacity: recharging ? 0.6 : 1 }} />
              </div>
              {rechargeErr && <p style={{ fontSize:11.5, color:"#ef4444", marginTop:5 }}>{rechargeErr}</p>}
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              {[500,1000,2000,5000].map(amt => (
                <button key={amt} type="button" disabled={recharging} onClick={() => { setRechargeAmt(String(amt)); setRechargeErr(""); }} style={{ flex:1, padding:"6px 0", borderRadius:8, border: rechargeAmt === String(amt) ? `1.5px solid ${BLUE}` : "1.5px solid #e2e8f0", background: rechargeAmt === String(amt) ? "#eff6ff" : "#fff", color: rechargeAmt === String(amt) ? BLUE : "#475569", fontSize:12, fontWeight:700, cursor: recharging ? "not-allowed" : "pointer", fontFamily:FONT }}>
                  +{amt >= 1000 ? `${amt/1000}k` : amt}
                </button>
              ))}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={handleRecharge} disabled={recharging} style={{ flex:1, padding:"11px 0", borderRadius:10, border:"none", background:BLUE, color:"#fff", fontWeight:700, fontSize:14, cursor: recharging ? "not-allowed" : "pointer", fontFamily:FONT, display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity: recharging ? 0.8 : 1 }}>
                {recharging && <Loader2 style={{ width:15, height:15, animation:"spin 1s linear infinite" }} />}
                {recharging ? "Opening Razorpay…" : "Pay via Razorpay"}
              </button>
              <button onClick={() => { setRechargeOpen(false); setRechargeAmt(""); setRechargeErr(""); }} disabled={recharging} style={{ padding:"11px 18px", borderRadius:10, border:"1.5px solid #e2e8f0", background:"#fff", color:"#475569", fontWeight:600, fontSize:14, cursor: recharging ? "not-allowed" : "pointer", fontFamily:FONT }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes skel-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}

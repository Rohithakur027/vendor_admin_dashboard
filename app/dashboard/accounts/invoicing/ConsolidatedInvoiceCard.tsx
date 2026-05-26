"use client";

import { type InvoiceDetail } from "@/lib/api";
import { formatInvoiceNumber } from "@/lib/invoice-format";

const NAVY       = "#1B2B7E";
const NAVY_LIGHT = "#EEF0FB";
const NAVY_BORDER = "#C5CBF0";

const VI = {
  short: "SK",
  name:  "SK Travels",
  line1: "#12, 3rd Cross, Koramangala, Bangalore – 560034",
  phone: "+91 98765 43210",
  email: "reservations@sktravels.com",
  gst:   "29ABCSK1234M1ZS",
  pan:   "ABCSK1234M",
  sac:   "996601",
  bank: {
    accountName: "SK Travels",
    accountNo:   "1234 5678 9012",
    bankName:    "HDFC Bank, Koramangala",
    ifsc:        "HDFC0001234",
    upi:         "sktravels@hdfcbank",
  },
};

function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtPeriod(from: string, to: string) {
  const fd = new Date(from + "T12:00:00");
  const td = new Date(to   + "T12:00:00");
  if (fd.getMonth() === td.getMonth() && fd.getFullYear() === td.getFullYear()) {
    return fd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      + " – " + td.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  return fd.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    + " – " + td.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function numWords(n: number): string {
  const O = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const T = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function h(x: number): string {
    if (!x) return "";
    if (x < 20) return O[x];
    if (x < 100) return T[~~(x/10)] + (x%10 ? " "+O[x%10] : "");
    return O[~~(x/100)] + " Hundred" + (x%100 ? " and "+h(x%100) : "");
  }
  const r = Math.floor(Math.abs(n));
  const p = Math.round((Math.abs(n)-r)*100);
  const parts: string[] = [];
  if (~~(r/10000000)) parts.push(h(~~(r/10000000))+" Crore");
  if (~~((r%10000000)/100000)) parts.push(h(~~((r%10000000)/100000))+" Lakh");
  if (~~((r%100000)/1000)) parts.push(h(~~((r%100000)/1000))+" Thousand");
  if (r%1000) parts.push(h(r%1000));
  return (parts.join(" ")||"Zero") + " Rupees" + (p ? " and "+h(p)+" Paise" : "") + " Only";
}

const label: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.08em", color: "#9CA3AF", margin: "0 0 8px",
};
const meta: React.CSSProperties = { fontSize: 12, color: "#6B7280", margin: "2px 0 0", lineHeight: 1.6 };
const pad: React.CSSProperties = { padding: "1.25rem 2rem" };
const twoCol: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #E8ECF4" };

export default function ConsolidatedInvoiceCard({ inv }: { inv: InvoiceDetail }) {
  const totalFare = inv.trips.reduce((s, t) => s + t.fare, 0);
  const cgst      = +(totalFare * 0.025).toFixed(2);
  const sgst      = +(totalFare * 0.025).toFixed(2);
  const totalDue  = +(totalFare + cgst + sgst).toFixed(2);
  const totalPax  = inv.trips.reduce((s, t) => s + (t.passengers ?? 0), 0);

  return (
    <div style={{
      background: "#fff", borderRadius: 16, border: "1px solid #E2E6F0",
      width: "100%", maxWidth: 820, overflow: "hidden",
      boxShadow: "0 4px 32px rgba(27,43,126,0.08)",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    }}>

      {/* Header */}
      <div style={{
        padding: "1.75rem 2rem", borderBottom: "1px solid #E8ECF4",
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", gap: "1rem", flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 40, height: 40, background: NAVY, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 13, fontWeight: 600, letterSpacing: 0.5, flexShrink: 0,
          }}>{VI.short}</div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: 0 }}>{VI.name}</p>
            <p style={meta}>{VI.line1}</p>
            <p style={meta}>{VI.email} · {VI.phone}</p>
            <p style={{ ...meta, fontSize: 11, color: "#9CA3AF" }}>GST: {VI.gst} · PAN: {VI.pan}</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: NAVY, margin: 0, letterSpacing: "-0.5px" }}>
            {formatInvoiceNumber(inv.invoiceNumber)}
          </p>
          <p style={meta}>Invoice date: {fmtDate(inv.issuedAt)}</p>
          <p style={meta}>Due date: {fmtDate(inv.dueDate)}</p>
          <p style={{ ...meta, fontSize: 11, color: "#9CA3AF" }}>SAC: {VI.sac}</p>
        </div>
      </div>

      {/* From / Billed To */}
      <div style={twoCol}>
        <div style={{ ...pad, borderRight: "1px solid #E8ECF4" }}>
          <p style={label}>From</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>{VI.name}</p>
          <p style={{ ...meta, lineHeight: 1.6 }}>{VI.line1}</p>
          <p style={{ ...meta, fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>{VI.gst}</p>
        </div>
        <div style={pad}>
          <p style={label}>Billed to</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>{inv.companyName}</p>
          {inv.companyAddress && (
            <p style={{ ...meta, lineHeight: 1.6, marginTop: 3 }}>{inv.companyAddress}</p>
          )}
          <p style={{ ...meta, lineHeight: 1.6 }}>
            Period: {fmtPeriod(inv.periodFrom, inv.periodTo)}
          </p>
          <p style={{ ...meta, fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
            {inv.tripCount} trip{inv.tripCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Period Banner */}
      <div style={{
        padding: "1rem 2rem", background: NAVY_LIGHT,
        borderBottom: "1px solid #E8ECF4",
        display: "flex", alignItems: "center",
        justifyContent: "space-between", flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            display: "inline-flex", alignItems: "center",
            background: NAVY_LIGHT, border: `1px solid ${NAVY_BORDER}`,
            borderRadius: 20, padding: "3px 14px",
            fontSize: 11, fontWeight: 600, color: NAVY,
          }}>Monthly Invoice</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>
            {fmtPeriod(inv.periodFrom, inv.periodTo)}
          </span>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          {[
            { label: "Total trips",      value: inv.tripCount },
            { label: "Total passengers", value: totalPax || "—" },
            { label: "Total fare",       value: fmt(totalFare) },
          ].map(({ label: lbl, value }) => (
            <div key={lbl} style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{lbl}</p>
              <p style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 700, color: NAVY }}>{value}</p>
            </div>
          ))}
        </div>
      </div>



      {/* Bank Details + Fare Summary */}
      <div style={twoCol}>
        <div style={{ ...pad, borderRight: "1px solid #E8ECF4" }}>
          <p style={label}>Bank details</p>
          {([
            ["Account name", VI.bank.accountName, false],
            ["Account no",   VI.bank.accountNo,   false],
            ["Bank",         VI.bank.bankName,     false],
            ["IFSC",         VI.bank.ifsc,         false],
            ["UPI",          VI.bank.upi,          true],
          ] as [string, string, boolean][]).map(([lbl, value, highlight], i, arr) => (
            <div key={lbl} style={{
              display: "flex", justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: i === arr.length - 1 ? "none" : "1px solid #F3F4F6",
            }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>{lbl}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: highlight ? NAVY : "#111827" }}>{value}</span>
            </div>
          ))}
          <div style={{ background: "#F8F9FE", borderRadius: 8, padding: "10px 14px", marginTop: 14 }}>
            <p style={{ margin: 0, fontSize: 11, color: "#6B7280", lineHeight: 1.6 }}>
              Please include <strong>{formatInvoiceNumber(inv.invoiceNumber)}</strong> in payment reference.<br />
              This is a computer generated invoice — no signature required.
            </p>
          </div>
        </div>

        <div style={pad}>
          <p style={label}>Fare breakdown</p>
          <div style={{
            display: "flex", justifyContent: "space-between",
            padding: "6px 0", borderBottom: "1px solid #E8ECF4", marginBottom: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
              Total fare ({inv.tripCount} trip{inv.tripCount === 1 ? "" : "s"})
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{fmt(totalFare)}</span>
          </div>
          {([
            [`CGST @ 2.5%`, cgst],
            [`SGST @ 2.5%`, sgst],
          ] as [string, number][]).map(([lbl, value]) => (
            <div key={lbl} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
              <span style={{ fontSize: 12, color: "#6B7280" }}>{lbl}</span>
              <span style={{ fontSize: 12, color: "#374151" }}>{fmt(value)}</span>
            </div>
          ))}
          <div style={{
            background: NAVY, borderRadius: 10, padding: "16px 18px", marginTop: 14,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>Total due</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: "#fff", letterSpacing: "-0.5px" }}>
              {fmt(totalDue)}
            </span>
          </div>
          <p style={{ fontSize: 10, color: "#9CA3AF", margin: "8px 0 0", lineHeight: 1.5, fontStyle: "italic" }}>
            In words: {numWords(totalDue)}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: "0.875rem 2rem", display: "flex",
        justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 8, borderTop: "1px solid #E8ECF4",
      }}>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>
          {formatInvoiceNumber(inv.invoiceNumber)} · {fmtPeriod(inv.periodFrom, inv.periodTo)} · {VI.name}
        </span>
        <span style={{ fontSize: 11, color: "#9CA3AF" }}>Due {fmtDate(inv.dueDate)}</span>
      </div>
    </div>
  );
}

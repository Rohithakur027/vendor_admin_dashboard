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

export default function ConsolidatedInvoiceCard({ inv }: { inv: InvoiceDetail }) {
  const totalFare = inv.trips.reduce((s, t) => s + t.fare, 0);
  const cgst      = +(totalFare * 0.025).toFixed(2);
  const sgst      = +(totalFare * 0.025).toFixed(2);
  const totalDue  = +(totalFare + cgst + sgst).toFixed(2);
  const totalPax  = inv.trips.reduce((s, t) => s + (t.passengers ?? 0), 0);

  return (
    <div
      className="bg-white rounded-2xl border border-[#E2E6F0] w-full max-w-[820px] overflow-hidden shadow-[0_4px_32px_rgba(27,43,126,0.08)]"
      style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}
    >

      {/* Header */}
      <div className="px-8 py-7 border-b border-[#E8ECF4] flex justify-between items-start gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white text-[13px] font-semibold tracking-[0.5px] shrink-0"
            style={{ background: NAVY }}
          >{VI.short}</div>
          <div>
            <p className="text-[18px] font-semibold text-[#111827] m-0">{VI.name}</p>
            <p className="text-[12px] text-[#6B7280] mt-0.5 leading-relaxed">{VI.line1}</p>
            <p className="text-[12px] text-[#6B7280] mt-0.5 leading-relaxed">{VI.email} · {VI.phone}</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-relaxed">GST: {VI.gst} · PAN: {VI.pan}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-bold m-0 tracking-[-0.5px]" style={{ color: NAVY }}>
            {formatInvoiceNumber(inv.invoiceNumber)}
          </p>
          <p className="text-[12px] text-[#6B7280] mt-0.5 leading-relaxed">Invoice date: {fmtDate(inv.issuedAt)}</p>
          <p className="text-[12px] text-[#6B7280] mt-0.5 leading-relaxed">Due date: {fmtDate(inv.dueDate)}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-relaxed">SAC: {VI.sac}</p>
        </div>
      </div>

      {/* From / Billed To */}
      <div className="grid grid-cols-2 border-b border-[#E8ECF4]">
        <div className="px-8 py-5 border-r border-[#E8ECF4]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">From</p>
          <p className="text-[13px] font-semibold text-[#111827] m-0">{VI.name}</p>
          <p className="text-[12px] text-[#6B7280] mt-0.5 leading-relaxed">{VI.line1}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-1 leading-relaxed">{VI.gst}</p>
        </div>
        <div className="px-8 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">Billed to</p>
          <p className="text-[13px] font-semibold text-[#111827] m-0">{inv.companyName}</p>
          {inv.companyAddress && (
            <p className="text-[12px] text-[#6B7280] mt-[3px] leading-relaxed">{inv.companyAddress}</p>
          )}
          <p className="text-[12px] text-[#6B7280] mt-0.5 leading-relaxed">
            Period: {fmtPeriod(inv.periodFrom, inv.periodTo)}
          </p>
          <p className="text-[11px] text-[#9CA3AF] mt-1 leading-relaxed">
            {inv.tripCount} trip{inv.tripCount === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Period Banner */}
      <div
        className="px-8 py-4 border-b border-[#E8ECF4] flex items-center justify-between flex-wrap gap-2"
        style={{ background: NAVY_LIGHT }}
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center rounded-[20px] px-[14px] py-[3px] text-[11px] font-semibold border"
            style={{ background: NAVY_LIGHT, borderColor: NAVY_BORDER, color: NAVY }}
          >Monthly Invoice</span>
          <span className="text-[13px] font-semibold" style={{ color: NAVY }}>
            {fmtPeriod(inv.periodFrom, inv.periodTo)}
          </span>
        </div>
        <div className="flex gap-6">
          {[
            { label: "Total trips",      value: inv.tripCount },
            { label: "Total passengers", value: totalPax || "—" },
            { label: "Total fare",       value: fmt(totalFare) },
          ].map(({ label: lbl, value }) => (
            <div key={lbl} className="text-center">
              <p className="m-0 text-[10px] text-[#6B7280] uppercase tracking-[0.06em]">{lbl}</p>
              <p className="mt-0.5 mb-0 text-[18px] font-bold" style={{ color: NAVY }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bank Details + Fare Summary */}
      <div className="grid grid-cols-2 border-b border-[#E8ECF4]">
        <div className="px-8 py-5 border-r border-[#E8ECF4]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">Bank details</p>
          {([
            ["Account name", VI.bank.accountName, false],
            ["Account no",   VI.bank.accountNo,   false],
            ["Bank",         VI.bank.bankName,     false],
            ["IFSC",         VI.bank.ifsc,         false],
            ["UPI",          VI.bank.upi,          true],
          ] as [string, string, boolean][]).map(([lbl, value, highlight], i, arr) => (
            <div key={lbl} className={`flex justify-between py-1.5 ${i === arr.length - 1 ? "" : "border-b border-[#F3F4F6]"}`}>
              <span className="text-[12px] text-[#6B7280]">{lbl}</span>
              <span className="text-[12px] font-semibold" style={{ color: highlight ? NAVY : "#111827" }}>{value}</span>
            </div>
          ))}
          <div className="bg-[#F8F9FE] rounded-lg px-[14px] py-[10px] mt-[14px]">
            <p className="m-0 text-[11px] text-[#6B7280] leading-relaxed">
              Please include <strong>{formatInvoiceNumber(inv.invoiceNumber)}</strong> in payment reference.<br />
              This is a computer generated invoice — no signature required.
            </p>
          </div>
        </div>

        <div className="px-8 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9CA3AF] mb-2">Fare breakdown</p>
          <div className="flex justify-between py-1.5 border-b border-[#E8ECF4] mb-2">
            <span className="text-[12px] font-semibold text-[#374151]">
              Total fare ({inv.tripCount} trip{inv.tripCount === 1 ? "" : "s"})
            </span>
            <span className="text-[12px] font-bold text-[#111827]">{fmt(totalFare)}</span>
          </div>
          {([
            [`CGST @ 2.5%`, cgst],
            [`SGST @ 2.5%`, sgst],
          ] as [string, number][]).map(([lbl, value]) => (
            <div key={lbl} className="flex justify-between py-1.5">
              <span className="text-[12px] text-[#6B7280]">{lbl}</span>
              <span className="text-[12px] text-[#374151]">{fmt(value)}</span>
            </div>
          ))}
          <div
            className="rounded-[10px] px-[18px] py-4 mt-[14px] flex justify-between items-center"
            style={{ background: NAVY }}
          >
            <span className="text-[13px] text-white/70">Total due</span>
            <span className="text-[24px] font-bold text-white tracking-[-0.5px]">
              {fmt(totalDue)}
            </span>
          </div>
          <p className="text-[10px] text-[#9CA3AF] mt-2 mb-0 leading-[1.5] italic">
            In words: {numWords(totalDue)}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-3.5 flex justify-between items-center flex-wrap gap-2">
        <span className="text-[11px] text-[#9CA3AF]">
          {formatInvoiceNumber(inv.invoiceNumber)} · {fmtPeriod(inv.periodFrom, inv.periodTo)} · {VI.name}
        </span>
        <span className="text-[11px] text-[#9CA3AF]">Due {fmtDate(inv.dueDate)}</span>
      </div>
    </div>
  );
}

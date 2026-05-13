"use client";

import { Download } from "lucide-react";

interface ExportButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function ExportButton({ onClick, disabled, label = "Export CSV", className }: ExportButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 h-[42px] px-4 bg-white border border-slate-200 rounded-xl text-[13px] text-slate-600 font-semibold hover:border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0${className ? ` ${className}` : ""}`}
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

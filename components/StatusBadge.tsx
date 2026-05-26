"use client";

export interface StatusStyle {
  bg: string;
  text: string;
  dot: string;
  border: string;
  label?: string;
}

/** Single source of truth for every status badge in the app. */
export const STATUS_STYLES: Record<string, StatusStyle> = {
  // ── Pending / awaiting action (amber) ─────────────────────────────────────
  Pending:          { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B", border: "#FDE68A" },
  Scheduled:        { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B", border: "#FDE68A" },

  // ── Positive / approved / done (green) ────────────────────────────────────
  Approved:         { bg: "#DCFCE7", text: "#15803D", dot: "#22C55E", border: "#BBF7D0" },
  Completed:        { bg: "#DCFCE7", text: "#15803D", dot: "#22C55E", border: "#BBF7D0" },
  Available:        { bg: "#DCFCE7", text: "#15803D", dot: "#22C55E", border: "#BBF7D0" },
  Online:           { bg: "#DCFCE7", text: "#15803D", dot: "#22C55E", border: "#BBF7D0" },
  Active:           { bg: "#DCFCE7", text: "#15803D", dot: "#22C55E", border: "#BBF7D0" },
  Verified:         { bg: "#DCFCE7", text: "#15803D", dot: "#22C55E", border: "#BBF7D0" },

  // ── In progress / blue ────────────────────────────────────────────────────
  Ongoing:          { bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6", border: "#BFDBFE" },
  "On Trip":        { bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6", border: "#BFDBFE" },
  Partial:          { bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6", border: "#BFDBFE", label: "In Review" },
  "In Review":      { bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6", border: "#BFDBFE" },
  Instant:          { bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6", border: "#BFDBFE" },

  // ── Negative / rejected / cancelled (red) ─────────────────────────────────
  Rejected:         { bg: "#FEE2E2", text: "#B91C1C", dot: "#EF4444", border: "#FECACA" },
  Cancelled:        { bg: "#FEE2E2", text: "#B91C1C", dot: "#EF4444", border: "#FECACA" },

  // ── Neutral / gray ────────────────────────────────────────────────────────
  Offline:          { bg: "#F1F5F9", text: "#64748B", dot: "#94A3B8", border: "#E2E8F0" },
  Inactive:         { bg: "#F1F5F9", text: "#64748B", dot: "#94A3B8", border: "#E2E8F0" },
  "Not Submitted":  { bg: "transparent", text: "#CBD5E1", dot: "#CBD5E1", border: "transparent" },
  "Not Uploaded":   { bg: "transparent", text: "#CBD5E1", dot: "#CBD5E1", border: "transparent" },
};

const FALLBACK: StatusStyle = { bg: "#F1F5F9", text: "#64748B", dot: "#94A3B8", border: "#E2E8F0" };

export function getStatusStyle(status: string): StatusStyle {
  return STATUS_STYLES[status] ?? FALLBACK;
}

interface StatusBadgeProps {
  status: string;
  /** Override the display label */
  label?: string;
  /** sm = compact (tables), md = default */
  size?: "sm" | "md";
  showDot?: boolean;
}

export function StatusBadge({ status, label, size = "md", showDot = true }: StatusBadgeProps) {
  const s = STATUS_STYLES[status] ?? FALLBACK;
  const displayLabel = label ?? s.label ?? status;
  const fontSize = size === "sm" ? 11 : 11.5;
  const padding  = size === "sm" ? "3px 10px" : "4px 11px";

  return (
    <span style={{
      background: s.bg,
      color: s.text,
      fontSize,
      fontWeight: 700,
      padding,
      borderRadius: 20,
      border: `1px solid ${s.border}`,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      whiteSpace: "nowrap" as const,
    }}>
      {showDot && (
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      )}
      {displayLabel}
    </span>
  );
}

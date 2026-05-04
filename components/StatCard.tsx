import { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StatCardProps {
  title: string;
  value: number | string;
  icon?: LucideIcon;
  description?: string;
  color?: "blue" | "green" | "yellow" | "red";
  progress?: {
    used: number;
    total: number;
    usedLabel: string;
    totalLabel: string;
  };
  loading?: boolean;
}

export function StatCard({ title, value, icon: Icon, description, progress, loading }: StatCardProps) {
  const pct = progress ? Math.min((progress.used / progress.total) * 100, 100) : 0;

  if (progress) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #1e40af 0%, #2563EB 60%, #3b82f6 100%)",
          borderRadius: 18,
          padding: "22px 22px 20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: 130,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: -20, right: -20, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
        <div style={{ position: "absolute", bottom: -30, right: 20, width: 70, height: 70, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />

        <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
          {title}
        </div>
        {loading ? (
          <Skeleton className="h-9 w-28 mb-3 bg-white/25" />
        ) : (
          <div style={{ fontSize: 38, fontWeight: 800, color: "#fff", lineHeight: 1.1, marginBottom: 12, letterSpacing: -1 }}>
            {value}
          </div>
        )}
        <div />
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 18,
        border: "1.5px solid #E8EEF4",
        padding: "22px 22px 20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minHeight: 130,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.8 }}>
          {title}
        </div>
        {Icon && (
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={17} color="#0F172A" strokeWidth={1.8} />
          </div>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-12 w-24 mt-2" />
      ) : (
        <div style={{ fontSize: 48, fontWeight: 800, color: "#0F172A", lineHeight: 1, marginTop: 8, letterSpacing: -2 }}>
          {value}
        </div>
      )}
      {description && (
        loading ? (
          <Skeleton className="h-3 w-32 mt-2" />
        ) : (
          <div style={{ fontSize: 12.5, color: "#94A3B8", marginTop: 8, fontWeight: 500 }}>
            {description}
          </div>
        )
      )}
    </div>
  );
}

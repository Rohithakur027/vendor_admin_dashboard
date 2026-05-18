import { PermissionGate } from "@/components/PermissionGate";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate module="REPORT_MONITORING">{children}</PermissionGate>;
}

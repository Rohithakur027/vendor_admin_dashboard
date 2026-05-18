import { PermissionGate } from "@/components/PermissionGate";

export default function SuperadminReportsLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate module="REPORTS_MANAGEMENT">{children}</PermissionGate>;
}

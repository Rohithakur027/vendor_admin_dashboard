import { PermissionGate } from "@/components/PermissionGate";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate module="TRIP_MONITORING">{children}</PermissionGate>;
}

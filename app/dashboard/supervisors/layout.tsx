import { PermissionGate } from "@/components/PermissionGate";

export default function SupervisorsLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate module="SUPERVISOR_MANAGEMENT">{children}</PermissionGate>;
}

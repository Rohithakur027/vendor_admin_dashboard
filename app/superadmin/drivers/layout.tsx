import { PermissionGate } from "@/components/PermissionGate";

export default function DriversLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate module="DRIVER_MANAGEMENT">{children}</PermissionGate>;
}

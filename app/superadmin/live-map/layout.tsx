import { PermissionGate } from "@/components/PermissionGate";

export default function LiveMapLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate module="TRIP_MONITORING">{children}</PermissionGate>;
}

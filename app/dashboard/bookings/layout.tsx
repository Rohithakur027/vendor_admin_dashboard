import { PermissionGate } from "@/components/PermissionGate";

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate module="TRIP_MANAGEMENT">{children}</PermissionGate>;
}

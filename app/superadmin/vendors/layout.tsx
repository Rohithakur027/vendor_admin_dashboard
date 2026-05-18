import { PermissionGate } from "@/components/PermissionGate";

export default function VendorsLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate module="VENDOR_MANAGEMENT">{children}</PermissionGate>;
}

import { PermissionGate } from "@/components/PermissionGate";

export default function AccountsLayout({ children }: { children: React.ReactNode }) {
  return <PermissionGate module="INVOICING_MONITORING">{children}</PermissionGate>;
}

import { AdminOnlyGate } from "@/components/PermissionGate";

export default function SuperadminSettingsLayout({ children }: { children: React.ReactNode }) {
  return <AdminOnlyGate>{children}</AdminOnlyGate>;
}

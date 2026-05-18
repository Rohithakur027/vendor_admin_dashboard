import { AdminOnlyGate } from "@/components/PermissionGate";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <AdminOnlyGate>{children}</AdminOnlyGate>;
}

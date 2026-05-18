"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  VENDOR_PERMISSION_KEYS,
  SUPERADMIN_PERMISSION_KEYS,
  defaultLandingPath,
  hasModuleAccess,
  labelForKey,
  type PermissionKey,
} from "@/lib/permissions";
import { Button } from "@/components/ui/button";

const FONT = "var(--font-plus-jakarta-sans),'Plus Jakarta Sans',sans-serif";

type VendorModule     = keyof typeof VENDOR_PERMISSION_KEYS;
type SuperadminModule = keyof typeof SUPERADMIN_PERMISSION_KEYS;
type ModuleName       = VendorModule | SuperadminModule;

function resolveKey(name: ModuleName): PermissionKey {
  if (name in VENDOR_PERMISSION_KEYS) {
    return VENDOR_PERMISSION_KEYS[name as VendorModule];
  }
  return SUPERADMIN_PERMISSION_KEYS[name as SuperadminModule];
}

const MEMBER_ROLES = new Set(["vendor_member", "superadmin_member"]);

export function NoAccessCard({ moduleKey }: { moduleKey?: PermissionKey }) {
  const { user } = useAuth();
  const landingPath = defaultLandingPath(user?.role, user?.permissions);
  const label = moduleKey ? labelForKey(moduleKey) : "this tab";
  const homeLabel = user?.role === "superadmin_member" ? "Go to Overview" : "Go to Dashboard";

  return (
    <div
      style={{ fontFamily: FONT }}
      className="flex items-center justify-center min-h-[60vh] px-4"
    >
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm max-w-md w-full p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 mx-auto flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-slate-400" />
        </div>
        <h2 className="text-[16px] font-bold text-slate-800">
          You don&apos;t have access to {label}
        </h2>
        <p className="text-[13px] text-slate-500 mt-1.5">
          Ask your administrator to enable this module for your account.
        </p>
        <Link href={landingPath}>
          <Button className="mt-6 bg-blue-600 hover:bg-blue-700 rounded-xl h-10 px-6 text-[13px] font-semibold">
            {homeLabel}
          </Button>
        </Link>
      </div>
    </div>
  );
}

/**
 * Renders `children` only if the current user can access the named module.
 * Admins (vendor / superadmin) bypass the check; members must have the
 * matching permission entry. Use this in per-route layouts to gate a tab.
 */
export function PermissionGate({
  module,
  children,
}: {
  module: ModuleName;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const key = resolveKey(module);

  if (!user) return null;
  if (!MEMBER_ROLES.has(user.role)) return <>{children}</>;
  if (hasModuleAccess(user.permissions, key)) return <>{children}</>;
  return <NoAccessCard moduleKey={key} />;
}

/**
 * Gates a route that only an admin role should ever see — e.g. /dashboard/settings
 * or /superadmin/settings (team management). A member visiting via URL gets the
 * NoAccess card.
 */
export function AdminOnlyGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (MEMBER_ROLES.has(user.role)) return <NoAccessCard />;
  return <>{children}</>;
}

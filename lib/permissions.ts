// Permission module keys — keep in sync with backend and with the choices in
// the Add Team Member dialogs. The vendor side and superadmin side use disjoint
// key sets, but the gating logic is identical.

export const VENDOR_PERMISSION_KEYS = {
  TRIP_MANAGEMENT:       "trip_management",
  REPORT_MONITORING:     "report_monitoring",
  INVOICING_MONITORING:  "invoicing_monitoring",
  SUPERVISOR_MANAGEMENT: "supervisor_management",
} as const;

export const SUPERADMIN_PERMISSION_KEYS = {
  VENDOR_MANAGEMENT:  "vendor_management",
  DRIVER_MANAGEMENT:  "driver_management",
  TRIP_MONITORING:    "trip_monitoring",
  REPORTS_MANAGEMENT: "reports_management",
} as const;

// Back-compat alias for callers that imported the vendor map under the old name.
export const PERMISSION_KEYS = VENDOR_PERMISSION_KEYS;

export type VendorPermissionKey     = (typeof VENDOR_PERMISSION_KEYS)[keyof typeof VENDOR_PERMISSION_KEYS];
export type SuperadminPermissionKey = (typeof SUPERADMIN_PERMISSION_KEYS)[keyof typeof SUPERADMIN_PERMISSION_KEYS];
export type PermissionKey           = VendorPermissionKey | SuperadminPermissionKey;

export interface ModuleDef {
  key:    PermissionKey;
  label:  string;
  // Paths the module governs. Matches use startsWith().
  paths:  string[];
  // Primary landing path when redirecting a member to this module.
  home:   string;
}

// ── Vendor-side modules (paths under /dashboard) ──────────────────────────────

export const VENDOR_MODULES: ModuleDef[] = [
  {
    key:   VENDOR_PERMISSION_KEYS.TRIP_MANAGEMENT,
    label: "Trip Management",
    paths: ["/dashboard/bookings"],
    home:  "/dashboard/bookings/active",
  },
  {
    key:   VENDOR_PERMISSION_KEYS.REPORT_MONITORING,
    label: "Report Monitoring",
    paths: ["/dashboard/reports"],
    home:  "/dashboard/reports",
  },
  {
    key:   VENDOR_PERMISSION_KEYS.INVOICING_MONITORING,
    label: "Invoicing Monitoring",
    paths: ["/dashboard/accounts"],
    home:  "/dashboard/accounts/invoicing",
  },
  {
    key:   VENDOR_PERMISSION_KEYS.SUPERVISOR_MANAGEMENT,
    label: "Supervisor Management",
    paths: ["/dashboard/supervisors"],
    home:  "/dashboard/supervisors",
  },
];

// Back-compat alias.
export const PERMISSION_MODULES = VENDOR_MODULES;

// ── Superadmin-side modules (paths under /superadmin) ─────────────────────────

export const SUPERADMIN_MODULES: ModuleDef[] = [
  {
    key:   SUPERADMIN_PERMISSION_KEYS.VENDOR_MANAGEMENT,
    label: "Vendor Management",
    paths: ["/superadmin/vendors"],
    home:  "/superadmin/vendors",
  },
  {
    key:   SUPERADMIN_PERMISSION_KEYS.DRIVER_MANAGEMENT,
    label: "Driver Management",
    paths: ["/superadmin/drivers", "/superadmin/driver-onboarding"],
    home:  "/superadmin/drivers",
  },
  {
    key:   SUPERADMIN_PERMISSION_KEYS.TRIP_MONITORING,
    label: "Trip Monitoring",
    paths: ["/superadmin/live-map", "/superadmin/booking-enquiries"],
    home:  "/superadmin/live-map",
  },
  {
    key:   SUPERADMIN_PERMISSION_KEYS.REPORTS_MANAGEMENT,
    label: "Reports Management",
    paths: ["/superadmin/reports"],
    home:  "/superadmin/reports",
  },
];

// Always-allowed exact-match paths for any authenticated member (admin or member).
const ALWAYS_ALLOWED = ["/dashboard", "/superadmin"];

// Admin-only paths — members must never see these.
const ADMIN_ONLY_PATHS = ["/dashboard/settings", "/superadmin/settings"];

// Roles whose access is governed by `permissions` (instead of free admin access).
const MEMBER_ROLES = new Set(["vendor_member", "superadmin_member"]);

// Which module set governs a given role's permissions map.
function modulesForRole(role: string): ModuleDef[] {
  if (role === "superadmin_member") return SUPERADMIN_MODULES;
  return VENDOR_MODULES;
}

export function hasModuleAccess(
  permissions: Record<string, string[]> | undefined,
  key: PermissionKey,
): boolean {
  if (!permissions) return false;
  const actions = permissions[key];
  return Array.isArray(actions) && actions.length > 0;
}

// Returns the ModuleDef governing this path, or null if it's not a gated tab.
export function moduleForPath(pathname: string, role: string): ModuleDef | null {
  for (const mod of modulesForRole(role)) {
    if (mod.paths.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
      return mod;
    }
  }
  return null;
}

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_ONLY_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

export function isAlwaysAllowedPath(pathname: string): boolean {
  return ALWAYS_ALLOWED.includes(pathname);
}

// Decides whether a user with the given role + permissions can view `pathname`.
export function canAccessPath(
  role: string,
  permissions: Record<string, string[]> | undefined,
  pathname: string,
): boolean {
  if (!MEMBER_ROLES.has(role)) return true;
  if (isAdminOnlyPath(pathname)) return false;
  if (isAlwaysAllowedPath(pathname)) return true;
  const mod = moduleForPath(pathname, role);
  if (!mod) return true; // ungated nested paths — let through
  return hasModuleAccess(permissions, mod.key);
}

// Returns the best landing path for a member: their first granted module,
// or the role's dashboard home if they have no module access.
export function defaultLandingPath(
  role: string | undefined,
  permissions: Record<string, string[]> | undefined,
): string {
  if (role === "superadmin_member") {
    for (const mod of SUPERADMIN_MODULES) {
      if (hasModuleAccess(permissions, mod.key)) return mod.home;
    }
    return "/superadmin";
  }
  // vendor_member (and default fallback)
  for (const mod of VENDOR_MODULES) {
    if (hasModuleAccess(permissions, mod.key)) return mod.home;
  }
  return "/dashboard";
}

// Resolves a module label by key across both module sets — used by NoAccessCard.
export function labelForKey(key: PermissionKey): string {
  return [...VENDOR_MODULES, ...SUPERADMIN_MODULES].find(m => m.key === key)?.label
    ?? "this section";
}

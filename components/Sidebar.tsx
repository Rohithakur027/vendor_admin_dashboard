"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  User,
  Route,
  Truck,
  BarChart2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings,
  LogOut,
} from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { PERMISSION_KEYS, hasModuleAccess } from "@/lib/permissions";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type SubItem = { label: string; href: string; reportType?: "supervisor" | "company" };

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  subItems?: SubItem[];
  // null = always shown; otherwise hidden for vendor_member without this permission.
  permission?: keyof typeof PERMISSION_KEYS | null;
  // true = hidden from vendor_member entirely (e.g. team management).
  adminOnly?: boolean;
};

const ALL_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",   href: "/dashboard",               icon: LayoutGrid, permission: null },
  { label: "Supervisors", href: "/dashboard/supervisors",    icon: User,       permission: "SUPERVISOR_MANAGEMENT" },
  {
    label: "Trips",
    href: "/dashboard/bookings",
    icon: Route,
    permission: "TRIP_MANAGEMENT",
    subItems: [
      { label: "Active Trips",    href: "/dashboard/bookings/active" },
      { label: "Past Trips",      href: "/dashboard/bookings/past" },
      { label: "Scheduled Trips", href: "/dashboard/bookings/scheduled" },
    ],
  },
  {
    label: "Reports",
    href: "/dashboard/reports?type=supervisor",
    icon: BarChart2,
    permission: "REPORT_MONITORING",
    subItems: [
      { label: "Supervisor Report", href: "/dashboard/reports?type=supervisor", reportType: "supervisor" },
      { label: "Company Report",    href: "/dashboard/reports?type=company",    reportType: "company" },
    ],
  },
  { label: "Settings",  href: "/dashboard/settings",           icon: Settings,  permission: null, adminOnly: true },
];

function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/nav">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-[9999] opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-slate-800" />
        <div className="bg-slate-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-lg tracking-wide">
          {label}
        </div>
      </div>
    </div>
  );
}

export function Sidebar({
  mobileOpen,
  onMobileOpenChange,
}: {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const brandName    = "SK Voyages";
  const vendorName   = user?.vendor_name?.trim() || brandName;
  const displayName  = user?.full_name?.trim() || vendorName;
  const isMember     = user?.role === "vendor_member";
  const roleLabel    = isMember ? (user?.role_label?.trim() || "Team Member") : "Vendor Admin";
  const initials     = getInitials(isMember ? displayName : vendorName);

  const navItems = useMemo<NavItem[]>(() => {
    if (!isMember) return ALL_NAV_ITEMS;
    return ALL_NAV_ITEMS.filter(item => {
      if (item.adminOnly) return false;
      if (item.permission == null) return true;
      return hasModuleAccess(user?.permissions, PERMISSION_KEYS[item.permission]);
    });
  }, [isMember, user?.permissions]);

  const [collapsed, setCollapsed] = useState(false);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const tabletTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    ALL_NAV_ITEMS.forEach(item => {
      if (item.subItems) init[item.href] = pathname.startsWith(item.href.split("?")[0]);
    });
    return init;
  });

  function toggleExpanded(href: string) {
    setExpanded(prev => ({ ...prev, [href]: !prev[href] }));
  }

  function handleTabletEnter() {
    if (tabletTimer.current) clearTimeout(tabletTimer.current);
    setTabletExpanded(true);
  }

  function handleTabletLeave() {
    tabletTimer.current = setTimeout(() => setTabletExpanded(false), 200);
  }

  const SidebarContent = ({
    isCollapsed = false,
    onLinkClick,
  }: {
    isCollapsed?: boolean;
    onLinkClick?: () => void;
  }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("border-b flex items-center", isCollapsed ? "px-3 py-5 justify-center" : "px-6 py-5")}>
        {isCollapsed ? (
          <div className="bg-blue-600 p-2 rounded-lg">
            <Truck className="h-5 w-5 text-white" />
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-blue-600 p-2 rounded-lg shrink-0">
              <Truck className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-none truncate">{brandName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Vendor Dashboard</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 py-4 space-y-1", isCollapsed ? "px-2 overflow-visible" : "px-3 overflow-y-auto")}>
        {navItems.map(({ label, href, icon: Icon, subItems }) => {
          const baseHref = href.split("?")[0];
          // Settings has a sibling /dashboard/profile route that should also
          // show as active; everything else is exact-match unless it has sub-items.
          const isSettings = baseHref === "/dashboard/settings";
          const active = subItems
            ? pathname.startsWith(baseHref)
            : isSettings
              ? pathname.startsWith("/dashboard/settings") || pathname.startsWith("/dashboard/profile")
              : pathname === baseHref;

          if (subItems) {
            const isExpanded = !!expanded[href];
            const btn = (
              <button
                onClick={() => !isCollapsed && toggleExpanded(href)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg text-sm transition-colors",
                  isCollapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5",
                  active
                    ? "bg-blue-50/70 text-blue-600 font-medium"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!isCollapsed && (
                  <>
                    {label}
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 ml-auto transition-transform duration-200",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </>
                )}
              </button>
            );

            return (
              <div key={href}>
                {isCollapsed ? <NavTooltip label={label}>{btn}</NavTooltip> : btn}
                {!isCollapsed && isExpanded && (
                  <div className="mt-1 flex flex-col space-y-0.5">
                    {subItems.map((sub) => {
                      const subBaseHref = sub.href.split("?")[0];
                      const reportType = searchParams.get("type") === "company" ? "company" : "supervisor";
                      const isSubActive = sub.reportType
                        ? pathname === subBaseHref && sub.reportType === reportType
                        : pathname === subBaseHref;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={onLinkClick}
                          className={cn(
                            "flex items-center px-4 py-2 transition-colors text-[13px] ml-9 mr-4",
                            isSubActive
                              ? "text-blue-600 font-medium bg-blue-50/70 rounded-lg"
                              : "text-slate-500 hover:text-slate-800 rounded-lg"
                          )}
                        >
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={href}>
              {isCollapsed ? (
                <NavTooltip label={label}>
                  <Link
                    href={href}
                    onClick={onLinkClick}
                    className={cn(
                      "flex items-center gap-3 rounded-lg text-sm transition-colors",
                      "px-0 py-2.5 justify-center",
                      active
                        ? "bg-blue-50/70 text-blue-600 font-medium"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                  </Link>
                </NavTooltip>
              ) : (
                <Link
                  href={href}
                  onClick={onLinkClick}
                  className={cn(
                    "flex items-center gap-3 rounded-lg text-sm transition-colors",
                    "px-3 py-2.5",
                    active
                      ? "bg-blue-50/70 text-blue-600 font-medium"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sign out — pinned above the user profile, red accent */}
      <div className={cn("border-t shrink-0", isCollapsed ? "px-2 py-2" : "px-3 py-2")}>
        {(() => {
          const btnClass = cn(
            "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors text-red-600 hover:bg-red-50 hover:text-red-700",
            isCollapsed ? "px-0 py-2.5 justify-center w-full" : "px-3 py-2.5 w-full"
          );
          const btn = (
            <button onClick={logout} className={btnClass}>
              <LogOut className="h-4 w-4 shrink-0" />
              {!isCollapsed && "Sign out"}
            </button>
          );
          return isCollapsed ? <NavTooltip label="Sign out">{btn}</NavTooltip> : btn;
        })()}
      </div>

      {/* User profile — bottom */}
      <div className={cn("border-t shrink-0", isCollapsed ? "px-3 py-4 flex justify-center" : "px-4 py-4")}>
        {isCollapsed ? (
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 leading-none truncate">
                {isMember ? displayName : vendorName}
              </p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{roleLabel}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar (xl+): full width, user-collapsible ── */}
      <aside
        className={cn(
          "hidden xl:flex flex-col border-r bg-white h-screen sticky top-0 shrink-0 transition-all duration-300 relative z-[200]",
          collapsed ? "w-[60px]" : "w-56"
        )}
      >
        <SidebarContent isCollapsed={collapsed} />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-[72px] h-6 w-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-colors z-10"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>

      {/* ── Tablet sidebar (md–xl): icon-only strip, hover expands as overlay ── */}
      <aside
        className="hidden md:flex xl:hidden w-[60px] shrink-0 sticky top-0 h-screen relative z-[60]"
        onMouseEnter={handleTabletEnter}
        onMouseLeave={handleTabletLeave}
      >
        {/* Always-visible 60px icon strip */}
        <div className="w-[60px] h-full flex flex-col bg-white border-r">
          <SidebarContent isCollapsed={true} />
        </div>

        {/* Expanded overlay on hover */}
        {tabletExpanded && (
          <div
            className="absolute left-0 top-0 h-full w-56 bg-white border-r shadow-xl z-30 flex flex-col"
            onMouseEnter={handleTabletEnter}
            onMouseLeave={handleTabletLeave}
          >
            <SidebarContent
              isCollapsed={false}
              onLinkClick={() => setTabletExpanded(false)}
            />
          </div>
        )}
      </aside>

      {/* ── Mobile drawer (< md): full-width slide-in from left ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-56 bg-white border-r h-full shadow-xl flex flex-col">
            <SidebarContent onLinkClick={() => onMobileOpenChange(false)} />
          </div>
          <div
            className="flex-1 bg-black/40"
            onClick={() => onMobileOpenChange(false)}
          />
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutGrid, Building2, Users, Shield, ClipboardCheck, BarChart2, MapPin,
  ChevronLeft, ChevronRight, UserCog, MessageSquare, LogOut, FileText,
} from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { SUPERADMIN_PERMISSION_KEYS, hasModuleAccess } from "@/lib/permissions";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  subItems?: { label: string; href: string; reportType?: "vendor" | "driver" }[];
  // null = always shown; otherwise hidden for superadmin_member without this permission.
  permission?: keyof typeof SUPERADMIN_PERMISSION_KEYS | null;
  // true = hidden from superadmin_member entirely (e.g. team management).
  adminOnly?: boolean;
};

const ALL_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/superadmin",
    icon: LayoutGrid,
    permission: null,
    subItems: [
      { label: "Overview", href: "/superadmin" },
      { label: "New Dashboard", href: "/superadmin/dashboard/new" },
    ],
  },
  { label: "Vendors",           href: "/superadmin/vendors",           icon: Building2,     permission: "VENDOR_MANAGEMENT" },
  { label: "Live Map",          href: "/superadmin/live-map",          icon: MapPin,        permission: "TRIP_MONITORING" },
  { label: "Drivers",           href: "/superadmin/drivers",           icon: Users,         permission: "DRIVER_MANAGEMENT" },
  { label: "Driver Onboarding", href: "/superadmin/driver-onboarding", icon: ClipboardCheck, permission: "DRIVER_MANAGEMENT" },
  { label: "Booking Enquiries", href: "/superadmin/booking-enquiries", icon: MessageSquare, permission: "TRIP_MONITORING" },
  { label: "Invoices",          href: "/superadmin/invoices",          icon: FileText,      permission: "REPORTS_MANAGEMENT" },
  {
    label: "Reports",
    href: "/superadmin/reports?type=vendor",
    icon: BarChart2,
    permission: "REPORTS_MANAGEMENT",
    subItems: [
      { label: "Vendor Report", href: "/superadmin/reports?type=vendor", reportType: "vendor" },
      { label: "Driver Report", href: "/superadmin/reports?type=driver", reportType: "driver" },
    ],
  },
  { label: "User Management",   href: "/superadmin/settings",          icon: UserCog,       permission: null, adminOnly: true },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "SK";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

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

type SidebarContentProps = {
  isCollapsed?: boolean;
  onLinkClick?: () => void;
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
  navItems: NavItem[];
  initials: string;
  displayName: string;
  roleLabel: string;
  logout: () => void;
};

function SidebarContent({
  isCollapsed = false,
  onLinkClick,
  pathname,
  searchParams,
  navItems,
  initials,
  displayName,
  roleLabel,
  logout,
}: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("border-b flex items-center", isCollapsed ? "px-3 py-5 justify-center" : "px-6 py-5")}>
        {isCollapsed ? (
          <div className="bg-blue-600 p-2 rounded-lg">
            <Shield className="h-5 w-5 text-white" />
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-blue-600 p-2 rounded-lg shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-none">SK Voyages</p>
              <p className="text-xs text-muted-foreground mt-0.5">Super Admin</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 py-4 space-y-1", isCollapsed ? "px-2 overflow-visible" : "px-3 overflow-y-auto")}>
        {navItems.map(({ label, href, icon: Icon, subItems }) => {
          const baseHref = href.split("?")[0];
          const active = baseHref === "/superadmin" ? pathname === baseHref : pathname.startsWith(baseHref);
          const reportType = searchParams.get("type") === "driver" ? "driver" : "vendor";
          const link = (
            <Link
              href={href}
              onClick={onLinkClick}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm transition-colors",
                isCollapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5",
                active
                  ? "bg-blue-50/70 text-blue-600 font-medium"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && label}
            </Link>
          );

          return (
            <div key={href}>
              {isCollapsed ? <NavTooltip label={label}>{link}</NavTooltip> : link}
              {!isCollapsed && subItems && (label === "Dashboard" || active) && (
                <div className="mt-1 ml-7 space-y-1">
                  {subItems.map((sub) => {
                    const subActive = sub.reportType
                      ? pathname === "/superadmin/reports" && sub.reportType === reportType
                      : pathname === sub.href;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={onLinkClick}
                        className={cn(
                          "block rounded-md px-3 py-2 text-xs font-medium transition-colors",
                          subActive
                            ? "bg-blue-50 text-blue-600"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
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
              <p className="text-sm font-bold text-slate-800 leading-none truncate">{displayName}</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{roleLabel}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SuperAdminSidebar({
  mobileOpen,
  onMobileOpenChange,
}: {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const isMember     = user?.role === "superadmin_member";
  const brandName    = "SK Voyages";
  const displayName  = isMember ? (user?.full_name?.trim() || brandName) : brandName;
  const roleLabel    = isMember ? (user?.role_label?.trim() || "Team Member") : "Super Admin";
  const initials     = getInitials(displayName);

  const navItems = useMemo<NavItem[]>(() => {
    if (!isMember) return ALL_NAV_ITEMS;
    return ALL_NAV_ITEMS.filter(item => {
      if (item.adminOnly) return false;
      if (item.permission == null) return true;
      return hasModuleAccess(user?.permissions, SUPERADMIN_PERMISSION_KEYS[item.permission]);
    });
  }, [isMember, user?.permissions]);

  const [collapsed, setCollapsed] = useState(false);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const tabletTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTabletEnter() {
    if (tabletTimer.current) clearTimeout(tabletTimer.current);
    setTabletExpanded(true);
  }

  function handleTabletLeave() {
    tabletTimer.current = setTimeout(() => setTabletExpanded(false), 200);
  }

  return (
    <>
      {/* ── Desktop sidebar (xl+): full width, user-collapsible ── */}
      <aside
        className={cn(
          "hidden xl:flex flex-col border-r bg-white h-screen sticky top-0 shrink-0 transition-all duration-300 relative z-[60]",
          collapsed ? "w-[60px]" : "w-56"
        )}
      >
        <SidebarContent
          isCollapsed={collapsed}
          pathname={pathname}
          searchParams={searchParams}
          navItems={navItems}
          initials={initials}
          displayName={displayName}
          roleLabel={roleLabel}
          logout={logout}
        />

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
          <SidebarContent
            isCollapsed={true}
            pathname={pathname}
            searchParams={searchParams}
            navItems={navItems}
            initials={initials}
            displayName={displayName}
            roleLabel={roleLabel}
            logout={logout}
          />
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
              pathname={pathname}
              searchParams={searchParams}
              navItems={navItems}
              initials={initials}
              displayName={displayName}
              roleLabel={roleLabel}
              logout={logout}
            />
          </div>
        )}
      </aside>

      {/* ── Mobile drawer (< md): full-width slide-in from left ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-56 bg-white border-r h-full shadow-xl flex flex-col">
            <SidebarContent
              onLinkClick={() => onMobileOpenChange(false)}
              pathname={pathname}
              searchParams={searchParams}
              navItems={navItems}
              initials={initials}
              displayName={displayName}
              roleLabel={roleLabel}
              logout={logout}
            />
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

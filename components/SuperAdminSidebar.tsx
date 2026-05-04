"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Building2, Users, Shield, ClipboardCheck, BarChart2, MapPin,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string; icon: React.ElementType };

const navItems: NavItem[] = [
  { label: "Dashboard",         href: "/superadmin",                   icon: LayoutGrid },
  { label: "Vendors",           href: "/superadmin/vendors",           icon: Building2 },
  { label: "Live Map",          href: "/superadmin/live-map",          icon: MapPin },
  { label: "Drivers",           href: "/superadmin/drivers",           icon: Users },
  { label: "Driver Onboarding", href: "/superadmin/driver-onboarding", icon: ClipboardCheck },
  { label: "Reports",           href: "/superadmin/reports",           icon: BarChart2 },
];

function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/nav">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-slate-800" />
        <div className="bg-slate-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-lg tracking-wide">
          {label}
        </div>
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
            <Shield className="h-5 w-5 text-white" />
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-blue-600 p-2 rounded-lg shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-none">SK Travels</p>
              <p className="text-xs text-muted-foreground mt-0.5">Super Admin</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 py-4 space-y-1 overflow-y-auto", isCollapsed ? "px-2" : "px-3")}>
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = href === "/superadmin" ? pathname === href : pathname.startsWith(href);
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
            </div>
          );
        })}
      </nav>

      {/* User profile — bottom */}
      <div className={cn("border-t shrink-0", isCollapsed ? "px-3 py-4 flex justify-center" : "px-4 py-4")}>
        {isCollapsed ? (
          <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            SK
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              SK
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800 leading-none truncate">SK Travels</p>
              <p className="text-xs text-slate-400 mt-0.5">Super Admin</p>
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
          "hidden xl:flex flex-col border-r bg-white h-screen sticky top-0 shrink-0 transition-all duration-300 relative z-[60]",
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
        <div className="w-[60px] h-full flex flex-col bg-white border-r overflow-hidden">
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

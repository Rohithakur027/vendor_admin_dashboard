"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Building2, Users, Menu, X, Shield, ClipboardCheck,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string; icon: React.ElementType };

const navItems: NavItem[] = [
  { label: "Overview",          href: "/superadmin",                   icon: LayoutGrid },
  { label: "Vendors",           href: "/superadmin/vendors",           icon: Building2 },
  { label: "Drivers",           href: "/superadmin/drivers",           icon: Users },
  { label: "Driver Onboarding", href: "/superadmin/driver-onboarding", icon: ClipboardCheck },
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

export function SuperAdminSidebar() {
  const pathname = usePathname();
  const [open,      setOpen]      = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const SidebarContent = ({ isCollapsed = false }: { isCollapsed?: boolean }) => (
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
              onClick={() => setOpen(false)}
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
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-white h-screen sticky top-0 shrink-0 transition-all duration-300 relative",
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

      {/* Mobile hamburger */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-56 bg-white border-r h-full shadow-xl">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}

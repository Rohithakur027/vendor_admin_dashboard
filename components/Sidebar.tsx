"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  User,
  BookText,
  Menu,
  X,
  Truck,
  Wallet,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

type SubItem = { label: string; href: string };

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  subItems?: SubItem[];
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Supervisors", href: "/dashboard/supervisors", icon: User },
  {
    label: "Bookings",
    href: "/dashboard/bookings",
    icon: BookText,
    subItems: [
      { label: "Active Bookings", href: "/dashboard/bookings/active" },
      { label: "Past Bookings", href: "/dashboard/bookings/past" },
      { label: "Scheduled Bookings", href: "/dashboard/bookings/scheduled" },
    ],
  },
  { label: "Accounts", href: "/dashboard/accounts", icon: Wallet },
];

function NavTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/nav">
      {children}
      {/* Custom tooltip — replaces browser-native title attr */}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
        {/* Left arrow */}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-slate-800" />
        <div className="bg-slate-800 text-white text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-lg tracking-wide">
          {label}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [bookingsExpanded, setBookingsExpanded] = useState(
    pathname.startsWith("/dashboard/bookings")
  );

  const SidebarContent = ({ isCollapsed = false }: { isCollapsed?: boolean }) => (
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
              <p className="font-bold text-sm leading-none">SK Travels</p>
              <p className="text-xs text-muted-foreground mt-0.5">Vendor Dashboard</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn("flex-1 py-4 space-y-1 overflow-y-auto", isCollapsed ? "px-2" : "px-3")}>
        {navItems.map(({ label, href, icon: Icon, subItems }) => {
          const active = subItems ? pathname.startsWith(href) : pathname === href;

          if (subItems) {
            const btn = (
              <button
                onClick={() => !isCollapsed && setBookingsExpanded((v) => !v)}
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
                        bookingsExpanded && "rotate-180"
                      )}
                    />
                  </>
                )}
              </button>
            );

            return (
              <div key={href}>
                {isCollapsed ? <NavTooltip label={label}>{btn}</NavTooltip> : btn}
                {!isCollapsed && bookingsExpanded && (
                  <div className="mt-1 flex flex-col space-y-0.5">
                    {subItems.map((sub) => {
                      const isSubActive = pathname === sub.href;
                      return (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          onClick={() => setOpen(false)}
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
                    onClick={() => setOpen(false)}
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
                  onClick={() => setOpen(false)}
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
              <p className="text-xs text-slate-400 mt-0.5">Admin</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-white h-screen sticky top-0 shrink-0 transition-all duration-300",
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

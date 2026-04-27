"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Building2, Users, Menu, X, Shield, ClipboardCheck } from "lucide-react";
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

export function SuperAdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-none">SK Travels</p>
            <p className="text-xs text-muted-foreground mt-0.5">Super Admin</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ label, href, icon: Icon }) => {
          const active = href === "/superadmin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-blue-50/70 text-blue-600 font-medium"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex flex-col w-56 border-r bg-white h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </aside>

      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button variant="outline" size="icon" onClick={() => setOpen(!open)}>
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

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

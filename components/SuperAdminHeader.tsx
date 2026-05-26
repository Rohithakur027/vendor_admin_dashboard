"use client";

import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const pageTitles: Record<string, string> = {
  "/superadmin": "Overview",
  "/superadmin/vendors": "Vendors",
  "/superadmin/drivers": "Drivers",
  "/superadmin/settings": "User Management",
};

export function SuperAdminHeader({ onMobileMenuClick }: { onMobileMenuClick: () => void }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const title = pageTitles[pathname] ?? "Super Admin";

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-2">
        {/* Hamburger — mobile only, minimum 44×44 tap target */}
        <button
          className="md:hidden flex items-center justify-center w-11 h-11 -ml-1.5 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          onClick={onMobileMenuClick}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold">{title}</h1>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem className="gap-2">
            <User className="h-4 w-4" /> Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 text-red-600 focus:text-red-600" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

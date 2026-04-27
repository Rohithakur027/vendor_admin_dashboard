"use client";

import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/supervisors": "Supervisors",
  "/dashboard/drivers": "Drivers",
  "/dashboard/bookings": "Bookings",
  "/dashboard/bookings/active": "Active Bookings",
  "/dashboard/bookings/past": "Past Bookings",
  "/dashboard/bookings/scheduled": "Scheduled Bookings",
};

export function Header() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const title = pageTitles[pathname] ?? "Dashboard";

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0">
      <h1 className="text-base font-semibold">{title}</h1>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 outline-none">
          <span className="text-sm font-medium">SK Travels</span>
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

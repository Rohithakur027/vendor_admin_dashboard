"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { SuperAdminSidebar } from "@/components/SuperAdminSidebar";
import { SuperAdminHeader } from "@/components/SuperAdminHeader";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  // While loading with no cached session, render nothing (redirect is in flight).
  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#f1f5f9" }}>
      <SuperAdminSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <SuperAdminHeader />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

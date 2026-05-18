"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

export type UserRole = "vendor" | "vendor_member" | "superadmin" | "superadmin_member";

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  role_label: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
  supervisor_id: string | null;
  permissions: Record<string, string[]>;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<UserRole>;
  logout: () => void;
}

function toFrontendRole(backendRole: string): UserRole | null {
  if (backendRole === "superadmin")        return "superadmin";
  if (backendRole === "superadmin_member") return "superadmin_member";
  if (backendRole === "vendor_admin")      return "vendor";
  if (backendRole === "vendor_member")     return "vendor_member";
  return null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const router = useRouter();

  // On mount: restore session immediately from cache, then verify in background.
  useEffect(() => {
    const token   = sessionStorage.getItem("auth_token");
    const rawUser = sessionStorage.getItem("auth_user");

    if (!token) {
      setIsLoading(false);
      return;
    }

    // Optimistic restore — show UI instantly without waiting for the network.
    if (rawUser) {
      try {
        const stored = JSON.parse(rawUser) as AuthUser;
        setUser(stored);
        setIsAuthenticated(true);
        setIsLoading(false);
      } catch { /* ignore corrupt cache */ }
    }

    // Background verification — silently redirect to login if token is dead.
    authApi.me()
      .then((res) => {
        const role = toFrontendRole(res.data.role);
        if (!role) { clearSession(); router.replace("/login"); return; }
        // Refresh user state with latest data from server.
        const fresh: AuthUser = {
          id:            res.data.id,
          email:         res.data.email,
          full_name:     res.data.full_name,
          role,
          role_label:    res.data.role_label,
          vendor_id:     res.data.vendor_id,
          vendor_name:   res.data.vendor_name,
          supervisor_id: res.data.supervisor_id,
          permissions:   res.data.permissions ?? {},
        };
        sessionStorage.setItem("auth_user", JSON.stringify(fresh));
        setUser(fresh);
        setIsAuthenticated(true);
      })
      .catch(() => {
        clearSession();
        router.replace("/login");
      })
      .finally(() => {
        setIsLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearSession() {
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("auth_user");
    setUser(null);
    setIsAuthenticated(false);
  }

  // Throws an error with the backend message so the login page can display it.
  async function login(email: string, password: string): Promise<UserRole> {
    const res = await authApi.login(email, password); // throws on non-2xx

    const role = toFrontendRole(res.user.role);
    if (!role) throw new Error("Access not permitted for this account type.");

    const authUser: AuthUser = {
      id: res.user.id,
      email: res.user.email,
      full_name: res.user.full_name,
      role,
      role_label: res.user.role_label,
      vendor_id: res.user.vendor_id,
      vendor_name: res.user.vendor_name,
      supervisor_id: res.user.supervisor_id,
      permissions: res.user.permissions ?? {},
    };

    sessionStorage.setItem("auth_token", res.token);
    sessionStorage.setItem("auth_user", JSON.stringify(authUser));
    setUser(authUser);
    setIsAuthenticated(true);
    return role;
  }

  async function logout() {
    // Fire-and-forget — logout is stateless, token deletion is what matters.
    authApi.logout().catch(() => undefined);
    clearSession();
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

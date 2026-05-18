import type React from "react";

export interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role_label: string;
  permissions: Record<string, string[]>;
  is_active: boolean;
  created_at: string;
  last_login_at?: string;
}

export interface PermissionModule {
  key: string;
  label: string;
  icon: React.ElementType;
  borderColor: string;
  bgColor: string;
  iconColor: string;
  chipColor: string;
  actions: { key: string; label: string }[];
}

import type { Vendor } from "./mock-data";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  const body = await res.json().catch(() => ({})) as { error?: string; errors?: unknown };
  if (!res.ok) {
    throw new Error((body.error as string) ?? `Request failed (${res.status})`);
  }
  return body as T;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  success: true;
  token: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    vendor_id: string | null;
    supervisor_id: string | null;
  };
}

export interface MeResponse {
  success: true;
  data: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    vendor_id: string | null;
    supervisor_id: string | null;
    is_active: boolean;
  };
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    apiFetch<{ success: true; message: string }>("/api/auth/logout", {
      method: "POST",
    }),

  me: () => apiFetch<MeResponse>("/api/auth/me"),
};

// ── Vendors ─────────────────────────────────────────────────────────────────

export interface CreateVendorPayload {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  password: string;
  secondaryPOCs?: { name: string; email: string; phone: string }[];
  walletAmount?: number;
}

export interface VendorDetailApiItem extends Vendor {
  wallet_balance: number;
  secondaryPOCs: { name: string; email: string; phone: string }[];
}

export interface WalletTransaction {
  id:             string;
  type:           string;
  amount:         number;
  note:           string | null;
  balance_before: number | null;
  balance_after:  number | null;
  created_at:     string;
}

export const vendorsApi = {
  list: () =>
    apiFetch<{ success: true; data: Vendor[] }>("/api/vendor/vendors"),

  get: (id: string) =>
    apiFetch<{ success: true; data: VendorDetailApiItem }>(`/api/vendor/vendors/${id}`),

  create: (payload: CreateVendorPayload) =>
    apiFetch<{ success: true; data: Vendor }>("/api/vendor/vendors", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: { status?: "Active" | "Inactive"; name?: string; city?: string }) =>
    apiFetch<{ success: true; data: VendorDetailApiItem }>(`/api/vendor/vendors/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  recharge: (id: string, amount: number) =>
    apiFetch<{ success: true; data: { wallet_balance: number } }>(`/api/vendor/vendors/${id}/recharge`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),

  transactions: (id: string) =>
    apiFetch<{ success: true; data: WalletTransaction[] }>(`/api/vendor/vendors/${id}/transactions`),
};

// ── Supervisors ──────────────────────────────────────────────────────────────

export interface SupervisorApiData {
  id: string;
  name: string;
  email: string;
  phone: string;
  zone: string;
  appAccess: boolean;
  status: "Active" | "Inactive";
  bookingsToday: number;
  isOnline: boolean;
  createdAt: string;
  walletLimit: number;
  walletUsed: number;
  companies: string[];
  dailyHistory: { date: string; amount: number; bookings: number }[];
}

export const supervisorsApi = {
  list: () =>
    apiFetch<{ success: true; data: SupervisorApiData[] }>("/api/vendor/supervisors"),

  create: (payload: {
    name: string; email: string; phone: string; zone?: string;
    password: string; status?: "Active" | "Inactive";
    walletLimit?: number; companies?: string[];
  }) =>
    apiFetch<{ success: true; data: SupervisorApiData }>("/api/vendor/supervisors", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: {
    name?: string; phone?: string; zone?: string;
    status?: "Active" | "Inactive"; walletLimit?: number;
  }) =>
    apiFetch<{ success: true; data: SupervisorApiData }>(`/api/vendor/supervisors/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  delete: (id: string) =>
    apiFetch<{ success: true; message: string }>(`/api/vendor/supervisors/${id}`, {
      method: "DELETE",
    }),

  toggleAccess: (id: string) =>
    apiFetch<{ success: true; data: SupervisorApiData }>(`/api/supervisors/${id}/toggle-access`, {
      method: "PATCH",
    }),
};

// ── Superadmin — Drivers ─────────────────────────────────────────────────────

export interface DriverApiItem {
  id: string;
  driverRef: string | null;
  userId: string;
  name: string;
  phone: string;
  email: string | null;
  status: "Available" | "On Trip" | "Offline" | string;
  isVerified: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  lastActiveAt: string;
  currentLatitude: number | null;
  currentLongitude: number | null;
  zone: string | null;
  createdAt: string;
  vehicle: {
    id: string;
    plateNumber: string;
    model: string | null;
    color: string | null;
    type: string | null;
  } | null;
  documents: { total: number; verified: number };
  totalTrips: number;
}

export const superadminApi = {
  overview: () =>
    apiFetch<{ success: true; data: OverviewData }>("/api/superadmin/overview"),

  drivers: {
    list: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page)   qs.set("page",   String(params.page));
      if (params?.limit)  qs.set("limit",  String(params.limit));
      if (params?.status) qs.set("status", params.status);
      if (params?.search) qs.set("search", params.search);
      const query = qs.toString();
      return apiFetch<{
        success: true;
        data: DriverApiItem[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/api/superadmin/drivers${query ? `?${query}` : ""}`);
    },

    get: (id: string) =>
      apiFetch<{ success: true; data: DriverApiItem }>(`/api/superadmin/drivers/${id}`),
  },
};

// ── Superadmin — Driver Onboarding ──────────────────────────────────────────

export interface OnboardingListItem {
  id:            string;
  full_name:     string;
  phone:         string;
  email:         string | null;
  status:        "Pending" | "In Review" | "Rejected" | "Approved";
  created_at:    string;
  total_docs:    number;
  submitted_docs:number;
  approved_docs: number;
}

export interface OnboardingListResponse {
  success:        true;
  data:           OnboardingListItem[];
  pagination:     { page: number; limit: number; total: number; pages: number };
  pending_count:  number;
  in_review_count:number;
  rejected_count: number;
  approved_count: number;
}

export interface OnboardingDoc {
  doc_type:       string;
  name:           string;
  description:    string;
  category:       "driver" | "vehicle";
  has_expiry:     boolean;
  submitted:      boolean;
  status:         "Not Submitted" | "Pending" | "Approved" | "Rejected";
  expiry_date:    string | null;
  rejection_note: string | null;
  file_url:       string | null;
}

export interface OnboardingDetail {
  id:             string;
  full_name:      string;
  phone:          string;
  email:          string | null;
  status:         "Pending" | "In Review" | "Rejected" | "Approved";
  rejection_note: string | null;
  created_at:     string;
  reviewed_at:    string | null;
  date_of_birth:  string | null;
  gender:         string | null;
  alternate_phone:string | null;
  current_address:    string | null;
  city:               string | null;
  state:              string | null;
  pincode:            string | null;
  permanent_address:  string | null;
  nationality:        string | null;
  license_number:     string | null;
  license_class:      string | null;
  license_expiry:     string | null;
  years_of_experience:number | null;
  joining_date:       string | null;
  emergency_contact_name:         string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone:        string | null;
  vehicle: {
    id:           string;
    plate_number: string | null;
    model:        string | null;
    color:        string | null;
    type:         string | null;
  } | null;
  documents: {
    driver:  OnboardingDoc[];
    vehicle: OnboardingDoc[];
  };
  doc_counts: { total: number; submitted: number; approved: number };
}

export const driverOnboardingApi = {
  list: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set("page",   String(params.page));
    if (params?.limit)  qs.set("limit",  String(params.limit));
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    const q = qs.toString();
    return apiFetch<OnboardingListResponse>(`/api/superadmin/driver-onboarding${q ? `?${q}` : ""}`);
  },

  get: (id: string) =>
    apiFetch<{ success: true; data: OnboardingDetail }>(`/api/superadmin/driver-onboarding/${id}`),

  patchDocument: (id: string, docType: string, body: { action: "approve" | "reject"; rejection_note?: string }) =>
    apiFetch<{ success: true; data: OnboardingDoc }>(`/api/superadmin/driver-onboarding/${id}/document/${docType}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  patchStatus: (id: string, body: { status: "In Review" | "Rejected"; rejection_note?: string }) =>
    apiFetch<{ success: true; data: unknown }>(`/api/superadmin/driver-onboarding/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  approve: (id: string) =>
    apiFetch<{ success: true; data: { driver_id: string; user_id: string } }>(
      `/api/superadmin/driver-onboarding/${id}/approve`,
      { method: "POST" },
    ),

  reject: (id: string, body: { rejection_note: string }) =>
    apiFetch<{ success: true; data: unknown }>(`/api/superadmin/driver-onboarding/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

// ── Superadmin — Overview ────────────────────────────────────────────────────

export interface OverviewVendor {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  bookingsToday: number;
}

export interface OverviewDriver {
  id: string;
  name: string;
  status: string;
  bookingsToday: number;
}

export interface OverviewData {
  vendors: OverviewVendor[];
  drivers: OverviewDriver[];
  totalBookingsToday: number;
  totalVendors: number;
  activeVendors: number;
  inactiveVendors: number;
  totalDrivers: number;
  driversOnTrip: number;
  driversAvailable: number;
}

// ── Bookings ─────────────────────────────────────────────────────────────────

export interface BookingApiItem {
  id: string;
  bookingRef: string | null;
  type: string;
  status: string;
  pickupLocation: string;
  dropLocation: string;
  scheduledTime: string | null;
  fare: number | null;
  passengers: number | null;
  createdAt: string;
  bookingSource: string;
  supervisorId: string | null;
  supervisorName: string | null;
  driverId: string | null;
  driverName: string | null;
  driverPhone: string | null;
}

export const bookingsApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set("page",   String(params.page));
    if (params?.limit)  qs.set("limit",  String(params.limit));
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString();
    return apiFetch<{
      success: true;
      data: BookingApiItem[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/api/vendor/bookings${query ? `?${query}` : ""}`);
  },
};

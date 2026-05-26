import type { Vendor } from "./mock-data";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("auth_token");
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

  const body = await res.json().catch(() => ({})) as { error?: string; message?: string; errors?: unknown };
  if (!res.ok) {
    const reason = body.error ?? body.message ?? `Request failed (${res.status})`;
    throw new Error(reason);
  }
  return body as T;
}

async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  const body = await res.json().catch(() => ({})) as { error?: string; message?: string };
  if (!res.ok) throw new Error(body.error ?? body.message ?? `Upload failed (${res.status})`);
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
    role_label: string | null;
    vendor_id: string | null;
    vendor_name: string | null;
    supervisor_id: string | null;
    permissions: Record<string, string[]>;
  };
}

export interface MeResponse {
  success: true;
  data: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    role_label: string | null;
    vendor_id: string | null;
    vendor_name: string | null;
    supervisor_id: string | null;
    is_active: boolean;
    permissions: Record<string, string[]>;
  };
}

// ── User preferences (column visibility / order) ─────────────────────────────

export interface PreferenceResponse<T = unknown> {
  success: true;
  data: { value: T; updatedAt: string } | null;
}
export interface PreferenceListResponse {
  success: true;
  data: { key: string; value: unknown; updatedAt: string }[];
}

export const preferencesApi = {
  list: () => apiFetch<PreferenceListResponse>("/api/preferences"),
  get:  <T = unknown>(key: string) =>
    apiFetch<PreferenceResponse<T>>(`/api/preferences/${encodeURIComponent(key)}`),
  put:  <T = unknown>(key: string, value: T) =>
    apiFetch<PreferenceResponse<T>>(`/api/preferences/${encodeURIComponent(key)}`, {
      method: "PUT",
      body:   JSON.stringify({ value }),
    }),
  delete: (key: string) =>
    apiFetch<{ success: true }>(`/api/preferences/${encodeURIComponent(key)}`, { method: "DELETE" }),
};

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

export interface VendorDocument {
  id:          string;
  vendor_id:   string;
  doc_type:    string;
  doc_number:  string | null;
  expiry_date: string | null;
  file_url:    string | null;
  is_verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  note:        string | null;
  created_at:  string;
  updated_at:  string;
}

export type VendorBillingType = "PREPAID" | "POSTPAID";
export type VendorBillingCycle = "WEEKLY" | "MONTHLY";

export interface CreateVendorPayload {
  name: string;
  pan?: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  address?: string;
  password: string;
  secondaryPOCs?: { name: string; email: string; phone: string }[];
  walletAmount?: number;
  sendCredentials?: boolean;
  billing_type?: VendorBillingType;
  credit_limit?: number;
  outstanding_balance?: number;
  billing_cycle?: VendorBillingCycle;
  payment_due_days?: number;
}

export interface VendorDetailApiItem extends Vendor {
  wallet_balance: number;
  secondaryPOCs: { name: string; email: string; phone: string }[];
}

export interface UpdateVendorPayload {
  status?: "Active" | "Inactive";
  name?: string;
  city?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  pan?: string;
  gst?: string;
  billing_type?: VendorBillingType;
  credit_limit?: number;
  outstanding_balance?: number;
  billing_cycle?: VendorBillingCycle;
  payment_due_days?: number;
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

export interface VendorWalletSnapshot {
  walletBalance: number;
  walletUsed:    number;
  todaySpend:    number;
}

// vendor management (superadmin) lives under /api/superadmin/vendors;
// the vendor_admin's own wallet snapshot is /api/vendor/vendors/me/wallet.
export const vendorsApi = {
  list: () =>
    apiFetch<{ success: true; data: Vendor[] }>("/api/superadmin/vendors"),

  get: (id: string) =>
    apiFetch<{ success: true; data: VendorDetailApiItem }>(`/api/superadmin/vendors/${id}`),

  myWallet: () =>
    apiFetch<{ success: true; data: VendorWalletSnapshot }>("/api/vendor/vendors/me/wallet"),

  // The current vendor's own profile — same shape as the superadmin vendor
  // detail, so the vendor Profile page can render with the same building blocks.
  me: () =>
    apiFetch<{ success: true; data: VendorDetailApiItem }>("/api/vendor/vendors/me"),

  // Self-service profile update — vendor_admin only on the backend.
  // status is intentionally not exposed; that remains superadmin-controlled.
  updateMe: (payload: {
    name?:          string;
    contactPerson?: string;
    email?:         string;
    phone?:         string;
    city?:          string;
    address?:       string;
    pan?:           string;
    gst?:           string;
  }) =>
    apiFetch<{ success: true; data: VendorDetailApiItem }>("/api/vendor/vendors/me", {
      method: "PUT",
      body:   JSON.stringify(payload),
    }),

  // vendor_admin changes its own login password. Validates currentPassword
  // against the stored bcrypt hash on the server before writing the new one.
  updateMyPassword: (currentPassword: string, newPassword: string) =>
    apiFetch<{ success: true }>("/api/vendor/vendors/me/password", {
      method: "POST",
      body:   JSON.stringify({ currentPassword, newPassword }),
    }),

  // Self-service document upload (PAN_CARD or GST_CERTIFICATE).
  uploadMyDocument: async (
    docType:   "PAN_CARD" | "GST_CERTIFICATE",
    docNumber: string | undefined,
    file:      File | undefined,
  ) => {
    const fd = new FormData();
    fd.append("doc_type", docType);
    if (docNumber) fd.append("doc_number", docNumber);
    if (file)      fd.append("file", file);
    return apiUpload<{ success: true; data: VendorDocument }>(
      "/api/vendor/vendors/me/documents/upload",
      fd,
    );
  },

  // List current vendor's uploaded documents.
  myDocuments: () =>
    apiFetch<{ success: true; data: VendorDocument[] }>("/api/vendor/vendors/me/documents"),

  wallet: {
    createOrder: (amount: number) =>
      apiFetch<{ success: true; data: { order_id: string; amount: number; currency: string; key_id: string } }>(
        "/api/vendor/wallet/recharge/create-order",
        { method: "POST", body: JSON.stringify({ amount }) },
      ),

    verify: (payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; amount: number }) =>
      apiFetch<{ success: true; data: { new_balance?: number; already_processed?: boolean } }>(
        "/api/vendor/wallet/recharge/verify",
        { method: "POST", body: JSON.stringify(payload) },
      ),
  },

  create: (payload: CreateVendorPayload) =>
    apiFetch<{ success: true; data: Vendor }>("/api/superadmin/vendors", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  uploadDocument: async (vendorId: string, docType: "PAN_CARD" | "GST_CERTIFICATE", docNumber: string | undefined, file: File | undefined) => {
    const fd = new FormData();
    fd.append("doc_type", docType);
    if (docNumber) fd.append("doc_number", docNumber);
    if (file) fd.append("file", file);
    return apiUpload<{ success: true; data: unknown }>(`/api/superadmin/vendors/${vendorId}/documents/upload`, fd);
  },

  update: (id: string, payload: UpdateVendorPayload) =>
    apiFetch<{ success: true; data: VendorDetailApiItem }>(`/api/superadmin/vendors/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  verify: (id: string) =>
    apiFetch<{ success: true; data: VendorDetailApiItem }>(`/api/superadmin/vendors/${id}/verify`, {
      method: "POST",
    }),

  reject: (id: string, reason?: string) =>
    apiFetch<{ success: true }>(`/api/superadmin/vendors/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  recharge: (id: string, amount: number) =>
    apiFetch<{ success: true; data: { wallet_balance: number } }>(`/api/superadmin/vendors/${id}/recharge`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),

  // Razorpay-backed recharge for a specific vendor (superadmin scope).
  adminWallet: {
    createOrder: (id: string, amount: number) =>
      apiFetch<{ success: true; data: { order_id: string; amount: number; currency: string; key_id: string } }>(
        `/api/superadmin/vendors/${id}/wallet/recharge/create-order`,
        { method: "POST", body: JSON.stringify({ amount }) },
      ),
    verify: (id: string, payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; amount: number }) =>
      apiFetch<{ success: true; data: { new_balance?: number; already_processed?: boolean } }>(
        `/api/superadmin/vendors/${id}/wallet/recharge/verify`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
  },

  transactions: (id: string) =>
    apiFetch<{ success: true; data: WalletTransaction[] }>(`/api/superadmin/vendors/${id}/transactions`),

  updatePassword: (id: string, password: string) =>
    apiFetch<{ success: true; message: string }>(`/api/superadmin/vendors/${id}/password`, {
      method: "POST",
      body:   JSON.stringify({ password }),
    }),

  trips: (id: string, limit = 100) =>
    apiFetch<{ success: true; data: TripApiItem[] }>(`/api/superadmin/vendors/${id}/trips?limit=${limit}`),

  documents: {
    upload: (id: string, formData: FormData) =>
      apiUpload<{ success: true; data: VendorDocument }>(`/api/superadmin/vendors/${id}/documents/upload`, formData),
    list: (id: string) =>
      apiFetch<{ success: true; data: VendorDocument[] }>(`/api/superadmin/vendors/${id}/documents`),
    patch: (id: string, docType: string, action: "approve" | "reject", note?: string) =>
      apiFetch<{ success: true; data: VendorDocument }>(`/api/superadmin/vendors/${id}/documents/${docType}`, {
        method: "PATCH",
        body: JSON.stringify({ action, note }),
      }),
    previewLink: (id: string, docType: string) =>
      apiFetch<{ success: true; data: { url: string; expiresInSeconds: number } }>(
        `/api/superadmin/vendors/${id}/documents/${docType}/preview-link`,
      ),
  },
};

// ── Vendor Self-Registration ─────────────────────────────────────────────────

export interface VendorSignupPayload {
  name:          string;
  city:          string;
  contactPerson: string;
  email:         string;
  phone:         string;
  password:      string;
  billing_type?: VendorBillingType;
  credit_limit?: number;
  outstanding_balance?: number;
  billing_cycle?: VendorBillingCycle;
  payment_due_days?: number;
}

export const vendorSignupApi = {
  signup: (payload: VendorSignupPayload) =>
    apiFetch<LoginResponse>("/api/auth/vendor-signup", {
      method: "POST",
      body:   JSON.stringify(payload),
    }),
};

// ── Supervisors ──────────────────────────────────────────────────────────────

export interface SupervisorCompany {
  name:    string;
  address: string | null;
  city:    string | null;
  state:   string | null;
  pincode: string | null;
}

export interface SupervisorApiData {
  id: string;
  ref: string;
  name: string;
  email: string;
  phone: string;
  zone: string;
  appAccess: boolean;
  status: "Active" | "Inactive";
  bookingsToday: number;
  isOnline: boolean;
  createdAt: string;
  walletUsed: number;
  companies: SupervisorCompany[];
  dailyHistory: { date: string; amount: number; bookings: number }[];
}

export const supervisorsApi = {
  list: () =>
    apiFetch<{ success: true; data: SupervisorApiData[] }>("/api/vendor/supervisors"),

  get: (id: string) =>
    apiFetch<{ success: true; data: SupervisorApiData }>(`/api/vendor/supervisors/${id}`),

  create: (payload: {
    name: string; email: string; phone: string; zone?: string;
    password: string; status?: "Active" | "Inactive";
    companies?: SupervisorCompany[];
    sendCredentials?: boolean;
  }) =>
    apiFetch<{ success: true; data: SupervisorApiData }>("/api/vendor/supervisors", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: {
    name?: string; email?: string; phone?: string; zone?: string;
    status?: "Active" | "Inactive";
    companies?: SupervisorCompany[];
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
    apiFetch<{ success: true; data: SupervisorApiData }>(`/api/vendor/supervisors/${id}/toggle-access`, {
      method: "PATCH",
    }),

  updatePassword: (id: string, password: string) =>
    apiFetch<{ success: true; message: string }>(`/api/vendor/supervisors/${id}/password`, {
      method: "POST",
      body:   JSON.stringify({ password }),
    }),
};

// ── Companies (vendor-scoped) ───────────────────────────────────────────────

export interface CompanyApiItem {
  id:              string;
  name:            string;
  status:          string;
  createdAt:       string;
  supervisorCount: number;
}

export const companiesApi = {
  list: () =>
    apiFetch<{ success: true; data: CompanyApiItem[] }>("/api/vendor/companies"),
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
    year: number | null;
    makeYear: number | null;
    chassisNumber: string | null;
    engineNumber: string | null;
    ownerName: string | null;
    assignedAt: string | null;
    updatedAt: string | null;
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

    documents: (id: string) =>
      apiFetch<{ success: true; data: DriverDocuments }>(`/api/superadmin/drivers/${id}/documents`),

    onboardingDocs: (id: string) =>
      apiFetch<{ success: true; data: { onboardingId: string | null; documents: OnboardingDetail["documents"] | null; doc_counts: OnboardingDetail["doc_counts"] | null } }>(
        `/api/superadmin/drivers/${id}/onboarding-docs`,
      ),

    trips: (id: string, params?: { startDate?: string; endDate?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.startDate) qs.set("startDate", params.startDate);
      if (params?.endDate)   qs.set("endDate",   params.endDate);
      if (params?.limit)     qs.set("limit",     String(params.limit));
      const query = qs.toString();
      return apiFetch<{ success: true; data: DriverTripsResponse }>(
        `/api/superadmin/drivers/${id}/trips${query ? `?${query}` : ""}`,
      );
    },

    locationHistory: (
      id:    string,
      range: { from: string; to: string } | { hours: number },
    ) => {
      const qs = new URLSearchParams();
      if ("from" in range) {
        qs.set("from", range.from);
        qs.set("to",   range.to);
      } else {
        qs.set("hours", String(range.hours));
      }
      return apiFetch<DriverLocationHistoryResponse>(
        `/api/superadmin/drivers/${id}/location-history?${qs.toString()}`,
      );
    },
  },

  liveMap: {
    snapshot: () =>
      apiFetch<{ success: true; data: LiveDriver[] }>("/api/superadmin/live-map"),
  },

  bookings: {
    assignDriver: (id: string, driverId: string) =>
      apiFetch<{ success: true; data: unknown }>(`/api/vendor/bookings/${id}/assign-driver`, {
        method: "PATCH",
        body: JSON.stringify({ driver_id: driverId }),
      }),
  },

  bookingEnquiries: {
    assignWebsiteBookingDriver: (id: string, payload: { driver_id: string; estimated_fare: number }) =>
      apiFetch<{ success: true; data: WebsiteBookingEnquiry }>(`/api/superadmin/booking-enquiries/website-bookings/${id}/assign-driver`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),

    listGeneral: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page)   qs.set("page",   String(params.page));
      if (params?.limit)  qs.set("limit",  String(params.limit));
      if (params?.status) qs.set("status", params.status);
      if (params?.search) qs.set("search", params.search);
      const q = qs.toString();
      return apiFetch<{
        success: true;
        data: GeneralBookingEnquiry[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/api/superadmin/booking-enquiries/general${q ? `?${q}` : ""}`);
    },

    listSpecial: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page)   qs.set("page",   String(params.page));
      if (params?.limit)  qs.set("limit",  String(params.limit));
      if (params?.status) qs.set("status", params.status);
      if (params?.search) qs.set("search", params.search);
      const q = qs.toString();
      return apiFetch<{
        success: true;
        data: SpecialBookingInquiry[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/api/superadmin/booking-enquiries/special${q ? `?${q}` : ""}`);
    },

    listWebsiteBookings: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page)   qs.set("page",   String(params.page));
      if (params?.limit)  qs.set("limit",  String(params.limit));
      if (params?.status) qs.set("status", params.status);
      if (params?.search) qs.set("search", params.search);
      const q = qs.toString();
      return apiFetch<{
        success: true;
        data: WebsiteBookingEnquiry[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/api/superadmin/booking-enquiries/website-bookings${q ? `?${q}` : ""}`);
    },

    listWebsiteEnquiries: (params?: { page?: number; limit?: number; status?: string; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.page)   qs.set("page",   String(params.page));
      if (params?.limit)  qs.set("limit",  String(params.limit));
      if (params?.status) qs.set("status", params.status);
      if (params?.search) qs.set("search", params.search);
      const q = qs.toString();
      return apiFetch<{
        success: true;
        data: WebsiteGeneralEnquiry[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/api/superadmin/booking-enquiries/website-enquiries${q ? `?${q}` : ""}`);
    },
  },
};

export interface GeneralBookingEnquiry {
  id:              string;
  createdAt:       string | null;
  isScheduled:     boolean;
  scheduledAt:     string | null;
  pickupLocation:  string;
  destination:     string;
  distanceKm:      number | null;
  bookingType:     string | null;
  bookingCategory: string | null;
  vehicleType:     string | null;
  passengers:      number;
  customerName:    string;
  customerEmail:   string;
  customerMobile:  string;
  status:          string | null;
  notes:           string | null;
}

export interface SpecialBookingInquiry {
  id:          string;
  firstName:   string;
  lastName:    string;
  email:       string;
  phone:       string;
  companyName: string;
  message:     string;
  status:      string;
  notes:       string | null;
  createdAt:   string | null;
}

export interface WebsiteBookingEnquiry {
  id:              string;
  enqRef:          string | null;
  createdAt:       string | null;
  isScheduled:     boolean;
  scheduledAt:     string | null;
  isReturnTrip:    boolean;
  returnAt:        string | null;
  pickupLocation:  string;
  destination:     string;
  distanceKm:      number | null;
  bookingType:     string | null;
  bookingCategory: string | null;
  vehicleType:     string | null;
  passengers:      number;
  customerName:    string;
  customerEmail:   string | null;
  customerMobile:  string;
  status:          string | null;
  pickupLat:       number | null;
  pickupLng:       number | null;
  dropLat:         number | null;
  dropLng:         number | null;
  estimatedFare?:  number | null;
  driverId?:       string | null;
  driverName?:     string | null;
  driverPhone?:    string | null;
  vehicleReg?:     string | null;
  vehicleModel?:   string | null;
}

export interface WebsiteGeneralEnquiry {
  id:          string;
  enqRef:      string | null;
  name:        string;
  email:       string | null;
  mobile:      string;
  companyName: string | null;
  message:     string;
  status:      string | null;
  createdAt:   string | null;
}

export interface LiveDriver {
  driver_id:  string;
  user_id:    string;
  driver_ref: string | null;
  name:       string;
  phone:      string;
  is_online:  boolean;
  vendor:     { id: string; name: string } | null;
  vehicle:    { plate: string; model: string | null; type: string | null } | null;
  trip:       { booking_id: string; booking_ref: string | null; from: string; to: string } | null;
  status:     "On Trip" | "Available" | "Offline";
  lat:        number;
  lng:        number;
  speed:      number | null;
  updated_at: string;
}

export interface LiveLocationEvent {
  driver_id:  string | null;
  user_id:    string;
  booking_id: string;
  lat:        number;
  lng:        number;
  speed:      number | null;
  updated_at: string;
}

export interface DriverDocument {
  doc_type:    string;
  name:        string;
  doc_number:  string | null;
  expiry_date: string | null;
  file_url:    string | null;
  is_verified: boolean;
  submitted:   boolean;
}

export interface DriverDocuments {
  driving_license: DriverDocument;
  insurance:       DriverDocument;
  tax_certificate: DriverDocument;
  vehicle_rc:      DriverDocument;
}

export interface DriverTripItem {
  id:             string;
  tripRef:        string | null;
  status:         string | null;
  type:           string | null;
  pickupLocation: string;
  dropLocation:   string;
  fare:           number | null;
  passengers:     number;
  createdAt:      string;
  pickupTime:     string | null;
  supervisorName: string | null;
  companyName:    string | null;
  vendorName:     string | null;
  driverName:     string | null;
  vehicleType:    string | null;
  scheduledAt:    string | null;
  completedAt:    string | null;
  startedAt:      string | null;
  distanceKm:     number | null;
  escortRequired: boolean;
  escortPickup:   string | null;
  notes:          string | null;
  invoiceId:      string | null;
  pickupLat:      number | null;
  pickupLng:      number | null;
  dropLat:        number | null;
  dropLng:        number | null;
}

export interface DriverTripsResponse {
  trips:    DriverTripItem[];
  stats:    {
    totalTrips:     number;
    completedTrips: number;
    totalFare:      number;
    completedFare:  number;
    avgFare:        number;
    instantFare:    number;
    scheduledFare:  number;
  };
  weekDays: { date: string; total: number; bookings: number }[];
}

// ── Driver Location History ──────────────────────────────────────────────────

export interface LocationHistoryPoint {
  lat:         number;
  lng:         number;
  speed:       number | null;
  bearing:     number | null;
  recorded_at: string;
}

export interface DriverLocationHistoryResponse {
  success: true;
  data: {
    driver: {
      id:               string;
      name:             string;
      driver_ref:       string | null;
      current_location: { lat: number; lng: number } | null;
    };
    history:      LocationHistoryPoint[];
    total_points: number;
    range: {
      from: string;
      to:   string;
    };
  };
}

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
  file_url_back:  string | null;
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
  permanent_city:     string | null;
  permanent_state:    string | null;
  permanent_pincode:  string | null;
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
    make:         string | null;
    year:         number | null;
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

  uploadDocumentFile: async (id: string, docType: string, side: "front" | "back", file: File) => {
    const token = getToken();
    const fd = new FormData();
    fd.append("file", file);
    fd.append("side", side);
    const res = await fetch(`${API_URL}/api/superadmin/driver-onboarding/${id}/document/${docType}/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    const body = await res.json().catch(() => ({})) as { success?: boolean; data?: OnboardingDoc; error?: string };
    if (!res.ok || !body.success) throw new Error(body.error ?? `Upload failed (${res.status})`);
    return body.data!;
  },

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

  documentPreviewLink: (id: string, docType: string) =>
    apiFetch<{ success: true; data: { url: string; expiresInSeconds: number } }>(
      `/api/superadmin/driver-onboarding/${id}/document/${docType}/preview-link`,
    ),
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
  vehicle: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
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

// ── Trips ────────────────────────────────────────────────────────────────────

export interface TripApiItem {
  id: string;
  tripRef: string | null;
  type: string;
  status: string;
  pickupLocation: string;
  dropLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropLat: number | null;
  dropLng: number | null;
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
  vehicleReg: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
  vehicleColor: string | null;
  vehicleMakeYear: number | null;
  completedAt: string | null;
  stops: { id: string; address: string; stopOrder: number }[];
}

// ── Supervisor Report ────────────────────────────────────────────────────────

export interface SupervisorReportData {
  kpis: {
    totalBookings: number;
    completedBookings?: number;
    totalMoneySpent: number;
    avgBookingFare: number;
  };
  dailyStats: {
    date: string;
    bookings: number;
    amount: number;
    instantBookings?: number;
    scheduledBookings?: number;
  }[];
  bookingTypeSplit: { instant: number; scheduled: number };
}

export type CompanyReportData = SupervisorReportData;

export interface SupervisorSummaryData {
  kpis: {
    totalBookings:   number;
    totalMoneySpent: number;
    avgBookingFare:  number;
  };
  hourlyStats: { hour: number; label: string; bookings: number }[];
  dailyStats:  { date: string; bookings: number; amount: number }[];
  bookingTypeSplit: { instant: number; scheduled: number };
  companies: {
    companyId:              string;
    companyName:            string;
    totalTrips:             number;
    totalFare:              number;
    percentageOfTotalSpend: number;
  }[];
  companiesCount: number;
}

export const reportsApi = {
  getSupervisor: (supervisorId: string, startDate: string, endDate: string) =>
    apiFetch<{ success: true; data: SupervisorReportData }>(
      `/api/vendor/reports/supervisor/${supervisorId}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
    ),

  getSupervisorSummary: (supervisorId: string, startDate: string, endDate: string) =>
    apiFetch<{ success: true; data: SupervisorSummaryData }>(
      `/api/vendor/reports/supervisor/${supervisorId}/summary?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
    ),

  getCompany: (companyName: string, startDate: string, endDate: string) =>
    apiFetch<{ success: true; data: CompanyReportData }>(
      `/api/vendor/reports/company/${encodeURIComponent(companyName)}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
    ),

  getCompanyTrips: (companyName: string, startDate: string, endDate: string) =>
    apiFetch<{ success: true; data: VendorBookingItem[] }>(
      `/api/vendor/reports/company/${encodeURIComponent(companyName)}/trips?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
    ),
};

// ── Superadmin — Vendor Reports ──────────────────────────────────────────────

export interface VendorListItem {
  id: string;
  name: string;
  city: string;
  status: string;
  walletBalance: number;
  contactName:  string | null;
  contactPhone: string | null;
}

export interface VendorReportData {
  vendor: {
    id: string;
    name: string;
    city: string;
    status: string;
    walletBalance: number;
    supervisorCount: number;
    driverCount: number;
    createdAt: string;
  };
  kpis: {
    totalBookings: number;
    totalMoneySpent: number;
    avgBookingFare: number;
  };
  dailyStats: {
    date: string;
    bookings: number;
    amount: number;
    instantBookings: number;
    scheduledBookings: number;
  }[];
  bookingTypeSplit: { instant: number; scheduled: number };
}

export interface VendorWalletTx {
  id: string;
  type: string;
  amount: number;
  note: string | null;
  balanceBefore: number | null;
  balanceAfter: number | null;
  createdAt: string;
  supervisorName: string | null;
}

export interface VendorBookingItem {
  id: string;
  tripRef?: string | null;
  bookingRef?: string | null;
  type: string;
  status: string;
  pickupLocation: string;
  dropLocation: string;
  scheduledTime: string | null;
  fare: number | null;
  passengers: number | null;
  createdAt: string;
  bookingSource: string | null;
  supervisorName: string | null;
  driverName: string | null;
  driverPhone: string | null;
  vehicleReg: string | null;
  vehicleModel: string | null;
}

export const vendorReportApi = {
  listVendors: () =>
    apiFetch<{ success: true; data: VendorListItem[] }>("/api/superadmin/reports/vendors"),

  getReport: (vendorId: string, startDate: string, endDate: string) =>
    apiFetch<{ success: true; data: VendorReportData }>(
      `/api/superadmin/reports/vendor/${vendorId}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
    ),

  getWallet: (vendorId: string, startDate: string, endDate: string, page = 1, limit = 50) =>
    apiFetch<{
      success: true;
      data: VendorWalletTx[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(
      `/api/superadmin/reports/vendor/${vendorId}/wallet?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&page=${page}&limit=${limit}`,
    ),

  getBookings: (vendorId: string, startDate: string, endDate: string, page = 1, limit = 50, status?: string, type?: string) => {
    const qs = new URLSearchParams({ startDate, endDate, page: String(page), limit: String(limit) });
    if (status) qs.set("status", status);
    if (type)   qs.set("type",   type);
    return apiFetch<{
      success: true;
      data: VendorBookingItem[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/api/superadmin/reports/vendor/${vendorId}/bookings?${qs.toString()}`);
  },
};

export const tripsApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page)   qs.set("page",   String(params.page));
    if (params?.limit)  qs.set("limit",  String(params.limit));
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString();
    return apiFetch<{
      success: true;
      data: TripApiItem[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>(`/api/vendor/trips${query ? `?${query}` : ""}`);
  },
};

// ── Invoices ────────────────────────────────────────────────────────────────

export type InvoiceStatus = "Pending" | "Paid" | "Overdue" | "Voided";

export interface InvoiceListItem {
  id:            string;
  invoiceNumber: string;
  companyName:   string;
  periodFrom:    string;
  periodTo:      string;
  amount:        number;
  status:        InvoiceStatus;
  issuedAt:      string;
  dueDate:       string;
  paidAt:        string | null;
  tripCount:     number;
}

export interface InvoiceTripItem {
  tripId:         string;
  tripRef:        string;
  pickupAddress:  string;
  dropAddress:    string;
  pickupTime:     string;
  dropTime?:      string | null;
  fare:           number;
  supervisorName: string;
  driverName:     string;
  driverId?:      string | null;
  driverPhone?:   string | null;
  vehicleModel?:  string | null;
  vehicleReg?:    string | null;
  passengers?:    number | null;
  distanceKm?:    number | null;
  tollCharges?:   number | null;
  bookingType?:   string | null;
  pickupLat?:     number | null;
  pickupLng?:     number | null;
  dropLat?:       number | null;
  dropLng?:       number | null;
}

export interface InvoiceDetail extends InvoiceListItem {
  paymentRef:     string | null;
  notes:          string | null;
  companyAddress: string | null;
  trips:          InvoiceTripItem[];
}

export interface InvoiceSummary {
  totalBilled: number;
  collected:   number;
  outstanding: number;
  totalCount:  number;
  paidCount:   number;
  unpaidCount: number;
}

export const invoicesApi = {
  list: (params?: { page?: number; limit?: number; status?: InvoiceStatus; companyId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page)      qs.set("page",       String(params.page));
    if (params?.limit)     qs.set("limit",      String(params.limit));
    if (params?.status)    qs.set("status",     params.status);
    if (params?.companyId) qs.set("company_id", params.companyId);
    const q = qs.toString();
    return apiFetch<{
      success: true;
      data: { invoices: InvoiceListItem[]; summary: InvoiceSummary };
      pagination: { page: number; limit: number; total: number };
    }>(`/api/vendor/invoices${q ? `?${q}` : ""}`);
  },

  get: (id: string) =>
    apiFetch<{ success: true; data: InvoiceDetail }>(`/api/vendor/invoices/${id}`),

  preview: (params: { companyId: string; periodFrom: string; periodTo: string }) => {
    const qs = new URLSearchParams({ companyId: params.companyId, periodFrom: params.periodFrom, periodTo: params.periodTo });
    return apiFetch<{ success: true; data: { tripCount: number; total: number; trips: InvoiceTripItem[] } }>(`/api/vendor/invoices/preview?${qs.toString()}`);
  },

  create: (payload: { companyId: string; periodFrom: string; periodTo: string; notes?: string }) =>
    apiFetch<{ success: true; data: InvoiceDetail }>("/api/vendor/invoices", {
      method: "POST",
      body:   JSON.stringify(payload),
    }),

  markPaid: (id: string, paymentRef?: string) =>
    apiFetch<{ success: true; data: InvoiceListItem }>(`/api/vendor/invoices/${id}/status`, {
      method: "PATCH",
      body:   JSON.stringify({ status: "Paid", paymentRef }),
    }),

  void: (id: string) =>
    apiFetch<{ success: true }>(`/api/vendor/invoices/${id}/void`, {
      method: "POST",
    }),
};

// ── Superadmin — Vendor Invoices ─────────────────────────────────────────────

export interface SuperadminInvoiceListItem {
  id:            string;
  invoiceNumber: string;
  vendorName:    string;
  periodFrom:    string;
  periodTo:      string;
  amount:        number;
  status:        InvoiceStatus;
  issuedAt:      string;
  dueDate:       string;
  paidAt:        string | null;
  tripCount:     number;
}

export interface SuperadminInvoiceDetail extends SuperadminInvoiceListItem {
  vendorAddress: string | null;
  paymentRef:    string | null;
  notes:         string | null;
  trips:         InvoiceTripItem[];
}

export const superadminInvoicesApi = {
  list: (params?: { page?: number; limit?: number; status?: InvoiceStatus; vendorId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page)     qs.set("page",      String(params.page));
    if (params?.limit)    qs.set("limit",     String(params.limit));
    if (params?.status)   qs.set("status",    params.status);
    if (params?.vendorId) qs.set("vendor_id", params.vendorId);
    const q = qs.toString();
    return apiFetch<{
      success: true;
      data: { invoices: SuperadminInvoiceListItem[]; summary: InvoiceSummary };
      pagination: { page: number; limit: number; total: number };
    }>(`/api/superadmin/invoices${q ? `?${q}` : ""}`);
  },

  get: (id: string) =>
    apiFetch<{ success: true; data: SuperadminInvoiceDetail }>(`/api/superadmin/invoices/${id}`),

  preview: (params: { vendorId: string; periodFrom: string; periodTo: string }) => {
    const qs = new URLSearchParams({ vendorId: params.vendorId, periodFrom: params.periodFrom, periodTo: params.periodTo });
    return apiFetch<{ success: true; data: { tripCount: number; total: number; trips: InvoiceTripItem[] } }>(`/api/superadmin/invoices/preview?${qs.toString()}`);
  },

  create: (payload: { vendorId: string; periodFrom: string; periodTo: string; notes?: string }) =>
    apiFetch<{ success: true; data: SuperadminInvoiceDetail }>("/api/superadmin/invoices", {
      method: "POST",
      body:   JSON.stringify(payload),
    }),

  markPaid: (id: string, paymentRef?: string) =>
    apiFetch<{ success: true; data: SuperadminInvoiceListItem }>(`/api/superadmin/invoices/${id}/status`, {
      method: "PATCH",
      body:   JSON.stringify({ status: "Paid", paymentRef }),
    }),

  void: (id: string) =>
    apiFetch<{ success: true }>(`/api/superadmin/invoices/${id}/void`, {
      method: "POST",
    }),
};

// ── Superadmin — Team Members ────────────────────────────────────────────────

interface ApiTeamMember {
  id:            string;
  full_name:     string;
  email:         string | null;
  mobile_number: string;
  role_label:    string | null;
  permissions:   Record<string, string[]> | null;
  is_active:     boolean | null;
  last_login_at: string | null;
  created_at:    string | null;
}

export interface TeamMemberShape {
  id:            string;
  full_name:     string;
  email:         string;
  phone:         string;
  role_label:    string;
  permissions:   Record<string, string[]>;
  is_active:     boolean;
  last_login_at: string | null;
  created_at:    string;
}

function normalizeTeamMember(m: ApiTeamMember): TeamMemberShape {
  return {
    id:            m.id,
    full_name:     m.full_name,
    email:         m.email ?? "",
    phone:         m.mobile_number,
    role_label:    m.role_label ?? "",
    permissions:   (m.permissions ?? {}) as Record<string, string[]>,
    is_active:     m.is_active ?? true,
    last_login_at: m.last_login_at ?? null,
    created_at:    m.created_at ?? new Date().toISOString(),
  };
}

export const superadminTeamApi = {
  list: () =>
    apiFetch<{ success: true; data: ApiTeamMember[] }>("/api/superadmin/team")
      .then(r => r.data.map(normalizeTeamMember)),

  create: (body: {
    full_name:     string;
    email:         string;
    mobile_number: string;
    password:      string;
    role_label:    string;
    permissions:   Record<string, string[]>;
    is_active?:    boolean;
  }) =>
    apiFetch<{ success: true; data: ApiTeamMember }>("/api/superadmin/team", {
      method: "POST",
      body:   JSON.stringify(body),
    }).then(r => normalizeTeamMember(r.data)),

  update: (id: string, body: {
    full_name?:     string;
    email?:         string;
    mobile_number?: string;
    password?:      string;
    role_label?:    string;
    permissions?:   Record<string, string[]>;
    is_active?:     boolean;
  }) =>
    apiFetch<{ success: true; data: ApiTeamMember }>(`/api/superadmin/team/${id}`, {
      method: "PUT",
      body:   JSON.stringify(body),
    }).then(r => normalizeTeamMember(r.data)),

  toggleStatus: (id: string) =>
    apiFetch<{ success: true; data: { id: string; is_active: boolean } }>(
      `/api/superadmin/team/${id}/toggle-status`,
      { method: "PATCH" },
    ).then(r => r.data),

  delete: (id: string) =>
    apiFetch<{ success: true; message: string }>(`/api/superadmin/team/${id}`, {
      method: "DELETE",
    }),
};

// ── Vendor Dashboard — Team Members ──────────────────────────────────────────

export const vendorTeamApi = {
  list: () =>
    apiFetch<{ success: true; data: ApiTeamMember[] }>("/api/vendor/team")
      .then(r => r.data.map(normalizeTeamMember)),

  create: (body: {
    full_name:     string;
    email:         string;
    mobile_number: string;
    password:      string;
    role_label:    string;
    permissions:   Record<string, string[]>;
    is_active?:    boolean;
  }) =>
    apiFetch<{ success: true; data: ApiTeamMember }>("/api/vendor/team", {
      method: "POST",
      body:   JSON.stringify(body),
    }).then(r => normalizeTeamMember(r.data)),

  update: (id: string, body: {
    full_name?:     string;
    email?:         string;
    mobile_number?: string;
    password?:      string;
    role_label?:    string;
    permissions?:   Record<string, string[]>;
    is_active?:     boolean;
  }) =>
    apiFetch<{ success: true; data: ApiTeamMember }>(`/api/vendor/team/${id}`, {
      method: "PUT",
      body:   JSON.stringify(body),
    }).then(r => normalizeTeamMember(r.data)),

  toggleStatus: (id: string) =>
    apiFetch<{ success: true; data: { id: string; is_active: boolean } }>(
      `/api/vendor/team/${id}/toggle-status`,
      { method: "PATCH" },
    ).then(r => r.data),

  delete: (id: string) =>
    apiFetch<{ success: true; message: string }>(`/api/vendor/team/${id}`, {
      method: "DELETE",
    }),
};

export const vendorDriversApi = {
  documents: (id: string) =>
    apiFetch<{ success: true; data: DriverDocument[] }>(`/api/vendor/drivers/${id}/documents`),

  locationHistory: (
    id:    string,
    range: { from: string; to: string } | { hours: number },
  ) => {
    const qs = new URLSearchParams();
    if ("from" in range) {
      qs.set("from", range.from);
      qs.set("to",   range.to);
    } else {
      qs.set("hours", String(range.hours));
    }
    return apiFetch<DriverLocationHistoryResponse>(
      `/api/vendor/drivers/${id}/location-history?${qs.toString()}`,
    );
  },
};

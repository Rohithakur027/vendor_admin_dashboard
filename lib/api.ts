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

  const body = await res.json().catch(() => ({})) as { error?: string; message?: string; errors?: unknown };
  if (!res.ok) {
    const reason = body.error ?? body.message ?? `Request failed (${res.status})`;
    throw new Error(reason);
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

export interface CreateVendorPayload {
  name: string;
  pan?: string;
  contactPerson: string;
  email: string;
  phone: string;
  city: string;
  password: string;
  secondaryPOCs?: { name: string; email: string; phone: string }[];
  walletAmount?: number;
  sendCredentials?: boolean;
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

  update: (id: string, payload: { status?: "Active" | "Inactive"; name?: string; city?: string }) =>
    apiFetch<{ success: true; data: VendorDetailApiItem }>(`/api/superadmin/vendors/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
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
};

// ── Supervisors ──────────────────────────────────────────────────────────────

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
  companies: string[];
  dailyHistory: { date: string; amount: number; bookings: number }[];
}

export const supervisorsApi = {
  list: () =>
    apiFetch<{ success: true; data: SupervisorApiData[] }>("/api/vendor/supervisors"),

  create: (payload: {
    name: string; email: string; phone: string; zone?: string;
    password: string; status?: "Active" | "Inactive";
    companies?: string[];
    sendCredentials?: boolean;
  }) =>
    apiFetch<{ success: true; data: SupervisorApiData }>("/api/vendor/supervisors", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: {
    name?: string; email?: string; phone?: string; zone?: string;
    status?: "Active" | "Inactive";
    companies?: string[];
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

  bookingEnquiries: {
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
};

// ── Superadmin — Vendor Reports ──────────────────────────────────────────────

export interface VendorListItem {
  id: string;
  name: string;
  city: string;
  status: string;
  walletBalance: number;
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
  bookingRef: string | null;
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

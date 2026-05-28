// Single source of truth for which columns are available per table,
// what they show, and which are visible by default.
// Reused by every table page, the Columns popover, and the Settings page.

export type TableKey =
  // Vendor admin
  | "activeTrips" | "scheduledTrips" | "pastTrips"
  | "supervisors" | "drivers"        | "invoices"
  | "supervisorRecentTrips"
  // Super admin
  | "vendors"     | "unverifiedVendors" | "allDrivers" | "driverOnboarding"
  | "driverTrips" | "vendorTripsAdmin"
  | "superadminVendorReportTrips"
  | "generalBookingEnquiries" | "specialBookingEnquiries"
  | "superadminInvoices";

export type Role = "vendor_admin" | "superadmin";

export interface ColumnDef {
  key:        string;
  label:      string;
  dbFields:   string;   // helper text shown in settings ("trip_ref + type badge")
  minWidth:   number;
}

export interface TableSpec {
  key:        TableKey;
  title:      string;   // shown in settings page accordion
  blurb:      string;   // short description for settings
  role:       Role;
  columns:    ColumnDef[];
  defaults:   string[];
}

export const MIN_VISIBLE_COLUMNS = 3;

// ────────────────────────────────────────────────────────────────────────────
// Trips column set (shared across active / scheduled / past — only defaults differ)
// ────────────────────────────────────────────────────────────────────────────
const TRIP_COLUMNS: ColumnDef[] = [
  { key: "tripId",            label: "Trip ID & Type",       dbFields: "trip_ref + type badge",            minWidth: 130 },
  { key: "route",             label: "Route",                dbFields: "pickup_address → drop_address",    minWidth: 200 },
  { key: "supervisorCompany", label: "Supervisor & Company", dbFields: "supervisor name + company badge",  minWidth: 160 },
  { key: "vehicle",           label: "Vehicle",              dbFields: "vehicle_type",                     minWidth: 140 },
  { key: "driver",            label: "Driver",               dbFields: "driver name",                      minWidth: 130 },
  { key: "status",            label: "Status",               dbFields: "status badge",                     minWidth: 110 },
  { key: "pickupTime",        label: "Pickup Time",          dbFields: "pickup_time (IST)",                minWidth: 140 },
  { key: "scheduledAt",       label: "Scheduled At",         dbFields: "scheduled_at (IST)",               minWidth: 140 },
  { key: "createdAt",         label: "Created At",           dbFields: "created_at (IST)",                 minWidth: 140 },
  { key: "completedAt",       label: "Completed At",         dbFields: "completed_at (IST)",               minWidth: 140 },
  { key: "startedAt",         label: "Started At",           dbFields: "started_at (IST)",                 minWidth: 140 },
  { key: "fare",              label: "Fare",                 dbFields: "fare",                             minWidth: 100 },
  { key: "passengers",        label: "Passengers",           dbFields: "passenger_count",                  minWidth: 100 },
  { key: "distance",          label: "Distance",             dbFields: "distance_km",                      minWidth: 100 },
  { key: "escort",            label: "Escort",               dbFields: "escort_required + escort_pickup",  minWidth: 140 },
  { key: "notes",             label: "Notes",                dbFields: "notes",                            minWidth: 160 },
  { key: "pickupLatLng",      label: "Pickup Lat/Lng",       dbFields: "pickup_lat + pickup_lng",          minWidth: 140 },
  { key: "dropLatLng",        label: "Drop Lat/Lng",         dbFields: "drop_lat + drop_lng",              minWidth: 140 },
];

// Extends TRIP_COLUMNS with a Vendor column — used on superadmin detail pages.
const TRIP_COLUMNS_WITH_VENDOR: ColumnDef[] = [
  ...TRIP_COLUMNS,
  { key: "vendor", label: "Vendor", dbFields: "vendor_name", minWidth: 140 },
];

// ────────────────────────────────────────────────────────────────────────────
// Table specs
// ────────────────────────────────────────────────────────────────────────────
export const TABLE_SPECS: Record<TableKey, TableSpec> = {
  activeTrips: {
    key: "activeTrips", role: "vendor_admin",
    title: "Active Trips", blurb: "Ongoing trips assigned to drivers",
    columns: TRIP_COLUMNS,
    defaults: ["tripId", "route", "supervisorCompany", "vehicle", "driver", "status", "createdAt"],
  },
  scheduledTrips: {
    key: "scheduledTrips", role: "vendor_admin",
    title: "Scheduled Trips", blurb: "Upcoming trips waiting to be assigned",
    columns: TRIP_COLUMNS,
    defaults: ["tripId", "route", "supervisorCompany", "vehicle", "driver", "status", "createdAt", "scheduledAt"],
  },
  pastTrips: {
    key: "pastTrips", role: "vendor_admin",
    title: "Past Trips", blurb: "Completed and cancelled trips",
    columns: TRIP_COLUMNS,
    defaults: ["tripId", "route", "supervisorCompany", "vehicle", "driver", "fare", "status", "createdAt", "completedAt"],
  },

  supervisors: {
    key: "supervisors", role: "vendor_admin",
    title: "Supervisors", blurb: "All supervisors under your account",
    columns: [
      { key: "name",       label: "Name",        dbFields: "name",                    minWidth: 150 },
      { key: "email",      label: "Email",       dbFields: "email",                   minWidth: 180 },
      { key: "phone",      label: "Phone",       dbFields: "phone",                   minWidth: 130 },
      { key: "zone",       label: "Zone",        dbFields: "zone",                    minWidth: 120 },
      { key: "status",     label: "Status",      dbFields: "status + is_online",      minWidth: 120 },
      { key: "lastSeen",   label: "Last Active", dbFields: "last_seen_at (IST)",      minWidth: 140 },
      { key: "walletUsed", label: "Wallet Used", dbFields: "wallet_used",             minWidth: 120 },
      { key: "createdAt",  label: "Joined On",   dbFields: "created_at (IST)",        minWidth: 140 },
    ],
    defaults: ["name", "email", "phone", "zone", "status"],
  },

  drivers: {
    key: "drivers", role: "vendor_admin",
    title: "Drivers", blurb: "Drivers attached to your vendor account",
    columns: [
      { key: "name",       label: "Name",          dbFields: "name",                            minWidth: 150 },
      { key: "phone",      label: "Phone",         dbFields: "phone",                           minWidth: 130 },
      { key: "status",     label: "Status",        dbFields: "status + is_online + is_verified",minWidth: 130 },
      { key: "supervisor", label: "Supervisor",    dbFields: "assigned_supervisor_name",        minWidth: 160 },
      { key: "totalTrips", label: "Total Trips",   dbFields: "total_trips",                     minWidth: 110 },
      { key: "lastSeen",   label: "Last Active",   dbFields: "last_active (IST)",               minWidth: 140 },
      { key: "vehicle",    label: "Vehicle",       dbFields: "vehicle + vehicle_reg",           minWidth: 180 },
      { key: "ref",        label: "Driver Ref",    dbFields: "driver_ref",                      minWidth: 130 },
    ],
    defaults: ["name", "phone", "status", "supervisor", "totalTrips", "lastSeen"],
  },

  supervisorRecentTrips: {
    key: "supervisorRecentTrips", role: "vendor_admin",
    title: "Supervisor Recent Trips", blurb: "Trips list on the supervisor profile page",
    columns: TRIP_COLUMNS,
    defaults: ["tripId", "route", "supervisorCompany", "vehicle", "driver", "status", "createdAt"],
  },

  invoices: {
    key: "invoices", role: "vendor_admin",
    title: "Invoices", blurb: "Generated invoices and their status",
    columns: [
      { key: "invoiceNo",  label: "Invoice No.", dbFields: "invoice_number",        minWidth: 130 },
      { key: "company",    label: "Company",     dbFields: "company_id (name)",     minWidth: 150 },
      { key: "period",     label: "Period",      dbFields: "period_from + period_to",minWidth: 160 },
      { key: "amount",     label: "Amount",      dbFields: "amount",                minWidth: 110 },
      { key: "status",     label: "Status",      dbFields: "status badge",          minWidth: 120 },
      { key: "issuedAt",   label: "Issued On",   dbFields: "issued_at",             minWidth: 130 },
      { key: "dueDate",    label: "Due Date",    dbFields: "due_date",              minWidth: 130 },
      { key: "paidAt",     label: "Paid On",     dbFields: "paid_at",               minWidth: 130 },
      { key: "paymentRef", label: "Payment Ref", dbFields: "payment_ref",           minWidth: 140 },
      { key: "notes",      label: "Notes",       dbFields: "notes",                 minWidth: 160 },
      { key: "createdAt",  label: "Created At",  dbFields: "created_at (IST)",      minWidth: 140 },
    ],
    defaults: ["invoiceNo", "company", "period", "amount", "status", "issuedAt", "dueDate"],
  },

  vendors: {
    key: "vendors", role: "superadmin",
    title: "Vendors", blurb: "All vendor companies on the platform",
    columns: [
      { key: "name",          label: "Vendor Name",    dbFields: "name",                    minWidth: 160 },
      { key: "city",          label: "City",           dbFields: "city",                    minWidth: 120 },
      { key: "email",         label: "Email",          dbFields: "email",                   minWidth: 180 },
      { key: "phone",         label: "Phone",          dbFields: "phone",                   minWidth: 140 },
      { key: "contactPerson", label: "Contact Person", dbFields: "contact_person",          minWidth: 150 },
      { key: "status",        label: "Status",         dbFields: "status badge",            minWidth: 110 },
      { key: "billingType",   label: "Billing Type",   dbFields: "billing_type",            minWidth: 130 },
      { key: "creditLimit",   label: "Credit Limit",   dbFields: "credit_limit",            minWidth: 140 },
      { key: "wallet",        label: "Wallet Balance", dbFields: "wallet_balance",          minWidth: 140 },
      { key: "pan",           label: "PAN Card",       dbFields: "pan_card_number",         minWidth: 150 },
      { key: "gst",           label: "GST Number",     dbFields: "gst_number",              minWidth: 160 },
      { key: "address",       label: "Address",        dbFields: "address",                 minWidth: 200 },
      { key: "createdAt",     label: "Joined On",      dbFields: "created_at (IST)",        minWidth: 130 },
    ],
    defaults: ["name", "email", "phone", "contactPerson", "status", "billingType", "createdAt"],
  },

  unverifiedVendors: {
    key: "unverifiedVendors", role: "superadmin",
    title: "Unverified Vendors", blurb: "Vendor signup requests pending review",
    columns: [
      { key: "name",          label: "Vendor",         dbFields: "name",           minWidth: 180 },
      { key: "email",         label: "Email",          dbFields: "email",          minWidth: 200 },
      { key: "phone",         label: "Phone",          dbFields: "phone",          minWidth: 140 },
      { key: "contactPerson", label: "Contact Person", dbFields: "contact_person", minWidth: 160 },
      { key: "reviewStatus",  label: "Review Status",  dbFields: "is_verified",   minWidth: 140 },
    ],
    defaults: ["name", "email", "phone", "contactPerson", "reviewStatus"],
  },

  allDrivers: {
    key: "allDrivers", role: "superadmin",
    title: "All Drivers", blurb: "Every driver across all vendors",
    columns: [
      { key: "name",       label: "Driver",       dbFields: "name + driver_ref",               minWidth: 180 },
      { key: "phone",      label: "Phone",        dbFields: "phone",                           minWidth: 140 },
      { key: "email",      label: "Email",        dbFields: "email",                           minWidth: 200 },
      { key: "status",     label: "Status",       dbFields: "status + is_online + is_verified",minWidth: 140 },
      { key: "vehicle",    label: "Vehicle",      dbFields: "plate_number + model + type",     minWidth: 180 },
      { key: "lastSeen",   label: "Last Active",  dbFields: "last_active_at (IST)",            minWidth: 150 },
      { key: "createdAt",  label: "Joined On",    dbFields: "created_at (IST)",                minWidth: 140 },
    ],
    defaults: ["name", "phone", "vehicle", "status", "lastSeen", "createdAt"],
  },

  driverOnboarding: {
    key: "driverOnboarding", role: "superadmin",
    title: "Driver Onboarding", blurb: "Pending driver applications",
    columns: [
      { key: "name",      label: "Driver",        dbFields: "name",                       minWidth: 150 },
      { key: "phone",     label: "Phone",         dbFields: "phone",                      minWidth: 130 },
      { key: "email",     label: "Email",         dbFields: "email",                      minWidth: 180 },
      { key: "zone",      label: "Zone",          dbFields: "zone",                       minWidth: 120 },
      { key: "status",    label: "Status",        dbFields: "status + is_verified badge", minWidth: 130 },
      { key: "createdAt", label: "Registered",    dbFields: "created_at (IST)",           minWidth: 140 },
      { key: "dob",       label: "Date of Birth", dbFields: "date_of_birth",              minWidth: 130 },
      { key: "address",   label: "Address",       dbFields: "address",                    minWidth: 180 },
    ],
    defaults: ["name", "phone", "createdAt", "status"],
  },

  driverTrips: {
    key: "driverTrips", role: "superadmin",
    title: "Driver Recent Trips", blurb: "Trips completed by this driver",
    columns: TRIP_COLUMNS_WITH_VENDOR,
    defaults: ["tripId", "route", "supervisorCompany", "fare", "status", "createdAt"],
  },

  vendorTripsAdmin: {
    key: "vendorTripsAdmin", role: "superadmin",
    title: "Vendor Trips (Admin)", blurb: "Trips list shown on the superadmin vendor detail page",
    columns: TRIP_COLUMNS_WITH_VENDOR,
    defaults: ["tripId", "route", "supervisorCompany", "vehicle", "driver", "fare", "status", "createdAt"],
  },

  superadminVendorReportTrips: {
    key: "superadminVendorReportTrips", role: "superadmin",
    title: "Vendor Report Trips", blurb: "Trips list shown in the superadmin vendor report view",
    columns: TRIP_COLUMNS_WITH_VENDOR,
    defaults: ["tripId", "route", "supervisorCompany", "vendor", "vehicle", "driver", "fare", "status", "createdAt"],
  },

  generalBookingEnquiries: {
    key: "generalBookingEnquiries", role: "superadmin",
    title: "Booking Enquiries", blurb: "Customer booking requests",
    columns: [
      { key: "enqRef",          label: "Booking ID",       dbFields: "enq_ref",                        minWidth: 130 },
      { key: "status",          label: "Status",           dbFields: "website_booking_status",         minWidth: 120 },
      { key: "customer",        label: "Customer",         dbFields: "customer_name + email + phone",  minWidth: 180 },
      { key: "route",           label: "Route",            dbFields: "pickup_location → destination",  minWidth: 220 },
      { key: "type",            label: "Vehicle Type",     dbFields: "vehicle_type + is_scheduled",    minWidth: 150 },
      { key: "bookingCategory", label: "Booking Category", dbFields: "booking_type",                   minWidth: 150 },
      { key: "passengers",      label: "Passengers",       dbFields: "passengers",                     minWidth: 110 },
      { key: "createdAt",       label: "Created At",       dbFields: "created_at (IST)",               minWidth: 150 },
      { key: "distance",        label: "Distance",         dbFields: "distance_km",                    minWidth: 110 },
      { key: "scheduledAt",     label: "Scheduled At",     dbFields: "scheduled_at (IST)",             minWidth: 150 },
      { key: "isReturnTrip",    label: "Return Trip",      dbFields: "is_return_trip",                 minWidth: 120 },
      { key: "returnAt",        label: "Return Date",      dbFields: "return_at (IST)",                minWidth: 150 },
    ],
    defaults: ["enqRef", "status", "customer", "route", "type", "createdAt", "passengers"],
  },

  superadminInvoices: {
    key: "superadminInvoices", role: "superadmin",
    title: "Vendor Invoices", blurb: "Invoices generated for vendors by superadmin",
    columns: [
      { key: "invoiceNo",  label: "Invoice No.", dbFields: "invoice_number",         minWidth: 130 },
      { key: "vendor",     label: "Vendor",      dbFields: "vendor_id (name)",        minWidth: 160 },
      { key: "period",     label: "Period",      dbFields: "period_from + period_to", minWidth: 160 },
      { key: "amount",     label: "Amount",      dbFields: "amount",                  minWidth: 110 },
      { key: "status",     label: "Status",      dbFields: "status badge",            minWidth: 120 },
      { key: "issuedAt",   label: "Issued On",   dbFields: "issued_at",               minWidth: 130 },
      { key: "dueDate",    label: "Due Date",    dbFields: "due_date",                minWidth: 130 },
      { key: "paidAt",     label: "Paid On",     dbFields: "paid_at",                 minWidth: 130 },
      { key: "paymentRef", label: "Payment Ref", dbFields: "payment_ref",             minWidth: 140 },
      { key: "notes",      label: "Notes",       dbFields: "notes",                   minWidth: 160 },
    ],
    defaults: ["invoiceNo", "vendor", "period", "amount", "status", "issuedAt", "dueDate"],
  },

  specialBookingEnquiries: {
    key: "specialBookingEnquiries", role: "superadmin",
    title: "Special Enquiry", blurb: "Special enquiries from the website",
    columns: [
      { key: "enqRef",      label: "Enquiry ID",   dbFields: "enq_ref",               minWidth: 130 },
      { key: "name",        label: "Customer",     dbFields: "name + email + mobile",  minWidth: 180 },
      { key: "companyName", label: "Company",      dbFields: "company_name",           minWidth: 160 },
      { key: "message",     label: "Message",      dbFields: "message",                minWidth: 220 },
      { key: "createdAt",   label: "Created At",   dbFields: "created_at (IST)",       minWidth: 150 },
      { key: "email",       label: "Email",        dbFields: "email",                  minWidth: 180 },
      { key: "mobile",      label: "Mobile",       dbFields: "mobile",                 minWidth: 130 },
    ],
    defaults: ["enqRef", "name", "companyName", "message", "createdAt"],
  },
};

export function tablesForRole(role: Role | string | undefined | null): TableSpec[] {
  if (role === "vendor_admin") {
    return [
      TABLE_SPECS.activeTrips,
      TABLE_SPECS.scheduledTrips,
      TABLE_SPECS.pastTrips,
      TABLE_SPECS.supervisors,
      TABLE_SPECS.drivers,
      TABLE_SPECS.invoices,
      TABLE_SPECS.supervisorRecentTrips,
    ];
  }
  if (role === "superadmin") {
    return [
      TABLE_SPECS.vendors,
      TABLE_SPECS.allDrivers,
      TABLE_SPECS.driverOnboarding,
      TABLE_SPECS.driverTrips,
      TABLE_SPECS.vendorTripsAdmin,
      TABLE_SPECS.generalBookingEnquiries,
      TABLE_SPECS.specialBookingEnquiries,
      TABLE_SPECS.superadminInvoices,
    ];
  }
  return [];
}

export function getTableSpec(key: TableKey): TableSpec {
  return TABLE_SPECS[key];
}

// JSON shape stored in user_table_preferences.preference_value
export interface ColumnPrefValue {
  columns: string[]; // ordered list of visible column keys
}

export function defaultColumnsFor(key: TableKey): string[] {
  return TABLE_SPECS[key].defaults.slice();
}

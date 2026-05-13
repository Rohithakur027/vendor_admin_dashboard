// Single source of truth for which columns are available per table,
// what they show, and which are visible by default.
// Reused by every table page, the Columns popover, and the Settings page.

export type TableKey =
  // Vendor admin
  | "activeTrips" | "scheduledTrips" | "pastTrips"
  | "supervisors" | "drivers"        | "invoices"
  // Super admin
  | "vendors"     | "allDrivers"     | "driverOnboarding";

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
  { key: "invoice",           label: "Invoice",              dbFields: "invoice_id",                       minWidth: 130 },
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
      { key: "ref",        label: "Ref",         dbFields: "supervisor_ref",          minWidth: 110 },
      { key: "name",       label: "Name",        dbFields: "name",                    minWidth: 150 },
      { key: "email",      label: "Email",       dbFields: "email",                   minWidth: 180 },
      { key: "phone",      label: "Phone",       dbFields: "phone",                   minWidth: 130 },
      { key: "zone",       label: "Zone",        dbFields: "zone",                    minWidth: 120 },
      { key: "status",     label: "Status",      dbFields: "status + is_online",      minWidth: 120 },
      { key: "lastSeen",   label: "Last Active", dbFields: "last_seen_at (IST)",      minWidth: 140 },
      { key: "walletUsed", label: "Wallet Used", dbFields: "wallet_used",             minWidth: 120 },
      { key: "createdAt",  label: "Joined On",   dbFields: "created_at (IST)",        minWidth: 140 },
    ],
    defaults: ["ref", "name", "email", "phone", "zone", "status"],
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
      { key: "name",      label: "Vendor Name", dbFields: "name",                                 minWidth: 160 },
      { key: "city",      label: "City",        dbFields: "city",                                 minWidth: 120 },
      { key: "status",    label: "Status",      dbFields: "status badge",                         minWidth: 120 },
      { key: "wallet",    label: "Wallet",      dbFields: "wallet_balance + wallet_alert_threshold", minWidth: 150 },
      { key: "pan",       label: "PAN Card",    dbFields: "pan_card_number",                      minWidth: 140 },
      { key: "createdAt", label: "Joined On",   dbFields: "created_at (IST)",                     minWidth: 140 },
    ],
    defaults: ["name", "city", "status", "createdAt"],
  },

  allDrivers: {
    key: "allDrivers", role: "superadmin",
    title: "All Drivers", blurb: "Every driver across all vendors",
    columns: [
      { key: "name",       label: "Driver",      dbFields: "name",                            minWidth: 150 },
      { key: "phone",      label: "Phone",       dbFields: "phone",                           minWidth: 130 },
      { key: "zone",       label: "Zone",        dbFields: "zone",                            minWidth: 120 },
      { key: "status",     label: "Status",      dbFields: "status + is_online + is_verified",minWidth: 130 },
      { key: "lastSeen",   label: "Last Active", dbFields: "last_seen_at (IST)",              minWidth: 140 },
      { key: "totalTrips", label: "Total Trips", dbFields: "total_trips",                     minWidth: 110 },
      { key: "createdAt",  label: "Joined On",   dbFields: "created_at (IST)",                minWidth: 140 },
    ],
    defaults: ["name", "phone", "status", "lastSeen"],
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
    ];
  }
  if (role === "superadmin") {
    return [
      TABLE_SPECS.vendors,
      TABLE_SPECS.allDrivers,
      TABLE_SPECS.driverOnboarding,
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

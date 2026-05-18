export type SupervisorStatus = "Active" | "Inactive";

export interface DailyRecord {
  date: string; // YYYY-MM-DD
  amount: number;
  bookings: number;
}

export interface SupervisorCompany {
  name:    string;
  address: string | null;
  city:    string | null;
  state:   string | null;
  pincode: string | null;
}

export interface Supervisor {
  id: string;
  ref: string;
  name: string;
  email: string;
  phone: string;
  zone: string;
  appAccess: boolean;
  status: SupervisorStatus;
  bookingsToday: number;
  isOnline: boolean;
  createdAt: string;
  walletUsed: number;
  companies: SupervisorCompany[];
  dailyHistory: DailyRecord[];
}

export interface SupervisorFormData {
  name: string;
  email: string;
  phone: string;
  zone: string;
  password: string;
  status: SupervisorStatus;
  companies: SupervisorCompany[];
  sendCredentials?: boolean;
}

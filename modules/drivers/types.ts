export type DriverStatus = "Available" | "On Trip" | "Offline";

export interface DriverTrip {
  bookingId: string;
  from: string;
  to: string;
  date: string;
  supervisorName: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle?: string;
  vehicleReg?: string;
  vehicleColor?: string;
  vehicleType?: string;
  status: DriverStatus;
  assignedSupervisorId: string | null;
  assignedSupervisorName: string | null;
  totalTrips: number;
  lastActive: string;
  recentTrips: DriverTrip[];
}

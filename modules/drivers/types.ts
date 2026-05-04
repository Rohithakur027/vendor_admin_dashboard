export type DriverStatus = "Available" | "On Trip" | "Offline";

export interface DriverTrip {
  bookingId: string;
  tripRef: string | null;
  from: string;
  to: string;
  date: string;
  supervisorName: string;
}

export interface Driver {
  id: string;
  driverRef?: string | null;
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

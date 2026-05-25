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
  email?: string;
  dob?: string;
  gender?: string;
  vehicle?: string;
  vehicleReg?: string;
  vehicleColor?: string;
  vehicleType?: string;
  vehicleYear?: number;
  vehicleMakeYear?: number;
  vehicleChassisNumber?: string;
  vehicleEngineNumber?: string;
  vehicleOwnerName?: string;
  vehicleAssignedAt?: string;
  vehicleUpdatedAt?: string;
  vehicles?: {
    id?: string;
    plateNumber: string;
    model?: string;
    type?: string;
    color?: string;
    makeYear?: number;
    isActive?: boolean;
  }[];
  status: DriverStatus;
  assignedSupervisorId: string | null;
  assignedSupervisorName: string | null;
  totalTrips: number;
  lastActive: string;
  recentTrips: DriverTrip[];
}

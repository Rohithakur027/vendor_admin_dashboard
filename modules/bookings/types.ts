export type BookingType = "Instant" | "Scheduled";
export type BookingStatus = "Pending" | "Ongoing" | "Completed" | "Cancelled";

export interface DriverInterest {
  driverId: string;
  driverName: string;
  driverPhone: string;
  requestedAt: string;
  status: "Pending" | "Accepted" | "Rejected";
}

export interface BookingTimelineEvent {
  time: string;
  event: string;
}

export interface Booking {
  id: string;
  type: BookingType;
  supervisorId: string;
  supervisorName: string;
  driverId: string | null;
  driverName: string | null;
  pickupLocation: string;
  dropLocation: string;
  scheduledTime: string | null;
  status: BookingStatus;
  createdAt: string;
  completedAt?: string | null;
  fare?: number;              // trip fare in ₹
  passengers?: number;        // number of passengers
  bookingSource?: string;    // company name or "Individual"
  // Scheduled booking specific
  interestedDrivers?: DriverInterest[];
  supervisorDecisionAt?: string | null;
  // Instant booking specific
  timeline?: BookingTimelineEvent[];
  // Live tracking
  bookingRef?: string | null;
  driverPhone?: string | null;
  pickupTime?: string | null;
}

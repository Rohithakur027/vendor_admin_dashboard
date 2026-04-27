export type DocStatus = "Pending" | "Approved" | "Rejected";

export interface VerificationDoc {
  id:              string;
  name:            string;
  docType:         "license" | "aadhaar" | "rc" | "photo";
  uploaded:        boolean;
  status:          DocStatus;
  rejectionReason: string;
}

export interface PendingDriver {
  id:           string;
  name:         string;
  phone:        string;
  vendor:       string;
  registeredAt: string;
  docs:         VerificationDoc[];
}

export const INIT_PENDING: PendingDriver[] = [
  {
    id: "pdrv-001", name: "Vikram Singh", phone: "+91 91234 56789",
    vendor: "SK Travels", registeredAt: "2024-04-20T10:00:00",
    docs: [
      { id: "dl",      name: "Driving License",  docType: "license", uploaded: true,  status: "Pending", rejectionReason: "" },
      { id: "aadhaar", name: "Aadhaar Card",      docType: "aadhaar", uploaded: true,  status: "Pending", rejectionReason: "" },
      { id: "rc",      name: "Vehicle RC",        docType: "rc",      uploaded: true,  status: "Pending", rejectionReason: "" },
      { id: "photo",   name: "Profile Photo",     docType: "photo",   uploaded: true,  status: "Pending", rejectionReason: "" },
    ],
  },
  {
    id: "pdrv-002", name: "Sunil Patkar", phone: "+91 98765 11223",
    vendor: "City Cabs Pvt Ltd", registeredAt: "2024-04-19T14:30:00",
    docs: [
      { id: "dl",      name: "Driving License",  docType: "license", uploaded: true,  status: "Approved", rejectionReason: "" },
      { id: "aadhaar", name: "Aadhaar Card",      docType: "aadhaar", uploaded: true,  status: "Approved", rejectionReason: "" },
      { id: "rc",      name: "Vehicle RC",        docType: "rc",      uploaded: true,  status: "Pending",  rejectionReason: "" },
      { id: "photo",   name: "Profile Photo",     docType: "photo",   uploaded: false, status: "Pending",  rejectionReason: "" },
    ],
  },
  {
    id: "pdrv-003", name: "Ravindra Kulkarni", phone: "+91 87654 99001",
    vendor: "FastRide Solutions", registeredAt: "2024-04-21T09:00:00",
    docs: [
      { id: "dl",      name: "Driving License",  docType: "license", uploaded: true,  status: "Rejected", rejectionReason: "License appears to be expired" },
      { id: "aadhaar", name: "Aadhaar Card",      docType: "aadhaar", uploaded: true,  status: "Approved", rejectionReason: "" },
      { id: "rc",      name: "Vehicle RC",        docType: "rc",      uploaded: false, status: "Pending",  rejectionReason: "" },
      { id: "photo",   name: "Profile Photo",     docType: "photo",   uploaded: true,  status: "Approved", rejectionReason: "" },
    ],
  },
  {
    id: "pdrv-004", name: "Dilip Joshi", phone: "+91 76543 22334",
    vendor: "Metro Movers", registeredAt: "2024-04-22T08:15:00",
    docs: [
      { id: "dl",      name: "Driving License",  docType: "license", uploaded: true,  status: "Pending", rejectionReason: "" },
      { id: "aadhaar", name: "Aadhaar Card",      docType: "aadhaar", uploaded: false, status: "Pending", rejectionReason: "" },
      { id: "rc",      name: "Vehicle RC",        docType: "rc",      uploaded: false, status: "Pending", rejectionReason: "" },
      { id: "photo",   name: "Profile Photo",     docType: "photo",   uploaded: false, status: "Pending", rejectionReason: "" },
    ],
  },
  {
    id: "pdrv-005", name: "Karthik Murali", phone: "+91 65432 33445",
    vendor: "QuickDrive Transport", registeredAt: "2024-04-22T11:45:00",
    docs: [
      { id: "dl",      name: "Driving License",  docType: "license", uploaded: true,  status: "Pending",  rejectionReason: "" },
      { id: "aadhaar", name: "Aadhaar Card",      docType: "aadhaar", uploaded: true,  status: "Approved", rejectionReason: "" },
      { id: "rc",      name: "Vehicle RC",        docType: "rc",      uploaded: true,  status: "Pending",  rejectionReason: "" },
      { id: "photo",   name: "Profile Photo",     docType: "photo",   uploaded: false, status: "Pending",  rejectionReason: "" },
    ],
  },
];

export function overallStatus(docs: VerificationDoc[]) {
  if (docs.some(d => d.status === "Rejected")) return "Rejected";
  if (docs.every(d => d.status === "Approved")) return "Approved";
  if (docs.some(d => d.status === "Approved")) return "Partial";
  return "Pending";
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

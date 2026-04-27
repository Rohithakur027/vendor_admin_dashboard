"use client";

import { useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Supervisor } from "../types";
import { StatusBadge } from "@/components/StatusBadge";

const MockSeparator = () => (
  <div className="flex items-center gap-2.5 px-6 py-1.5 bg-amber-50 border-y border-dashed border-amber-200">
    <div className="flex-1 h-px bg-amber-200" />
    <span className="text-[9.5px] font-bold text-amber-600 tracking-widest uppercase whitespace-nowrap">Sample Data</span>
    <div className="flex-1 h-px bg-amber-200" />
  </div>
);

interface Props {
  supervisors: Supervisor[];
  onEdit: (supervisor: Supervisor) => void;
  onDelete: (id: string) => void;
  walletConsumedMap: Record<string, number>;
  bookingCountMap: Record<string, number>;
  hasDateFilter: boolean;
  splitAt?: number;
}

export function SupervisorTable({
  supervisors,
  onEdit,
  onDelete,
  walletConsumedMap,
  bookingCountMap,
  hasDateFilter,
  splitAt,
}: Props) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const router = useRouter();

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[900px]">
            {/* TH */}
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_130px_140px_110px_100px] items-center gap-6 px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SUPERVISOR</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">EMAIL</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PHONE</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">WALLET CONSUMED</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">BOOKINGS</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">STATUS</div>
            </div>

            {/* TBODY */}
            <div className="flex flex-col divide-y divide-slate-100">
              {supervisors.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <p className="text-sm font-medium">No supervisors found.</p>
                </div>
              ) : (
                supervisors.map((sup, idx) => {
                  const consumed  = walletConsumedMap[sup.id] ?? sup.walletUsed;
                  const bookings  = bookingCountMap[sup.id]   ?? 0;
                  const isActive  = sup.status === "Active";

                  return (
                    <Fragment key={sup.id}>
                      {splitAt !== undefined && idx === splitAt && splitAt > 0 && splitAt < supervisors.length && (
                        <MockSeparator />
                      )}
                    <div
                      onClick={() => router.push(`/dashboard/supervisors/${sup.id}`)}
                      className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.8fr)_130px_140px_110px_100px] items-center gap-6 px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      {/* Name */}
                      <div className="flex flex-col min-w-0">
                        <span className="font-extrabold text-[#111827] text-[13px] truncate">{sup.name}</span>
                        <span className="text-[11px] text-slate-400 font-medium truncate">{sup.id}</span>
                      </div>

                      {/* Email */}
                      <div className="flex items-center">
                        <span className="text-[13px] text-slate-600 font-medium truncate">{sup.email}</span>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center">
                        <span className="text-[13px] text-slate-600 font-medium">{sup.phone}</span>
                      </div>

                      {/* Wallet Consumed */}
                      <div>
                        <span className={`text-[15px] font-bold ${consumed === 0 ? "text-slate-300" : "text-slate-800"}`}>
                          ₹{consumed.toLocaleString("en-IN")}
                        </span>
                      </div>

                      {/* Bookings */}
                      <div>
                        <span className={`text-[14px] font-bold ${bookings === 0 ? "text-slate-300" : "text-slate-800"}`}>
                          {bookings}
                        </span>
                      </div>

                      {/* Status */}
                      <div>
                        <StatusBadge status={isActive ? "Active" : "Inactive"} size="sm" />
                      </div>
                    </div>
                    </Fragment>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supervisor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this supervisor? This action cannot be undone and will unassign them from their companies.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteTarget) {
                  onDelete(deleteTarget);
                  setDeleteTarget(null);
                }
              }}
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

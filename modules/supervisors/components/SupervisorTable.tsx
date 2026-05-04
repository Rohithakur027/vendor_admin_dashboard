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
import { Skeleton } from "@/components/ui/skeleton";

function formatPhone(raw: string): string {
  if (!raw) return raw;
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length > 10 ? digits.slice(2) : digits;
  return `+91 ${local}`;
}

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
  splitAt?: number;
  loading?: boolean;
}

export function SupervisorTable({
  supervisors,
  onEdit,
  onDelete,
  splitAt,
  loading,
}: Props) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const router = useRouter();

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="w-full overflow-x-auto">
          <div className="min-w-[700px]">
            {/* TH */}
            <div className="grid grid-cols-[minmax(180px,1.4fr)_minmax(220px,1.7fr)_minmax(140px,1fr)_110px] items-center gap-6 px-6 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SUPERVISOR</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">EMAIL</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PHONE</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">STATUS</div>
            </div>

            {/* TBODY */}
            <div className="flex flex-col divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-[minmax(180px,1.4fr)_minmax(220px,1.7fr)_minmax(140px,1fr)_110px] items-center gap-6 px-6 py-3.5">
                    <div className="space-y-1.5 min-w-0">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-3.5 w-28" />
                    <div className="flex justify-end">
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </div>
                  </div>
                ))
              ) : supervisors.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <p className="text-sm font-medium">No supervisors found.</p>
                </div>
              ) : (
                supervisors.map((sup, idx) => {
                  const isActive  = sup.status === "Active";

                  return (
                    <Fragment key={sup.id}>
                      {splitAt !== undefined && idx === splitAt && splitAt > 0 && splitAt < supervisors.length && (
                        <MockSeparator />
                      )}
                    <div
                      onClick={() => router.push(`/dashboard/supervisors/${sup.id}`)}
                      className="grid grid-cols-[minmax(180px,1.4fr)_minmax(220px,1.7fr)_minmax(140px,1fr)_110px] items-center gap-6 px-6 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      {/* Name */}
                      <div className="flex flex-col min-w-0">
                        <span className="font-extrabold text-[#111827] text-[13px] truncate">{sup.name}</span>
                        {sup.ref && (
                          <span className="text-[11px] text-slate-400 font-medium truncate">{sup.ref}</span>
                        )}
                      </div>

                      {/* Email */}
                      <div className="flex items-center">
                        <span className="text-[13px] text-slate-600 font-medium truncate">{sup.email}</span>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center">
                        <span className="text-[13px] text-slate-600 font-medium">{formatPhone(sup.phone)}</span>
                      </div>

                      {/* Status */}
                      <div className="flex justify-end">
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

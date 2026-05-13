"use client";

import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { ColumnSettingsSection } from "@/components/ColumnSettingsSection";
import { tablesForRole } from "@/lib/columnConfig";

const FONT = "var(--font-plus-jakarta-sans),'Plus Jakarta Sans',sans-serif";

export default function VendorSettingsPage() {
  // This route is under /dashboard/* → vendor_admin role. Layout already guards auth.
  const tables = tablesForRole("vendor_admin");
  const [activeKey, setActiveKey] = useState(tables[0]?.key ?? "");

  const active = tables.find(t => t.key === activeKey) ?? tables[0];

  return (
    <div style={{ fontFamily: FONT }} className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
          <SettingsIcon size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Settings</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Customize which columns appear in each table. Changes save automatically and are unique to your account.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">
        {/* Left rail — table picker */}
        <aside className="rounded-xl border border-slate-200 bg-white p-2 h-fit lg:sticky lg:top-4">
          <div className="px-3 py-2 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
            Tables
          </div>
          <nav className="flex flex-col gap-0.5">
            {tables.map(t => {
              const isActive = t.key === active?.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveKey(t.key)}
                  className={`text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-bold"
                      : "text-slate-600 hover:bg-slate-50 font-medium"
                  }`}
                >
                  {t.title}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right pane — current section */}
        <div>
          {active && <ColumnSettingsSection spec={active} />}
        </div>
      </div>
    </div>
  );
}

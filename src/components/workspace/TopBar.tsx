"use client";
import { Bell, CalendarDays, LayoutGrid, Search, Users } from "lucide-react";
import { BrandLockup } from "@/components/Brand";
import { workspace } from "@/mock/workspace";

export function TopBar() {
  return (
    <header className="flex h-16 items-center gap-4 border-b border-white/10 bg-[#0b1226] px-4">
      <BrandLockup />

      <div className="mx-auto flex w-full max-w-xl items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
        <Search size={16} />
        <span className="flex-1">Search anything... (⌘ + K)</span>
      </div>

      <div className="ml-auto flex items-center gap-4 text-slate-300">
        <button className="relative hover:text-white" aria-label="Notifications">
          <Bell size={20} />
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">3</span>
        </button>
        <button className="hover:text-white" aria-label="Teams"><Users size={20} /></button>
        <button className="hover:text-white" aria-label="Calendar"><CalendarDays size={20} /></button>
        <button className="hover:text-white" aria-label="Apps"><LayoutGrid size={20} /></button>
        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
            {workspace.user.initials}
          </span>
          <span className="hidden leading-tight xl:block">
            <span className="block text-sm font-semibold text-white">{workspace.user.name}</span>
            <span className="block text-xs text-slate-400">{workspace.user.role}</span>
          </span>
        </div>
      </div>
    </header>
  );
}

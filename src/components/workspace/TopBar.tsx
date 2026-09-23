"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { BrandLockup } from "@/components/Brand";
import { NotificationBell } from "@/components/workspace/NotificationBell";
import { openCreateProjectModal } from "@/components/workspace/WorkspaceCreateProjectModal";
import Link from "next/link";

type Me = { username: string; displayName: string | null };

export function TopBar() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/v1/users/me").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      if (d?.user) setMe(d.user);
    }).catch(() => {});
  }, []);

  const name = me?.displayName || me?.username || "…";
  const initials = name.trim().slice(0, 2).toUpperCase();

  return (
    <header className="flex h-16 items-center gap-4 border-b border-white/10 bg-[#0b1226] px-4">
      <Link href="/repositories">
        <BrandLockup />
      </Link>

      <div className="mx-auto hidden md:flex w-full max-w-xl items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-400">
        <Search size={16} />
        <span className="flex-1">Search anything... (⌘ + K)</span>
      </div>

      <div className="ml-auto flex items-center gap-3 text-slate-300">
        <Link
          href="/projects"
          className="hidden sm:inline-flex text-xs font-semibold text-slate-400 hover:text-white px-2 py-1 transition-colors"
        >
          Explore Directory
        </Link>
        <NotificationBell />
        <button
          type="button"
          onClick={openCreateProjectModal}
          className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
        >
          + New Project
        </button>
        <div className="flex items-center gap-2 border-l border-white/10 pl-3">
          <Link href={me ? `/u/${me.username}` : "#"} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
              {initials}
            </span>
            <span className="hidden leading-tight xl:block">
              <span className="block text-sm font-semibold text-white">{name}</span>
              <span className="block text-xs text-slate-400">{me ? `@${me.username}` : "…"}</span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

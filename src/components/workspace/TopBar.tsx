"use client";
import { useEffect, useState, useRef } from "react";
import {
  Search,
  Users,
  Calendar,
  LayoutGrid,
  ChevronDown,
  User,
  Settings,
  FolderGit2,
  LogOut,
  Sparkles,
} from "lucide-react";
import { BrandLockup } from "@/components/Brand";
import { NotificationBell } from "@/components/workspace/NotificationBell";
import { openCreateProjectModal } from "@/components/workspace/WorkspaceCreateProjectModal";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Me = { username: string; displayName: string | null; avatarUrl?: string | null };

export function TopBar() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/v1/users/me")
      .then(async (r) => {
        if (!r.ok) return;
        const d = await r.json();
        if (d?.user) setMe(d.user);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/v1/auth/login", { method: "DELETE" });
    } catch {}
    router.push("/login");
  }

  const name = me?.displayName || me?.username || "…";
  const initials = name.trim().slice(0, 2).toUpperCase();
  const profileUrl = me ? `/u/${me.username}` : "/login";

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-zinc-800 bg-black px-4 sm:px-6">
      <div className="flex items-center gap-4">
        <Link href="/repositories" className="hover:opacity-90 transition-opacity">
          <BrandLockup />
        </Link>
      </div>

      <div className="mx-4 hidden max-w-md flex-1 md:flex items-center">
        <div className="flex w-full items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-400 transition-colors focus-within:border-indigo-500/60 focus-within:text-zinc-200">
          <Search size={15} className="text-zinc-500" />
          <input
            type="text"
            placeholder="Search Klyro..."
            className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          <kbd className="hidden rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 sm:inline-block">
            Ctrl + K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 text-zinc-400">
        <button
          type="button"
          onClick={openCreateProjectModal}
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
        >
          + New Project
        </button>

        {/* Action icons from reference UI */}
        <div className="flex items-center gap-1">
          <NotificationBell />

          <Link
            href="/teams"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
            title="Teams & Members"
          >
            <Users size={17} />
          </Link>

          <Link
            href="/meetings"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
            title="Calendar & Meetings"
          >
            <Calendar size={17} />
          </Link>

          <Link
            href="/projects"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
            title="Projects Directory"
          >
            <LayoutGrid size={17} />
          </Link>
        </div>

        {/* User profile dropdown in the corner */}
        <div className="relative border-l border-zinc-800/80 pl-2 sm:pl-3" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 rounded-xl p-1 hover:bg-zinc-900 transition-all text-left focus:outline-none"
            aria-expanded={menuOpen}
          >
            <div className="relative">
              {me?.avatarUrl ? (
                <img
                  src={me.avatarUrl}
                  alt={name}
                  className="h-8 w-8 rounded-full object-cover ring-1 ring-zinc-700"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-600 text-xs font-bold text-white shadow-inner">
                  {initials}
                </span>
              )}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-black" />
            </div>

            <ChevronDown
              size={14}
              className={`text-zinc-400 transition-transform duration-200 ${
                menuOpen ? "rotate-180 text-white" : ""
              }`}
            />
          </button>

          {/* Super AMOLED Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-zinc-800 bg-black p-2 text-sm text-zinc-200 shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
              <div className="border-b border-zinc-800/80 px-3 py-2.5">
                <p className="truncate font-semibold text-white">{name}</p>
                <p className="truncate text-xs text-zinc-500">{me ? `@${me.username}` : ""}</p>
              </div>

              <div className="py-1">
                <Link
                  href={profileUrl}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
                >
                  <User size={15} className="text-indigo-400" />
                  <span>Your Profile</span>
                </Link>

                <Link
                  href="/repositories"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
                >
                  <FolderGit2 size={15} className="text-purple-400" />
                  <span>Your Repositories</span>
                </Link>

                <Link
                  href="/projects"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
                >
                  <Sparkles size={15} className="text-amber-400" />
                  <span>Explore Directory</span>
                </Link>

                <Link
                  href="/onboarding"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
                >
                  <Settings size={15} className="text-zinc-400" />
                  <span>Account Settings</span>
                </Link>
              </div>

              <div className="border-t border-zinc-800/80 pt-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors"
                >
                  <LogOut size={15} />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

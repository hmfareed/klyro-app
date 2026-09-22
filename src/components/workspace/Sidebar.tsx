"use client";
import {
  CalendarDays,
  ChevronDown,
  FolderGit2,
  FolderKanban,
  GitPullRequest,
  HardDrive,
  Home,
  MessageSquare,
  CirclePlus,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { navCounts, recentRepos, repo, workspace } from "@/mock/workspace";

const NAV = [
  { label: "Home", icon: Home },
  { label: "Repositories", icon: FolderGit2, active: true },
  { label: "Pull Requests", icon: GitPullRequest },
  { label: "Issues", icon: CirclePlus },
  { label: "Projects", icon: FolderKanban },
  { label: "Teams", icon: Users },
  { label: "Chat", icon: MessageSquare },
  { label: "Meetings", icon: Video },
  { label: "Drive", icon: HardDrive },
  { label: "AI Assistant", icon: Sparkles, badge: "Beta" },
];

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-[#0b1226]">
      <button className="flex items-center gap-2 px-4 pb-3 pt-4 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white">F</span>
        <span className="flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold text-white">{workspace.name}</span>
          <span className="block text-xs text-slate-400">{workspace.tagline}</span>
        </span>
        <ChevronDown size={16} className="text-slate-400" />
      </button>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {NAV.map((item) => (
          <a
            key={item.label}
            href={item.label === "Repositories" ? `/repositories/${repo.slug}` : "#"}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
              item.active ? "bg-indigo-600/90 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <item.icon size={18} />
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">{item.badge}</span>
            )}
            {navCounts[item.label] !== undefined && (
              <span className={`rounded-md px-1.5 py-0.5 text-xs ${item.active ? "bg-white/20 text-white" : "bg-white/5 text-slate-400"}`}>
                {navCounts[item.label]}
              </span>
            )}
          </a>
        ))}

        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recent</p>
        {recentRepos.map((name) => (
          <a
            key={name}
            href={`/repositories/${name}`}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
              name === repo.slug ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <FolderGit2 size={15} />
            <span className="truncate">{name}</span>
          </a>
        ))}
      </nav>

      <div className="p-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">Need help?</p>
          <p className="mt-1 text-xs text-slate-400">Check out our docs or join our community.</p>
        </div>
        <p className="mt-3 flex items-center gap-1.5 px-1 text-xs text-slate-500">
          <CalendarDays size={13} /> Klyro Phase 0 — UI shell + mock data
        </p>
      </div>
    </aside>
  );
}

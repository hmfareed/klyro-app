"use client";
import { useEffect, useState } from "react";
import {
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

type Project = { slug: string; title: string };

// Sidebar is data-driven: real workspace name, real project list.
// New users see zero badges and an empty Recent section — never mock names.
export function Sidebar() {
  const [me, setMe] = useState<{ username: string; displayName: string | null } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch("/api/v1/users/me").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      if (d?.user) setMe(d.user);
    }).catch(() => {});
    fetch("/api/v1/projects").then(async (r) => {
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d?.projects)) setProjects(d.projects);
    }).catch(() => {});
  }, []);

  const workspaceName = me ? `${me.displayName || me.username}'s Workspace` : "Your Workspace";
  const initial = (me?.displayName || me?.username || "?").trim().slice(0, 1).toUpperCase();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-[#0b1226]">
      <button className="flex items-center gap-2 px-4 pb-3 pt-4 text-left">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white">{initial}</span>
        <span className="flex-1 leading-tight">
          <span className="block truncate text-sm font-semibold text-white">{workspaceName}</span>
          <span className="block text-xs text-slate-400">Build. Collaborate. Ship.</span>
        </span>
        <ChevronDown size={16} className="text-slate-400" />
      </button>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
        {NAV.map((item) => (
          <a
            key={item.label}
            href={item.label === "Repositories" ? "/repositories" : "#"}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
              item.active ? "bg-indigo-600/90 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <item.icon size={18} />
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">{item.badge}</span>
            )}
          </a>
        ))}

        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Recent</p>
        {projects.length === 0 ? (
          <p className="px-3 py-1.5 text-xs text-slate-500">No repositories yet — create your first project to get started.</p>
        ) : (
          projects.slice(0, 8).map((p) => (
            <a
              key={p.slug}
              href={`/repositories/${p.slug}`}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <FolderGit2 size={15} />
              <span className="truncate">{p.slug}</span>
            </a>
          ))
        )}
      </nav>

      <div className="p-3">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">Need help?</p>
          <p className="mt-1 text-xs text-slate-400">Check out our docs or join our community.</p>
        </div>
        <p className="mt-3 px-1 text-xs text-slate-500">
          {projects.length === 0 ? "Welcome — your workspace is ready." : `${projects.length} repositor${projects.length === 1 ? "y" : "ies"}`}
        </p>
      </div>
    </aside>
  );
}

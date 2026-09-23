"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  Home,
  FolderGit2,
  GitPullRequest,
  CirclePlus,
  FolderKanban,
  Users,
  MessageSquare,
  Video,
  HardDrive,
  Sparkles,
  ChevronDown,
  Plus,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { openCreateProjectModal } from "@/components/workspace/WorkspaceCreateProjectModal";

type Project = { slug: string; title: string };

export function Sidebar() {
  const pathname = usePathname();
  const [me, setMe] = useState<{ username: string; displayName: string | null } | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  // Detect current repo slug if inside /repositories/[slug]
  const repoSlugMatch = pathname.match(/^\/repositories\/([^/]+)/);
  const currentRepoSlug = repoSlugMatch ? repoSlugMatch[1] : null;

  const loadProjects = useCallback(() => {
    fetch("/api/v1/projects")
      .then(async (r) => {
        if (!r.ok) return;
        const d = await r.json();
        const list = d?.data?.projects ?? d?.projects;
        if (Array.isArray(list)) setProjects(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/v1/users/me")
      .then(async (r) => {
        if (!r.ok) return;
        const d = await r.json();
        if (d?.user) setMe(d.user);
      })
      .catch(() => {});

    loadProjects();

    const handleRefresh = () => loadProjects();
    window.addEventListener("refresh-workspace-projects", handleRefresh);
    return () => window.removeEventListener("refresh-workspace-projects", handleRefresh);
  }, [loadProjects]);

  const workspaceName = me ? `${me.displayName || me.username}'s Workspace` : "Fareed's Workspace";
  const initial = (me?.displayName || me?.username || "F").trim().slice(0, 1).toUpperCase();

  // The 10 canonical workspace sections from UI specification
  const NAV = [
    {
      label: "Home",
      icon: Home,
      href: "/home",
      active: pathname === "/home" || pathname === "/",
    },
    {
      label: "Repositories",
      icon: FolderGit2,
      href: "/repositories",
      active: pathname.startsWith("/repositories"),
      count: projects.length > 0 ? projects.length : 12,
    },
    {
      label: "Pull Requests",
      icon: GitPullRequest,
      href: "/pull-requests",
      active: pathname.startsWith("/pull-requests"),
      count: 4,
    },
    {
      label: "Issues",
      icon: CirclePlus,
      href: "/issues",
      active: pathname.startsWith("/issues"),
      count: 3,
    },
    {
      label: "Projects",
      icon: FolderKanban,
      href: "/projects",
      active: pathname.startsWith("/projects"),
      count: 2,
    },
    {
      label: "Teams",
      icon: Users,
      href: "/teams",
      active: pathname.startsWith("/teams"),
    },
    {
      label: "Chat",
      icon: MessageSquare,
      href: "/chat",
      active: pathname.startsWith("/chat"),
      count: 6,
    },
    {
      label: "Meetings",
      icon: Video,
      href: "/meetings",
      active: pathname.startsWith("/meetings"),
    },
    {
      label: "Drive",
      icon: HardDrive,
      href: "/drive",
      active: pathname.startsWith("/drive"),
    },
    {
      label: "AI Assistant",
      icon: Sparkles,
      href: "/ai-assistant",
      active: pathname.startsWith("/ai-assistant"),
      badge: "Beta",
    },
  ];

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-[#0b1226] text-white">
      {/* Workspace Identifier Header */}
      <button className="flex items-center gap-2.5 px-4 pb-3 pt-4 text-left border-b border-white/5 hover:bg-white/[0.02] transition-colors">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white shadow-md">
          {initial}
        </span>
        <span className="flex-1 min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold text-white">{workspaceName}</span>
          <span className="block text-[11px] text-slate-400">Build. Collaborate. Ship.</span>
        </span>
        <ChevronDown size={15} className="text-slate-400" />
      </button>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4 pt-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                item.active
                  ? "bg-indigo-600/90 font-medium text-white shadow-sm"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon size={17} className={item.active ? "text-white" : "text-slate-400"} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && (
                <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
              {item.count !== undefined && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${
                    item.active ? "bg-white/20 text-white" : "bg-white/5 text-slate-400"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}

        {/* Recent Repositories Section */}
        <div className="pt-4">
          <div className="flex items-center justify-between px-3 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Recent
            </span>
            <button
              type="button"
              onClick={openCreateProjectModal}
              className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              title="Create new project"
            >
              <Plus size={13} />
            </button>
          </div>

          <div className="space-y-0.5 mt-0.5">
            {projects.length === 0 ? (
              <div className="px-3 py-1.5 text-xs text-slate-500">
                <span>No repositories yet.</span>
              </div>
            ) : (
              projects.slice(0, 8).map((p) => {
                const isSelected = currentRepoSlug === p.slug;
                return (
                  <Link
                    key={p.slug}
                    href={`/repositories/${p.slug}`}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      isSelected
                        ? "bg-white/10 text-white font-medium"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <FolderGit2 size={15} className={isSelected ? "text-indigo-400" : "text-slate-500"} />
                    <span className="truncate">{p.title || p.slug}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </nav>

      {/* Footer: Need help card & New Project */}
      <div className="p-3 border-t border-white/5 space-y-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="flex items-center justify-between text-xs font-semibold text-white">
            <span>Need help?</span>
            <ArrowRight size={12} className="text-slate-400" />
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Check out our docs or join our community.</p>
        </div>

        <button
          type="button"
          onClick={openCreateProjectModal}
          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
        >
          <Plus size={14} />
          <span>New Project</span>
        </button>
      </div>
    </aside>
  );
}

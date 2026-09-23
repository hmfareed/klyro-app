"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderGit2,
  GitPullRequest,
  CirclePlus,
  Users,
  Video,
  Sparkles,
  ArrowRight,
  Plus,
  Activity,
  GitCommit,
  Clock,
} from "lucide-react";
import { openCreateProjectModal } from "@/components/workspace/WorkspaceCreateProjectModal";
import { activity as mockActivity } from "@/mock/workspace";

type Project = {
  slug: string;
  title: string;
  tagline: string;
  status: string;
  updatedAt: string;
  _count: { members: number; tasks: number };
};

export default function WorkspaceHomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [user, setUser] = useState<{ displayName: string | null; username: string } | null>(null);

  useEffect(() => {
    fetch("/api/v1/users/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data?.user) setUser(d.data.user);
      })
      .catch(() => {});

    fetch("/api/v1/projects")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = d?.data?.projects ?? d?.projects ?? [];
        if (Array.isArray(list)) setProjects(list);
      })
      .catch(() => {});
  }, []);

  const displayName = user?.displayName || user?.username || "Developer";

  return (
    <div className="flex-1 overflow-y-auto bg-black p-6 text-white min-w-0">
      {/* Welcome Banner */}
      <div className="mb-8 rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-950/60 via-[#0d1430] to-purple-950/40 p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 mb-3">
              <Sparkles size={13} />
              <span>Workspace Dashboard</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Welcome back, {displayName}
            </h1>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">
              Build. Collaborate. Ship. Track your repositories, pull requests, issues, and team activity.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={openCreateProjectModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
            >
              <Plus size={14} /> New Repository
            </button>
            <Link
              href="/pull-requests"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <GitPullRequest size={14} /> New PR
            </Link>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link
          href="/repositories"
          className="group rounded-xl border border-white/10 bg-[#09090b] p-4 transition-all hover:border-indigo-500/50 hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Repositories</span>
            <FolderGit2 size={16} className="text-indigo-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white">{projects.length || 12}</div>
          <p className="mt-1 text-[11px] text-slate-500">Active workspaces</p>
        </Link>

        <Link
          href="/pull-requests"
          className="group rounded-xl border border-white/10 bg-[#09090b] p-4 transition-all hover:border-indigo-500/50 hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Pull Requests</span>
            <GitPullRequest size={16} className="text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white">4</div>
          <p className="mt-1 text-[11px] text-purple-400 font-medium">2 review required</p>
        </Link>

        <Link
          href="/issues"
          className="group rounded-xl border border-white/10 bg-[#09090b] p-4 transition-all hover:border-indigo-500/50 hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Issues</span>
            <CirclePlus size={16} className="text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white">3</div>
          <p className="mt-1 text-[11px] text-amber-400 font-medium">1 high priority</p>
        </Link>

        <Link
          href="/teams"
          className="group rounded-xl border border-white/10 bg-[#09090b] p-4 transition-all hover:border-indigo-500/50 hover:bg-white/[0.04]"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Collaborators</span>
            <Users size={16} className="text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-2xl font-bold text-white">6</div>
          <p className="mt-1 text-[11px] text-emerald-400 font-medium">Across all teams</p>
        </Link>
      </div>

      {/* Main Grid: Repositories & Recent Activity */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left 2 Cols: Repositories */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FolderGit2 size={16} className="text-indigo-400" />
              Recent Repositories
            </h2>
            <Link
              href="/repositories"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1"
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {projects.slice(0, 6).map((proj) => (
              <Link
                key={proj.slug}
                href={`/repositories/${proj.slug}`}
                className="group rounded-xl border border-white/10 bg-[#09090b] p-4 hover:border-indigo-500/50 hover:bg-white/[0.03] transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-semibold text-sm text-white group-hover:text-indigo-400 transition-colors truncate">
                    {proj.title}
                  </span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                    {proj.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-1">{proj.tagline || "Active collaborative repository"}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-white/5">
                  <span>{proj._count?.members || 1} members</span>
                  <span className="text-indigo-400 group-hover:translate-x-0.5 transition-transform">Open →</span>
                </div>
              </Link>
            ))}

            {projects.length === 0 && (
              <div className="col-span-2 rounded-xl border border-dashed border-white/10 bg-[#09090b] p-8 text-center">
                <FolderGit2 size={32} className="mx-auto text-slate-500 mb-2" />
                <p className="text-sm font-semibold text-white">No repositories created yet</p>
                <p className="text-xs text-slate-400 mt-1">Start by creating your first collaborative project.</p>
                <button
                  onClick={openCreateProjectModal}
                  className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
                >
                  Create Project
                </button>
              </div>
            )}
          </div>

          {/* Quick Shortcuts */}
          <div className="mt-6 rounded-xl border border-white/10 bg-[#09090b] p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Quick Navigation</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Link
                href="/projects"
                className="flex items-center gap-2 rounded-lg bg-white/5 p-2.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Activity size={14} className="text-indigo-400" />
                <span>Project Boards</span>
              </Link>
              <Link
                href="/chat"
                className="flex items-center gap-2 rounded-lg bg-white/5 p-2.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Activity size={14} className="text-purple-400" />
                <span>Team Chat</span>
              </Link>
              <Link
                href="/meetings"
                className="flex items-center gap-2 rounded-lg bg-white/5 p-2.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <Video size={14} className="text-emerald-400" />
                <span>Standup Room</span>
              </Link>
              <Link
                href="/drive"
                className="flex items-center gap-2 rounded-lg bg-white/5 p-2.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                <FolderGit2 size={14} className="text-amber-400" />
                <span>File Drive</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Right Col: Activity Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity size={16} className="text-indigo-400" />
              Recent Activity
            </h2>
            <span className="text-[11px] text-slate-500">Live feed</span>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#09090b] p-4 space-y-4">
            {mockActivity.map((act, idx) => (
              <div key={idx} className="flex gap-3 text-xs border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-[11px]">
                  {act.who[0]}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-slate-300">
                    <span className="font-semibold text-white">{act.who}</span>{" "}
                    {act.what}
                  </p>
                  {act.details && (
                    <ul className="space-y-0.5 text-[11px] text-slate-500">
                      {act.details.map((d, dIdx) => (
                        <li key={dIdx} className="flex items-center gap-1.5">
                          <GitCommit size={10} className="text-indigo-400 shrink-0" />
                          <span className="truncate">{d}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-0.5">
                    <Clock size={10} />
                    <span>{act.when}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

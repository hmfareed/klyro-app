"use client";

import Link from "next/link";
import {
  Plus,
  UserPlus,
  Flag,
  FolderGit2,
  Activity as ActivityIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { fmtDate, initialsOf, displayName, timeAgo } from "./lib";

interface OverviewData {
  project: {
    id: string;
    slug: string;
    title: string;
    tagline: string;
    description: string;
    status: string;
    visibility: string;
    createdAt: string;
  };
  progress: { total: number; completed: number; open: number; percent: number };
  due: string | null;
  members: { total: number; list: Array<{ user: { id: string; username: string; displayName: string | null; avatarUrl?: string | null }; role: { title: string } }>; owner: { id: string; username: string; displayName: string | null; avatarUrl?: string | null } };
  activeWork: number;
  repositories: Array<{ id: string; name: string; slug: string; owner: { username: string } }>;
  recentActivity: Array<{
    id: string;
    type: string;
    createdAt: string;
    metadata: Record<string, unknown> | null;
    actor: { username: string; displayName: string | null; avatarUrl?: string | null };
  }>;
  health: { open: number; overdue: number; blocked: number; inProgress: number; completedThisWeek: number; avgCompletionDays: number };
  milestones: Array<{ id: string; title: string; status: string; dueDate: string | null }>;
  byStatus: Record<string, number>;
  workload: Array<{ user: { username: string; displayName: string | null }; role: string; openTasks: number }>;
}

function activityText(e: OverviewData["recentActivity"][number]): string {
  const meta = e.metadata ?? {};
  if (typeof meta.headline === "string") return meta.headline;
  const map: Record<string, string> = {
    PROJECT_CREATED: "created the project",
    TASK_CREATED: `created task "${String(meta.taskTitle ?? "")}"`,
    TASK_COMPLETED: `completed "${String(meta.taskTitle ?? "a task")}"`,
    MILESTONE_CREATED: `created milestone "${String(meta.milestoneTitle ?? "")}"`,
    MEMBER_JOINED: "joined the project",
    PULL_REQUEST_OPENED: "opened a pull request",
    PULL_REQUEST_MERGED: "merged a pull request",
    RELEASE_CREATED: "published a release",
  };
  return map[e.type] ?? e.type.toLowerCase().replace(/_/g, " ");
}

export function ProjectOverview({ slug, data }: { slug: string; data: OverviewData }) {
  const { project, progress, members, health } = data;
  const maxLoad = Math.max(1, ...data.workload.map((w) => w.openTasks));

  return (
    <div className="p-6 space-y-6 overflow-y-auto min-h-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">{project.title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{project.tagline}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${slug}/workspace?tab=tasks`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            <Plus size={14} /> Add task
          </Link>
          <Link
            href={`/projects/${slug}/workspace?tab=members`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            <UserPlus size={14} /> Invite
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Progress</p>
          <p className="mt-1 text-2xl font-bold text-white">{progress.percent}%</p>
          <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">{progress.completed} / {progress.total} tasks completed</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Due</p>
          <p className="mt-1 text-lg font-bold text-white">{data.due ? fmtDate(data.due) : "No due date"}</p>
          <p className="mt-1 text-[11px] text-slate-400">Nearest open milestone / task</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Active work</p>
          <p className="mt-1 text-2xl font-bold text-white">{data.activeWork}</p>
          <p className="mt-1 text-[11px] text-slate-400">tasks in progress</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Health</p>
          <div className="mt-1 flex items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1 text-red-300"><AlertTriangle size={12} />{health.overdue} overdue</span>
            <span className="inline-flex items-center gap-1 text-amber-300"><Clock size={12} />{health.blocked} blocked</span>
          </div>
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-300">
            <CheckCircle2 size={12} />{health.completedThisWeek} done this week
          </p>
          <p className="text-[11px] text-slate-500">avg completion {health.avgCompletionDays}d</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Members */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Members</h3>
            <Link href={`/projects/${slug}/workspace?tab=members`} className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300">
              View all ({members.total})
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {[members.owner, ...members.list.slice(0, 4).map((m) => m.user)].map((u, i) => (
              <span
                key={`${u.id}-${i}`}
                title={displayName(u)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[11px] font-bold text-white ring-2 ring-black"
              >
                {initialsOf(displayName(u))}
              </span>
            ))}
            {members.total > 5 && (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-slate-300 ring-2 ring-black">
                +{members.total - 5}
              </span>
            )}
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-slate-300 font-medium">{displayName(members.owner)}</span><span className="text-slate-500">Owner</span></div>
            {members.list.slice(0, 3).map((m) => (
              <div key={m.user.id} className="flex justify-between"><span className="text-slate-300">{displayName(m.user)}</span><span className="text-slate-500">{m.role.title}</span></div>
            ))}
          </div>
        </div>

        {/* Repositories */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Repositories</h3>
            <Link href={`/projects/${slug}/workspace?tab=repositories`} className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300">
              View all
            </Link>
          </div>
          {data.repositories.length === 0 ? (
            <p className="text-xs text-slate-500">No repositories connected yet.</p>
          ) : (
            <div className="space-y-2">
              {data.repositories.slice(0, 4).map((r) => (
                <Link
                  key={r.id}
                  href={`/repositories/${r.owner.username}/${r.slug}`}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 hover:border-white/15 transition-colors"
                >
                  <FolderGit2 size={14} className="text-indigo-400 shrink-0" />
                  <span className="text-xs font-semibold text-white truncate">{r.name}</span>
                </Link>
              ))}
            </div>
          )}
          {/* Milestones mini roadmap */}
          <div className="mt-4 pt-3 border-t border-white/5">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
              <Flag size={11} /> Milestones
            </h4>
            {data.milestones.length === 0 ? (
              <p className="text-[11px] text-slate-500">No milestones yet.</p>
            ) : (
              <div className="flex items-center gap-1 text-[10px]">
                {data.milestones.slice(0, 5).map((m, i) => (
                  <span key={m.id} className="flex items-center gap-1">
                    {i > 0 && <span className="text-slate-600">→</span>}
                    <span className={`rounded px-1.5 py-0.5 font-semibold ${m.status === "DONE" ? "bg-emerald-950/60 text-emerald-300" : "bg-white/5 text-slate-300"}`}>
                      {m.title}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <ActivityIcon size={12} /> Recent activity
            </h3>
            <Link href={`/projects/${slug}/workspace?tab=activity`} className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300">
              View all
            </Link>
          </div>
          {data.recentActivity.length === 0 ? (
            <p className="text-xs text-slate-500">No activity yet.</p>
          ) : (
            <div className="space-y-2.5">
              {data.recentActivity.slice(0, 6).map((e) => (
                <div key={e.id} className="flex items-start gap-2 text-[11px]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-slate-300">
                    {initialsOf(displayName(e.actor))}
                  </span>
                  <div className="min-w-0">
                    <p className="text-slate-300 leading-snug">
                      <span className="font-semibold text-white">{displayName(e.actor)}</span> {activityText(e)}
                    </p>
                    <p className="text-slate-600">{timeAgo(e.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workload (informational, not performance judgment) */}
      {data.workload.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Team workload <span className="normal-case font-normal text-slate-600">(open tasks per member)</span></h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {data.workload.map((w) => (
              <div key={w.user.username}>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-300 font-medium truncate">{w.user.displayName || w.user.username}</span>
                  <span className="text-slate-500">{w.openTasks}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(w.openTasks / maxLoad) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

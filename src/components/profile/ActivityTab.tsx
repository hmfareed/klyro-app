"use client";

import { Activity, FolderGit2, Users, Sparkles, Calendar } from "lucide-react";
import type { ProfileUser } from "./ProfileHeader";

type ActivityTabProps = {
  user: ProfileUser;
};

export function ActivityTab({ user }: ActivityTabProps) {
  const owned = user.projectsOwned || [];
  const member = user.memberships || [];

  const events: Array<{
    id: string;
    title: string;
    subtitle?: string;
    date: Date;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    tag: string;
  }> = [];

  owned.forEach((p) => {
    events.push({
      id: `p-${p.id}`,
      title: `Created project ${p.title}`,
      subtitle: p.tagline,
      date: new Date(p.createdAt),
      icon: FolderGit2,
      tag: "Project",
    });
  });

  member.forEach((m) => {
    events.push({
      id: `m-${m.id}`,
      title: `Joined ${m.project.title}`,
      subtitle: `Accepted role as ${m.role.title}`,
      date: new Date(m.joinedAt),
      icon: Users,
      tag: "Team",
    });
  });

  if (user.createdAt) {
    events.push({
      id: "joined",
      title: "Joined Klyro",
      subtitle: "Created verified developer profile",
      date: new Date(user.createdAt),
      icon: Sparkles,
      tag: "Community",
    });
  }

  events.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="mt-8 px-4 sm:px-8 pb-16 max-w-3xl">
      {events.length > 0 ? (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
          {events.map((ev) => {
            const Icon = ev.icon;
            return (
              <div key={ev.id} className="relative flex items-start gap-4 group">
                {/* Node Dot */}
                <div className="absolute -left-6 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-black ring-4 ring-black">
                  <div className="h-2.5 w-2.5 rounded-full bg-indigo-500 group-hover:scale-125 transition-transform" />
                </div>

                <div className="flex-1 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 transition-all hover:border-zinc-700">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                      <Icon size={14} className="text-indigo-400" />
                      <span>{ev.title}</span>
                    </span>
                    <span className="rounded bg-black border border-zinc-900 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                      {ev.tag}
                    </span>
                  </div>

                  {ev.subtitle && (
                    <p className="text-xs text-zinc-400 mt-1">{ev.subtitle}</p>
                  )}

                  <p className="mt-2 text-[11px] text-zinc-500 flex items-center gap-1">
                    <Calendar size={11} />
                    <span>{ev.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* DYNAMIC SUPER AMOLED EMPTY STATE FOR ACTIVITY */
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 py-16 px-6 text-center">
          <Activity size={26} className="mx-auto text-zinc-600 mb-3" />
          <h3 className="text-sm font-semibold text-zinc-200">No activity recorded yet</h3>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
            Commits, pull requests, milestone completions, and discussions will be logged to this timeline.
          </p>
        </div>
      )}
    </div>
  );
}

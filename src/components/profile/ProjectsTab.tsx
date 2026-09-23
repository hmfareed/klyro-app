"use client";

import { Sparkles, Users, ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import type { ProfileUser } from "./ProfileHeader";

type ProjectsTabProps = {
  user: ProfileUser;
  isOwner: boolean;
};

export function ProjectsTab({ user, isOwner }: ProjectsTabProps) {
  const owned = user.projectsOwned || [];
  const member = user.memberships || [];

  const projects = [
    ...owned.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      tagline: p.tagline,
      description: p.description,
      status: p.status,
      category: p.category || "engineering",
      techStack: p.techStack || [],
      membersCount: (p._count?.members || 0) + 1,
      role: "Owner",
    })),
    ...member.map((m) => ({
      id: m.project.id,
      slug: m.project.slug,
      title: m.project.title,
      tagline: m.project.tagline,
      description: "",
      status: m.project.status,
      category: "collaboration",
      techStack: m.project.techStack || [],
      membersCount: (m.project._count?.members || 0) + 1,
      role: m.role.title,
    })),
  ];

  const statusColorMap: Record<string, string> = {
    RECRUITING: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    IN_PROGRESS: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    COMPLETED: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    PAUSED: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    ARCHIVED: "bg-zinc-800 text-zinc-400 border-zinc-700",
  };

  return (
    <div className="mt-8 px-4 sm:px-8 pb-16">
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.slug}`}
              className="group flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:border-indigo-500/50 hover:bg-zinc-900/40 transition-all shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {p.category}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      statusColorMap[p.status] || "bg-zinc-900 text-zinc-400 border-zinc-800"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">
                  {p.title}
                </h3>
                <p className="mt-1 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {p.tagline || p.description || "Building something exciting."}
                </p>

                {p.techStack && p.techStack.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.techStack.slice(0, 3).map((tech) => (
                      <span
                        key={tech}
                        className="rounded bg-black border border-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-zinc-900 flex items-center justify-between text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <Users size={13} className="text-zinc-400" />
                  <span>{p.membersCount} member{p.membersCount === 1 ? "" : "s"}</span>
                </span>
                <span className="text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                  View <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* DYNAMIC SUPER AMOLED EMPTY STATE FOR PROJECTS */
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 py-16 px-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-indigo-400 mb-3 shadow-inner">
            <Sparkles size={26} />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200">No projects yet</h3>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
            {isOwner
              ? "Projects allow you to recruit roles, collaborate with a team, and build with milestone verification."
              : `@${user.username} hasn't joined or created any projects yet.`}
          </p>

          {isOwner && (
            <div className="mt-5">
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
              >
                <Plus size={14} /> Start a Project
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { Users, Shield, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ProfileUser } from "./ProfileHeader";

type TeamsTabProps = {
  user: ProfileUser;
  isOwner: boolean;
};

export function TeamsTab({ user, isOwner }: TeamsTabProps) {
  const owned = (user.projectsOwned || []).map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.title,
    tagline: p.tagline,
    role: "Project Owner",
    joinedAt: p.createdAt,
    membersCount: (p._count?.members || 0) + 1,
  }));

  const memberships = (user.memberships || []).map((m) => ({
    id: m.project.id,
    slug: m.project.slug,
    name: m.project.title,
    tagline: m.project.tagline,
    role: m.role.title,
    joinedAt: m.joinedAt,
    membersCount: (m.project._count?.members || 0) + 1,
  }));

  const allTeams = [...owned, ...memberships];

  return (
    <div className="mt-8 px-4 sm:px-8 pb-16">
      {allTeams.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {allTeams.map((team) => (
            <Link
              key={team.id}
              href={`/projects/${team.slug}`}
              className="group flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:border-indigo-500/50 hover:bg-zinc-900/40 transition-all shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-indigo-400 font-bold text-sm">
                    {team.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex items-center gap-1 rounded-full border border-zinc-800 bg-black px-2.5 py-0.5 text-[10px] font-medium text-zinc-300">
                    <Shield size={11} className="text-indigo-400" />
                    <span>{team.role}</span>
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors">
                  {team.name}
                </h3>
                <p className="mt-1 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {team.tagline || "Collaborative engineering workspace."}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-zinc-900 flex items-center justify-between text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <Users size={13} className="text-zinc-400" />
                  <span>{team.membersCount} member{team.membersCount === 1 ? "" : "s"}</span>
                </span>
                <span className="text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                  Workspace <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* DYNAMIC SUPER AMOLED EMPTY STATE FOR TEAMS */
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 py-16 px-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-purple-400 mb-3 shadow-inner">
            <Users size={26} />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200">No teams joined yet</h3>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
            {isOwner
              ? "You haven't joined or started any teams yet. Explore recruiting projects to collaborate with others."
              : `@${user.username} is not currently a member of any collaborative teams.`}
          </p>

          <div className="mt-5">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
            >
              Explore Projects
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

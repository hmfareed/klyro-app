"use client";

import { useState } from "react";
import { FolderGit2, Search, Star, GitFork, Plus, ArrowUpDown } from "lucide-react";
import Link from "next/link";
import type { ProfileUser } from "./ProfileHeader";

type RepositoriesTabProps = {
  user: ProfileUser;
  isOwner: boolean;
};

export function RepositoriesTab({ user, isOwner }: RepositoriesTabProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "name">("updated");

  const owned = user.projectsOwned || [];
  const member = user.memberships || [];
  const allRepos = [
    ...owned.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      tagline: p.tagline,
      description: p.description,
      status: p.status,
      visibility: p.visibility,
      techStack: p.techStack || [],
      updatedAt: p.updatedAt,
      isOwner: true,
    })),
    ...member.map((m) => ({
      id: m.project.id,
      slug: m.project.slug,
      title: m.project.title,
      tagline: m.project.tagline,
      description: "",
      status: m.project.status,
      visibility: m.project.visibility,
      techStack: m.project.techStack || [],
      updatedAt: m.project.updatedAt,
      isOwner: false,
    })),
  ];

  const filtered = allRepos
    .filter((r) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.tagline?.toLowerCase().includes(q) ||
        r.techStack.some((t) => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.title.localeCompare(b.title);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return (
    <div className="mt-8 px-4 sm:px-8 pb-16">
      {/* Top Controls: Search & Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a repository..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-4 text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
            <ArrowUpDown size={13} className="text-zinc-500" />
            <span className="text-[11px] text-zinc-500">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "updated" | "name")}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="updated" className="bg-zinc-950 text-white">Last updated</option>
              <option value="name" className="bg-zinc-950 text-white">Name</option>
            </select>
          </div>

          {isOwner && (
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
            >
              <Plus size={14} /> New
            </Link>
          )}
        </div>
      </div>

      {/* Repositories List / Empty State */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((repo) => (
            <Link
              key={repo.id}
              href={`/repositories/${repo.slug}`}
              className="group flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-5 hover:border-indigo-500/50 hover:bg-zinc-900/40 transition-all shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FolderGit2
                      size={18}
                      className="text-indigo-400 shrink-0 group-hover:text-indigo-300 transition-colors"
                    />
                    <span className="font-semibold text-sm text-zinc-100 group-hover:text-indigo-400 transition-colors truncate">
                      {repo.title}
                    </span>
                  </div>
                  <span className="rounded-full border border-zinc-800 bg-black px-2.5 py-0.5 text-[10px] font-medium text-zinc-400 shrink-0">
                    {repo.visibility || "Public"}
                  </span>
                </div>

                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-4">
                  {repo.tagline || repo.description || "No description provided."}
                </p>
              </div>

              <div>
                {repo.techStack && repo.techStack.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {repo.techStack.map((tech) => (
                      <span
                        key={tech}
                        className="rounded bg-black border border-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-3 border-t border-zinc-900">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 hover:text-amber-400 transition-colors">
                      <Star size={12} />
                      <span>0</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <GitFork size={12} />
                      <span>0</span>
                    </span>
                  </div>
                  <span>
                    Updated {new Date(repo.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* DYNAMIC SUPER AMOLED EMPTY STATE */
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 py-16 px-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-indigo-400 mb-3 shadow-inner">
            <FolderGit2 size={26} />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200">
            {search ? "No matching repositories found" : "No repositories yet"}
          </h3>
          <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
            {search
              ? `No repositories matched "${search}". Try searching for a different term.`
              : isOwner
              ? "You haven't created or joined any repositories yet. Get started by creating your first project."
              : `@${user.username} doesn't have any public repositories yet.`}
          </p>

          {isOwner && !search && (
            <div className="mt-5">
              <Link
                href="/projects/new"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
              >
                <Plus size={14} /> Create Repository
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

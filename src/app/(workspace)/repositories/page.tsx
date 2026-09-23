"use client";

import { useEffect, useState } from "react";
import {
  FolderGit2,
  Plus,
  ArrowRight,
  Search,
  Star,
  GitFork,
  CircleDot,
  GitPullRequest,
  Lock,
  Globe,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface RepositoryItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: string;
  archived: boolean;
  defaultBranch: string;
  updatedAt: string;
  owner: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  project?: {
    id: string;
    title: string;
    slug: string;
  } | null;
  _count: {
    stars: number;
    forks: number;
    issues: number;
    pullRequests: number;
  };
}

export default function RepositoriesIndexPage() {
  const [repositories, setRepositories] = useState<RepositoryItem[] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "mine" | "starred">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    setLoading(true);

    const queryParams = new URLSearchParams();
    if (search.trim()) queryParams.set("q", search.trim());
    if (filter !== "all") queryParams.set("filter", filter);

    fetch(`/api/v1/repositories?${queryParams.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!ignore) {
          setRepositories(d?.data?.repositories || d?.repositories || []);
        }
      })
      .catch(() => {
        if (!ignore) setRepositories([]);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [search, filter]);

  return (
    <div className="flex-1 overflow-y-auto bg-black p-6 sm:p-8">
      {/* Top Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <FolderGit2 className="text-indigo-400" size={24} />
            Repositories
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Where your actual code, branches, commits, PRs, and version history live.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/repositories/deleted"
            className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            Deleted Repositories
          </Link>
          <Link
            href="/projects"
            className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            Explore Projects
          </Link>
          <Link
            href="/repositories/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-indigo-500 transition-all cursor-pointer"
          >
            <Plus size={15} /> New Repository
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1 w-fit">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "all" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("mine")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "mine" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            My Repositories
          </button>
          <button
            onClick={() => setFilter("starred")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "starred" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Starred
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a repository…"
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && repositories === null && (
        <div className="flex flex-1 items-center justify-center p-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      )}

      {/* Empty State */}
      {!loading && repositories?.length === 0 && (
        <div className="flex flex-1 items-center justify-center p-12">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center shadow-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 mb-4">
              <FolderGit2 size={28} />
            </div>
            <h2 className="text-lg font-bold text-white">No repositories found</h2>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              {search
                ? `No repositories matched "${search}". Try searching for something else.`
                : "Get started by creating your first repository. Version your code, open pull requests, and collaborate."}
            </p>
            <div className="mt-6">
              <Link
                href="/repositories/new"
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                <Plus size={15} /> Create Repository
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Repositories Grid */}
      {repositories && repositories.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repositories.map((repo) => {
            const repoUrl = `/repositories/${repo.owner.username}/${repo.slug}`;
            return (
              <div
                key={repo.id}
                className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-5 hover:border-indigo-500/40 hover:bg-white/[0.04] transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Link
                      href={repoUrl}
                      className="font-semibold text-sm text-white group-hover:text-indigo-400 transition-colors truncate flex items-center gap-1.5"
                    >
                      <span className="text-slate-400 font-normal">{repo.owner.username} /</span>
                      <span>{repo.name}</span>
                    </Link>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {repo.archived && (
                        <span className="flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          Archived
                        </span>
                      )}
                      <span className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                        {repo.visibility === "PRIVATE" ? <Lock size={10} /> : <Globe size={10} />}
                        {repo.visibility}
                      </span>
                    </div>
                  </div>

                  {repo.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                      {repo.description}
                    </p>
                  )}

                  {repo.project && (
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1 text-[11px] text-indigo-300 bg-indigo-950/50 border border-indigo-800/40 rounded px-2 py-0.5">
                        📦 Part of: <b className="font-semibold">{repo.project.title}</b>
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3.5 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 hover:text-white transition-colors">
                      <Star size={12} className="text-amber-400" />
                      {repo._count.stars}
                    </span>
                    <span className="flex items-center gap-1 hover:text-white transition-colors">
                      <GitPullRequest size={12} className="text-purple-400" />
                      {repo._count.pullRequests}
                    </span>
                    <span className="flex items-center gap-1 hover:text-white transition-colors">
                      <CircleDot size={12} className="text-emerald-400" />
                      {repo._count.issues}
                    </span>
                  </div>

                  <Link
                    href={repoUrl}
                    className="inline-flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 group-hover:translate-x-0.5 transition-all"
                  >
                    <span>Open</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

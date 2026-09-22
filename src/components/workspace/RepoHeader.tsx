import { Eye, GitBranch, GitFork, Lock, Star, Tag } from "lucide-react";
import { repo } from "@/mock/workspace";

const TAB_STYLE = "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap";

export function RepoHeader() {
  return (
    <div className="border-b border-white/10">
      <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">📦</span>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-bold text-white">
            <span className="truncate">{repo.title}</span>
            <Lock size={14} className="shrink-0 text-slate-400" />
          </h1>
          <p className="truncate text-sm text-slate-400">{repo.description}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200">
            <Eye size={15} /> Watch <b>{repo.watch}</b>
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200">
            <Star size={15} /> Star <b>{repo.stars}</b>
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200">
            <GitFork size={15} /> Fork <b>{repo.forks}</b>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-5 pt-3 text-sm">
        <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-200">
          <GitBranch size={14} /> {repo.branch} ▾
        </span>
        <span className="flex items-center gap-1 px-2 py-1.5 text-slate-300">
          <GitBranch size={14} /> {repo.branches} branches
        </span>
        <span className="flex items-center gap-1 px-2 py-1.5 text-slate-300">
          <Tag size={14} /> {repo.tags} tags
        </span>
        <span className="ml-auto flex gap-2">
          <button className="rounded-lg bg-indigo-600 px-4 py-1.5 font-medium text-white hover:bg-indigo-500">Code ▾</button>
          <button className="rounded-lg border border-white/10 bg-white/5 px-3 text-slate-200">⋯</button>
        </span>
      </div>

      <div className="flex gap-1 overflow-x-auto px-5 pt-2">
        {repo.tabs.map((t) => (
          <a key={t.label} href="#" className={`${TAB_STYLE} ${t.active ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-white"}`}>
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-md bg-white/10 px-1.5 text-xs text-slate-200">{t.count}</span>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

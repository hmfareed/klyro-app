"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FolderGit2, GitPullRequest, CircleDot, ExternalLink } from "lucide-react";
import { unwrap, fetchJson, timeAgo } from "./lib";

interface Repo {
  id: string;
  name: string;
  slug: string;
  visibility: string;
  updatedAt: string;
  owner: { username: string };
  _count?: { pullRequests: number; issues: number };
}

interface PR { id: string; number: number; title: string; status: string; headBranch: string; baseBranch: string; author?: { username: string; displayName: string | null } }
interface Issue { id: string; number: number; title: string; status: string; labels: string[]; author?: { username: string } }

export function ProjectDev({ projectId, slug, initial = "repos" }: { projectId: string; slug: string; initial?: "repos" | "prs" | "issues" }) {
  const [tab, setTab] = useState<"repos" | "prs" | "issues">(initial);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [prs, setPrs] = useState<Array<PR & { repo: string }>>([]);
  const [issues, setIssues] = useState<Array<Issue & { repo: string }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchJson(`/api/v1/repositories?projectId=${projectId}`)
      .then(({ json }) => {
        const list: Repo[] = unwrap<Repo[]>(json, "repositories", unwrap<Repo[]>(json, "repos", []));
        setRepos(list);
        // Aggregate open PRs + issues across connected repos
        const prAll: Array<PR & { repo: string }> = [];
        const isAll: Array<Issue & { repo: string }> = [];
        Promise.all(
          list.slice(0, 8).map((r) =>
            Promise.all([
              fetchJson(`/api/v1/repositories/${r.owner.username}/${r.slug}/pulls?status=OPEN`),
              fetchJson(`/api/v1/repositories/${r.owner.username}/${r.slug}/issues?status=OPEN`),
            ])
              .then(([p, i]) => {
                unwrap<PR[]>(p.json, "pullRequests", []).slice(0, 10).forEach((pr) => prAll.push({ ...pr, repo: r.slug }));
                unwrap<Issue[]>(i.json, "issues", []).slice(0, 10).forEach((is) => isAll.push({ ...is, repo: r.slug }));
              })
              .catch(() => { /* per-repo failure shouldn't break the tab */ }),
          ),
        )
          .then(() => {
            setPrs(prAll);
            setIssues(isAll);
          })
          .catch(() => { /* keep */ });
      })
      .catch(() => {
        setRepos([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-1 border-b border-white/10 px-6 pt-4">
        {([["repos", "Repositories"], ["prs", `Pull Requests${prs.length ? ` (${prs.length})` : ""}`], ["issues", `Issues${issues.length ? ` (${issues.length})` : ""}`]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === id ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading...</div>
        ) : tab === "repos" ? (
          repos.length === 0 ? (
            <p className="text-xs text-slate-500">No repositories connected to this project.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {repos.map((r) => (
                <Link key={r.id} href={`/repositories/${r.owner.username}/${r.slug}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-white/25 transition-colors">
                  <div className="flex items-center gap-2">
                    <FolderGit2 size={15} className="text-indigo-400" />
                    <span className="text-sm font-bold text-white truncate">{r.name}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{r.owner.username}/{r.slug} · updated {timeAgo(r.updatedAt)}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1"><GitPullRequest size={12} />{r._count?.pullRequests ?? "—"} PRs</span>
                    <span className="inline-flex items-center gap-1"><CircleDot size={12} />{r._count?.issues ?? "—"} issues</span>
                  </div>
                </Link>
              ))}
            </div>
          )
        ) : tab === "prs" ? (
          prs.length === 0 ? (
            <p className="text-xs text-slate-500">No open pull requests across connected repositories.</p>
          ) : (
            <div className="space-y-2 max-w-3xl">
              {prs.map((pr) => (
                <div key={pr.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <GitPullRequest size={15} className="text-emerald-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white truncate">#{pr.number} {pr.title}</p>
                    <p className="text-[11px] text-slate-500">{pr.repo} · {pr.headBranch} → {pr.baseBranch}</p>
                  </div>
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">{pr.status}</span>
                </div>
              ))}
            </div>
          )
        ) : issues.length === 0 ? (
          <p className="text-xs text-slate-500">No open issues across connected repositories.</p>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {issues.map((is) => (
              <div key={is.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <CircleDot size={15} className="text-amber-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">#{is.number} {is.title}</p>
                  <p className="text-[11px] text-slate-500">{is.repo}{is.labels.length > 0 && ` · ${is.labels.join(", ")}`}</p>
                </div>
                <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">{is.status}</span>
              </div>
            ))}
          </div>
        )}
        <Link href={`/repositories`} className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300">
          Open Repositories workspace <ExternalLink size={11} />
        </Link>
        <span className="hidden">{slug}</span>
      </div>
    </div>
  );
}

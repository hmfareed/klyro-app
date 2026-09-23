"use client";

import { useEffect, useState } from "react";
import { GitCommit, Copy, Check, ArrowRight, User } from "lucide-react";

interface RepoCommitsViewProps {
  owner: string;
  repo: string;
  refName: string;
  onSelectCommit: (sha: string) => void;
}

export function RepoCommitsView({
  owner,
  repo,
  refName,
  onSelectCommit,
}: RepoCommitsViewProps) {
  const [commits, setCommits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/repositories/${owner}/${repo}/commits?ref=${refName}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data?.commits) setCommits(d.data.commits);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [owner, repo, refName]);

  const copySha = (sha: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div className="border-b border-white/10 pb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <GitCommit size={16} className="text-indigo-400" />
          Commits on <span className="font-mono text-indigo-300">{refName}</span>
        </h2>
        <span className="text-xs text-slate-500 font-mono">{commits.length} commits</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : commits.length === 0 ? (
        <p className="p-8 text-center text-xs text-slate-500">No commits found on this branch.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-sm divide-y divide-white/5">
          {commits.map((c) => (
            <div
              key={c.sha}
              onClick={() => onSelectCommit(c.sha)}
              className="flex items-center justify-between p-4 hover:bg-white/[0.04] transition-colors cursor-pointer group"
            >
              <div className="min-w-0 pr-4">
                <p className="text-xs font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                  {c.message}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1 text-slate-400 font-medium">
                    <div className="h-4 w-4 rounded-full bg-indigo-600/30 flex items-center justify-center text-[9px] text-indigo-300">
                      <User size={10} />
                    </div>
                    <span>{c.author}</span>
                  </div>
                  <span>committed {c.relativeDate}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => copySha(c.sha, e)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1"
                  title="Copy full SHA"
                >
                  <span>{c.shortSha}</span>
                  {copiedSha === c.sha ? (
                    <Check size={11} className="text-emerald-400" />
                  ) : (
                    <Copy size={11} className="text-slate-500" />
                  )}
                </button>

                <div className="text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

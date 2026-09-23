"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, GitCommit, FileText, Check, Copy } from "lucide-react";

interface RepoCommitDiffViewProps {
  owner: string;
  repo: string;
  sha: string;
  onBack: () => void;
}

export function RepoCommitDiffView({
  owner,
  repo,
  sha,
  onBack,
}: RepoCommitDiffViewProps) {
  const [diffData, setDiffData] = useState<{
    commit: any;
    stats: { additions: number; deletions: number; filesChanged: number };
    files: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/repositories/${owner}/${repo}/commits/${sha}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data) setDiffData(d.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [owner, repo, sha]);

  const copySha = () => {
    navigator.clipboard.writeText(sha);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Top back navigation */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to commits
        </button>

        <button
          onClick={copySha}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-mono text-slate-300 hover:text-white"
        >
          <span>{sha.slice(0, 7)}</span>
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : diffData ? (
        <>
          {/* Commit Summary Card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h1 className="text-base font-bold text-white mb-2">{diffData.commit.message}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="font-semibold text-white">{diffData.commit.author}</span>
              <span>committed {diffData.commit.relativeDate}</span>
              <span>•</span>
              <span className="text-slate-300">
                {diffData.stats.filesChanged} file{diffData.stats.filesChanged === 1 ? "" : "s"} changed
              </span>
              <span className="font-mono text-emerald-400">+{diffData.stats.additions}</span>
              <span className="font-mono text-rose-400">-{diffData.stats.deletions}</span>
            </div>
          </div>

          {/* Files Diff List */}
          <div className="space-y-4">
            {diffData.files.map((f, idx) => {
              const lines = (f.patch || "").split("\n");
              return (
                <div
                  key={idx}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-md font-mono text-xs"
                >
                  {/* File Diff Header */}
                  <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-sky-400" />
                      <span className="font-semibold text-white">{f.newPath}</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] uppercase font-bold text-slate-400">
                        {f.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-400">+{f.additions}</span>
                      <span className="text-rose-400">-{f.deletions}</span>
                    </div>
                  </div>

                  {/* Patch Lines Viewer */}
                  <div className="overflow-x-auto p-2 leading-relaxed">
                    {lines.map((line: string, lineIdx: number) => {
                      const isAddition = line.startsWith("+") && !line.startsWith("+++");
                      const isDeletion = line.startsWith("-") && !line.startsWith("---");
                      const isHeader = line.startsWith("@@") || line.startsWith("diff ") || line.startsWith("index ");

                      return (
                        <div
                          key={lineIdx}
                          className={`px-3 py-0.5 whitespace-pre ${
                            isAddition
                              ? "bg-emerald-950/40 text-emerald-300"
                              : isDeletion
                              ? "bg-rose-950/40 text-rose-300"
                              : isHeader
                              ? "bg-indigo-950/20 text-indigo-300/80 font-bold"
                              : "text-slate-300"
                          }`}
                        >
                          {line || " "}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="p-8 text-center text-xs text-slate-500">Failed to load commit diff.</p>
      )}
    </div>
  );
}

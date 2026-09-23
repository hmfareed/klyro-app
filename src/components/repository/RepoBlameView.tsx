"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, FileText } from "lucide-react";

interface RepoBlameViewProps {
  owner: string;
  repo: string;
  refName: string;
  filePath: string;
  onNavigateBack: () => void;
  onViewCommit: (sha: string) => void;
}

export function RepoBlameView({
  owner,
  repo,
  refName,
  filePath,
  onNavigateBack,
  onViewCommit,
}: RepoBlameViewProps) {
  const [lines, setLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/repositories/${owner}/${repo}/blame?ref=${refName}&path=${filePath}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data?.lines) setLines(d.data.lines);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [owner, repo, refName, filePath]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2 text-xs font-medium">
          <button
            onClick={onNavigateBack}
            className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
          >
            <ArrowLeft size={13} /> Back to file
          </button>
          <span className="text-slate-500">/</span>
          <span className="font-bold text-white flex items-center gap-1.5">
            <FileText size={14} className="text-sky-400" />
            Blame: {filePath}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 font-mono text-xs shadow-xl">
          <table className="w-full text-left">
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                  {/* Commit info */}
                  <td className="w-48 px-3 py-1 text-[11px] text-slate-500 whitespace-nowrap border-r border-white/5">
                    <button
                      onClick={() => onViewCommit(l.commitSha)}
                      className="text-indigo-400 hover:underline mr-2"
                    >
                      {l.commitSha.slice(0, 7)}
                    </button>
                    <span className="text-slate-400 font-semibold">{l.author}</span>
                  </td>

                  {/* Date */}
                  <td className="w-24 px-3 py-1 text-[10px] text-slate-600 whitespace-nowrap border-r border-white/5">
                    {l.date}
                  </td>

                  {/* Line number */}
                  <td className="w-12 px-2 py-1 text-right text-slate-600 select-none border-r border-white/5">
                    {l.line}
                  </td>

                  {/* Code line content */}
                  <td className="px-4 py-1 text-slate-200 whitespace-pre">
                    {l.content || " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

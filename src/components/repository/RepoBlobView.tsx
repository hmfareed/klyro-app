"use client";

import { useEffect, useState } from "react";
import { Copy, Check, FileText, Download, History, Eye } from "lucide-react";

interface RepoBlobViewProps {
  owner: string;
  repo: string;
  refName: string;
  filePath: string;
  onNavigateBack: () => void;
  onViewBlame: () => void;
  onViewHistory: () => void;
}

export function RepoBlobView({
  owner,
  repo,
  refName,
  filePath,
  onNavigateBack,
  onViewBlame,
  onViewHistory,
}: RepoBlobViewProps) {
  const [fileData, setFileData] = useState<{
    content: string;
    size: number;
    linesCount: number;
    isBinary: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/repositories/${owner}/${repo}/blob?ref=${refName}&path=${filePath}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data) setFileData(d.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [owner, repo, refName, filePath]);

  const copyContent = () => {
    if (!fileData?.content) return;
    navigator.clipboard.writeText(fileData.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const rawUrl = `/api/v1/repositories/${owner}/${repo}/raw?ref=${refName}&path=${filePath}`;

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* File Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-2 text-xs font-medium">
          <button
            onClick={onNavigateBack}
            className="text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
          >
            {repo}
          </button>
          <span className="text-slate-500">/</span>
          <span className="font-bold text-white flex items-center gap-1.5">
            <FileText size={14} className="text-sky-400" />
            {filePath}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onViewHistory}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <History size={13} />
            <span>History</span>
          </button>

          <button
            onClick={onViewBlame}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <Eye size={13} />
            <span>Blame</span>
          </button>

          <a
            href={rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Download size={13} />
            <span>Raw</span>
          </a>

          <button
            onClick={copyContent}
            disabled={!fileData?.content}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : fileData ? (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-xl">
          {/* Metadata bar */}
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2.5 text-[11px] font-mono text-slate-400">
            <span>
              {fileData.linesCount} lines • {formatSize(fileData.size)}
            </span>
            <span>{refName}</span>
          </div>

          {/* Code Viewer with Line Numbers */}
          {fileData.isBinary ? (
            <div className="p-12 text-center text-xs text-slate-400">
              <p>Binary file not shown.</p>
              <a
                href={rawUrl}
                download
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500"
              >
                <Download size={14} /> Download Binary
              </a>
            </div>
          ) : (
            <div className="flex overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
              {/* Line Numbers */}
              <div className="select-none pr-4 text-right text-slate-600 border-r border-white/5 space-y-0.5 min-w-[2.5rem]">
                {fileData.content.split("\n").map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>

              {/* Code Content */}
              <pre className="pl-4 space-y-0.5">
                {fileData.content.split("\n").map((line, i) => (
                  <div key={i} className="hover:bg-white/[0.03] transition-colors">
                    {line || " "}
                  </div>
                ))}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <p className="p-8 text-center text-xs text-slate-500">File not found.</p>
      )}
    </div>
  );
}

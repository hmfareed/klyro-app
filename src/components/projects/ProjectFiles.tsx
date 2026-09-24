"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText } from "lucide-react";
import { unwrap, fetchJson, displayName, fmtDate } from "./lib";

interface FileItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { username: string; displayName: string | null };
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function ProjectFiles({ slug }: { slug: string }) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchJson(`/api/v1/projects/${slug}/files`)
      .then(({ json }) => {
        setFiles(unwrap<FileItem[]>(json, "files", []));
      })
      .catch(() => {
        setFiles([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="border-b border-white/10 px-6 py-4">
        <h2 className="text-base font-bold text-white">Files</h2>
        <p className="text-xs text-slate-400 mt-0.5">Drive-backed project assets referenced by tasks and discussions.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
            <FileText size={28} className="mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-white">No files yet</p>
            <p className="mt-1 text-xs text-slate-400">Uploads from Drive linked to this project will appear here.</p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                <FileText size={15} className="text-indigo-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{f.fileName}</p>
                  <p className="text-[11px] text-slate-500">{fmtSize(f.sizeBytes)} · {f.mimeType} · by {displayName(f.uploadedBy)} · {fmtDate(f.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { Search, FileText, X } from "lucide-react";

interface RepoGoToFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (filePath: string) => void;
  owner: string;
  repo: string;
  refName: string;
}

export function RepoGoToFileModal({
  isOpen,
  onClose,
  onSelectFile,
  owner,
  repo,
  refName,
}: RepoGoToFileModalProps) {
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);

      fetch(`/api/v1/repositories/${owner}/${repo}/files-search?ref=${refName}`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.data?.files) setFiles(d.data.files);
        })
        .catch(() => {});
    }
  }, [isOpen, owner, repo, refName]);

  const filtered = query.trim()
    ? files.filter((f) => f.toLowerCase().includes(query.toLowerCase())).slice(0, 30)
    : files.slice(0, 30);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelectFile(filtered[selectedIndex]);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Go to file in this repository (or press Esc to close)…"
            className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-xs text-slate-500">No files found matching “{query}”</p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((filePath, index) => {
                const isSelected = index === selectedIndex;
                const fileName = filePath.split("/").pop();
                const dirPath = filePath.includes("/")
                  ? filePath.substring(0, filePath.lastIndexOf("/"))
                  : "";

                return (
                  <li key={filePath}>
                    <button
                      onClick={() => {
                        onSelectFile(filePath);
                        onClose();
                      }}
                      className={`flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-xs transition-colors text-left cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <FileText size={14} className={isSelected ? "text-white" : "text-sky-400"} />
                      <span className="font-semibold">{fileName}</span>
                      {dirPath && (
                        <span className={`text-[11px] truncate ${isSelected ? "text-indigo-200" : "text-slate-500"}`}>
                          {dirPath}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

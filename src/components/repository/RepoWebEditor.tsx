"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  FileCode,
  FileText,
  Save,
  Eye,
  Edit3,
  X,
  GitCommit,
  Check,
  AlertCircle,
} from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";
import { RepoCommitModal } from "./RepoCommitModal";

// Dynamically import Monaco Editor to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center p-12 bg-black text-slate-500 text-xs">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mr-2" />
      Loading Monaco Editor…
    </div>
  ),
});

interface RepoWebEditorProps {
  owner: string;
  repo: string;
  refName: string;
  initialFilePath?: string;
  initialContent?: string;
  isNewFile?: boolean;
  isProtectedBranch?: boolean;
  onCancel: () => void;
  onCommitted: (result: {
    commitSha: string;
    branch: string;
    isNewBranch: boolean;
    filePath: string;
  }) => void;
}

/**
 * Detect language identifier for Monaco Editor based on file extension
 */
function getMonacoLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "javascript";
    case "py":
      return "python";
    case "rs":
      return "rust";
    case "go":
      return "go";
    case "json":
      return "json";
    case "md":
    case "mdx":
      return "markdown";
    case "html":
      return "html";
    case "css":
    case "scss":
      return "css";
    case "yaml":
    case "yml":
      return "yaml";
    case "sql":
      return "sql";
    case "sh":
    case "bash":
      return "shell";
    case "dockerfile":
      return "dockerfile";
    default:
      return "plaintext";
  }
}

export function RepoWebEditor({
  owner,
  repo,
  refName,
  initialFilePath = "",
  initialContent = "",
  isNewFile = false,
  isProtectedBranch = false,
  onCancel,
  onCommitted,
}: RepoWebEditorProps) {
  const [filePath, setFilePath] = useState(initialFilePath);
  const [content, setContent] = useState(initialContent);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [commitError, setCommitError] = useState("");

  const isMarkdown = filePath.toLowerCase().endsWith(".md") || filePath.toLowerCase().endsWith(".mdx");
  const language = getMonacoLanguage(filePath);

  const handleOpenCommit = () => {
    if (!filePath.trim()) {
      setCommitError("Please specify a filename before committing");
      return;
    }
    setCommitError("");
    setShowCommitModal(true);
  };

  const handleCommitSubmit = async (data: {
    message: string;
    description: string;
    newBranch: string | null;
  }) => {
    const cleanPath = filePath.trim().replace(/^\/+/, "");

    const res = await fetch(`/api/v1/repositories/${owner}/${repo}/commits/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch: refName,
        newBranch: data.newBranch,
        files: [{ path: cleanPath, content }],
        message: data.message,
        description: data.description,
      }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(json?.error?.message || "Failed to commit changes");
    }

    onCommitted({
      commitSha: json.data.commitSha,
      branch: json.data.branch,
      isNewBranch: json.data.isNewBranch,
      filePath: cleanPath,
    });
  };

  const defaultCommitTitle = isNewFile
    ? `Create ${filePath ? filePath.split("/").pop() : "new file"}`
    : `Update ${filePath ? filePath.split("/").pop() : "file"}`;

  const suggestedPatchBranch = `${owner}-patch-1`;

  return (
    <div className="flex flex-1 flex-col h-full bg-black text-white overflow-hidden">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 bg-[#090d1f] px-6 py-3 shrink-0">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="font-mono text-xs text-indigo-400 font-semibold">{repo}</span>
          <span className="text-zinc-600 font-light">/</span>

          {isNewFile ? (
            <div className="flex items-center gap-1.5 flex-1 sm:w-72">
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="Name your file (e.g. src/index.ts)"
                className="w-full rounded-xl border border-zinc-700 bg-black/60 px-3 py-1.5 font-mono text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
            </div>
          ) : (
            <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
              <FileCode size={14} className="text-sky-400" />
              {filePath}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Markdown preview toggle */}
          {isMarkdown && (
            <div className="flex items-center rounded-xl border border-zinc-800 bg-white/5 p-0.5 mr-2">
              <button
                type="button"
                onClick={() => setActiveTab("edit")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === "edit"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Edit3 size={12} /> Edit
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === "preview"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Eye size={12} /> Preview
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 rounded-xl border border-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
            <X size={13} /> Cancel
          </button>

          <button
            type="button"
            onClick={handleOpenCommit}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
          >
            <GitCommit size={14} />
            <span>Commit changes…</span>
          </button>
        </div>
      </div>

      {commitError && (
        <div className="border-b border-red-500/20 bg-red-950/40 px-6 py-2 text-xs text-red-300 flex items-center gap-2 shrink-0">
          <AlertCircle size={14} className="text-red-400" />
          <span>{commitError}</span>
        </div>
      )}

      {/* Editor Main Content Area */}
      <div className="flex-1 min-h-0 relative">
        {activeTab === "edit" ? (
          <MonacoEditor
            height="100%"
            language={language}
            theme="vs-dark"
            value={content}
            onChange={(val) => setContent(val || "")}
            options={{
              fontSize: 13,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: "on",
              padding: { top: 12, bottom: 12 },
            }}
          />
        ) : (
          <div className="h-full overflow-y-auto p-8 bg-zinc-950">
            <div className="mx-auto max-w-4xl">
              <MarkdownViewer content={content || "*Nothing to preview*"} />
            </div>
          </div>
        )}
      </div>

      {/* Commit Modal */}
      <RepoCommitModal
        isOpen={showCommitModal}
        onClose={() => setShowCommitModal(false)}
        onCommit={handleCommitSubmit}
        defaultMessage={defaultCommitTitle}
        currentBranch={refName}
        isProtectedBranch={isProtectedBranch}
        suggestedNewBranch={suggestedPatchBranch}
      />
    </div>
  );
}

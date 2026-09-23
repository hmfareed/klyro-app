"use client";

import { useState } from "react";
import { GitCommit, GitBranch, GitPullRequest, AlertCircle, X } from "lucide-react";

interface RepoCommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit: (data: {
    message: string;
    description: string;
    newBranch: string | null;
  }) => Promise<void>;
  defaultMessage: string;
  currentBranch: string;
  isProtectedBranch?: boolean;
  suggestedNewBranch: string;
}

export function RepoCommitModal({
  isOpen,
  onClose,
  onCommit,
  defaultMessage,
  currentBranch,
  isProtectedBranch = false,
  suggestedNewBranch,
}: RepoCommitModalProps) {
  const [message, setMessage] = useState(defaultMessage);
  const [description, setDescription] = useState("");
  const [commitTarget, setCommitTarget] = useState<"current" | "new">(
    isProtectedBranch ? "new" : "current"
  );
  const [newBranchName, setNewBranchName] = useState(suggestedNewBranch);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Please provide a commit title");
      return;
    }

    if (commitTarget === "new" && !newBranchName.trim()) {
      setError("Please provide a new branch name");
      return;
    }

    setCommitting(true);
    setError("");

    try {
      await onCommit({
        message: message.trim(),
        description: description.trim(),
        newBranch: commitTarget === "new" ? newBranchName.trim() : null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to commit changes");
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#090d1f] p-6 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <GitCommit size={16} className="text-indigo-400" />
            <span>Commit changes</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-950/30 p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Commit Message */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Commit message
            </label>
            <input
              type="text"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Update index.ts"
              className="w-full rounded-xl border border-zinc-800 bg-black/60 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Extended Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Extended description <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add an optional extended description…"
              className="w-full rounded-xl border border-zinc-800 bg-black/60 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
            />
          </div>

          {/* Branch Destination Choice */}
          <div className="space-y-2 rounded-xl border border-zinc-800 bg-black/40 p-3 text-xs">
            <label className={`flex items-start gap-2.5 cursor-pointer ${isProtectedBranch ? "opacity-60" : ""}`}>
              <input
                type="radio"
                name="commitTarget"
                checked={commitTarget === "current"}
                disabled={isProtectedBranch}
                onChange={() => setCommitTarget("current")}
                className="mt-0.5 text-indigo-600 focus:ring-0"
              />
              <div>
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <GitBranch size={13} className="text-slate-400" />
                  <span>Commit directly to the <code className="text-indigo-300 font-mono">{currentBranch}</code> branch</span>
                </p>
                {isProtectedBranch && (
                  <p className="text-[11px] text-amber-400 mt-0.5">
                    Branch is protected. Direct commits are restricted.
                  </p>
                )}
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-zinc-800/60">
              <input
                type="radio"
                name="commitTarget"
                checked={commitTarget === "new"}
                onChange={() => setCommitTarget("new")}
                className="mt-0.5 text-indigo-600 focus:ring-0"
              />
              <div className="w-full">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <GitPullRequest size={13} className="text-indigo-400" />
                  <span>Create a <strong>new branch</strong> for this commit and start a pull request</span>
                </p>
                {commitTarget === "new" && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-mono">Branch:</span>
                    <input
                      type="text"
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="e.g. patch-1"
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={committing}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
            >
              {committing ? "Committing…" : "Commit changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { GitBranch, Plus, Trash2, Check, AlertCircle, ArrowRight } from "lucide-react";

interface RepoBranchesViewProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  viewer: any;
  onSelectBranch: (branch: string) => void;
}

export function RepoBranchesView({
  owner,
  repo,
  defaultBranch,
  viewer,
  onSelectBranch,
}: RepoBranchesViewProps) {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [fromBranch, setFromBranch] = useState(defaultBranch || "main");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBranches = () => {
    setLoading(true);
    fetch(`/api/v1/repositories/${owner}/${repo}/branches`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data?.branches) setBranches(d.data.branches);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBranches();
  }, [owner, repo]);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBranchName.trim(), fromRef: fromBranch }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d.success) {
        setError(d?.error?.message || "Failed to create branch.");
        setSubmitting(false);
        return;
      }

      setNewBranchName("");
      setShowCreateModal(false);
      loadBranches();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBranch = async (branchName: string) => {
    if (!confirm(`Are you sure you want to delete branch "${branchName}"?`)) return;

    try {
      const res = await fetch(
        `/api/v1/repositories/${owner}/${repo}/branches?name=${encodeURIComponent(branchName)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        loadBranches();
      }
    } catch {}
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <GitBranch size={16} className="text-indigo-400" /> Branches
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage Git branches in this repository.</p>
        </div>

        {viewer.canWrite && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition-all cursor-pointer"
          >
            <Plus size={14} /> New branch
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-sm divide-y divide-white/5">
          {branches.map((b) => (
            <div key={b.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white/[0.03] transition-colors gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => onSelectBranch(b.name)}
                    className="font-mono text-xs font-semibold text-indigo-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <GitBranch size={13} />
                    <span>{b.name}</span>
                  </button>

                  {b.isDefault ? (
                    <span className="rounded bg-indigo-950/80 border border-indigo-700/50 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                      default
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {b.ahead === 0 && b.behind === 0 && (
                        <span className="rounded bg-emerald-950/80 border border-emerald-700/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          Up to date
                        </span>
                      )}
                      {typeof b.ahead === "number" && b.ahead > 0 && (
                        <span className="rounded bg-emerald-950/80 border border-emerald-600/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          ↑ {b.ahead} ahead
                        </span>
                      )}
                      {typeof b.behind === "number" && b.behind > 0 && (
                        <span className="rounded bg-amber-950/80 border border-amber-600/50 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          ↓ {b.behind} behind
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {b.lastCommit && (
                  <p className="text-[11px] text-slate-400 truncate max-w-xl">
                    <span className="text-slate-300 font-medium">{b.lastCommit.message}</span>
                    <span className="text-slate-500"> · updated {b.lastCommit.relativeDate} by {b.lastCommit.author}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
                <span className="font-mono text-[11px] text-slate-500">{b.commitSha.slice(0, 7)}</span>

                {!b.isDefault && viewer.canWrite && (
                  <button
                    onClick={() => handleDeleteBranch(b.name)}
                    className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
                    title="Delete branch"
                  >
                    <Trash2 size={13} />
                  </button>
                )}

                <button
                  onClick={() => onSelectBranch(b.name)}
                  className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:text-white hover:bg-white/10 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Switch</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Branch Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <GitBranch size={18} className="text-indigo-400" /> Create a branch
            </h3>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Branch name</label>
                <input
                  type="text"
                  required
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="e.g. feature/auth-module"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Create from</label>
                <select
                  value={fromBranch}
                  onChange={(e) => setFromBranch(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b.name} value={b.name} className="bg-zinc-900 text-white">
                      {b.name} {b.isDefault ? "(default)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                >
                  {submitting ? "Creating…" : "Create branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

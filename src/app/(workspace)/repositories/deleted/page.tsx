"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderGit2,
  Trash2,
  RotateCcw,
  Clock,
  ArrowLeft,
  AlertTriangle,
  Check,
} from "lucide-react";

interface DeletedRepository {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  deletedAt: string;
  purgeAt: string;
  daysRemaining: number;
  owner: {
    username: string;
    displayName: string | null;
  };
}

export default function DeletedRepositoriesPage() {
  const [repositories, setRepositories] = useState<DeletedRepository[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadDeleted = () => {
    setLoading(true);
    fetch("/api/v1/repositories/deleted")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data?.repositories) {
          setRepositories(d.data.repositories);
        } else {
          setRepositories([]);
        }
      })
      .catch(() => setRepositories([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDeleted();
  }, []);

  const handleRestore = async (owner: string, repo: string) => {
    setActionInProgress(`restore-${repo}`);
    setMessage(null);

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/restore`, {
        method: "POST",
      });
      const d = await res.json().catch(() => null);

      if (res.ok && d?.data?.repository) {
        setMessage(`Repository '${d.data.repository.name}' successfully restored.`);
        loadDeleted();
      } else {
        setMessage(d?.error?.message || "Failed to restore repository.");
      }
    } catch {
      setMessage("Failed to restore repository.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handlePurge = async (owner: string, repoName: string, slug: string) => {
    const confirmation = prompt(`Are you sure you want to permanently delete '${repoName}'? This cannot be undone. Type '${repoName}' to confirm:`);
    if (confirmation !== repoName) {
      if (confirmation !== null) alert("Confirmation mismatch. Repository was not purged.");
      return;
    }

    setActionInProgress(`purge-${slug}`);
    setMessage(null);

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${slug}/purge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationName: confirmation }),
      });
      const d = await res.json().catch(() => null);

      if (res.ok && d?.data?.success) {
        setMessage(`Repository '${repoName}' permanently purged.`);
        loadDeleted();
      } else {
        setMessage(d?.error?.message || "Failed to purge repository.");
      }
    } catch {
      setMessage("Failed to purge repository.");
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-black p-6 sm:p-8">
      {/* Top Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link
              href="/repositories"
              className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Repositories</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Trash2 className="text-red-400" size={24} />
            Deleted Repositories
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Repositories scheduled for deletion. You can restore any repository within its 30-day grace period.
          </p>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-indigo-500/30 bg-indigo-950/30 px-4 py-2.5 text-xs text-indigo-200 flex items-center gap-2">
          <Check size={14} className="text-indigo-400" />
          <span>{message}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-1 items-center justify-center p-12">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      )}

      {/* Empty state */}
      {!loading && repositories?.length === 0 && (
        <div className="flex flex-1 items-center justify-center p-12">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center shadow-xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-slate-500 mb-4">
              <FolderGit2 size={28} />
            </div>
            <h2 className="text-lg font-bold text-white">No deleted repositories</h2>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              You do not have any repositories currently scheduled for deletion.
            </p>
            <div className="mt-6">
              <Link
                href="/repositories"
                className="inline-block rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Return to Repositories
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Repositories List */}
      {!loading && repositories && repositories.length > 0 && (
        <div className="space-y-4 max-w-4xl">
          {repositories.map((repo) => {
            const isRestoring = actionInProgress === `restore-${repo.slug}`;
            const isPurging = actionInProgress === `purge-${repo.slug}`;

            return (
              <div
                key={repo.id}
                className="rounded-2xl border border-red-500/20 bg-red-950/[0.07] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">
                      {repo.owner.username} / {repo.name}
                    </span>
                    <span className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                      <Clock size={10} />
                      {repo.daysRemaining} day{repo.daysRemaining === 1 ? "" : "s"} remaining
                    </span>
                  </div>

                  {repo.description && (
                    <p className="text-xs text-slate-400 line-clamp-1">{repo.description}</p>
                  )}

                  <p className="text-[11px] text-slate-500">
                    Scheduled on {new Date(repo.deletedAt).toLocaleDateString()} · Purge date:{" "}
                    {new Date(repo.purgeAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(repo.owner.username, repo.slug)}
                    disabled={Boolean(actionInProgress)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-40 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>{isRestoring ? "Restoring…" : "Restore"}</span>
                  </button>

                  <button
                    onClick={() => handlePurge(repo.owner.username, repo.name, repo.slug)}
                    disabled={Boolean(actionInProgress)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-950/30 px-3.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/50 disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>{isPurging ? "Purging…" : "Purge Now"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

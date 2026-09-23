"use client";

import { useEffect, useState } from "react";
import { Tag, Plus, Download, AlertCircle } from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";

interface RepoReleasesViewProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  viewer: any;
}

export function RepoReleasesView({
  owner,
  repo,
  defaultBranch,
  viewer,
}: RepoReleasesViewProps) {
  const [releases, setReleases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [tagName, setTagName] = useState("");
  const [releaseName, setReleaseName] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [isPrerelease, setIsPrerelease] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReleases = () => {
    setLoading(true);
    fetch(`/api/v1/repositories/${owner}/${repo}/releases`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data?.releases) setReleases(d.data.releases);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReleases();
  }, [owner, repo]);

  const handleCreateRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim() || !releaseName.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/releases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagName: tagName.trim(),
          name: releaseName.trim(),
          body: releaseNotes.trim() || undefined,
          targetCommitish: defaultBranch,
          isPrerelease,
        }),
      });

      const d = await res.json().catch(() => null);
      if (!res.ok || !d.success) {
        setError(d?.error?.message || "Failed to publish release.");
        setSubmitting(false);
        return;
      }

      setTagName("");
      setReleaseName("");
      setReleaseNotes("");
      setShowModal(false);
      loadReleases();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Tag size={16} className="text-indigo-400" /> Releases &amp; Tags
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Software releases and deployment artifacts.</p>
        </div>

        {viewer.canWrite && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition-all cursor-pointer"
          >
            <Plus size={14} /> Draft a new release
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : releases.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500">
          <Tag size={32} className="mx-auto mb-2 text-slate-600" />
          <p>No releases have been published yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {releases.map((rel) => {
            const zipUrl = `/api/v1/repositories/${owner}/${repo}/archive-zip?ref=${rel.tagName}`;
            return (
              <div key={rel.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-full bg-indigo-600 px-3 py-1 font-mono text-xs font-bold text-white">
                      {rel.tagName}
                    </span>
                    <h3 className="text-base font-bold text-white">{rel.name}</h3>
                    {rel.isPrerelease && (
                      <span className="rounded bg-amber-950/80 border border-amber-700/50 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        Pre-release
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-400">
                    Released by <b className="text-white">{rel.author.displayName || rel.author.username}</b>
                  </span>
                </div>

                {rel.body && (
                  <div className="mb-6">
                    <MarkdownViewer content={rel.body} />
                  </div>
                )}

                <div className="border-t border-white/5 pt-4 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Assets</span>
                  <a
                    href={zipUrl}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Download size={13} /> Source code (zip)
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Draft Release Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Tag size={18} className="text-indigo-400" /> Draft a new release
            </h3>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateRelease} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Tag version</label>
                <input
                  type="text"
                  required
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  placeholder="e.g. v1.0.0"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Release title</label>
                <input
                  type="text"
                  required
                  value={releaseName}
                  onChange={(e) => setReleaseName(e.target.value)}
                  placeholder="e.g. Initial Production Release"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Release notes</label>
                <textarea
                  rows={4}
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  placeholder="Describe what changed in this version…"
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrerelease}
                  onChange={(e) => setIsPrerelease(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-indigo-600"
                />
                <span>Set as a pre-release</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                >
                  {submitting ? "Publishing…" : "Publish release"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

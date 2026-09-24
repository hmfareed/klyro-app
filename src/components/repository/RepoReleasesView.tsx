"use client";

import { useEffect, useState } from "react";
import {
  Tag,
  Plus,
  Download,
  AlertCircle,
  FileCode,
  Package,
  Trash2,
  Copy,
  Check,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  FileArchive,
  UploadCloud,
  X,
  User,
} from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";

interface RepoReleasesViewProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  viewer: any;
}

interface QueuedAsset {
  name: string;
  size: number;
  contentType: string;
  bufferBase64: string;
}

export function RepoReleasesView({
  owner,
  repo,
  defaultBranch,
  viewer,
}: RepoReleasesViewProps) {
  const [releases, setReleases] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [tagName, setTagName] = useState("");
  const [targetBranch, setTargetBranch] = useState(defaultBranch || "main");
  const [releaseName, setReleaseName] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [isPrerelease, setIsPrerelease] = useState(false);
  const [queuedAssets, setQueuedAssets] = useState<QueuedAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [generatingNotes, setGeneratingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [copiedSha256, setCopiedSha256] = useState<string | null>(null);
  const [collapsedAssets, setCollapsedAssets] = useState<Record<string, boolean>>({});

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

  const loadBranches = () => {
    fetch(`/api/v1/repositories/${owner}/${repo}/branches`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data?.branches) setBranches(d.data.branches);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadReleases();
    loadBranches();
  }, [owner, repo]);

  const toggleAssetsCollapsed = (relId: string) => {
    setCollapsedAssets((prev) => ({ ...prev, [relId]: !prev[relId] }));
  };

  const copyChecksum = (checksum: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(checksum);
    setCopiedSha256(checksum);
    setTimeout(() => setCopiedSha256(null), 2000);
  };

  const formatSize = (bytes: number) => {
    if (!bytes && bytes !== 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Generate release notes from git history
  const handleGenerateNotes = async () => {
    if (!tagName.trim()) {
      setError("Please specify a tag version first.");
      return;
    }
    setGeneratingNotes(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/releases/generate-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tagName: tagName.trim(),
          targetCommitish: targetBranch,
        }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.notes) {
        setReleaseNotes(d.data.notes);
        if (!releaseName) {
          setReleaseName(`Release ${tagName.trim()}`);
        }
      } else {
        setError(d?.error?.message || "Failed to generate release notes.");
      }
    } catch {
      setError("Failed to auto-generate release notes.");
    } finally {
      setGeneratingNotes(false);
    }
  };

  // Handle file attachment for new release
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        if (base64) {
          setQueuedAssets((prev) => [
            ...prev,
            {
              name: file.name,
              size: file.size,
              contentType: file.type || "application/octet-stream",
              bufferBase64: base64,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeQueuedAsset = (index: number) => {
    setQueuedAssets((prev) => prev.filter((_, i) => i !== index));
  };

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
          targetCommitish: targetBranch,
          isPrerelease,
          assets: queuedAssets,
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
      setQueuedAssets([]);
      setShowModal(false);
      loadReleases();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAsset = async (assetId: string, assetName: string) => {
    if (!confirm(`Are you sure you want to remove attachment '${assetName}'?`)) return;

    try {
      const res = await fetch(
        `/api/v1/repositories/${owner}/${repo}/releases/assets/${assetId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        loadReleases();
      }
    } catch {}
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#090d1f]">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Tag size={16} className="text-indigo-400" /> Releases &amp; Distribution Assets
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Software releases, release notes, and binary attachments.</p>
        </div>

        {viewer.canWrite && (
          <button
            onClick={() => {
              setShowModal(true);
              setTargetBranch(defaultBranch || "main");
            }}
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
          <p className="text-sm font-semibold text-slate-400 mb-1">No releases published yet</p>
          <p>Create tagged releases to distribute software artifacts and changelogs.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {releases.map((rel, relIndex) => {
            const zipUrl = `/api/v1/repositories/${owner}/${repo}/archive-zip?ref=${encodeURIComponent(rel.tagName)}`;
            const tarUrl = `/api/v1/repositories/${owner}/${repo}/archive-tar?ref=${encodeURIComponent(rel.tagName)}`;
            const isAssetsCollapsed = Boolean(collapsedAssets[rel.id]);
            const totalAssetCount = (rel.assets?.length || 0) + 2;

            return (
              <div key={rel.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-sm space-y-4">
                {/* Release Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="rounded-lg bg-indigo-600 px-3 py-1 font-mono text-xs font-bold text-white shadow">
                      {rel.tagName}
                    </span>
                    <h3 className="text-base font-bold text-white">{rel.name}</h3>

                    {relIndex === 0 && !rel.isPrerelease && (
                      <span className="rounded-md bg-emerald-950/80 border border-emerald-600/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Latest
                      </span>
                    )}

                    {rel.isPrerelease && (
                      <span className="rounded-md bg-amber-950/80 border border-amber-600/50 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        Pre-release
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <div className="h-5 w-5 rounded-full bg-indigo-600/30 flex items-center justify-center text-[10px] text-indigo-300 font-bold">
                      <User size={12} />
                    </div>
                    <span>
                      Released by <b className="text-white">{rel.author.displayName || rel.author.username}</b>
                    </span>
                    <span className="text-slate-500">· {new Date(rel.publishedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Release Body / Notes */}
                {rel.body ? (
                  <div className="py-2">
                    <MarkdownViewer content={rel.body} />
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No description provided.</p>
                )}

                {/* Assets Accordion */}
                <div className="border-t border-white/10 pt-4">
                  <button
                    onClick={() => toggleAssetsCollapsed(rel.id)}
                    className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer mb-3"
                  >
                    {isAssetsCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <span>Assets</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.2 text-[10px] font-mono text-slate-300">
                      {totalAssetCount}
                    </span>
                  </button>

                  {!isAssetsCollapsed && (
                    <div className="rounded-xl border border-white/10 bg-black/40 divide-y divide-white/5 overflow-hidden">
                      {/* Attached Binary Assets */}
                      {rel.assets &&
                        rel.assets.map((asset: any) => {
                          const downloadUrl = `/api/v1/repositories/${owner}/${repo}/releases/assets/${asset.id}`;
                          const isCopied = copiedSha256 === asset.sha256;

                          return (
                            <div
                              key={asset.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between p-3 hover:bg-white/[0.03] transition-colors gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Package size={15} className="text-indigo-400 shrink-0" />
                                <a
                                  href={downloadUrl}
                                  download={asset.name}
                                  className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline truncate"
                                >
                                  {asset.name}
                                </a>
                                <span className="text-slate-500 text-[11px] shrink-0 font-mono">
                                  {formatSize(asset.size)}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                                {/* SHA-256 Checksum Badge */}
                                <button
                                  onClick={(e) => copyChecksum(asset.sha256, e)}
                                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-slate-400 hover:text-slate-200 hover:bg-white/10 flex items-center gap-1 transition-colors"
                                  title="Copy SHA-256 checksum"
                                >
                                  <ShieldCheck size={11} className="text-emerald-400" />
                                  <span>{asset.sha256.slice(0, 10)}…</span>
                                  {isCopied ? (
                                    <Check size={10} className="text-emerald-400" />
                                  ) : (
                                    <Copy size={10} className="text-slate-500" />
                                  )}
                                </button>

                                <span className="text-slate-500 text-[11px]">
                                  {asset.downloadCount} {asset.downloadCount === 1 ? "download" : "downloads"}
                                </span>

                                <a
                                  href={downloadUrl}
                                  download={asset.name}
                                  className="rounded-lg bg-indigo-600/30 border border-indigo-500/40 p-1.5 text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors"
                                  title="Download asset"
                                >
                                  <Download size={13} />
                                </a>

                                {viewer.canWrite && (
                                  <button
                                    onClick={() => handleDeleteAsset(asset.id, asset.name)}
                                    className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
                                    title="Delete asset"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                      {/* Source code (zip) */}
                      <div className="flex items-center justify-between p-3 hover:bg-white/[0.03] transition-colors text-xs">
                        <div className="flex items-center gap-2.5">
                          <FileArchive size={15} className="text-indigo-400" />
                          <a
                            href={zipUrl}
                            className="font-medium text-slate-300 hover:text-white hover:underline"
                          >
                            Source code (zip)
                          </a>
                        </div>
                        <a
                          href={zipUrl}
                          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Download ZIP archive"
                        >
                          <Download size={13} />
                        </a>
                      </div>

                      {/* Source code (tar.gz) */}
                      <div className="flex items-center justify-between p-3 hover:bg-white/[0.03] transition-colors text-xs">
                        <div className="flex items-center gap-2.5">
                          <FileCode size={15} className="text-indigo-400" />
                          <a
                            href={tarUrl}
                            className="font-medium text-slate-300 hover:text-white hover:underline"
                          >
                            Source code (tar.gz)
                          </a>
                        </div>
                        <a
                          href={tarUrl}
                          className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                          title="Download tarball archive"
                        >
                          <Download size={13} />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Draft Release Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Tag size={18} className="text-indigo-400" /> Draft a new release
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateRelease} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target branch</label>
                  <select
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {branches.length > 0 ? (
                      branches.map((b) => (
                        <option key={b.name} value={b.name} className="bg-zinc-900 text-white">
                          {b.name} {b.isDefault ? "(default)" : ""}
                        </option>
                      ))
                    ) : (
                      <option value={defaultBranch || "main"} className="bg-zinc-900 text-white">
                        {defaultBranch || "main"}
                      </option>
                    )}
                  </select>
                </div>
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Release notes</label>
                  <button
                    type="button"
                    onClick={handleGenerateNotes}
                    disabled={generatingNotes}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-500/20 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles size={11} className={generatingNotes ? "animate-spin" : ""} />
                    <span>{generatingNotes ? "Generating changelog…" : "Generate release notes"}</span>
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  placeholder="Describe what changed in this version (Markdown supported)…"
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>

              {/* Binary Asset Upload Drag & Drop Zone */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Attach binary distribution assets
                </label>
                <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-4 text-center hover:bg-white/[0.04] transition-colors relative">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <UploadCloud size={24} className="text-indigo-400" />
                    <p className="text-xs text-slate-300 font-medium">
                      Drag and drop binaries or click to browse
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Executables, zips, tars, installer packages (.exe, .zip, .tar.gz, .dmg, .deb)
                    </p>
                  </div>
                </div>

                {/* Queued Attachments Preview */}
                {queuedAssets.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {queuedAssets.map((asset, aIdx) => (
                      <div
                        key={aIdx}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Package size={13} className="text-indigo-400 shrink-0" />
                          <span className="text-slate-200 truncate">{asset.name}</span>
                          <span className="text-slate-500 text-[10px] font-mono">
                            ({formatSize(asset.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeQueuedAsset(aIdx)}
                          className="rounded p-1 text-slate-400 hover:text-rose-400"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
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
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors cursor-pointer"
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

"use client";

import { useEffect, useState } from "react";
import {
  GitPullRequest,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  GitMerge,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  FileText,
  User,
  Sparkles,
  AlertOctagon,
  CornerDownRight,
  FileCode,
  Send,
} from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";
import { RepoDiffViewer } from "./RepoDiffViewer";
import { RepoReviewModal } from "./RepoReviewModal";

interface RepoPullRequestsViewProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  viewer: any;
  selectedPRNumber?: number | null;
  onSelectPR: (number: number | null) => void;
}

function InlineTimelineReply({
  parentId,
  onReply,
}: {
  parentId: string;
  onReply: (parentId: string, body: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer"
      >
        <MessageSquare size={12} /> Reply to thread…
      </button>
    );
  }

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onReply(parentId, text.trim());
      setText("");
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950 p-3 space-y-2">
      <textarea
        rows={2}
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Reply to this thread…"
        className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setText("");
          }}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
        >
          <Send size={12} /> {submitting ? "Replying…" : "Reply"}
        </button>
      </div>
    </div>
  );
}

export function RepoPullRequestsView({
  owner,
  repo,
  defaultBranch,
  viewer,
  selectedPRNumber,
  onSelectPR,
}: RepoPullRequestsViewProps) {
  const [pulls, setPulls] = useState<any[]>([]);
  const [counts, setCounts] = useState({ open: 0, merged: 0, closed: 0 });
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "MERGED" | "CLOSED">("OPEN");
  const [loading, setLoading] = useState(true);

  // New PR mode
  const [isCreating, setIsCreating] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [baseBranch, setBaseBranch] = useState(defaultBranch || "main");
  const [headBranch, setHeadBranch] = useState("");
  const [comparison, setComparison] = useState<any>(null);
  const [comparing, setComparing] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // PR Detail state
  const [prDetail, setPrDetail] = useState<any>(null);
  const [prComparison, setPrComparison] = useState<any>(null);
  const [reviewStats, setReviewStats] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<"conversation" | "commits" | "files">("conversation");
  const [newComment, setNewComment] = useState("");
  const [reviewState, setReviewState] = useState<"COMMENTED" | "APPROVED" | "CHANGES_REQUESTED">("COMMENTED");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Load PR list
  const loadPulls = () => {
    setLoading(true);
    fetch(`/api/v1/repositories/${owner}/${repo}/pulls?status=${statusFilter}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data) {
          setPulls(d.data.pullRequests || []);
          if (d.data.counts) setCounts(d.data.counts);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!selectedPRNumber && !isCreating) {
      loadPulls();
    }
  }, [owner, repo, statusFilter, selectedPRNumber, isCreating]);

  // Load branches for creating PR
  useEffect(() => {
    fetch(`/api/v1/repositories/${owner}/${repo}/branches`)
      .then((r) => r.json())
      .then((d) => {
        const list = d?.data?.branches || [];
        setBranches(list);
        if (list.length > 1 && !headBranch) {
          const nonDefault = list.find((b: any) => !b.isDefault);
          if (nonDefault) setHeadBranch(nonDefault.name);
        }
      })
      .catch(() => {});
  }, [owner, repo]);

  // Compare branches when base or head changes
  useEffect(() => {
    if (!isCreating || !baseBranch || !headBranch || baseBranch === headBranch) {
      setComparison(null);
      return;
    }
    setComparing(true);
    fetch(`/api/v1/repositories/${owner}/${repo}/pulls?compare=true&base=${baseBranch}&head=${headBranch}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.data?.comparison) {
          setComparison(d.data.comparison);
          if (!newTitle && d.data.comparison.commits?.[0]?.message) {
            setNewTitle(d.data.comparison.commits[0].message);
          }
        }
      })
      .catch(() => setComparison(null))
      .finally(() => setComparing(false));
  }, [isCreating, baseBranch, headBranch, owner, repo]);

  // Load PR detail
  useEffect(() => {
    if (!selectedPRNumber) {
      setPrDetail(null);
      setPrComparison(null);
      setReviewStats(null);
      return;
    }

    setDetailLoading(true);
    setMergeError(null);
    fetch(`/api/v1/repositories/${owner}/${repo}/pulls/${selectedPRNumber}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data?.pullRequest) {
          setPrDetail(d.data.pullRequest);
          setPrComparison(d.data.comparison);
          if (d.data.reviewStats) setReviewStats(d.data.reviewStats);
        }
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [selectedPRNumber, owner, repo]);

  // Create PR submit
  const handleCreatePR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSubmitting(true);
    setCreateError(null);

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/pulls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          body: newBody.trim() || undefined,
          baseBranch,
          headBranch,
        }),
      });

      const d = await res.json().catch(() => null);
      if (!res.ok || !d.success) {
        setCreateError(d?.error?.message || "Failed to open pull request.");
        setSubmitting(false);
        return;
      }

      setIsCreating(false);
      onSelectPR(d.data.pullRequest.number);
    } catch {
      setCreateError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  // Merge PR
  const handleMergePR = async () => {
    if (!prDetail) return;
    setMerging(true);
    setMergeError(null);

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/pulls/${prDetail.number}/merge`, {
        method: "POST",
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d.success) {
        setMergeError(d?.error?.message || "Merge failed.");
        setMerging(false);
        return;
      }

      setPrDetail(d.data.pullRequest);
    } catch {
      setMergeError("Failed to merge pull request.");
    } finally {
      setMerging(false);
    }
  };

  // Toggle Close / Reopen PR
  const handleToggleClose = async () => {
    if (!prDetail) return;
    const nextStatus = prDetail.status === "OPEN" ? "CLOSED" : "OPEN";

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/pulls/${prDetail.number}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.pullRequest) {
        setPrDetail(d.data.pullRequest);
      }
    } catch {}
  };

  // Add Comment / Review from Conversation Tab
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !prDetail) return;

    setSubmittingComment(true);

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/pulls/${prDetail.number}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: newComment.trim(),
          reviewState: reviewState !== "COMMENTED" ? reviewState : undefined,
        }),
      });

      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.comment) {
        setPrDetail((prev: any) => ({
          ...prev,
          comments: [...(prev.comments || []), d.data.comment],
          reviews: d.data.review ? [...(prev.reviews || []), d.data.review] : prev.reviews,
        }));
        setNewComment("");
      }
    } catch {} finally {
      setSubmittingComment(false);
    }
  };

  // Add Line-Level Diff Comment
  const handleAddDiffComment = async (data: {
    diffPath: string;
    diffLine: number;
    side: "LEFT" | "RIGHT";
    body: string;
  }) => {
    if (!prDetail) return;
    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/pulls/${prDetail.number}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.comment) {
        setPrDetail((prev: any) => ({
          ...prev,
          comments: [...(prev.comments || []), d.data.comment],
        }));
      }
    } catch {}
  };

  // Reply to Comment Thread
  const handleReplyComment = async (parentId: string, body: string) => {
    if (!prDetail) return;
    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/pulls/${prDetail.number}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId, body }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.comment) {
        setPrDetail((prev: any) => ({
          ...prev,
          comments: prev.comments.map((c: any) =>
            c.id === parentId
              ? { ...c, replies: [...(c.replies || []), d.data.comment] }
              : c
          ),
        }));
      }
    } catch {}
  };

  // Resolve / Unresolve Thread
  const handleResolveThread = async (commentId: string, resolved: boolean) => {
    if (!prDetail) return;
    try {
      const res = await fetch(
        `/api/v1/repositories/${owner}/${repo}/pulls/${prDetail.number}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolved }),
        }
      );
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.comment) {
        setPrDetail((prev: any) => ({
          ...prev,
          comments: prev.comments.map((c: any) =>
            c.id === commentId
              ? {
                  ...c,
                  resolvedAt: d.data.comment.resolvedAt,
                  resolvedBy: d.data.comment.resolvedBy,
                }
              : c
          ),
        }));
      }
    } catch {}
  };

  // Submit Formal Review
  const handleSubmitReview = async (
    state: "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED",
    body: string
  ): Promise<boolean> => {
    if (!prDetail) return false;
    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/pulls/${prDetail.number}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, body: body || undefined }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.review) {
        // Refresh PR detail
        const fresh = await fetch(`/api/v1/repositories/${owner}/${repo}/pulls/${prDetail.number}`)
          .then((r) => r.json())
          .catch(() => null);
        if (fresh?.data?.pullRequest) {
          setPrDetail(fresh.data.pullRequest);
          if (fresh.data.reviewStats) setReviewStats(fresh.data.reviewStats);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // ==========================================
  // VIEW: NEW PULL REQUEST CREATION
  // ==========================================
  if (isCreating) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <GitPullRequest size={18} className="text-indigo-400" /> Compare changes &amp; Open Pull Request
          </h2>
          <button
            onClick={() => setIsCreating(false)}
            className="text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
        </div>

        {/* Branch selectors */}
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex-wrap">
          <span className="text-xs text-slate-400">base:</span>
          <select
            value={baseBranch}
            onChange={(e) => setBaseBranch(e.target.value)}
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white"
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>

          <span className="text-slate-500">←</span>

          <span className="text-xs text-slate-400">compare:</span>
          <select
            value={headBranch}
            onChange={(e) => setHeadBranch(e.target.value)}
            className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-xs text-white"
          >
            {branches.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>

          {comparing ? (
            <span className="text-xs text-slate-400 flex items-center gap-1.5 ml-auto">
              <div className="h-3 w-3 animate-spin rounded-full border border-indigo-400 border-t-transparent" />
              Checking mergeability…
            </span>
          ) : comparison ? (
            <div className="flex items-center gap-2 ml-auto">
              {comparison.hasConflicts ? (
                <span className="flex items-center gap-1 rounded bg-rose-950/80 border border-rose-800/40 px-2 py-0.5 text-[11px] text-rose-300 font-semibold">
                  <XCircle size={13} /> Can&apos;t automatically merge (conflicts)
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-800/40 px-2 py-0.5 text-[11px] text-emerald-300 font-semibold">
                  <CheckCircle2 size={13} /> Able to merge
                </span>
              )}
            </div>
          ) : null}
        </div>

        {createError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
            {createError}
          </div>
        )}

        {/* PR Form */}
        <form onSubmit={handleCreatePR} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Title</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. feat: add student attendance tracking"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description</label>
            <textarea
              rows={4}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Explain the changes in this pull request…"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !newTitle.trim() || baseBranch === headBranch}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-40"
          >
            {submitting ? "Opening pull request…" : "Create pull request"}
          </button>
        </form>

        {/* Live diff preview */}
        {comparison && (
          <div className="pt-6 border-t border-white/10 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Diff Preview: {comparison.stats.filesChanged} file(s) changed (+{comparison.stats.additions}, -{comparison.stats.deletions})
            </h3>
            {comparison.files.map((f: any, idx: number) => (
              <div key={idx} className="overflow-hidden rounded-xl border border-white/10 bg-zinc-950 font-mono text-xs">
                <div className="border-b border-white/10 bg-white/[0.03] px-4 py-2 font-semibold text-white">
                  {f.newPath}
                </div>
                <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed text-slate-300 whitespace-pre">
                  {f.patch}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: PR DETAIL PAGE
  // ==========================================
  if (selectedPRNumber) {
    if (detailLoading || !prDetail) {
      return (
        <div className="flex flex-1 items-center justify-center p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      );
    }

    const isMerged = prDetail.status === "MERGED";
    const isClosed = prDetail.status === "CLOSED";
    const isOpen = prDetail.status === "OPEN";

    // Build unified chronological timeline (reviews + comments)
    const timelineItems: any[] = [];
    if (prDetail.reviews) {
      for (const r of prDetail.reviews) {
        timelineItems.push({ type: "review", data: r, createdAt: new Date(r.createdAt).getTime() });
      }
    }
    if (prDetail.comments) {
      for (const c of prDetail.comments) {
        timelineItems.push({ type: "comment", data: c, createdAt: new Date(c.createdAt).getTime() });
      }
    }
    timelineItems.sort((a, b) => a.createdAt - b.createdAt);

    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Review Modal */}
        <RepoReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          onSubmitReview={handleSubmitReview}
          isAuthor={prDetail.authorId === (viewer?.userId || "")}
        />

        {/* Back navigation */}
        <button
          onClick={() => onSelectPR(null)}
          className="text-xs font-semibold text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          ← Back to pull requests
        </button>

        {/* PR Header */}
        <div className="border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-xl font-bold text-white">{prDetail.title}</h1>
            <span className="text-lg font-mono text-slate-500">#{prDetail.number}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-white ${
                isMerged ? "bg-purple-600" : isClosed ? "bg-rose-600" : "bg-emerald-600"
              }`}
            >
              {isMerged ? <GitMerge size={13} /> : isOpen ? <GitPullRequest size={13} /> : <XCircle size={13} />}
              <span>{isMerged ? "Merged" : isOpen ? "Open" : "Closed"}</span>
            </span>

            <span className="text-slate-400">
              <b className="text-white">{prDetail.author.displayName || prDetail.author.username}</b> wants to merge into{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-indigo-300">{prDetail.baseBranch}</code>{" "}
              from{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-indigo-300">{prDetail.headBranch}</code>
            </span>
          </div>
        </div>

        {/* PR Tabs: Conversation, Commits, Files Changed */}
        <div className="flex items-center gap-2 border-b border-white/10">
          <button
            onClick={() => setDetailTab("conversation")}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              detailTab === "conversation" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Conversation ({prDetail.comments?.length || 0})
          </button>
          <button
            onClick={() => setDetailTab("commits")}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              detailTab === "commits" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Commits ({prComparison?.commits?.length || 0})
          </button>
          <button
            onClick={() => setDetailTab("files")}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              detailTab === "files" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-white"
            }`}
          >
            Files Changed ({prComparison?.files?.length || 0})
          </button>
        </div>

        {/* Tab Content: Conversation */}
        {detailTab === "conversation" && (
          <div className="space-y-6">
            {/* Review Status Banner */}
            {reviewStats && (reviewStats.approvedCount > 0 || reviewStats.changesRequestedCount > 0) && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-3 text-xs">
                  {reviewStats.approvedCount > 0 && (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-950/80 border border-emerald-800/40 px-3 py-1 font-semibold text-emerald-300">
                      <CheckCircle2 size={13} /> {reviewStats.approvedCount} approval{reviewStats.approvedCount > 1 ? "s" : ""}
                    </span>
                  )}
                  {reviewStats.changesRequestedCount > 0 && (
                    <span className="flex items-center gap-1.5 rounded-full bg-rose-950/80 border border-rose-800/40 px-3 py-1 font-semibold text-rose-300">
                      <AlertOctagon size={13} /> {reviewStats.changesRequestedCount} change request{reviewStats.changesRequestedCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {isOpen && (
                  <button
                    onClick={() => setIsReviewModalOpen(true)}
                    className="rounded-xl border border-indigo-500/40 bg-indigo-600/10 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                  >
                    Review changes
                  </button>
                )}
              </div>
            )}

            {/* PR Description Box */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm">
              <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-3 text-xs text-slate-400">
                <span className="font-semibold text-white">{prDetail.author.displayName || prDetail.author.username}</span>
                <span>opened this pull request</span>
              </div>
              {prDetail.body ? (
                <MarkdownViewer content={prDetail.body} />
              ) : (
                <p className="text-xs text-slate-500 italic">No description provided.</p>
              )}
            </div>

            {/* Timeline: Formal Reviews & Comments */}
            {timelineItems.map((item) => {
              if (item.type === "review") {
                const r = item.data;
                const isApproved = r.state === "APPROVED";
                const isChangesRequested = r.state === "CHANGES_REQUESTED";

                return (
                  <div
                    key={`review-${r.id}`}
                    className={`rounded-2xl border p-4 shadow-sm space-y-2 ${
                      isApproved
                        ? "border-emerald-500/40 bg-emerald-950/15"
                        : isChangesRequested
                        ? "border-rose-500/40 bg-rose-950/15"
                        : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {isApproved ? (
                          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                        ) : isChangesRequested ? (
                          <AlertOctagon size={16} className="text-rose-400 shrink-0" />
                        ) : (
                          <MessageSquare size={16} className="text-slate-400 shrink-0" />
                        )}
                        <span className="font-semibold text-white">
                          {r.reviewer?.displayName || r.reviewer?.username}
                        </span>
                        <span
                          className={
                            isApproved
                              ? "text-emerald-300 font-semibold"
                              : isChangesRequested
                              ? "text-rose-300 font-semibold"
                              : "text-slate-400"
                          }
                        >
                          {isApproved
                            ? "approved these changes"
                            : isChangesRequested
                            ? "requested changes"
                            : "left a review"}
                        </span>
                      </div>
                    </div>

                    {r.body && (
                      <div className="pt-2 border-t border-white/10 text-slate-200">
                        <MarkdownViewer content={r.body} />
                      </div>
                    )}
                  </div>
                );
              }

              // Comment item
              const c = item.data;
              const isDiffComment = !!c.diffPath;
              const isResolved = !!c.resolvedAt;

              if (isDiffComment) {
                return (
                  <div
                    key={`comment-${c.id}`}
                    className="rounded-2xl border border-indigo-500/30 bg-[#090d1f] p-5 shadow-sm space-y-3 font-sans"
                  >
                    {/* Diff Location Header */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-2 text-xs">
                      <div className="flex items-center gap-2">
                        <FileCode size={14} className="text-indigo-400" />
                        <span className="font-mono font-semibold text-white">{c.diffPath}</span>
                        <span className="font-mono text-slate-400">
                          (line {c.diffLine}, {c.side || "RIGHT"})
                        </span>
                      </div>

                      {isResolved ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                          <CheckCircle2 size={12} /> Resolved
                        </span>
                      ) : (
                        <button
                          onClick={() => handleResolveThread(c.id, true)}
                          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-emerald-400 hover:bg-emerald-950/40 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 size={12} /> Resolve
                        </button>
                      )}
                    </div>

                    {/* Root Comment Author & Body */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-semibold text-white">
                          {c.author?.displayName || c.author?.username}
                        </span>
                        <span>commented</span>
                      </div>
                      <MarkdownViewer content={c.body} />
                    </div>

                    {/* Replies */}
                    {c.replies?.map((reply: any) => (
                      <div key={reply.id} className="ml-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-1 text-xs">
                        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                          <CornerDownRight size={12} className="text-slate-500 shrink-0" />
                          <span className="font-semibold text-white">
                            {reply.author?.displayName || reply.author?.username}
                          </span>
                        </div>
                        <MarkdownViewer content={reply.body} />
                      </div>
                    ))}

                    {/* Quick Inline Reply */}
                    <div className="pt-2">
                      <InlineTimelineReply
                        parentId={c.id}
                        onReply={handleReplyComment}
                      />
                    </div>
                  </div>
                );
              }

              // General Comment
              return (
                <div key={`comment-${c.id}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-3 text-xs text-slate-400">
                    <span className="font-semibold text-white">{c.author.displayName || c.author.username}</span>
                    <span>commented</span>
                  </div>
                  <MarkdownViewer content={c.body} />
                </div>
              );
            })}

            {/* Merge Card (if OPEN) */}
            {isOpen && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {prComparison?.hasConflicts ? (
                      <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={20} />
                    ) : (
                      <CheckCircle2 className="text-emerald-400 shrink-0 mt-0.5" size={20} />
                    )}
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {prComparison?.hasConflicts
                          ? "This branch has conflicts that must be resolved"
                          : "This branch has no conflicts with the base branch"}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {prComparison?.hasConflicts
                          ? "Merging can only be completed after resolving conflicting files."
                          : "Changes can be automatically merged into the base branch."}
                      </p>
                    </div>
                  </div>

                  {viewer?.canWrite && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleClose}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white"
                      >
                        Close PR
                      </button>

                      <button
                        onClick={handleMergePR}
                        disabled={merging || prComparison?.hasConflicts}
                        className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-xs font-semibold text-white shadow-lg hover:bg-purple-500 disabled:opacity-40 cursor-pointer"
                      >
                        {merging ? (
                          "Merging Git branch…"
                        ) : (
                          <>
                            <GitMerge size={14} /> Merge pull request
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {mergeError && (
                  <p className="mt-3 text-xs text-rose-400 font-semibold">{mergeError}</p>
                )}
              </div>
            )}

            {/* Add General Comment Form */}
            <form onSubmit={handleAddComment} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
              <h4 className="text-xs font-bold text-white">Add a comment</h4>
              <textarea
                rows={3}
                required
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Leave a comment…"
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
              />

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(true)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Review changes…
                </button>

                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                >
                  {submittingComment ? "Submitting…" : "Comment"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab Content: Commits */}
        {detailTab === "commits" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] shadow-sm divide-y divide-white/5">
            {prComparison?.commits?.map((c: any) => (
              <div key={c.sha} className="flex items-center justify-between p-4 text-xs">
                <div>
                  <p className="font-semibold text-white">{c.message}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {c.author} committed {c.relativeDate}
                  </p>
                </div>
                <span className="font-mono text-indigo-400">{c.shortSha}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content: Files Changed (Interactive Diff Viewer) */}
        {detailTab === "files" && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#0c1022] p-3">
              <div className="flex items-center gap-3 text-xs text-slate-300">
                <span className="font-semibold text-white">
                  Showing {prComparison?.files?.length || 0} changed file{prComparison?.files?.length === 1 ? "" : "s"}
                </span>
                <span className="text-emerald-400 font-semibold">+{prComparison?.stats?.additions || 0}</span>
                <span className="text-rose-400 font-semibold">-{prComparison?.stats?.deletions || 0}</span>
              </div>

              {isOpen && (
                <button
                  onClick={() => setIsReviewModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition-all cursor-pointer"
                >
                  <CheckCircle2 size={14} /> Review changes
                </button>
              )}
            </div>

            {/* Interactive Diff Viewer */}
            {prComparison?.files?.length > 0 ? (
              <RepoDiffViewer
                files={prComparison.files}
                comments={prDetail.comments || []}
                onAddComment={handleAddDiffComment}
                onReplyComment={handleReplyComment}
                onResolveThread={handleResolveThread}
                canComment={viewer?.canRead}
              />
            ) : (
              <div className="p-8 text-center text-xs text-slate-500 italic">No files changed.</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW: PR LIST
  // ==========================================
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        {/* Status filters */}
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1 w-fit">
          <button
            onClick={() => setStatusFilter("OPEN")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === "OPEN" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Open ({counts.open})
          </button>
          <button
            onClick={() => setStatusFilter("MERGED")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === "MERGED" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Merged ({counts.merged})
          </button>
          <button
            onClick={() => setStatusFilter("CLOSED")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === "CLOSED" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Closed ({counts.closed})
          </button>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition-all cursor-pointer"
        >
          <Plus size={14} /> New pull request
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : pulls.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500">
          <GitPullRequest size={32} className="mx-auto mb-2 text-slate-600" />
          <p>No {statusFilter.toLowerCase()} pull requests.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-sm divide-y divide-white/5">
          {pulls.map((pr) => (
            <div
              key={pr.id}
              onClick={() => onSelectPR(pr.number)}
              className="flex items-center justify-between p-4 hover:bg-white/[0.04] transition-colors cursor-pointer group"
            >
              <div className="flex items-start gap-3 min-w-0 pr-4">
                <span className="mt-0.5 text-emerald-400">
                  <GitPullRequest size={16} />
                </span>
                <div>
                  <h3 className="text-xs font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                    {pr.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    #{pr.number} by <span className="text-slate-400">{pr.author.displayName || pr.author.username}</span> •{" "}
                    {pr.baseBranch} ← {pr.headBranch}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-slate-500 text-xs">
                {pr._count?.comments > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare size={13} /> {pr._count.comments}
                  </span>
                )}
                <ArrowRight size={14} className="group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  CircleDot,
  CheckCircle2,
  Plus,
  MessageSquare,
  ArrowRight,
  User,
  Tag,
  AlertCircle,
  GitPullRequest,
} from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";

interface RepoIssuesViewProps {
  owner: string;
  repo: string;
  viewer: any;
  selectedIssueNumber?: number | null;
  onSelectIssue: (number: number | null) => void;
}

export function RepoIssuesView({
  owner,
  repo,
  viewer,
  selectedIssueNumber,
  onSelectIssue,
}: RepoIssuesViewProps) {
  const [issues, setIssues] = useState<any[]>([]);
  const [counts, setCounts] = useState({ open: 0, closed: 0 });
  const [statusFilter, setStatusFilter] = useState<"OPEN" | "CLOSED">("OPEN");
  const [loading, setLoading] = useState(true);

  // New Issue modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [labelsInput, setLabelsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Issue detail state
  const [issueDetail, setIssueDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const loadIssues = () => {
    setLoading(true);
    fetch(`/api/v1/repositories/${owner}/${repo}/issues?status=${statusFilter}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data) {
          setIssues(d.data.issues || []);
          if (d.data.counts) setCounts(d.data.counts);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!selectedIssueNumber && !showCreateModal) {
      loadIssues();
    }
  }, [owner, repo, statusFilter, selectedIssueNumber, showCreateModal]);

  // Load issue detail
  useEffect(() => {
    if (!selectedIssueNumber) {
      setIssueDetail(null);
      return;
    }
    setDetailLoading(true);
    fetch(`/api/v1/repositories/${owner}/${repo}/issues/${selectedIssueNumber}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data?.issue) setIssueDetail(d.data.issue);
      })
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [selectedIssueNumber, owner, repo]);

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSubmitting(true);
    setError(null);

    const labels = labelsInput
      .split(",")
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          body: newBody.trim() || undefined,
          labels,
        }),
      });

      const d = await res.json().catch(() => null);
      if (!res.ok || !d.success) {
        setError(d?.error?.message || "Failed to create issue.");
        setSubmitting(false);
        return;
      }

      setNewTitle("");
      setNewBody("");
      setLabelsInput("");
      setShowCreateModal(false);
      onSelectIssue(d.data.issue.number);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !issueDetail) return;

    setSubmittingComment(true);

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/issues/${issueDetail.number}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newComment.trim() }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.comment) {
        setIssueDetail((prev: any) => ({
          ...prev,
          comments: [...(prev.comments || []), d.data.comment],
        }));
        setNewComment("");
      }
    } catch {} finally {
      setSubmittingComment(false);
    }
  };

  const handleToggleClose = async () => {
    if (!issueDetail) return;
    const nextStatus = issueDetail.status === "OPEN" ? "CLOSED" : "OPEN";

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/issues/${issueDetail.number}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.issue) {
        setIssueDetail(d.data.issue);
      }
    } catch {}
  };

  // ==========================================
  // VIEW: ISSUE DETAIL
  // ==========================================
  if (selectedIssueNumber) {
    if (detailLoading || !issueDetail) {
      return (
        <div className="flex flex-1 items-center justify-center p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      );
    }

    const isOpen = issueDetail.status === "OPEN";

    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <button
          onClick={() => onSelectIssue(null)}
          className="text-xs font-semibold text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          ← Back to issues
        </button>

        {/* Issue Header */}
        <div className="border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-xl font-bold text-white">{issueDetail.title}</h1>
            <span className="text-lg font-mono text-slate-500">#{issueDetail.number}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-white ${
                isOpen ? "bg-emerald-600" : "bg-purple-600"
              }`}
            >
              {isOpen ? <CircleDot size={13} /> : <CheckCircle2 size={13} />}
              <span>{isOpen ? "Open" : "Closed"}</span>
            </span>

            <span className="text-slate-400">
              <b className="text-white">{issueDetail.author.displayName || issueDetail.author.username}</b> opened this issue
            </span>

            {issueDetail.closedByPR && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 text-[11px] font-medium text-purple-200">
                <GitPullRequest size={12} className="text-purple-400" />
                <span>Closed by PR</span>
                <span className="font-semibold text-white">#{issueDetail.closedByPR.number}</span>
              </span>
            )}

            {issueDetail.labels?.map((label: string) => (
              <span
                key={label}
                className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-300 border border-white/10"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Issue Body */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-3 text-xs text-slate-400">
            <span className="font-semibold text-white">{issueDetail.author.displayName || issueDetail.author.username}</span>
            <span>commented</span>
          </div>
          {issueDetail.body ? (
            <MarkdownViewer content={issueDetail.body} />
          ) : (
            <p className="text-xs text-slate-500 italic">No description provided.</p>
          )}
        </div>

        {/* Comments List */}
        {issueDetail.comments?.map((c: any) => (
          <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-3 text-xs text-slate-400">
              <span className="font-semibold text-white">{c.author.displayName || c.author.username}</span>
              <span>commented</span>
            </div>
            <MarkdownViewer content={c.body} />
          </div>
        ))}

        {/* Add Comment Form & Close Action */}
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
              onClick={handleToggleClose}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              {isOpen ? "Close issue" : "Reopen issue"}
            </button>

            <button
              type="submit"
              disabled={submittingComment || !newComment.trim()}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              {submittingComment ? "Commenting…" : "Comment"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ==========================================
  // VIEW: ISSUE LIST
  // ==========================================
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header Bar */}
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
            onClick={() => setStatusFilter("CLOSED")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === "CLOSED" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Closed ({counts.closed})
          </button>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-500 transition-all cursor-pointer"
        >
          <Plus size={14} /> New issue
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : issues.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500">
          <CircleDot size={32} className="mx-auto mb-2 text-slate-600" />
          <p>No {statusFilter.toLowerCase()} issues.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-sm divide-y divide-white/5">
          {issues.map((issue) => (
            <div
              key={issue.id}
              onClick={() => onSelectIssue(issue.number)}
              className="flex items-center justify-between p-4 hover:bg-white/[0.04] transition-colors cursor-pointer group"
            >
              <div className="flex items-start gap-3 min-w-0 pr-4">
                <span className={`mt-0.5 ${issue.status === "OPEN" ? "text-emerald-400" : "text-purple-400"}`}>
                  <CircleDot size={16} />
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xs font-semibold text-white group-hover:text-indigo-400 transition-colors">
                      {issue.title}
                    </h3>
                    {issue.labels?.map((label: string) => (
                      <span
                        key={label}
                        className="rounded-full bg-white/10 px-2 py-0.2 text-[9px] font-semibold text-indigo-300"
                      >
                        {label}
                      </span>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-500 mt-1">
                    #{issue.number} opened by{" "}
                    <span className="text-slate-400">{issue.author.displayName || issue.author.username}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-slate-500 text-xs">
                {issue._count?.comments > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare size={13} /> {issue._count.comments}
                  </span>
                )}
                <ArrowRight size={14} className="group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Issue Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CircleDot size={18} className="text-indigo-400" /> Create a new issue
            </h3>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateIssue} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title of issue"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description</label>
                <textarea
                  rows={4}
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  placeholder="Describe the issue, bug, or feature request…"
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Labels <span className="text-slate-500 font-normal">(comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={labelsInput}
                  onChange={(e) => setLabelsInput(e.target.value)}
                  placeholder="bug, enhancement, frontend"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
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
                  className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                >
                  {submitting ? "Submitting…" : "Submit new issue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

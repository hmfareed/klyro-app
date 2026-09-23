"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Plus, ArrowLeft, Send, Pin } from "lucide-react";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
}

interface Thread {
  id: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  author: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  _count: { comments: number };
}

export function WorkspaceDiscussions({ slug, isMember }: { slug: string; isMember: boolean }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<{
    id: string;
    title: string;
    body: string;
    author: { username: string; displayName: string | null };
    createdAt: string;
    comments: Comment[];
  } | null>(null);

  // New Thread Modal
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // Comment input
  const [commentInput, setCommentInput] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const fetchThreads = useCallback(() => {
    fetch(`/api/v1/projects/${slug}/discussions`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setThreads(data.data.threads || []);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const fetchThreadDetail = useCallback((id: string) => {
    fetch(`/api/v1/projects/${slug}/discussions/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setActiveThread(data.data.thread);
        }
      });
  }, [slug]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const selectThread = (id: string) => {
    setActiveThreadId(id);
    fetchThreadDetail(id);
  };

  const backToList = () => {
    setActiveThreadId(null);
    setActiveThread(null);
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    const res = await fetch(`/api/v1/projects/${slug}/discussions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    if (res.ok) {
      setTitle("");
      setBody("");
      setCreating(false);
      fetchThreads();
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThreadId || !commentInput.trim()) return;
    setSubmittingComment(true);
    const res = await fetch(`/api/v1/projects/${slug}/discussions/${activeThreadId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentInput }),
    });
    if (res.ok) {
      setCommentInput("");
      fetchThreadDetail(activeThreadId);
      fetchThreads();
    }
    setSubmittingComment(false);
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading discussions...</div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          {activeThreadId && (
            <button
              onClick={backToList}
              className="rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h2 className="text-base font-bold text-white">
              {activeThread ? activeThread.title : "Team Discussions"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeThread
                ? `Started by @${activeThread.author.username}`
                : "Asynchronous forum threads for design decisions, architecture, and team RFCs."}
            </p>
          </div>
        </div>

        {!activeThreadId && isMember && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm"
          >
            <Plus size={14} /> New Thread
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 overflow-y-auto min-h-0">
        {activeThread ? (
          /* Single Thread View */
          <div className="max-w-3xl space-y-6">
            {/* Thread Body Card */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white">
                  {activeThread.author.displayName?.[0] || activeThread.author.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">
                    {activeThread.author.displayName || activeThread.author.username}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {new Date(activeThread.createdAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                {activeThread.body}
              </p>
            </div>

            {/* Comments List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Responses ({activeThread.comments.length})
              </h4>

              {activeThread.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg border border-white/10 bg-[#0f172a] p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      {comment.author.displayName || comment.author.username}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(comment.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {comment.body}
                  </p>
                </div>
              ))}
            </div>

            {/* Post Comment Input */}
            {isMember && (
              <form onSubmit={handlePostComment} className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Reply to this thread..."
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submittingComment}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Send size={13} /> Reply
                </button>
              </form>
            )}
          </div>
        ) : (
          /* Threads List */
          <div className="space-y-3 max-w-4xl">
            {threads.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
                <MessageSquare size={32} className="mx-auto text-slate-600 mb-2" />
                <h3 className="text-sm font-semibold text-white">No discussions yet</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Start a thread to propose architecture decisions or coordinate sprints.
                </p>
              </div>
            ) : (
              threads.map((t) => (
                <div
                  key={t.id}
                  onClick={() => selectThread(t.id)}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-white/20 hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-indigo-400">
                      {t.isPinned ? <Pin size={16} /> : <MessageSquare size={16} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white hover:text-indigo-400 transition-colors">
                        {t.title}
                      </h4>
                      <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">{t.body}</p>
                      <div className="mt-2 text-[11px] text-slate-500">
                        by <span className="text-slate-300 font-medium">@{t.author.username}</span> &bull;{" "}
                        {new Date(t.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 shrink-0">
                    <MessageSquare size={13} />
                    <span>{t._count.comments}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* New Thread Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0f172a] p-6 text-white shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Start Discussion Thread</h3>
            <form onSubmit={handleCreateThread} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Thread Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RFC: Database partitioning strategy for telemetry"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Discussion Body *
                </label>
                <textarea
                  rows={6}
                  required
                  placeholder="Share context, options considered, and open questions..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="rounded-lg border border-white/10 px-3.5 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Post Thread
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

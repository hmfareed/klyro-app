"use client";

import { useState } from "react";
import {
  Plus,
  MessageSquare,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCode,
  CornerDownRight,
  Send,
  X,
  RotateCcw,
} from "lucide-react";
import { MarkdownViewer } from "./MarkdownViewer";

export interface DiffViewerComment {
  id: string;
  pullRequestId: string;
  authorId: string;
  author: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  body: string;
  diffPath?: string | null;
  diffLine?: number | null;
  side?: string | null;
  commitId?: string | null;
  parentId?: string | null;
  resolvedAt?: string | Date | null;
  resolvedById?: string | null;
  resolvedBy?: {
    id: string;
    username: string;
    displayName?: string | null;
  } | null;
  replies?: DiffViewerComment[];
  createdAt: string | Date;
}

export interface DiffViewerFile {
  oldPath?: string;
  newPath: string;
  status: "added" | "deleted" | "modified";
  additions: number;
  deletions: number;
  patch: string;
}

interface RepoDiffViewerProps {
  files: DiffViewerFile[];
  comments: DiffViewerComment[];
  onAddComment: (data: {
    diffPath: string;
    diffLine: number;
    side: "LEFT" | "RIGHT";
    body: string;
  }) => Promise<void>;
  onReplyComment: (parentId: string, body: string) => Promise<void>;
  onResolveThread: (commentId: string, resolved: boolean) => Promise<void>;
  canComment?: boolean;
}

interface ParsedDiffLine {
  type: "context" | "add" | "delete" | "hunk_header" | "meta";
  oldLine: number | null;
  newLine: number | null;
  content: string;
  side: "LEFT" | "RIGHT";
}

interface ParsedHunk {
  header: string;
  lines: ParsedDiffLine[];
}

function parseFilePatch(patch: string): ParsedHunk[] {
  if (!patch) return [];
  const lines = patch.split("\n");
  const hunks: ParsedHunk[] = [];
  let currentHunk: ParsedHunk | null = null;
  let oldLine = 1;
  let newLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Hunk header: @@ -oldStart,oldLen +newStart,newLen @@
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@(.*)$/);
    if (hunkMatch) {
      if (currentHunk) hunks.push(currentHunk);
      oldLine = parseInt(hunkMatch[1], 10);
      newLine = parseInt(hunkMatch[2], 10);
      currentHunk = {
        header: line,
        lines: [
          {
            type: "hunk_header",
            oldLine: null,
            newLine: null,
            content: line,
            side: "RIGHT",
          },
        ],
      };
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith("+") && !line.startsWith("+++")) {
      currentHunk.lines.push({
        type: "add",
        oldLine: null,
        newLine: newLine++,
        content: line.slice(1),
        side: "RIGHT",
      });
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      currentHunk.lines.push({
        type: "delete",
        oldLine: oldLine++,
        newLine: null,
        content: line.slice(1),
        side: "LEFT",
      });
    } else if (line.startsWith(" ")) {
      currentHunk.lines.push({
        type: "context",
        oldLine: oldLine++,
        newLine: newLine++,
        content: line.slice(1),
        side: "RIGHT",
      });
    } else if (line === "") {
      // Empty context line
      currentHunk.lines.push({
        type: "context",
        oldLine: oldLine++,
        newLine: newLine++,
        content: "",
        side: "RIGHT",
      });
    }
  }

  if (currentHunk) hunks.push(currentHunk);
  return hunks;
}

export function RepoDiffViewer({
  files,
  comments,
  onAddComment,
  onReplyComment,
  onResolveThread,
  canComment = true,
}: RepoDiffViewerProps) {
  // Collapsed state for files
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  // Active inline comment box: key is "filePath:side:line"
  const [activeComposer, setActiveComposer] = useState<string | null>(null);
  const [composerText, setComposerText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Active reply box: key is parentCommentId
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  // Expanded resolved threads: set of comment IDs
  const [expandedResolved, setExpandedResolved] = useState<Record<string, boolean>>({});

  const toggleFileCollapse = (filePath: string) => {
    setCollapsedFiles((prev) => ({ ...prev, [filePath]: !prev[filePath] }));
  };

  const toggleResolvedExpand = (commentId: string) => {
    setExpandedResolved((prev) => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const handleStartCompose = (filePath: string, side: "LEFT" | "RIGHT", line: number) => {
    setActiveComposer(`${filePath}:${side}:${line}`);
    setComposerText("");
  };

  const handleCancelCompose = () => {
    setActiveComposer(null);
    setComposerText("");
  };

  const handleSubmitNewComment = async (filePath: string, side: "LEFT" | "RIGHT", line: number) => {
    if (!composerText.trim()) return;
    setSubmittingComment(true);
    try {
      await onAddComment({
        diffPath: filePath,
        diffLine: line,
        side,
        body: composerText.trim(),
      });
      setActiveComposer(null);
      setComposerText("");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      await onReplyComment(parentId, replyText.trim());
      setActiveReplyId(null);
      setReplyText("");
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      {files.map((file) => {
        const filePath = file.newPath;
        const isCollapsed = !!collapsedFiles[filePath];
        const hunks = parseFilePatch(file.patch);

        // Filter comments relevant to this file
        const fileComments = comments.filter(
          (c) => (c.diffPath === file.newPath || c.diffPath === file.oldPath) && !c.parentId
        );

        return (
          <div
            key={filePath}
            className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 font-mono text-xs shadow-lg"
          >
            {/* File Header */}
            <div
              onClick={() => toggleFileCollapse(filePath)}
              className="flex items-center justify-between border-b border-white/10 bg-[#0c1022] px-4 py-2.5 cursor-pointer hover:bg-white/[0.04] transition-colors select-none"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-slate-400">
                  {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                </span>
                <FileCode size={15} className="text-indigo-400 shrink-0" />
                <span className="font-semibold text-white truncate">{filePath}</span>
                {file.oldPath && file.oldPath !== file.newPath && (
                  <span className="text-[11px] text-slate-500 truncate">(renamed from {file.oldPath})</span>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0 text-[11px]">
                <div className="flex items-center gap-1.5 font-semibold">
                  <span className="text-emerald-400">+{file.additions}</span>
                  <span className="text-rose-400">-{file.deletions}</span>
                </div>
                {fileComments.length > 0 && (
                  <span className="flex items-center gap-1 rounded bg-indigo-950/80 border border-indigo-700/40 px-2 py-0.5 text-indigo-300 font-semibold">
                    <MessageSquare size={11} /> {fileComments.length}
                  </span>
                )}
              </div>
            </div>

            {/* File Diff Content */}
            {!isCollapsed && (
              <div className="overflow-x-auto text-[11px] leading-relaxed">
                {hunks.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 italic">Binary file or empty changes.</div>
                ) : (
                  <div className="divide-y divide-white/[0.03]">
                    {hunks.map((hunk, hunkIdx) => (
                      <div key={hunkIdx}>
                        {hunk.lines.map((line, lineIdx) => {
                          if (line.type === "hunk_header") {
                            return (
                              <div
                                key={lineIdx}
                                className="flex bg-[#0d122b]/80 text-indigo-300/80 px-4 py-1.5 select-none font-sans text-[11px] border-y border-indigo-900/30"
                              >
                                {line.content}
                              </div>
                            );
                          }

                          const activeLineNum = line.newLine ?? line.oldLine ?? 0;
                          const composerKey = `${filePath}:${line.side}:${activeLineNum}`;
                          const isComposingThisLine = activeComposer === composerKey;

                          // Find threads on this line
                          const lineThreads = fileComments.filter((c) => {
                            if (!c.diffLine) return false;
                            if (c.diffLine === line.newLine && (!c.side || c.side === "RIGHT")) return true;
                            if (c.diffLine === line.oldLine && c.side === "LEFT") return true;
                            return false;
                          });

                          const isAdd = line.type === "add";
                          const isDelete = line.type === "delete";

                          return (
                            <div key={lineIdx} className="group relative">
                              {/* Diff Line Row */}
                              <div
                                className={`flex items-stretch hover:bg-white/[0.04] transition-colors ${
                                  isAdd
                                    ? "bg-emerald-950/20 text-emerald-200"
                                    : isDelete
                                    ? "bg-rose-950/25 text-rose-200"
                                    : "text-slate-300"
                                }`}
                              >
                                {/* Left Line Number (Old) */}
                                <div className="w-11 shrink-0 select-none pr-2 text-right text-slate-600 bg-black/30 border-r border-white/5 py-0.5">
                                  {line.oldLine || ""}
                                </div>

                                {/* Right Line Number (New) + Hover Add Comment Button */}
                                <div className="relative w-11 shrink-0 select-none pr-2 text-right text-slate-600 bg-black/30 border-r border-white/5 py-0.5 group-hover:text-slate-400">
                                  {line.newLine || ""}

                                  {canComment && (
                                    <button
                                      title="Add line comment"
                                      onClick={() => handleStartCompose(filePath, line.side, activeLineNum)}
                                      className="absolute right-[-10px] top-1/2 -translate-y-1/2 z-10 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md hover:bg-indigo-500 hover:scale-110 transition-all cursor-pointer"
                                    >
                                      <Plus size={12} strokeWidth={2.5} />
                                    </button>
                                  )}
                                </div>

                                {/* Prefix (+ / - / space) */}
                                <div className="w-6 shrink-0 select-none text-center py-0.5 font-bold">
                                  {isAdd ? "+" : isDelete ? "-" : " "}
                                </div>

                                {/* Code Content */}
                                <div className="flex-1 py-0.5 pr-4 whitespace-pre font-mono overflow-x-auto">
                                  {line.content}
                                </div>
                              </div>

                              {/* Inline Thread(s) for this line */}
                              {lineThreads.map((thread) => {
                                const isResolved = !!thread.resolvedAt;
                                const isExpanded = !!expandedResolved[thread.id];

                                return (
                                  <div
                                    key={thread.id}
                                    className="border-y border-indigo-500/30 bg-[#090d1f] p-4 font-sans text-xs space-y-3"
                                  >
                                    {/* Resolved Header Banner */}
                                    {isResolved ? (
                                      <div className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2 text-xs">
                                        <div className="flex items-center gap-2 text-slate-400">
                                          <CheckCircle2 size={14} className="text-emerald-400" />
                                          <span>
                                            Resolved by{" "}
                                            <b className="text-white">
                                              {thread.resolvedBy?.displayName || thread.resolvedBy?.username || "collaborator"}
                                            </b>
                                            {thread.replies?.length ? ` • ${thread.replies.length + 1} comments` : ""}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                          <button
                                            onClick={() => toggleResolvedExpand(thread.id)}
                                            className="text-xs text-indigo-400 hover:underline cursor-pointer"
                                          >
                                            {isExpanded ? "Hide conversation" : "Show conversation"}
                                          </button>
                                          {canComment && (
                                            <button
                                              onClick={() => onResolveThread(thread.id, false)}
                                              className="flex items-center gap-1 rounded bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:text-white hover:bg-white/10"
                                            >
                                              <RotateCcw size={11} /> Unresolve
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ) : null}

                                    {/* Discussion Body (shown if unresolved OR expanded) */}
                                    {(!isResolved || isExpanded) && (
                                      <div className="space-y-3 pt-1">
                                        {/* Root Comment */}
                                        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                                          <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px]">
                                            <div className="flex items-center gap-2">
                                              {thread.author.avatarUrl ? (
                                                <img
                                                  src={thread.author.avatarUrl}
                                                  alt=""
                                                  className="h-5 w-5 rounded-full object-cover"
                                                />
                                              ) : (
                                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 font-bold text-[9px] text-white">
                                                  {thread.author.username[0].toUpperCase()}
                                                </div>
                                              )}
                                              <span className="font-semibold text-white">
                                                {thread.author.displayName || thread.author.username}
                                              </span>
                                              <span className="text-slate-500 font-mono">
                                                line {line.side === "LEFT" ? line.oldLine : line.newLine} ({line.side})
                                              </span>
                                            </div>

                                            {!isResolved && canComment && (
                                              <button
                                                onClick={() => onResolveThread(thread.id, true)}
                                                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-950/40 hover:border-emerald-700/50 transition-colors cursor-pointer"
                                              >
                                                <CheckCircle2 size={12} /> Resolve conversation
                                              </button>
                                            )}
                                          </div>

                                          <div className="text-slate-200">
                                            <MarkdownViewer content={thread.body} />
                                          </div>
                                        </div>

                                        {/* Thread Replies */}
                                        {thread.replies?.map((reply) => (
                                          <div
                                            key={reply.id}
                                            className="ml-5 rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2"
                                          >
                                            <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-[11px]">
                                              <CornerDownRight size={12} className="text-slate-500 shrink-0" />
                                              {reply.author.avatarUrl ? (
                                                <img
                                                  src={reply.author.avatarUrl}
                                                  alt=""
                                                  className="h-4 w-4 rounded-full object-cover"
                                                />
                                              ) : (
                                                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 font-bold text-[8px] text-white">
                                                  {reply.author.username[0].toUpperCase()}
                                                </div>
                                              )}
                                              <span className="font-semibold text-white">
                                                {reply.author.displayName || reply.author.username}
                                              </span>
                                            </div>
                                            <div className="text-slate-200">
                                              <MarkdownViewer content={reply.body} />
                                            </div>
                                          </div>
                                        ))}

                                        {/* Reply Box */}
                                        {canComment && (
                                          <div className="pt-1">
                                            {activeReplyId === thread.id ? (
                                              <div className="rounded-xl border border-white/10 bg-zinc-950 p-3 space-y-2">
                                                <textarea
                                                  rows={2}
                                                  autoFocus
                                                  value={replyText}
                                                  onChange={(e) => setReplyText(e.target.value)}
                                                  placeholder="Write a reply…"
                                                  className="w-full rounded-lg border border-white/10 bg-white/5 p-2 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                                                />
                                                <div className="flex items-center justify-end gap-2">
                                                  <button
                                                    onClick={() => {
                                                      setActiveReplyId(null);
                                                      setReplyText("");
                                                    }}
                                                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:text-white"
                                                  >
                                                    Cancel
                                                  </button>
                                                  <button
                                                    onClick={() => handleSubmitReply(thread.id)}
                                                    disabled={submittingReply || !replyText.trim()}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                                                  >
                                                    <Send size={12} /> {submittingReply ? "Replying…" : "Reply"}
                                                  </button>
                                                </div>
                                              </div>
                                            ) : (
                                              <button
                                                onClick={() => {
                                                  setActiveReplyId(thread.id);
                                                  setReplyText("");
                                                }}
                                                className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 cursor-pointer"
                                              >
                                                <MessageSquare size={12} /> Reply…
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}

                              {/* Inline New Comment Composer for this line */}
                              {isComposingThisLine && (
                                <div className="border-y border-indigo-500/40 bg-[#090d1f] p-4 font-sans text-xs space-y-3">
                                  <div className="flex items-center justify-between text-slate-400 border-b border-white/10 pb-2">
                                    <span className="font-semibold text-white">
                                      Add comment on {filePath} (line {activeLineNum}, {line.side})
                                    </span>
                                    <button
                                      onClick={handleCancelCompose}
                                      className="text-slate-400 hover:text-white"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>

                                  <textarea
                                    rows={3}
                                    autoFocus
                                    value={composerText}
                                    onChange={(e) => setComposerText(e.target.value)}
                                    placeholder="Leave a comment on this line…"
                                    className="w-full rounded-xl border border-white/10 bg-zinc-950 p-3 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
                                  />

                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={handleCancelCompose}
                                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => handleSubmitNewComment(filePath, line.side, activeLineNum)}
                                      disabled={submittingComment || !composerText.trim()}
                                      className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                                    >
                                      {submittingComment ? "Adding comment…" : "Add single comment"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

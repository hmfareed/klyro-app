"use client";

import { useState } from "react";
import {
  GitPullRequest,
  GitMerge,
  XCircle,
  MessageSquare,
  Plus,
  Search,
  ArrowRight,
  GitBranch,
} from "lucide-react";

interface PullRequest {
  id: string;
  number: number;
  title: string;
  author: string;
  repo: string;
  sourceBranch: string;
  targetBranch: string;
  status: "OPEN" | "MERGED" | "CLOSED";
  reviewStatus: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED";
  commentsCount: number;
  updatedAt: string;
}

const INITIAL_PRS: PullRequest[] = [
  {
    id: "pr-14",
    number: 14,
    title: "feat: add attendance module with QR validation",
    author: "Fareed",
    repo: "school-management-system",
    sourceBranch: "feat/attendance-qr",
    targetBranch: "main",
    status: "OPEN",
    reviewStatus: "REVIEW_REQUIRED",
    commentsCount: 3,
    updatedAt: "2 hours ago",
  },
  {
    id: "pr-12",
    number: 12,
    title: "feat: improve mobile responsiveness across dashboard components",
    author: "Abdul",
    repo: "school-management-system",
    sourceBranch: "fix/mobile-responsive",
    targetBranch: "main",
    status: "OPEN",
    reviewStatus: "CHANGES_REQUESTED",
    commentsCount: 5,
    updatedAt: "5 hours ago",
  },
  {
    id: "pr-11",
    number: 11,
    title: "fix: authentication session sliding expiration and token revoke",
    author: "Fareed",
    repo: "school-management-system",
    sourceBranch: "fix/auth-flow",
    targetBranch: "main",
    status: "OPEN",
    reviewStatus: "APPROVED",
    commentsCount: 4,
    updatedAt: "1 day ago",
  },
  {
    id: "pr-9",
    number: 9,
    title: "feat: vendor onboarding and product catalog upload flow",
    author: "Maryam",
    repo: "africart-marketplace",
    sourceBranch: "feat/vendor-catalog",
    targetBranch: "main",
    status: "OPEN",
    reviewStatus: "REVIEW_REQUIRED",
    commentsCount: 1,
    updatedAt: "2 days ago",
  },
  {
    id: "pr-8",
    number: 8,
    title: "chore: upgrade Next.js to 16 with Turbopack bundler",
    author: "Kofi",
    repo: "klyro-website",
    sourceBranch: "chore/next-upgrade",
    targetBranch: "main",
    status: "MERGED",
    reviewStatus: "APPROVED",
    commentsCount: 6,
    updatedAt: "3 days ago",
  },
];

export default function PullRequestsPage() {
  const [prs, setPrs] = useState<PullRequest[]>(INITIAL_PRS);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "MERGED" | "CLOSED">("OPEN");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBranch, setNewBranch] = useState("");

  const filteredPrs = prs.filter((pr) => {
    if (filter !== "ALL" && pr.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        pr.title.toLowerCase().includes(q) ||
        pr.repo.toLowerCase().includes(q) ||
        pr.author.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newPr: PullRequest = {
      id: `pr-${Date.now()}`,
      number: prs.length + 10,
      title: newTitle.trim(),
      author: "Fareed",
      repo: "school-management-system",
      sourceBranch: newBranch.trim() || "feat/new-branch",
      targetBranch: "main",
      status: "OPEN",
      reviewStatus: "REVIEW_REQUIRED",
      commentsCount: 0,
      updatedAt: "Just now",
    };
    setPrs([newPr, ...prs]);
    setNewTitle("");
    setNewBranch("");
    setModalOpen(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-black p-6 text-white min-w-0">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <GitPullRequest size={20} className="text-purple-400" />
            Pull Requests
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Review code changes, discuss revisions, and merge branches into production.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
        >
          <Plus size={14} /> New Pull Request
        </button>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-[#09090b] border border-white/10 p-1 w-full sm:w-auto">
          {(["OPEN", "MERGED", "CLOSED", "ALL"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === tab
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab === "OPEN" && "Open (4)"}
              {tab === "MERGED" && "Merged"}
              {tab === "CLOSED" && "Closed"}
              {tab === "ALL" && "All"}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter pull requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#09090b] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Pull Requests List */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#09090b] shadow-sm divide-y divide-white/5">
        {filteredPrs.length === 0 ? (
          <div className="p-8 text-center">
            <GitPullRequest size={32} className="mx-auto text-slate-500 mb-2" />
            <p className="text-sm font-semibold text-white">No pull requests match this filter</p>
            <p className="text-xs text-slate-400 mt-1">Try selecting another filter or create a new pull request.</p>
          </div>
        ) : (
          filteredPrs.map((pr) => (
            <div
              key={pr.id}
              className="p-4 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {pr.status === "OPEN" && (
                    <GitPullRequest size={16} className="text-emerald-400" />
                  )}
                  {pr.status === "MERGED" && (
                    <GitMerge size={16} className="text-purple-400" />
                  )}
                  {pr.status === "CLOSED" && (
                    <XCircle size={16} className="text-red-400" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-white hover:text-indigo-400 cursor-pointer transition-colors">
                      {pr.title}
                    </span>
                    <span className="text-xs font-mono text-slate-500">#{pr.number}</span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] font-mono text-indigo-300 border border-white/10">
                      {pr.repo}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                      <GitBranch size={11} /> {pr.sourceBranch} <ArrowRight size={10} /> {pr.targetBranch}
                    </span>
                    <span>•</span>
                    <span>opened by <strong className="text-slate-300">{pr.author}</strong></span>
                    <span>•</span>
                    <span>{pr.updatedAt}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                {pr.reviewStatus === "APPROVED" && (
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                    Approved
                  </span>
                )}
                {pr.reviewStatus === "CHANGES_REQUESTED" && (
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
                    Changes requested
                  </span>
                )}
                {pr.reviewStatus === "REVIEW_REQUIRED" && (
                  <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-indigo-400">
                    Review required
                  </span>
                )}

                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <MessageSquare size={13} />
                  <span>{pr.commentsCount}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New PR Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1430] p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <GitPullRequest size={18} className="text-purple-400" />
              New Pull Request
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Propose changes from your feature branch into the repository main branch.
            </p>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. feat: add attendance verification"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#09090b] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Source Branch
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. feat/attendance-system"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#09090b] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Create Pull Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

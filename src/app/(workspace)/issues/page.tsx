"use client";

import { useState } from "react";
import {
  CirclePlus,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Plus,
  Search,
  User,
} from "lucide-react";

interface Issue {
  id: string;
  number: number;
  title: string;
  description: string;
  author: string;
  assignee: string | null;
  repo: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "CLOSED";
  labels: string[];
  commentsCount: number;
  createdAt: string;
}

const INITIAL_ISSUES: Issue[] = [
  {
    id: "issue-7",
    number: 7,
    title: "The GPS check-in is not working on mobile devices",
    description: "Mobile browsers throw geolocation timeout error on iOS Safari during check-in.",
    author: "Maryam",
    assignee: "Fareed",
    repo: "school-management-system",
    priority: "HIGH",
    status: "OPEN",
    labels: ["bug", "mobile", "ios"],
    commentsCount: 3,
    createdAt: "1 day ago",
  },
  {
    id: "issue-8",
    number: 8,
    title: "Dashboard charts fail to re-render when switching theme modes",
    description: "Recharts canvas requires key invalidation upon root class mutation.",
    author: "Abdul",
    assignee: "Abdul",
    repo: "africart-marketplace",
    priority: "MEDIUM",
    status: "OPEN",
    labels: ["ui", "charts"],
    commentsCount: 2,
    createdAt: "2 days ago",
  },
  {
    id: "issue-10",
    number: 10,
    title: "Add batch QR code export feature for student badges",
    description: "Teachers need a zip archive export of SVG/PNG generated badges.",
    author: "Fareed",
    assignee: null,
    repo: "school-management-system",
    priority: "LOW",
    status: "OPEN",
    labels: ["feature", "export"],
    commentsCount: 1,
    createdAt: "3 days ago",
  },
  {
    id: "issue-4",
    number: 4,
    title: "Session token leakage in error boundary stack traces",
    description: "Sanitize auth tokens from client error reporting payloads.",
    author: "Kofi",
    assignee: "Fareed",
    repo: "klyro-website",
    priority: "CRITICAL",
    status: "CLOSED",
    labels: ["security"],
    commentsCount: 4,
    createdAt: "1 week ago",
  },
];

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>(INITIAL_ISSUES);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "IN_PROGRESS" | "CLOSED">("OPEN");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");

  const filteredIssues = issues.filter((iss) => {
    if (filter !== "ALL" && iss.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        iss.title.toLowerCase().includes(q) ||
        iss.repo.toLowerCase().includes(q) ||
        iss.labels.some((l) => l.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newIssue: Issue = {
      id: `issue-${Date.now()}`,
      number: issues.length + 10,
      title: newTitle.trim(),
      description: newDesc.trim(),
      author: "Fareed",
      assignee: "Fareed",
      repo: "school-management-system",
      priority: newPriority,
      status: "OPEN",
      labels: ["enhancement"],
      commentsCount: 0,
      createdAt: "Just now",
    };
    setIssues([newIssue, ...issues]);
    setNewTitle("");
    setNewDesc("");
    setModalOpen(false);
  };

  const toggleStatus = (id: string) => {
    setIssues(
      issues.map((i) =>
        i.id === id
          ? { ...i, status: i.status === "CLOSED" ? "OPEN" : "CLOSED" }
          : i
      )
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f24] p-6 text-white min-w-0">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CirclePlus size={20} className="text-amber-400" />
            Issues Tracker
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Track bugs, feature requests, and tasks across your team workspaces.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
        >
          <Plus size={14} /> New Issue
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-[#0b1226] border border-white/10 p-1 w-full sm:w-auto">
          {(["OPEN", "IN_PROGRESS", "CLOSED", "ALL"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === tab
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab === "OPEN" && "Open (3)"}
              {tab === "IN_PROGRESS" && "In Progress"}
              {tab === "CLOSED" && "Closed"}
              {tab === "ALL" && "All"}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter issues or labels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#0b1226] py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Issues List */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1226] shadow-sm divide-y divide-white/5">
        {filteredIssues.length === 0 ? (
          <div className="p-8 text-center">
            <CirclePlus size={32} className="mx-auto text-slate-500 mb-2" />
            <p className="text-sm font-semibold text-white">No issues found</p>
            <p className="text-xs text-slate-400 mt-1">Change your filter or create a new issue.</p>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div
              key={issue.id}
              className="p-4 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleStatus(issue.id)}
                  title="Toggle status"
                  className="mt-0.5 text-slate-400 hover:text-white"
                >
                  {issue.status === "CLOSED" ? (
                    <CheckCircle2 size={16} className="text-purple-400" />
                  ) : (
                    <AlertCircle size={16} className="text-emerald-400" />
                  )}
                </button>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      onClick={() => toggleStatus(issue.id)}
                      className={`font-semibold text-sm transition-colors cursor-pointer ${
                        issue.status === "CLOSED"
                          ? "line-through text-slate-500"
                          : "text-white hover:text-indigo-400"
                      }`}
                    >
                      {issue.title}
                    </span>
                    <span className="text-xs font-mono text-slate-500">#{issue.number}</span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[11px] font-mono text-indigo-300 border border-white/10">
                      {issue.repo}
                    </span>
                    {issue.labels.map((lbl) => (
                      <span
                        key={lbl}
                        className="rounded-full bg-slate-800 border border-white/10 px-2 py-0.2 text-[10px] text-slate-300"
                      >
                        {lbl}
                      </span>
                    ))}
                    <span>•</span>
                    <span>opened by <strong className="text-slate-300">{issue.author}</strong></span>
                    <span>•</span>
                    <span>{issue.createdAt}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                {issue.priority === "CRITICAL" && (
                  <span className="rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
                    CRITICAL
                  </span>
                )}
                {issue.priority === "HIGH" && (
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
                    HIGH
                  </span>
                )}
                {issue.priority === "MEDIUM" && (
                  <span className="rounded-full bg-blue-500/10 border border-blue-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-blue-400">
                    MEDIUM
                  </span>
                )}
                {issue.priority === "LOW" && (
                  <span className="rounded-full bg-slate-500/10 border border-slate-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-slate-400">
                    LOW
                  </span>
                )}

                {issue.assignee && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <User size={12} />
                    <span>{issue.assignee}</span>
                  </div>
                )}

                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <MessageSquare size={13} />
                  <span>{issue.commentsCount}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Issue Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1430] p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CirclePlus size={18} className="text-amber-400" />
              New Issue
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Open a new issue to track bugs or planned work.
            </p>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bug: Navigation bar drops z-index on mobile"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#0b1226] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Steps to reproduce, environment, or acceptance criteria..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#0b1226] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")}
                  className="w-full rounded-lg border border-white/10 bg-[#0b1226] px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
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
                  Create Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

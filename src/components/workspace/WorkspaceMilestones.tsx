"use client";

import { useEffect, useState, useCallback } from "react";
import { Flag, Plus, Calendar } from "lucide-react";

interface Milestone {
  id: string;
  title: string;
  description: string | null;
  status: "PLANNED" | "IN_PROGRESS" | "DONE" | "MISSED";
  dueDate: string | null;
  totalTasks: number;
  doneTasks: number;
  progress: number;
}

export function WorkspaceMilestones({ slug, isMember }: { slug: string; isMember: boolean }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  const fetchMilestones = useCallback(() => {
    fetch(`/api/v1/projects/${slug}/milestones`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setMilestones(res.data.milestones || []);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const res = await fetch(`/api/v1/projects/${slug}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      }),
    });
    if (res.ok) {
      setTitle("");
      setDescription("");
      setDueDate("");
      setCreating(false);
      fetchMilestones();
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading milestones...</div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-white">Project Milestones</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Key deliverables gating verified contribution certification.
          </p>
        </div>

        {isMember && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm"
          >
            <Plus size={14} /> New Milestone
          </button>
        )}
      </div>

      <div className="p-6 space-y-4 max-w-4xl overflow-y-auto min-h-0">
        {milestones.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
            <Flag size={32} className="mx-auto text-slate-600 mb-2" />
            <h3 className="text-sm font-semibold text-white">No milestones defined</h3>
            <p className="mt-1 text-xs text-slate-400">
              Break down the roadmap into shipable milestones to track team progress.
            </p>
          </div>
        ) : (
          milestones.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-950/60 border border-indigo-700/50 text-indigo-400">
                    <Flag size={14} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{m.title}</h3>
                    {m.description && (
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-2xl">
                        {m.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {m.dueDate && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Calendar size={12} />
                      Due {new Date(m.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  )}
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      m.status === "DONE"
                        ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/40"
                        : "bg-blue-950/60 text-blue-300 border border-blue-800/40"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                  <span>Progress ({m.doneTasks}/{m.totalTasks} tasks done)</span>
                  <span className="font-semibold text-white">{m.progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${m.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0f172a] p-6 text-white shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Add Project Milestone</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Milestone Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Phase 1 MVP Release"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Key capabilities or outcomes expected in this milestone..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Target Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
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
                  Save Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

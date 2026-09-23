"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, User } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  milestone: { id: string; title: string } | null;
  assignees: Array<{ user: { id: string; username: string; displayName: string | null } }>;
}

const COLUMNS = [
  { id: "TODO", label: "Todo", border: "border-slate-700" },
  { id: "IN_PROGRESS", label: "In Progress", border: "border-blue-500/40" },
  { id: "IN_REVIEW", label: "In Review", border: "border-amber-500/40" },
  { id: "DONE", label: "Done", border: "border-emerald-500/40" },
];

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-slate-800 text-slate-400 border-slate-700",
  MEDIUM: "bg-blue-950/60 text-blue-300 border-blue-800/40",
  HIGH: "bg-amber-950/60 text-amber-300 border-amber-800/40",
  URGENT: "bg-red-950/60 text-red-300 border-red-800/40",
};

export function WorkspaceTasks({ slug, isMember }: { slug: string; isMember: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");

  const fetchTasks = useCallback(() => {
    fetch(`/api/v1/projects/${slug}/tasks`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setTasks(res.data.tasks || []);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const res = await fetch(`/api/v1/projects/${slug}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, priority, status: "TODO" }),
    });
    if (res.ok) {
      setTitle("");
      setDescription("");
      setCreating(false);
      fetchTasks();
    }
  };

  const updateStatus = async (taskId: string, newStatus: Task["status"]) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    await fetch(`/api/v1/projects/${slug}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchTasks();
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading tasks board...</div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-white">Project Tasks & Kanban</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Organize work items, track delivery progress, and feed system-observed contribution records.
          </p>
        </div>

        {isMember && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
          >
            <Plus size={14} /> New Task
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 flex-1 overflow-x-auto min-h-0">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              className="flex flex-col rounded-xl border border-white/10 bg-white/[0.02] p-3 min-h-[320px]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3 px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {col.label}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                  {colTasks.length}
                </span>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto">
                {colTasks.length === 0 ? (
                  <div className="py-8 text-center text-[11px] text-slate-600 italic">
                    No tasks
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-lg border border-white/10 bg-[#0f172a] p-3 shadow-sm hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                            PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.MEDIUM
                          }`}
                        >
                          {task.priority}
                        </span>

                        {isMember && (
                          <select
                            value={task.status}
                            onChange={(e) =>
                              updateStatus(task.id, e.target.value as Task["status"])
                            }
                            className="bg-white/5 border border-white/10 text-[10px] text-slate-300 rounded px-1.5 py-0.5 focus:outline-none"
                          >
                            <option value="TODO">Todo</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="IN_REVIEW">In Review</option>
                            <option value="DONE">Done</option>
                          </select>
                        )}
                      </div>

                      <h4 className="text-xs font-semibold text-white leading-snug">
                        {task.title}
                      </h4>

                      {task.description && (
                        <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                          {task.description}
                        </p>
                      )}

                      {task.assignees.length > 0 && (
                        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400">
                          <User size={11} />
                          <span>
                            {task.assignees.map((a) => a.user.displayName || a.user.username).join(", ")}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0f172a] p-6 text-white shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Create New Task</h3>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Implement OAuth callback handler"
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
                  placeholder="Acceptance criteria or details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Task["priority"])}
                  className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
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
                  Add Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

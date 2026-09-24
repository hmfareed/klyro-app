"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Search, Download, X, User as UserIcon, Calendar, Flag } from "lucide-react";
import {
  ProjectTask, Milestone, Member, TaskStatus, Priority,
  unwrap, fetchJson, fmtDate, displayName, STATUS_LABEL, PRIORITY_STYLES, exportTasks,
} from "./lib";

type FilterTab = "all" | "mine" | "unassigned" | "completed" | "overdue";
type SortKey = "created" | "due" | "priority";

const TABS: Array<{ id: FilterTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "mine", label: "My Tasks" },
  { id: "unassigned", label: "Unassigned" },
  { id: "completed", label: "Completed" },
  { id: "overdue", label: "Overdue" },
];

const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function ProjectTasks({
  slug, isMember, members, milestones, meId, onChanged,
}: {
  slug: string;
  isMember: boolean;
  members: Member[];
  milestones: Milestone[];
  meId: string | null;
  onChanged?: () => void;
}) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("all");
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<string>("all");
  const [priorityF, setPriorityF] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("created");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<ProjectTask | null>(null);
  const [showExport, setShowExport] = useState(false);

  // Create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (statusF !== "all") params.set("status", statusF);
      if (priorityF !== "all") params.set("priority", priorityF);
      if (tab === "mine") params.set("assignee", "me");
      else if (tab === "unassigned") params.set("assignee", "unassigned");
      else if (tab === "completed") params.set("status", "DONE");
      else if (tab === "overdue") params.set("overdue", "1");
      const { json } = await fetchJson(`/api/v1/projects/${slug}/tasks?${params.toString()}`);
      setTasks(unwrap<ProjectTask[]>(json, "tasks", []));
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [slug, q, statusF, priorityF, tab]);

  useEffect(() => {
    const t = setTimeout(fetchTasks, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchTasks, q]);

  const sorted = useMemo(() => {
    const arr = [...tasks];
    if (sort === "due") arr.sort((a, b) => +new Date(a.dueDate ?? "9999") - +new Date(b.dueDate ?? "9999"));
    else if (sort === "priority") arr.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    return arr;
  }, [tasks, sort]);

  const overdueCount = useMemo(() => tasks.filter((t) => t.status !== "DONE" && t.dueDate && new Date(t.dueDate) < new Date()).length, [tasks]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { res, json } = await fetchJson(`/api/v1/projects/${slug}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority,
          milestoneId: milestoneId || null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          assigneeUserIds: assigneeId ? [assigneeId] : [],
        }),
      });
      if (!res.ok) throw new Error((json as { error?: { message?: string } })?.error?.message ?? "Failed to create task.");
      setTitle(""); setDescription(""); setStatus("TODO"); setPriority("MEDIUM");
      setAssigneeId(""); setMilestoneId(""); setDueDate("");
      setCreating(false);
      fetchTasks();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(id: string, patch: Partial<{ status: TaskStatus; priority: Priority }>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    await fetchJson(`/api/v1/projects/${slug}/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    fetchTasks();
    onChanged?.();
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div className="border-b border-white/10 px-6 py-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white">Tasks</h2>
            <p className="text-xs text-slate-400 mt-0.5">{tasks.length} shown{overdueCount > 0 && <span className="text-red-300"> · {overdueCount} overdue</span>}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowExport(!showExport)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                <Download size={13} /> Export
              </button>
              {showExport && (
                <div className="absolute right-0 mt-1 w-36 rounded-lg border border-white/10 bg-[#0f172a] p-1 shadow-xl z-20">
                  {(["csv", "json", "md"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => { exportTasks(sorted, f, `${slug}-tasks`); setShowExport(false); }}
                      className="block w-full rounded px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-white/10"
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isMember && (
              <button
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                <Plus size={14} /> New task
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 border-b border-white/10">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-2.5 py-1.5 text-[11px] font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1">
              <Search size={12} className="text-slate-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-28 bg-transparent text-[11px] text-white placeholder:text-slate-500 focus:outline-none" />
            </div>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="rounded-lg border border-white/10 bg-[#1e293b] px-2 py-1 text-[11px] text-slate-300 focus:outline-none">
              <option value="all">All statuses</option>
              <option value="TODO">Todo</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="DONE">Done</option>
              <option value="BLOCKED">Blocked</option>
            </select>
            <select value={priorityF} onChange={(e) => setPriorityF(e.target.value)} className="rounded-lg border border-white/10 bg-[#1e293b] px-2 py-1 text-[11px] text-slate-300 focus:outline-none">
              <option value="all">All priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-white/10 bg-[#1e293b] px-2 py-1 text-[11px] text-slate-300 focus:outline-none">
              <option value="created">Sort: Newest</option>
              <option value="due">Sort: Due date</option>
              <option value="priority">Sort: Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading tasks...</div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-white">No tasks found</p>
            <p className="mt-1 text-xs text-slate-400">Adjust filters or create the first task.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            <div className="hidden md:grid grid-cols-[1fr_160px_130px_110px] gap-3 px-6 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>Task</span><span>Assignee</span><span>Status</span><span className="text-right">Due</span>
            </div>
            {sorted.map((t) => {
              const overdue = t.status !== "DONE" && t.dueDate && new Date(t.dueDate) < new Date();
              return (
                <button
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="grid w-full grid-cols-1 md:grid-cols-[1fr_160px_130px_110px] gap-1 md:gap-3 px-6 py-3 text-left hover:bg-white/[0.03] transition-colors items-center"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                      <span className="text-xs font-semibold text-white truncate">{t.title}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      {t.milestone ? `${t.milestone.title} · ` : ""}{t.description ?? ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <UserIcon size={12} className="text-slate-500" />
                    {t.assignees.length > 0 ? t.assignees.map((a) => (meId === a.user.id ? "You" : displayName(a.user))).join(", ") : <span className="text-slate-600 italic">Unassigned</span>}
                  </span>
                  <span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${t.status === "DONE" ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/40" : t.status === "BLOCKED" ? "bg-red-950/60 text-red-300 border border-red-800/40" : "bg-blue-950/60 text-blue-300 border border-blue-800/40"}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </span>
                  <span className={`text-[11px] md:text-right ${overdue ? "text-red-300 font-semibold" : "text-slate-400"}`}>
                    {t.dueDate ? fmtDate(t.dueDate) : <span className="text-slate-600">—</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Create panel */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#0f172a] p-6 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">Create task</h3>
              <button onClick={() => setCreating(false)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>
            {error && <div className="mb-3 rounded-lg bg-red-950/50 border border-red-800/40 p-2.5 text-xs text-red-200">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Title *</label>
                <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Build authentication flow" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what needs to be implemented..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:outline-none">
                    {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:outline-none">
                    <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Assignee</label>
                  <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:outline-none">
                    <option value="">Unassigned</option>
                    {members.map((m) => <option key={m.user.id} value={m.user.id}>{displayName(m.user)} — {m.role.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Due date</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Milestone</label>
                <select value={milestoneId} onChange={(e) => setMilestoneId(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:outline-none">
                  <option value="">None</option>
                  {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-white/10 px-3.5 py-1.5 text-xs text-slate-300 hover:bg-white/5">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{saving ? "Creating..." : "Create task"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md h-full overflow-y-auto border-l border-white/10 bg-[#0b1120] p-6 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-mono text-slate-500">{selected.id.slice(0, 8).toUpperCase()}</p>
                <h3 className="text-base font-bold leading-snug">{selected.title}</h3>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_STYLES[selected.priority]}`}>{selected.priority}</span>
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">{STATUS_LABEL[selected.status]}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-white"><X size={16} /></button>
            </div>

            {selected.description && (
              <div className="mt-4">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Description</h4>
                <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{selected.description}</p>
              </div>
            )}

            <dl className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between"><dt className="text-slate-500">Assignee</dt><dd className="text-slate-200 font-medium">{selected.assignees.length > 0 ? selected.assignees.map((a) => displayName(a.user)).join(", ") : "Unassigned"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Due</dt><dd className="text-slate-200 inline-flex items-center gap-1"><Calendar size={12} />{fmtDate(selected.dueDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Milestone</dt><dd className="text-slate-200 inline-flex items-center gap-1"><Flag size={12} />{selected.milestone?.title ?? "None"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Created</dt><dd className="text-slate-400">{fmtDate(selected.createdAt)}</dd></div>
            </dl>

            {isMember && (
              <div className="mt-5 grid grid-cols-2 gap-2 border-t border-white/10 pt-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
                  <select
                    value={selected.status}
                    onChange={async (e) => {
                      const s = e.target.value as TaskStatus;
                      setSelected({ ...selected, status: s });
                      await updateTask(selected.id, { status: s });
                    }}
                    className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-2 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Priority</label>
                  <select
                    value={selected.priority}
                    onChange={async (e) => {
                      const p = e.target.value as Priority;
                      setSelected({ ...selected, priority: p });
                      await updateTask(selected.id, { priority: p });
                    }}
                    className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-2 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

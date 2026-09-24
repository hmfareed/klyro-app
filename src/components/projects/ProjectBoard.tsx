"use client";

import { useState, useEffect, useCallback } from "react";
import { User as UserIcon } from "lucide-react";
import {
  ProjectTask, TaskStatus, unwrap, fetchJson, displayName, PRIORITY_STYLES, STATUS_LABEL,
} from "./lib";

const COLUMNS: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"];

export function ProjectBoard({ slug, isMember, onChanged }: { slug: string; isMember: boolean; onChanged?: () => void }) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);

  const fetchTasks = useCallback(() => {
    fetchJson(`/api/v1/projects/${slug}/tasks`)
      .then(({ json }) => {
        setTasks(unwrap<ProjectTask[]>(json, "tasks", []));
      })
      .catch(() => {
        setTasks([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  async function moveTask(id: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    await fetchJson(`/api/v1/projects/${slug}/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onChanged?.();
  }

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading board...</div>;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="border-b border-white/10 px-6 py-4">
        <h2 className="text-base font-bold text-white">Board</h2>
        <p className="text-xs text-slate-400 mt-0.5">{isMember ? "Drag cards between columns to update status." : "Task workflow visualization."}</p>
      </div>
      <div className="flex gap-4 p-6 flex-1 overflow-x-auto overflow-y-hidden min-h-0">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col);
          return (
            <div
              key={col}
              onDragOver={(e) => { if (isMember && dragId) e.preventDefault(); }}
              onDrop={() => { if (isMember && dragId) { moveTask(dragId, col); setDragId(null); } }}
              className="flex w-64 shrink-0 flex-col rounded-xl border border-white/10 bg-white/[0.02] p-3 min-h-[300px]"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3 px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{STATUS_LABEL[col]}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400">{colTasks.length}</span>
              </div>
              <div className="flex-1 space-y-2.5 overflow-y-auto min-h-0">
                {colTasks.length === 0 ? (
                  <div className="py-8 text-center text-[11px] text-slate-600 italic">Drop here</div>
                ) : (
                  colTasks.map((t) => (
                    <div
                      key={t.id}
                      draggable={isMember}
                      onDragStart={() => setDragId(t.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`rounded-lg border border-white/10 bg-[#0f172a] p-3 shadow-sm transition-colors ${isMember ? "cursor-grab active:cursor-grabbing hover:border-white/25" : ""} ${dragId === t.id ? "opacity-50" : ""}`}
                    >
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                      <h4 className="mt-1.5 text-xs font-semibold text-white leading-snug">{t.title}</h4>
                      {t.assignees.length > 0 && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                          <UserIcon size={11} />
                          <span className="truncate">{t.assignees.map((a) => displayName(a.user)).join(", ")}</span>
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
    </div>
  );
}

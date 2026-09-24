"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ProjectTask, unwrap, fetchJson, displayName } from "./lib";

const DAY = 864e5;

export function ProjectTimeline({ slug }: { slug: string }) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
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

  useEffect(() => { load(); }, [load]);

  const dated = useMemo(() => tasks.filter((t) => t.dueDate), [tasks]);
  const bounds = useMemo(() => {
    if (dated.length === 0) return null;
    const ds = dated.map((t) => +new Date(t.dueDate!));
    const min = Math.min(...ds) - 3 * DAY;
    const max = Math.max(...ds) + 3 * DAY;
    return { min, max, span: Math.max(1, max - min) };
  }, [dated]);

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading timeline...</div>;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="border-b border-white/10 px-6 py-4">
        <h2 className="text-base font-bold text-white">Timeline</h2>
        <p className="text-xs text-slate-400 mt-0.5">Scheduling view — tasks with due dates across time.</p>
      </div>
      <div className="flex-1 overflow-auto p-6 min-h-0">
        {!bounds ? (
          <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
            <p className="text-sm font-semibold text-white">No scheduled tasks</p>
            <p className="mt-1 text-xs text-slate-400">Give tasks due dates and they will appear here.</p>
          </div>
        ) : (
          <div className="min-w-[560px] space-y-2.5">
            {[...dated].sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!)).map((t) => {
              const due = +new Date(t.dueDate!);
              const start = Math.max(bounds.min, +new Date(t.createdAt));
              const left = ((start - bounds.min) / bounds.span) * 100;
              const width = Math.max(3, ((due - start) / bounds.span) * 100);
              const overdue = t.status !== "DONE" && due < new Date().getTime();
              return (
                <div key={t.id} className="flex items-center">
                  <div className="w-52 shrink-0 pr-3">
                    <p className="text-xs font-semibold text-white truncate">{t.title}</p>
                    <p className="text-[10px] text-slate-500 truncate">{t.assignees.map((a) => displayName(a.user)).join(", ") || "Unassigned"}</p>
                  </div>
                  <div className="relative h-6 flex-1 rounded bg-white/[0.03]">
                    <div
                      className={`absolute top-0.5 h-5 rounded ${t.status === "DONE" ? "bg-emerald-600/70" : overdue ? "bg-red-600/70" : "bg-indigo-600/70"}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    />
                    <span className="absolute top-1 text-[9px] font-semibold text-white/90" style={{ left: `calc(${left}% + 6px)` }}>
                      {new Date(t.dueDate!).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

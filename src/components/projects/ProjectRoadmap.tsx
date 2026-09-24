"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ProjectTask, Milestone, unwrap, fetchJson, fmtDate } from "./lib";

type Mode = "timeline" | "milestones";

export function ProjectRoadmap({ slug }: { slug: string }) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [mode, setMode] = useState<Mode>("timeline");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      fetchJson(`/api/v1/projects/${slug}/tasks`),
      fetchJson(`/api/v1/projects/${slug}/milestones`),
    ])
      .then(([t, m]) => {
        setTasks(unwrap<ProjectTask[]>(t.json, "tasks", []));
        setMilestones(unwrap<Milestone[]>(m.json, "milestones", []));
      })
      .catch(() => { /* keep empty */ })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  // Timeline bounds from milestones + task due dates
  const { min, max, span, months } = useMemo(() => {
    const now = new Date().getTime();
    const dates = [
      ...milestones.flatMap((m) => (m.dueDate ? [+new Date(m.dueDate)] : [])),
      ...tasks.flatMap((t) => (t.dueDate ? [+new Date(t.dueDate)] : [])),
    ];
    const lo = dates.length ? Math.min(...dates) - 7 * 864e5 : now - 30 * 864e5;
    const hi = dates.length ? Math.max(...dates) + 7 * 864e5 : now + 60 * 864e5;
    const months: string[] = [];
    const d = new Date(lo);
    d.setDate(1);
    while (+d <= hi && months.length < 8) {
      months.push(d.toLocaleDateString([], { month: "short" }));
      d.setMonth(d.getMonth() + 1);
    }
    return { min: lo, max: hi, span: Math.max(1, hi - lo), months };
  }, [milestones, tasks]);
  const pct = (ts: number) => Math.max(0, Math.min(100, ((ts - min) / span) * 100));

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading roadmap...</div>;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-white">Roadmap</h2>
          <p className="text-xs text-slate-400 mt-0.5">Direction, milestones and how work sequences over time.</p>
        </div>
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          {(["timeline", "milestones"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-xs font-semibold capitalize ${mode === m ? "bg-indigo-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}
            >
              {m === "timeline" ? "Timeline" : "Milestones"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {mode === "milestones" ? (
          milestones.length === 0 ? (
            <Empty text="No milestones yet — they form the backbone of the roadmap." />
          ) : (
            <div className="max-w-3xl space-y-0">
              {milestones.map((m, i) => (
                <div key={m.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${m.status === "DONE" ? "bg-emerald-600 text-white" : "bg-white/10 text-slate-300"}`}>
                      {m.status === "DONE" ? "✓" : i + 1}
                    </span>
                    {i < milestones.length - 1 && <span className="w-px flex-1 bg-white/10 my-1" />}
                  </div>
                  <div className="pb-6 flex-1 rounded-xl border border-white/10 bg-white/[0.02] p-4 mb-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white">{m.title}</h3>
                      <span className="text-[11px] text-slate-400">{m.dueDate ? fmtDate(m.dueDate) : "No date"} · {m.progress}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${m.progress}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">{m.doneTasks}/{m.totalTasks} tasks · {m.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : milestones.length === 0 ? (
          <Empty text="Add milestones to render the timeline roadmap." />
        ) : (
          <div className="min-w-[560px]">
            <div className="flex border-b border-white/10 pb-2 mb-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span className="w-44 shrink-0">Milestone</span>
              <div className="relative flex-1">
                {months.map((mo, i) => (
                  <span key={i} className="absolute text-slate-500" style={{ left: `${(i / Math.max(1, months.length - 1)) * 100}%` }}>{mo}</span>
                ))}
                <span className="opacity-0">.</span>
              </div>
            </div>
            <div className="space-y-3">
              {milestones.map((m) => {
                const end = m.dueDate ? +new Date(m.dueDate) : max;
                const start = Math.max(min, end - 21 * 864e5);
                return (
                  <div key={m.id} className="flex items-center">
                    <div className="w-44 shrink-0 pr-3">
                      <p className="text-xs font-semibold text-white truncate">{m.title}</p>
                      <p className="text-[10px] text-slate-500">{m.progress}% · {m.doneTasks}/{m.totalTasks}</p>
                    </div>
                    <div className="relative h-7 flex-1 rounded bg-white/[0.03]">
                      <div
                        className={`absolute top-1 h-5 rounded-md ${m.status === "DONE" ? "bg-emerald-600/70" : "bg-indigo-600/70"}`}
                        style={{ left: `${pct(start)}%`, width: `${Math.max(4, pct(end) - pct(start))}%` }}
                        title={`${m.title} — due ${m.dueDate ? fmtDate(m.dueDate) : "unscheduled"}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 text-[11px] text-slate-600">Blocked work: {tasks.filter((t) => t.status === "BLOCKED").length} task(s) currently blocked.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
      <p className="text-sm font-semibold text-white">Nothing here yet</p>
      <p className="mt-1 text-xs text-slate-400">{text}</p>
    </div>
  );
}

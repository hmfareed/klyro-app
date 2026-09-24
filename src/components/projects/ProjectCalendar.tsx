"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProjectTask, Milestone, unwrap, fetchJson } from "./lib";

interface DayItem { kind: "task" | "milestone"; id: string; title: string; done?: boolean }

export function ProjectCalendar({ slug }: { slug: string }) {
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
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

  const byDay = useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const push = (iso: string | null, item: DayItem) => {
      if (!iso) return;
      const d = new Date(iso);
      if (d.getFullYear() !== cursor.y || d.getMonth() !== cursor.m) return;
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(k, [...(map.get(k) ?? []), item]);
    };
    tasks.forEach((t) => push(t.dueDate, { kind: "task", id: t.id, title: t.title, done: t.status === "DONE" }));
    milestones.forEach((m) => push(m.dueDate, { kind: "milestone", id: m.id, title: m.title, done: m.status === "DONE" }));
    return map;
  }, [tasks, milestones, cursor]);

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startPad = first.getDay(); // 0=Sun
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    return { startPad, days };
  }, [cursor]);

  const monthName = new Date(cursor.y, cursor.m, 1).toLocaleDateString([], { month: "long", year: "numeric" });
  const today = new Date();

  if (loading) return <div className="p-8 text-center text-xs text-slate-400">Loading calendar...</div>;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-white">Calendar</h2>
          <p className="text-xs text-slate-400 mt-0.5">Task due dates and milestones.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))} className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:bg-white/10"><ChevronLeft size={14} /></button>
          <span className="text-xs font-bold text-white w-36 text-center">{monthName}</span>
          <button onClick={() => setCursor(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))} className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:bg-white/10"><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-white/10 bg-white/10">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="bg-black px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{d}</div>
          ))}
          {Array.from({ length: cells.startPad }).map((_, i) => <div key={`p${i}`} className="bg-[#09090b] min-h-[84px]" />)}
          {Array.from({ length: cells.days }).map((_, i) => {
            const day = i + 1;
            const items = byDay.get(`${cursor.y}-${cursor.m}-${day}`) ?? [];
            const isToday = today.getFullYear() === cursor.y && today.getMonth() === cursor.m && today.getDate() === day;
            return (
              <div key={day} className={`bg-[#09090b] min-h-[84px] p-1.5 ${isToday ? "ring-1 ring-inset ring-indigo-500" : ""}`}>
                <span className={`text-[11px] font-bold ${isToday ? "text-indigo-300" : "text-slate-400"}`}>{day}</span>
                <div className="mt-1 space-y-1">
                  {items.slice(0, 3).map((it) => (
                    <div
                      key={`${it.kind}-${it.id}`}
                      title={it.title}
                      className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${it.kind === "milestone" ? "bg-amber-950/60 text-amber-200 border border-amber-800/40" : it.done ? "bg-emerald-950/50 text-emerald-300" : "bg-indigo-950/60 text-indigo-200"}`}
                    >
                      {it.kind === "milestone" ? "◆ " : ""}{it.title}
                    </div>
                  ))}
                  {items.length > 3 && <div className="text-[10px] text-slate-500">+{items.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

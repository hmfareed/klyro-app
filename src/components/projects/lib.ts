// Shared types + helpers for the Klyro Projects workspace.
// API envelopes are inconsistent across the codebase (bare vs {success,data}),
// so every fetch goes through `unwrap` which handles both shapes.

export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface TaskUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  milestone: { id: string; title: string } | null;
  assignees: Array<{ user: TaskUser }>;
}

export interface Milestone {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  totalTasks: number;
  doneTasks: number;
  progress: number;
}

export interface Member {
  userId: string;
  user: TaskUser;
  role: { id: string; title: string; permissionLevel: string };
}

export function unwrap<T>(json: unknown, key: string, fallback: T): T {
  if (!json || typeof json !== "object") return fallback;
  const j = json as Record<string, unknown>;
  const data = j.data as Record<string, unknown> | undefined;
  if (data && key in data) return data[key] as T;
  if (key in j) return j[key] as T;
  return fallback;
}

export async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => null);
  return { res, json };
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "upcoming";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "No date";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function initialsOf(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "•";
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "Todo",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  DONE: "Done",
  BLOCKED: "Blocked",
};

export const PRIORITY_STYLES: Record<string, string> = {
  LOW: "bg-slate-800 text-slate-400 border-slate-700",
  MEDIUM: "bg-blue-950/60 text-blue-300 border-blue-800/40",
  HIGH: "bg-amber-950/60 text-amber-300 border-amber-800/40",
  URGENT: "bg-red-950/60 text-red-300 border-red-800/40",
};

export function displayName(u: { displayName?: string | null; username: string }): string {
  return u.displayName || u.username;
}

// --- Task export (spec §34) -------------------------------------------------
function taskRows(tasks: ProjectTask[]) {
  return tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? "",
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ?? "",
    milestone: t.milestone?.title ?? "",
    assignees: t.assignees.map((a) => displayName(a.user)).join("; "),
  }));
}

export function exportTasks(tasks: ProjectTask[], format: "csv" | "json" | "md", base = "tasks") {
  const rows = taskRows(tasks);
  let content = "";
  let mime = "text/plain";
  let ext = "txt";
  if (format === "json") {
    content = JSON.stringify(rows, null, 2);
    mime = "application/json";
    ext = "json";
  } else if (format === "md") {
    content =
      "| Title | Status | Priority | Assignee | Due | Milestone |\n|---|---|---|---|---|---|\n" +
      rows.map((r) => `| ${r.title} | ${r.status} | ${r.priority} | ${r.assignees} | ${r.dueDate} | ${r.milestone} |`).join("\n");
    mime = "text/markdown";
    ext = "md";
  } else {
    const head = "id,title,description,status,priority,dueDate,milestone,assignees";
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    content =
      head +
      "\n" +
      rows.map((r) => [r.id, r.title, r.description, r.status, r.priority, r.dueDate, r.milestone, r.assignees].map(esc).join(",")).join("\n");
    mime = "text/csv";
    ext = "csv";
  }
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${base}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

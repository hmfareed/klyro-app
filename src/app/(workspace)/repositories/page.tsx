"use client";
import { useEffect, useState } from "react";
import { FolderGit2, Plus, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Project = {
  slug: string;
  title: string;
  tagline: string;
  status: string;
  updatedAt: string;
  _count: { members: number; tasks?: number };
};

export default function RepositoriesIndex() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch("/api/v1/projects")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!ignore) {
          setProjects(d?.data?.projects ?? d?.projects ?? []);
        }
      })
      .catch(() => {
        if (!ignore) setProjects([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) { setMsg("Give your project a name (2+ characters)."); return; }
    setCreating(true);
    setMsg("Creating…");
    try {
      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d.success) {
        setMsg(d?.error?.message ?? "Create failed.");
        setCreating(false);
        return;
      }
      router.push(`/repositories/${d.data.project.slug}`);
    } catch {
      setMsg("Create failed — please try again.");
      setCreating(false);
    }
  }

  if (projects === null) {
    return (
      <div className="flex flex-1 items-center justify-center" aria-busy="true">
        <p className="text-sm text-slate-400">Loading your workspace…</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <section aria-labelledby="empty-ws" className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl">
          <FolderGit2 size={36} className="mx-auto text-indigo-400 mb-3" />
          <h1 id="empty-ws" className="text-xl font-bold text-white">Your workspace is empty</h1>
          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            No repositories yet. Create your first project or explore existing open projects recruiting collaborators.
          </p>
          <form onSubmit={create} className="mt-6 space-y-3">
            <input
              id="first-project"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. campus food finder"
              maxLength={80}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              disabled={creating}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
            >
              {creating ? "Creating…" : "Quick Create Project"}
            </button>
          </form>
          {msg && <p className="mt-3 text-xs text-slate-300" aria-live="polite">{msg}</p>}

          <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-xs">
            <Link href="/projects" className="text-indigo-400 hover:text-indigo-300 font-medium">
              Explore Projects Directory →
            </Link>
            <Link href="/projects/new" className="text-slate-400 hover:text-white">
              Advanced Setup
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Workspace Repositories</h1>
          <p className="text-xs text-slate-400 mt-0.5">Projects and codebases you own or collaborate on.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/projects"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            Explore Directory
          </Link>
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            <Plus size={14} /> New Project
          </Link>
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/repositories/${p.slug}`}
              className="block rounded-xl border border-white/10 bg-white/[0.03] p-5 hover:border-indigo-500/50 hover:bg-white/[0.05] transition-all shadow-sm group"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                  {p.title}
                </span>
                <span className="text-[10px] font-bold rounded px-1.5 py-0.5 bg-white/10 text-slate-300">
                  {p.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{p.tagline}</p>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                <span>{p._count.members + 1} team member{p._count.members === 0 ? "" : "s"}</span>
                <span className="text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-0.5">
                  Open <ArrowRight size={11} />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

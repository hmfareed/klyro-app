"use client";
import { useEffect, useState } from "react";
import { FolderGit2 } from "lucide-react";

type Project = { slug: string; title: string; tagline: string; status: string; updatedAt: string; _count: { members: number } };

// Functional workspace home: real project list, or a genuine empty state
// with a working create-first-project form. No mock redirects.
export default function RepositoriesIndex() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/v1/projects");
      if (!res.ok) { setProjects([]); return; }
      const d = await res.json();
      setProjects(d.projects ?? []);
    } catch { setProjects([]); }
  }

  useEffect(() => { load(); }, []);

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
      if (!res.ok) { setMsg(d?.error?.message ?? "Create failed."); setCreating(false); return; }
      window.location.href = `/repositories/${d.project.slug}`;
    } catch {
      setMsg("Create failed — is the dev server running?");
      setCreating(false);
    }
  }

  if (projects === null) {
    return <div className="flex flex-1 items-center justify-center" aria-busy="true"><p className="text-sm text-slate-400">Loading your workspace…</p></div>;
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <section aria-labelledby="empty-ws" className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <FolderGit2 size={36} className="mx-auto text-indigo-400" />
          <h1 id="empty-ws" className="mt-4 text-xl font-bold text-white">Your workspace is empty</h1>
          <p className="mt-2 text-sm text-slate-400">No repositories yet. Create your first project — define the idea, invite collaborators, and start building together.</p>
          <form onSubmit={create} className="mt-6 space-y-3">
            <label htmlFor="first-project" className="sr-only">Project name</label>
            <input id="first-project" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. campus food finder" maxLength={80}
              className="w-full rounded-lg border border-white/10 bg-[#0b1226] px-4 py-3 text-white placeholder:text-slate-500" />
            <button disabled={creating} className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-40">
              {creating ? "Creating…" : "Create your first project"}
            </button>
          </form>
          {msg && <p className="mt-3 text-sm text-slate-300" aria-live="polite">{msg}</p>}
        </section>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Repositories</h1>
        <a href="#new" onClick={(e) => { e.preventDefault(); setProjects([]); }} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">New project</a>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {projects.map((p) => (
          <li key={p.slug}>
            <a href={`/repositories/${p.slug}`} className="block rounded-xl border border-white/10 bg-white/5 p-4 hover:border-indigo-400/50">
              <p className="font-semibold text-white">{p.title}</p>
              <p className="mt-1 truncate text-sm text-slate-400">{p.tagline}</p>
              <p className="mt-2 text-xs text-slate-500">{p._count.members} member{p._count.members === 1 ? "" : "s"} · {p.status.toLowerCase()}</p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

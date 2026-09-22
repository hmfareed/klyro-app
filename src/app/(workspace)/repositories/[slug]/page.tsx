"use client";
import { use, useEffect, useState } from "react";
import { FolderGit2 } from "lucide-react";

type Project = {
  slug: string; title: string; tagline: string; description: string;
  status: string; visibility: string; createdAt: string;
  owner: { username: string; displayName: string | null };
  members: { userId: string; user: { username: string; displayName: string | null } }[];
};

// Real repository view: loads the user's own project by slug.
// Unknown/inaccessible slugs get a clean empty state — never mock data.
export default function RepoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    fetch(`/api/v1/projects/${slug}`).then(async (r) => {
      if (!r.ok) { setState("missing"); return; }
      const d = await r.json();
      setProject(d.project);
      setState("ready");
    }).catch(() => setState("missing"));
  }, [slug]);

  if (state === "loading") {
    return <div className="flex flex-1 items-center justify-center" aria-busy="true"><p className="text-sm text-slate-400">Loading repository…</p></div>;
  }

  if (state === "missing" || !project) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <FolderGit2 size={36} className="mx-auto text-slate-500" />
          <h1 className="mt-4 text-xl font-bold text-white">Repository not found</h1>
          <p className="mt-2 text-sm text-slate-400">No repository named “{slug}” in your workspace. It may be private, removed, or never existed.</p>
          <a href="/repositories" className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-500">Back to your workspace</a>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6">
      <p className="text-xs text-slate-500">{project.visibility.toLowerCase()} · {project.status.toLowerCase()}</p>
      <h1 className="mt-1 text-2xl font-bold text-white">{project.title}</h1>
      <p className="mt-1 text-sm text-slate-400">{project.tagline}</p>
      <p className="mt-4 max-w-2xl whitespace-pre-wrap text-sm text-slate-300">{project.description}</p>
      <section aria-label="Team" className="mt-6">
        <h2 className="text-sm font-semibold text-white">Team ({project.members.length + 1})</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          <li><span className="font-medium text-white">{project.owner.displayName || project.owner.username}</span> <span className="text-slate-500">@{project.owner.username} · owner</span></li>
          {project.members.map((m) => (
            <li key={m.userId}><span className="font-medium text-white">{m.user.displayName || m.user.username}</span> <span className="text-slate-500">@{m.user.username}</span></li>
          ))}
        </ul>
      </section>
      <section aria-label="Getting started" className="mt-6 max-w-2xl rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-sm font-semibold text-white">Getting started</h2>
        <p className="mt-1 text-sm text-slate-400">Tasks, files, discussions, and GitHub linking land here in Phase 2–3. For now this is your project home — invite collaborators to join.</p>
      </section>
    </div>
  );
}

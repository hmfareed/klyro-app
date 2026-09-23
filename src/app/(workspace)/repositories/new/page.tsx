"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderGit2,
  Lock,
  Globe,
  ArrowLeft,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface ProjectOption {
  id: string;
  title: string;
  slug: string;
}

export default function NewRepositoryPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [projectId, setProjectId] = useState<string>("");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [initReadme, setInitReadme] = useState(true);
  const [gitignore, setGitignore] = useState("Node");
  const [license, setLicense] = useState("MIT");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load projects to allow attaching repository to a project
    fetch("/api/v1/projects")
      .then((r) => r.json())
      .then((data) => {
        const list = data?.data?.projects || data?.projects || [];
        setProjects(list);
      })
      .catch(() => {});
  }, []);

  // Compute live slug preview
  const slugPreview = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Repository name is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          visibility,
          projectId: projectId || undefined,
          initializeReadme: initReadme,
          gitignoreTemplate: gitignore !== "None" ? gitignore : undefined,
          license: license !== "None" ? license : undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data.success) {
        setError(data?.error?.message || "Failed to create repository.");
        setLoading(false);
        return;
      }

      const repo = data.data.repository;
      const owner = repo.owner.username;
      const repoSlug = repo.slug;

      router.push(`/repositories/${owner}/${repoSlug}`);
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-black p-6 sm:p-10">
      <div className="mx-auto max-w-2xl">
        {/* Back Link */}
        <Link
          href="/repositories"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to repositories
        </Link>

        <div className="mb-6 border-b border-white/10 pb-5">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <FolderGit2 className="text-indigo-400" size={26} />
            Create a new repository
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            A repository contains all project files, Git commit history, branches, pull requests, and issues.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
            <AlertCircle size={16} className="shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Association */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Associated Project <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="" className="bg-zinc-900 text-slate-400">
                Independent codebase (no project)
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
                  {p.title} ({p.slug})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              Link this repository to an existing product project, or keep it standalone.
            </p>
          </div>

          {/* Repository Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Repository Name <span className="text-indigo-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. school-management-system"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
            {slugPreview && (
              <p className="mt-1.5 text-[11px] text-slate-400 font-mono">
                Repository URL will be: <span className="text-indigo-400">/[owner]/{slugPreview}</span>
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Description <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this codebase does..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Visibility Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Visibility</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVisibility("PUBLIC")}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                  visibility === "PUBLIC"
                    ? "border-indigo-500 bg-indigo-500/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/5"
                }`}
              >
                <Globe size={18} className={visibility === "PUBLIC" ? "text-indigo-400" : "text-slate-400"} />
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    Public
                    {visibility === "PUBLIC" && <Check size={12} className="text-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Anyone on Klyro can view this repository and its code.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setVisibility("PRIVATE")}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                  visibility === "PRIVATE"
                    ? "border-indigo-500 bg-indigo-500/10 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/5"
                }`}
              >
                <Lock size={18} className={visibility === "PRIVATE" ? "text-indigo-400" : "text-slate-400"} />
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    Private
                    {visibility === "PRIVATE" && <Check size={12} className="text-indigo-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Only you and collaborators you choose can view this repository.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Initialization Options */}
          <div className="border-t border-white/10 pt-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Initialize this repository with:
            </h3>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={initReadme}
                onChange={(e) => setInitReadme(e.target.checked)}
                className="mt-0.5 rounded border-white/20 bg-white/5 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-semibold text-white block">Add a README file</span>
                <span className="text-[11px] text-slate-400">
                  This is where you can write a long description for your project.
                </span>
              </div>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Add .gitignore</label>
                <select
                  value={gitignore}
                  onChange={(e) => setGitignore(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="None" className="bg-zinc-900 text-slate-400">None</option>
                  <option value="Node" className="bg-zinc-900 text-white">Node / TypeScript</option>
                  <option value="Python" className="bg-zinc-900 text-white">Python</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Choose a license</label>
                <select
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="None" className="bg-zinc-900 text-slate-400">None</option>
                  <option value="MIT" className="bg-zinc-900 text-white">MIT License</option>
                  <option value="Apache-2.0" className="bg-zinc-900 text-white">Apache License 2.0</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="border-t border-white/10 pt-6 flex items-center justify-between">
            <Link href="/repositories" className="text-xs text-slate-400 hover:text-white transition-colors">
              Cancel
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg hover:bg-indigo-500 disabled:opacity-40 transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Creating Git repository…</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Create repository</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Plus, Trash2, Shield, FolderGit2 } from "lucide-react";

interface NewRole {
  title: string;
  description: string;
  permissionLevel: "CONTRIBUTOR" | "MAINTAINER";
}

const IP_OPTIONS = [
  {
    id: "PORTFOLIO_ONLY",
    title: "Portfolio Only",
    desc: "Contributors showcase in portfolio/resume. Creator retains product IP.",
  },
  {
    id: "OPEN_SOURCE",
    title: "Open Source",
    desc: "Licensed under standard MIT/Apache 2.0 open source terms.",
  },
  {
    id: "SHARED_EQUITY",
    title: "Shared Equity",
    desc: "Revenue/equity pool shared upon incorporation.",
  },
  {
    id: "OWNER_RETAINED",
    title: "Proprietary",
    desc: "Standard proprietary enterprise ownership.",
  },
];

export function openCreateProjectModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("open-create-project-modal"));
  }
}

export function WorkspaceCreateProjectModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("engineering");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [ipModel, setIpModel] = useState("PORTFOLIO_ONLY");
  const [commitmentLevel, setCommitmentLevel] = useState("5-10 hrs/week");

  // Tech stack
  const [techInput, setTechInput] = useState("");
  const [techStack, setTechStack] = useState<string[]>(["TypeScript", "Next.js", "Tailwind CSS"]);

  // Open roles
  const [roles, setRoles] = useState<NewRole[]>([
    { title: "Frontend Developer", description: "Build interactive UI components.", permissionLevel: "CONTRIBUTOR" },
  ]);

  useEffect(() => {
    const handleOpen = () => {
      setError(null);
      setIsOpen(true);
    };
    window.addEventListener("open-create-project-modal", handleOpen);
    return () => window.removeEventListener("open-create-project-modal", handleOpen);
  }, []);

  const addTech = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ("key" in e && e.key !== "Enter") return;
    e.preventDefault();
    const val = techInput.trim();
    if (val && !techStack.includes(val)) {
      setTechStack([...techStack, val]);
      setTechInput("");
    }
  };

  const removeTech = (item: string) => {
    setTechStack(techStack.filter((t) => t !== item));
  };

  const addRole = () => {
    setRoles([...roles, { title: "", description: "", permissionLevel: "CONTRIBUTOR" }]);
  };

  const updateRole = (index: number, field: keyof NewRole, value: string) => {
    const updated = [...roles];
    updated[index] = { ...updated[index], [field]: value };
    setRoles(updated);
  };

  const removeRole = (index: number) => {
    setRoles(roles.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const filteredRoles = roles
        .filter((r) => r.title.trim().length > 0)
        .map((r) => ({
          title: r.title.trim(),
          description: r.description.trim() || undefined,
          permissionLevel: r.permissionLevel,
        }));

      const res = await fetch("/api/v1/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          tagline,
          description,
          category,
          visibility,
          ipModel,
          commitmentLevel,
          techStack,
          roles: filteredRoles,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to create project.");
      }

      setIsOpen(false);
      // Trigger projects refresh in sidebar
      window.dispatchEvent(new CustomEvent("refresh-workspace-projects"));
      router.push(`/repositories/${data.data.project.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f172a] text-white shadow-2xl my-8 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#111c38]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <FolderGit2 size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Create New Workspace Project</h2>
              <p className="text-[11px] text-slate-400">Initialize a codebase, configure IP model, and recruit collaborators</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-3 text-xs text-red-200">
              {error}
            </div>
          )}

          {/* Basics */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              1. Project Basics
            </h3>
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Project Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. school-management-system"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Tagline (Short Summary) *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Web application for managing students, teachers and attendance"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                maxLength={160}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="engineering">Engineering & Dev</option>
                  <option value="design">Design & Creative</option>
                  <option value="ai">AI & Machine Learning</option>
                  <option value="mobile">Mobile Apps</option>
                  <option value="open-source">Open Source</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Commitment
                </label>
                <select
                  value={commitmentLevel}
                  onChange={(e) => setCommitmentLevel(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="2-5 hrs/week">2-5 hrs/week</option>
                  <option value="5-10 hrs/week">5-10 hrs/week</option>
                  <option value="15+ hrs/week">15+ hrs/week</option>
                  <option value="Full-time">Full-time</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "PRIVATE")}
                  className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="PUBLIC">Public (Directory listing)</option>
                  <option value="PRIVATE">Private (Workspace only)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                placeholder="Overview of project architecture, roadmap, and collaboration guidelines..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Tech Stack */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Tech Stack
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add tech (e.g. Next.js, Prisma, Tailwind)..."
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={addTech}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addTech}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/20"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {techStack.map((tech) => (
                <span
                  key={tech}
                  className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-xs text-slate-200"
                >
                  {tech}
                  <button
                    type="button"
                    onClick={() => removeTech(tech)}
                    className="text-slate-400 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* IP Model */}
          <div className="space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Shield size={14} className="text-indigo-400" />
              <span>3. Upfront IP Model (21-Legal)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {IP_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex flex-col rounded-lg border p-3 cursor-pointer transition-colors ${
                    ipModel === opt.id
                      ? "border-indigo-500 bg-indigo-950/40 text-white ring-1 ring-indigo-500"
                      : "border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="modalIpModel"
                      value={opt.id}
                      checked={ipModel === opt.id}
                      onChange={(e) => setIpModel(e.target.value)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs font-bold">{opt.title}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 pl-5">{opt.desc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Open Roles */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  4. Roles to Recruit
                </h3>
                <p className="text-[11px] text-slate-500">Collaborators apply to these positions</p>
              </div>
              <button
                type="button"
                onClick={addRole}
                className="inline-flex items-center gap-1 rounded bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-white/20"
              >
                <Plus size={13} /> Add Role
              </button>
            </div>

            <div className="space-y-2">
              {roles.map((role, idx) => (
                <div key={idx} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Role Title (e.g. Backend Engineer)"
                      value={role.title}
                      onChange={(e) => updateRole(idx, "title", e.target.value)}
                      className="flex-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                    {roles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRole(idx)}
                        className="text-slate-500 hover:text-red-400 p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Short expectation or requirements..."
                    value={role.description}
                    onChange={(e) => updateRole(idx, "description", e.target.value)}
                    className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Submit footer */}
          <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-400 hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting ? "Creating Project..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

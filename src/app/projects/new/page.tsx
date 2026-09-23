"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/landing/Navbar";
import { Closing } from "@/components/landing/Closing";
import { Plus, Trash2, ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";

interface NewRole {
  title: string;
  description: string;
  permissionLevel: "CONTRIBUTOR" | "MAINTAINER";
}

const IP_OPTIONS = [
  {
    id: "PORTFOLIO_ONLY",
    title: "Portfolio Only (Recommended)",
    desc: "Contributors retain the right to showcase their work in portfolios/resumes. The founder retains proprietary product ownership.",
  },
  {
    id: "OPEN_SOURCE",
    title: "Open Source",
    desc: "Code and assets are published under a standard open source license (MIT/Apache 2.0).",
  },
  {
    id: "SHARED_EQUITY",
    title: "Shared Equity / Future Revenue",
    desc: "Collaborators agree to share prospective revenue, tokenomics, or corporate equity upon formal entity incorporation.",
  },
  {
    id: "OWNER_RETAINED",
    title: "Proprietary",
    desc: "Strict enterprise/proprietary IP assignment. Full ownership retained by project creator.",
  },
];

export default function NewProjectPage() {
  const router = useRouter();
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

  // Open roles to recruit
  const [roles, setRoles] = useState<NewRole[]>([
    { title: "Frontend Developer", description: "Build interactive UI components and connect REST APIs.", permissionLevel: "CONTRIBUTOR" },
  ]);

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
        if (res.status === 401) {
          setError("Please sign in or create an account first to publish a project.");
          router.push("/login?redirect=/projects/new");
          return;
        }
        throw new Error(data.error?.message || "Failed to create project.");
      }

      router.push(`/projects/${data.data.project.slug}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Projects Directory
        </Link>

        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="border-b border-slate-100 pb-6 mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Post a New Project
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Define your vision, choose an upfront intellectual property agreement, and specify the roles you are actively recruiting.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Info */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                1. Project Basics
              </h2>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Africart Marketplace"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tagline (One-sentence pitch) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Modern e-commerce ecosystem empowering local African artisans"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  maxLength={160}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="engineering">Engineering & Dev</option>
                    <option value="design">Design & Creative</option>
                    <option value="ai">AI & Machine Learning</option>
                    <option value="mobile">Mobile Apps</option>
                    <option value="open-source">Open Source</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimated Commitment
                  </label>
                  <select
                    value={commitmentLevel}
                    onChange={(e) => setCommitmentLevel(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="2-5 hrs/week">2-5 hrs/week (Light)</option>
                    <option value="5-10 hrs/week">5-10 hrs/week (Standard)</option>
                    <option value="15+ hrs/week">15+ hrs/week (Substantial)</option>
                    <option value="Full-time">Full-time sprint</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Visibility
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "PRIVATE")}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="PUBLIC">Public (Directory listing)</option>
                    <option value="PRIVATE">Private (Invite-only)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Project Description (Markdown supported)
                </label>
                <textarea
                  rows={4}
                  placeholder="Detail the architecture, objectives, milestones, and what collaborators will learn or build..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Tech Stack */}
            <div className="space-y-4 border-t border-slate-100 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                2. Tech Stack & Technologies
              </h2>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add a technology (e.g. React, PostgreSQL, Docker)..."
                  value={techInput}
                  onChange={(e) => setTechInput(e.target.value)}
                  onKeyDown={addTech}
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addTech}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {techStack.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800"
                  >
                    {tech}
                    <button
                      type="button"
                      onClick={() => removeTech(tech)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* IP Model Selection per 21-legal */}
            <div className="space-y-4 border-t border-slate-100 pt-6">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-blue-600" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  3. Upfront Intellectual Property Model (21-Legal Spec)
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {IP_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                      ipModel === opt.id
                        ? "border-blue-600 bg-blue-50/40 ring-1 ring-blue-600"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="ipModel"
                      value={opt.id}
                      checked={ipModel === opt.id}
                      onChange={(e) => setIpModel(e.target.value)}
                      className="mt-1 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{opt.title}</div>
                      <div className="text-xs text-slate-600 mt-0.5">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Open Roles Recruitment */}
            <div className="space-y-4 border-t border-slate-100 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                    4. Open Roles You Are Recruiting
                  </h2>
                  <p className="text-xs text-slate-500">
                    Collaborators will apply specifically to these positions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addRole}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus size={13} /> Add Role
                </button>
              </div>

              <div className="space-y-3">
                {roles.map((role, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <input
                        type="text"
                        required
                        placeholder="Role Title (e.g. Lead Frontend Engineer, Product Designer)"
                        value={role.title}
                        onChange={(e) => updateRole(idx, "title", e.target.value)}
                        className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
                      />
                      {roles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRole(idx)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          title="Remove role"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    <textarea
                      rows={2}
                      placeholder="Role expectations, responsibilities, or specific expertise desired..."
                      value={role.description}
                      onChange={(e) => updateRole(idx, "description", e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="border-t border-slate-100 pt-6 flex items-center justify-end gap-3">
              <Link
                href="/projects"
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 shadow-sm disabled:opacity-50"
              >
                {submitting ? "Publishing Project..." : "Publish Project & Open Roles"}
              </button>
            </div>
          </form>
        </div>
      </main>

      <Closing />
    </div>
  );
}

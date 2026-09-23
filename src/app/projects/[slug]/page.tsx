"use client";

import { use, useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Closing } from "@/components/landing/Closing";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  FolderGit2,
} from "lucide-react";
import Link from "next/link";

interface Member {
  id: string;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  role: { id: string; title: string; permissionLevel: string };
}

interface RoleItem {
  id: string;
  title: string;
  description: string | null;
  isOpen: boolean;
  permissionLevel: string;
  members: Array<{ user: { username: string; displayName: string | null } }>;
}

interface ProjectData {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  status: string;
  visibility: string;
  ipModel: string;
  openSourceLicense: string | null;
  techStack: string[];
  commitmentLevel: string | null;
  createdAt: string;
  owner: { id: string; username: string; displayName: string | null; avatarUrl: string | null; bio: string | null };
  roles: RoleItem[];
  members: Member[];
  _count: { members: number; tasks: number; threads: number; applications: number };
}

export default function PublicProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [viewer, setViewer] = useState<{ isOwner: boolean; isMember: boolean; userApplication: { status: string } | null }>({
    isOwner: false,
    isMember: false,
    userApplication: null,
  });
  const [loading, setLoading] = useState(true);

  // Application Modal state
  const [applyingRoleId, setApplyingRoleId] = useState<string | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [submittingApply, setSubmittingApply] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const fetchProject = useCallback(() => {
    fetch(`/api/v1/projects/${slug}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setProject(res.data.project);
          if (res.data.viewer) setViewer(res.data.viewer);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingRoleId) return;
    setSubmittingApply(true);
    setApplyError(null);

    try {
      const res = await fetch(`/api/v1/projects/${slug}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId: applyingRoleId, message: applyMessage }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        if (res.status === 401) {
          window.location.href = `/login?redirect=/projects/${slug}`;
          return;
        }
        throw new Error(data.error?.message || "Failed to submit application.");
      }
      setApplySuccess(true);
      fetchProject();
    } catch (err: unknown) {
      setApplyError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmittingApply(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto max-w-xl py-24 text-center">
          <h2 className="text-xl font-bold text-slate-900">Project Not Found</h2>
          <p className="mt-2 text-sm text-slate-600">The requested project could not be found or is private.</p>
          <Link href="/projects" className="mt-4 inline-block text-sm text-blue-600 font-semibold">
            ← Back to Directory
          </Link>
        </div>
        <Closing />
      </div>
    );
  }

  const selectedRole = project.roles.find((r) => r.id === applyingRoleId);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Banner Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  {project.category}
                </span>
                <span className="rounded-md border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  {project.ipModel.replace("_", " ")}
                </span>
                {project.commitmentLevel && (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Clock size={13} /> {project.commitmentLevel}
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                {project.title}
              </h1>
              <p className="mt-2 text-base text-slate-600 max-w-2xl">
                {project.tagline}
              </p>
            </div>

            {/* Member or Workspace Action */}
            <div className="flex items-center gap-3 shrink-0">
              {viewer.isMember ? (
                <Link
                  href={`/repositories/${project.slug}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                >
                  <FolderGit2 size={16} /> Open Workspace
                </Link>
              ) : viewer.userApplication ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
                  Application Status: {viewer.userApplication.status}
                </div>
              ) : null}
            </div>
          </div>

          {/* Tech Stack */}
          {project.techStack && project.techStack.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2 pt-6 border-t border-slate-100">
              {project.techStack.map((tech) => (
                <span
                  key={tech}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Two-Column Details */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-3">About this Project</h2>
              <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                {project.description}
              </div>
            </div>

            {/* Open Recruitment Roles */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900">
                  Open Roles ({project.roles.filter((r) => r.isOpen).length})
                </h2>
                <span className="text-xs text-slate-500">Apply to join this team</span>
              </div>

              <div className="space-y-4">
                {project.roles.map((role) => (
                  <div
                    key={role.id}
                    className={`rounded-lg border p-4 transition-colors ${
                      role.isOpen
                        ? "border-slate-200 bg-slate-50/50 hover:border-slate-300"
                        : "border-slate-100 bg-slate-50 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{role.title}</h3>
                        {role.description && (
                          <p className="mt-1 text-xs text-slate-600">{role.description}</p>
                        )}
                      </div>

                      {role.isOpen && !viewer.isMember && (
                        <button
                          type="button"
                          onClick={() => {
                            setApplyingRoleId(role.id);
                            setApplySuccess(false);
                            setApplyError(null);
                          }}
                          className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                        >
                          Apply to Role
                        </button>
                      )}
                      {!role.isOpen && (
                        <span className="text-xs text-slate-400 font-medium">Filled</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Owner & Team */}
          <div className="space-y-6">
            {/* Project Creator */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Project Founder
              </h3>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700">
                  {project.owner.displayName?.[0] || project.owner.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {project.owner.displayName || project.owner.username}
                  </div>
                  <Link href={`/u/${project.owner.username}`} className="text-xs text-blue-600 hover:underline">
                    @{project.owner.username}
                  </Link>
                </div>
              </div>
              {project.owner.bio && (
                <p className="mt-3 text-xs text-slate-600 italic">
                  &ldquo;{project.owner.bio}&rdquo;
                </p>
              )}
            </div>

            {/* Current Active Team */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Current Team ({project.members.length + 1})
              </h3>
              <div className="space-y-3">
                {/* Owner */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{project.owner.displayName || project.owner.username}</span>
                  </div>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    OWNER
                  </span>
                </div>

                {/* Other members */}
                {project.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{m.user.displayName || m.user.username}</span>
                    <span className="text-[11px] text-slate-500">{m.role.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* IP Guarantee Badge */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs mb-1">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>Verified Contribution Guarantee</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Active contributors who complete project milestones receive signed, tamper-evident contribution certificates.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Application Modal */}
      {applyingRoleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            {applySuccess ? (
              <div className="text-center py-6">
                <CheckCircle2 size={48} className="mx-auto text-emerald-600 mb-3" />
                <h3 className="text-lg font-bold text-slate-900">Application Submitted!</h3>
                <p className="mt-1 text-sm text-slate-600 max-w-sm mx-auto">
                  The founder has been notified. You will receive an in-app notification when your application is reviewed.
                </p>
                <button
                  type="button"
                  onClick={() => setApplyingRoleId(null)}
                  className="mt-6 rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            ) : (
              <div>
                <div className="border-b border-slate-100 pb-4 mb-4">
                  <h3 className="text-lg font-bold text-slate-900">
                    Apply for {selectedRole?.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    To {project.title} &bull; Founded by @{project.owner.username}
                  </p>
                </div>

                {applyError && (
                  <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">
                    {applyError}
                  </div>
                )}

                <form onSubmit={handleApplySubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Why are you interested in this project? (Pitch & background) *
                    </label>
                    <textarea
                      rows={5}
                      required
                      placeholder="Share your relevant skills, past projects, GitHub link, and what you hope to build together..."
                      value={applyMessage}
                      onChange={(e) => setApplyMessage(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setApplyingRoleId(null)}
                      className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingApply}
                      className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {submittingApply ? "Submitting..." : "Send Application"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      <Closing />
    </div>
  );
}

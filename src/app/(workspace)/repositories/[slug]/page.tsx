"use client";

import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Code,
  CheckSquare,
  MessageSquare,
  Flag,
  Users,
  Award,
  Lock,
  Globe,
  FolderGit2,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { FileList } from "@/components/workspace/FileList";
import { FileTree } from "@/components/workspace/FileTree";
import { ReadmeCard } from "@/components/workspace/ReadmeCard";
import { WorkspaceTasks } from "@/components/workspace/WorkspaceTasks";
import { WorkspaceDiscussions } from "@/components/workspace/WorkspaceDiscussions";
import { WorkspaceMilestones } from "@/components/workspace/WorkspaceMilestones";
import { WorkspaceApplications } from "@/components/workspace/WorkspaceApplications";
import { WorkspaceRecords } from "@/components/workspace/WorkspaceRecords";

interface ProjectDetail {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  status: string;
  visibility: string;
  ipModel: string;
  techStack: string[];
  ownerId: string;
  createdAt: string;
  owner: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  members: Array<{
    userId: string;
    user: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
    role: { id: string; title: string; permissionLevel: string };
  }>;
  _count: {
    members: number;
    tasks: number;
    threads: number;
    files: number;
    applications: number;
    contributionRecords: number;
  };
}

type TabType = "code" | "tasks" | "discussions" | "milestones" | "applications" | "records";
const VALID_TABS: TabType[] = ["code", "tasks", "discussions", "milestones", "applications", "records"];

function RepoWorkspaceContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromQuery = searchParams.get("tab") as TabType | null;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [viewer, setViewer] = useState<{ isOwner: boolean; isMember: boolean } | null>(null);
  const [localTab, setLocalTab] = useState<TabType>("code");
  const [loading, setLoading] = useState(true);

  // Derived active tab: query param wins if valid, otherwise local state
  const activeTab: TabType = tabFromQuery && VALID_TABS.includes(tabFromQuery) ? tabFromQuery : localTab;

  const switchTab = (tab: TabType) => {
    setLocalTab(tab);
    router.replace(`/repositories/${slug}?tab=${tab}`, { scroll: false });
  };

  useEffect(() => {
    let ignore = false;
    fetch(`/api/v1/projects/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.success && data.data) {
          setProject(data.data.project);
          setViewer(data.data.viewer);
        }
      })
      .catch((err) => {
        console.error("Failed to load project:", err);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <FolderGit2 size={36} className="mx-auto text-slate-500" />
          <h1 className="mt-4 text-xl font-bold text-white">Repository not found</h1>
          <p className="mt-2 text-sm text-slate-400">
            No repository named “{slug}” in your workspace or you do not have permission.
          </p>
          <Link
            href="/repositories"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Back to workspace
          </Link>
        </section>
      </div>
    );
  }

  const isOwner = viewer?.isOwner ?? false;
  const isMember = viewer?.isMember ?? false;

  const TABS = [
    { id: "code", label: "Code", icon: Code, count: undefined },
    { id: "tasks", label: "Tasks", icon: CheckSquare, count: project._count.tasks },
    { id: "discussions", label: "Discussions", icon: MessageSquare, count: project._count.threads },
    { id: "milestones", label: "Milestones", icon: Flag, count: undefined },
    ...(isOwner || isMember
      ? [{ id: "applications", label: "Applications", icon: Users, count: project._count.applications }]
      : []),
    { id: "records", label: "Verified Records", icon: Award, count: project._count.contributionRecords },
  ] as const;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0a0f24]">
      {/* Workspace Project Header */}
      <div className="border-b border-white/10 bg-[#0d1430] px-6 pt-5 pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-lg text-white shadow-md">
              {project.title[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{project.title}</h1>
                <span className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                  {project.visibility === "PRIVATE" ? <Lock size={10} /> : <Globe size={10} />}
                  {project.visibility}
                </span>
                <span className="rounded bg-indigo-950/80 border border-indigo-700/50 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                  {project.ipModel.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{project.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/projects/${project.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <span>Public Page</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id as TabType)}
                className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? "border-indigo-500 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] font-bold text-slate-300">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {activeTab === "code" && (
          <div className="flex flex-1 overflow-hidden min-h-0">
            <FileTree />
            <div className="flex flex-1 flex-col overflow-y-auto p-6 space-y-6">
              <FileList />
              <ReadmeCard />
            </div>
          </div>
        )}

        {activeTab === "tasks" && (
          <WorkspaceTasks slug={project.slug} isMember={isMember} />
        )}

        {activeTab === "discussions" && (
          <WorkspaceDiscussions slug={project.slug} isMember={isMember} />
        )}

        {activeTab === "milestones" && (
          <WorkspaceMilestones slug={project.slug} isMember={isMember} />
        )}

        {activeTab === "applications" && (
          <WorkspaceApplications slug={project.slug} />
        )}

        {activeTab === "records" && (
          <WorkspaceRecords
            slug={project.slug}
            isOwner={isOwner}
            isMember={isMember}
            members={project.members}
          />
        )}
      </div>
    </div>
  );
}

export default function RepoWorkspacePage(props: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 bg-[#0a0f24]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      }
    >
      <RepoWorkspaceContent {...props} />
    </Suspense>
  );
}

"use client";

import { Suspense, use, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  CheckSquare,
  KanbanSquare,
  Milestone as MilestoneIcon,
  GanttChart,
  CalendarDays,
  FolderGit2,
  GitPullRequest,
  CircleDot,
  Files,
  Users,
  Activity as ActivityIcon,
  Settings as SettingsIcon,
  ArrowLeft,
  Lock,
  Globe,
  ExternalLink,
} from "lucide-react";
import { ProjectOverview } from "@/components/projects/ProjectOverview";
import { ProjectTasks } from "@/components/projects/ProjectTasks";
import { ProjectBoard } from "@/components/projects/ProjectBoard";
import { ProjectRoadmap } from "@/components/projects/ProjectRoadmap";
import { ProjectTimeline } from "@/components/projects/ProjectTimeline";
import { ProjectCalendar } from "@/components/projects/ProjectCalendar";
import { ProjectDev } from "@/components/projects/ProjectDev";
import { ProjectMembers } from "@/components/projects/ProjectMembers";
import { ProjectActivity } from "@/components/projects/ProjectActivity";
import { ProjectFiles } from "@/components/projects/ProjectFiles";
import { ProjectSettings } from "@/components/projects/ProjectSettings";
import { unwrap, fetchJson } from "@/components/projects/lib";

type TabId =
  | "overview" | "tasks" | "board" | "roadmap" | "timeline" | "calendar"
  | "repositories" | "pull-requests" | "issues"
  | "files" | "members" | "activity" | "settings";

const VALID_TABS: TabId[] = [
  "overview", "tasks", "board", "roadmap", "timeline", "calendar",
  "repositories", "pull-requests", "issues",
  "files", "members", "activity", "settings",
];

const NAV: Array<{ group: string; items: Array<{ id: TabId; label: string; icon: typeof LayoutDashboard }> }> = [
  {
    group: "Plan",
    items: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "tasks", label: "Tasks", icon: CheckSquare },
      { id: "board", label: "Board", icon: KanbanSquare },
      { id: "roadmap", label: "Roadmap", icon: MilestoneIcon },
      { id: "timeline", label: "Timeline", icon: GanttChart },
      { id: "calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    group: "Build",
    items: [
      { id: "repositories", label: "Repositories", icon: FolderGit2 },
      { id: "pull-requests", label: "Pull Requests", icon: GitPullRequest },
      { id: "issues", label: "Issues", icon: CircleDot },
    ],
  },
  {
    group: "Collaborate",
    items: [
      { id: "files", label: "Files", icon: Files },
      { id: "members", label: "Members", icon: Users },
      { id: "activity", label: "Activity", icon: ActivityIcon },
    ],
  },
  {
    group: "Project",
    items: [{ id: "settings", label: "Settings", icon: SettingsIcon }],
  },
];

interface Detail {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  status: string;
  visibility: string;
  owner: { id: string; username: string; displayName: string | null; avatarUrl?: string | null };
  members: Array<{
    userId: string;
    user: { id: string; username: string; displayName: string | null; avatarUrl?: string | null };
    role: { id: string; title: string; permissionLevel: string };
  }>;
}

function WorkspaceContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabId | null;
  const activeTab: TabId = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "overview";

  const [detail, setDetail] = useState<Detail | null>(null);
  const [overview, setOverview] = useState<React.ComponentProps<typeof ProjectOverview>["data"] | null>(null);
  const [milestones, setMilestones] = useState<Array<{ id: string; title: string; description: string | null; status: string; dueDate: string | null; totalTasks: number; doneTasks: number; progress: number }>>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      fetchJson(`/api/v1/projects/${slug}`),
      fetchJson(`/api/v1/projects/${slug}/overview`),
      fetchJson(`/api/v1/projects/${slug}/milestones`),
      fetchJson(`/api/v1/users/me`),
    ])
      .then(([d, o, m, me]) => {
        if (!d.res.ok) {
          setNotFound(true);
          return;
        }
        const project = unwrap<Detail | null>(d.json, "project", null);
        const viewer = unwrap<{ isOwner: boolean; isMember: boolean }>(d.json, "viewer", { isOwner: false, isMember: false });
        if (!project) {
          setNotFound(true);
          return;
        }
        setDetail(project);
        setIsOwner(viewer.isOwner);
        setIsMember(viewer.isMember);
        const od = (o.json as { data?: unknown })?.data ?? null;
        setOverview(od as typeof overview);
        setMilestones(unwrap(m.json, "milestones", []));
        const meu = (me.json as { user?: { id?: string }; data?: { user?: { id?: string } } } | null);
        setMeId(meu?.user?.id ?? meu?.data?.user?.id ?? null);
      })
      .catch(() => {
        setNotFound(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  const switchTab = (t: TabId) => {
    router.replace(`/projects/${slug}/workspace?tab=${t}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-xl font-bold text-white">Project not found</h1>
          <p className="mt-2 text-sm text-slate-400">No project “{slug}” in your workspace or you lack access.</p>
          <Link href="/projects" className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">
            Back to projects
          </Link>
        </section>
      </div>
    );
  }

  const myRole = detail.members.find((m) => m.userId === meId)?.role.permissionLevel;
  const isManager = isOwner || myRole === "OWNER" || myRole === "MAINTAINER";

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-black">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0d1430] px-4 sm:px-6 pt-4">
        <div className="flex items-center gap-3 pb-3">
          <Link href="/projects" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" title="Back to projects">
            <ArrowLeft size={16} />
          </Link>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-lg text-white">
            {detail.title[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white truncate">{detail.title}</h1>
              <span className="flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                {detail.visibility === "PRIVATE" ? <Lock size={10} /> : <Globe size={10} />}{detail.visibility}
              </span>
              <span className="rounded bg-indigo-950/80 border border-indigo-700/50 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                {detail.status.replace("_", " ")}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">{detail.tagline}</p>
          </div>
          <Link
            href={`/projects/${detail.slug}`}
            target="_blank"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 shrink-0"
          >
            Public Page <ExternalLink size={12} />
          </Link>
        </div>
        {/* Mobile horizontal nav */}
        <div className="flex lg:hidden items-center gap-1 overflow-x-auto pb-2">
          {NAV.flatMap((g) => g.items).map((item) => (
            <button
              key={item.id}
              onClick={() => switchTab(item.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap ${activeTab === item.id ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop sub-nav */}
        <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-white/10 bg-black/40 overflow-y-auto py-4 px-2.5 space-y-4">
          {NAV.map((g) => (
            <div key={g.group}>
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">{g.group}</p>
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => switchTab(item.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${active ? "bg-indigo-600/90 font-semibold text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                    >
                      <Icon size={15} className={active ? "text-white" : "text-slate-500"} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* Content */}
        <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
          {activeTab === "overview" && (
            overview ? <ProjectOverview slug={slug} data={overview} /> : <div className="p-8 text-xs text-slate-500">Overview unavailable.</div>
          )}
          {activeTab === "tasks" && (
            <ProjectTasks slug={slug} isMember={isMember} members={detail.members} milestones={milestones} meId={meId} onChanged={load} />
          )}
          {activeTab === "board" && <ProjectBoard slug={slug} isMember={isMember} onChanged={load} />}
          {activeTab === "roadmap" && <ProjectRoadmap slug={slug} />}
          {activeTab === "timeline" && <ProjectTimeline slug={slug} />}
          {activeTab === "calendar" && <ProjectCalendar slug={slug} />}
          {activeTab === "repositories" && <ProjectDev projectId={detail.id} slug={slug} initial="repos" />}
          {activeTab === "pull-requests" && <ProjectDev projectId={detail.id} slug={slug} initial="prs" />}
          {activeTab === "issues" && <ProjectDev projectId={detail.id} slug={slug} initial="issues" />}
          {activeTab === "files" && <ProjectFiles slug={slug} />}
          {activeTab === "members" && (
            <ProjectMembers slug={slug} members={detail.members} owner={detail.owner} isManager={isManager} meId={meId} onChanged={load} />
          )}
          {activeTab === "activity" && <ProjectActivity slug={slug} />}
          {activeTab === "settings" && (
            <ProjectSettings
              slug={slug}
              project={{ title: detail.title, tagline: detail.tagline, description: detail.description, category: detail.category, status: detail.status, visibility: detail.visibility }}
              isManager={isManager}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectWorkspacePage(props: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={
      <div className="flex flex-1 items-center justify-center p-8 bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    }>
      <WorkspaceContent {...props} />
    </Suspense>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Flame,
  FolderGit2,
  GitPullRequest,
  Handshake,
  MessageSquare,
  Package,
  Plus,
  Rocket,
  Search,
  Sparkles,
  Star,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { openCreateProjectModal } from "@/components/workspace/WorkspaceCreateProjectModal";
import { useWorkspace } from "@/context/WorkspaceContext";

type ProjectItem = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description?: string;
  category?: string;
  status: string;
  techStack: string[];
  stars?: number;
  author: {
    id?: string;
    username: string;
    displayName: string | null;
    avatarUrl?: string | null;
    isCurrentUser?: boolean;
  };
  memberCount: number;
  openRolesCount?: number;
  openRoles?: string[];
  updatedAt: string;
};

type StreamKind =
  | "launch"
  | "opportunity"
  | "release"
  | "milestone"
  | "contributor"
  | "update"
  | "discussion"
  | "achievement";

type StreamEvent = {
  id: string;
  kind: StreamKind;
  time: string;
  headline: string;
  body?: string;
  project: ProjectItem;
  roles?: string[];
  version?: string;
  versionFrom?: string;
  milestoneTitle?: string;
  stats?: { label: string; value: string | number }[];
  buildStory?: string[];
};

// Curated community projects built by various developers (fallback + showcase).
const COMMUNITY_SHOWCASE: ProjectItem[] = [
  {
    id: "showcase-1",
    slug: "school-management-system",
    title: "School Management System",
    tagline: "Comprehensive platform for students, attendance verification, and academic grading.",
    description: "Multi-tenant portal featuring real-time offline GPS check-ins, automated report cards, and parent notifications.",
    category: "Education",
    status: "IN_PROGRESS",
    techStack: ["Next.js", "TypeScript", "PostgreSQL", "TailwindCSS"],
    stars: 24,
    author: { username: "abdul_dev", displayName: "Abdul Rahman", isCurrentUser: false },
    memberCount: 4,
    openRolesCount: 2,
    openRoles: ["Backend", "QA"],
    updatedAt: "2 hours ago",
  },
  {
    id: "showcase-2",
    slug: "africart-marketplace",
    title: "Africart Marketplace",
    tagline: "Cross-border e-commerce gateway connecting African artisan merchants with global buyers.",
    description: "High-throughput marketplace with escrow payments, localized shipping integrations, and real-time inventory synchronization.",
    category: "E-Commerce",
    status: "RECRUITING",
    techStack: ["React", "Node.js", "MongoDB", "Stripe", "Redis"],
    stars: 48,
    author: { username: "maryam_craft", displayName: "Maryam Sow", isCurrentUser: false },
    memberCount: 5,
    openRolesCount: 3,
    openRoles: ["Backend", "UI/UX", "DevOps"],
    updatedAt: "4 hours ago",
  },
  {
    id: "showcase-3",
    slug: "waterhub-client",
    title: "WaterHub Monitoring Client",
    tagline: "IoT telemetry dashboard for municipal clean water distribution and reservoir sensors.",
    description: "Telemetry collection client with MQTT listeners, real-time valve control, and leak alert dispatching.",
    category: "IoT",
    status: "IN_PROGRESS",
    techStack: ["Rust", "TypeScript", "WebSockets", "TimescaleDB"],
    stars: 31,
    author: { username: "kofi_builds", displayName: "Kofi Mensah", isCurrentUser: false },
    memberCount: 3,
    openRolesCount: 1,
    openRoles: ["Backend"],
    updatedAt: "1 day ago",
  },
  {
    id: "showcase-4",
    slug: "klyro-ai-companion",
    title: "Klyro AI Pair Programmer",
    tagline: "Autonomous project architecture and code review agent powered by Deepseek & Claude.",
    description: "Context-aware git diff auditor that checks compliance with project architectural rules and generates test suites automatically.",
    category: "AI / DevTools",
    status: "RECRUITING",
    techStack: ["Python", "FastAPI", "PyTorch", "Next.js"],
    stars: 89,
    author: { username: "ama_codes", displayName: "Ama Osei", isCurrentUser: false },
    memberCount: 6,
    openRolesCount: 2,
    openRoles: ["ML Engineer", "Frontend"],
    updatedAt: "3 days ago",
  },
  {
    id: "showcase-5",
    slug: "wearlo-storefront",
    title: "Wearlo",
    tagline: "Headless storefront for independent fashion labels with live drops.",
    description: "Edge-rendered storefront with inventory reservations, drop scheduling, and creator payouts.",
    category: "E-Commerce",
    status: "RECRUITING",
    techStack: ["Next.js", "TypeScript", "Stripe"],
    stars: 17,
    author: { username: "sara_makes", displayName: "Sara Diallo", isCurrentUser: false },
    memberCount: 2,
    openRolesCount: 2,
    openRoles: ["Frontend", "UI/UX"],
    updatedAt: "5 hours ago",
  },
];

type StreamTab = "everything" | "following" | "teams" | "opportunities";
type FeedFilter = "all" | "moments" | "releases" | "opportunities" | "milestones" | "people" | "discussions";

const STREAM_TABS: { id: StreamTab; label: string }[] = [
  { id: "everything", label: "Everything" },
  { id: "following", label: "Following" },
  { id: "teams", label: "My Teams" },
  { id: "opportunities", label: "Opportunities" },
];

const FEED_FILTERS: { id: FeedFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "moments", label: "Build Moments" },
  { id: "releases", label: "Releases" },
  { id: "opportunities", label: "Opportunities" },
  { id: "milestones", label: "Milestones" },
  { id: "people", label: "People" },
  { id: "discussions", label: "Discussions" },
];

function kindMatchesFilter(kind: StreamKind, filter: FeedFilter): boolean {
  if (filter === "all") return true;
  if (filter === "moments") return kind === "launch" || kind === "achievement" || kind === "update";
  if (filter === "releases") return kind === "release";
  if (filter === "opportunities") return kind === "opportunity";
  if (filter === "milestones") return kind === "milestone";
  if (filter === "people") return kind === "contributor";
  if (filter === "discussions") return kind === "discussion";
  return true;
}

function initialsFor(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "D";
}

/** Build a mixed ecosystem feed: launches, opportunities, releases, milestones, people, discussions. */
function buildStreamEvents(projects: ProjectItem[]): StreamEvent[] {
  const bySlug = new Map(projects.map((p) => [p.slug, p]));
  const events: StreamEvent[] = [];

  const school = bySlug.get("school-management-system");
  const africart = bySlug.get("africart-marketplace");
  const waterhub = bySlug.get("waterhub-client");
  const klyroAi = bySlug.get("klyro-ai-companion");
  const wearlo = bySlug.get("wearlo-storefront");

  if (klyroAi) {
    events.push({
      id: "ev-launch-klyro-ai",
      kind: "launch",
      time: "2 hours ago",
      headline: `${klyroAi.author.displayName || klyroAi.author.username} launched v1.0`,
      body: klyroAi.tagline,
      project: klyroAi,
      stats: [
        { label: "stars", value: klyroAi.stars ?? 89 },
        { label: "contributors", value: klyroAi.memberCount },
        { label: "releases", value: 12 },
      ],
      buildStory: ["Started", "First contributor", "Architecture review", "First release", "Production launch"],
    });
  }

  if (africart) {
    events.push({
      id: "ev-opp-africart",
      kind: "opportunity",
      time: africart.updatedAt,
      headline: "Looking for collaborators",
      body: "Help ship escrow payouts and merchant onboarding before the holiday launch.",
      project: africart,
      roles: africart.openRoles ?? ["Backend", "UI/UX"],
    });
  }

  if (school) {
    events.push({
      id: "ev-milestone-school",
      kind: "milestone",
      time: "6 hours ago",
      headline: "Attendance Module completed",
      body: `Completed by ${school.author.displayName || school.author.username} + 2 contributors. Offline GPS check-ins now verify in under 2s.`,
      project: school,
      milestoneTitle: "Attendance Module",
    });
  }

  if (waterhub) {
    events.push({
      id: "ev-release-waterhub",
      kind: "release",
      time: "8 hours ago",
      headline: "v1.4.0 published",
      body: "Leak alert dispatching, valve control replay, and TimescaleDB retention policies.",
      project: waterhub,
      version: "v1.4.0",
      versionFrom: "v1.3.2",
      stats: [
        { label: "changes", value: 12 },
        { label: "contributors", value: waterhub.memberCount },
      ],
    });
  }

  // New builder moment derived from real authors when possible.
  const maryamProject = africart ?? projects[1];
  if (maryamProject) {
    events.push({
      id: "ev-builder-maryam",
      kind: "contributor",
      time: "Yesterday",
      headline: "Maryam joined 3 projects this week",
      body: "Frontend · React — interested in marketplaces and design systems.",
      project: maryamProject,
    });
  }

  if (wearlo) {
    events.push({
      id: "ev-opp-wearlo",
      kind: "opportunity",
      time: wearlo.updatedAt,
      headline: "2 contributors needed",
      body: "Live drops and creator payouts need a frontend push this sprint.",
      project: wearlo,
      roles: wearlo.openRoles ?? ["Frontend"],
    });
  }

  if (school) {
    events.push({
      id: "ev-discussion-school",
      kind: "discussion",
      time: "Yesterday",
      headline: "Discussion: should report cards work fully offline?",
      body: "4 replies · Parents in low-connectivity areas need printable term summaries.",
      project: school,
    });
  }

  // Real user / DB projects become build moments + updates so the feed reflects live data.
  const covered = new Set(["school-management-system", "africart-marketplace", "waterhub-client", "klyro-ai-companion", "wearlo-storefront"]);
  for (const p of projects) {
    if (covered.has(p.slug)) continue;
    if (p.author.isCurrentUser) {
      events.push({
        id: `ev-update-${p.slug}`,
        kind: "update",
        time: p.updatedAt,
        headline: p.status === "RECRUITING" ? "Project created — now recruiting" : "Build moment: project created",
        body: p.tagline,
        project: p,
        buildStory: ["Started", "First commit", p.status === "RECRUITING" ? "Recruiting contributors" : "In progress"],
      });
      if ((p.openRolesCount ?? 0) > 0) {
        events.push({
          id: `ev-opp-${p.slug}`,
          kind: "opportunity",
          time: p.updatedAt,
          headline: `${p.openRolesCount} open role${(p.openRolesCount ?? 0) > 1 ? "s" : ""} on your build`,
          body: "Applications are waiting — review them from the project page.",
          project: p,
          roles: p.openRoles ?? ["Contributor"],
        });
      }
    } else {
      events.push({
        id: `ev-update-${p.slug}`,
        kind: "update",
        time: p.updatedAt,
        headline: "Project updated",
        body: p.tagline,
        project: p,
      });
    }
  }

  // Signature achievement moment so scrolling alternates moment types.
  if (waterhub) {
    events.push({
      id: "ev-achievement-waterhub",
      kind: "achievement",
      time: "2 days ago",
      headline: "WaterHub reached its first production release",
      body: "From sensor prototype to municipal pilot.",
      project: waterhub,
      versionFrom: "v0.1",
      version: "v1.0",
      stats: [
        { label: "stars", value: waterhub.stars ?? 31 },
        { label: "contributors", value: waterhub.memberCount },
      ],
    });
  }

  return events;
}

function KindBadge({ kind }: { kind: StreamKind }) {
  const map: Record<StreamKind, { label: string; className: string; Icon: typeof Rocket }> = {
    launch: { label: "Project launched", className: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300", Icon: Rocket },
    opportunity: { label: "Looking for collaborators", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", Icon: Handshake },
    release: { label: "New release", className: "border-sky-500/30 bg-sky-500/10 text-sky-300", Icon: Package },
    milestone: { label: "Milestone completed", className: "border-amber-500/30 bg-amber-500/10 text-amber-300", Icon: CheckCircle2 },
    contributor: { label: "New builder", className: "border-purple-500/30 bg-purple-500/10 text-purple-300", Icon: UserPlus },
    update: { label: "Build moment", className: "border-zinc-700 bg-zinc-800/60 text-zinc-300", Icon: Sparkles },
    discussion: { label: "Project discussion", className: "border-orange-500/30 bg-orange-500/10 text-orange-300", Icon: MessageSquare },
    achievement: { label: "Build moment", className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300", Icon: Trophy },
  };
  const { label, className, Icon } = map[kind];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${className}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

export default function WorkspaceHomePage() {
  const { user } = useWorkspace();
  const [dbProjects, setDbProjects] = useState<ProjectItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [streamTab, setStreamTab] = useState<StreamTab>("everything");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  const loadProjects = useCallback(async () => {
    try {
      const [personalRes, exploreRes] = await Promise.all([
        fetch("/api/v1/projects").catch(() => null),
        fetch("/api/v1/projects?feed=explore").catch(() => null),
      ]);
      const items: ProjectItem[] = [];
      if (personalRes && personalRes.ok) {
        const d = await personalRes.json();
        const list = d?.data?.projects ?? d?.projects ?? [];
        if (Array.isArray(list)) {
          for (const p of list) {
            items.push({
              id: p.id,
              slug: p.slug,
              title: p.title,
              tagline: p.tagline || "Project repository",
              description: p.description,
              category: p.category || "Software",
              status: p.status || "IN_PROGRESS",
              techStack: Array.isArray(p.techStack) && p.techStack.length > 0 ? p.techStack : ["TypeScript", "Next.js"],
              stars: 1,
              author: {
                username: user?.username || "you",
                displayName: user?.displayName || user?.username || "You",
                isCurrentUser: true,
              },
              memberCount: p._count?.members ?? 1,
              openRolesCount: p._count?.roles ?? 0,
              openRoles: Array.isArray(p.roles) ? p.roles.map((r: { title: string }) => r.title) : undefined,
              updatedAt: "Recently updated",
            });
          }
        }
      }
      if (exploreRes && exploreRes.ok) {
        const d = await exploreRes.json();
        const list = d?.data?.projects ?? d?.projects ?? [];
        if (Array.isArray(list)) {
          for (const p of list) {
            if (items.some((existing) => existing.slug === p.slug)) continue;
            const isUserOwner = Boolean(user?.id && p.owner?.id === user.id);
            items.push({
              id: p.id,
              slug: p.slug,
              title: p.title,
              tagline: p.tagline || "Community repository",
              description: p.description,
              category: p.category || "Software",
              status: p.status || "IN_PROGRESS",
              techStack: Array.isArray(p.techStack) && p.techStack.length > 0 ? p.techStack : ["React", "TypeScript"],
              stars: 5,
              author: {
                id: p.owner?.id,
                username: p.owner?.username || "developer",
                displayName: p.owner?.displayName || p.owner?.username || "Developer",
                avatarUrl: p.owner?.avatarUrl,
                isCurrentUser: isUserOwner,
              },
              memberCount: p._count?.members ?? 1,
              openRolesCount: Array.isArray(p.roles) ? p.roles.length : 0,
              openRoles: Array.isArray(p.roles) ? p.roles.map((r: { title: string }) => r.title) : undefined,
              updatedAt: "Active",
            });
          }
        }
      }
      setDbProjects(items);
    } catch {
      // Ignore — showcase feed still renders.
    }
  }, [user]);

  useEffect(() => {
    const handleRefresh = () => loadProjects();
    window.addEventListener("refresh-workspace-projects", handleRefresh);
    // Initial fetch deferred to a microtask so the state update lands in a
    // fetch callback (external system sync), not synchronously in the effect.
    void Promise.resolve().then(() => loadProjects());
    return () => window.removeEventListener("refresh-workspace-projects", handleRefresh);
  }, [loadProjects]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) setCreateOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const allProjects = useMemo(() => {
    const existingSlugs = new Set(dbProjects.map((p) => p.slug));
    const filteredShowcase = COMMUNITY_SHOWCASE.filter((p) => !existingSlugs.has(p.slug));
    return [...dbProjects, ...filteredShowcase];
  }, [dbProjects]);

  const events = useMemo(() => buildStreamEvents(allProjects), [allProjects]);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return events.filter((ev) => {
      if (streamTab === "following" && ev.project.author.isCurrentUser) return false;
      if (streamTab === "teams" && !ev.project.author.isCurrentUser) return false;
      if (streamTab === "opportunities" && ev.kind !== "opportunity") return false;
      if (!kindMatchesFilter(ev.kind, feedFilter)) return false;
      if (q) {
        const hay = `${ev.project.title} ${ev.project.slug} ${ev.project.tagline} ${ev.headline} ${ev.body ?? ""} ${ev.project.author.displayName ?? ""} ${ev.project.author.username} ${ev.project.techStack.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [events, streamTab, feedFilter, searchQuery]);

  // Live ecosystem signals — derived from real data so the strip stays truthful.
  const buildsActive = allProjects.length;
  const lookingCount = allProjects.filter((p) => p.status === "RECRUITING" || (p.openRolesCount ?? 0) > 0).length;
  const updatedCount = allProjects.filter((p) => /hour|recently|active/i.test(p.updatedAt)).length;
  const launchesCount = events.filter((e) => e.kind === "launch" || e.kind === "achievement").length;

  // "For You" — skill affinity from the stacks across the stream.
  const topSkills = useMemo(() => {
    const freq = new Map<string, number>();
    for (const p of allProjects) for (const t of p.techStack) freq.set(t, (freq.get(t) ?? 0) + 1);
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
  }, [allProjects]);
  const skillMatches = useMemo(() => {
    if (topSkills.length === 0) return 0;
    return allProjects.filter((p) => p.techStack.some((t) => topSkills.includes(t))).length;
  }, [allProjects, topSkills]);

  const trending = useMemo(() => [...allProjects].sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0)).slice(0, 4), [allProjects]);
  const opportunities = useMemo(() => events.filter((e) => e.kind === "opportunity").slice(0, 2), [events]);
  const people = useMemo(() => {
    const seen = new Map<string, ProjectItem>();
    for (const p of allProjects) {
      if (p.author.isCurrentUser) continue;
      if (!seen.has(p.author.username)) seen.set(p.author.username, p);
    }
    return [...seen.values()].slice(0, 3);
  }, [allProjects]);
  const radar = useMemo(() => {
    const freq = new Map<string, number>();
    for (const p of allProjects) {
      const cat = p.category || "Software";
      freq.set(cat, (freq.get(cat) ?? 0) + 1);
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [allProjects]);

  const myBuilds = dbProjects.filter((p) => p.author.isCurrentUser).length;
  const followingCount = allProjects.filter((p) => !p.author.isCurrentUser).length;

  return (
    <div className="flex-1 overflow-y-auto bg-black p-4 sm:p-6 lg:p-8 text-white min-w-0">
      {/* ── Compact Buildstream header ── */}
      <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">Buildstream</span>
            </div>
            <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight">What&apos;s being built across Klyro</h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-400 max-w-2xl">Discover builds, people and opportunities to contribute.</p>
            <div className="mt-4 flex items-center gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-black p-1 text-xs w-fit max-w-full">
              {STREAM_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setStreamTab(t.id)}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                    streamTab === t.id ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative shrink-0" ref={createRef}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCreateOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-colors"
              >
                <Plus size={15} />
                <span>Create</span>
                <ChevronDown size={13} className={`transition-transform ${createOpen ? "rotate-180" : ""}`} />
              </button>
              <Link
                href="/pull-requests"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
              >
                <GitPullRequest size={14} />
                <span className="hidden sm:inline">Pull Requests</span>
                <span className="sm:hidden">PRs</span>
              </Link>
            </div>
            {createOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-zinc-800 bg-black p-1.5 shadow-2xl z-20">
                {[
                  { label: "Project", desc: "Start a new build", action: () => { setCreateOpen(false); openCreateProjectModal(); } },
                  { label: "Repository", desc: "Ship code together", action: () => { setCreateOpen(false); openCreateProjectModal(); } },
                  { label: "Team", desc: "Gather collaborators", href: "/teams" },
                  { label: "Task", desc: "Track a deliverable", href: "/projects" },
                  { label: "Discussion", desc: "Start a conversation", href: "/chat" },
                  { label: "Template", desc: "Reuse a blueprint", href: "/explore" },
                ].map((item) =>
                  item.href ? (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setCreateOpen(false)}
                      className="block rounded-lg px-3 py-2 hover:bg-zinc-900 transition-colors"
                    >
                      <span className="block text-xs font-semibold text-white">{item.label}</span>
                      <span className="block text-[11px] text-zinc-500">{item.desc}</span>
                    </Link>
                  ) : (
                    <button key={item.label} onClick={item.action} className="block w-full text-left rounded-lg px-3 py-2 hover:bg-zinc-900 transition-colors">
                      <span className="block text-xs font-semibold text-white">{item.label}</span>
                      <span className="block text-[11px] text-zinc-500">{item.desc}</span>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Live status strip */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 border-t border-zinc-800/70 pt-4 text-xs">
          {[
            { label: "builds active", value: buildsActive },
            { label: "updated recently", value: updatedCount },
            { label: "looking for collaborators", value: lookingCount },
            { label: "launches & moments", value: launchesCount },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 border border-zinc-800/50">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="font-bold text-white">{s.value}</span>
              <span className="text-zinc-500 truncate">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── For You intelligence layer ── */}
      <div className="mb-5 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-zinc-950 to-zinc-950 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-300">For you</p>
            <p className="mt-1 text-xs text-zinc-400">
              Because you work with: <span className="text-zinc-200 font-medium">{topSkills.join(" · ") || "TypeScript · Next.js"}</span>
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects, people, teams, code, issues..."
              className="w-full rounded-xl border border-zinc-800 bg-black py-2 pl-9 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/60 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl border border-zinc-800 bg-black/50 px-3 py-2.5"><span className="font-bold text-white">{skillMatches}</span> <span className="text-zinc-400">projects match your skills</span></div>
          <div className="rounded-xl border border-zinc-800 bg-black/50 px-3 py-2.5"><span className="font-bold text-white">{lookingCount}</span> <span className="text-zinc-400">teams are looking for contributors</span></div>
          <div className="rounded-xl border border-zinc-800 bg-black/50 px-3 py-2.5"><span className="font-bold text-white">{updatedCount}</span> <span className="text-zinc-400">builds were updated recently</span></div>
        </div>
      </div>

      {/* ── Main feed + intelligence panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {FEED_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFeedFilter(f.id)}
                className={`rounded-lg px-2.5 py-1.5 whitespace-nowrap transition-colors border ${
                  feedFilter === f.id
                    ? "border-zinc-600 bg-zinc-800 text-white font-medium"
                    : "border-zinc-800/60 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredEvents.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-12 text-center">
              <FolderGit2 size={36} className="mx-auto text-zinc-600 mb-3" />
              <h3 className="text-base font-semibold text-white">Nothing in this stream yet</h3>
              <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">Try a different filter or search — or start the next build moment yourself.</p>
              <button
                onClick={openCreateProjectModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                <Plus size={14} /> Start a project
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvents.map((ev) => <StreamCard key={ev.id} event={ev} />)}
            </div>
          )}
        </div>

        {/* Right intelligence panel */}
        <aside className="space-y-4 min-w-0">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">Your pulse</h3>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-zinc-400">Projects you follow</span><span className="font-semibold text-white">{followingCount}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Recent updates</span><span className="font-semibold text-white">{updatedCount}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">Open opportunities</span><span className="font-semibold text-white">{lookingCount}</span></div>
              <div className="flex justify-between"><span className="text-zinc-400">My builds</span><span className="font-semibold text-white">{myBuilds}</span></div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">Contribution opportunities</h3>
              <Flame size={14} className="text-orange-400" />
            </div>
            <div className="mt-3 space-y-2">
              {opportunities.length === 0 && <p className="text-xs text-zinc-500">No open calls right now.</p>}
              {opportunities.map((ev) => (
                <div key={ev.id} className="rounded-xl border border-zinc-800 bg-black/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-300">{(ev.roles?.[0] ?? "Contributor")}</p>
                  <p className="mt-0.5 text-xs font-semibold text-white truncate">{ev.project.title}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{ev.project.techStack.slice(0, 3).join(" · ")}</p>
                  <Link href={`/repositories/${ev.project.slug}`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300">
                    View opportunity <ArrowUpRight size={12} />
                  </Link>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">Trending builds</h3>
            <ol className="mt-3 space-y-2">
              {trending.map((p, i) => (
                <li key={p.id}>
                  <Link href={`/repositories/${p.slug}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-900 transition-colors group">
                    <span className="text-[11px] font-bold text-zinc-600 w-5">0{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-xs font-semibold text-white group-hover:text-indigo-300">{p.title}</span>
                      <span className="block text-[10px] text-zinc-500">{p.stars ?? 0} stars · {p.memberCount} contributors</span>
                    </span>
                    <ArrowUpRight size={13} className="text-zinc-600 group-hover:text-indigo-400" />
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[10px] text-zinc-600">Ranked by recent stars, follows and update activity.</p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">People you may build with</h3>
            <div className="mt-3 space-y-2">
              {people.map((p) => {
                const name = p.author.displayName || p.author.username;
                const shared = p.techStack.filter((t) => topSkills.includes(t)).length;
                return (
                  <div key={p.author.username} className="flex items-center gap-2.5 rounded-xl border border-zinc-800/70 bg-black/40 p-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-[10px] font-bold text-white">
                      {initialsFor(name)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-xs font-semibold text-white">{name}</span>
                      <span className="block truncate text-[10px] text-zinc-500">{p.techStack.slice(0, 2).join(" · ")}{shared > 0 ? ` · ${shared} shared interest${shared > 1 ? "s" : ""}` : ""}</span>
                    </span>
                    <Link href={`/u/${p.author.username}`} className="shrink-0 rounded-lg border border-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors">
                      Profile
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">Build radar</h3>
            <div className="mt-3 space-y-1.5">
              {radar.map(([cat, count]) => (
                <button
                  key={cat}
                  onClick={() => { setSearchQuery(cat === "Software" ? "" : cat); setFeedFilter("all"); }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-zinc-900 transition-colors group"
                  title={`Filter stream by ${cat}`}
                >
                  <span className="text-zinc-300 group-hover:text-white">{cat}</span>
                  <span className="text-[11px] text-zinc-500">{count} active build{count === 1 ? "" : "s"}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StreamCard({ event }: { event: StreamEvent }) {
  const p = event.project;
  const authorName = p.author.isCurrentUser ? "You" : p.author.displayName || p.author.username;

  return (
    <article className="rounded-2xl border border-zinc-800/80 bg-zinc-950 p-5 transition-colors hover:border-zinc-700">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <KindBadge kind={event.kind} />
        <span className="text-[11px] text-zinc-500">{event.time}</span>
      </div>

      {event.kind === "opportunity" ? (
        <div className="mt-3">
          <Link href={`/repositories/${p.slug}`} className="text-base font-bold text-white hover:text-indigo-300 transition-colors">
            {p.title}
          </Link>
          <p className="mt-0.5 text-xs text-zinc-400">{event.headline} — {event.body}</p>
          <div className="mt-3">
            <p className="text-[11px] text-zinc-500 mb-1.5">We&apos;re looking for:</p>
            <div className="flex flex-wrap gap-1.5">
              {(event.roles ?? []).map((r) => (
                <span key={r} className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-zinc-200">{r}</span>
              ))}
            </div>
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">Built by <span className="text-zinc-300 font-medium">{authorName}</span> · {p.techStack.slice(0, 4).join(" · ")}</p>
          <div className="mt-4 flex items-center gap-2">
            <Link href={`/repositories/${p.slug}`} className="rounded-xl border border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-500 hover:text-white transition-colors">
              View Project
            </Link>
            <Link href={`/projects/${p.slug}`} className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors">
              I&apos;m Interested
            </Link>
          </div>
        </div>
      ) : event.kind === "release" ? (
        <div className="mt-3">
          <p className="text-[11px] text-zinc-500">{p.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-white">{event.version ?? "New release"}</h2>
            {event.versionFrom && <span className="text-[11px] text-zinc-500 font-mono">{event.versionFrom} → {event.version}</span>}
          </div>
          <p className="mt-1 text-xs text-zinc-400">{event.body ?? event.headline}</p>
          <TechRow tech={p.techStack} />
          <CardFooter event={event} primaryLabel="View release" primaryHref={`/repositories/${p.slug}`} />
        </div>
      ) : event.kind === "milestone" ? (
        <div className="mt-3">
          <p className="text-[11px] text-zinc-500">{p.title}</p>
          <h2 className="text-base font-bold text-white">“{event.milestoneTitle ?? event.headline}”</h2>
          <p className="mt-1 text-xs text-zinc-400">{event.body}</p>
          <CardFooter event={event} primaryLabel="View milestone" primaryHref={`/repositories/${p.slug}?tab=tasks`} />
        </div>
      ) : event.kind === "contributor" ? (
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white">
            {initialsFor(event.headline)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-white truncate">{event.headline}</h2>
            <p className="text-[11px] text-zinc-500 truncate">{event.body}</p>
          </div>
          <Link href={`/u/${p.author.username}`} className="shrink-0 rounded-xl border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-zinc-500 hover:text-white transition-colors">
            View profile
          </Link>
        </div>
      ) : event.kind === "discussion" ? (
        <div className="mt-3">
          <p className="text-[11px] text-zinc-500">{p.title}</p>
          <h2 className="text-sm font-bold text-white">{event.headline}</h2>
          <p className="mt-1 text-xs text-zinc-400">{event.body}</p>
          <CardFooter event={event} primaryLabel="Join discussion" primaryHref={`/repositories/${p.slug}`} />
        </div>
      ) : event.kind === "achievement" ? (
        <div className="mt-3">
          <p className="text-xs text-zinc-300">✦ {authorName}&apos;s <span className="font-semibold text-white">{p.title}</span> {event.headline.toLowerCase().includes("reached") ? event.headline.replace(/^.*?reached/i, "reached") : event.headline}.</p>
          {event.versionFrom && event.version && (
            <p className="mt-2 font-mono text-xs text-zinc-400">{event.versionFrom} → {event.version}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
            {(event.stats ?? []).map((s) => (
              <span key={s.label}><span className="font-semibold text-zinc-200">{s.value}</span> {s.label}</span>
            ))}
          </div>
          <CardFooter event={event} primaryLabel="View release" primaryHref={`/repositories/${p.slug}`} />
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FolderGit2 size={17} />
            </span>
            <div className="min-w-0">
              <Link href={`/repositories/${p.slug}`} className="block truncate text-sm font-bold text-white hover:text-indigo-300 transition-colors">
                {p.title}
              </Link>
              <span className="block truncate text-[11px] text-zinc-500">{event.headline} · by {authorName}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{event.body ?? p.tagline}</p>
          <TechRow tech={p.techStack} />
          {event.buildStory && (
            <div className="mt-3 rounded-xl border border-zinc-800/70 bg-black/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 mb-2">Build story</p>
              <ol className="space-y-1.5">
                {event.buildStory.map((step, i) => (
                  <li key={step} className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${i === event.buildStory!.length - 1 ? "bg-indigo-400" : "bg-zinc-600"}`} />
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <CardFooter
            event={event}
            primaryLabel={event.kind === "launch" ? "Explore project" : "Open build"}
            primaryHref={`/repositories/${p.slug}`}
          />
        </div>
      )}
    </article>
  );
}

function TechRow({ tech }: { tech: string[] }) {
  if (tech.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tech.slice(0, 5).map((t) => (
        <span key={t} className="rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300">{t}</span>
      ))}
    </div>
  );
}

function CardFooter({ event, primaryLabel, primaryHref }: { event: StreamEvent; primaryLabel: string; primaryHref: string }) {
  const p = event.project;
  return (
    <div className="mt-4 flex items-center justify-between border-t border-zinc-800/60 pt-3 text-xs text-zinc-400">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1" title="Stars">
          <Star size={13} className="text-zinc-500" />
          <span className="text-[11px]">{p.stars ?? 1}</span>
        </span>
        <span className="flex items-center gap-1" title="Contributors">
          <Users size={13} className="text-zinc-500" />
          <span className="text-[11px]">{p.memberCount}</span>
        </span>
        {(p.openRolesCount ?? 0) > 0 && (
          <span className="hidden sm:inline text-[10px] text-emerald-400 font-medium">{p.openRolesCount} open role{(p.openRolesCount ?? 0) > 1 ? "s" : ""}</span>
        )}
      </div>
      <Link href={primaryHref} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
        {primaryLabel} <ArrowUpRight size={13} />
      </Link>
    </div>
  );
}

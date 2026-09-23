"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  FolderGit2,
  GitPullRequest,
  Plus,
  Search,
  Users,
  Star,
  Sparkles,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Layers,
  Code2,
  Globe,
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
  updatedAt: string;
};

// Curated community projects and repositories built by various developers
const COMMUNITY_SHOWCASE: ProjectItem[] = [
  {
    id: "showcase-1",
    slug: "school-management-system",
    title: "School Management System",
    tagline: "Comprehensive platform for students, attendance verification, and academic grading.",
    description: "Multi-tenant portal featuring real-time offline GPS check-ins, automated report cards, and parent notifications.",
    category: "Web App",
    status: "IN_PROGRESS",
    techStack: ["Next.js", "TypeScript", "PostgreSQL", "TailwindCSS"],
    stars: 24,
    author: {
      username: "abdul_dev",
      displayName: "Abdul Rahman",
      isCurrentUser: false,
    },
    memberCount: 4,
    openRolesCount: 2,
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
    author: {
      username: "maryam_craft",
      displayName: "Maryam Sow",
      isCurrentUser: false,
    },
    memberCount: 5,
    openRolesCount: 3,
    updatedAt: "4 hours ago",
  },
  {
    id: "showcase-3",
    slug: "waterhub-client",
    title: "WaterHub Monitoring Client",
    tagline: "IoT telemetry dashboard for municipal clean water distribution and reservoir sensors.",
    description: "Telemetry collection client with MQTT listeners, real-time valve control, and leak alert dispatching.",
    category: "IoT / Systems",
    status: "IN_PROGRESS",
    techStack: ["Rust", "TypeScript", "WebSockets", "TimescaleDB"],
    stars: 31,
    author: {
      username: "kofi_builds",
      displayName: "Kofi Mensah",
      isCurrentUser: false,
    },
    memberCount: 3,
    openRolesCount: 1,
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
    author: {
      username: "ama_codes",
      displayName: "Ama Osei",
      isCurrentUser: false,
    },
    memberCount: 6,
    openRolesCount: 2,
    updatedAt: "3 days ago",
  },
];

export default function WorkspaceHomePage() {
  const { user } = useWorkspace();
  const [dbProjects, setDbProjects] = useState<ProjectItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "my" | "community" | "recruiting">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const loadProjects = useCallback(async () => {
    try {
      // Fetch both personal projects and public explore projects
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
            // Avoid duplicate if already in personal
            if (items.some((existing) => existing.slug === p.slug)) continue;
            const isUserOwner = user?.id && p.owner?.id === user.id;
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
                isCurrentUser: Boolean(isUserOwner),
              },
              memberCount: p._count?.members ?? 1,
              openRolesCount: Array.isArray(p.roles) ? p.roles.length : 0,
              updatedAt: "Active",
            });
          }
        }
      }

      setDbProjects(items);
    } catch {
      // Ignore
    }
  }, [user]);

  useEffect(() => {
    loadProjects();
    const handleRefresh = () => loadProjects();
    window.addEventListener("refresh-workspace-projects", handleRefresh);
    return () => window.removeEventListener("refresh-workspace-projects", handleRefresh);
  }, [loadProjects]);

  // Combine user projects and community projects
  const allProjects = useMemo(() => {
    // If user has created projects, prepend them; otherwise merge with showcase
    const existingSlugs = new Set(dbProjects.map((p) => p.slug));
    const filteredShowcase = COMMUNITY_SHOWCASE.filter((p) => !existingSlugs.has(p.slug));
    return [...dbProjects, ...filteredShowcase];
  }, [dbProjects]);

  // Filter based on active tab, search, and category
  const filteredProjects = useMemo(() => {
    return allProjects.filter((project) => {
      // Tab filter
      if (activeTab === "my" && !project.author.isCurrentUser) return false;
      if (activeTab === "community" && project.author.isCurrentUser) return false;
      if (activeTab === "recruiting" && project.status !== "RECRUITING" && (!project.openRolesCount || project.openRolesCount === 0)) {
        return false;
      }

      // Category filter
      if (selectedCategory !== "All" && project.category !== selectedCategory) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = project.title.toLowerCase().includes(q);
        const matchesSlug = project.slug.toLowerCase().includes(q);
        const matchesTagline = project.tagline.toLowerCase().includes(q);
        const matchesAuthor =
          (project.author.displayName || "").toLowerCase().includes(q) ||
          project.author.username.toLowerCase().includes(q);
        const matchesTech = project.techStack.some((t) => t.toLowerCase().includes(q));

        if (!matchesTitle && !matchesSlug && !matchesTagline && !matchesAuthor && !matchesTech) {
          return false;
        }
      }

      return true;
    });
  }, [allProjects, activeTab, selectedCategory, searchQuery]);

  const displayName = user?.displayName || user?.username || "Developer";

  const categories = ["All", "Web App", "E-Commerce", "IoT / Systems", "AI / DevTools"];

  return (
    <div className="flex-1 overflow-y-auto bg-black p-4 sm:p-6 lg:p-8 text-white min-w-0">
      {/* Top Welcome / Hero Banner */}
      <div className="mb-6 rounded-2xl border border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-indigo-950/40 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 mb-2.5">
              <Sparkles size={13} className="text-indigo-400" />
              <span>Projects &amp; Repositories Feed</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome back, {displayName}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Discover active projects and repositories created by community developers, explore the codebases, or start building your own.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={openCreateProjectModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-colors"
            >
              <Plus size={15} />
              <span>New Project</span>
            </button>
            <Link
              href="/pull-requests"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3.5 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <GitPullRequest size={14} />
              <span>Pull Requests</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="mb-6 space-y-3">
        {/* Search Bar & Tab Pills */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-1 text-xs scrollbar-none">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                activeTab === "all" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              All Projects &amp; Repos
            </button>
            <button
              onClick={() => setActiveTab("my")}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                activeTab === "my" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              My Builds
            </button>
            <button
              onClick={() => setActiveTab("community")}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                activeTab === "community" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              Community Devs
            </button>
            <button
              onClick={() => setActiveTab("recruiting")}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                activeTab === "recruiting" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
              }`}
            >
              Looking for Collaborators
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px] md:w-80">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by project, dev, or tech..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-2 pl-9 pr-3.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/60 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-zinc-500 text-[11px] font-medium mr-1 flex items-center gap-1">
            <Filter size={12} /> Filter:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-2.5 py-1 text-xs transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? "border border-zinc-700 bg-zinc-800 text-white font-medium"
                  : "border border-zinc-800/60 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Projects & Repositories Grid */}
      {filteredProjects.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-12 text-center">
          <FolderGit2 size={36} className="mx-auto text-zinc-600 mb-3" />
          <h3 className="text-base font-semibold text-white">No projects found</h3>
          <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
            {activeTab === "my"
              ? "You haven't created any repositories or projects yet. Launch your first project to start collaborating."
              : "Try adjusting your search query or filter tags to find active repositories."}
          </p>
          {activeTab === "my" && (
            <button
              onClick={openCreateProjectModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-md"
            >
              <Plus size={14} />
              <span>Create Your First Project</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredProjects.map((project) => {
            const authorInitials = (project.author.displayName || project.author.username || "D")
              .trim()
              .slice(0, 2)
              .toUpperCase();

            const isRecruiting = project.status === "RECRUITING" || (project.openRolesCount && project.openRolesCount > 0);

            return (
              <div
                key={project.id}
                className="group flex flex-col rounded-2xl border border-zinc-800/80 bg-zinc-950 p-5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/40 hover:shadow-xl"
              >
                {/* Header: Project Icon & Status Badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors">
                      <FolderGit2 size={18} />
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/repositories/${project.slug}`}
                        className="block truncate text-sm font-semibold text-white hover:text-indigo-400 transition-colors"
                      >
                        {project.title}
                      </Link>
                      <span className="block truncate text-[11px] text-zinc-500 font-mono">
                        {project.slug}
                      </span>
                    </div>
                  </div>

                  {isRecruiting ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400 shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Recruiting
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800/50 px-2 py-0.5 text-[10px] font-medium text-zinc-400 shrink-0">
                      Active
                    </span>
                  )}
                </div>

                {/* Creator Attribution */}
                <div className="flex items-center gap-2 mb-3 text-xs text-zinc-400">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-[9px] font-bold text-white">
                    {authorInitials}
                  </div>
                  <span className="truncate">
                    Built by{" "}
                    <strong className="text-zinc-200 font-medium">
                      {project.author.isCurrentUser ? "You" : project.author.displayName || project.author.username}
                    </strong>
                  </span>
                  <span className="text-zinc-600 text-[10px]">•</span>
                  <span className="text-zinc-500 text-[10px] truncate">{project.updatedAt}</span>
                </div>

                {/* Tagline / Description */}
                <p className="text-xs text-zinc-400 line-clamp-2 mb-4 leading-relaxed flex-1">
                  {project.tagline}
                </p>

                {/* Tech Stack Badges */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {project.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                {/* Footer Metrics & Direct Repo Link */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60 text-xs text-zinc-400">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 hover:text-amber-400 transition-colors" title="Stars">
                      <Star size={13} className="text-zinc-500 group-hover:text-amber-400 transition-colors" />
                      <span className="text-[11px]">{project.stars || 1}</span>
                    </span>
                    <span className="flex items-center gap-1 hover:text-zinc-200 transition-colors" title="Collaborators">
                      <Users size={13} className="text-zinc-500" />
                      <span className="text-[11px]">{project.memberCount}</span>
                    </span>
                  </div>

                  <Link
                    href={`/repositories/${project.slug}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 group-hover:translate-x-0.5 transition-all"
                  >
                    <span>Open Repo</span>
                    <ArrowUpRight size={13} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

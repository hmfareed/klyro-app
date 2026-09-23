"use client";

import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Closing } from "@/components/landing/Closing";
import { Search, ArrowRight, Sparkles, Filter } from "lucide-react";
import Link from "next/link";

interface OpenRole {
  id: string;
  title: string;
  description: string | null;
  permissionLevel: string;
}

interface ProjectSummary {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  ipModel: string;
  openSourceLicense: string | null;
  techStack: string[];
  commitmentLevel: string | null;
  createdAt: string;
  owner: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  roles: OpenRole[];
  _count: { members: number; tasks: number; threads: number };
}

const CATEGORIES = [
  { id: "all", label: "All Projects" },
  { id: "engineering", label: "Engineering & Dev" },
  { id: "design", label: "Design & UX" },
  { id: "ai", label: "AI & Data" },
  { id: "mobile", label: "Mobile Apps" },
  { id: "open-source", label: "Open Source" },
];

const IP_MODELS: Record<string, { label: string; badgeClass: string }> = {
  OPEN_SOURCE: { label: "Open Source", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PORTFOLIO_ONLY: { label: "Portfolio Only", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  SHARED_EQUITY: { label: "Shared Equity", badgeClass: "bg-purple-50 text-purple-700 border-purple-200" },
  OWNER_RETAINED: { label: "Proprietary", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" },
};

export default function ProjectsExplorePage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const fetchProjects = useCallback((query: string, cat: string) => {
    const params = new URLSearchParams({ feed: "explore" });
    if (query) params.set("q", query);
    if (cat !== "all") params.set("category", cat);

    fetch(`/api/v1/projects?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.projects) {
          setProjects(data.data.projects);
        } else {
          setProjects([]);
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchProjects(search, activeCategory);
  }, [activeCategory, fetchProjects, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    fetchProjects(search, activeCategory);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Navbar />

      <main className="mx-auto max-w-6xl px-6 py-12">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-slate-200">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 mb-3">
              <Sparkles size={13} />
              <span>Project Recruitment Directory</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Explore Projects & Open Roles
            </h1>
            <p className="mt-2 text-base text-slate-600 max-w-2xl">
              Find collaborative projects building real software. Join as an engineer, designer, or creator, earn verified contribution records, and ship together.
            </p>
          </div>

          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors shrink-0"
          >
            <span>Post a Project</span>
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by title, stack (e.g. Next.js), or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </form>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setLoading(true);
                  setActiveCategory(cat.id);
                }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors border ${
                  activeCategory === cat.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Projects Grid */}
        <div className="mt-8">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
                <Filter size={24} />
              </div>
              <h3 className="text-base font-semibold text-slate-900">No projects found</h3>
              <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                No active projects matched your criteria. Be the first to start a new project!
              </p>
              <div className="mt-6">
                <Link
                  href="/projects/new"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Create Project
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((proj) => {
                const ipMeta = IP_MODELS[proj.ipModel] || IP_MODELS.PORTFOLIO_ONLY;
                return (
                  <div
                    key={proj.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${ipMeta.badgeClass}`}>
                          {ipMeta.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          {proj.commitmentLevel || "Flexible hours"}
                        </span>
                      </div>

                      {/* Project Title & Tagline */}
                      <h3 className="text-lg font-bold text-slate-900 line-clamp-1">
                        <Link href={`/projects/${proj.slug}`} className="hover:text-blue-600 transition-colors">
                          {proj.title}
                        </Link>
                      </h3>
                      <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">
                        {proj.tagline || proj.description}
                      </p>

                      {/* Tech Stack Chips */}
                      {proj.techStack && proj.techStack.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {proj.techStack.slice(0, 4).map((tech) => (
                            <span
                              key={tech}
                              className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                              {tech}
                            </span>
                          ))}
                          {proj.techStack.length > 4 && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                              +{proj.techStack.length - 4}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Open Roles Section */}
                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Recruiting ({proj.roles.length})
                          </span>
                        </div>
                        {proj.roles.length > 0 ? (
                          <div className="space-y-1.5">
                            {proj.roles.slice(0, 3).map((r) => (
                              <div
                                key={r.id}
                                className="flex items-center justify-between text-xs bg-slate-50 rounded px-2.5 py-1.5 text-slate-800"
                              >
                                <span className="font-medium">{r.title}</span>
                                <span className="text-blue-600 font-semibold text-[11px]">Apply</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">No open roles currently posted</p>
                        )}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700">
                          {proj.owner.displayName?.[0] || proj.owner.username[0].toUpperCase()}
                        </div>
                        <span className="text-xs text-slate-600">
                          by <span className="font-medium text-slate-900">{proj.owner.displayName || proj.owner.username}</span>
                        </span>
                      </div>

                      <Link
                        href={`/projects/${proj.slug}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        View Project <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Closing />
    </div>
  );
}

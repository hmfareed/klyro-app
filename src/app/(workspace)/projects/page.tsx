"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Plus,
  Search,
  Users,
  Lock,
  Globe,
  Archive,
  LayoutTemplate,
  CheckSquare,
  Clock,
} from "lucide-react";
import { openCreateProjectModal } from "@/components/workspace/WorkspaceCreateProjectModal";

type TabId = "mine" | "shared" | "archived" | "templates";

interface ProjectCard {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  status: string;
  visibility: string;
  ownerId: string;
  updatedAt: string;
  _count: { members: number; roles: number; tasks: number; threads: number };
  progress: { total: number; done: number; percent: number };
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "mine", label: "My Projects" },
  { id: "shared", label: "Shared With Me" },
  { id: "archived", label: "Archived" },
  { id: "templates", label: "Templates" },
];

const TEMPLATES = [
  {
    name: "Software Development",
    desc: "Backlog → Todo → In Progress → Review → Done, with Planning, Development, Testing and Launch milestones.",
    workflow: ["Backlog", "Todo", "In Progress", "Review", "Done"],
    milestones: ["Planning", "Development", "Testing", "Launch"],
  },
  {
    name: "Mobile App",
    desc: "Ship a mobile experience: design, native build, beta, store review and public launch.",
    workflow: ["Todo", "In Progress", "Review", "Done"],
    milestones: ["Design", "Alpha", "Beta", "Store Launch"],
  },
  {
    name: "Website",
    desc: "Content, design and build sprints for marketing or product sites.",
    workflow: ["Todo", "In Progress", "Review", "Done"],
    milestones: ["Content", "Design", "Build", "Launch"],
  },
  {
    name: "Product Launch",
    desc: "Coordinate launch readiness across engineering, design and go-to-market.",
    workflow: ["Todo", "In Progress", "Review", "Done"],
    milestones: ["MVP", "Beta", "Freeze", "Launch"],
  },
  {
    name: "Marketing Campaign",
    desc: "Plan channels, assets and timelines for a campaign push.",
    workflow: ["Ideas", "In Production", "Scheduled", "Live"],
    milestones: ["Brief", "Assets", "Launch", "Retro"],
  },
  {
    name: "Research",
    desc: "Questions, experiments and write-ups for research spikes.",
    workflow: ["Questions", "Exploring", "Review", "Published"],
    milestones: ["Proposal", "Experiments", "Draft", "Publish"],
  },
  {
    name: "School Project",
    desc: "Lightweight setup for coursework: proposal, build, demo and report.",
    workflow: ["Todo", "Doing", "Done"],
    milestones: ["Proposal", "Build", "Demo"],
  },
  {
    name: "Startup",
    desc: "From idea to MVP: validation, build, launch and iterate.",
    workflow: ["Backlog", "Now", "Review", "Shipped"],
    milestones: ["Validation", "MVP", "Launch", "Growth"],
  },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export default function WorkspaceProjectsPage() {
  const [tab, setTab] = useState<TabId>("mine");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetch("/api/v1/users/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const u = d?.user ?? d?.data?.user;
        if (u?.id) setMeId(u.id);
      })
      .catch(() => {});
  }, []);

  const fetchProjects = useCallback(
    (scope: TabId, q: string) => {
      if (scope === "templates") {
        return;
      }
      const params = new URLSearchParams({ scope });
      if (q) params.set("q", q);
      fetch(`/api/v1/projects?${params.toString()}`)
        .then((res) => res.json().catch(() => null))
        .then((json) => {
          const list: ProjectCard[] =
            json?.data?.projects ?? json?.projects ?? [];
          setProjects(Array.isArray(list) ? list : []);
        })
        .catch(() => {
          setProjects([]);
        })
        .finally(() => {
          setLoading(false);
        });
    },
    [],
  );

  useEffect(() => {
    fetchProjects(tab, debounced);
  }, [tab, debounced, fetchProjects]);

  return (
    <div className="flex-1 overflow-y-auto bg-black p-6 text-white min-w-0">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderKanban size={20} className="text-indigo-400" />
            Projects
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Collaboration workspaces that connect tasks, repositories, pull requests and teams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 focus-within:border-indigo-500/60">
            <Search size={14} className="text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-44 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
          </div>
          <button
            onClick={openCreateProjectModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
          >
            <Plus size={14} /> New Project
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex items-center gap-1 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === t.id
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Templates */}
      {tab === "templates" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {TEMPLATES.map((t) => (
            <div
              key={t.name}
              className="flex flex-col rounded-xl border border-white/10 bg-[#09090b] p-5 hover:border-indigo-500/40 transition-all"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/60 border border-indigo-700/50 text-indigo-300">
                  <LayoutTemplate size={15} />
                </span>
                <h3 className="text-sm font-bold text-white">{t.name}</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed flex-1">{t.desc}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t.workflow.map((s) => (
                  <span
                    key={s}
                    className="rounded bg-white/5 border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-300"
                  >
                    {s}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Milestones: {t.milestones.join(" → ")}
              </p>
              <button
                onClick={openCreateProjectModal}
                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-950/40 px-3 py-1.5 text-xs font-semibold text-indigo-200 hover:bg-indigo-900/50 transition-colors"
              >
                <Plus size={13} /> Use template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Project lists */}
      {tab !== "templates" && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
              {tab === "archived" ? (
                <Archive size={32} className="mx-auto text-slate-600 mb-2" />
              ) : (
                <FolderKanban size={32} className="mx-auto text-slate-600 mb-2" />
              )}
              <h3 className="text-sm font-semibold text-white">
                {tab === "archived"
                  ? "No archived projects"
                  : tab === "shared"
                    ? "Nothing shared with you yet"
                    : debounced
                      ? `No projects match "${debounced}"`
                      : "No projects yet"}
              </h3>
              <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                {tab === "mine" && !debounced
                  ? "Create a project to get a task board, roadmap, milestones and a connected repository."
                  : tab === "shared" && !debounced
                    ? "When someone adds you to their project, it will show up here."
                    : "Completed projects move to the archive instead of being deleted."}
              </p>
              {tab === "mine" && !debounced && (
                <button
                  onClick={openCreateProjectModal}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  <Plus size={14} /> New Project
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => {
                const open = p.progress.total - p.progress.done;
                const isOwner = meId ? p.ownerId === meId : false;
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.slug}/workspace?tab=overview`}
                    className="flex flex-col rounded-xl border border-white/10 bg-[#09090b] p-5 shadow-sm hover:border-indigo-500/40 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300 truncate max-w-[140px]">
                          {p.slug}
                        </span>
                        {tab === "shared" && (
                          <span className="text-[10px] font-medium text-slate-500">
                            {isOwner ? "Owner" : "Shared"}
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0">
                        {p.visibility === "PRIVATE" ? <Lock size={11} /> : <Globe size={11} />}
                        {p.visibility}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors line-clamp-1">
                      {p.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed line-clamp-2 flex-1">
                      {p.tagline}
                    </p>

                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Progress</span>
                        <span className="font-semibold text-white">
                          {p.progress.percent}% ({p.progress.done}/{p.progress.total})
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                          style={{ width: `${p.progress.percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <CheckSquare size={12} />
                        {open} open · {p.progress.total} total
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users size={12} />
                        {p._count.members + 1} members
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={12} />
                        {timeAgo(p.updatedAt)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

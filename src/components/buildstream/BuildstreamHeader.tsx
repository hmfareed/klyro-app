"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Plus, ChevronDown, GitPullRequest } from "lucide-react";
import { openCreateProjectModal } from "@/components/workspace/WorkspaceCreateProjectModal";
import { BuildstreamTab } from "@/server/buildstream";

const TABS: { id: BuildstreamTab; label: string }[] = [
  { id: "everything", label: "Everything" },
  { id: "following", label: "Following" },
  { id: "my-builds", label: "My Builds" },
  { id: "opportunities", label: "Opportunities" },
];

interface BuildstreamHeaderProps {
  currentTab: BuildstreamTab;
  onTabChange: (tab: BuildstreamTab) => void;
  stats: {
    activeBuilds: number;
    updatedRecently: number;
    openOpportunities: number;
    launchesAndMoments: number;
  };
  isLoading?: boolean;
}

export function BuildstreamHeader({
  currentTab,
  onTabChange,
  stats,
  isLoading,
}: BuildstreamHeaderProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
              Buildstream
            </span>
          </div>

          <h1 className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-white">
            What&apos;s happening across Klyro
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400 max-w-2xl">
            Live ecosystem stream of builds, launches, releases, and collaboration calls.
          </p>

          {/* Navigation Tabs */}
          <div className="mt-4 flex items-center gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-black p-1 text-xs w-fit max-w-full">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => onTabChange(t.id)}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  currentTab === t.id
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Actions: + Create & Pull Requests */}
        <div className="relative shrink-0" ref={createRef}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreateOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-colors cursor-pointer"
            >
              <Plus size={15} />
              <span>Create</span>
              <ChevronDown
                size={13}
                className={`transition-transform duration-150 ${createOpen ? "rotate-180" : ""}`}
              />
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

          {/* Create Dropdown Menu */}
          {createOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-800 bg-black p-1.5 shadow-2xl z-30 animate-in fade-in duration-100">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Project
              </div>
              <button
                onClick={() => {
                  setCreateOpen(false);
                  openCreateProjectModal();
                }}
                className="w-full text-left rounded-lg px-3 py-2 hover:bg-zinc-900 transition-colors cursor-pointer"
              >
                <span className="block text-xs font-semibold text-white">New Build</span>
                <span className="block text-[11px] text-zinc-500">Launch a new project repository</span>
              </button>

              <Link
                href="/teams"
                onClick={() => setCreateOpen(false)}
                className="block rounded-lg px-3 py-2 hover:bg-zinc-900 transition-colors"
              >
                <span className="block text-xs font-semibold text-white">Team</span>
                <span className="block text-[11px] text-zinc-500">Gather builders together</span>
              </Link>

              <div className="mt-1 border-t border-zinc-800/80 pt-1 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Collaboration
              </div>
              <Link
                href="/chat"
                onClick={() => setCreateOpen(false)}
                className="block rounded-lg px-3 py-2 hover:bg-zinc-900 transition-colors"
              >
                <span className="block text-xs font-semibold text-white">Discussion</span>
                <span className="block text-[11px] text-zinc-500">Start a public thread</span>
              </Link>
              <Link
                href="/projects"
                onClick={() => setCreateOpen(false)}
                className="block rounded-lg px-3 py-2 hover:bg-zinc-900 transition-colors"
              >
                <span className="block text-xs font-semibold text-white">Explore Directory</span>
                <span className="block text-[11px] text-zinc-500">Browse all public projects</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Live Status Strip — Always real database queries */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 border-t border-zinc-800/70 pt-4 text-xs">
        {[
          { label: "active builds", value: stats.activeBuilds },
          { label: "updated recently", value: stats.updatedRecently },
          { label: "collaboration opportunities", value: stats.openOpportunities },
          { label: "launches & moments", value: stats.launchesAndMoments },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-2 border border-zinc-800/50"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                s.value > 0 ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
              }`}
            />
            <span className="font-bold text-white">
              {isLoading ? "…" : s.value}
            </span>
            <span className="text-zinc-500 truncate">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

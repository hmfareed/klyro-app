"use client";

import Link from "next/link";
import { FolderGit2, Compass, Handshake, Search, Plus } from "lucide-react";
import { openCreateProjectModal } from "@/components/workspace/WorkspaceCreateProjectModal";
import { BuildstreamTab } from "@/server/buildstream";

interface BuildstreamEmptyStateProps {
  tab: BuildstreamTab;
  searchQuery?: string;
  onClearSearch?: () => void;
  onExplore?: () => void;
}

export function BuildstreamEmptyState({
  tab,
  searchQuery,
  onClearSearch,
  onExplore,
}: BuildstreamEmptyStateProps) {
  if (searchQuery) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-12 text-center shadow-sm">
        <Search size={36} className="mx-auto text-zinc-600 mb-3" />
        <h3 className="text-base font-semibold text-white">
          No results for &ldquo;{searchQuery}&rdquo;
        </h3>
        <p className="mt-2 text-xs text-zinc-400 max-w-sm mx-auto">
          Try searching by project titles, builder usernames, technologies (e.g. Next.js, Rust), or repositories.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          {onClearSearch && (
            <button
              onClick={onClearSearch}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors cursor-pointer"
            >
              Clear search
            </button>
          )}
          <button
            onClick={openCreateProjectModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            <Plus size={14} /> Start this build
          </button>
        </div>
      </div>
    );
  }

  if (tab === "following") {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-12 text-center shadow-sm">
        <Compass size={36} className="mx-auto text-indigo-400/80 mb-3" />
        <h3 className="text-base font-semibold text-white">
          You&apos;re not following any builds yet
        </h3>
        <p className="mt-2 text-xs text-zinc-400 max-w-sm mx-auto">
          Follow projects you care about to see their releases, milestones, updates, and discussions right here.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Link
            href="/projects"
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
          >
            Discover Projects
          </Link>
          <button
            onClick={openCreateProjectModal}
            className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            Start a Build
          </button>
        </div>
      </div>
    );
  }

  if (tab === "my-builds") {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-12 text-center shadow-sm">
        <FolderGit2 size={36} className="mx-auto text-purple-400/80 mb-3" />
        <h3 className="text-base font-semibold text-white">
          You haven&apos;t started or joined any builds yet
        </h3>
        <p className="mt-2 text-xs text-zinc-400 max-w-sm mx-auto">
          Create a new project repository or join an existing build team to see your contributions here.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={openCreateProjectModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            <Plus size={14} /> Create Project
          </button>
          <Link
            href="/projects"
            className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
          >
            Explore Directory
          </Link>
        </div>
      </div>
    );
  }

  if (tab === "opportunities") {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-12 text-center shadow-sm">
        <Handshake size={36} className="mx-auto text-emerald-400/80 mb-3" />
        <h3 className="text-base font-semibold text-white">
          No matching collaboration calls right now
        </h3>
        <p className="mt-2 text-xs text-zinc-400 max-w-sm mx-auto">
          Check back soon or create your own project and open roles for contributors to apply.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={openCreateProjectModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors cursor-pointer"
          >
            <Plus size={14} /> Open Roles on a Build
          </button>
        </div>
      </div>
    );
  }

  /* Default "Everything" empty state: Platform launch with 0 events */
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-12 text-center shadow-sm">
      <FolderGit2 size={36} className="mx-auto text-zinc-600 mb-3" />
      <h3 className="text-base font-semibold text-white">Your Buildstream is quiet</h3>
      <p className="mt-2 text-xs text-zinc-400 max-w-sm mx-auto">
        Start building something or discover a project to contribute to. As projects launch, milestones complete, and releases drop, the stream will come alive.
      </p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <button
          onClick={openCreateProjectModal}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors cursor-pointer"
        >
          <Plus size={14} /> Create Project
        </button>
        <Link
          href="/projects"
          className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
        >
          Explore Builds
        </Link>
      </div>
    </div>
  );
}

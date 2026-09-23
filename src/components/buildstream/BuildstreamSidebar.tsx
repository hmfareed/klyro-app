"use client";

import Link from "next/link";
import { Flame, ArrowUpRight, CheckSquare, FileText, Bell, Users, Compass } from "lucide-react";
import { BuildstreamPayload } from "@/server/buildstream";

interface BuildstreamSidebarProps {
  pulse: BuildstreamPayload["pulse"];
  trending: BuildstreamPayload["trending"];
  opportunities: BuildstreamPayload["opportunities"];
  recommendedBuilders: BuildstreamPayload["recommendedBuilders"];
  radar: BuildstreamPayload["radar"];
  onSelectCategory: (category: string) => void;
  onApplyRole?: (slug: string, title: string) => void;
}

function initialsFor(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "DV";
}

export function BuildstreamSidebar({
  pulse,
  trending,
  opportunities,
  recommendedBuilders,
  radar,
  onSelectCategory,
  onApplyRole,
}: BuildstreamSidebarProps) {
  return (
    <aside className="space-y-4 min-w-0">
      {/* ── 1. Your Pulse ── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
            Your Pulse
          </h3>
          <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
        </div>

        <div className="mt-3 space-y-2 text-xs">
          <Link
            href="/projects"
            className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-zinc-900 transition-colors"
          >
            <span className="flex items-center gap-2 text-zinc-400">
              <CheckSquare size={13} className="text-zinc-500" /> Tasks assigned
            </span>
            <span className="font-semibold text-white">{pulse.assignedTasks}</span>
          </Link>

          <Link
            href="/projects"
            className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-zinc-900 transition-colors"
          >
            <span className="flex items-center gap-2 text-zinc-400">
              <FileText size={13} className="text-zinc-500" /> Pending applications
            </span>
            <span className="font-semibold text-white">{pulse.pendingApplications}</span>
          </Link>

          <Link
            href="/repositories"
            className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-zinc-900 transition-colors"
          >
            <span className="flex items-center gap-2 text-zinc-400">
              <Users size={13} className="text-zinc-500" /> My builds
            </span>
            <span className="font-semibold text-white">{pulse.myBuilds}</span>
          </Link>

          <div className="flex items-center justify-between rounded-lg px-2 py-1.5">
            <span className="flex items-center gap-2 text-zinc-400">
              <Compass size={13} className="text-zinc-500" /> Builds followed
            </span>
            <span className="font-semibold text-white">{pulse.followingCount}</span>
          </div>

          <div className="flex items-center justify-between rounded-lg px-2 py-1.5 border-t border-zinc-800/60 pt-2">
            <span className="flex items-center gap-2 text-zinc-400">
              <Bell size={13} className="text-zinc-500" /> Unread notifications
            </span>
            <span className="font-semibold text-white">{pulse.unreadNotifications}</span>
          </div>
        </div>
      </div>

      {/* ── 2. Open Opportunities ── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
            Collaboration calls
          </h3>
          <Flame size={14} className="text-orange-400" />
        </div>

        <div className="mt-3 space-y-2">
          {opportunities.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center">
              <p className="text-xs text-zinc-500">No open calls right now.</p>
              <p className="mt-1 text-[11px] text-zinc-600">
                Launch a project and open a role to invite contributors.
              </p>
            </div>
          ) : (
            opportunities.map((opp) => (
              <div
                key={opp.id}
                className="rounded-xl border border-zinc-800 bg-black/50 p-3 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                    {opp.roleTitle}
                  </span>
                  {onApplyRole && (
                    <button
                      onClick={() => onApplyRole(opp.slug, opp.projectTitle)}
                      className="text-[10px] font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                    >
                      Apply
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs font-semibold text-white truncate">{opp.projectTitle}</p>
                {opp.techStack.length > 0 && (
                  <p className="mt-0.5 text-[11px] text-zinc-500 truncate">
                    {opp.techStack.slice(0, 3).join(" · ")}
                  </p>
                )}
                <Link
                  href={`/repositories/${opp.slug}`}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  View build <ArrowUpRight size={12} />
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── 3. Trending Builds ── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-sm">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
          Trending builds
        </h3>

        {trending.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed border-zinc-800 p-4 text-center">
            <p className="text-xs text-zinc-500">No trending builds yet.</p>
            <p className="mt-1 text-[11px] text-zinc-600">Be the first to launch and build in public!</p>
          </div>
        ) : (
          <>
            <ol className="mt-3 space-y-2">
              {trending.map((p, i) => (
                <li key={p.id}>
                  <Link
                    href={`/repositories/${p.slug}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-zinc-900 transition-colors group"
                  >
                    <span className="text-[11px] font-bold text-zinc-600 w-5">0{i + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-xs font-semibold text-white group-hover:text-indigo-300">
                        {p.title}
                      </span>
                      <span className="block text-[10px] text-zinc-500">
                        {p.reason}
                      </span>
                    </span>
                    <ArrowUpRight size={13} className="text-zinc-600 group-hover:text-indigo-400" />
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-2 text-[10px] text-zinc-600">
              Ranked by stars, contributors, and recent updates.
            </p>
          </>
        )}
      </div>

      {/* ── 4. People You May Build With ── */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-sm">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
          Builders you may know
        </h3>

        <div className="mt-3 space-y-2">
          {recommendedBuilders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-4 text-center">
              <p className="text-xs text-zinc-500">No other builders active yet.</p>
            </div>
          ) : (
            recommendedBuilders.map((b) => {
              const name = b.displayName || b.username;
              return (
                <div
                  key={b.id}
                  className="flex items-center gap-2.5 rounded-xl border border-zinc-800/70 bg-black/40 p-2.5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-[10px] font-bold text-white shadow-inner">
                    {initialsFor(name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-xs font-semibold text-white">{name}</span>
                    <span className="block truncate text-[10px] text-zinc-500">
                      {b.skills.length > 0 ? b.skills.join(" · ") : `@${b.username}`}
                      {b.sharedCount > 0 && ` · ${b.sharedCount} shared stack`}
                    </span>
                  </div>
                  <Link
                    href={`/u/${b.username}`}
                    className="shrink-0 rounded-lg border border-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-300 hover:text-white hover:border-zinc-600 transition-colors"
                  >
                    Profile
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── 5. Build Radar / Categories ── */}
      {radar.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-sm">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
            Build radar
          </h3>
          <div className="mt-3 space-y-1.5">
            {radar.map(({ category, count }) => (
              <button
                key={category}
                onClick={() => onSelectCategory(category)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-zinc-900 transition-colors group cursor-pointer"
                title={`Filter stream by ${category}`}
              >
                <span className="text-zinc-300 group-hover:text-white">{category}</span>
                <span className="text-[11px] text-zinc-500">
                  {count} build{count === 1 ? "" : "s"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

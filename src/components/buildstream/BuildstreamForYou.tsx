"use client";

import { Search, X } from "lucide-react";

interface BuildstreamForYouProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeTechs: string[];
  skillMatches: number;
  lookingCount: number;
  updatedCount: number;
}

export function BuildstreamForYou({
  searchQuery,
  onSearchChange,
  activeTechs,
  skillMatches,
  lookingCount,
  updatedCount,
}: BuildstreamForYouProps) {
  const displayTechs =
    activeTechs.length > 0 ? activeTechs.join(" · ") : "TypeScript · Next.js · React";

  return (
    <div className="mb-5 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-zinc-950 to-zinc-950 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-300">
            For you
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Matched to your stack:{" "}
            <span className="text-zinc-200 font-medium">{displayTechs}</span>
          </p>
        </div>

        {/* Global Search Input */}
        <div className="relative w-full sm:w-80">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects, creators, technologies..."
            className="w-full rounded-xl border border-zinc-800 bg-black py-2 pl-9 pr-8 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/60 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl border border-zinc-800 bg-black/50 px-3 py-2.5">
          <span className="font-bold text-white">{skillMatches}</span>{" "}
          <span className="text-zinc-400">builds match your stack</span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-black/50 px-3 py-2.5">
          <span className="font-bold text-white">{lookingCount}</span>{" "}
          <span className="text-zinc-400">open collaboration calls</span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-black/50 px-3 py-2.5">
          <span className="font-bold text-white">{updatedCount}</span>{" "}
          <span className="text-zinc-400">projects active recently</span>
        </div>
      </div>
    </div>
  );
}

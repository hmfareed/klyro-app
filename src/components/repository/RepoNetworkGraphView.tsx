"use client";

import { useEffect, useState, useMemo } from "react";
import {
  GitCommit,
  GitBranch,
  Tag,
  Copy,
  Check,
  ArrowRight,
  User,
  Filter,
  Layers,
  ChevronDown,
  RefreshCw,
  Search,
} from "lucide-react";
import Link from "next/link";

interface RepoNetworkGraphViewProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  onSelectCommit: (sha: string) => void;
  onSelectBranch?: (branch: string) => void;
}

export function RepoNetworkGraphView({
  owner,
  repo,
  defaultBranch,
  onSelectCommit,
  onSelectBranch,
}: RepoNetworkGraphViewProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRef, setSelectedRef] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredSha, setHoveredSha] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [branchDropdown, setBranchDropdown] = useState(false);

  const fetchGraph = (refTarget = selectedRef) => {
    setLoading(true);
    fetch(`/api/v1/repositories/${owner}/${repo}/network?ref=${encodeURIComponent(refTarget)}&limit=150`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data) {
          setData(d.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchGraph(selectedRef);
  }, [owner, repo, selectedRef]);

  const copySha = (sha: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  const nodes = data?.nodes || [];
  const links = data?.links || [];
  const branches = data?.branches || [];
  const totalLanes = data?.totalLanes || 1;
  const dimensions = data?.dimensions || { width: 100, height: 100, laneWidth: 24, rowHeight: 52 };

  // Filter nodes if search query present
  const filteredIndices = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase().trim();
    const set = new Set<string>();
    nodes.forEach((n: any) => {
      if (
        n.message.toLowerCase().includes(q) ||
        n.sha.toLowerCase().includes(q) ||
        n.author.name.toLowerCase().includes(q)
      ) {
        set.add(n.sha);
      }
    });
    return set;
  }, [nodes, searchQuery]);

  // Connected links for hovered commit
  const activeLinkIds = useMemo(() => {
    if (!hoveredSha) return new Set<string>();
    const ids = new Set<string>();
    links.forEach((l: any) => {
      if (l.fromSha === hoveredSha || l.toSha === hoveredSha) {
        ids.add(l.id);
      }
    });
    return ids;
  }, [hoveredSha, links]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#090d1f]">
      {/* Top Controls Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 px-6 py-3.5 bg-black/40">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Network Graph</h2>
          </div>

          {/* Branch / Ref Filter Selector */}
          <div className="relative">
            <button
              onClick={() => setBranchDropdown(!branchDropdown)}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <GitBranch size={13} className="text-indigo-400" />
              <span>{selectedRef === "all" ? "All branches" : selectedRef}</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {branchDropdown && (
              <div
                className="absolute left-0 top-full mt-1.5 w-56 rounded-xl border border-white/10 bg-zinc-950 p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 divide-y divide-white/5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-1">
                  <button
                    onClick={() => {
                      setSelectedRef("all");
                      setBranchDropdown(false);
                    }}
                    className={`flex items-center justify-between w-full rounded-lg px-2.5 py-1.5 text-xs text-left cursor-pointer ${
                      selectedRef === "all"
                        ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                        : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Layers size={13} className="text-indigo-400" /> All branches
                    </span>
                    {selectedRef === "all" && <Check size={13} className="text-indigo-400" />}
                  </button>
                </div>

                <div className="p-1 max-h-48 overflow-y-auto space-y-0.5">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Branches
                  </div>
                  {branches.map((bName: string) => (
                    <button
                      key={bName}
                      onClick={() => {
                        setSelectedRef(bName);
                        setBranchDropdown(false);
                      }}
                      className={`flex items-center justify-between w-full rounded-lg px-2.5 py-1.5 text-xs text-left cursor-pointer truncate ${
                        selectedRef === bName
                          ? "bg-indigo-600/20 text-indigo-300 font-semibold"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <GitBranch size={13} className="text-indigo-400 shrink-0" />
                        <span className="truncate">{bName}</span>
                        {bName === defaultBranch && (
                          <span className="rounded bg-indigo-950 px-1 py-0.2 text-[9px] text-indigo-300 font-normal">
                            default
                          </span>
                        )}
                      </span>
                      {selectedRef === bName && <Check size={13} className="text-indigo-400 shrink-0 ml-1" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick stats pills */}
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-300">
              {nodes.length} commits
            </span>
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-slate-300">
              {totalLanes} visual {totalLanes === 1 ? "lane" : "lanes"}
            </span>
          </div>
        </div>

        {/* Search filter input */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter commits or SHA…"
              className="w-48 sm:w-64 rounded-xl border border-white/10 bg-white/5 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            onClick={() => fetchGraph(selectedRef)}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Refresh graph"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center p-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <span className="text-xs text-slate-400">Rendering Git topological tree…</span>
          </div>
        </div>
      ) : nodes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-12 text-center">
          <div className="max-w-sm rounded-2xl border border-white/10 bg-white/[0.02] p-8 space-y-3">
            <GitCommit size={28} className="mx-auto text-slate-500" />
            <h3 className="text-sm font-semibold text-white">No commits found</h3>
            <p className="text-xs text-slate-400">
              This repository or selected branch has no commit history yet.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <div className="flex min-w-[760px] relative">
            {/* 1. Left SVG Track Rails (Lanes & Links) */}
            <div
              className="shrink-0 relative select-none"
              style={{ width: `${Math.max(dimensions.width, 70)}px`, height: `${dimensions.height}px` }}
            >
              <svg
                width={Math.max(dimensions.width, 70)}
                height={dimensions.height}
                className="absolute inset-0 pointer-events-none"
              >
                {/* Background lane guide rails */}
                {Array.from({ length: totalLanes }).map((_, lIdx) => {
                  const railX = lIdx * dimensions.laneWidth + 18;
                  return (
                    <line
                      key={`rail-${lIdx}`}
                      x1={railX}
                      y1={0}
                      x2={railX}
                      y2={dimensions.height}
                      stroke="rgba(255, 255, 255, 0.03)"
                      strokeWidth={1}
                      strokeDasharray="2 4"
                    />
                  );
                })}

                {/* Graph Edge Links (Cubic Bezier curves and straight rails) */}
                {links.map((link: any) => {
                  const isHovered = activeLinkIds.has(link.id);
                  return (
                    <path
                      key={link.id}
                      d={link.pathD}
                      fill="none"
                      stroke={link.color}
                      strokeWidth={isHovered ? 2.5 : 2}
                      strokeOpacity={hoveredSha ? (isHovered ? 1 : 0.25) : 0.8}
                      className="transition-all duration-150"
                    />
                  );
                })}

                {/* Commit Nodes */}
                {nodes.map((node: any) => {
                  const isHovered = hoveredSha === node.sha;
                  const isMatched = !filteredIndices || filteredIndices.has(node.sha);
                  const isMerge = node.parents.length > 1;

                  return (
                    <g key={node.sha} className="transition-all duration-150">
                      {/* Outer glow ring on hover */}
                      {isHovered && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={isMerge ? 9 : 7.5}
                          fill="none"
                          stroke={node.color}
                          strokeWidth={2}
                          strokeOpacity={0.6}
                        />
                      )}

                      {/* Main node circle */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={isMerge ? 5.5 : 4}
                        fill={isMatched ? node.color : "#475569"}
                        stroke="#090d1f"
                        strokeWidth={2}
                        opacity={hoveredSha && !isHovered && !activeLinkIds.size ? 0.4 : 1}
                      />

                      {/* Merge node inner dot */}
                      {isMerge && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={2}
                          fill="#ffffff"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* 2. Right Aligned Commit Rows */}
            <div className="flex-1 flex flex-col divide-y divide-white/5">
              {nodes.map((node: any, idx: number) => {
                const isHovered = hoveredSha === node.sha;
                const isMatched = !filteredIndices || filteredIndices.has(node.sha);

                return (
                  <div
                    key={node.sha}
                    style={{ height: `${dimensions.rowHeight}px` }}
                    onMouseEnter={() => setHoveredSha(node.sha)}
                    onMouseLeave={() => setHoveredSha(null)}
                    onClick={() => onSelectCommit(node.sha)}
                    className={`flex items-center justify-between px-4 transition-colors cursor-pointer group ${
                      isHovered
                        ? "bg-white/[0.06]"
                        : isMatched
                        ? "hover:bg-white/[0.03]"
                        : "opacity-35 hover:opacity-75"
                    }`}
                  >
                    {/* Left: Message + Ref Badges + Author */}
                    <div className="flex items-center gap-3 min-w-0 pr-4">
                      {/* Ref Badges (Branches & Tags) */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        {node.refs.isHead && (
                          <span className="rounded bg-rose-950/80 border border-rose-600/50 px-1.5 py-0.5 text-[9px] font-bold text-rose-300 uppercase tracking-wider">
                            HEAD
                          </span>
                        )}

                        {node.refs.branches.map((bName: string) => (
                          <span
                            key={bName}
                            onClick={(e) => {
                              if (onSelectBranch) {
                                e.stopPropagation();
                                onSelectBranch(bName);
                              }
                            }}
                            className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold border ${
                              bName === defaultBranch
                                ? "border-indigo-500/50 bg-indigo-950/70 text-indigo-300"
                                : "border-emerald-500/50 bg-emerald-950/70 text-emerald-300"
                            }`}
                          >
                            <GitBranch size={10} />
                            <span>{bName}</span>
                          </span>
                        ))}

                        {node.refs.tags.map((tName: string) => (
                          <span
                            key={tName}
                            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono font-semibold border border-amber-500/50 bg-amber-950/70 text-amber-300"
                          >
                            <Tag size={10} />
                            <span>{tName}</span>
                          </span>
                        ))}
                      </div>

                      {/* Commit Message */}
                      <span className="text-xs font-medium text-white group-hover:text-indigo-300 transition-colors truncate">
                        {node.message}
                      </span>

                      {/* Author & Timestamp */}
                      <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400 shrink-0">
                        <span className="text-slate-500">by</span>
                        <span className="text-slate-300 font-medium">{node.author.name}</span>
                        <span className="text-slate-500">· {node.author.relativeDate}</span>
                      </div>
                    </div>

                    {/* Right: Parents indicator, SHA, Action button */}
                    <div className="flex items-center gap-2 shrink-0">
                      {node.parents.length > 1 && (
                        <span className="rounded-md bg-white/5 border border-white/10 px-1.5 py-0.5 text-[10px] font-mono text-purple-300">
                          merge
                        </span>
                      )}

                      <button
                        onClick={(e) => copySha(node.sha, e)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1"
                        title="Copy commit SHA"
                      >
                        <span>{node.shortSha}</span>
                        {copiedSha === node.sha ? (
                          <Check size={11} className="text-emerald-400" />
                        ) : (
                          <Copy size={11} className="text-slate-500" />
                        )}
                      </button>

                      <div className="text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all">
                        <ArrowRight size={13} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

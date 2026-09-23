"use client";

import { useState } from "react";
import {
  Code,
  CircleDot,
  GitPullRequest,
  PlaySquare,
  Tag,
  Settings,
  Star,
  Eye,
  GitFork,
  Lock,
  Globe,
  Copy,
  Check,
  Download,
  Terminal,
  Archive,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";

interface RepoHeaderProps {
  repository: any;
  viewer: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onStarToggle: () => void;
  onWatchToggle: () => void;
  onFork: () => void;
  onRestore?: () => void;
}

export function RepoHeader({
  repository,
  viewer,
  activeTab,
  onTabChange,
  onStarToggle,
  onWatchToggle,
  onFork,
  onRestore,
}: RepoHeaderProps) {
  const [showCodeMenu, setShowCodeMenu] = useState(false);
  const [cloneMode, setCloneMode] = useState<"https" | "ssh">("https");
  const [copied, setCopied] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await fetch(`/api/v1/repositories/${repository.owner.username}/${repository.slug}/restore`, {
        method: "POST",
      });
      if (res.ok && onRestore) {
        onRestore();
      }
    } catch {} finally {
      setRestoring(false);
    }
  };

  const purgeTime = repository.purgeAt ? new Date(repository.purgeAt).getTime() : Date.now() + 30 * 24 * 60 * 60 * 1000;
  const daysRemaining = Math.max(0, Math.ceil((purgeTime - Date.now()) / (1000 * 60 * 60 * 24)));

  const appUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const httpsUrl = `${appUrl}/${repository.owner.username}/${repository.slug}.git`;
  const sshUrl = `git@klyro.dev:${repository.owner.username}/${repository.slug}.git`;
  const currentCloneUrl = cloneMode === "https" ? httpsUrl : sshUrl;

  const copyCloneUrl = () => {
    navigator.clipboard.writeText(currentCloneUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TABS = [
    { id: "code", label: "Code", icon: Code, count: undefined },
    { id: "issues", label: "Issues", icon: CircleDot, count: repository._count?.issues },
    { id: "pulls", label: "Pull Requests", icon: GitPullRequest, count: repository._count?.pullRequests },
    { id: "actions", label: "Actions", icon: PlaySquare, count: undefined },
    { id: "releases", label: "Releases", icon: Tag, count: repository._count?.releases },
    ...(viewer.canAdmin ? [{ id: "settings", label: "Settings", icon: Settings, count: undefined }] : []),
  ];

  return (
    <div className="border-b border-white/10 bg-[#090d1f] px-6 pt-5 pb-0">
      {/* 1. Deletion Pending Alert Banner */}
      {repository.status === "DELETION_PENDING" && (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-2.5 flex items-center justify-between text-xs text-red-200">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
            <span>
              <strong>Repository scheduled for deletion.</strong> It will be permanently purged in{" "}
              <strong>{daysRemaining} day{daysRemaining === 1 ? "" : "s"}</strong>
              {repository.purgeAt ? ` (${new Date(repository.purgeAt).toLocaleDateString()})` : ""}. Only owners can view this repository.
            </span>
          </div>
          {viewer.canAdmin && (
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-500 disabled:opacity-50 shrink-0 ml-4 cursor-pointer"
            >
              <RotateCcw size={12} />
              {restoring ? "Restoring…" : "Restore repository"}
            </button>
          )}
        </div>
      )}

      {/* 2. Archived Banner */}
      {repository.archived && repository.status !== "DELETION_PENDING" && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-2.5 flex items-center gap-2 text-xs text-amber-200">
          <Archive size={15} className="text-amber-400 shrink-0" />
          <span>
            <strong>This repository has been archived by the owner.</strong> It is now read-only. Pushes, new issues, and pull request changes are disabled.
          </span>
        </div>
      )}

      {/* Top Identity & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          {/* Breadcrumb path */}
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1 flex-wrap">
            <span className="hover:text-white transition-colors">{repository.owner.username}</span>
            <span>/</span>
            <span className="font-bold text-base text-white">{repository.name}</span>
            <span className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300 ml-1">
              {repository.visibility === "PRIVATE" ? <Lock size={10} /> : <Globe size={10} />}
              {repository.visibility}
            </span>

            {repository.archived && (
              <span className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                <Archive size={10} /> Archived
              </span>
            )}

            {repository.status === "DELETION_PENDING" && (
              <span className="flex items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                <AlertTriangle size={10} /> Pending Deletion
              </span>
            )}
          </div>

          {repository.forkedFrom && (
            <p className="text-[11px] text-slate-500 mb-1">
              forked from{" "}
              <Link
                href={`/repositories/${repository.forkedFrom.owner.username}/${repository.forkedFrom.slug}`}
                className="text-indigo-400 hover:underline"
              >
                {repository.forkedFrom.owner.username}/{repository.forkedFrom.name}
              </Link>
            </p>
          )}

          {repository.description && (
            <p className="text-xs text-slate-300 mt-1 line-clamp-1">{repository.description}</p>
          )}
        </div>

        {/* Action Buttons: Watch, Fork, Star, Code Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Watch Button */}
          <button
            onClick={onWatchToggle}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
              viewer.isWatching
                ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Eye size={13} />
            <span>{viewer.isWatching ? "Watching" : "Watch"}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] font-bold text-slate-300 ml-0.5">
              {repository._count?.watchers || 0}
            </span>
          </button>

          {/* Fork Button */}
          <button
            onClick={onFork}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-all"
          >
            <GitFork size={13} />
            <span>Fork</span>
            <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] font-bold text-slate-300 ml-0.5">
              {repository._count?.forks || 0}
            </span>
          </button>

          {/* Star Button */}
          <button
            onClick={onStarToggle}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
              viewer.isStarred
                ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Star size={13} className={viewer.isStarred ? "fill-amber-400 text-amber-400" : ""} />
            <span>{viewer.isStarred ? "Starred" : "Star"}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] font-bold text-slate-300 ml-0.5">
              {repository._count?.stars || 0}
            </span>
          </button>

          {/* Code Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowCodeMenu(!showCodeMenu)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-indigo-500 transition-all cursor-pointer"
            >
              <Code size={13} />
              <span>Code</span>
              <span className="text-[10px]">▼</span>
            </button>

            {showCodeMenu && (
              <div
                className="absolute right-0 top-full mt-2 w-80 rounded-2xl border border-white/10 bg-zinc-950 p-4 shadow-2xl z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Terminal size={14} className="text-indigo-400" /> Clone repository
                  </span>
                  <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
                    <button
                      onClick={() => setCloneMode("https")}
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                        cloneMode === "https" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      HTTPS
                    </button>
                    <button
                      onClick={() => setCloneMode("ssh")}
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                        cloneMode === "ssh" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      SSH
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-2 mb-2">
                  <input
                    type="text"
                    readOnly
                    value={currentCloneUrl}
                    className="w-full bg-transparent font-mono text-[11px] text-slate-300 focus:outline-none select-all"
                  />
                  <button
                    onClick={copyCloneUrl}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>

                {cloneMode === "https" ? (
                  <div className="mb-3 rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-2.5 text-[11px] text-indigo-300">
                    <p className="font-semibold text-white mb-0.5">HTTPS Authentication:</p>
                    <p className="text-slate-400 text-[10px] leading-relaxed">
                      Use your Klyro username and a{" "}
                      <Link href="/settings/tokens" className="text-indigo-400 underline hover:text-indigo-300 font-medium">
                        Personal Access Token (PAT)
                      </Link>{" "}
                      as your password when pushing or cloning private repos.
                    </p>
                  </div>
                ) : (
                  <div className="mb-3 rounded-xl border border-emerald-500/20 bg-emerald-950/30 p-2.5 text-[11px] text-emerald-300">
                    <p className="font-semibold text-white mb-0.5">SSH Authentication:</p>
                    <p className="text-slate-400 text-[10px] leading-relaxed">
                      Requires an SSH key added to your profile. Manage keys in{" "}
                      <Link href="/settings/ssh-keys" className="text-emerald-400 underline hover:text-emerald-300 font-medium">
                        SSH Key Settings
                      </Link>.
                    </p>
                  </div>
                )}

                <a
                  href={`/api/v1/repositories/${repository.owner.username}/${repository.slug}/archive-zip?ref=${repository.defaultBranch}`}
                  className="flex items-center justify-center gap-2 w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Download size={14} /> Download ZIP
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                active ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.2 text-[10px] font-bold text-slate-300">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  User,
  Pin,
  Clock,
  BarChart2,
  Code2,
  FolderGit2,
  Link2,
  Star,
  GitFork,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  Users,
  UserCheck,
  Globe,
  GitPullRequest,
  GitCommit,
  Sparkles,
} from "lucide-react";

function GithubIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function LinkedinIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function TwitterIcon({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 4l11.733 16h4.267l-11.733-16z" />
      <path d="M4 20l6.768-6.768m2.464-2.464l6.768-6.768" />
    </svg>
  );
}
import Link from "next/link";
import type { ProfileUser } from "./ProfileHeader";
import type { ProfileTab } from "./ProfileTabs";

type OverviewTabProps = {
  user: ProfileUser;
  isOwner: boolean;
  onNavigateTab: (tab: ProfileTab) => void;
  onEditProfile: () => void;
};

export function OverviewTab({
  user,
  isOwner,
  onNavigateTab,
  onEditProfile,
}: OverviewTabProps) {
  const [aboutExpanded, setAboutExpanded] = useState(false);

  // Repositories user owns or contributes to
  const owned = user.projectsOwned || [];
  const member = user.memberships || [];
  const allRepos = [
    ...owned.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      tagline: p.tagline,
      description: p.description,
      status: p.status,
      visibility: p.visibility,
      techStack: p.techStack || [],
      updatedAt: p.updatedAt,
      isOwner: true,
    })),
    ...member.map((m) => ({
      id: m.project.id,
      slug: m.project.slug,
      title: m.project.title,
      tagline: m.project.tagline,
      description: "",
      status: m.project.status,
      visibility: m.project.visibility,
      techStack: m.project.techStack || [],
      updatedAt: m.project.updatedAt,
      isOwner: false,
    })),
  ];

  // Up to 4 pinned / featured repos (only if user actually has repos)
  const pinnedRepos = allRepos.slice(0, 4);

  // Up to 4 recent repos for sidebar
  const recentRepos = allRepos.slice(0, 4);

  // Skills
  const skills = user.skills || [];

  // Social links configuration
  const socialLinks: Array<{ name: string; url: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = [];

  if (user.githubUsername) {
    socialLinks.push({
      name: "GitHub",
      url: `https://github.com/${user.githubUsername.replace(/^@/, "")}`,
      icon: GithubIcon,
    });
  }

  if (user.websiteUrl) {
    const isLinkedIn = user.websiteUrl.includes("linkedin.com");
    const isTwitter = user.websiteUrl.includes("twitter.com") || user.websiteUrl.includes("x.com");
    if (isLinkedIn) {
      socialLinks.push({ name: "LinkedIn", url: user.websiteUrl, icon: LinkedinIcon });
    } else if (isTwitter) {
      socialLinks.push({ name: "X (Twitter)", url: user.websiteUrl, icon: TwitterIcon });
    } else {
      socialLinks.push({ name: "Website", url: user.websiteUrl, icon: Globe });
    }
  }

  // Activity items derived from real user data (e.g. joined date, projects created)
  const activityItems: Array<{
    id: string;
    type: "project" | "team" | "joined";
    title: string;
    detail?: string;
    time: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }> = [];

  if (owned.length > 0) {
    owned.slice(0, 2).forEach((p) => {
      activityItems.push({
        id: `proj-${p.id}`,
        type: "project",
        title: `Created a new repository`,
        detail: p.title,
        time: formatRelativeTime(p.createdAt),
        icon: FolderGit2,
      });
    });
  }

  if (member.length > 0) {
    member.slice(0, 2).forEach((m) => {
      activityItems.push({
        id: `team-${m.id}`,
        type: "team",
        title: `Joined ${m.project.title} as ${m.role.title}`,
        time: formatRelativeTime(m.joinedAt),
        icon: Users,
      });
    });
  }

  if (user.createdAt) {
    activityItems.push({
      id: "joined-klyro",
      type: "joined",
      title: "Joined the Klyro community",
      time: formatRelativeTime(user.createdAt),
      icon: Sparkles,
    });
  }

  // Format relative time helper
  function formatRelativeTime(dateInput: string | Date | undefined) {
    if (!dateInput) return "recently";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "recently";
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="mt-8 px-4 sm:px-8 pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ======================================================== */}
        {/* LEFT COLUMN: About me, Pinned Repos, Recent Activity */}
        {/* ======================================================== */}
        <div className="lg:col-span-8 space-y-6">
          {/* Card 1: About me */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <User size={18} className="text-indigo-400" />
                <span>About me</span>
              </h2>

              {isOwner && (
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {user.about ? (
              <div className="space-y-4">
                <div
                  className={`text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap ${
                    !aboutExpanded ? "line-clamp-4" : ""
                  }`}
                >
                  {user.about}
                </div>

                {user.about.length > 220 && (
                  <button
                    type="button"
                    onClick={() => setAboutExpanded(!aboutExpanded)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <span>{aboutExpanded ? "View less" : "View more"}</span>
                    {aboutExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
              </div>
            ) : isOwner ? (
              <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center">
                <p className="text-xs text-zinc-400">
                  You haven&apos;t added an &quot;About me&quot; story yet. Tell collaborators about your background, what you love building, and what you&apos;re looking to learn.
                </p>
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-semibold text-indigo-400 hover:bg-zinc-800 transition-colors"
                >
                  <Plus size={13} /> Add About Story
                </button>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 italic">No about description provided.</p>
            )}

            {/* Tech Stack / Skill Pills inside About Card */}
            {skills.length > 0 && (
              <div className="mt-5 pt-5 border-t border-zinc-900 flex flex-wrap gap-2">
                {skills.map((s) => (
                  <span
                    key={s.skillId}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-zinc-700 transition-colors"
                  >
                    {s.skill.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Pinned Repositories */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <Pin size={18} className="text-indigo-400" />
                <span>Pinned Repositories</span>
              </h2>

              {pinnedRepos.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateTab("repositories")}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  View all
                </button>
              )}
            </div>

            {/* DYNAMIC: If user has repos, render cards. If NOT, render clean empty state */}
            {pinnedRepos.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {pinnedRepos.map((repo) => (
                  <Link
                    key={repo.id}
                    href={`/repositories/${repo.slug}`}
                    className="group flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-black p-4 hover:border-indigo-500/50 hover:bg-zinc-900/40 transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FolderGit2
                            size={16}
                            className="text-indigo-400 shrink-0 group-hover:text-indigo-300 transition-colors"
                          />
                          <span className="font-semibold text-sm text-zinc-100 group-hover:text-indigo-400 transition-colors truncate">
                            {repo.title}
                          </span>
                        </div>
                        <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-zinc-400 shrink-0">
                          {repo.visibility || "Public"}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                        {repo.tagline || repo.description || "No description provided."}
                      </p>
                    </div>

                    <div>
                      {/* Tech stack tags */}
                      {repo.techStack && repo.techStack.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {repo.techStack.slice(0, 3).map((tech) => (
                            <span
                              key={tech}
                              className="rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-400"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Footer: Stars, Forks, Updated */}
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-900">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 hover:text-amber-400 transition-colors">
                            <Star size={12} />
                            <span>0</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <GitFork size={12} />
                            <span>0</span>
                          </span>
                        </div>
                        <span>Updated {formatRelativeTime(repo.updatedAt)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              /* CLEAN SUPER AMOLED EMPTY STATE FOR PINNED REPOS */
              <div className="rounded-xl border border-dashed border-zinc-800 bg-black/40 py-10 px-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-indigo-400 mb-3 shadow-inner">
                  <Pin size={22} />
                </div>
                <h3 className="text-sm font-semibold text-zinc-200">No pinned repositories yet</h3>
                <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                  {isOwner
                    ? "Repositories you create or collaborate on will be showcased here."
                    : `@${user.username} hasn't pinned any repositories to their profile yet.`}
                </p>
                {isOwner && (
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <Link
                      href="/projects/new"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors shadow-sm"
                    >
                      <Plus size={14} /> Create Repository
                    </Link>
                    <Link
                      href="/projects"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                      Explore Projects
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Card 3: Recent Activity */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <Clock size={18} className="text-indigo-400" />
                <span>Recent Activity</span>
              </h2>

              <button
                type="button"
                onClick={() => onNavigateTab("activity")}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                View all
              </button>
            </div>

            {activityItems.length > 0 ? (
              <div className="divide-y divide-zinc-900">
                {activityItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="flex items-start gap-3.5 py-3 first:pt-0 last:pb-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-indigo-400">
                        <Icon size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-200">
                          <span>{item.title}</span>
                          {item.detail && (
                            <span className="font-semibold text-indigo-400 ml-1">
                              {item.detail}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{item.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* CLEAN SUPER AMOLED EMPTY STATE FOR ACTIVITY */
              <div className="rounded-xl border border-dashed border-zinc-800 bg-black/40 py-8 px-6 text-center">
                <Clock size={24} className="mx-auto text-zinc-600 mb-2" />
                <p className="text-xs font-medium text-zinc-400">No recent activity</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Commits, pull requests, and project updates will appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: Profile Stats, Skills, Recent Repos, Links */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Profile Stats */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold text-white mb-4">
              <BarChart2 size={18} className="text-indigo-400" />
              <span>Profile Stats</span>
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {/* Repositories Tile */}
              <div className="rounded-xl border border-zinc-800/80 bg-black p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <FolderGit2 size={16} className="text-indigo-400" />
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold text-white tracking-tight">
                    {user.stats?.repositoriesCount ?? allRepos.length}
                  </p>
                  <p className="text-[11px] font-medium text-zinc-400 mt-0.5">Repositories</p>
                </div>
              </div>

              {/* Followers Tile */}
              <div className="rounded-xl border border-zinc-800/80 bg-black p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <Users size={16} className="text-purple-400" />
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold text-white tracking-tight">
                    {user.stats?.followersCount ?? 0}
                  </p>
                  <p className="text-[11px] font-medium text-zinc-400 mt-0.5">Followers</p>
                </div>
              </div>

              {/* Following Tile */}
              <div className="rounded-xl border border-zinc-800/80 bg-black p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <UserCheck size={16} className="text-blue-400" />
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold text-white tracking-tight">
                    {user.stats?.followingCount ?? 0}
                  </p>
                  <p className="text-[11px] font-medium text-zinc-400 mt-0.5">Following</p>
                </div>
              </div>

              {/* Contributions Tile */}
              <div className="rounded-xl border border-zinc-800/80 bg-black p-3.5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <Star size={16} className="text-amber-400" />
                </div>
                <div className="mt-3">
                  <p className="text-xl font-bold text-white tracking-tight">
                    {user.stats?.contributionsCount ?? 0}
                  </p>
                  <p className="text-[11px] font-medium text-zinc-400 mt-0.5">Contributions</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Skills */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <Code2 size={18} className="text-indigo-400" />
                <span>Skills</span>
              </h2>

              {isOwner && (
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <span
                    key={s.skillId}
                    className="rounded-lg border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-zinc-700 transition-colors"
                  >
                    {s.skill.name}
                  </span>
                ))}
              </div>
            ) : (
              /* CLEAN SUPER AMOLED EMPTY STATE FOR SKILLS */
              <div className="rounded-xl border border-dashed border-zinc-800 bg-black/40 py-6 px-4 text-center">
                <Code2 size={20} className="mx-auto text-zinc-600 mb-1.5" />
                <p className="text-xs font-medium text-zinc-400">No skills added yet</p>
                {isOwner && (
                  <button
                    type="button"
                    onClick={onEditProfile}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    <Plus size={13} /> Add your skills
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Card 3: Recent Repos */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <FolderGit2 size={18} className="text-indigo-400" />
                <span>Recent Repos</span>
              </h2>

              {recentRepos.length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateTab("repositories")}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  View all
                </button>
              )}
            </div>

            {recentRepos.length > 0 ? (
              <div className="space-y-3">
                {recentRepos.map((repo) => (
                  <Link
                    key={repo.id}
                    href={`/repositories/${repo.slug}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-black p-3 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-indigo-400">
                        <FolderGit2 size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-zinc-200 group-hover:text-indigo-400 transition-colors">
                          {repo.title}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {formatRelativeTime(repo.updatedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-zinc-400 shrink-0">
                      <Star size={12} className="text-zinc-500" />
                      <span>0</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              /* CLEAN SUPER AMOLED EMPTY STATE FOR RECENT REPOS */
              <div className="rounded-xl border border-dashed border-zinc-800 bg-black/40 py-6 px-4 text-center">
                <p className="text-xs font-medium text-zinc-500">No recent repositories.</p>
              </div>
            )}
          </div>

          {/* Card 4: Social Links */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <Link2 size={18} className="text-indigo-400" />
                <span>Social Links</span>
              </h2>

              {isOwner && (
                <button
                  type="button"
                  onClick={onEditProfile}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {socialLinks.length > 0 ? (
              <div className="space-y-2.5">
                {socialLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <a
                      key={link.name}
                      href={link.url.startsWith("http") ? link.url : `https://${link.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-black p-3 hover:border-zinc-700 hover:bg-zinc-900/50 transition-all text-xs font-medium text-zinc-200 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon size={16} className="text-zinc-400 group-hover:text-white transition-colors" />
                        <span className="truncate">{link.name}</span>
                      </div>
                      <ExternalLink size={13} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                    </a>
                  );
                })}
              </div>
            ) : (
              /* CLEAN SUPER AMOLED EMPTY STATE FOR SOCIAL LINKS */
              <div className="rounded-xl border border-dashed border-zinc-800 bg-black/40 py-6 px-4 text-center">
                <Link2 size={20} className="mx-auto text-zinc-600 mb-1.5" />
                <p className="text-xs font-medium text-zinc-400">No social links connected</p>
                {isOwner && (
                  <button
                    type="button"
                    onClick={onEditProfile}
                    className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                  >
                    <Plus size={13} /> Connect accounts
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

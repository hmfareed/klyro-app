"use client";

import { useState } from "react";
import {
  MapPin,
  Link2,
  Calendar,
  MessageSquare,
  MoreHorizontal,
  Share2,
  Edit3,
  Check,
  UserPlus,
  UserCheck,
} from "lucide-react";

export type ProfileUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  about: string | null;
  location: string | null;
  websiteUrl: string | null;
  githubUsername: string | null;
  createdAt: string | Date;
  isOwner?: boolean;
  skills?: Array<{
    skillId: string;
    level: string;
    skill: { id: string; name: string; category?: string };
  }>;
  projectsOwned?: Array<{
    id: string;
    slug: string;
    title: string;
    tagline: string;
    description: string;
    category?: string;
    status: string;
    visibility: string;
    techStack: string[];
    createdAt: string | Date;
    updatedAt: string | Date;
    _count?: { members: number };
  }>;
  memberships?: Array<{
    id: string;
    joinedAt: string | Date;
    role: { title: string; permissionLevel: string };
    project: {
      id: string;
      slug: string;
      title: string;
      tagline: string;
      status: string;
      visibility: string;
      techStack: string[];
      updatedAt: string | Date;
      _count?: { members: number };
    };
  }>;
  stats?: {
    repositoriesCount: number;
    followersCount: number;
    followingCount: number;
    contributionsCount: number;
  };
};

type ProfileHeaderProps = {
  user: ProfileUser;
  isOwner: boolean;
  onEditProfile: () => void;
  onFollowToggle?: () => void;
  isFollowing?: boolean;
};

export function ProfileHeader({
  user,
  isOwner,
  onEditProfile,
  onFollowToggle,
  isFollowing = false,
}: ProfileHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const name = user.displayName || user.username;
  const initials = name.trim().slice(0, 2).toUpperCase();

  // Format joined date
  const joinedDate = new Date(user.createdAt);
  const formattedJoined = !isNaN(joinedDate.getTime())
    ? `Joined ${joinedDate.toLocaleString("en-US", { month: "short", year: "numeric" })}`
    : "Joined Aug 2025";

  // Share profile handler
  const handleShare = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  };

  return (
    <div className="relative px-4 sm:px-8">
      {/* Profile Header Main Container */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 -mt-16 sm:-mt-20">
        {/* Left: Avatar + Details */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-5">
          {/* Avatar with Ring & Status Indicator */}
          <div className="relative shrink-0">
            <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-full overflow-hidden ring-4 ring-black bg-zinc-900 shadow-2xl">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600 text-3xl sm:text-4xl font-extrabold text-white">
                  {initials}
                </div>
              )}
            </div>

            {/* Online Status Indicator */}
            <span
              className="absolute bottom-2 right-2 h-5 w-5 rounded-full bg-emerald-500 ring-4 ring-black"
              title="Online"
            />
          </div>

          {/* User Details */}
          <div className="space-y-1.5 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* NOTE: Verification badge explicitly omitted per user request */}
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {name}
              </h1>
            </div>

            <p className="text-sm font-medium text-zinc-400">@{user.username}</p>

            {/* Tagline / Subtitle */}
            {user.bio ? (
              <p className="text-sm text-zinc-300 font-normal leading-relaxed pt-0.5">
                {user.bio}
              </p>
            ) : isOwner ? (
              <p className="text-xs text-zinc-500 italic pt-0.5">
                No bio added yet. Click &quot;Edit Profile&quot; to add a headline.
              </p>
            ) : null}

            {/* Meta Row: Location, Website, Joined */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs text-zinc-400">
              {user.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-zinc-500" />
                  <span>{user.location}</span>
                </span>
              )}

              {user.websiteUrl && (
                <a
                  href={user.websiteUrl.startsWith("http") ? user.websiteUrl : `https://${user.websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                >
                  <Link2 size={14} />
                  <span>{user.websiteUrl.replace(/^https?:\/\//, "")}</span>
                </a>
              )}

              <span className="flex items-center gap-1.5 text-zinc-400">
                <Calendar size={14} className="text-zinc-500" />
                <span>{formattedJoined}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 pt-4 md:pt-0 self-start md:self-end">
          {isOwner ? (
            <>
              <button
                type="button"
                onClick={onEditProfile}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-900 hover:border-zinc-700 transition-all shadow-sm"
              >
                <Edit3 size={14} className="text-indigo-400" />
                <span>Edit Profile</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
                title="Share profile link"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 size={14} />
                    <span>Share</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onFollowToggle}
                className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-semibold shadow-md transition-all ${
                  isFollowing
                    ? "bg-zinc-900 border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                    : "bg-blue-600 hover:bg-blue-500 text-white"
                }`}
              >
                {isFollowing ? (
                  <>
                    <UserCheck size={14} />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={14} />
                    <span>Follow</span>
                  </>
                )}
              </button>

              <a
                href={`/chat?user=${user.username}`}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white transition-all shadow-sm"
              >
                <MessageSquare size={14} />
                <span>Message</span>
              </a>
            </>
          )}

          {/* Options Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all"
              title="More options"
            >
              <MoreHorizontal size={16} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-2xl border border-zinc-800 bg-black p-1.5 text-xs text-zinc-300 shadow-2xl z-30">
                <button
                  type="button"
                  onClick={() => {
                    handleShare();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 hover:bg-zinc-900 hover:text-white text-left"
                >
                  <Share2 size={13} />
                  <span>Copy profile link</span>
                </button>
                {!isOwner && (
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-red-400 hover:bg-red-950/30 hover:text-red-300 text-left"
                  >
                    <span>Report user</span>
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

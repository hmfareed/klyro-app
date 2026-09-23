"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Rocket,
  Handshake,
  Package,
  CheckCircle2,
  UserPlus,
  Sparkles,
  MessageSquare,
  Trophy,
  Star,
  Users,
  ArrowUpRight,
  FolderGit2,
  Bookmark,
} from "lucide-react";
import { FeedItem } from "@/server/buildstream";

interface BuildstreamCardProps {
  event: FeedItem;
  onApply?: (projectSlug: string, projectTitle: string, roles: Array<{ id: string; title: string }>) => void;
  onStarToggle?: (slug: string, newStarred: boolean) => void;
  onFollowToggle?: (slug: string, newFollowed: boolean) => void;
}

function initialsFor(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || "DV";
}

function KindBadge({ kind }: { kind: FeedItem["kind"] }) {
  const map: Record<FeedItem["kind"], { label: string; className: string; Icon: typeof Rocket }> = {
    launch: { label: "Project launched", className: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300", Icon: Rocket },
    opportunity: { label: "Looking for collaborators", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", Icon: Handshake },
    release: { label: "New release", className: "border-sky-500/30 bg-sky-500/10 text-sky-300", Icon: Package },
    milestone: { label: "Milestone", className: "border-amber-500/30 bg-amber-500/10 text-amber-300", Icon: CheckCircle2 },
    contributor: { label: "New builder", className: "border-purple-500/30 bg-purple-500/10 text-purple-300", Icon: UserPlus },
    update: { label: "Build moment", className: "border-zinc-700 bg-zinc-800/60 text-zinc-300", Icon: Sparkles },
    discussion: { label: "Project discussion", className: "border-orange-500/30 bg-orange-500/10 text-orange-300", Icon: MessageSquare },
    achievement: { label: "Milestone reached", className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300", Icon: Trophy },
  };

  const { label, className, Icon } = map[kind] ?? map.update;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${className}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function TechRow({ tech }: { tech: string[] }) {
  if (!tech || tech.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tech.slice(0, 5).map((t) => (
        <span
          key={t}
          className="rounded-md border border-zinc-800 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

export function StreamCard({ event, onApply, onStarToggle, onFollowToggle }: BuildstreamCardProps) {
  const p = event.project;
  const authorName = p.author.isCurrentUser ? "You" : p.author.displayName || p.author.username;
  const repoUrl = p.author?.username ? `/repositories/${p.author.username}/${p.slug}` : `/repositories/${p.slug}`;
  const [starred, setStarred] = useState(p.isStarredByViewer);
  const [starsCount, setStarsCount] = useState(p.starsCount);
  const [followed, setFollowed] = useState(p.isFollowedByViewer);

  async function handleToggleStar() {
    const nextState = !starred;
    setStarred(nextState);
    setStarsCount((c) => (nextState ? c + 1 : Math.max(0, c - 1)));
    if (onStarToggle) onStarToggle(p.slug, nextState);
    try {
      await fetch(`/api/v1/projects/${p.slug}/star`, { method: "POST" });
    } catch {
      // Revert if failed
      setStarred(!nextState);
      setStarsCount((c) => (nextState ? Math.max(0, c - 1) : c + 1));
    }
  }

  async function handleToggleFollow() {
    const nextState = !followed;
    setFollowed(nextState);
    if (onFollowToggle) onFollowToggle(p.slug, nextState);
    try {
      await fetch(`/api/v1/projects/${p.slug}/follow`, { method: "POST" });
    } catch {
      setFollowed(!nextState);
    }
  }

  return (
    <article className="rounded-2xl border border-zinc-800/80 bg-zinc-950 p-5 transition-colors hover:border-zinc-700 shadow-sm">
      {/* Header meta */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <KindBadge kind={event.kind} />
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-500">{event.time}</span>
          <button
            onClick={handleToggleFollow}
            title={followed ? "Following" : "Follow build"}
            className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
              followed
                ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                : "border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
            }`}
          >
            {followed ? "Following" : "+ Follow"}
          </button>
        </div>
      </div>

      {/* Card Content based on Event Kind */}
      {event.kind === "opportunity" ? (
        <div className="mt-3">
          <Link
            href={repoUrl}
            className="text-base font-bold text-white hover:text-indigo-300 transition-colors"
          >
            {p.title}
          </Link>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
            {event.headline} — {event.body || p.tagline}
          </p>

          <div className="mt-3">
            <p className="text-[11px] font-semibold text-zinc-400 mb-1.5">Open Roles:</p>
            <div className="flex flex-wrap gap-1.5">
              {(p.openRoles.length > 0 ? p.openRoles : [{ id: "c", title: "Contributor" }]).map((r) => (
                <span
                  key={r.id}
                  className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300"
                >
                  {r.title}
                </span>
              ))}
            </div>
          </div>

          <p className="mt-3 text-[11px] text-zinc-500">
            Founded by <span className="text-zinc-300 font-medium">{authorName}</span>
            {p.techStack.length > 0 && ` · ${p.techStack.slice(0, 4).join(" · ")}`}
          </p>

          <div className="mt-4 flex items-center gap-2">
            <Link
              href={`/projects/${p.slug}`}
              className="rounded-xl border border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:border-zinc-500 hover:text-white transition-colors"
            >
              View Project
            </Link>
            {onApply && (
              <button
                onClick={() => onApply(p.slug, p.title, p.openRoles)}
                className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-colors cursor-pointer"
              >
                I&apos;m Interested
              </button>
            )}
          </div>
        </div>
      ) : event.kind === "release" ? (
        <div className="mt-3">
          <p className="text-[11px] text-zinc-500">{p.title}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <h2 className="text-base font-bold text-white">{event.version ?? "New release"}</h2>
            {event.versionFrom && (
              <span className="text-[11px] text-zinc-500 font-mono">
                {event.versionFrom} → {event.version}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{event.body ?? event.headline}</p>
          <TechRow tech={p.techStack} />
          <CardFooter
            event={event}
            starred={starred}
            starsCount={starsCount}
            onToggleStar={handleToggleStar}
            primaryLabel="View release"
            primaryHref={repoUrl}
          />
        </div>
      ) : event.kind === "milestone" ? (
        <div className="mt-3">
          <p className="text-[11px] text-zinc-500">{p.title}</p>
          <h2 className="text-base font-bold text-white mt-0.5">
            “{event.milestoneTitle ?? event.headline}”
          </h2>
          <p className="mt-1 text-xs text-zinc-400">{event.body}</p>
          {event.milestoneProgress !== undefined && (
            <div className="mt-3">
              <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                <span>Milestone Progress</span>
                <span className="font-semibold text-white">{event.milestoneProgress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all duration-300"
                  style={{ width: `${event.milestoneProgress}%` }}
                />
              </div>
            </div>
          )}
          <CardFooter
            event={event}
            starred={starred}
            starsCount={starsCount}
            onToggleStar={handleToggleStar}
            primaryLabel="View milestone"
            primaryHref={`/repositories/${p.slug}?tab=tasks`}
          />
        </div>
      ) : event.kind === "contributor" ? (
        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white shadow-inner">
            {initialsFor(event.headline)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-white truncate">{event.headline}</h2>
            <p className="text-[11px] text-zinc-400 truncate">{event.body || p.title}</p>
          </div>
          <Link
            href={repoUrl}
            className="shrink-0 rounded-xl border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-zinc-500 hover:text-white transition-colors"
          >
            View build
          </Link>
        </div>
      ) : event.kind === "discussion" ? (
        <div className="mt-3">
          <p className="text-[11px] text-zinc-500">{p.title}</p>
          <h2 className="text-sm font-bold text-white mt-0.5">{event.headline}</h2>
          <p className="mt-1 text-xs text-zinc-400">{event.body}</p>
          <CardFooter
            event={event}
            starred={starred}
            starsCount={starsCount}
            onToggleStar={handleToggleStar}
            primaryLabel="Join discussion"
            primaryHref={repoUrl}
          />
        </div>
      ) : (
        /* Build Moment / Launch / Update Card */
        <div className="mt-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FolderGit2 size={17} />
            </span>
            <div className="min-w-0">
              <Link
                href={repoUrl}
                className="block truncate text-sm font-bold text-white hover:text-indigo-300 transition-colors"
              >
                {p.title}
              </Link>
              <span className="block truncate text-[11px] text-zinc-500">
                {event.headline} · by {authorName}
              </span>
            </div>
          </div>

          <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{event.body ?? p.tagline}</p>
          <TechRow tech={p.techStack} />

          {/* Dynamic Build Story from real history */}
          {event.buildStory && event.buildStory.length > 0 && (
            <div className="mt-3 rounded-xl border border-zinc-800/70 bg-black/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500 mb-2">
                Build Story
              </p>
              <ol className="space-y-1.5">
                {event.buildStory.map((step, i) => (
                  <li key={step} className="flex items-center gap-2 text-[11px] text-zinc-400">
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        i === event.buildStory!.length - 1 ? "bg-indigo-400" : "bg-zinc-600"
                      }`}
                    />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <CardFooter
            event={event}
            starred={starred}
            starsCount={starsCount}
            onToggleStar={handleToggleStar}
            primaryLabel="Explore build"
            primaryHref={repoUrl}
          />
        </div>
      )}
    </article>
  );
}

function CardFooter({
  event,
  starred,
  starsCount,
  onToggleStar,
  primaryLabel,
  primaryHref,
}: {
  event: FeedItem;
  starred: boolean;
  starsCount: number;
  onToggleStar: () => void;
  primaryLabel: string;
  primaryHref: string;
}) {
  const p = event.project;
  return (
    <div className="mt-4 flex items-center justify-between border-t border-zinc-800/60 pt-3 text-xs text-zinc-400">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleStar}
          className={`flex items-center gap-1 cursor-pointer transition-colors ${
            starred ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300"
          }`}
          title={starred ? "Starred" : "Star this build"}
        >
          <Star size={13} className={starred ? "fill-amber-400" : ""} />
          <span className="text-[11px]">{starsCount}</span>
        </button>

        <span className="flex items-center gap-1" title="Contributors">
          <Users size={13} className="text-zinc-500" />
          <span className="text-[11px]">{p.memberCount}</span>
        </span>

        {p.openRolesCount > 0 && (
          <span className="hidden sm:inline text-[10px] text-emerald-400 font-medium">
            {p.openRolesCount} open role{p.openRolesCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <Link
        href={primaryHref}
        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        {primaryLabel} <ArrowUpRight size={13} />
      </Link>
    </div>
  );
}

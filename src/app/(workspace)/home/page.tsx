"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/context/WorkspaceContext";
import {
  BuildstreamTab,
  BuildstreamFilter,
  FeedItem,
  BuildstreamPayload,
} from "@/server/buildstream";
import { BuildstreamHeader } from "@/components/buildstream/BuildstreamHeader";
import { BuildstreamForYou } from "@/components/buildstream/BuildstreamForYou";
import { StreamCard } from "@/components/buildstream/BuildstreamCards";
import { BuildstreamSidebar } from "@/components/buildstream/BuildstreamSidebar";
import { FeedCardSkeleton, SidebarSkeleton } from "@/components/buildstream/BuildstreamSkeletons";
import { BuildstreamEmptyState } from "@/components/buildstream/BuildstreamEmptyStates";
import { OpportunityApplyModal } from "@/components/buildstream/OpportunityApplyModal";
import { AlertCircle, RefreshCw } from "lucide-react";

const FEED_FILTERS: { id: BuildstreamFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "moments", label: "Build Moments" },
  { id: "releases", label: "Releases" },
  { id: "opportunities", label: "Opportunities" },
  { id: "milestones", label: "Milestones" },
  { id: "people", label: "People" },
  { id: "discussions", label: "Discussions" },
];

export default function WorkspaceHomePage() {
  const { user } = useWorkspace();

  const [streamTab, setStreamTab] = useState<BuildstreamTab>("everything");
  const [feedFilter, setFeedFilter] = useState<BuildstreamFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [stats, setStats] = useState<BuildstreamPayload["stats"]>({
    activeBuilds: 0,
    updatedRecently: 0,
    openOpportunities: 0,
    launchesAndMoments: 0,
  });

  const [pulse, setPulse] = useState<BuildstreamPayload["pulse"]>({
    assignedTasks: 0,
    pendingApplications: 0,
    myBuilds: 0,
    followingCount: 0,
    unreadNotifications: 0,
  });

  const [trending, setTrending] = useState<BuildstreamPayload["trending"]>([]);
  const [opportunities, setOpportunities] = useState<BuildstreamPayload["opportunities"]>([]);
  const [recommendedBuilders, setRecommendedBuilders] = useState<BuildstreamPayload["recommendedBuilders"]>([]);
  const [radar, setRadar] = useState<BuildstreamPayload["radar"]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Apply Modal state
  const [applyModal, setApplyModal] = useState<{
    isOpen: boolean;
    projectSlug: string;
    projectTitle: string;
    roles: Array<{ id: string; title: string }>;
  }>({
    isOpen: false,
    projectSlug: "",
    projectTitle: "",
    roles: [],
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load feed and sidebar data from the database
  const fetchBuildstream = useCallback(
    async (append = false, cursor?: string) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setError(null);
      }

      try {
        const params = new URLSearchParams();
        params.set("tab", streamTab);
        params.set("filter", feedFilter);
        if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
        if (cursor) {
          params.set("cursor", cursor);
          params.set("feedOnly", "true");
        }

        const res = await fetch(`/api/v1/buildstream?${params.toString()}`);
        if (!res.ok) throw new Error("Could not load Buildstream data.");

        const json = await res.json();
        const data = json?.data ?? json;

        if (append) {
          setFeedItems((prev) => [...prev, ...(data?.items ?? [])]);
          setNextCursor(data?.nextCursor ?? null);
        } else {
          setFeedItems(data?.items ?? []);
          setNextCursor(data?.nextCursor ?? null);
          if (data?.stats) setStats(data.stats);
          if (data?.pulse) setPulse(data.pulse);
          if (data?.trending) setTrending(data.trending);
          if (data?.opportunities) setOpportunities(data.opportunities);
          if (data?.recommendedBuilders) setRecommendedBuilders(data.recommendedBuilders);
          if (data?.radar) setRadar(data.radar);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Buildstream.");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [streamTab, feedFilter, debouncedQuery]
  );

  // Trigger load on tab, filter, debounced query or user change
  useEffect(() => {
    fetchBuildstream(false);
  }, [fetchBuildstream]);

  // Listen to project creation / refresh events to auto-refresh live feed
  useEffect(() => {
    const handleRefresh = () => fetchBuildstream(false);
    window.addEventListener("refresh-workspace-projects", handleRefresh);
    window.addEventListener("klyro-build-event", handleRefresh);
    return () => {
      window.removeEventListener("refresh-workspace-projects", handleRefresh);
      window.removeEventListener("klyro-build-event", handleRefresh);
    };
  }, [fetchBuildstream]);

  function handleLoadMore() {
    if (nextCursor && !isLoadingMore) {
      fetchBuildstream(true, nextCursor);
    }
  }

  function handleOpenApplyModal(
    slug: string,
    title: string,
    roles: Array<{ id: string; title: string }> = []
  ) {
    setApplyModal({
      isOpen: true,
      projectSlug: slug,
      projectTitle: title,
      roles,
    });
  }

  function handleApplySuccess() {
    setPulse((prev) => ({
      ...prev,
      pendingApplications: prev.pendingApplications + 1,
    }));
  }

  function handleStarToggle(slug: string, starred: boolean) {
    setFeedItems((prev) =>
      prev.map((item) => {
        if (item.project.slug === slug) {
          const nextCount = starred
            ? item.project.starsCount + 1
            : Math.max(0, item.project.starsCount - 1);
          return {
            ...item,
            project: {
              ...item.project,
              isStarredByViewer: starred,
              starsCount: nextCount,
            },
          };
        }
        return item;
      })
    );
  }

  function handleFollowToggle(slug: string, followed: boolean) {
    setFeedItems((prev) =>
      prev.map((item) => {
        if (item.project.slug === slug) {
          return {
            ...item,
            project: {
              ...item.project,
              isFollowedByViewer: followed,
              followersCount: followed
                ? item.project.followersCount + 1
                : Math.max(0, item.project.followersCount - 1),
            },
          };
        }
        return item;
      })
    );
    setPulse((prev) => ({
      ...prev,
      followingCount: followed
        ? prev.followingCount + 1
        : Math.max(0, prev.followingCount - 1),
    }));
  }

  // Derive tech stack affinities from loaded projects
  const activeTechs = useMemo(() => {
    const freq = new Map<string, number>();
    for (const item of feedItems) {
      for (const t of item.project.techStack) {
        freq.set(t, (freq.get(t) ?? 0) + 1);
      }
    }
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);
  }, [feedItems]);

  const skillMatchesCount = useMemo(() => {
    if (activeTechs.length === 0) return stats.activeBuilds;
    return feedItems.filter((i) =>
      i.project.techStack.some((t) => activeTechs.includes(t))
    ).length;
  }, [feedItems, activeTechs, stats.activeBuilds]);

  return (
    <div className="flex-1 overflow-y-auto bg-black p-4 sm:p-6 lg:p-8 text-white min-w-0">
      {/* ── 1. Header with dynamic stats and Create menu ── */}
      <BuildstreamHeader
        currentTab={streamTab}
        onTabChange={(tab) => {
          setStreamTab(tab);
          setFeedFilter("all");
        }}
        stats={stats}
        isLoading={isLoading}
      />

      {/* ── 2. For You Intelligence Layer with Real Search ── */}
      <BuildstreamForYou
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTechs={activeTechs}
        skillMatches={skillMatchesCount}
        lookingCount={stats.openOpportunities}
        updatedCount={stats.updatedRecently}
      />

      {/* ── 3. Main Stream Feed + Right Intelligence Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        {/* Left Column: Feed Filters & Cards */}
        <div className="min-w-0">
          {/* Feed Filter Pills */}
          <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {FEED_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFeedFilter(f.id)}
                className={`rounded-lg px-2.5 py-1.5 whitespace-nowrap transition-colors border cursor-pointer ${
                  feedFilter === f.id
                    ? "border-zinc-600 bg-zinc-800 text-white font-medium"
                    : "border-zinc-800/60 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Error Banner with Retry */}
          {error && (
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>We couldn&apos;t load your Buildstream.</span>
              </div>
              <button
                onClick={() => fetchBuildstream(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/20 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-500/30 transition-colors cursor-pointer"
              >
                <RefreshCw size={12} /> Try Again
              </button>
            </div>
          )}

          {/* Loading Skeletons */}
          {isLoading ? (
            <div className="space-y-4">
              <FeedCardSkeleton />
              <FeedCardSkeleton />
              <FeedCardSkeleton />
            </div>
          ) : feedItems.length === 0 ? (
            /* Graceful Empty States — No fake data */
            <BuildstreamEmptyState
              tab={streamTab}
              searchQuery={debouncedQuery}
              onClearSearch={() => setSearchQuery("")}
            />
          ) : (
            /* Real Activity Feed */
            <div className="space-y-4">
              {feedItems.map((event) => (
                <StreamCard
                  key={event.id}
                  event={event}
                  onApply={(slug, title, roles) => handleOpenApplyModal(slug, title, roles)}
                  onStarToggle={handleStarToggle}
                  onFollowToggle={handleFollowToggle}
                />
              ))}

              {/* Cursor Pagination: Load more updates */}
              {nextCursor && (
                <div className="pt-2 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isLoadingMore ? "Loading earlier updates..." : "Load earlier updates"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Intelligence Panels */}
        {isLoading ? (
          <SidebarSkeleton />
        ) : (
          <BuildstreamSidebar
            pulse={pulse}
            trending={trending}
            opportunities={opportunities}
            recommendedBuilders={recommendedBuilders}
            radar={radar}
            onSelectCategory={(cat) => {
              setSearchQuery(cat);
              setFeedFilter("all");
            }}
            onApplyRole={(slug, title) => handleOpenApplyModal(slug, title, [])}
          />
        )}
      </div>

      {/* ── 4. Apply Modal Dialog ── */}
      <OpportunityApplyModal
        isOpen={applyModal.isOpen}
        onClose={() => setApplyModal((prev) => ({ ...prev, isOpen: false }))}
        projectSlug={applyModal.projectSlug}
        projectTitle={applyModal.projectTitle}
        roles={applyModal.roles}
        onSuccess={handleApplySuccess}
      />
    </div>
  );
}

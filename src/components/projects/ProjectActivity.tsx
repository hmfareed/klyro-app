"use client";

import { useState, useEffect, useCallback } from "react";
import { unwrap, fetchJson, displayName, timeAgo, initialsOf } from "./lib";

interface ActivityEvent {
  id: string;
  type: string;
  targetType: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  actor: { username: string; displayName: string | null; avatarUrl?: string | null };
}

function describe(e: ActivityEvent): string {
  const meta = e.metadata ?? {};
  if (typeof meta.headline === "string") return meta.headline;
  return e.type.toLowerCase().replace(/_/g, " ");
}

export function ProjectActivity({ slug }: { slug: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback((after?: string | null, append = false) => {
    const url = after
      ? `/api/v1/projects/${slug}/activity?cursor=${encodeURIComponent(after)}`
      : `/api/v1/projects/${slug}/activity`;
    fetchJson(url)
      .then(({ json }) => {
        const list = unwrap<ActivityEvent[]>(json, "events", []);
        const j = json as { data?: { nextCursor?: string | null; hasMore?: boolean }; nextCursor?: string | null; hasMore?: boolean } | null;
        setEvents((prev) => (append ? [...prev, ...list] : list));
        setCursor(j?.data?.nextCursor ?? j?.nextCursor ?? null);
        setHasMore(j?.data?.hasMore ?? j?.hasMore ?? false);
      })
      .catch(() => { /* keep */ })
      .finally(() => {
        setLoading(false);
        setLoadingMore(false);
      });
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="border-b border-white/10 px-6 py-4">
        <h2 className="text-base font-bold text-white">Activity</h2>
        <p className="text-xs text-slate-400 mt-0.5">Immutable project event stream.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading activity...</div>
        ) : events.length === 0 ? (
          <p className="text-xs text-slate-500">No activity recorded yet.</p>
        ) : (
          <div className="max-w-2xl space-y-1">
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03]">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-slate-200">
                  {initialsOf(displayName(e.actor))}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-300 leading-snug">
                    <span className="font-semibold text-white">{displayName(e.actor)}</span> {describe(e)}
                  </p>
                  <p className="text-[11px] text-slate-600">{timeAgo(e.createdAt)} · {e.type}</p>
                </div>
              </div>
            ))}
            {hasMore && (
              <button
                onClick={() => { setLoadingMore(true); load(cursor, true); }}
                disabled={loadingMore}
                className="mt-2 rounded-lg border border-white/10 px-4 py-1.5 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

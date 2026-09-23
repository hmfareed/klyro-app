"use client";

export function FeedCardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 p-5 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 rounded-full bg-zinc-800" />
        <div className="h-3 w-16 rounded bg-zinc-800/60" />
      </div>
      <div className="h-5 w-48 rounded bg-zinc-800" />
      <div className="space-y-1.5">
        <div className="h-3.5 w-full rounded bg-zinc-800/60" />
        <div className="h-3.5 w-3/4 rounded bg-zinc-800/40" />
      </div>
      <div className="flex gap-2 pt-2">
        <div className="h-5 w-16 rounded-md bg-zinc-800/50" />
        <div className="h-5 w-16 rounded-md bg-zinc-800/50" />
        <div className="h-5 w-16 rounded-md bg-zinc-800/50" />
      </div>
      <div className="flex items-center justify-between border-t border-zinc-800/60 pt-3">
        <div className="h-3.5 w-24 rounded bg-zinc-800/60" />
        <div className="h-3.5 w-20 rounded bg-zinc-800/60" />
      </div>
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
        <div className="h-3.5 w-24 rounded bg-zinc-800" />
        <div className="space-y-2 pt-1">
          <div className="h-4 w-full rounded bg-zinc-800/60" />
          <div className="h-4 w-full rounded bg-zinc-800/60" />
          <div className="h-4 w-full rounded bg-zinc-800/60" />
          <div className="h-4 w-full rounded bg-zinc-800/60" />
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
        <div className="h-3.5 w-28 rounded bg-zinc-800" />
        <div className="h-16 w-full rounded-xl bg-zinc-900/60" />
        <div className="h-16 w-full rounded-xl bg-zinc-900/60" />
      </div>
    </div>
  );
}

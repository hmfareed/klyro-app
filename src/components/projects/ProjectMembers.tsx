"use client";

import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Member, fetchJson, displayName, initialsOf } from "./lib";

export function ProjectMembers({
  slug, members, owner, isManager, meId, onChanged,
}: {
  slug: string;
  members: Member[];
  owner: { id: string; username: string; displayName: string | null; avatarUrl?: string | null };
  isManager: boolean;
  meId: string | null;
  onChanged?: () => void;
}) {
  const [removing, setRemoving] = useState<Member | null>(null);
  const [impact, setImpact] = useState<{ assignedTasks: number; openPRs: number; comments: number } | null>(null);
  const [mode, setMode] = useState<"unassign" | "reassign">("unassign");
  const [reassignTo, setReassignTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openRemove(m: Member) {
    setRemoving(m);
    setImpact(null);
    setError(null);
    try {
      const { json } = await fetchJson(`/api/v1/projects/${slug}/members/${m.user.id}`);
      const j = json as { data?: { impact?: { assignedTasks: number; openPRs: number; comments: number } }; impact?: { assignedTasks: number; openPRs: number; comments: number } } | null;
      setImpact(j?.data?.impact ?? j?.impact ?? null);
    } catch { /* preview optional */ }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusy(true);
    setError(null);
    try {
      const { res, json } = await fetchJson(`/api/v1/projects/${slug}/members/${removing.user.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, reassignTo: mode === "reassign" ? reassignTo || undefined : undefined }),
      });
      if (!res.ok) throw new Error((json as { error?: { message?: string } })?.error?.message ?? "Failed to remove member.");
      setRemoving(null);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Removal failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="border-b border-white/10 px-6 py-4">
        <h2 className="text-base font-bold text-white">Members</h2>
        <p className="text-xs text-slate-400 mt-0.5">{members.length + 1} people · project-specific roles and permissions.</p>
      </div>
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="max-w-2xl space-y-2">
          <div className="flex items-center gap-3 rounded-xl border border-indigo-500/30 bg-indigo-950/20 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
              {initialsOf(displayName(owner))}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{displayName(owner)} {meId === owner.id && <span className="text-slate-500 font-normal">(you)</span>}</p>
              <p className="text-[11px] text-slate-400">@{owner.username}</p>
            </div>
            <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-200">OWNER</span>
          </div>

          {members.map((m) => (
            <div key={m.user.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-slate-200">
                {initialsOf(displayName(m.user))}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{displayName(m.user)} {meId === m.user.id && <span className="text-slate-500 font-normal">(you)</span>}</p>
                <p className="text-[11px] text-slate-400">{m.role.title} · {m.role.permissionLevel}</p>
              </div>
              {isManager && m.user.id !== meId && (
                <button onClick={() => openRemove(m)} title="Remove from project" className="rounded-lg p-1.5 text-slate-500 hover:bg-red-950/40 hover:text-red-300">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {removing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0f172a] p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold">Remove {displayName(removing.user)} from project?</h3>
              <button onClick={() => setRemoving(null)} className="text-slate-400 hover:text-white"><X size={15} /></button>
            </div>
            {impact && (
              <p className="text-xs text-slate-400">
                {displayName(removing.user)} currently has {impact.assignedTasks} assigned task(s), {impact.openPRs} open PR(s), {impact.comments} comment(s).
              </p>
            )}
            <p className="mt-3 text-xs font-semibold text-slate-300">What should happen to their tasks?</p>
            <div className="mt-2 space-y-2 text-xs">
              <label className="flex items-center gap-2 rounded-lg border border-white/10 p-2.5 cursor-pointer hover:bg-white/5">
                <input type="radio" checked={mode === "unassign"} onChange={() => setMode("unassign")} />
                Leave unassigned
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-white/10 p-2.5 cursor-pointer hover:bg-white/5">
                <input type="radio" checked={mode === "reassign"} onChange={() => setMode("reassign")} />
                Reassign to...
              </label>
              {mode === "reassign" && (
                <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:outline-none">
                  <option value="">Select member...</option>
                  {[owner, ...members.map((m) => m.user)].filter((u) => u.id !== removing.user.id).map((u) => (
                    <option key={u.id} value={u.id}>{u.displayName || u.username}</option>
                  ))}
                </select>
              )}
            </div>
            {error && <div className="mt-3 rounded-lg bg-red-950/50 border border-red-800/40 p-2 text-xs text-red-200">{error}</div>}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRemoving(null)} className="rounded-lg border border-white/10 px-3.5 py-1.5 text-xs text-slate-300 hover:bg-white/5">Cancel</button>
              <button onClick={confirmRemove} disabled={busy || (mode === "reassign" && !reassignTo)} className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50">
                {busy ? "Removing..." : "Remove member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

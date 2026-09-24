"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "./lib";

interface SettingsProject {
  title: string;
  tagline: string;
  description: string;
  category: string;
  status: string;
  visibility: string;
}

export function ProjectSettings({
  slug, project, isManager,
}: {
  slug: string;
  project: SettingsProject;
  isManager: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<SettingsProject>(project);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  async function save(patch: Partial<SettingsProject>, successText: string) {
    setSaving(true);
    setMsg(null);
    try {
      const { res, json } = await fetchJson(`/api/v1/projects/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((json as { error?: { message?: string } })?.error?.message ?? "Save failed.");
      setMsg({ ok: true, text: successText });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof SettingsProject, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const archived = form.status === "ARCHIVED" || form.status === "COMPLETED";

  return (
    <div className="flex-1 overflow-y-auto p-6 min-h-0">
      <div className="max-w-2xl space-y-6">
        <div>
          <h2 className="text-base font-bold text-white">Project settings</h2>
          <p className="text-xs text-slate-400 mt-0.5">General, workflow defaults and danger zone.</p>
        </div>

        {msg && (
          <div className={`rounded-lg border p-2.5 text-xs ${msg.ok ? "border-emerald-800/40 bg-emerald-950/40 text-emerald-200" : "border-red-800/40 bg-red-950/40 text-red-200"}`}>
            {msg.text}
          </div>
        )}

        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">General</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Title</label>
            <input value={form.title} disabled={!isManager} onChange={(e) => set("title", e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none disabled:opacity-60" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Tagline</label>
            <input value={form.tagline} disabled={!isManager} onChange={(e) => set("tagline", e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none disabled:opacity-60" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
            <textarea rows={3} value={form.description} disabled={!isManager} onChange={(e) => set("description", e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none disabled:opacity-60" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Status</label>
              <select value={form.status} disabled={!isManager} onChange={(e) => set("status", e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-60">
                <option value="RECRUITING">Recruiting</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="PAUSED">Paused</option>
                <option value="COMPLETED">Completed</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Visibility</label>
              <select value={form.visibility} disabled={!isManager} onChange={(e) => set("visibility", e.target.value)} className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-60">
                <option value="PUBLIC">Public</option>
                <option value="UNLISTED">Unlisted</option>
                <option value="PRIVATE">Private</option>
              </select>
            </div>
          </div>
          {isManager && (
            <div className="flex justify-end">
              <button
                disabled={saving}
                onClick={() => save({ title: form.title, tagline: form.tagline, description: form.description, status: form.status as SettingsProject["status"], visibility: form.visibility as SettingsProject["visibility"] }, "Settings saved.")}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          )}
        </section>

        {isManager && (
          <section className="rounded-xl border border-red-900/50 bg-red-950/10 p-5 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-red-300">Danger zone</h3>
            {!confirmArchive ? (
              <button
                onClick={() => setConfirmArchive(true)}
                className="rounded-lg border border-red-800/50 px-3.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-950/40"
              >
                {archived ? "Unarchive project" : "Archive project"}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-300 flex-1">
                  {archived ? "Restore this project to active? It will reappear under My Projects." : "Archive instead of deleting — archived projects become read-only by default."}
                </p>
                <button onClick={() => setConfirmArchive(false)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300">Cancel</button>
                <button
                  disabled={saving}
                  onClick={async () => {
                    await save({ status: archived ? "IN_PROGRESS" : "ARCHIVED" }, archived ? "Project restored." : "Project archived.");
                    setConfirmArchive(false);
                    router.refresh();
                  }}
                  className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

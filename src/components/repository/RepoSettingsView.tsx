"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Settings,
  Shield,
  Webhook,
  AlertTriangle,
  Check,
  Send,
  Trash2,
  Archive,
  Lock,
  Globe,
} from "lucide-react";

interface RepoSettingsViewProps {
  repository: any;
  owner: string;
  repo: string;
  viewer: any;
  onRefresh: () => void;
}

export function RepoSettingsView({
  repository,
  owner,
  repo,
  viewer,
  onRefresh,
}: RepoSettingsViewProps) {
  const router = useRouter();

  // General settings state
  const [name, setName] = useState(repository.name);
  const [description, setDescription] = useState(repository.description || "");
  const [defaultBranch, setDefaultBranch] = useState(repository.defaultBranch || "main");
  const [visibility, setVisibility] = useState(repository.visibility || "PUBLIC");
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalMsg, setGeneralMsg] = useState("");

  // Webhooks state
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookSecret, setNewWebhookSecret] = useState("");
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);

  // Danger zone state
  const [confirmDeleteName, setConfirmDeleteName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadWebhooks = () => {
    fetch(`/api/v1/repositories/${owner}/${repo}/webhooks`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data?.webhooks) setWebhooks(d.data.webhooks);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadWebhooks();
  }, [owner, repo]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGeneral(true);
    setGeneralMsg("");

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          defaultBranch,
          visibility,
        }),
      });

      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.repository) {
        setGeneralMsg("Settings saved successfully.");
        onRefresh();
        if (d.data.repository.slug !== repo) {
          router.replace(`/repositories/${owner}/${d.data.repository.slug}?tab=settings`);
        }
      } else {
        setGeneralMsg(d?.error?.message || "Failed to save settings.");
      }
    } catch {
      setGeneralMsg("Failed to save settings.");
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWebhookUrl.trim()) return;

    setAddingWebhook(true);

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newWebhookUrl.trim(),
          secret: newWebhookSecret.trim() || undefined,
        }),
      });

      if (res.ok) {
        setNewWebhookUrl("");
        setNewWebhookSecret("");
        loadWebhooks();
      }
    } catch {} finally {
      setAddingWebhook(false);
    }
  };

  const handlePingWebhook = async (webhookId: string) => {
    setPingingId(webhookId);
    try {
      await fetch(`/api/v1/repositories/${owner}/${repo}/webhooks/${webhookId}/ping`, {
        method: "POST",
      });
      loadWebhooks();
    } catch {} finally {
      setPingingId(null);
    }
  };

  const handleToggleArchive = async () => {
    const nextArchived = !repository.archived;
    if (!confirm(`Are you sure you want to ${nextArchived ? "archive" : "unarchive"} this repository?`)) return;

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: nextArchived }),
      });
      if (res.ok) onRefresh();
    } catch {}
  };

  const handleDeleteRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmDeleteName !== repository.name) {
      setDeleteError(`Please type '${repository.name}' exactly.`);
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(
        `/api/v1/repositories/${owner}/${repo}?confirmName=${encodeURIComponent(confirmDeleteName)}`,
        { method: "DELETE" }
      );
      const d = await res.json().catch(() => null);

      if (res.ok && d?.data?.success) {
        router.push("/repositories");
      } else {
        setDeleteError(d?.error?.message || "Failed to delete repository.");
        setDeleting(false);
      }
    } catch {
      setDeleteError("Failed to delete repository.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl space-y-10">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Settings size={18} className="text-indigo-400" /> Repository Settings
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">Manage repository details, branch protection, and webhooks.</p>
      </div>

      {/* 1. General Settings Form */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-white/10 pb-3">General</h3>

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Repository Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full sm:w-80 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Default Branch</label>
              <input
                type="text"
                required
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Visibility</label>
              <select
                value={visibility}
                onChange={(e: any) => setVisibility(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="PUBLIC">Public</option>
                <option value="PRIVATE">Private</option>
              </select>
            </div>
          </div>

          {generalMsg && <p className="text-xs text-indigo-300">{generalMsg}</p>}

          <button
            type="submit"
            disabled={savingGeneral}
            className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            {savingGeneral ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

      {/* 2. Webhooks Section */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-white/10 pb-3 flex items-center gap-2">
          <Webhook size={16} className="text-indigo-400" /> Webhooks
        </h3>

        <form onSubmit={handleAddWebhook} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="url"
              required
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              placeholder="Payload URL (e.g. https://api.my-service.com/webhook)"
              className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
            <input
              type="text"
              value={newWebhookSecret}
              onChange={(e) => setNewWebhookSecret(e.target.value)}
              placeholder="Secret (optional, HMAC SHA-256)"
              className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={addingWebhook || !newWebhookUrl.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            {addingWebhook ? "Adding…" : "Add webhook"}
          </button>
        </form>

        {/* Existing Webhooks List */}
        {webhooks.length > 0 && (
          <div className="pt-3 space-y-3 border-t border-white/5">
            {webhooks.map((wh) => (
              <div key={wh.id} className="rounded-xl border border-white/5 bg-zinc-950 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-slate-200 truncate max-w-md">{wh.url}</span>
                  <button
                    onClick={() => handlePingWebhook(wh.id)}
                    disabled={pingingId === wh.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:text-white"
                  >
                    <Send size={12} /> {pingingId === wh.id ? "Pinging…" : "Ping"}
                  </button>
                </div>

                {/* Recent Deliveries */}
                {wh.deliveries?.length > 0 && (
                  <div className="text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">Last delivery: </span>
                    <span className={wh.deliveries[0].statusCode === 200 ? "text-emerald-400" : "text-amber-400"}>
                      HTTP {wh.deliveries[0].statusCode || "ERR"}
                    </span>{" "}
                    ({wh.deliveries[0].durationMs}ms)
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Danger Zone */}
      <section className="rounded-2xl border border-red-500/30 bg-red-950/10 p-6 space-y-4">
        <h3 className="text-sm font-bold text-red-400 border-b border-red-500/20 pb-3 flex items-center gap-2">
          <AlertTriangle size={16} /> Danger Zone
        </h3>

        {/* Archive toggle */}
        <div className="flex items-center justify-between py-2 border-b border-white/5">
          <div>
            <h4 className="text-xs font-semibold text-white">
              {repository.archived ? "Unarchive this repository" : "Archive this repository"}
            </h4>
            <p className="text-[11px] text-slate-400">
              {repository.archived
                ? "Restore write access, new commits, and issues."
                : "Mark this repository as read-only. Commits and issues cannot be added."}
            </p>
          </div>
          <button
            onClick={handleToggleArchive}
            className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
          >
            <Archive size={13} className="inline mr-1" />
            {repository.archived ? "Unarchive" : "Archive"}
          </button>
        </div>

        {/* Delete Repository */}
        <div className="space-y-3 pt-2">
          <div>
            <h4 className="text-xs font-bold text-red-400">Delete this repository</h4>
            <p className="text-[11px] text-slate-400">
              Once deleted, all Git commits, branches, issues, and pull requests are permanently destroyed.
            </p>
          </div>

          <form onSubmit={handleDeleteRepository} className="space-y-3">
            <p className="text-[11px] text-slate-300">
              Please type <span className="font-bold text-white">{repository.name}</span> to confirm:
            </p>
            <input
              type="text"
              required
              value={confirmDeleteName}
              onChange={(e) => setConfirmDeleteName(e.target.value)}
              placeholder={repository.name}
              className="w-full sm:w-80 rounded-xl border border-red-500/30 bg-zinc-950 px-3.5 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
            />

            {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}

            <button
              type="submit"
              disabled={deleting || confirmDeleteName !== repository.name}
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-red-500 disabled:opacity-40"
            >
              <Trash2 size={13} />
              {deleting ? "Deleting…" : "I understand, delete this repository"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

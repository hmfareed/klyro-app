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
  RotateCcw,
  Clock,
  Eye,
  FileCode,
  X,
  History,
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
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalMsg, setGeneralMsg] = useState("");

  // Visibility state & modal
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [targetVisibility, setTargetVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [scanningSecrets, setScanningSecrets] = useState(false);
  const [secretFindings, setSecretFindings] = useState<any[]>([]);
  const [forceWarnings, setForceWarnings] = useState(false);
  const [changingVisibility, setChangingVisibility] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");

  // Webhooks state
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookSecret, setNewWebhookSecret] = useState("");
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);

  // Danger zone state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = useState("");
  const [cancelWorkflows, setCancelWorkflows] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [archiving, setArchiving] = useState(false);

  // Audit log state
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadWebhooks = () => {
    fetch(`/api/v1/repositories/${owner}/${repo}/webhooks`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data?.webhooks) setWebhooks(d.data.webhooks);
      })
      .catch(() => {});
  };

  const loadAuditEvents = () => {
    setLoadingAudit(true);
    fetch(`/api/v1/repositories/${owner}/${repo}/audit-log`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.data?.events) setAuditEvents(d.data.events);
      })
      .catch(() => {})
      .finally(() => setLoadingAudit(false));
  };

  useEffect(() => {
    loadWebhooks();
    loadAuditEvents();
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

  // Visibility change handlers
  const handleOpenVisibilityModal = (nextVis: "PUBLIC" | "PRIVATE") => {
    setTargetVisibility(nextVis);
    setVisibilityError("");
    setForceWarnings(false);
    setSecretFindings([]);
    setShowVisibilityModal(true);

    if (nextVis === "PUBLIC") {
      setScanningSecrets(true);
      fetch(`/api/v1/repositories/${owner}/${repo}/secret-scan`, { method: "POST" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.data?.findings) {
            setSecretFindings(d.data.findings);
          }
        })
        .catch(() => {})
        .finally(() => setScanningSecrets(false));
    }
  };

  const handleConfirmVisibilityChange = async () => {
    setChangingVisibility(true);
    setVisibilityError("");

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility: targetVisibility,
          forceWithWarnings: forceWarnings,
        }),
      });

      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.repository) {
        setShowVisibilityModal(false);
        onRefresh();
        loadAuditEvents();
      } else if (d?.error?.code === "SECRETS_DETECTED") {
        setSecretFindings(d.error.details || []);
        setVisibilityError("Potential secrets detected in repository. Review and acknowledge risks to continue.");
      } else {
        setVisibilityError(d?.error?.message || "Failed to change visibility.");
      }
    } catch {
      setVisibilityError("Network error while updating visibility.");
    } finally {
      setChangingVisibility(false);
    }
  };

  // Webhook handlers
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

  // Archive handler
  const handleToggleArchive = async () => {
    const nextArchived = !repository.archived;
    if (
      !confirm(
        `Are you sure you want to ${
          nextArchived
            ? "archive this repository? It will become read-only and pushes/issues will be disabled."
            : "unarchive this repository? Full read-write functionality will be restored."
        }`
      )
    ) {
      return;
    }

    setArchiving(true);
    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: nextArchived }),
      });
      if (res.ok) {
        onRefresh();
        loadAuditEvents();
      }
    } catch {} finally {
      setArchiving(false);
    }
  };

  // Soft Deletion handler (30 days retention)
  const handleScheduleDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanConfirm = confirmDeleteName.trim().toLowerCase();
    const cleanRepoName = repository.name.trim().toLowerCase();
    const cleanFullSlug = `${owner}/${repository.name}`.toLowerCase();

    if (cleanConfirm !== cleanRepoName && cleanConfirm !== cleanFullSlug && cleanConfirm !== repository.slug.toLowerCase()) {
      setDeleteError(`Please type '${repository.name}' exactly.`);
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationName: confirmDeleteName.trim(),
          cancelActiveWorkflows: cancelWorkflows,
        }),
      });

      const d = await res.json().catch(() => null);

      if (res.ok && d?.data?.success) {
        setShowDeleteModal(false);
        router.push("/repositories");
      } else {
        setDeleteError(d?.error?.message || "Failed to schedule deletion.");
        setDeleting(false);
      }
    } catch {
      setDeleteError("Failed to schedule deletion.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-4xl space-y-10">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Settings size={18} className="text-indigo-400" /> Repository Settings
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage repository general configuration, visibility transitions, and lifecycle retention.
        </p>
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

          <div className="w-full sm:w-80">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Default Branch</label>
            <input
              type="text"
              required
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white font-mono focus:border-indigo-500 focus:outline-none"
            />
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

      {/* 2. Visibility Controls Section */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-white/10 pb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield size={16} className="text-indigo-400" /> Visibility Controls
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300">
            {repository.visibility === "PRIVATE" ? <Lock size={12} className="text-amber-400" /> : <Globe size={12} className="text-emerald-400" />}
            {repository.visibility}
          </span>
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
          <div>
            <h4 className="text-xs font-semibold text-white">
              {repository.visibility === "PUBLIC" ? "Make this repository private" : "Make this repository public"}
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed max-w-lg">
              {repository.visibility === "PUBLIC"
                ? "Restricts access so only you and invited collaborators can view this code, branches, and issues. Unauthorized visitors receive a 404 Not Found."
                : "Allows anyone on the internet to view, clone, and fork this repository. Klyro will run a sensitive secret check before enabling public access."}
            </p>
          </div>

          <button
            onClick={() => handleOpenVisibilityModal(repository.visibility === "PUBLIC" ? "PRIVATE" : "PUBLIC")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 shrink-0 cursor-pointer"
          >
            Change visibility
          </button>
        </div>
      </section>

      {/* 3. Webhooks Section */}
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

      {/* 4. Audit Log Timeline Section */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-white border-b border-white/10 pb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <History size={16} className="text-indigo-400" /> Lifecycle Audit Log
          </span>
          <button
            onClick={loadAuditEvents}
            disabled={loadingAudit}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            {loadingAudit ? "Loading…" : "Refresh"}
          </button>
        </h3>

        {auditEvents.length === 0 ? (
          <p className="text-xs text-slate-500 py-3">No lifecycle events recorded yet for this repository.</p>
        ) : (
          <div className="space-y-3 pt-1">
            {auditEvents.map((evt) => {
              const actionColors: Record<string, string> = {
                REPOSITORY_VISIBILITY_CHANGED: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                REPOSITORY_ARCHIVED: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                REPOSITORY_UNARCHIVED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                REPOSITORY_DELETION_SCHEDULED: "text-red-400 bg-red-500/10 border-red-500/20",
                REPOSITORY_RESTORED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                REPOSITORY_PURGED: "text-red-500 bg-red-500/10 border-red-500/20",
              };
              const colorClass = actionColors[evt.action] || "text-slate-300 bg-white/5 border-white/10";

              return (
                <div key={evt.id} className="rounded-xl border border-white/5 bg-zinc-950 p-3.5 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-mono font-semibold ${colorClass}`}>
                      {evt.action.replace("REPOSITORY_", "")}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(evt.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-300 pt-1">
                    <span className="font-semibold text-white">{evt.actor?.displayName || evt.actor?.username || "System"}</span>
                    {evt.previousValue && evt.newValue && (
                      <span className="text-slate-400">
                        changed from <span className="font-mono text-slate-200">{evt.previousValue}</span> to{" "}
                        <span className="font-mono text-white">{evt.newValue}</span>
                      </span>
                    )}
                  </div>

                  {evt.ipAddress && (
                    <div className="text-[10px] text-slate-500 font-mono">
                      IP: {evt.ipAddress} {evt.userAgent ? `· ${evt.userAgent.slice(0, 40)}…` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5. Danger Zone */}
      <section className="rounded-2xl border border-red-500/30 bg-red-950/10 p-6 space-y-4">
        <h3 className="text-sm font-bold text-red-400 border-b border-red-500/20 pb-3 flex items-center gap-2">
          <AlertTriangle size={16} /> Danger Zone
        </h3>

        {/* Archive toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-white/5">
          <div>
            <h4 className="text-xs font-semibold text-white">
              {repository.archived ? "Unarchive this repository" : "Archive this repository"}
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-lg leading-relaxed">
              {repository.archived
                ? "Restores full write access. Commits, issues, and pull requests can once again be accepted."
                : "Marks this repository as read-only. Push access, new issues, and pull request changes are blocked."}
            </p>
          </div>
          <button
            onClick={handleToggleArchive}
            disabled={archiving}
            className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 shrink-0 cursor-pointer"
          >
            <Archive size={13} className="inline mr-1" />
            {archiving ? "Updating…" : repository.archived ? "Unarchive" : "Archive"}
          </button>
        </div>

        {/* Delete Repository with 30-Day Retention */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <h4 className="text-xs font-bold text-red-400">Delete this repository</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 max-w-lg leading-relaxed">
              Initiates a 30-day retention grace period. Your bare Git repository and records are preserved, and can be restored at any time during the grace period from the Deleted Repositories page.
            </p>
          </div>

          <button
            onClick={() => {
              setConfirmDeleteName("");
              setDeleteError("");
              setShowDeleteModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-red-500 shrink-0 cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Delete repository</span>
          </button>
        </div>
      </section>

      {/* Visibility Modal with Secret Scanning */}
      {showVisibilityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Shield size={16} className="text-indigo-400" />
                Change visibility to {targetVisibility}
              </h3>
              <button
                onClick={() => setShowVisibilityModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {targetVisibility === "PUBLIC" ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Making this repository <strong>Public</strong> will allow anyone on the internet to view its code, commits, issues, and pull requests.
                </p>

                {/* Pre-flight scanner state */}
                {scanningSecrets ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-3 text-xs text-slate-300">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent shrink-0" />
                    <span>Running pre-flight secret scan across repository files…</span>
                  </div>
                ) : secretFindings.length > 0 ? (
                  <div className="rounded-xl border border-red-500/40 bg-red-950/20 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-red-400">
                      <AlertTriangle size={15} />
                      <span>{secretFindings.length} Potential Secret(s) or Sensitive File(s) Detected</span>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                      {secretFindings.map((f, i) => (
                        <div key={i} className="rounded-lg border border-red-500/20 bg-black/40 p-2.5 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-red-200">{f.path}</span>
                            <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300 font-mono">
                              {f.rule}
                            </span>
                          </div>
                          <div className="text-slate-400">{f.description}</div>
                          <div className="font-mono text-zinc-300">{f.preview}</div>
                        </div>
                      ))}
                    </div>

                    <label className="flex items-start gap-2 pt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={forceWarnings}
                        onChange={(e) => setForceWarnings(e.target.checked)}
                        className="mt-0.5 rounded border-white/20 bg-zinc-900 text-indigo-600 focus:ring-0"
                      />
                      <span className="text-[11px] text-red-200">
                        I understand the risks of making detected secrets publicly accessible and choose to proceed.
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 flex items-center gap-2.5 text-xs text-emerald-300">
                    <Check size={16} className="shrink-0" />
                    <span>Pre-flight secret scan complete. No obvious secrets or sensitive keys found.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Making this repository <strong>Private</strong> will restrict access exclusively to you and explicitly granted collaborators.
                </p>
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 text-xs text-amber-200 leading-relaxed">
                  All current collaborators will retain their access. Public stars and anonymous cloning will be disabled.
                </div>
              </div>
            )}

            {visibilityError && <p className="text-xs text-red-400">{visibilityError}</p>}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowVisibilityModal(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVisibilityChange}
                disabled={
                  changingVisibility ||
                  scanningSecrets ||
                  (targetVisibility === "PUBLIC" && secretFindings.length > 0 && !forceWarnings)
                }
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40 cursor-pointer"
              >
                {changingVisibility ? "Updating…" : `Confirm make ${targetVisibility.toLowerCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal with 30-Day Retention Notice */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
              <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                <AlertTriangle size={16} /> Schedule Repository Deletion
              </h3>
              <button onClick={() => setShowDeleteModal(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This repository will be scheduled for permanent deletion in <strong>30 days</strong>.
              During this retention period:
            </p>

            <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc pl-4">
              <li>Your Git commit history, branches, and database records remain intact.</li>
              <li>Public access, incoming webhooks, and CI actions will be paused.</li>
              <li>You can restore this repository at any time with 1 click from your Deleted Repositories page.</li>
            </ul>

            <form onSubmit={handleScheduleDeletion} className="space-y-4 pt-2">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cancelWorkflows}
                  onChange={(e) => setCancelWorkflows(e.target.checked)}
                  className="rounded border-white/20 bg-zinc-900 text-red-600"
                />
                <span>Cancel any currently running workflows</span>
              </label>

              <div>
                <p className="text-[11px] text-slate-300 mb-1.5">
                  Please type <span className="font-bold text-white">{repository.name}</span> to confirm:
                </p>
                <input
                  type="text"
                  required
                  value={confirmDeleteName}
                  onChange={(e) => setConfirmDeleteName(e.target.value)}
                  placeholder={repository.name}
                  className="w-full rounded-xl border border-red-500/30 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              {deleteError && <p className="text-xs text-red-400">{deleteError}</p>}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    deleting ||
                    (confirmDeleteName.trim().toLowerCase() !== repository.name.trim().toLowerCase() &&
                      confirmDeleteName.trim().toLowerCase() !== `${owner}/${repository.name}`.toLowerCase() &&
                      confirmDeleteName.trim().toLowerCase() !== repository.slug.toLowerCase())
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-2 text-xs font-semibold text-white shadow hover:bg-red-500 disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>{deleting ? "Scheduling…" : "I understand, delete this repository"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  PlaySquare,
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  ArrowLeft,
  Terminal,
  Loader2,
  GitBranch,
  GitCommit,
  Copy,
  Check,
  Ban,
  FileCode,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface RepoActionsViewProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  viewer: any;
}

interface StepRecord {
  name: string;
  status: "SUCCESS" | "FAILURE" | "SKIPPED";
  durationMs: number;
  exitCode: number;
  logs: string;
}

export function RepoActionsView({
  owner,
  repo,
  defaultBranch,
  viewer,
}: RepoActionsViewProps) {
  const [runs, setRuns] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedWorkflowPath, setSelectedWorkflowPath] = useState<string>("");
  const [targetBranch, setTargetBranch] = useState(defaultBranch || "main");
  const [copied, setCopied] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});

  const loadRuns = () => {
    fetch(`/api/v1/repositories/${owner}/${repo}/actions`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        const list = d?.runs || d?.data?.runs;
        if (list) setRuns(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadWorkflows = () => {
    fetch(`/api/v1/repositories/${owner}/${repo}/actions/workflows?ref=${encodeURIComponent(defaultBranch || "main")}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        const wf = d?.workflows || d?.data?.workflows;
        if (Array.isArray(wf)) {
          setWorkflows(wf);
          if (wf.length > 0 && !selectedWorkflowPath) {
            setSelectedWorkflowPath(wf[0].path);
          }
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadRuns();
    loadWorkflows();
  }, [owner, repo, defaultBranch]);

  // Polling when active run is viewed or runs are in progress
  useEffect(() => {
    const hasActiveRun = runs.some((r) => r.status === "RUNNING" || r.status === "QUEUED");
    const activeSelected = selectedRun && (selectedRun.status === "RUNNING" || selectedRun.status === "QUEUED");

    if (!hasActiveRun && !activeSelected) return;

    const interval = setInterval(() => {
      loadRuns();
      if (selectedRun) {
        fetch(`/api/v1/repositories/${owner}/${repo}/actions/${selectedRun.id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((d) => {
            const r = d?.run || d?.data?.run;
            if (r) setSelectedRun(r);
          })
          .catch(() => {});
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [runs, selectedRun, owner, repo]);

  const handleTriggerRun = async () => {
    setTriggering(true);
    try {
      const selectedWf = workflows.find((w) => w.path === selectedWorkflowPath);
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowPath: selectedWorkflowPath || undefined,
          workflowName: selectedWf?.name || "CI Pipeline",
          branch: targetBranch || defaultBranch || "main",
          async: false,
        }),
      });
      const d = await res.json().catch(() => null);
      const newRun = d?.run || d?.data?.run;
      if (res.ok && newRun) {
        setRuns((prev) => [newRun, ...prev.filter((r) => r.id !== newRun.id)]);
        setSelectedRun(newRun);
        setShowDispatchModal(false);
      }
    } catch (err) {
      console.error("Trigger error:", err);
    } finally {
      setTriggering(false);
    }
  };

  const handleCancelRun = async (runId: string) => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/actions/${runId}`, {
        method: "POST",
      });
      const d = await res.json().catch(() => null);
      const updated = d?.run || d?.data?.run;
      if (res.ok && updated) {
        setSelectedRun(updated);
        setRuns((prev) => prev.map((r) => (r.id === runId ? updated : r)));
      }
    } catch {} finally {
      setCancelling(false);
    }
  };

  const copyLogs = (logs: string) => {
    navigator.clipboard.writeText(logs || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCESS":
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={12} /> Success
          </span>
        );
      case "FAILURE":
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle size={12} /> Failed
          </span>
        );
      case "RUNNING":
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Loader2 size={12} className="animate-spin" /> In Progress
          </span>
        );
      case "QUEUED":
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock size={12} /> Queued
          </span>
        );
      case "CANCELLED":
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <Ban size={12} /> Cancelled
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/5 text-slate-400">
            {status}
          </span>
        );
    }
  };

  // Run Detail view
  if (selectedRun) {
    const steps: StepRecord[] = Array.isArray(selectedRun.steps) ? selectedRun.steps : [];

    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedRun(null)}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to all workflow runs
          </button>

          {(selectedRun.status === "RUNNING" || selectedRun.status === "QUEUED") && viewer.canWrite && (
            <button
              onClick={() => handleCancelRun(selectedRun.id)}
              disabled={cancelling}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Ban size={12} />
              <span>{cancelling ? "Cancelling…" : "Cancel run"}</span>
            </button>
          )}
        </div>

        {/* Run Summary Header */}
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {renderStatusBadge(selectedRun.status)}
              <h1 className="text-base font-bold text-white">{selectedRun.workflowName}</h1>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1 font-mono">
                <Clock size={13} className="text-slate-500" />
                {(selectedRun.durationMs / 1000).toFixed(1)}s
              </span>
              <span>•</span>
              <span className="text-slate-400">
                {new Date(selectedRun.createdAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1 border-t border-white/5">
            <span className="flex items-center gap-1">
              <GitBranch size={13} className="text-indigo-400" />
              <span className="font-mono text-indigo-300">{selectedRun.branch}</span>
            </span>
            <span className="flex items-center gap-1">
              <GitCommit size={13} className="text-slate-500" />
              <span className="font-mono text-slate-300">{selectedRun.commitSha.slice(0, 7)}</span>
            </span>
            <span className="px-2 py-0.5 rounded bg-white/[0.04] text-[11px] font-mono text-slate-400">
              event: {selectedRun.event}
            </span>
            {selectedRun.workflowPath && (
              <span className="flex items-center gap-1 text-slate-500">
                <FileCode size={12} />
                <span className="font-mono">{selectedRun.workflowPath}</span>
              </span>
            )}
          </div>
        </div>

        {/* Step Breakdown */}
        {steps.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
              Job Steps ({steps.length})
            </h3>
            <div className="rounded-2xl border border-white/10 bg-zinc-950 divide-y divide-white/5 overflow-hidden">
              {steps.map((st, idx) => {
                const isExpanded = Boolean(expandedSteps[idx]);
                return (
                  <div key={idx} className="group">
                    <div
                      onClick={() =>
                        setExpandedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }))
                      }
                      className="flex items-center justify-between p-3.5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {st.status === "SUCCESS" && (
                          <span className="text-emerald-400">
                            <CheckCircle2 size={15} />
                          </span>
                        )}
                        {st.status === "FAILURE" && (
                          <span className="text-rose-400">
                            <XCircle size={15} />
                          </span>
                        )}
                        {st.status === "SKIPPED" && (
                          <span className="text-slate-600">
                            <Clock size={15} />
                          </span>
                        )}
                        <span className="text-xs font-medium text-white">{st.name}</span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        {st.durationMs > 0 && <span>{(st.durationMs / 1000).toFixed(2)}s</span>}
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    </div>

                    {isExpanded && st.logs && (
                      <div className="bg-black/60 p-3 font-mono text-[11px] text-slate-300 border-t border-white/5 whitespace-pre overflow-x-auto leading-relaxed">
                        {st.logs}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Full Terminal Console */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#07090e] font-mono text-xs shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2.5 text-slate-400">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-indigo-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Complete Console Output
              </span>
            </div>
            <button
              onClick={() => copyLogs(selectedRun.logs || "")}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy logs"}</span>
            </button>
          </div>
          <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed text-slate-200 whitespace-pre max-h-[500px]">
            {selectedRun.logs || "No log output available."}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <PlaySquare size={18} className="text-indigo-400" /> Actions &amp; CI/CD
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Continuous integration pipelines, automated tests, and build runner sandboxes.
          </p>
        </div>

        {viewer.canWrite && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDispatchModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-950/40 hover:bg-indigo-500 active:scale-[0.98] transition-all cursor-pointer"
            >
              <Play size={13} fill="currentColor" />
              <span>Run workflow</span>
            </button>
          </div>
        )}
      </div>

      {/* Discovered Workflows Bar */}
      {workflows.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-zinc-950/80 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <FileCode size={15} className="text-indigo-400" />
            <span className="font-medium">Detected Workflows:</span>
            <div className="flex flex-wrap items-center gap-2">
              {workflows.map((wf) => (
                <span
                  key={wf.path}
                  className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/10 text-[11px] font-mono text-indigo-300"
                >
                  {wf.name} ({wf.path})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Workflow Runs List */}
      {loading ? (
        <div className="flex items-center justify-center p-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : runs.length === 0 ? (
        <div className="p-16 text-center text-xs text-slate-500 rounded-2xl border border-white/5 bg-zinc-950">
          <PlaySquare size={36} className="mx-auto mb-3 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-300 mb-1">No workflow runs found</h3>
          <p className="max-w-md mx-auto text-slate-500 mb-4">
            Push code with a <code className="font-mono text-indigo-400">.klyro/workflows/ci.yml</code> workflow file or click &quot;Run workflow&quot; to test your build and test pipelines.
          </p>
          {viewer.canWrite && (
            <button
              onClick={() => setShowDispatchModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-all cursor-pointer"
            >
              <Play size={12} fill="currentColor" />
              <span>Dispatch first workflow</span>
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-sm divide-y divide-white/5">
          {runs.map((run) => (
            <div
              key={run.id}
              onClick={() => setSelectedRun(run)}
              className="flex items-center justify-between p-4 hover:bg-white/[0.03] transition-colors cursor-pointer group"
            >
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5">
                  {run.status === "SUCCESS" && <CheckCircle2 size={17} className="text-emerald-400" />}
                  {run.status === "FAILURE" && <XCircle size={17} className="text-rose-400" />}
                  {run.status === "RUNNING" && <Loader2 size={17} className="text-sky-400 animate-spin" />}
                  {run.status === "QUEUED" && <Clock size={17} className="text-amber-400" />}
                  {run.status === "CANCELLED" && <Ban size={17} className="text-zinc-500" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-white group-hover:text-indigo-400 transition-colors">
                      {run.workflowName}
                    </h3>
                    <span className="font-mono text-[10px] text-slate-500 px-1.5 py-0.2 bg-white/5 rounded">
                      {run.commitSha?.slice(0, 7) || "HEAD"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                    <span>{run.event}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono text-indigo-300">
                      <GitBranch size={11} /> {run.branch}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-mono">
                  <Clock size={12} /> {(run.durationMs / 1000).toFixed(1)}s
                </span>
                <span className="text-indigo-400 group-hover:text-indigo-300 font-medium">View logs →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Dispatch Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Play size={14} className="text-indigo-400" /> Run Workflow
              </h3>
              <button
                onClick={() => setShowDispatchModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Workflow
                </label>
                {workflows.length > 0 ? (
                  <select
                    value={selectedWorkflowPath}
                    onChange={(e) => setSelectedWorkflowPath(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {workflows.map((w) => (
                      <option key={w.path} value={w.path}>
                        {w.name} ({w.path})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={selectedWorkflowPath || "CI / Build & Test"}
                    onChange={(e) => setSelectedWorkflowPath(e.target.value)}
                    placeholder="Workflow Name or Path"
                    className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Target Branch
                </label>
                <input
                  type="text"
                  value={targetBranch}
                  onChange={(e) => setTargetBranch(e.target.value)}
                  placeholder="main"
                  className="w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTriggerRun}
                  disabled={triggering}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  {triggering ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
                  <span>{triggering ? "Dispatching…" : "Dispatch run"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

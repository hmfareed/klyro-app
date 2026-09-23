"use client";

import { useEffect, useState } from "react";
import { PlaySquare, CheckCircle2, XCircle, Clock, Play, ArrowLeft, Terminal } from "lucide-react";

interface RepoActionsViewProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  viewer: any;
}

export function RepoActionsView({
  owner,
  repo,
  defaultBranch,
  viewer,
}: RepoActionsViewProps) {
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  const loadRuns = () => {
    setLoading(true);
    fetch(`/api/v1/repositories/${owner}/${repo}/actions`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.data?.runs) setRuns(d.data.runs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRuns();
  }, [owner, repo]);

  const handleTriggerRun = async () => {
    setTriggering(true);
    try {
      const res = await fetch(`/api/v1/repositories/${owner}/${repo}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowName: "CI / Build & Test", branch: defaultBranch }),
      });
      const d = await res.json().catch(() => null);
      if (res.ok && d?.data?.run) {
        setRuns((prev) => [d.data.run, ...prev]);
        setSelectedRun(d.data.run);
      }
    } catch {} finally {
      setTriggering(false);
    }
  };

  // Run Detail view
  if (selectedRun) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <button
          onClick={() => setSelectedRun(null)}
          className="text-xs font-semibold text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <ArrowLeft size={13} /> Back to action runs
        </button>

        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-emerald-400">
                <CheckCircle2 size={18} />
              </span>
              <h2 className="text-base font-bold text-white">{selectedRun.workflowName}</h2>
            </div>
            <p className="text-xs text-slate-400">
              Triggered via <span className="text-slate-300 font-mono">{selectedRun.event}</span> on branch{" "}
              <span className="text-indigo-400 font-mono">{selectedRun.branch}</span> • {(selectedRun.durationMs / 1000).toFixed(1)}s
            </p>
          </div>
        </div>

        {/* Logs terminal box */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 font-mono text-xs shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2 text-slate-400">
            <Terminal size={14} className="text-indigo-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Execution Logs</span>
          </div>
          <pre className="overflow-x-auto p-4 text-[11px] leading-relaxed text-slate-200 whitespace-pre">
            {selectedRun.logs}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <PlaySquare size={16} className="text-indigo-400" /> Actions &amp; CI/CD
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Automated workflow checks, testing, and deployments.</p>
        </div>

        {viewer.canWrite && (
          <button
            onClick={handleTriggerRun}
            disabled={triggering}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-40 transition-all cursor-pointer"
          >
            <Play size={13} />
            <span>{triggering ? "Starting runner…" : "Run workflow"}</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : runs.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-500">
          <PlaySquare size={32} className="mx-auto mb-2 text-slate-600" />
          <p>No workflow runs yet. Click &quot;Run workflow&quot; to test your codebase checks.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-sm divide-y divide-white/5">
          {runs.map((run) => (
            <div
              key={run.id}
              onClick={() => setSelectedRun(run)}
              className="flex items-center justify-between p-4 hover:bg-white/[0.04] transition-colors cursor-pointer group"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-emerald-400">
                  <CheckCircle2 size={16} />
                </span>
                <div>
                  <h3 className="text-xs font-semibold text-white group-hover:text-indigo-400 transition-colors">
                    {run.workflowName}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {run.event} on <span className="font-mono text-indigo-300">{run.branch}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {(run.durationMs / 1000).toFixed(1)}s
                </span>
                <span className="text-indigo-400 group-hover:underline">View logs</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

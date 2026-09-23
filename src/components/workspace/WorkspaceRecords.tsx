"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, Lock, Plus, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Attestation {
  fromUserId: string;
  fromName: string;
  statement: string;
  rating: number;
}

interface RecordItem {
  id: string;
  recordHash: string;
  roleTitle: string;
  summary: string;
  tasksCompleted: number;
  commitsAuthored: number;
  issuedAt: string;
  isFinal: boolean;
  peerAttestations: Attestation[];
  user: { id: string; username: string; displayName: string | null };
  milestone: { id: string; title: string } | null;
}

interface TeamMember {
  userId: string;
  user: { id: string; username: string; displayName: string | null };
  role?: { title: string };
}

export function WorkspaceRecords({
  slug,
  isOwner,
  isMember,
  members,
}: {
  slug: string;
  isOwner: boolean;
  isMember: boolean;
  members: TeamMember[];
}) {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Draft Record Modal
  const [drafting, setDrafting] = useState(false);
  const [targetUserId, setTargetUserId] = useState("");
  const [summary, setSummary] = useState("");
  const [commits, setCommits] = useState(0);

  // Attest Modal
  const [attestingRecordId, setAttestingRecordId] = useState<string | null>(null);
  const [statement, setStatement] = useState("");
  const [rating, setRating] = useState(5);

  const fetchRecords = useCallback(() => {
    fetch(`/api/v1/projects/${slug}/records`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setRecords(data.data.records || []);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleDraftRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId || !summary.trim()) return;
    const res = await fetch(`/api/v1/projects/${slug}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contributorUserId: targetUserId,
        summary,
        commitsAuthored: commits,
      }),
    });
    if (res.ok) {
      setDrafting(false);
      setSummary("");
      fetchRecords();
    }
  };

  const handleAttest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attestingRecordId || !statement.trim()) return;
    const res = await fetch(`/api/v1/projects/${slug}/records/${attestingRecordId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement, rating }),
    });
    if (res.ok) {
      setAttestingRecordId(null);
      setStatement("");
      fetchRecords();
    }
  };

  const handleFinalize = async (recordId: string) => {
    if (!confirm("Finalize and seal this record? It will become permanently immutable and cryptographically certified.")) return;
    await fetch(`/api/v1/projects/${slug}/records/${recordId}`, {
      method: "PATCH",
    });
    fetchRecords();
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading contribution records...</div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div>
          <h2 className="text-base font-bold text-white">Verified Contribution Records</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Tamper-resistant cryptographic credentials issued to teammates upon milestone or task completion.
          </p>
        </div>

        {isOwner && (
          <button
            onClick={() => setDrafting(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm"
          >
            <Plus size={14} /> Draft Record
          </button>
        )}
      </div>

      <div className="p-6 space-y-4 max-w-4xl overflow-y-auto min-h-0">
        {records.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
            <ShieldCheck size={32} className="mx-auto text-slate-600 mb-2" />
            <h3 className="text-sm font-semibold text-white">No contribution records yet</h3>
            <p className="mt-1 text-xs text-slate-400">
              When collaborators ship milestones or complete tasks, draft a verified record to seal their contributions.
            </p>
          </div>
        ) : (
          records.map((r) => {
            const attestations = Array.isArray(r.peerAttestations) ? r.peerAttestations : [];
            return (
              <div
                key={r.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4 hover:border-white/20 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">
                        {r.user.displayName || r.user.username}
                      </span>
                      <span className="rounded bg-indigo-950/60 border border-indigo-700/50 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                        {r.roleTitle}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          r.isFinal
                            ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/40"
                            : "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                        }`}
                      >
                        {r.isFinal ? "Sealed (Immutable)" : "Draft"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono mt-1">
                      Hash: {r.recordHash.slice(0, 24)}...
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/records/${r.recordHash}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                    >
                      Certificate <ExternalLink size={12} />
                    </Link>

                    {!r.isFinal && isMember && (
                      <button
                        onClick={() => setAttestingRecordId(r.id)}
                        className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white"
                      >
                        Attest
                      </button>
                    )}

                    {!r.isFinal && isOwner && (
                      <button
                        onClick={() => handleFinalize(r.id)}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        <Lock size={12} /> Seal Record
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed italic bg-white/5 p-3 rounded-lg">
                  &ldquo;{r.summary}&rdquo;
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>
                    Verified Tasks Done: <b className="text-white">{r.tasksCompleted}</b>
                  </span>
                  <span>
                    Commits Authored: <b className="text-white">{r.commitsAuthored}</b>
                  </span>
                  <span>
                    Issued:{" "}
                    <b className="text-slate-200">
                      {new Date(r.issuedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                    </b>
                  </span>
                </div>

                {attestations.length > 0 && (
                  <div className="border-t border-white/10 pt-3 space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      Peer Attestations ({attestations.length})
                    </span>
                    {attestations.map((a, idx) => (
                      <div key={idx} className="rounded bg-black/30 p-2.5 text-xs text-slate-300">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                          <span className="font-semibold text-slate-200">{a.fromName}</span>
                          <span className="text-amber-400">★ {a.rating}/5</span>
                        </div>
                        <p className="text-[11px] text-slate-300">&ldquo;{a.statement}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {drafting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0f172a] p-6 text-white shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Draft Contribution Record</h3>
            <form onSubmit={handleDraftRecord} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Select Team Member *
                </label>
                <select
                  required
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Choose contributor...</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user.displayName || m.user.username} (@{m.user.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Impact & Accomplishments Summary *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detail the contributor's responsibilities, features delivered, and overall impact..."
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Commits Authored (Estimate)
                </label>
                <input
                  type="number"
                  min={0}
                  value={commits}
                  onChange={(e) => setCommits(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setDrafting(false)}
                  className="rounded-lg border border-white/10 px-3.5 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Generate Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {attestingRecordId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0f172a] p-6 text-white shadow-2xl">
            <h3 className="text-base font-bold text-white mb-4">Add Peer Attestation</h3>
            <form onSubmit={handleAttest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Your Endorsement / Statement *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Attest to their collaboration, code quality, communication, and teamwork..."
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Rating
                </label>
                <select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/10 bg-[#1e293b] px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value={5}>5 Stars - Outstanding</option>
                  <option value={4}>4 Stars - Great Collaboration</option>
                  <option value={3}>3 Stars - Satisfactory</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setAttestingRecordId(null)}
                  className="rounded-lg border border-white/10 px-3.5 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Submit Attestation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

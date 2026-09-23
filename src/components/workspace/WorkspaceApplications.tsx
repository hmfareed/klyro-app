"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, X, Mail } from "lucide-react";
import Link from "next/link";

interface Application {
  id: string;
  message: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  role: { id: string; title: string; permissionLevel: string };
  applicant: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
  };
}

export function WorkspaceApplications({ slug }: { slug: string }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const fetchApplications = useCallback(() => {
    fetch(`/api/v1/projects/${slug}/applications`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setApplications(data.data.applications || []);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleDecide = async (id: string, action: "ACCEPT" | "REJECT") => {
    setDecidingId(id);
    await fetch(`/api/v1/projects/${slug}/applications/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchApplications();
    setDecidingId(null);
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading applicant inbox...</div>;
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="border-b border-white/10 px-6 py-4">
        <h2 className="text-base font-bold text-white">Applicant Review Inbox</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Review candidates applying to your open project roles. Accepting an applicant automatically adds them to your active team roster.
        </p>
      </div>

      <div className="p-6 space-y-4 max-w-4xl overflow-y-auto min-h-0">
        {applications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-12 text-center">
            <Mail size={32} className="mx-auto text-slate-600 mb-2" />
            <h3 className="text-sm font-semibold text-white">No applications yet</h3>
            <p className="mt-1 text-xs text-slate-400">
              When developers or designers discover your project and apply to an open role, their pitches will appear here.
            </p>
          </div>
        ) : (
          applications.map((app) => (
            <div
              key={app.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3 hover:border-white/20 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 font-bold text-xs text-white">
                    {app.applicant.displayName?.[0] || app.applicant.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {app.applicant.displayName || app.applicant.username}
                      </span>
                      <Link
                        href={`/u/${app.applicant.username}`}
                        className="text-[11px] text-indigo-400 hover:underline"
                        target="_blank"
                      >
                        @{app.applicant.username}
                      </Link>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Applied for <b className="text-slate-200">{app.role.title}</b>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      app.status === "ACCEPTED"
                        ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/40"
                        : app.status === "REJECTED"
                        ? "bg-red-950/60 text-red-300 border border-red-800/40"
                        : "bg-amber-950/60 text-amber-300 border border-amber-800/40"
                    }`}
                  >
                    {app.status}
                  </span>

                  {app.status === "PENDING" && (
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={() => handleDecide(app.id, "ACCEPT")}
                        disabled={decidingId === app.id}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        <Check size={12} /> Accept
                      </button>
                      <button
                        onClick={() => handleDecide(app.id, "REJECT")}
                        disabled={decidingId === app.id}
                        className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white disabled:opacity-50"
                      >
                        <X size={12} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                  Applicant Pitch:
                </span>
                <p className="text-xs text-slate-200 bg-white/5 rounded-lg p-3 leading-relaxed whitespace-pre-line">
                  {app.message}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

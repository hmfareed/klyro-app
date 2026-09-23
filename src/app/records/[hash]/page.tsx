"use client";

import { use, useEffect, useState } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Closing } from "@/components/landing/Closing";
import {
  ShieldCheck,
  Award,
  Star,
  Copy,
  Check,
  Lock,
} from "lucide-react";
import Link from "next/link";

interface Attestation {
  fromUserId: string;
  fromName: string;
  statement: string;
  rating: number;
}

interface RecordData {
  id: string;
  recordHash: string;
  roleTitle: string;
  summary: string;
  tasksCompleted: number;
  commitsAuthored: number;
  issuedAt: string;
  isFinal: boolean;
  peerAttestations: Attestation[];
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
  };
  project: {
    id: string;
    slug: string;
    title: string;
    tagline: string;
    ipModel: string;
    owner: { username: string; displayName: string | null };
  };
  milestone: { id: string; title: string } | null;
}

export default function RecordVerificationPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = use(params);
  const [record, setRecord] = useState<RecordData | null>(null);
  const [verification, setVerification] = useState<{ isHashValid: boolean; isFinal: boolean; algorithm: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/records/${hash}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data) {
          setRecord(res.data.record);
          setVerification(res.data.verification);
        }
      })
      .finally(() => setLoading(false));
  }, [hash]);

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="mx-auto max-w-xl py-24 text-center">
          <ShieldCheck size={48} className="mx-auto text-slate-400 mb-3" />
          <h2 className="text-xl font-bold text-slate-900">Record Not Found</h2>
          <p className="mt-2 text-sm text-slate-600">No verified contribution record matches hash {hash.slice(0, 16)}...</p>
          <Link href="/projects" className="mt-4 inline-block text-sm text-blue-600 font-semibold">
            ← Explore Projects
          </Link>
        </div>
        <Closing />
      </div>
    );
  }

  const attestations = Array.isArray(record.peerAttestations) ? record.peerAttestations : [];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 py-12">
        {/* Certificate Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 md:p-10 shadow-lg">
          {/* Top Verification Ribbon */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
                <ShieldCheck size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Cryptographically Verified Record
                  </span>
                  {verification?.isHashValid && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      INTEGRITY VALID
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-sm sm:max-w-md">
                  SHA-256: {record.recordHash}
                </div>
              </div>
            </div>

            <button
              onClick={copyUrl}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? "Link Copied!" : "Share Certificate"}</span>
            </button>
          </div>

          {/* Certificate Body */}
          <div className="text-center py-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Contribution Certificate
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-extrabold text-slate-900">
              {record.user.displayName || record.user.username}
            </h1>
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <Award size={14} />
              <span>{record.roleTitle}</span>
            </div>
          </div>

          <div className="mt-6 text-center max-w-xl mx-auto">
            <p className="text-sm text-slate-700 leading-relaxed">
              Certified contribution to{" "}
              <Link href={`/projects/${record.project.slug}`} className="font-bold text-slate-900 underline hover:text-blue-600">
                {record.project.title}
              </Link>{" "}
              founded by @{record.project.owner.username}.
            </p>
            {record.summary && (
              <p className="mt-3 text-xs text-slate-600 italic bg-slate-50 rounded-lg p-3 border border-slate-100">
                &ldquo;{record.summary}&rdquo;
              </p>
            )}
          </div>

          {/* Stats Bar */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4 border-y border-slate-100 py-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{record.tasksCompleted}</div>
              <div className="text-xs text-slate-500 mt-0.5">Tasks Verified Done</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{record.commitsAuthored}</div>
              <div className="text-xs text-slate-500 mt-0.5">Commits Authored</div>
            </div>
            <div className="col-span-2 sm:col-span-1 text-center">
              <div className="text-sm font-semibold text-slate-900 mt-1">
                {new Date(record.issuedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Issued & Certified</div>
            </div>
          </div>

          {/* Peer Attestations */}
          {attestations.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Peer Attestations ({attestations.length})
              </h3>
              <div className="space-y-3">
                {attestations.map((att, idx) => (
                  <div key={idx} className="rounded-lg bg-slate-50 border border-slate-100 p-4">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-slate-800">{att.fromName}</span>
                      <div className="flex text-amber-400">
                        {Array.from({ length: att.rating || 5 }).map((_, i) => (
                          <Star key={i} size={12} fill="currentColor" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600">&ldquo;{att.statement}&rdquo;</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tamper Seal Footer */}
          <div className="mt-8 flex items-center justify-between text-[11px] text-slate-400 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <Lock size={12} className="text-emerald-600" />
              <span>Tamper-Resistant Klyro Protocol v1</span>
            </div>
            <div>
              Status: <span className="font-semibold text-slate-700">{record.isFinal ? "Sealed (Immutable)" : "Verified Draft"}</span>
            </div>
          </div>
        </div>
      </main>

      <Closing />
    </div>
  );
}

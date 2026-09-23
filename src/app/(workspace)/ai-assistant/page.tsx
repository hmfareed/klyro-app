"use client";

import { useState } from "react";
import {
  Sparkles,
  Cpu,
  Bot,
  GitPullRequest,
  ShieldCheck,
  CheckCircle2,
  Terminal,
} from "lucide-react";

export default function WorkspaceAIAssistantPage() {
  const [joined, setJoined] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto bg-black p-6 text-white min-w-0">
      {/* Banner */}
      <div className="mb-8 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/70 via-[#0d1430] to-purple-950/60 p-8 shadow-xl text-center max-w-3xl mx-auto">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-lg mb-4">
          <Sparkles size={28} />
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 mb-3">
          <Bot size={13} />
          <span>Klyro Intelligent Workspace Assistant • Beta</span>
        </span>

        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          AI Copilot for Engineering Teams
        </h1>
        <p className="mt-3 text-sm text-slate-300 leading-relaxed max-w-xl mx-auto">
          Context-aware AI assistance deeply integrated with your Git repositories, tasks, architecture diagrams, and cryptographic contribution records.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => setJoined(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg hover:from-indigo-500 hover:to-purple-500 transition-all"
          >
            {joined ? (
              <>
                <CheckCircle2 size={15} />
                <span>You&apos;re on the early access preview</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Join Phase 5 Early Access</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Feature Capabilities Preview Grid */}
      <div className="max-w-4xl mx-auto grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#09090b] p-5 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400">
            <GitPullRequest size={18} />
            <h3 className="font-semibold text-sm text-white">Automated PR Code Review</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Analyzes incoming branch diffs against project design guidelines, catches edge-case race conditions, and flags security vulnerabilities.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#09090b] p-5 space-y-2">
          <div className="flex items-center gap-2 text-purple-400">
            <Cpu size={18} />
            <h3 className="font-semibold text-sm text-white">Architectural Consistency Checker</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Ensures all new pull requests adhere to canonical Prisma models and API envelope standards outlined in the spec baseline.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#09090b] p-5 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck size={18} />
            <h3 className="font-semibold text-sm text-white">Contribution Attestation Assistant</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Aggregates merged pull requests, closed tasks, and code commit metrics to draft verifiable contribution certificates for team sign-off.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#09090b] p-5 space-y-2">
          <div className="flex items-center gap-2 text-amber-400">
            <Terminal size={18} />
            <h3 className="font-semibold text-sm text-white">Natural Language Sprint Breakdown</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Converts roadmap product specs into actionable Kanban tasks, priority tags, and milestone schedules.
          </p>
        </div>
      </div>
    </div>
  );
}

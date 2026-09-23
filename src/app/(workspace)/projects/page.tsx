"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  ArrowRight,
  Plus,
  Compass,
  Calendar,
  User,
} from "lucide-react";
import { openCreateProjectModal } from "@/components/workspace/WorkspaceCreateProjectModal";

interface ProjectBoard {
  id: string;
  name: string;
  repo: string;
  description: string;
  totalCards: number;
  completedCards: number;
  inProgressCards: number;
  dueDate: string;
  lead: string;
  columns: {
    todo: number;
    inProgress: number;
    inReview: number;
    done: number;
  };
}

const BOARDS: ProjectBoard[] = [
  {
    id: "board-1",
    name: "Q4 Core Infrastructure & Launch Roadmap",
    repo: "school-management-system",
    description: "Milestones for student registration, role permissions, and offline attendance validation.",
    totalCards: 18,
    completedCards: 12,
    inProgressCards: 4,
    dueDate: "Nov 30, 2026",
    lead: "Fareed",
    columns: { todo: 2, inProgress: 4, inReview: 0, done: 12 },
  },
  {
    id: "board-2",
    name: "Africart Merchant Marketplace Onboarding Sprint",
    repo: "africart-marketplace",
    description: "Vendor store creation, product variations, payment gateway escrow integration.",
    totalCards: 14,
    completedCards: 8,
    inProgressCards: 3,
    dueDate: "Dec 15, 2026",
    lead: "Abdul",
    columns: { todo: 3, inProgress: 3, inReview: 0, done: 8 },
  },
];

export default function WorkspaceProjectsPage() {
  const [boards] = useState<ProjectBoard[]>(BOARDS);

  return (
    <div className="flex-1 overflow-y-auto bg-[#0a0f24] p-6 text-white min-w-0">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderKanban size={20} className="text-indigo-400" />
            Project Boards & Roadmaps
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Coordinate sprints, track high-level roadmaps, and organize cross-functional deliverables.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
          >
            <Compass size={13} />
            <span>Explore Public Directory</span>
          </Link>
          <button
            onClick={openCreateProjectModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
          >
            <Plus size={14} /> New Project
          </button>
        </div>
      </div>

      {/* Boards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {boards.map((board) => {
          const percent = Math.round((board.completedCards / board.totalCards) * 100);
          return (
            <div
              key={board.id}
              className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#0b1226] p-6 shadow-sm hover:border-indigo-500/40 transition-all"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="rounded bg-indigo-950/80 border border-indigo-700/40 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                    {board.repo}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Calendar size={12} />
                    <span>Due {board.dueDate}</span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white">{board.name}</h3>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">{board.description}</p>

                {/* Progress Bar */}
                <div className="mt-5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Progress</span>
                    <span className="font-semibold text-white">{percent}% ({board.completedCards}/{board.totalCards} cards)</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Column Stats */}
                <div className="mt-5 grid grid-cols-4 gap-2 pt-4 border-t border-white/5 text-center">
                  <div className="rounded-lg bg-white/[0.02] p-2 border border-white/5">
                    <div className="text-base font-bold text-slate-400">{board.columns.todo}</div>
                    <div className="text-[10px] text-slate-500 font-medium">To Do</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] p-2 border border-white/5">
                    <div className="text-base font-bold text-blue-400">{board.columns.inProgress}</div>
                    <div className="text-[10px] text-slate-500 font-medium">In Progress</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] p-2 border border-white/5">
                    <div className="text-base font-bold text-purple-400">{board.columns.inReview}</div>
                    <div className="text-[10px] text-slate-500 font-medium">In Review</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.02] p-2 border border-white/5">
                    <div className="text-base font-bold text-emerald-400">{board.columns.done}</div>
                    <div className="text-[10px] text-slate-500 font-medium">Done</div>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-6 flex items-center justify-between pt-4 border-t border-white/5 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <User size={13} />
                  <span>Lead: <strong className="text-slate-300">{board.lead}</strong></span>
                </div>

                <Link
                  href={`/repositories/${board.repo}?tab=tasks`}
                  className="inline-flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  <span>Open Kanban Board</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

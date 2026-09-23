"use client";

import { useState } from "react";
import {
  Video,
  Calendar,
  Clock,
  Users,
  Copy,
  Play,
  Check,
} from "lucide-react";

interface Meeting {
  id: string;
  title: string;
  time: string;
  duration: string;
  participants: string[];
  status: "UPCOMING" | "LIVE" | "COMPLETED";
  link: string;
}

const MEETINGS: Meeting[] = [
  {
    id: "meet-1",
    title: "Daily Engineering Sync & Standup",
    time: "Today, 10:00 AM",
    duration: "30 min",
    participants: ["Fareed", "Abdul", "Maryam", "Kofi"],
    status: "LIVE",
    link: "https://klyro.dev/meet/daily-standup",
  },
  {
    id: "meet-2",
    title: "Architecture Review: Tamper-Evident SHA-256 Records",
    time: "Tomorrow, 2:00 PM",
    duration: "45 min",
    participants: ["Fareed", "Kofi"],
    status: "UPCOMING",
    link: "https://klyro.dev/meet/arch-records-v1",
  },
  {
    id: "meet-3",
    title: "Africart Merchant Payment Escrow Walkthrough",
    time: "Friday, 11:30 AM",
    duration: "60 min",
    participants: ["Fareed", "Abdul", "Ama"],
    status: "UPCOMING",
    link: "https://klyro.dev/meet/africart-escrow",
  },
];

export default function MeetingsPage() {
  const [meetings] = useState<Meeting[]>(MEETINGS);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyLink = (id: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-black p-6 text-white min-w-0">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Video size={20} className="text-purple-400" />
            Collaboration Rooms & Meetings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Hold instant code reviews, team standups, and architectural whiteboards.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
            <Calendar size={14} /> Schedule Meeting
          </button>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors">
            <Play size={13} /> Start Instant Room
          </button>
        </div>
      </div>

      {/* Meetings Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {meetings.map((meet) => (
          <div
            key={meet.id}
            className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#09090b] p-5 shadow-sm hover:border-indigo-500/40 transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                {meet.status === "LIVE" ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE NOW
                  </span>
                ) : (
                  <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                    Upcoming
                  </span>
                )}
                <span className="text-xs text-slate-400">{meet.duration}</span>
              </div>

              <h3 className="font-bold text-sm text-white mb-2">{meet.title}</h3>

              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-slate-500" />
                  <span>{meet.time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users size={13} className="text-slate-500" />
                  <span>{meet.participants.join(", ")}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
              <button
                onClick={() => copyLink(meet.id, meet.link)}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/10 transition-colors"
                title="Copy meeting link"
              >
                {copiedId === meet.id ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors text-center">
                {meet.status === "LIVE" ? "Join Call Now" : "Enter Room"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

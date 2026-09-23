"use client";

import { useState } from "react";
import {
  Users,
  Shield,
  Mail,
  UserPlus,
  Crown,
  FolderGit2,
  Award,
} from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  username: string;
  role: "OWNER" | "MAINTAINER" | "CONTRIBUTOR";
  title: string;
  email: string;
  avatarInitials: string;
  projectsCount: number;
  contributionsCount: number;
  status: "ONLINE" | "AWAY" | "OFFLINE";
}

const MEMBERS: TeamMember[] = [
  {
    id: "m-1",
    name: "Mohammed Fareed",
    username: "hmfareed",
    role: "OWNER",
    title: "Lead Full-Stack Architect",
    email: "mohammedfareed.dev@gmail.com",
    avatarInitials: "MF",
    projectsCount: 5,
    contributionsCount: 142,
    status: "ONLINE",
  },
  {
    id: "m-2",
    name: "Abdul Rahman",
    username: "abdul",
    role: "MAINTAINER",
    title: "Frontend Engineer & UI Systems",
    email: "abdul@klyro.dev",
    avatarInitials: "AR",
    projectsCount: 3,
    contributionsCount: 89,
    status: "ONLINE",
  },
  {
    id: "m-3",
    name: "Maryam Sani",
    username: "maryam",
    role: "CONTRIBUTOR",
    title: "Product Designer & QA Engineer",
    email: "maryam@klyro.dev",
    avatarInitials: "MS",
    projectsCount: 2,
    contributionsCount: 46,
    status: "AWAY",
  },
  {
    id: "m-4",
    name: "Kofi Mensah",
    username: "kofi",
    role: "CONTRIBUTOR",
    title: "DevOps & Cloud Infrastructure",
    email: "kofi@klyro.dev",
    avatarInitials: "KM",
    projectsCount: 3,
    contributionsCount: 38,
    status: "OFFLINE",
  },
  {
    id: "m-5",
    name: "Ama Serwaa",
    username: "ama",
    role: "CONTRIBUTOR",
    title: "Backend Engineer (Go & Node)",
    email: "ama@klyro.dev",
    avatarInitials: "AS",
    projectsCount: 1,
    contributionsCount: 22,
    status: "OFFLINE",
  },
];

export default function TeamsPage() {
  const [members, setMembers] = useState<TeamMember[]>(MEMBERS);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"CONTRIBUTOR" | "MAINTAINER">("CONTRIBUTOR");

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    const newMember: TeamMember = {
      id: `m-${Date.now()}`,
      name: inviteEmail.split("@")[0],
      username: inviteEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, ""),
      role: inviteRole,
      title: "Team Member",
      email: inviteEmail.trim(),
      avatarInitials: inviteEmail[0].toUpperCase(),
      projectsCount: 1,
      contributionsCount: 0,
      status: "ONLINE",
    };
    setMembers([...members, newMember]);
    setInviteEmail("");
    setInviteOpen(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-black p-6 text-white min-w-0">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} className="text-emerald-400" />
            Teams & Collaborators
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage organization members, assign roles, and review contribution statistics.
          </p>
        </div>

        <button
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition-colors"
        >
          <UserPlus size={14} /> Invite Collaborator
        </button>
      </div>

      {/* Team Roster Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#09090b] p-5 shadow-sm hover:border-indigo-500/40 transition-all"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow">
                      {member.avatarInitials}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#09090b] ${
                        member.status === "ONLINE"
                          ? "bg-emerald-500"
                          : member.status === "AWAY"
                          ? "bg-amber-500"
                          : "bg-slate-500"
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-white flex items-center gap-1.5">
                      {member.name}
                      {member.role === "OWNER" && (
                        <span title="Workspace Owner">
                          <Crown size={12} className="text-amber-400" />
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400">@{member.username}</p>
                  </div>
                </div>

                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                    member.role === "OWNER"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : member.role === "MAINTAINER"
                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                      : "bg-slate-500/10 border-slate-500/30 text-slate-300"
                  }`}
                >
                  {member.role}
                </span>
              </div>

              <p className="mt-3 text-xs text-slate-300 font-medium">{member.title}</p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 truncate">
                <Mail size={12} className="shrink-0" />
                <span className="truncate">{member.email}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <FolderGit2 size={13} className="text-indigo-400" />
                <span>{member.projectsCount} repos</span>
              </span>
              <span className="flex items-center gap-1">
                <Award size={13} className="text-purple-400" />
                <span>{member.contributionsCount} contributions</span>
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Permissions Breakdown */}
      <div className="rounded-xl border border-white/10 bg-[#09090b] p-6">
        <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <Shield size={16} className="text-indigo-400" />
          Workspace Permissions Matrix
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Roles define administrative powers, code review rights, and contributor attestation access.
        </p>

        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3.5 space-y-1.5">
            <span className="font-bold text-amber-400">OWNER</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Full workspace control, repository destruction, billing oversight, and candidate decision power.
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3.5 space-y-1.5">
            <span className="font-bold text-indigo-400">MAINTAINER</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Task assignment, branch protection, pull request reviews, and peer attestation sealing.
            </p>
          </div>
          <div className="rounded-lg bg-white/[0.02] border border-white/5 p-3.5 space-y-1.5">
            <span className="font-bold text-slate-300">CONTRIBUTOR</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Branch push access, discussion posting, task status updates, and peer review drafting.
            </p>
          </div>
        </div>
      </div>

      {/* Invite Member Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1430] p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus size={18} className="text-emerald-400" />
              Invite Collaborator
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Send an email invitation to join this developer workspace.
            </p>

            <form onSubmit={handleInvite} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="collaborator@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#09090b] px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Role Permission
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "CONTRIBUTOR" | "MAINTAINER")}
                  className="w-full rounded-lg border border-white/10 bg-[#09090b] px-3.5 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="CONTRIBUTOR">Contributor (Default)</option>
                  <option value="MAINTAINER">Maintainer</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

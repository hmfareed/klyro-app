import { FilePlus2, GitBranch, GitPullRequest, Lock, Timer, Upload } from "lucide-react";
import { activity, collaborators, repo } from "@/mock/workspace";

export function RightPanel() {
  return (
    <aside className="w-80 shrink-0 space-y-5 overflow-y-auto border-l border-white/10 bg-[#0b1226] p-4">
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Collaborators <span className="text-slate-400">{collaborators.count}</span></h3>
          <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">Invite</button>
        </div>
        <div className="mt-2 flex items-center">
          {collaborators.people.map((p, i) => (
            <span
              key={p}
              title={p}
              className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0b1226] bg-gradient-to-br from-slate-600 to-slate-800 text-[10px] font-bold text-white first:ml-0"
              style={{ zIndex: 10 - i }}
            >
              {p.slice(0, 2).toUpperCase()}
            </span>
          ))}
          <span className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0b1226] bg-white/10 text-[10px] font-bold text-slate-200">
            +{collaborators.extra}
          </span>
        </div>
      </section>

      <section className="space-y-2 text-sm">
        <h3 className="font-semibold text-white">About</h3>
        <p className="flex items-center gap-2 text-slate-300"><Lock size={14} /> Private repository</p>
        <p className="flex items-center gap-2 text-slate-300"><Timer size={14} /> Created 2 weeks ago</p>
        <p className="text-slate-300">Language<br /><span className="text-slate-200">🔵 TypeScript</span></p>
        <p className="text-slate-300">Main branch<br /><span className="text-slate-200">⎇ {repo.branch}</span></p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-white">Recent activity</h3>
        <ul className="mt-2 space-y-4">
          {activity.map((a, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white">
                {a.who.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-slate-300"><b className="text-white">{a.who}</b> {a.what}</p>
                <p className="text-xs text-slate-500">{a.when}</p>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-400">
                  {a.details.map((d) => <li key={d} className="truncate">◇ {d}</li>)}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-white">Quick actions</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          {[FilePlus2, Upload, GitBranch, GitPullRequest].map((Icon, i) => (
            <button key={i} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200 hover:bg-white/10">
              <Icon size={15} /> {["New file", "Upload", "New branch", "New pull request"][i]}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

import { ArrowRight, Check, FileText } from "lucide-react";

const CHECKLIST = [
  "Git repositories & pull requests",
  "Team chat & video meetings",
  "Project boards & issue tracking",
  "File sharing & document management",
  "Role-based access & permissions",
];

const TASKS = ["Design system.zip", "requirements.pdf", "brand assets", "documentation.md"];

export function Together() {
  return (
    <section className="bg-slate-50">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Built for modern teams</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Everything works together</h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
            Switch between code, chat, tasks, and meetings without breaking your flow. Klyro puts your entire workflow in one place.
          </p>
          <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
            {CHECKLIST.map((c) => (
              <li key={c} className="flex items-center gap-2"><Check size={16} className="text-blue-600" />{c}</li>
            ))}
          </ul>
          <a href="#" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-medium text-blue-700 hover:border-blue-300">
            Explore all features <ArrowRight size={15} />
          </a>
        </div>

        <div className="relative">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
            <p className="text-xs font-bold text-slate-800"># general</p>
            {[
              ["Alex Johnson", "The onboarding update looks great!"],
              ["Sarah Williams", "Pushed the latest dashboard changes."],
              ["David Ford", "Great work on the API refactor after review."],
            ].map(([who, what]) => (
              <div key={who} className="mt-3 flex gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-[9px] font-bold text-white">
                  {who.split(" ").map((w) => w[0]).join("")}
                </span>
                <div className="text-xs"><p className="font-semibold text-slate-800">{who}</p><p className="text-slate-500">{what}</p></div>
              </div>
            ))}
            <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">Call ended · 22m</p>
          </div>
          <div className="absolute -right-2 -top-8 hidden w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl sm:block">
            <div className="flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-xs font-bold text-white">FD</div>
            <p className="mt-1 px-1 text-[10px] font-semibold text-slate-700">Project Tasks</p>
          </div>
          <div className="absolute -bottom-8 -right-2 hidden w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:block">
            <p className="text-xs font-bold text-slate-800">Project Tasks</p>
            {TASKS.map((t) => (
              <p key={t} className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
                <FileText size={12} className="text-blue-500" />{t}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

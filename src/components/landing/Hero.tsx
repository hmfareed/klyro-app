import { ArrowRight, Check, Play } from "lucide-react";

// Stylized product collage: miniature dark workspace + floating code + video tile.
// Pure CSS stand-ins for the marketing screenshots in the design.
function WorkspaceCard() {
  const rows = [
    ["backend", "feat: add authorisation", "2 hours ago"],
    ["frontend", "fix: dashboard layout", "4 hours ago"],
    ["package.json", "chore: update dependencies", "1 day ago"],
    ["README.md", "docs: update deployment", "2 days ago"],
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#0b1226] shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-2 rounded-md bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">school-management-system</span>
      </div>
      <div className="flex">
        <div className="hidden w-24 space-y-2 border-r border-white/10 p-3 sm:block">
          {["Code", "Issues", "Pulls", "Chat", "Meetings"].map((n, i) => (
            <div key={n} className={`rounded-md px-2 py-1 text-[10px] ${i === 0 ? "bg-indigo-600 text-white" : "text-slate-400"}`}>{n}</div>
          ))}
        </div>
        <div className="flex-1 p-3">
          {rows.map(([name, commit, when]) => (
            <div key={name} className="flex items-center gap-2 border-b border-white/5 py-1.5 text-[10px] last:border-0">
              <span className="w-24 truncate font-medium text-slate-200">{name}</span>
              <span className="flex-1 truncate text-slate-400">{commit}</span>
              <span className="text-slate-500">{when}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-12 lg:grid-cols-2 lg:pt-16">
        <div>
          <p className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            The all-in-one platform for developers and teams
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Build. Collaborate.<br />Ship <span className="text-blue-600">Faster.</span>
          </h1>
          <p className="mt-4 max-w-md text-slate-600">
            Klyro brings your code, teams, and projects together in one powerful platform.
            From Git hosting to real-time collaboration, everything you need to build great software — in one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/signup" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-medium text-white hover:opacity-90">
              Get started free <ArrowRight size={16} />
            </a>
            <a href="#" className="flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700 hover:border-slate-300">
              <Play size={16} className="text-blue-600" /> Watch demo
            </a>
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {["Free forever plan", "No credit card required", "Set up in minutes"].map((t) => (
              <li key={t} className="flex items-center gap-1"><Check size={13} className="text-emerald-500" />{t}</li>
            ))}
          </ul>
        </div>

        <div className="relative">
          <WorkspaceCard />
          <div className="absolute -bottom-8 -left-4 hidden w-64 rounded-xl border border-slate-200 bg-[#0b1226] p-3 shadow-xl sm:block">
            <p className="text-[10px] font-medium text-emerald-400">● Add new feature</p>
            <pre className="mt-1 overflow-hidden text-[10px] leading-relaxed text-slate-300">
              <code>{`const createProject = async (data) => {\n  return api.post('/projects', data)\n}`}</code>
            </pre>
          </div>
          <div className="absolute -right-3 -top-6 hidden items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 pr-3 shadow-xl sm:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-bold text-white">FD</span>
            <div className="text-[10px]"><p className="font-semibold text-slate-800">Fareed</p><p className="text-slate-500">In a meeting</p></div>
            <span className="ml-1 flex -space-x-1.5">
              {["AB", "MA", "KO"].map((i) => (
                <span key={i} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[8px] font-bold text-slate-600">{i}</span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

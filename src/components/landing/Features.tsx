import { Blocks, Code2, FolderLock, KanbanSquare, Sparkles, Users } from "lucide-react";

const FEATURES = [
  { icon: Code2, tint: "bg-violet-100 text-violet-600", title: "Code hosting", body: "Host your repositories, manage branches, review code, and keep your projects organized — just like GitHub, but better." },
  { icon: Users, tint: "bg-sky-100 text-sky-600", title: "Team collaboration", body: "Chat, voice & video calls, and real-time workspaces to keep your team connected and productive." },
  { icon: KanbanSquare, tint: "bg-emerald-100 text-emerald-600", title: "Project management", body: "Plan, track, and deliver with powerful boards, milestones, and issue tracking." },
  { icon: FolderLock, tint: "bg-orange-100 text-orange-600", title: "Secure file storage", body: "Store and share files, documents, and resources with your team, securely and effortlessly." },
  { icon: Blocks, tint: "bg-purple-100 text-purple-600", title: "Powerful integrations", body: "Connect with your favorite tools and services to streamline your workflow." },
  { icon: Sparkles, tint: "bg-teal-100 text-teal-600", title: "AI assistant", body: "Get help with coding, documentation, and more — right inside Klyro." },
];

export function Features() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Everything you need</p>
        <h2 className="mx-auto mt-2 max-w-xl text-3xl font-extrabold tracking-tight text-slate-900">
          More than just Git. It&rsquo;s your complete development workspace.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">
          Klyro combines the best of Git hosting, team collaboration, and project management — so your team can move faster, stay aligned, and build better.
        </p>
        <div className="mt-10 grid gap-x-8 gap-y-10 text-left sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <span className={`inline-flex rounded-xl p-2.5 ${f.tint}`}><f.icon size={22} /></span>
              <h3 className="mt-3 font-bold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

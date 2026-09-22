import { Gauge, Globe, ShieldCheck, Zap } from "lucide-react";
import { BrandMark } from "@/components/Brand";

const POINTS = [
  { icon: ShieldCheck, title: "Enterprise-grade security", body: "SOC 2 compliant & data encryption" },
  { icon: Gauge, title: "99.9% uptime", body: "Reliable and always on" },
  { icon: Globe, title: "Global infrastructure", body: "Fast and secure worldwide" },
  { icon: Zap, title: "Scales with your team", body: "From startups to enterprises" },
];

export function Security() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 lg:grid-cols-2">
        <div className="relative order-2 lg:order-1">
          <div className="rounded-2xl bg-[#0b1226] p-4 shadow-xl">
            <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400" /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /></div>
            <pre className="mt-3 overflow-hidden text-[11px] leading-relaxed text-slate-300">
              <code>{`function deploy(env) {\n  return encrypt(build(env))\n    .then(push)\n    .catch(retry);\n}`}</code>
            </pre>
          </div>
          <div className="absolute -right-2 top-8 w-60 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
            <p className="flex items-center gap-2 text-xs font-bold text-slate-800"><BrandMark size={18} /> Klyro AI</p>
            <p className="mt-2 rounded-lg bg-slate-100 px-2.5 py-2 text-[11px] text-slate-500">Explain this code…</p>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Why Klyro</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Built for performance, security and scale.</h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
            We take security seriously. Your data, your code, and your team&rsquo;s work are always protected with enterprise-grade infrastructure.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-5">
            {POINTS.map((p) => (
              <div key={p.title} className="flex gap-2.5">
                <p.icon size={20} className="shrink-0 text-indigo-600" />
                <div><p className="text-sm font-bold text-slate-900">{p.title}</p><p className="text-xs text-slate-500">{p.body}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

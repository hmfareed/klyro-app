import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Free", blurb: "Perfect for individuals and small teams", price: "$0", per: "/month",
    features: ["Up to 5 members", "1 private repository", "Basic collaboration tools"],
    cta: "Get started", featured: false,
  },
  {
    name: "Pro", blurb: "For growing teams and startups", price: "$12", per: "/user/month",
    features: ["Unlimited repositories", "Advanced collaboration", "Project management", "10 GB storage per user"],
    cta: "Start free trial", featured: true,
  },
  {
    name: "Enterprise", blurb: "For large organizations", price: "Custom pricing", per: "",
    features: ["SSO & advanced security", "Dedicated support", "Custom integrations", "Unlimited storage"],
    cta: "Contact sales", featured: false,
  },
];

export function Pricing() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Simple & transparent</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">Simple, flexible pricing</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">Choose the plan that fits your team&rsquo;s needs. Upgrade or downgrade anytime.</p>
        <div className="mt-10 grid gap-6 text-left md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name} className={`relative rounded-2xl border p-6 ${p.featured ? "border-indigo-300 shadow-xl" : "border-slate-200"}`}>
              {p.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-3 py-0.5 text-[11px] font-semibold text-white">Most popular</span>
              )}
              <h3 className="font-bold text-slate-900">{p.name}</h3>
              <p className="text-xs text-slate-500">{p.blurb}</p>
              <p className="mt-3 text-2xl font-extrabold text-slate-900">{p.price}
                {p.per && <span className="text-xs font-normal text-slate-500">{p.per}</span>}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check size={15} className="text-emerald-500" />{f}</li>
                ))}
              </ul>
              <a href="/signup" className={`mt-6 block rounded-xl px-4 py-2.5 text-center text-sm font-medium ${
                p.featured ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:opacity-90" : "border border-slate-200 text-blue-700 hover:border-blue-300"
              }`}>{p.cta}</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

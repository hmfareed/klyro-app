"use client";
import { ArrowRight, Send } from "lucide-react";
import { BrandLockup, BRAND_TAGLINE } from "@/components/Brand";

const SOCIALS = ["X", "GH", "in", "YT"];

const COLS: { title: string; links: string[] }[] = [
  { title: "Product", links: ["Features", "Pricing", "Integrations", "Changelog"] },
  { title: "Solutions", links: ["For Developers", "For Teams", "For Enterprises", "Education"] },
  { title: "Resources", links: ["Documentation", "Blog", "Help Center", "Community"] },
];

export function Closing() {
  return (
    <>
      <section className="bg-gradient-to-r from-blue-600 to-violet-600">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-10">
          <div>
            <h2 className="text-2xl font-extrabold text-white">Ready to build something great?</h2>
            <p className="mt-1 text-sm text-blue-100">Join thousands of developers and teams already using Klyro.</p>
          </div>
          <a href="/signup" className="ml-auto flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-slate-900 hover:bg-blue-50">
            Get started free <ArrowRight size={16} />
          </a>
        </div>
      </section>

      <footer className="bg-[#0a0f24] text-slate-400">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-[1.2fr_1fr_1fr_1fr_1.4fr]">
          <div>
            <BrandLockup />
            <p className="mt-2 text-xs">{BRAND_TAGLINE}.</p>
            <div className="mt-3 flex gap-2">
              {SOCIALS.map((s) => (
                <a key={s} href="#" aria-label={`${s} social link`} className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-[11px] font-bold hover:border-white/30 hover:text-white">{s}</a>
              ))}
            </div>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <p className="text-sm font-semibold text-white">{c.title}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {c.links.map((l) => <li key={l}><a href="#" className="hover:text-white">{l}</a></li>)}
              </ul>
            </div>
          ))}
          <div>
            <p className="text-sm font-semibold text-white">Stay in the loop</p>
            <p className="mt-3 text-xs">Get the latest updates and news.</p>
            <form className="mt-3 flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <input placeholder="Enter your email" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500" />
              <button aria-label="Subscribe" className="rounded-lg bg-blue-600 p-2.5 text-white hover:bg-blue-500"><Send size={15} /></button>
            </form>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-3 px-6 py-4 text-xs">
            <span>© 2025 Klyro. All rights reserved.</span>
            <span className="ml-auto flex gap-4">
              <a href="#" className="hover:text-white">Privacy Policy</a>
              <a href="#" className="hover:text-white">Terms of Service</a>
              <a href="#" className="hover:text-white">Cookies</a>
            </span>
          </div>
        </div>
      </footer>
    </>
  );
}

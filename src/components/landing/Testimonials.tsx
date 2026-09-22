"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";

const QUOTES = [
  { text: "Klyro has completely transformed the way our team works. The combination of Git, chat, and project management is exactly what we needed. It's fast, reliable, and incredibly intuitive.", who: "David Mensah", role: "CTO, TravelTech", initials: "DM" },
  { text: "We replaced three tools with Klyro in a week. Reviews, standups, and boards finally live where the code lives.", who: "Amara Okafor", role: "Engineering Lead, PayNest", initials: "AO" },
  { text: "The verified contribution record got two of our interns hired. Nothing else proves team experience like Klyro does.", who: "Jonas Weber", role: "Founder, Shipcraft", initials: "JW" },
];

export function Testimonials() {
  const [i, setI] = useState(0);
  const q = QUOTES[i];
  return (
    <section className="bg-[#0a0f24]">
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="text-2xl font-extrabold text-white">What our customers say</h2>
        <div className="relative mt-8 rounded-2xl border border-white/10 bg-white/5 p-8">
          <Quote size={28} className="mx-auto text-indigo-400" />
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-200">{q.text}</p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-xs font-bold text-white">{q.initials}</span>
            <span className="text-left text-xs"><span className="block font-semibold text-white">{q.who}</span><span className="block text-slate-400">{q.role}</span></span>
          </div>
          <button aria-label="Previous" onClick={() => setI((i + QUOTES.length - 1) % QUOTES.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 p-1.5 text-slate-300 hover:bg-white/10"><ChevronLeft size={16} /></button>
          <button aria-label="Next" onClick={() => setI((i + 1) % QUOTES.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 p-1.5 text-slate-300 hover:bg-white/10"><ChevronRight size={16} /></button>
        </div>
        <div className="mt-4 flex justify-center gap-1.5">
          {QUOTES.map((_, d) => (
            <button key={d} aria-label={`Quote ${d + 1}`} onClick={() => setI(d)}
              className={`h-1.5 rounded-full ${d === i ? "w-5 bg-indigo-400" : "w-1.5 bg-white/20"}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

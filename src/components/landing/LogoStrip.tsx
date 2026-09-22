const BRANDS = ["Google", "Microsoft", "Spotify", "Notion", "Figma", "Discord", "Adobe"];

export function LogoStrip() {
  return (
    <section className="border-y border-slate-100 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Trusted by innovative teams worldwide</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {BRANDS.map((b) => (
            <span key={b} className="text-lg font-bold text-slate-400">{b}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
